// H) Inicialização e saúde: /health com o banco ligado e desligado, porta ocupada e banco
// inacessível ao iniciar o servidor (mensagens em português, sem "fingir" que subiu).
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import pg from 'pg';
import { createApp } from '../../services/routes.js';
import { PostgresRepository } from '../../services/repository.js';
import { SEM_BANCO, ambienteDoTeste, criarEsquema } from '../helpers/ambiente.js';
import { envDoBanco, executar, ocuparPorta, portaLivre } from '../helpers/processo.js';

const opcoes = { skip: SEM_BANCO };
const proposta = (texto) => ({ todo: `PROPOSTA: ${texto}` });

// API ligada a um PostgreSQL que não existe (nada escutando na porta).
async function apiSemBanco(t) {
  const pool = new pg.Pool({
    host: '127.0.0.1', port: await portaLivre(), user: 'postgres', password: 'x', database: 'x', connectionTimeoutMillis: 2000
  });
  pool.on('error', () => {});
  const server = createApp(new PostgresRepository(pool)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  });
  // O erro é registrado no console do servidor; aqui ele é silenciado e conferido.
  const registros = [];
  t.mock.method(console, 'error', (...args) => { registros.push(args.map(String).join(' ')); });
  return { base: `http://127.0.0.1:${server.address().port}`, registros };
}

test('/health responde 200 com o banco conectado', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t, { dados: false });
  const resposta = await fetch(`${amb.base}/health`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), { status: 'ok', banco: 'conectado' });
});

test('/health com o banco desligado devolve erro tratado em JSON, sem detalhes técnicos', async (t) => {
  const { base, registros } = await apiSemBanco(t);
  const resposta = await fetch(`${base}/health`);
  assert.ok(resposta.status >= 500, `esperado erro 5xx, recebido ${resposta.status}`);
  assert.match(resposta.headers.get('content-type'), /^application\/json/);
  const corpo = await resposta.json();
  assert.equal(corpo.erro, 'Falha ao acessar os dados do sistema');
  assert.ok(!/ECONNREFUSED|127\.0\.0\.1|stack/i.test(JSON.stringify(corpo)), 'a resposta não pode expor detalhes da conexão');
  assert.ok(registros.length > 0, 'o erro deveria ser registrado no console do servidor');
});

test('/health com o banco desligado deveria responder 503 (serviço indisponível)', proposta(
  'hoje responde 500; 503 indica melhor a monitores que o problema é a dependência (banco), não um defeito da API'
), async (t) => {
  const { base } = await apiSemBanco(t);
  assert.equal((await fetch(`${base}/health`)).status, 503);
});

test('servidor com a porta ocupada: mensagem em português e encerra com erro', { ...opcoes, timeout: 30_000 }, async (t) => {
  const esquema = await criarEsquema({ dados: false });
  t.after(() => esquema.remover());
  const ocupada = await ocuparPorta();
  t.after(() => ocupada.liberar());
  const saida = await executar('services/server.js', envDoBanco({
    schema: esquema.schema, extra: { PORT: String(ocupada.porta), HOST: '127.0.0.1' }
  }));
  assert.equal(saida.codigo, 1, `o servidor deveria encerrar com código 1, terminou com ${saida.codigo}`);
  assert.match(saida.stderr, new RegExp(`a porta ${ocupada.porta} já está em uso`), `mensagem esperada ausente. stderr: ${saida.stderr}`);
  assert.match(saida.stderr, /PORT=3001/, 'a mensagem deveria dizer como resolver');
  assert.doesNotMatch(saida.stdout, /disponíveis em/, 'o servidor não pode anunciar que subiu');
});

test('servidor com o PostgreSQL desligado: mensagem em português e não abre a porta', { ...opcoes, timeout: 30_000 }, async () => {
  const porta = await portaLivre();
  const saida = await executar('services/server.js', envDoBanco({
    porta: await portaLivre(), extra: { PORT: String(porta), HOST: '127.0.0.1' }
  }));
  assert.equal(saida.codigo, 1, `o servidor deveria encerrar com código 1, terminou com ${saida.codigo}`);
  assert.match(saida.stderr, /não conseguiu usar o banco de dados/, `stderr: ${saida.stderr}`);
  assert.match(saida.stderr, /Não foi possível conectar ao PostgreSQL/, `stderr: ${saida.stderr}`);
  assert.doesNotMatch(saida.stderr, /\n\s+at /, 'não deveria mostrar stack trace');
  assert.doesNotMatch(saida.stdout, /disponíveis em/, 'o servidor não pode anunciar que subiu');
});

test('servidor com o banco sem tabelas: orienta a rodar npm run setup', { ...opcoes, timeout: 30_000 }, async (t) => {
  const esquema = await criarEsquema({ tabelas: false });
  t.after(() => esquema.remover());
  const saida = await executar('services/server.js', envDoBanco({
    schema: esquema.schema, extra: { PORT: String(await portaLivre()), HOST: '127.0.0.1' }
  }));
  assert.equal(saida.codigo, 1, `o servidor deveria encerrar com código 1, terminou com ${saida.codigo}`);
  assert.match(saida.stderr, /tabelas do sistema não existem/, `stderr: ${saida.stderr}`);
  assert.match(saida.stderr, /npm run setup/);
});

test('servidor com tudo certo anuncia o endereço e responde /health', { ...opcoes, timeout: 30_000 }, async (t) => {
  const esquema = await criarEsquema({ dados: false });
  t.after(() => esquema.remover());
  const porta = await portaLivre();
  let saude;
  const saida = await executar('services/server.js', envDoBanco({
    schema: esquema.schema, extra: { PORT: String(porta), HOST: '127.0.0.1' }
  }), {
    ate: async ({ stdout }) => {
      if (saude || !stdout.includes('disponíveis em')) return false;
      saude = 'pendente';
      const resposta = await fetch(`http://127.0.0.1:${porta}/health`);
      saude = { status: resposta.status, corpo: await resposta.json() };
      return true;
    }
  });
  assert.ok(saida.encerradoPorNos, `o servidor terminou sozinho (código ${saida.codigo}). stderr: ${saida.stderr}`);
  assert.match(saida.stdout, new RegExp(`API e web disponíveis em http://127\\.0\\.0\\.1:${porta}`));
  assert.deepEqual(saude, { status: 200, corpo: { status: 'ok', banco: 'conectado' } });
});
