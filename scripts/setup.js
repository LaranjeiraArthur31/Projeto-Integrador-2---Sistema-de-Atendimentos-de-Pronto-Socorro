// npm run setup — prepara o banco sem depender do psql.
// 1. cria o .env a partir do .env.example (se não existir);
// 2. cria o banco DB_NAME com codificação UTF8 (se não existir);
// 3. aplica database/schema.sql e database/insert.sql (ambos idempotentes).
// Pode ser executado quantas vezes quiser.
import { copyFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { lerConfigBanco, explicarErroBanco } from '../services/db-config.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arquivoEnv = path.join(raiz, '.env');

async function existe(arquivo) {
  try { await access(arquivo); return true; } catch { return false; }
}

async function main() {
  if (!(await existe(arquivoEnv))) {
    await copyFile(path.join(raiz, '.env.example'), arquivoEnv);
    console.log('Arquivo .env criado a partir do .env.example.');
    console.log('Se a conexão falhar, edite DB_PASSWORD (e DB_PORT, se preciso) no .env e rode "npm run setup" de novo.\n');
  }
  dotenv.config({ path: arquivoEnv });
  const config = lerConfigBanco();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.database)) {
    throw Object.assign(new Error(`DB_NAME inválido: "${config.database}". Use apenas letras, números e _ (ex.: pronto_socorro).`), { amigavel: true });
  }

  try {
    // Conecta no banco padrão "postgres" para poder criar o banco do sistema.
    const admin = new pg.Client({ ...config, database: 'postgres', connectionTimeoutMillis: 5000 });
    await admin.connect();
    try {
      const { rows } = await admin.query(
        'SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1', [config.database]
      );
      if (!rows.length) {
        await admin.query(`CREATE DATABASE "${config.database}" WITH ENCODING 'UTF8' TEMPLATE template0`);
        console.log(`Banco "${config.database}" criado (UTF8).`);
      } else {
        console.log(`Banco "${config.database}" já existe.`);
        if (rows[0].enc !== 'UTF8') {
          console.warn(`AVISO: o banco "${config.database}" usa a codificação ${rows[0].enc}, não UTF8; acentos podem aparecer errados.`);
          console.warn('Para corrigir, use outro DB_NAME no .env (ou apague esse banco) e rode "npm run setup" novamente.');
        }
      }
    } finally {
      await admin.end();
    }

    const client = new pg.Client({ ...config, connectionTimeoutMillis: 5000 });
    await client.connect();
    try {
      for (const arquivo of ['schema.sql', 'insert.sql']) {
        const sql = await readFile(path.join(raiz, 'database', arquivo), 'utf8');
        await client.query(sql);
        console.log(`database/${arquivo} aplicado.`);
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    error.config = config;
    throw error;
  }

  console.log('\nPronto. Agora rode "npm start" e abra o endereço indicado no navegador.');
  console.log('Usuários de demonstração (senha 123456): recepcao@hospital.com, enfermagem@hospital.com, medico@hospital.com');
}

main().catch((error) => {
  console.error('\nERRO no setup:');
  console.error(error.amigavel || !error.config ? error.message : explicarErroBanco(error, error.config));
  process.exitCode = 1;
});
