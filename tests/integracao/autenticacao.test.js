// A) Autenticação e sessão.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, USUARIOS, ambienteDoTeste, cpfAleatorio, emailAleatorio, esperarStatus
} from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };

function cadastro(extra = {}) {
  return {
    nome_completo: 'Profissional de Teste', cpf: cpfAleatorio(), cargo: 'Enfermeiro',
    registro_conselho: 'COREN99999', email: emailAleatorio(), senha: 'SenhaForte123', ...extra
  };
}

// ---------- Cadastro ----------

test('cadastro válido cria a conta ativa, sem devolver a senha, e permite login', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const dados = cadastro();
  const resposta = esperarStatus(await amb.cliente().post('/auth/cadastro', dados), 201);
  assert.equal(resposta.dados.email, dados.email, 'o email cadastrado deveria voltar na resposta');
  assert.equal(resposta.dados.ativo, true, 'a conta nova deveria estar ativa');
  const login = await amb.cliente().post('/auth/login', { email: dados.email, senha: dados.senha });
  esperarStatus(login, 200, 'login com a conta recém-criada');
  assert.equal(login.conteudo.destino, '/triagem/triagem.html', 'enfermeiro deveria ir para a triagem');
});

test('cadastro recusa email inválido', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const email of ['sem-arroba', 'a@b', '@hospital.com', 'nome @hospital.com', '', 123, null]) {
    const resposta = await amb.cliente().post('/auth/cadastro', cadastro({ email }));
    esperarStatus(resposta, 400, `cadastro com email ${JSON.stringify(email)}`);
  }
});

test('cadastro exige senha entre 8 e 128 caracteres', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ senha: 'a'.repeat(7) })), 400, 'senha com 7 caracteres');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ senha: 'a'.repeat(129) })), 400, 'senha com 129 caracteres');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ senha: 12345678 })), 400, 'senha numérica');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ senha: 'a'.repeat(8) })), 201, 'senha com 8 caracteres');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ senha: 'a'.repeat(128) })), 201, 'senha com 128 caracteres');
});

test('cadastro recusa cargo inexistente (inclusive "admin")', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const cargo of ['Admin', 'admin', 'Administrador', 'medico', '', undefined, 'toString', '__proto__']) {
    const resposta = await amb.cliente().post('/auth/cadastro', cadastro({ cargo }));
    esperarStatus(resposta, 400, `cadastro com cargo ${JSON.stringify(cargo)}`);
  }
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM profissional WHERE email LIKE '%@exemplo.test'");
  assert.equal(rows[0].n, 0, 'nenhum profissional deveria ter sido criado com cargo inválido');
});

test('cadastro exige CPF e nome', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const semCpf = cadastro();
  delete semCpf.cpf;
  esperarStatus(await amb.cliente().post('/auth/cadastro', semCpf), 400, 'cadastro sem CPF');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ cpf: '   ' })), 400, 'cadastro com CPF em branco');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ nome_completo: '' })), 400, 'cadastro sem nome');
});

test('cadastro com email repetido devolve 409 (também com letras maiúsculas)', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const dados = cadastro();
  esperarStatus(await amb.cliente().post('/auth/cadastro', dados), 201);
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ email: dados.email })), 409, 'email repetido');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ email: dados.email.toUpperCase() })), 409, 'email repetido em maiúsculas');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ email: USUARIOS.Medico.email })), 409, 'email de demonstração');
});

test('cadastro com CPF repetido devolve 409', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const dados = cadastro();
  esperarStatus(await amb.cliente().post('/auth/cadastro', dados), 201);
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro({ cpf: dados.cpf })), 409, 'CPF repetido');
});

test('cadastro ignora "ativo", "id" e "id_profissional" enviados pelo cliente', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const dados = cadastro({ ativo: false, id: 999, id_profissional: 999 });
  const resposta = esperarStatus(await amb.cliente().post('/auth/cadastro', dados), 201);
  assert.equal(resposta.dados.ativo, true, 'o campo "ativo" enviado pelo cliente não pode ser aceito');
  assert.notEqual(resposta.dados.id_profissional, 999, 'o id enviado pelo cliente não pode ser aceito');
  esperarStatus(await amb.cliente().post('/auth/login', { email: dados.email, senha: dados.senha }), 200, 'login da conta criada com ativo:false');
});

// ---------- Login ----------

test('login recusa senha errada, email inexistente e corpo vazio', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const casos = [
    [{ email: USUARIOS.Medico.email, senha: 'errada' }, 'senha errada'],
    [{ email: 'ninguem@hospital.com', senha: '123456' }, 'email inexistente'],
    [{}, 'corpo vazio'],
    [{ email: USUARIOS.Medico.email }, 'sem senha'],
    [{ email: USUARIOS.Medico.email, senha: '' }, 'senha vazia'],
    [{ email: [USUARIOS.Medico.email], senha: ['123456'] }, 'campos como lista'],
    [{ email: USUARIOS.Medico.email, senha: 'x'.repeat(10_000) }, 'senha gigante']
  ];
  for (const [corpo, descricao] of casos) {
    const resposta = await amb.cliente().post('/auth/login', corpo);
    esperarStatus(resposta, 401, `login com ${descricao}`);
    assert.equal(resposta.headers.get('set-cookie'), null, `login com ${descricao} não pode criar sessão`);
  }
  const semCorpo = await amb.cliente().req('POST', '/auth/login');
  esperarStatus(semCorpo, 401, 'login sem corpo nenhum');
});

test('login recusa profissional inativo', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  await amb.query('UPDATE profissional SET ativo = FALSE WHERE email = $1', [USUARIOS.Enfermeiro.email]);
  esperarStatus(await amb.cliente().post('/auth/login', { email: USUARIOS.Enfermeiro.email, senha: '123456' }), 401, 'login de inativo');
});

test('login aceita email com letras maiúsculas e espaços nas pontas', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const resposta = await amb.cliente().post('/auth/login', { email: '  MEDICO@Hospital.COM ', senha: '123456' });
  esperarStatus(resposta, 200, 'login com email em maiúsculas');
  assert.equal(resposta.dados.cargo, 'Medico');
  assert.equal(resposta.conteudo.destino, '/medico/medico.html');
});

test('o primeiro login troca a senha de demonstração por hash scrypt', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  await amb.recepcao();
  const { rows } = await amb.query('SELECT senha FROM profissional WHERE email = $1', [USUARIOS.Recepcionista.email]);
  assert.match(rows[0].senha, /^scrypt\$/, 'a senha deveria ter sido gravada como hash');
  await amb.recepcao(); // e o login continua funcionando com o hash
});

// ---------- Sessão ----------

test('sem cookie ou com cookie inventado a API devolve 401', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const anonimo = amb.cliente();
  esperarStatus(await anonimo.get('/auth/me'), 401, '/auth/me sem cookie');
  esperarStatus(await anonimo.get('/atendimentos'), 401, '/atendimentos sem cookie');
  for (const cookie of ['ps_session=inventado', `ps_session=${'a'.repeat(64)}`, 'ps_session=', 'outro=1']) {
    const resposta = await anonimo.get('/atendimentos', { cabecalhos: { Cookie: cookie } });
    esperarStatus(resposta, 401, `/atendimentos com cookie "${cookie}"`);
  }
});

test('depois do logout o cookie antigo não vale mais', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const cookieAntigo = recepcao.cookie;
  esperarStatus(await recepcao.get('/auth/me'), 200, '/auth/me logado');
  const saida = esperarStatus(await recepcao.post('/auth/logout'), 204, 'logout');
  assert.match(saida.headers.get('set-cookie') || '', /ps_session=;/, 'o logout deveria apagar o cookie');
  const outro = amb.cliente();
  esperarStatus(await outro.get('/auth/me', { cabecalhos: { Cookie: cookieAntigo } }), 401, '/auth/me com cookie antigo');
  esperarStatus(await outro.get('/atendimentos', { cabecalhos: { Cookie: cookieAntigo } }), 401, '/atendimentos com cookie antigo');
});

test('novo login troca o token da sessão', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const cliente = await amb.medico();
  const primeiro = cliente.cookie;
  await cliente.login(USUARIOS.Medico.email);
  assert.notEqual(cliente.cookie, primeiro, 'o token deveria mudar a cada login');
  esperarStatus(await amb.cliente().get('/auth/me', { cabecalhos: { Cookie: primeiro } }), 401, 'token anterior após novo login');
});

test('profissional desativado perde a sessão já aberta', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const medico = await amb.medico();
  await amb.query('UPDATE profissional SET ativo = FALSE WHERE email = $1', [USUARIOS.Medico.email]);
  esperarStatus(await medico.get('/atendimentos'), 401, 'sessão de profissional desativado');
});

test('o cookie de sessão é HttpOnly e SameSite=Strict', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const resposta = await amb.cliente().post('/auth/login', { email: USUARIOS.Medico.email, senha: '123456' });
  const cookie = resposta.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i, 'cookie sem HttpOnly');
  assert.match(cookie, /SameSite=Strict/i, 'cookie sem SameSite=Strict');
  assert.match(cookie, /Path=\//i, 'cookie sem Path=/');
});

test('mais de 30 tentativas de login em 15 minutos devolvem 429', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (let i = 1; i <= 30; i++) {
    esperarStatus(await amb.cliente().post('/auth/login', { email: 'x@y.com', senha: 'errada' }), 401, `tentativa ${i}`);
  }
  const bloqueada = await amb.cliente().post('/auth/login', { email: USUARIOS.Medico.email, senha: '123456' });
  esperarStatus(bloqueada, 429, 'tentativa 31 (mesmo com a senha certa)');
  assert.ok(Number(bloqueada.headers.get('retry-after')) > 0, 'a resposta 429 deveria trazer Retry-After');
  esperarStatus(await amb.cliente().post('/auth/cadastro', cadastro()), 429, 'cadastro também é limitado');
});

test('nenhuma resposta da API expõe senha ou hash', opcoes, async (t) => {
  // O Cliente já confere isso em todas as respostas; aqui passamos pelas rotas que tocam em profissional.
  const amb = await ambienteDoTeste(t);
  const dados = cadastro();
  await amb.cliente().post('/auth/cadastro', dados);
  for (const email of [USUARIOS.Recepcionista.email, USUARIOS.Enfermeiro.email, USUARIOS.Medico.email, dados.email]) {
    const cliente = await amb.entrar(email, email === dados.email ? dados.senha : '123456');
    const eu = await cliente.get('/auth/me');
    assert.equal(Object.hasOwn(eu.dados, 'senha'), false, `/auth/me de ${email} trouxe a senha`);
    await cliente.get('/profissionais');
    await cliente.get(`/profissionais/${eu.dados.id_profissional}`);
    await cliente.get('/atendimentos');
  }
});
