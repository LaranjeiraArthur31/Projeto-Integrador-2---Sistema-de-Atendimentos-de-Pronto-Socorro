// Carrega os scripts das páginas (comum.js + script da página) num contexto vm,
// com um document/window mínimos. Sem dependências externas.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export const WEB = new URL('../../web/', import.meta.url);

export function lerWeb(caminho) {
  return readFileSync(new URL(caminho, WEB), 'utf8');
}

// Conteúdo dos <script> sem src de um HTML.
export function scriptsInline(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

class Elemento {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.value = '';
    this.className = '';
    this.disabled = false;
    this.style = {};
    this.dataset = {};
    this.eventos = {};
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  appendChild(filho) { this.children.push(filho); return filho; }
  append(...filhos) { this.children.push(...filhos); }
  replaceChildren(...filhos) { this.children = filhos; }
  addEventListener(tipo, fn) { (this.eventos[tipo] ??= []).push(fn); }
  removeEventListener() {}
  remove() {}
  focus() {}
  reset() {}
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

// Date com "agora" fixo, para calcularIdade ser determinística.
function dataFixa(iso) {
  const fixo = new Date(iso).getTime();
  return class extends Date {
    constructor(...args) { super(...(args.length ? args : [fixo])); }
    static now() { return fixo; }
  };
}

// pagina: 'recepcao' | 'triagem' | 'painel' | 'medico' | null (só comum.js).
export function carregarPagina(pagina, { agora } = {}) {
  const elementos = new Map();
  const elemento = (id) => {
    if (!elementos.has(id)) elementos.set(id, new Elemento('div', id));
    return elementos.get(id);
  };
  const document = {
    getElementById: elemento,
    querySelector: (seletor) => elemento(`seletor:${seletor}`),
    querySelectorAll: () => [],
    createElement: (tag) => new Elemento(tag),
    addEventListener() {},
    removeEventListener() {},
    body: new Elemento('body'),
    activeElement: null
  };
  const ctx = {
    document,
    console,
    URL,
    fetch: () => new Promise(() => {}), // a sessão fica pendente: nada é enviado
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    location: { origin: 'http://teste.local', replace() {} },
    addEventListener() {},
    scrollTo() {}
  };
  if (agora) ctx.Date = dataFixa(agora);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(lerWeb('comum/comum.js'), ctx, { filename: 'web/comum/comum.js' });
  if (pagina) {
    scriptsInline(lerWeb(`${pagina}/${pagina}.html`)).forEach((codigo, i) => {
      vm.runInContext(codigo, ctx, { filename: `web/${pagina}/${pagina}.html (script ${i + 1})` });
    });
  }
  return {
    ctx,
    elemento,
    executar: (codigo) => vm.runInContext(codigo, ctx),
    definirAtendimentos(lista) {
      ctx.__dados = structuredClone(lista);
      vm.runInContext('atendimentos = __dados; delete window.__dados;', ctx);
    }
  };
}

// Renderiza o painel com a lista dada e devolve os itens na ordem exibida.
export function renderizarPainel(lista) {
  const pagina = carregarPagina('painel');
  pagina.definirAtendimentos(lista);
  pagina.executar('renderPainel()');
  return pagina.elemento('painel-fila').children.map((item) => ({
    codigo: item.innerHTML.match(/class="pi-num">([^<]*)</)?.[1],
    classe: item.className,
    html: item.innerHTML
  }));
}
