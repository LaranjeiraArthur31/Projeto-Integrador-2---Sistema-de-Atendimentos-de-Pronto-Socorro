// Ambiente dos testes de integração.
// Cada teste cria um esquema próprio dentro do banco api_schema_test (nunca o banco de
// desenvolvimento), sobe a API numa porta livre e apaga o esquema no final.
// Variáveis: API_TEST_DB_PORT (obrigatória), API_TEST_DB_USER, API_TEST_DB_PASSWORD.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../../services/routes.js';
import { PostgresRepository } from '../../services/repository.js';

// Igual ao servidor: datas (DATE) chegam como texto "AAAA-MM-DD".
pg.types.setTypeParser(1082, (value) => value);

export const BANCO_TESTE = 'api_schema_test';
export const SEM_BANCO = process.env.API_TEST_DB_PORT
  ? false
  : 'defina API_TEST_DB_PORT (e API_TEST_DB_USER / API_TEST_DB_PASSWORD) para rodar os testes de integração no banco api_schema_test';

export const USUARIOS = {
  Recepcionista: { email: 'recepcao@hospital.com', id: 1 },
  Enfermeiro: { email: 'enfermagem@hospital.com', id: 2 },
  Medico: { email: 'medico@hospital.com', id: 3 }
};
export const SENHA_DEMO = '123456';

export function configTeste(database = BANCO_TESTE) {
  return {
    host: '127.0.0.1',
    port: Number(process.env.API_TEST_DB_PORT),
    user: process.env.API_TEST_DB_USER || 'postgres',
    password: process.env.API_TEST_DB_PASSWORD || '',
    database,
    connectionTimeoutMillis: 5000
  };
}

let bancoPronto;
// Cria o banco api_schema_test (UTF8) se ainda não existir.
export function garantirBancoTeste() {
  bancoPronto ??= (async () => {
    const cliente = new pg.Client(configTeste('postgres'));
    await cliente.connect();
    try {
      const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [BANCO_TESTE]);
      if (!rowCount) {
        await cliente.query(`CREATE DATABASE ${BANCO_TESTE} WITH ENCODING 'UTF8' TEMPLATE template0`)
          .catch((error) => { if (!['42P04', '23505'].includes(error.code)) throw error; });
      }
    } finally {
      await cliente.end();
    }
  })();
  return bancoPronto;
}

const arquivosSql = new Map();
export async function lerSql(nome) {
  if (!arquivosSql.has(nome)) {
    arquivosSql.set(nome, await readFile(new URL(`../../database/${nome}`, import.meta.url), 'utf8'));
  }
  return arquivosSql.get(nome);
}

// Cria um esquema temporário com as tabelas e, se pedido, os dados de demonstração.
// { tabelas: false } cria o esquema vazio.
export async function criarEsquema({ tabelas = true, dados = tabelas } = {}) {
  await garantirBancoTeste();
  const schema = `teste_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client(configTeste());
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({
    ...configTeste(), max: 12, idleTimeoutMillis: 1000, options: `-c search_path=${schema}`
  });
  pool.on('error', () => {});
  try {
    if (tabelas) await pool.query(await lerSql('schema.sql'));
    if (dados) await pool.query(await lerSql('insert.sql'));
  } catch (error) {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    throw error;
  }
  return {
    schema,
    pool,
    query: (texto, valores) => pool.query(texto, valores),
    async remover() {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  };
}

// Esquema + API rodando. Use `ambienteDoTeste(t)` para a limpeza automática.
export async function criarAmbiente(opcoes = {}) {
  return subirApi(await criarEsquema(opcoes));
}

// Sobe a API sobre um esquema já existente (o fechar() também apaga o esquema).
export async function subirApi(esquema) {
  const app = createApp(new PostgresRepository(esquema.pool));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const entrar = async (email, senha = SENHA_DEMO) => {
    const cliente = new Cliente(base);
    await cliente.login(email, senha);
    return cliente;
  };
  return {
    ...esquema,
    base,
    cliente: () => new Cliente(base),
    entrar,
    recepcao: () => entrar(USUARIOS.Recepcionista.email),
    enfermagem: () => entrar(USUARIOS.Enfermeiro.email),
    medico: () => entrar(USUARIOS.Medico.email),
    async fechar() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await esquema.remover();
    }
  };
}

export async function ambienteDoTeste(t, opcoes) {
  const ambiente = await criarAmbiente(opcoes);
  t.after(() => ambiente.fechar());
  return ambiente;
}

function temCampoSenha(valor) {
  if (Array.isArray(valor)) return valor.some(temCampoSenha);
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).some(([chave, item]) => chave === 'senha' || temCampoSenha(item));
  }
  return false;
}

// Cliente HTTP com cookie de sessão. Toda resposta é conferida: nunca pode trazer senha.
export class Cliente {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async req(metodo, caminho, { json, corpo, cabecalhos = {} } = {}) {
    const headers = { ...cabecalhos };
    if (this.cookie && !Object.hasOwn(headers, 'Cookie')) headers.Cookie = this.cookie;
    let body = corpo;
    if (json !== undefined) {
      body = JSON.stringify(json);
      headers['Content-Type'] ??= 'application/json';
    }
    const resposta = await fetch(`${this.base}${caminho}`, { method: metodo, headers, body, redirect: 'manual' });
    const texto = await resposta.text();
    let conteudo;
    try { conteudo = texto ? JSON.parse(texto) : null; } catch { conteudo = undefined; }
    assert.ok(!texto.includes('scrypt$'), `A resposta de ${metodo} ${caminho} expôs um hash de senha`);
    assert.ok(!temCampoSenha(conteudo), `A resposta de ${metodo} ${caminho} contém o campo "senha"`);
    const setCookie = resposta.headers.get('set-cookie');
    if (setCookie?.startsWith('ps_session=')) this.cookie = setCookie.split(';')[0];
    return {
      status: resposta.status,
      headers: resposta.headers,
      texto,
      conteudo,
      dados: conteudo?.dados,
      erro: conteudo?.erro,
      descricao: `${metodo} ${caminho}`
    };
  }

  get(caminho, opcoes) { return this.req('GET', caminho, opcoes); }
  post(caminho, json, opcoes = {}) { return this.req('POST', caminho, { ...opcoes, json }); }
  put(caminho, json, opcoes = {}) { return this.req('PUT', caminho, { ...opcoes, json }); }
  delete(caminho, opcoes) { return this.req('DELETE', caminho, opcoes); }

  async login(email, senha = SENHA_DEMO) {
    const resposta = await this.post('/auth/login', { email, senha });
    esperarStatus(resposta, 200, `login de ${email}`);
    return resposta;
  }
}

export function esperarStatus(resposta, esperado, contexto = resposta.descricao) {
  const aceitos = [].concat(esperado);
  assert.ok(
    aceitos.includes(resposta.status),
    `${contexto}: esperado HTTP ${aceitos.join(' ou ')}, recebido ${resposta.status}. Resposta: ${resposta.texto.slice(0, 300)}`
  );
  return resposta;
}

// ---------- Dados de teste ----------

export function cpfAleatorio() {
  const d = Array.from({ length: 11 }, () => randomInt(10)).join('');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function emailAleatorio() {
  return `teste.${randomUUID().slice(0, 8)}@exemplo.test`;
}

export function dadosPaciente(extra = {}) {
  return {
    nome: 'Paciente de Teste', cpf: cpfAleatorio(), rg: '12.345.678-9', mae: 'Mãe de Teste',
    pai: 'Pai de Teste', nascimento: '1990-05-10', sexo: 'F', telefone: '(19) 99999-0000',
    endereco: 'Rua de Teste, 10', ...extra
  };
}

// Formato da tabela paciente (rota genérica /pacientes).
export function pacienteDireto(extra = {}) {
  return {
    nome_completo: 'Paciente Direto', cpf: cpfAleatorio(), rg: '1234567', nome_mae: 'Mãe Direta',
    data_nascimento: '1980-01-01', sexo: 'M', ...extra
  };
}

export function dadosTriagem(extra = {}) {
  return { pa: '120/80 mmHg', temp: '36,5', bpm: 80, queixas: 'Dor de cabeça', classificacao: 'verde', ...extra };
}

export function dadosMedico(extra = {}) {
  return { medicacoes: 'Dipirona 1 g VO', diagnostico: 'Cefaleia tensional', observacoes: 'Retornar se piorar', ...extra };
}

export async function criarAtendimento(recepcao, extra) {
  const resposta = await recepcao.post('/atendimentos', dadosPaciente(extra));
  esperarStatus(resposta, 201, 'criação de atendimento pela recepção');
  return resposta.dados;
}

export async function triar(enfermagem, codigo, triagem) {
  const resposta = await enfermagem.put(`/atendimentos/${codigo}`, {
    status: 'aguardando-medico', triagem: dadosTriagem(triagem)
  });
  esperarStatus(resposta, 200, `triagem de ${codigo}`);
  return resposta.dados;
}

export async function atender(medico, codigo, status = 'confirmado', dados) {
  const resposta = await medico.put(`/atendimentos/${codigo}`, { status, medico: dadosMedico(dados) });
  esperarStatus(resposta, 200, `atendimento médico de ${codigo} (${status})`);
  return resposta.dados;
}

export async function statusNoBanco(ambiente, codigo) {
  const { rows } = await ambiente.query('SELECT status FROM atendimento WHERE numero_atendimento = $1', [codigo]);
  return rows[0]?.status;
}

export async function contar(ambiente, tabela) {
  const { rows } = await ambiente.query(`SELECT COUNT(*)::int AS n FROM ${tabela}`);
  return rows[0].n;
}
