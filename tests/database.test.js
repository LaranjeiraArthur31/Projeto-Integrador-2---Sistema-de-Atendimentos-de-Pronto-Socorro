import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createApp } from '../services/routes.js';
import { PostgresRepository } from '../services/repository.js';

test('PostgreSQL: cadastro, login, permissões e fluxo completo por cargo', {
  skip: !process.env.API_TEST_DB_PORT
}, async () => {
  const schema = `api_test_${Date.now()}`;
  const config = {
    host: '127.0.0.1', port: Number(process.env.API_TEST_DB_PORT),
    user: process.env.API_TEST_DB_USER || 'postgres',
    password: process.env.API_TEST_DB_PASSWORD || '',
    database: 'api_schema_test', connectionTimeoutMillis: 5000
  };
  const admin = new pg.Client(config);
  const pool = new pg.Pool({ ...config, options: `-c search_path=${schema}` });
  let server;
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../database/insert.sql', import.meta.url), 'utf8'));
    const repository = new PostgresRepository(pool);
    server = createApp(repository).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = '';
    async function request(path, method = 'GET', body, expected = 200) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
      const result = response.status === 204 ? null : await response.json();
      assert.equal(response.status, expected, JSON.stringify(result));
      if (path === '/auth/login' && response.ok) cookie = response.headers.get('set-cookie').split(';')[0];
      return result?.dados;
    }
    async function login(email) {
      return request('/auth/login', 'POST', { email, senha: '123456' });
    }
    await request('/health');
    await request('/atendimentos', 'GET', null, 401);
    await request('/auth/login', 'POST', { email: 'recepcao@hospital.com', senha: 'errada' }, 401);
    const registration = {
      nome_completo: 'Profissional Teste', cpf: '777.777.777-77', cargo: 'Medico',
      email: 'TESTE@example.test', senha: 'senha-apenas-de-teste', ativo: false
    };
    await request('/auth/cadastro', 'POST', { ...registration, senha: 'curta' }, 400);
    await request('/auth/cadastro', 'POST', { ...registration, cargo: 'Admin' }, 400);
    const registered = await request('/auth/cadastro', 'POST', registration, 201);
    assert.equal(registered.ativo, true);
    assert.equal(registered.email, 'teste@example.test');
    assert.equal(Object.hasOwn(registered, 'senha'), false);
    await request('/auth/cadastro', 'POST', registration, 409);
    assert.match((await pool.query('SELECT senha FROM profissional WHERE id_profissional = $1',
      [registered.id_profissional])).rows[0].senha, /^scrypt\$/);
    await request('/auth/login', 'POST', { email: 'teste@example.test', senha: registration.senha });
    assert.equal((await request('/auth/me')).cargo, 'Medico');
    await pool.query('UPDATE profissional SET ativo = FALSE WHERE id_profissional = $1', [registered.id_profissional]);
    await request('/auth/me', 'GET', null, 401);
    await request('/auth/login', 'POST', { email: 'teste@example.test', senha: registration.senha }, 401);
    await login('recepcao@hospital.com');
    assert.match((await pool.query('SELECT senha FROM profissional WHERE id_profissional = 1')).rows[0].senha, /^scrypt\$/);
    // A segunda autenticação usa o hash, inclusive para a senha legada de seis caracteres.
    await login('recepcao@hospital.com');
    assert.equal((await request('/profissionais')).length, 1);
    await request('/profissionais/2', 'GET', null, 403);
    await request('/profissionais/1', 'PUT', { cargo: 'Medico' }, 403);
    await request('/triagens', 'GET', null, 403);
    await request('/atendimentos-medicos', 'POST', { id_atendimento: 1 }, 403);
    const seeded = await request('/atendimentos/AT0001');
    assert.equal(seeded.triagem.classificacao, 'verde');

    const patient = {
      nome_completo: 'Paciente Teste', cpf: '999.999.999-99', rg: '99999',
      nome_mae: 'Mae Teste', data_nascimento: '2000-01-02', sexo: 'F'
    };
    const createdPatient = await request('/pacientes', 'POST', patient, 201);
    await request('/pacientes', 'POST', patient, 409);
    assert.equal((await request(`/pacientes/${createdPatient.id_paciente}`, 'PUT', { telefone: '1234' })).telefone, '1234');
    await request(`/pacientes/${createdPatient.id_paciente}`, 'DELETE', null, 204);
    const data = {
      nome: 'Paciente Fluxo', cpf: '888.888.888-88', rg: '88888',
      mae: 'Mae Fluxo', nascimento: '1995-03-04', sexo: 'M'
    };
    await request('/atendimentos', 'POST', { ...data, rg: '' }, 400);
    await request('/atendimentos', 'POST', { ...data, id_profissional: 2 }, 403);
    const created = await request('/atendimentos', 'POST', data, 201);
    const path = `/atendimentos/${created.id}`;
    assert.equal((await pool.query('SELECT id_recepcionista FROM atendimento WHERE id_atendimento = $1',
      [created.dbId])).rows[0].id_recepcionista, 1);
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => request('/atendimentos', 'POST', data, 201)));
    assert.equal(new Set(concurrent.map((item) => item.id)).size, concurrent.length);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM paciente WHERE cpf = $1', [data.cpf])).rows[0].n, 1);
    await request(path, 'PUT', { status: 'confirmado', medico: {} }, 403);
    await request(path, 'PUT', { telefone: '5555' });
    await login('medico@hospital.com');
    await request(path, 'PUT', { status: 'confirmado', medico: { medicacoes: 'Teste' } }, 400);
    await request('/atendimentos', 'POST', data, 403);
    await request('/pacientes', 'GET', null, 403);
    await login('enfermagem@hospital.com');
    await request(path, 'PUT', { nome: 'Não permitido' }, 403);
    await request(path, 'DELETE', null, 403);
    await request(path, 'PUT', {
      status: 'aguardando-medico', triagem: { queixas: 'Dor', classificacao: 'invalida' }
    }, 400);
    assert.equal((await request(path)).status, 'aguardando-triagem');
    await request(path, 'PUT', {
      status: 'aguardando-medico',
      triagem: { pa: '12x8', temp: 36.5, bpm: 80, queixas: 'Dor', classificacao: 'amarelo', id_profissional: 3 }
    });
    assert.equal((await request(path)).triagem.id_profissional, 2);
    await request(path, 'PUT', { status: 'confirmado', medico: {} }, 403);
    await login('medico@hospital.com');
    await request(path, 'PUT', {
      status: 'confirmado',
      medico: { medicacoes: 'Medicacao teste', diagnostico: 'Diagnostico', observacoes: 'Alta', id_profissional: 1 }
    });
    const finished = await request(path);
    assert.equal(finished.status, 'confirmado');
    assert.equal(finished.medico.id_profissional, 3);
    assert.ok((await pool.query('SELECT data_hora_fim FROM atendimento_medico WHERE id_atendimento = $1',
      [created.dbId])).rows[0].data_hora_fim);
    await request(path, 'PUT', { status: 'em-atendimento', medico: {} }, 400);
    await login('recepcao@hospital.com');
    const cancelPath = `/atendimentos/${concurrent[0].id}`;
    await request(cancelPath, 'DELETE', null, 204);
    assert.equal((await request(cancelPath)).status, 'cancelado');
    await request('/pacientes/1', 'DELETE', null, 409);
    const oldCookie = cookie;
    await request('/auth/logout', 'POST', null, 204);
    await request('/auth/me', 'GET', null, 401);
    cookie = oldCookie;
    await request('/atendimentos', 'GET', null, 401);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
