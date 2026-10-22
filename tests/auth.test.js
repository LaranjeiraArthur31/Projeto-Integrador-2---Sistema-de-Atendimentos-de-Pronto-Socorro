import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../services/routes.js';
import { hashPassword, verifyPassword, HOME_BY_ROLE } from '../services/auth.js';

test('senhas usam scrypt com salt e não aceitam hashes malformados', async () => {
  const hash = await hashPassword('senha-segura');
  assert.notEqual(hash, await hashPassword('senha-segura'));
  assert.equal(await verifyPassword('senha-segura', hash), true);
  assert.equal(await verifyPassword('incorreta', hash), false);
  assert.equal(await verifyPassword('teste', 'scrypt$invalido'), false);
  assert.equal(await verifyPassword(null, hash), false);
  await assert.rejects(hashPassword('curta'), { code: 'INVALID_DATA' });
  await assert.rejects(hashPassword('x'.repeat(129)), { code: 'INVALID_DATA' });
});

test('telas e API exigem sessão, restringem cargos e invalidam o logout', async () => {
  let user;
  const saved = [];
  const users = Object.keys(HOME_BY_ROLE).map((cargo, i) => ({
    id_profissional: i + 1, nome_completo: `Teste ${cargo}`, cargo, ativo: true
  }));
  const repository = {
    health: async () => {},
    autenticar: async (email) => users.find((item) => item.cargo === email),
    buscarPorId: async (_entity, id) => users.find((item) => item.id_profissional === id),
    listar: async () => [],
    listarAtendimentos: async () => [],
    salvarAtendimento: async (data) => { saved.push(data); return data; }
  };
  const server = createApp(repository).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const request = (url, options = {}) => fetch(`${base}${url}`, {
    ...options, redirect: 'manual', headers: { Cookie: cookie, ...options.headers }
  });
  const json = (method, body) => ({
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await request('/auth/login.html')).status, 200);
    assert.equal((await request('/auth/cadastro.html')).status, 200);
    assert.equal((await request('/atendimentos')).status, 401);
    assert.equal((await request('/recepcao/recepcao.html')).headers.get('location'), '/auth/login.html');
    assert.equal((await request('/painel/painel.html')).status, 302);
    for (user of users) {
      const login = await request('/auth/login', json('POST', { email: user.cargo, senha: 'teste' }));
      cookie = login.headers.get('set-cookie').split(';')[0];
      assert.match(login.headers.get('set-cookie'), /HttpOnly/);
      assert.match(login.headers.get('set-cookie'), /SameSite=Strict/);
      for (const [role, home] of Object.entries(HOME_BY_ROLE)) {
        const page = await request(home);
        assert.equal(page.status, role === user.cargo ? 200 : 302);
        if (role !== user.cargo) assert.equal(page.headers.get('location'), HOME_BY_ROLE[user.cargo]);
      }
      assert.equal((await request('/painel/painel.html')).status, 200);
      assert.equal((await request('/%6dedico/medico.html')).status, user.cargo === 'Medico' ? 200 : 302);
      assert.equal((await request('/atendimentos')).status, 200);
      assert.equal((await request('/profissionais/1', json('PUT', { cargo: 'Medico' }))).status, 403);
      assert.equal((await request('/atendimentos', json('POST', {}))).status,
        user.cargo === 'Recepcionista' ? 201 : 403);
      for (const [resource, role] of Object.entries({
        pacientes: 'Recepcionista', triagens: 'Enfermeiro', 'atendimentos-medicos': 'Medico'
      })) {
        assert.equal((await request(`/${resource}`)).status, user.cargo === role ? 200 : 403);
      }
      const invalid = user.cargo === 'Recepcionista' ? { medico: {} }
        : user.cargo === 'Enfermeiro' ? { medico: {}, status: 'confirmado' } : { triagem: {} };
      assert.equal((await request('/atendimentos/AT0001', json('PUT', invalid))).status, 403);
      if (user.cargo !== 'Recepcionista') {
        const field = user.cargo === 'Medico' ? 'medico' : 'triagem';
        await request('/atendimentos/AT0001', json('PUT', { [field]: { id_profissional: 999 } }));
        assert.equal(saved.at(-1)[field].id_profissional, user.id_profissional);
      }
      const csrf = await request('/auth/logout', {
        method: 'POST', headers: { Origin: 'https://outro.example' }
      });
      assert.equal(csrf.status, 403);
      assert.equal((await request('/auth/logout', { method: 'POST' })).status, 204);
      assert.equal((await request('/auth/me')).status, 401);
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
