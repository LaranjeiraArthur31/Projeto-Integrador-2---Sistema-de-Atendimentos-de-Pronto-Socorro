import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../services/routes.js';
import { PostgresRepository } from '../services/repository.js';

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function makeRepository() {
  const user = { id_profissional: 1, nome_completo: 'Recepcionista Teste', cargo: 'Recepcionista', ativo: true };
  return {
    autenticar: async () => user,
    health: async () => {},
    listar: async (entity, filters) => entity === 'profissionais'
      ? [{ id_profissional: 2, nome_completo: 'Enfermeira Teste', cargo: 'Enfermeiro' }]
      : [],
    buscarPorId: async (entity, id) => entity === 'profissionais' && String(id) === '1' ? user : null,
    criar: async (_entity, data) => data,
    atualizar: async (_entity, _id, data) => data,
    remover: async () => true,
    listarAtendimentos: async () => [{ id: 'AT0001', status: 'aguardando-triagem' }],
    buscarAtendimentoPorCodigo: async (codigo) => codigo === 'AT0001'
      ? { id: 'AT0001', status: 'aguardando-triagem' }
      : null,
    salvarAtendimento: async (data) => ({ ...data, id: data.id || 'AT0002', dbId: 2 }),
    cancelarAtendimento: async () => true
  };
}

async function authenticatedFetch(baseUrl) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teste@example.test', senha: 'senha-teste' })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return (url, options = {}) => fetch(url, {
    ...options, headers: { ...options.headers, Cookie: cookie }
  });
}

test('API atende rotas de saúde, web, profissionais e atendimentos', async () => {
  const app = createApp(makeRepository());
  await withServer(app, async (baseUrl) => {
    const fetch = await authenticatedFetch(baseUrl);
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', banco: 'conectado' });

    const web = await fetch(`${baseUrl}/recepcao/recepcao.html`);
    assert.equal(web.status, 200);
    assert.match(await web.text(), /Novo atendimento/);
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Recepção/);

    const professionals = await fetch(`${baseUrl}/profissionais?perfil_acesso=enfermeiro`);
    assert.equal(professionals.status, 200);
    assert.equal((await professionals.json()).dados[0].cargo, 'Recepcionista');

    const list = await fetch(`${baseUrl}/atendimentos`);
    assert.equal((await list.json()).dados[0].id, 'AT0001');

    const detail = await fetch(`${baseUrl}/atendimentos/AT0001`);
    assert.equal((await detail.json()).dados.id, 'AT0001');

    const create = await fetch(`${baseUrl}/atendimentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Paciente Teste', cpf: '000.000.000-00' })
    });
    assert.equal(create.status, 201);
    assert.equal((await create.json()).dados.id, 'AT0002');
  });
});

test('repositório PostgreSQL traduz perfis para cargos e não seleciona senhas', async () => {
  let captured;
  const repository = new PostgresRepository({
    query: async (sql, values) => {
      captured = { sql, values };
      return { rows: [{
          id_profissional: 1,
          nome_completo: 'Profissional',
          cargo: 'Enfermeiro',
          email: 'enfermeiro@example.test',
          ativo: true
        }] };
    }
  });
  const rows = await repository.listar('profissionais', { perfil_acesso: 'enfermeiro' });
  assert.deepEqual(captured.values, ['Enfermeiro', true]);
  assert.match(captured.sql, /WHERE cargo = \$1 AND ativo = \$2/);
  assert.doesNotMatch(captured.sql, /\bsenha\b/);
  assert.equal(Object.hasOwn(rows[0], 'senha'), false);
  await assert.rejects(
    repository.listar('profissionais', { perfil_acesso: "enfermeiro' OR 1=1 --" }),
    { code: 'INVALID_DATA' }
  );
});

test('criação persiste paciente e recepcionista na mesma transação sem prontuário', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
      if (sql.includes('INSERT INTO paciente')) return { rows: [{ id_paciente: 7 }] };
      if (sql.includes('SELECT id_profissional FROM profissional')) {
        return { rows: [{ id_profissional: 9 }] };
      }
      if (sql.includes('INSERT INTO atendimento')) return { rows: [{ id_atendimento: 42 }] };
      if (sql.includes('UPDATE atendimento SET numero_atendimento')) return { rowCount: 1 };
      if (sql.includes('FROM atendimento a')) {
        return { rows: [{
          id_atendimento: 42,
          numero_atendimento: 'AT0042',
          nome_completo: 'Paciente Teste',
          cpf: '123.456.789-00',
          data_nascimento: '1990-05-10',
          sexo: 'F',
          data_hora_chegada: '2026-10-05T10:00:00.000Z',
          status: 'AGUARDANDO_TRIAGEM'
        }] };
      }
      throw new Error(`SQL inesperado no teste: ${sql}`);
    },
    release() {}
  };
  const repository = new PostgresRepository({
    connect: async () => client,
    query: async () => { throw new Error('A transação não deve usar o pool diretamente'); }
  });
  const saved = await repository.salvarAtendimento({
    nome: 'Paciente Teste',
    cpf: '123.456.789-00',
    nascimento: '1990-05-10',
    sexo: 'F',
    rg: '123456',
    mae: 'Mãe Teste',
    id_profissional: 9
  });

  assert.equal(saved.id, 'AT0042');
  assert.equal(saved.dbId, 42);
  assert.equal(saved.status, 'aguardando-triagem');
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.at(-1), 'COMMIT');
  assert.ok(statements.every((sql) => !sql.includes('prontuario')));
});

test('falhas em transações executam rollback e liberam a conexão', async () => {
  const events = [];
  const repository = new PostgresRepository({
    connect: async () => ({
      query: async (sql) => events.push(sql),
      release: () => events.push('RELEASE')
    })
  });
  await assert.rejects(repository.salvarAtendimento({ nome: 'Incompleto' }), { code: 'INVALID_DATA' });
  assert.deepEqual(events, ['BEGIN', 'ROLLBACK', 'RELEASE']);
});

test('API traduz erros PostgreSQL e expõe os recursos do novo esquema', async () => {
  const repository = makeRepository();
  const app = createApp(repository);
  await withServer(app, async (baseUrl) => {
    const fetch = await authenticatedFetch(baseUrl);
    for (const resource of ['pacientes']) {
      assert.equal((await fetch(`${baseUrl}/${resource}`)).status, 200);
      assert.equal((await fetch(`${baseUrl}/${resource}/999`)).status, 404);
    }
    for (const resource of ['triagens', 'atendimentos-medicos']) {
      assert.equal((await fetch(`${baseUrl}/${resource}`)).status, 403);
    }
    assert.equal((await fetch(`${baseUrl}/prontuarios`)).status, 404);
    for (const [code, status] of [
      ['23505', 409], ['23503', 409], ['23502', 400],
      ['23514', 400], ['22P02', 400], ['22007', 400],
      ['22001', 400], ['INVALID_DATA', 400]
    ]) {
      repository.criar = async () => { throw Object.assign(new Error('Dados inválidos'), { code }); };
      const response = await fetch(`${baseUrl}/pacientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      assert.equal(response.status, status, code);
      assert.equal(typeof (await response.json()).erro, 'string');
    }
  });
});
