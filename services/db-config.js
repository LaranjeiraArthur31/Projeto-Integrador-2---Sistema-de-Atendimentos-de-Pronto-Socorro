// Configuração do PostgreSQL e mensagens de erro amigáveis (usado por server.js e scripts/setup.js).

export const TABELAS = ['paciente', 'profissional', 'atendimento', 'triagem', 'atendimento_medico'];
const SENHA_EXEMPLO = 'defina_sua_senha_local';

export function lerConfigBanco(env = process.env) {
  return {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'pronto_socorro'
  };
}

function codigoDoErro(error) {
  if (error?.code) return error.code;
  // Com "localhost", o Node pode tentar IPv6 e IPv4 e devolver um AggregateError.
  return error?.errors?.find((item) => item?.code)?.code;
}

// Devolve um texto curto em português com a causa provável e o que fazer.
export function explicarErroBanco(error, config) {
  const destino = `${config.host}:${config.port}`;
  const code = codigoDoErro(error);
  const message = String(error?.message || '');

  if (code === '28P01' || code === '28000' || /password must be a string/i.test(message)) {
    const dica = !config.password || config.password === SENHA_EXEMPLO
      ? ' O DB_PASSWORD do .env está vazio ou ainda com o valor de exemplo.'
      : '';
    return `Usuário ou senha do PostgreSQL recusados (usuário "${config.user}").${dica}\n`
      + 'Corrija DB_USER e DB_PASSWORD no arquivo .env com a senha definida na instalação do PostgreSQL.';
  }
  if (code === 'ECONNREFUSED') {
    return `Não foi possível conectar ao PostgreSQL em ${destino}: o banco parece estar desligado ou em outra porta.\n`
      + 'Verifique se o serviço "postgresql" está em execução (Windows: services.msc) e se DB_HOST/DB_PORT no .env estão corretos.';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `O endereço DB_HOST="${config.host}" não foi encontrado. Use DB_HOST=127.0.0.1 no .env.`;
  }
  if (code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return `O PostgreSQL em ${destino} não respondeu a tempo. Confira DB_HOST e DB_PORT no .env e se o serviço está ligado.`;
  }
  if (code === '3D000') {
    return `O banco "${config.database}" não existe.\nRode "npm run setup" para criá-lo e carregar os dados de demonstração.`;
  }
  if (code === '42P01') {
    return `As tabelas do sistema não existem no banco "${config.database}".\nRode "npm run setup" para criá-las.`;
  }
  return `Erro ao acessar o PostgreSQL em ${destino}${code ? ` (código ${code})` : ''}: ${message}`;
}

// Confere conexão e tabelas; lança um erro com código 42P01 se faltar alguma tabela.
export async function verificarBanco(pool) {
  const { rows } = await pool.query(
    'SELECT t AS tabela FROM unnest($1::text[]) AS t WHERE to_regclass(t) IS NULL',
    [TABELAS]
  );
  if (rows.length) {
    const error = new Error(`Tabelas ausentes: ${rows.map((row) => row.tabela).join(', ')}`);
    error.code = '42P01';
    throw error;
  }
}
