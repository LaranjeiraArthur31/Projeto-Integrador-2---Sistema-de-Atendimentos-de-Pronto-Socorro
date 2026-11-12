// Executa scripts do projeto (setup.js, server.js) em processo separado, com todas as
// variáveis DB_* definidas: o dotenv não sobrescreve variáveis já existentes, então o
// .env do desenvolvedor nunca é usado nestes testes.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { configTeste } from './ambiente.js';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

export function envDoBanco({ schema, porta, extra = {} } = {}) {
  const config = configTeste();
  const env = { ...process.env };
  for (const chave of Object.keys(env)) if (/^(DB_|PG)/.test(chave)) delete env[chave];
  return {
    ...env,
    DB_HOST: config.host,
    DB_PORT: String(porta ?? config.port),
    DB_USER: config.user,
    DB_PASSWORD: config.password,
    DB_NAME: config.database,
    ...(schema ? { PGOPTIONS: `-c search_path=${schema}` } : {}),
    ...extra
  };
}

// Roda o script até terminar (ou até `ate(saida)` ser verdadeiro, quando então o processo é encerrado).
export function executar(script, env, { timeout = 20_000, ate } = {}) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [script], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let encerradoPorNos = false;
    const relogio = setTimeout(() => {
      filho.kill();
      reject(new Error(`${script} não terminou em ${timeout / 1000}s.\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, timeout);
    const conferir = async () => {
      if (ate && !encerradoPorNos && await ate({ stdout, stderr })) {
        encerradoPorNos = true;
        filho.kill();
      }
    };
    filho.stdout.setEncoding('utf8').on('data', (parte) => { stdout += parte; conferir(); });
    filho.stderr.setEncoding('utf8').on('data', (parte) => { stderr += parte; conferir(); });
    filho.on('error', reject);
    filho.on('close', (codigo) => {
      clearTimeout(relogio);
      resolve({ codigo, stdout, stderr, encerradoPorNos });
    });
  });
}

// Ocupa uma porta livre e devolve { porta, liberar }.
export async function ocuparPorta() {
  const servidor = net.createServer();
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  return { porta: servidor.address().port, liberar: () => new Promise((resolve) => servidor.close(resolve)) };
}

// Porta que estava livre agora há pouco (nada escutando nela).
export async function portaLivre() {
  const { porta, liberar } = await ocuparPorta();
  await liberar();
  return porta;
}
