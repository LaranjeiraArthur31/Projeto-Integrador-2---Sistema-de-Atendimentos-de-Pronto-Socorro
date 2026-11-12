import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { createApp } from './routes.js';
import { PostgresRepository } from './repository.js';
import { lerConfigBanco, explicarErroBanco, verificarBanco } from './db-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
pg.types.setTypeParser(1082, (value) => value);

const dbConfig = lerConfigBanco();
export const db = new pg.Pool({
  ...dbConfig,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});
db.on('error', (error) => {
  console.error('Erro inesperado no pool PostgreSQL:', error.message);
});

const repository = new PostgresRepository(db);
const app = createApp(repository);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

async function iniciar() {
  // Verifica o banco antes de abrir a porta, com mensagem curta em vez de stack trace.
  try {
    await verificarBanco(db);
  } catch (error) {
    console.error('ERRO: o sistema não conseguiu usar o banco de dados.');
    console.error(explicarErroBanco(error, dbConfig));
    await db.end().catch(() => {});
    process.exit(1);
  }

  // No Express 5 o callback do listen recebe o erro (ex.: porta ocupada).
  app.listen(PORT, HOST, (error) => {
    if (error) {
      if (error.code === 'EADDRINUSE') {
        console.error(`ERRO: a porta ${PORT} já está em uso por outro programa.`);
        console.error('Altere PORT no arquivo .env (por exemplo, PORT=3001) e rode "npm start" de novo.');
      } else if (error.code === 'EACCES') {
        console.error(`ERRO: sem permissão para usar a porta ${PORT}. Altere PORT no arquivo .env (use um valor acima de 1024).`);
      } else {
        console.error(`ERRO ao iniciar o servidor em ${HOST}:${PORT}: ${error.message}`);
      }
      process.exit(1);
    }
    console.log(`Banco "${dbConfig.database}" conectado em ${dbConfig.host}:${dbConfig.port}.`);
    console.log(`API e web disponíveis em http://${HOST}:${PORT}`);
  });
}

if (isMainModule) iniciar();

export { app, createApp };
export default app;
