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
  return {
    health: async () => {},
    listar: async (entity, filters) => entity === 'profissionais'
      ? [{ id_profissional: 2, nome_completo: 'Enfermeira Teste', cargo: 'Enfermagem', perfil_acesso: filters.perfil_acesso }]
      : [],
    buscarPorId: async () => null,
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

test('API atende rotas de saúde, web, profissionais e atendimentos', async () => {
  const app = createApp(makeRepository());
  await withServer(app, async (baseUrl) => {
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
    assert.equal((await professionals.json()).dados[0].perfil_acesso, 'enfermeiro');

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

test('repositório PostgreSQL usa parâmetros e não retorna senha de profissionais', async () => {
  let captured;
  const repository = new PostgresRepository({
    query: async (sql, values) => {
      captured = { sql, values };
      return {
        rows: [{
          id_profissional: 1,
          nome_completo: 'Profissional',
          cargo: 'Enfermagem',
          perfil_acesso: 'enfermeiro',
          email: 'enfermeiro@example.test',
          ativo: true,
          senha_hash: 'não deve ser retornado'
        }]
      };
    }
  });
  const rows = await repository.listar('profissionais', { perfil_acesso: "enfermeiro' OR 1=1 --" });
  assert.deepEqual(captured.values, ["enfermeiro' OR 1=1 --", true]);
  assert.match(captured.sql, /WHERE perfil_acesso = \$1 AND ativo = \$2/);
  assert.equal(Object.hasOwn(rows[0], 'senha_hash'), false);
});

test('criação de atendimento persiste paciente, prontuário e vínculo na mesma transação', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql.trim().split(/\s+/).slice(0, 4).join(' '));
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('INSERT INTO hospitacao_paciente')) return { rows: [{ id_paciente: 7 }] };
      if (sql.includes('INSERT INTO hospitacao_prontuario')) return { rows: [{ id_prontuario: 4 }] };
      if (sql.includes('SELECT id_profissional FROM hospitacao_profissional')) {
        return { rows: [{ id_profissional: 9 }] };
      }
      if (sql.includes("SELECT 'AT' || LPAD")) return { rows: [{ cod: 'AT0042' }] };
      if (sql.includes('INSERT INTO hospitacao_atendimento')) return { rows: [{ id_atendimento: 42 }] };
      if (sql.includes('FROM hospitacao_atendimento a')) {
        return { rows: [{
          id_atendimento: 42,
          cod_atendimento: 'AT0042',
          nome_completo: 'Paciente Teste',
          cpf: '123.456.789-00',
          data_nascimento: '1990-05-10',
          sexo: 'F',
          data_hora_chegada: '2026-10-05T10:00:00.000Z',
          status: 'aguardando_triagem'
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
    id_profissional: 9
  });

  assert.equal(saved.id, 'AT0042');
  assert.equal(saved.dbId, 42);
  assert.equal(saved.status, 'aguardando-triagem');
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.at(-1), 'COMMIT');
});
