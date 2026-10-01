import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { createApp } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = createApp();
const PORT = process.env.PORT || 3000;
const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'BD240226119',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testarConexaoBanco() {
  try {
    const connection = await db.getConnection();
    console.log('✅ Banco conectado com sucesso:', process.env.DB_NAME || 'BD240226119');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar ao banco de dados:');
    console.error(error.message);
    return false;
  }
}

if (isMainModule) {
  app.listen(PORT, async () => {
    console.log('🚀 API iniciada com Express');
    console.log('📦 Dependências: express, cors, dotenv, mysql2');
    console.log(`🌐 http://localhost:${PORT}`);

    const conectado = await testarConexaoBanco();
    if (!conectado) {
      console.log('⚠️ A API subiu, mas o banco não está conectado. Verifique .env, MySQL e credenciais.');
    }
  });
}

export { app, createApp };
export default app;
