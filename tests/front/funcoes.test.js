// Funções do front executadas em vm (sem navegador): comum.js e a ordenação do painel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarPagina, renderizarPainel } from '../helpers/navegador.js';

test('calcularIdade conta o aniversário corretamente', () => {
  const { executar } = carregarPagina(null, { agora: '2026-03-15T12:00:00' });
  const idade = (data) => executar(`calcularIdade(${JSON.stringify(data)})`);
  assert.equal(idade('2000-03-15'), '26 anos', 'aniversário hoje: já completou');
  assert.equal(idade('2000-03-16'), '25 anos', 'aniversário amanhã: ainda não completou');
  assert.equal(idade('2000-02-29'), '26 anos', 'nascido em 29/02, depois de fevereiro');
  assert.equal(idade('1990-12-31'), '35 anos');
  assert.equal(idade('2026-03-15'), '0 anos', 'recém-nascido');
  assert.equal(idade('1926-03-16'), '99 anos');
  assert.equal(idade(''), '', 'sem data: texto vazio');
  assert.equal(idade(null), '', 'data nula: texto vazio');
});

test('calcularIdade no último dia do mês e na virada do ano', () => {
  const ano = carregarPagina(null, { agora: '2027-01-01T00:30:00' });
  assert.equal(ano.executar('calcularIdade("2000-12-31")'), '26 anos');
  assert.equal(ano.executar('calcularIdade("2000-01-01")'), '27 anos');
  const fevereiro = carregarPagina(null, { agora: '2027-02-28T10:00:00' });
  assert.equal(fevereiro.executar('calcularIdade("2000-02-29")'), '26 anos', 'em ano não bissexto, 28/02 ainda é antes de 29/02');
});

test('formatarData mostra DD/MM/AAAA sem mudar o dia por fuso horário', () => {
  const { executar } = carregarPagina(null);
  assert.equal(executar('formatarData("2026-03-05")'), '05/03/2026');
  assert.equal(executar('formatarData("1999-12-31")'), '31/12/1999');
  assert.equal(executar('formatarData("2026-03-05T23:59:00.000Z")'), '05/03/2026');
  assert.equal(executar('formatarData("")'), '-');
  assert.equal(executar('formatarData(null)'), '-');
  assert.equal(executar('formatarData(undefined)'), '-');
});

test('escapeHtml neutraliza os caracteres especiais do HTML', () => {
  const { executar } = carregarPagina(null);
  const esc = (valor) => executar(`escapeHtml(${JSON.stringify(valor)})`);
  assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(esc("O'Brien & Filhos"), 'O&#39;Brien &amp; Filhos');
  assert.equal(esc('&amp;'), '&amp;amp;', 'o & de entidades já escritas também é escapado');
  assert.equal(esc('João Conceição — 😀'), 'João Conceição — 😀', 'acentos e emoji não são alterados');
  assert.equal(executar('escapeHtml(null)'), '');
  assert.equal(executar('escapeHtml(undefined)'), '');
  assert.equal(executar('escapeHtml(0)'), '0');
  assert.equal(executar('escapeHtml(36.5)'), '36.5');
});

test('MANCHESTER_ORDEM segue a ordem de gravidade do banco e todas as cores têm rótulo', () => {
  const { executar } = carregarPagina(null);
  const ordem = executar('MANCHESTER_ORDEM');
  const rotulos = executar('MANCHESTER_LABEL');
  const schema = readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  const cores = schema.match(/classificacao_manchester IN \(([^)]+)\)/)[1].match(/'(\w+)'/g).map((c) => c.slice(1, -1).toLowerCase());
  assert.deepEqual(Object.keys(ordem).sort((a, b) => ordem[a] - ordem[b]), cores,
    'a ordem do front deve ser vermelho, laranja, amarelo, verde, azul (a mesma do banco)');
  assert.deepEqual(Object.values(ordem).sort(), [1, 2, 3, 4, 5]);
  for (const cor of cores) assert.ok(rotulos[cor], `falta o rótulo da cor ${cor}`);
});

test('STATUS_LABEL tem rótulo para todos os status que a API devolve', () => {
  const { executar } = carregarPagina(null);
  const rotulos = executar('STATUS_LABEL');
  const repositorio = readFileSync(new URL('../../services/repository.js', import.meta.url), 'utf8');
  const bloco = repositorio.match(/UI_TO_DB_STATUS = \{([\s\S]*?)\};/)[1];
  const status = [...bloco.matchAll(/'?([\w-]+)'?\s*:/g)].map((m) => m[1]);
  assert.ok(status.length >= 5, 'não foi possível ler os status da API');
  for (const s of status) assert.ok(rotulos[s], `falta o rótulo do status "${s}"`);
});

// ---------- Painel ----------

function atendimento(id, status, cor, minutos, extra = {}) {
  return {
    id, status, nome: `Paciente ${id}`, nascimento: '1980-01-01',
    criadoEm: new Date(Date.UTC(2026, 0, 1, 8, minutos)).toISOString(),
    triagem: cor ? { classificacao: cor, queixas: `Queixa ${id}`, pa: '12/8', temp: '36.5', bpm: 80 } : null,
    ...extra
  };
}

test('painel: mostra só quem aguarda ou está em atendimento médico', () => {
  const itens = renderizarPainel([
    atendimento('AT0001', 'aguardando-triagem', null, 0),
    atendimento('AT0002', 'aguardando-medico', 'verde', 1),
    atendimento('AT0003', 'em-atendimento', 'amarelo', 2),
    atendimento('AT0004', 'confirmado', 'vermelho', 3),
    atendimento('AT0005', 'cancelado', 'vermelho', 4)
  ]);
  assert.deepEqual(itens.map((i) => i.codigo), ['AT0003', 'AT0002']);
});

test('painel: ordena pela cor de Manchester e, na mesma cor, pela chegada', () => {
  const lista = [
    atendimento('AT0010', 'aguardando-medico', 'azul', 0),
    atendimento('AT0011', 'aguardando-medico', 'verde', 30),
    atendimento('AT0012', 'aguardando-medico', 'vermelho', 50),
    atendimento('AT0013', 'em-atendimento', 'verde', 10),
    atendimento('AT0014', 'aguardando-medico', 'laranja', 40),
    atendimento('AT0015', 'aguardando-medico', 'vermelho', 20),
    atendimento('AT0016', 'aguardando-medico', 'amarelo', 5)
  ];
  const esperado = ['AT0015', 'AT0012', 'AT0014', 'AT0016', 'AT0013', 'AT0011', 'AT0010'];
  assert.deepEqual(renderizarPainel(lista).map((i) => i.codigo), esperado);
  assert.deepEqual(renderizarPainel([...lista].reverse()).map((i) => i.codigo), esperado,
    'a ordem não pode depender da ordem em que a API devolve a lista');
  const itens = renderizarPainel(lista);
  assert.match(itens[0].classe, /\bvermelho\b/, 'o item recebe a classe da cor');
  assert.match(itens[0].html, />1º</, 'a posição começa em 1º');
  assert.match(itens[6].html, />7º</);
});

test('painel: textos do paciente aparecem escapados (sem HTML injetado)', () => {
  const [item] = renderizarPainel([
    atendimento('AT0020', 'aguardando-medico', 'verde', 0, {
      nome: '<img src=x onerror=alert(1)>',
      triagem: { classificacao: 'verde', queixas: '<script>alert(2)</script>' }
    })
  ]);
  assert.ok(!item.html.includes('<img'), 'o nome foi inserido como HTML');
  assert.ok(!item.html.includes('<script'), 'a queixa foi inserida como HTML');
  assert.match(item.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(item.html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
});

test('painel: lista vazia mostra a mensagem de fila vazia', () => {
  const pagina = carregarPagina('painel');
  pagina.definirAtendimentos([atendimento('AT0030', 'confirmado', 'verde', 0)]);
  pagina.executar('renderPainel()');
  assert.equal(pagina.elemento('painel-fila').children.length, 0);
  assert.equal(pagina.elemento('painel-empty').style.display, 'block', 'a mensagem de fila vazia deveria aparecer');
  pagina.definirAtendimentos([atendimento('AT0031', 'aguardando-medico', 'verde', 0)]);
  pagina.executar('renderPainel()');
  assert.equal(pagina.elemento('painel-empty').style.display, 'none', 'com paciente na fila a mensagem some');
});

// ---------- Atendimentos sem triagem (dado antigo ou gravado fora do fluxo) ----------

const SEM_TRIAGEM = [
  atendimento('AT0040', 'aguardando-medico', null, 0),
  atendimento('AT0041', 'em-atendimento', null, 1),
  atendimento('AT0042', 'confirmado', null, 2, { medico: { medicacoes: 'Nenhuma' } }),
  atendimento('AT0043', 'confirmado', null, 3, { medico: null }),
  atendimento('AT0044', 'aguardando-medico', 'amarelo', 4)
];

test('painel: atendimentos sem triagem são ignorados em vez de quebrar a tela', () => {
  let itens;
  assert.doesNotThrow(() => { itens = renderizarPainel(SEM_TRIAGEM); }, 'o painel quebrou com atendimento sem triagem');
  assert.deepEqual(itens.map((i) => i.codigo), ['AT0044'], 'só o atendimento triado deveria aparecer');
  const pagina = carregarPagina('painel');
  pagina.definirAtendimentos(SEM_TRIAGEM.slice(0, 2));
  pagina.executar('renderPainel()');
  assert.equal(pagina.elemento('painel-empty').style.display, 'block', 'sem ninguém triado, a fila aparece vazia');
});

test('médico: fila e confirmados ignoram atendimentos sem triagem em vez de quebrar', () => {
  const pagina = carregarPagina('medico');
  pagina.definirAtendimentos(SEM_TRIAGEM);
  assert.doesNotThrow(() => pagina.executar('renderMedico()'), 'a fila do médico quebrou com atendimento sem triagem');
  const opcoes = pagina.elemento('medico-select-atendimento').children.map((o) => o.value);
  assert.deepEqual(opcoes, ['AT0044'], 'só o atendimento triado deveria aparecer na fila do médico');
  assert.doesNotThrow(() => pagina.executar('renderConfirmados()'), 'a lista de confirmados quebrou com atendimento sem triagem');
  assert.equal(pagina.elemento('tabela-confirmados').children.length, 0, 'confirmados sem triagem ficam fora da lista');
});

test('triagem e recepção: atendimentos sem triagem não quebram as listas', () => {
  const triagem = carregarPagina('triagem');
  triagem.definirAtendimentos(SEM_TRIAGEM);
  assert.doesNotThrow(() => triagem.executar('renderTriagem()'), 'a tela de triagem quebrou');
  assert.equal(triagem.elemento('tabela-triagem-feitas').children.length, 1, 'triagens feitas: só o atendimento triado');
  const recepcao = carregarPagina('recepcao');
  recepcao.definirAtendimentos(SEM_TRIAGEM);
  assert.doesNotThrow(() => recepcao.executar('renderRecepcao()'), 'a lista da recepção quebrou');
  for (const { id } of SEM_TRIAGEM) {
    assert.doesNotThrow(() => recepcao.executar(`verAtendimento(${JSON.stringify(id)})`), `os detalhes de ${id} quebraram`);
  }
});
