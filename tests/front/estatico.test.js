// Verificações estáticas do front (sem navegador): emoji, alert/confirm/prompt, escapeHtml
// em todo HTML montado por template, links locais existentes e ids usados no script.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WEB, lerWeb, scriptsInline } from '../helpers/navegador.js';

const PASTA_WEB = fileURLToPath(WEB);
const ARQUIVOS = readdirSync(PASTA_WEB, { recursive: true })
  .map((arquivo) => arquivo.split(path.sep).join('/'))
  .filter((arquivo) => /\.(html|css|js)$/.test(arquivo));
const HTML = ARQUIVOS.filter((arquivo) => arquivo.endsWith('.html'));
const PAGINAS_COM_SCRIPT = ['recepcao/recepcao.html', 'triagem/triagem.html', 'medico/medico.html', 'painel/painel.html'];

// Todo o JavaScript do front: arquivos .js e scripts inline dos HTML.
function codigosJs() {
  const lista = ARQUIVOS.filter((a) => a.endsWith('.js')).map((arquivo) => ({ arquivo, codigo: lerWeb(arquivo), linhaInicial: 0 }));
  for (const arquivo of HTML) {
    const html = lerWeb(arquivo);
    scriptsInline(html).forEach((codigo) => {
      lista.push({ arquivo, codigo, linhaInicial: linhaDe(html, html.indexOf(codigo)) - 1 });
    });
  }
  return lista;
}

const linhaDe = (codigo, indice) => codigo.slice(0, indice).split('\n').length;

// ---------- Leitor mínimo de JavaScript: encontra os template literals ----------

const ANTES_DE_REGEX = new Set([...'(,=:[!&|?{};+-*%<>~^'], '');

function pularString(src, i) {
  const aspas = src[i];
  for (i += 1; i < src.length; i += 1) {
    if (src[i] === '\\') i += 1;
    else if (src[i] === aspas) return i + 1;
  }
  return i;
}

function pularRegex(src, i) {
  let classe = false;
  for (i += 1; i < src.length; i += 1) {
    const c = src[i];
    if (c === '\\') i += 1;
    else if (c === '[') classe = true;
    else if (c === ']') classe = false;
    else if (c === '/' && !classe) break;
  }
  for (i += 1; /[a-z]/i.test(src[i] ?? ''); i += 1);
  return i;
}

// Percorre código a partir de i até o fechamento `fim` (ex.: "}") no nível zero.
// Cada template encontrado é guardado em `achados`.
function varrer(src, i, fim, achados) {
  let profundidade = 0;
  let anterior = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return src.length; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === '"' || c === "'") { i = pularString(src, i); anterior = 'x'; continue; }
    if (c === '/' && ANTES_DE_REGEX.has(anterior)) { i = pularRegex(src, i); anterior = 'x'; continue; }
    if (c === '`') { i = lerTemplate(src, i, achados).fim; anterior = 'x'; continue; }
    if ('([{'.includes(c)) profundidade += 1;
    if (')]}'.includes(c)) {
      if (profundidade === 0 && c === fim) return i;
      profundidade -= 1;
    }
    if (!/\s/.test(c)) anterior = /[\w$]/.test(c) ? 'x' : c;
    i += 1;
  }
  return i;
}

function lerTemplate(src, inicio, achados) {
  const template = { inicio, texto: '', expressoes: [] };
  achados.push(template);
  let i = inicio + 1;
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') { template.texto += src.slice(i, i + 2); i += 2; continue; }
    if (src[i] === '$' && src[i + 1] === '{') {
      const fimExpr = varrer(src, i + 2, '}', achados);
      template.expressoes.push(src.slice(i + 2, fimExpr));
      i = fimExpr + 1;
      continue;
    }
    template.texto += src[i];
    i += 1;
  }
  template.fim = i + 1;
  template.codigo = src.slice(inicio, template.fim);
  return template;
}

export function templatesDe(src) {
  const achados = [];
  varrer(src, 0, null, achados);
  return achados;
}

// Posições de nível zero (fora de parênteses, strings e templates).
function nivelZero(expr) {
  const posicoes = [];
  let profundidade = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '"' || c === "'") { i = pularString(expr, i) - 1; continue; }
    if (c === '`') { i = lerTemplate(expr, i, []).fim - 1; continue; }
    if ('([{'.includes(c)) profundidade += 1;
    else if (')]}'.includes(c)) profundidade -= 1;
    else if (profundidade === 0) posicoes.push(i);
  }
  return posicoes;
}

function dividirTernario(expr) {
  const zero = nivelZero(expr);
  const interrogacao = zero.find((i) => expr[i] === '?' && expr[i + 1] !== '.' && expr[i + 1] !== '?' && expr[i - 1] !== '?');
  if (interrogacao === undefined) return null;
  let aninhados = 0;
  for (const i of zero.filter((p) => p > interrogacao)) {
    if (expr[i] === '?' && expr[i + 1] !== '.' && expr[i + 1] !== '?') aninhados += 1;
    if (expr[i] === ':') {
      if (aninhados === 0) return [expr.slice(interrogacao + 1, i), expr.slice(i + 1)];
      aninhados -= 1;
    }
  }
  return null;
}

// Expressões que podem ir para o HTML sem escapeHtml: já escapadas, literais, ou
// valores montados só com partes seguras. `idx+1` é número; `conteudo` já vem escapado
// por linhaDetalhe (recepcao.html).
const PERMITIDAS = new Set(['idx+1', 'conteudo']);

export function expressaoSegura(bruta) {
  let expr = bruta.trim();
  while (expr.startsWith('(') && nivelZero(expr).length === 0 && expr.endsWith(')')) expr = expr.slice(1, -1).trim();
  if (PERMITIDAS.has(expr.replace(/\s+/g, ''))) return true;
  if (/^(['"])(?:\\.|(?!\1).)*\1$/s.test(expr)) return true;
  if (/^escapeHtml\s*\(/.test(expr) && nivelZero(expr).every((i) => i < expr.indexOf('('))) return true;
  if (expr.startsWith('`') && lerTemplate(expr, 0, []).fim === expr.length) {
    return lerTemplate(expr, 0, []).expressoes.every(expressaoSegura);
  }
  const ternario = dividirTernario(expr);
  if (ternario) return ternario.every(expressaoSegura);
  return false;
}

// ---------- Testes ----------

test('nenhum arquivo do front tem emoji', () => {
  const problemas = [];
  for (const arquivo of ARQUIVOS) {
    lerWeb(arquivo).split('\n').forEach((linha, i) => {
      const emoji = linha.match(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u);
      if (emoji) problemas.push(`web/${arquivo}:${i + 1} contém "${emoji[0]}"`);
    });
  }
  assert.deepEqual(problemas, [], `Emoji encontrado:\n${problemas.join('\n')}`);
});

test('o front não usa alert, confirm nem prompt', () => {
  const problemas = [];
  for (const arquivo of ARQUIVOS.filter((a) => /\.(html|js)$/.test(a))) {
    const texto = lerWeb(arquivo);
    for (const m of texto.matchAll(/(?<![\w$]|[\w$]\.)(?:window\.)?\b(alert|confirm|prompt)\s*\(/g)) {
      problemas.push(`web/${arquivo}:${linhaDe(texto, m.index)} usa ${m[1]}()`);
    }
  }
  assert.deepEqual(problemas, [], `Diálogos nativos encontrados (use toast/confirmarModal):\n${problemas.join('\n')}`);
});

test('o leitor de templates reconhece expressões seguras e inseguras', () => {
  assert.ok(expressaoSegura('escapeHtml(a.nome)'));
  assert.ok(expressaoSegura(" a.x ? escapeHtml(a.x) : '-' "));
  assert.ok(expressaoSegura('ok ? `<b>${escapeHtml(v)}</b>` : ""'));
  assert.ok(expressaoSegura('idx + 1'));
  assert.ok(!expressaoSegura('a.nome'));
  assert.ok(!expressaoSegura('escapeHtml(a) + b'));
  assert.ok(!expressaoSegura('ok ? escapeHtml(a) : a.b'));
  assert.ok(!expressaoSegura('ok ? `<b>${v}</b>` : ""'));
  const [t] = templatesDe('const re = /[`"\']/g; el.innerHTML = `<p>${x}</p>`;');
  assert.deepEqual(t.expressoes, ['x'], 'o leitor deveria ignorar crases dentro de regex');
});

test('todo valor interpolado em HTML passa por escapeHtml', () => {
  const problemas = [];
  for (const { arquivo, codigo, linhaInicial } of codigosJs()) {
    for (const template of templatesDe(codigo)) {
      if (!/<[a-z!/]/i.test(template.texto)) continue; // template sem tag HTML
      for (const expr of template.expressoes) {
        if (!expressaoSegura(expr)) {
          problemas.push(`web/${arquivo}:${linhaInicial + linhaDe(codigo, template.inicio)}  \${${expr.trim()}}`);
        }
      }
    }
    for (const m of codigo.matchAll(/\.(?:innerHTML|outerHTML)\s*\+?=\s*([A-Za-z_$][\w$.]*)\s*;/g)) {
      if (m[1] !== 'html') problemas.push(`web/${arquivo}:${linhaInicial + linhaDe(codigo, m.index)}  innerHTML = ${m[1]} (variável não conferida)`);
    }
  }
  assert.deepEqual(problemas, [], `Interpolações em HTML sem escapeHtml:\n${problemas.join('\n')}`);
});

test('links, scripts, folhas de estilo e imports locais apontam para arquivos existentes', () => {
  const problemas = [];
  const conferir = (arquivo, referencia) => {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(referencia) || referencia === '') return;
    const caminho = decodeURIComponent(new URL(referencia, `http://local/${arquivo}`).pathname);
    const destino = caminho.endsWith('/') ? null : path.join(PASTA_WEB, caminho);
    if (!destino || !existsSync(destino)) problemas.push(`web/${arquivo}: "${referencia}" não existe (${caminho})`);
  };
  for (const arquivo of HTML) {
    for (const m of lerWeb(arquivo).matchAll(/\s(?:href|src)\s*=\s*["']([^"']*)["']/g)) conferir(arquivo, m[1]);
  }
  for (const arquivo of ARQUIVOS.filter((a) => a.endsWith('.css'))) {
    for (const m of lerWeb(arquivo).matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/g)) conferir(arquivo, m[1]);
    for (const m of lerWeb(arquivo).matchAll(/url\(\s*["']?(?!data:)([^"')]+)["']?\s*\)/g)) conferir(arquivo, m[1]);
  }
  for (const { arquivo, codigo } of codigosJs()) {
    for (const m of codigo.matchAll(/["'`](\/[\w./-]+\.(?:html|css|js))["'`]/g)) conferir(arquivo, m[1]);
  }
  assert.deepEqual(problemas, [], `Referências quebradas:\n${problemas.join('\n')}`);
});

test('todo id usado pelo script existe na página', () => {
  const problemas = [];
  const idsDe = (html) => new Set([...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
  const repetidos = (html) => {
    const todos = [...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
    return todos.filter((id, i) => todos.indexOf(id) !== i);
  };

  for (const arquivo of PAGINAS_COM_SCRIPT) {
    const html = lerWeb(arquivo);
    const ids = idsDe(html);
    const codigo = scriptsInline(html).join('\n');
    const usados = new Set([
      ...[...codigo.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
      ...[...codigo.matchAll(/carregarProfissionais\([^,]+,\s*['"]([^'"]+)['"]\)/g)].map((m) => m[1])
    ]);
    if (/confirmarModal\(/.test(codigo)) {
      for (const id of ['modal-bg', 'modal-title', 'modal-text', 'modal-cancel', 'modal-confirm']) usados.add(id);
    }
    for (const id of usados) if (!ids.has(id)) problemas.push(`web/${arquivo}: id "${id}" usado no script não existe na página`);
    for (const id of ['toast', 'relogio']) if (!ids.has(id)) problemas.push(`web/${arquivo}: falta o elemento #${id} usado por comum.js`);
    for (const id of repetidos(html)) problemas.push(`web/${arquivo}: id "${id}" repetido`);
  }

  // auth.js: precisa de um <form>, do #mensagem e dos campos enviados.
  const camposPorPagina = {
    'auth/login.html': ['email', 'senha'],
    'auth/cadastro.html': ['nome_completo', 'cpf', 'cargo', 'email', 'senha', 'confirmacao']
  };
  for (const [arquivo, campos] of Object.entries(camposPorPagina)) {
    const html = lerWeb(arquivo);
    if (!/<form\b/.test(html)) problemas.push(`web/${arquivo}: falta o <form> usado por auth.js`);
    if (!idsDe(html).has('mensagem')) problemas.push(`web/${arquivo}: falta o #mensagem usado por auth.js`);
    for (const campo of campos) {
      if (!new RegExp(`name\\s*=\\s*["']${campo}["']`).test(html)) problemas.push(`web/${arquivo}: falta o campo name="${campo}"`);
    }
    for (const id of repetidos(html)) problemas.push(`web/${arquivo}: id "${id}" repetido`);
  }
  assert.ok(/<form[^>]*id\s*=\s*["']cadastro-form["']/.test(lerWeb('auth/cadastro.html')),
    'o formulário de cadastro precisa do id "cadastro-form" (auth.js usa para saber que é cadastro)');
  assert.ok(!/id\s*=\s*["']cadastro-form["']/.test(lerWeb('auth/login.html')), 'o login não pode usar o id "cadastro-form"');
  assert.deepEqual(problemas, [], problemas.join('\n'));
});
