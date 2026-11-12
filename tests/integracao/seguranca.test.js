// E) Segurança: injeção de SQL, XSS, origem, cabeçalhos e caminhos.
// (O uso de escapeHtml no front é conferido em tests/front/estatico.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, USUARIOS, ambienteDoTeste, contar, criarAtendimento, dadosTriagem, esperarStatus, triar
} from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };
const proposta = (texto) => ({ skip: SEM_BANCO, todo: `PROPOSTA: ${texto}` });

async function tabelasIntactas(amb) {
  const { rows } = await amb.query(
    "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'",
    [amb.schema]
  );
  assert.equal(rows[0].n, 5, 'as 5 tabelas do sistema deveriam continuar existindo');
}

test('injeção de SQL nos campos de texto é gravada como texto comum', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem] = [await amb.recepcao(), await amb.enfermagem()];
  const ataques = [
    "Robert'); DROP TABLE paciente;--",
    "' OR '1'='1",
    "x'; UPDATE profissional SET cargo='Medico';--",
    '1; DELETE FROM atendimento'
  ];
  for (const ataque of ataques) {
    const criado = await criarAtendimento(recepcao, { nome: ataque, mae: ataque, endereco: ataque });
    assert.equal(criado.nome, ataque, 'o texto deveria voltar sem alteração');
    const triado = await triar(enfermagem, criado.id, { queixas: ataque });
    assert.equal(triado.triagem.queixas, ataque);
  }
  await tabelasIntactas(amb);
  assert.equal(await contar(amb, 'atendimento'), 6 + ataques.length);
  const { rows } = await amb.query('SELECT cargo FROM profissional ORDER BY id_profissional');
  assert.deepEqual(rows.map((r) => r.cargo), ['Recepcionista', 'Enfermeiro', 'Medico']);
});

test('injeção de SQL nos parâmetros da URL devolve erro tratado e não altera nada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem] = [await amb.recepcao(), await amb.enfermagem()];
  const codigo = encodeURIComponent("AT0001'; DROP TABLE paciente;--");
  esperarStatus(await recepcao.get(`/atendimentos/${codigo}`), 404, 'GET com injeção no código');
  esperarStatus(await recepcao.put(`/atendimentos/${codigo}`, { nome: 'X' }), 404, 'PUT com injeção no código');
  esperarStatus(await recepcao.delete(`/atendimentos/${codigo}`), 404, 'DELETE com injeção no código');
  esperarStatus(await recepcao.delete(`/atendimentos/${encodeURIComponent("' OR '1'='1")}`), 404, 'DELETE com OR 1=1');
  for (const id of ['1%20OR%201%3D1', "1'%3B%20DROP%20TABLE%20paciente%3B--", '1;DELETE']) {
    const resposta = await recepcao.get(`/pacientes/${id}`);
    esperarStatus(resposta, 400, `GET /pacientes/${decodeURIComponent(id)}`);
    assert.equal(resposta.erro, 'Dados inválidos ou campos obrigatórios ausentes', 'a resposta não pode expor detalhes do banco');
  }
  esperarStatus(await enfermagem.delete('/triagens/1%20OR%201%3D1'), 400, 'DELETE /triagens com OR 1=1');
  await tabelasIntactas(amb);
  assert.equal(await contar(amb, 'paciente'), 6);
  assert.equal(await contar(amb, 'triagem'), 5);
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM atendimento WHERE status = 'CANCELADO'");
  assert.equal(rows[0].n, 0, 'nenhum atendimento deveria ter sido cancelado');
});

test('injeção de SQL no login não autentica', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const [email, senha] of [["' OR '1'='1", "' OR '1'='1"], [`${USUARIOS.Medico.email}' --`, 'x'], ['%', '123456']]) {
    esperarStatus(await amb.cliente().post('/auth/login', { email, senha }), 401, `login com ${email}`);
  }
});

test('XSS: a API devolve os textos como dados JSON, sem interpretar', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem] = [await amb.recepcao(), await amb.enfermagem()];
  const script = '<script>alert(1)</script>';
  const imagem = '<img src=x onerror="alert(document.cookie)">';
  const criado = await criarAtendimento(recepcao, { nome: script, endereco: imagem });
  await triar(enfermagem, criado.id, { queixas: imagem });
  const resposta = esperarStatus(await recepcao.get(`/atendimentos/${criado.id}`), 200);
  assert.match(resposta.headers.get('content-type'), /^application\/json/, 'a API deveria responder JSON, nunca HTML');
  assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(resposta.dados.nome, script);
  assert.equal(resposta.dados.endereco, imagem);
  assert.equal(resposta.dados.triagem.queixas, imagem);
});

test('POST/PUT/DELETE com Origin de outro site devolvem 403 e não alteram nada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const outroSite = { cabecalhos: { Origin: 'http://site-malicioso.example' } };
  esperarStatus(await amb.cliente().post('/auth/login', { email: USUARIOS.Medico.email, senha: '123456' }, outroSite), 403, 'login de outra origem');
  esperarStatus(await recepcao.put('/atendimentos/AT0001', { nome: 'Invasor' }, outroSite), 403, 'PUT de outra origem');
  esperarStatus(await recepcao.delete('/atendimentos/AT0006', outroSite), 403, 'DELETE de outra origem');
  esperarStatus(await recepcao.post('/atendimentos', { nome: 'X' }, outroSite), 403, 'POST de outra origem');
  esperarStatus(await recepcao.post('/auth/logout', undefined, { cabecalhos: { Origin: 'null' } }), 403, 'logout com Origin null');
  const { rows } = await amb.query("SELECT nome_completo FROM paciente WHERE cpf = '123.456.789-00'");
  assert.equal(rows[0].nome_completo, 'João da Silva');
  // Mesma origem e GET de outra origem continuam funcionando.
  esperarStatus(await recepcao.put('/atendimentos/AT0006', { telefone: '1' }, { cabecalhos: { Origin: amb.base } }), 200, 'PUT da mesma origem');
  esperarStatus(await recepcao.get('/atendimentos', outroSite), 200, 'GET de outra origem');
  esperarStatus(await recepcao.get('/auth/me'), 200, 'a sessão continua válida');
});

test('cabeçalhos de segurança presentes na API e nas páginas', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const caminho of ['/health', '/atendimentos', '/auth/login.html', '/recepcao/recepcao.html', '/comum/comum.js', '/rota-inexistente']) {
    const resposta = await recepcao.get(caminho);
    assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff', `${caminho} sem X-Content-Type-Options`);
    assert.equal(resposta.headers.get('referrer-policy'), 'same-origin', `${caminho} sem Referrer-Policy`);
    assert.equal(resposta.headers.get('cache-control'), 'no-store', `${caminho} sem Cache-Control no-store`);
    assert.equal(resposta.headers.get('x-powered-by'), null, `${caminho} expõe X-Powered-By`);
  }
});

test('páginas não podem ser exibidas dentro de iframe de outro site', proposta(
  'faltam X-Frame-Options: DENY e Content-Security-Policy (frame-ancestors \'none\'); proteção contra clickjacking'
), async (t) => {
  const amb = await ambienteDoTeste(t);
  const resposta = await amb.cliente().get('/auth/login.html');
  assert.ok(resposta.headers.get('x-frame-options') || /frame-ancestors/.test(resposta.headers.get('content-security-policy') || ''),
    'a página deveria trazer X-Frame-Options ou CSP frame-ancestors');
});

test('caminhos com ../ não saem da pasta web', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const cliente = amb.cliente();
  for (const caminho of [
    '/../.env', '/..%2f.env', '/%2e%2e/.env', '/%2e%2e%2fservices%2fserver.js', '/..%5c.env',
    '/comum/..%2f..%2fpackage.json', '/.env', '/%2e%2e%2f%2e%2e%2fwindows/win.ini'
  ]) {
    const resposta = await cliente.get(caminho);
    assert.ok([400, 404].includes(resposta.status), `${caminho}: esperado 400 ou 404, recebido ${resposta.status}`);
    assert.ok(!/DB_PASSWORD|"dependencies"|createApp/.test(resposta.texto), `${caminho} expôs arquivo de fora da pasta web`);
  }
  esperarStatus(await cliente.get('/%E0%A4%A'), 400, 'URL com codificação inválida');
});

test('erros internos não expõem detalhes do banco', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const resposta = await recepcao.post('/atendimentos', { nome: 'x'.repeat(200), cpf: '123.456.789-09', rg: '1', mae: 'M', nascimento: '2000-01-01', sexo: 'F' });
  esperarStatus(resposta, 400);
  assert.ok(!/value too long|character varying|postgres|stack/i.test(resposta.texto), `mensagem técnica exposta: ${resposta.texto}`);
  const triagem = await (await amb.enfermagem()).put('/atendimentos/AT0006', { status: 'aguardando-medico', triagem: dadosTriagem({ bpm: 'abc' }) });
  assert.ok(!/invalid input syntax|integer/i.test(triagem.texto), `mensagem técnica exposta: ${triagem.texto}`);
});
