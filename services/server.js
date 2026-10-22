import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { createApp } from './routes.js';
import { PostgresRepository } from './repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
pg.types.setTypeParser(1082, (value) => value);

export const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'BD240226119',
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

if (isMainModule) {
  app.listen(PORT, HOST, () => {
    console.log(`API e web disponíveis em http://${HOST}:${PORT}`);
  });
}

export { app, createApp };
export default app;
