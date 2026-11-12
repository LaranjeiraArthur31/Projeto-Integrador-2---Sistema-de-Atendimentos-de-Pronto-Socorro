// Páginas × cargos: cada página responde 200 para quem pode vê-la e redireciona os demais
// (para a própria área, ou para o login sem sessão). Usa apenas fetch nativo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEM_BANCO, USUARIOS, ambienteDoTeste } from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };
const LOGIN = '/auth/login.html';
const AREA = {
  Recepcionista: '/recepcao/recepcao.html',
  Enfermeiro: '/triagem/triagem.html',
  Medico: '/medico/medico.html'
};
const PAINEL = '/painel/painel.html';

async function abrir(cliente, caminho) {
  const resposta = await cliente.get(caminho);
  return { status: resposta.status, destino: resposta.headers.get('location'), tipo: resposta.headers.get('content-type') || '', texto: resposta.texto };
}

function esperarPagina(r, caminho, quem) {
  assert.equal(r.status, 200, `${quem} abrindo ${caminho}: esperado 200, recebido ${r.status}${r.destino ? ` (redireciona para ${r.destino})` : ''}`);
  assert.match(r.tipo, /^text\/html/, `${caminho} deveria ser HTML`);
}

function esperarRedirecionamento(r, caminho, destino, quem) {
  assert.ok([301, 302, 303, 307].includes(r.status), `${quem} abrindo ${caminho}: esperado redirecionamento, recebido ${r.status}`);
  assert.equal(r.destino, destino, `${quem} abrindo ${caminho}: deveria ir para ${destino}, foi para ${r.destino}`);
}

test('login e cadastro abrem sem sessão; as demais páginas mandam para o login', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t, { dados: false });
  const anonimo = amb.cliente();
  for (const caminho of [LOGIN, '/auth/cadastro.html']) esperarPagina(await abrir(anonimo, caminho), caminho, 'visitante');
  for (const caminho of [...Object.values(AREA), PAINEL, '/recepcao/', '/painel/painel.css']) {
    esperarRedirecionamento(await abrir(anonimo, caminho), caminho, LOGIN, 'visitante');
  }
  esperarRedirecionamento(await abrir(anonimo, '/'), '/', LOGIN, 'visitante');
  // Arquivos comuns (CSS/JS do login) continuam acessíveis.
  for (const caminho of ['/comum/comum.css', '/auth/auth.js']) {
    assert.equal((await abrir(anonimo, caminho)).status, 200, `${caminho} deveria abrir sem sessão`);
  }
});

test('cada cargo abre a própria página e o painel; as outras redirecionam para a própria área', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const [cargo, { email }] of Object.entries(USUARIOS)) {
    const cliente = await amb.entrar(email);
    const propria = AREA[cargo];
    esperarPagina(await abrir(cliente, propria), propria, cargo);
    esperarPagina(await abrir(cliente, PAINEL), PAINEL, cargo);
    esperarPagina(await abrir(cliente, LOGIN), LOGIN, cargo);
    esperarRedirecionamento(await abrir(cliente, '/'), '/', propria, cargo);
    for (const [outro, pagina] of Object.entries(AREA)) {
      if (outro === cargo) continue;
      esperarRedirecionamento(await abrir(cliente, pagina), pagina, propria, cargo);
      // CSS da área de outro cargo também é protegido.
      const css = pagina.replace('.html', '.css');
      esperarRedirecionamento(await abrir(cliente, css), css, propria, cargo);
    }
  }
});

test('variações de caminho (maiúsculas, %xx, ./, ../) não furam a proteção das páginas', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const anonimo = amb.cliente();
  const medico = await amb.medico();
  const variacoes = [
    '/RECEPCAO/recepcao.html', '/Recepcao/recepcao.html', '/%72ecepcao/recepcao.html', '/%52ECEPCAO/recepcao.html',
    '/./recepcao/recepcao.html', '/auth/../recepcao/recepcao.html', '/auth/..%2frecepcao/recepcao.html',
    '//recepcao/recepcao.html', '/recepcao%2frecepcao.html', '/recepcao/recepcao.html?x=1'
  ];
  for (const caminho of variacoes) {
    for (const [quem, cliente, destino] of [['visitante', anonimo, LOGIN], ['Medico', medico, AREA.Medico]]) {
      const r = await abrir(cliente, caminho);
      assert.ok(r.status !== 200 || !/<html/i.test(r.texto) || r.destino,
        `${quem} conseguiu abrir a página da recepção por ${caminho}`);
      if (r.status === 302) assert.equal(r.destino, destino, `${quem} em ${caminho}: redirecionou para ${r.destino}`);
      else assert.ok([400, 404].includes(r.status), `${quem} em ${caminho}: esperado 302, 400 ou 404, recebido ${r.status}`);
    }
  }
});

test('após o logout as páginas voltam a mandar para o login', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  esperarPagina(await abrir(recepcao, AREA.Recepcionista), AREA.Recepcionista, 'Recepcionista');
  assert.equal((await recepcao.post('/auth/logout')).status, 204, 'logout deveria responder 204');
  esperarRedirecionamento(await abrir(recepcao, AREA.Recepcionista), AREA.Recepcionista, LOGIN, 'Recepcionista após logout');
});
