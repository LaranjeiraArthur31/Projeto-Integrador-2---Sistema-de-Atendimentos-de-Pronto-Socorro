import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './auth.js';

const ENTITIES = {
  pacientes: {
    table: 'paciente',
    id: 'id_paciente',
    fields: [
      'nome_completo', 'cpf', 'rg', 'nome_mae', 'nome_pai', 'data_nascimento',
      'sexo', 'telefone', 'endereco', 'email'
    ],
    required: ['nome_completo', 'cpf', 'rg', 'nome_mae', 'data_nascimento', 'sexo'],
    enums: { sexo: ['M', 'F'] }
  },
  profissionais: {
    table: 'profissional',
    id: 'id_profissional',
    fields: [
      'nome_completo', 'cpf', 'cargo', 'registro_conselho', 'especialidade',
      'email', 'senha', 'ativo'
    ],
    required: ['nome_completo', 'cpf', 'cargo', 'email', 'senha'],
    enums: { cargo: ['Medico', 'Enfermeiro', 'Recepcionista'] }
  },
  triagens: {
    table: 'triagem',
    id: 'id_triagem',
    fields: [
      'id_atendimento', 'id_enfermeiro', 'data_hora_triagem', 'pressao_arterial',
      'temperatura', 'frequencia_cardiaca', 'queixa_principal', 'classificacao_manchester'
    ],
    required: ['id_atendimento', 'id_enfermeiro', 'queixa_principal', 'classificacao_manchester'],
    enums: { classificacao_manchester: ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL'] }
  },
  'atendimentos-medicos': {
    table: 'atendimento_medico',
    id: 'id_atendimento_medico',
    fields: [
      'id_atendimento', 'id_medico', 'data_hora_inicio', 'data_hora_fim',
      'diagnostico', 'medicacoes_prescritas', 'observacoes'
    ],
    required: ['id_atendimento', 'id_medico']
  }
};

const ROLES = { recepcao: 'Recepcionista', enfermeiro: 'Enfermeiro', medico: 'Medico' };
const UI_TO_DB_STATUS = {
  'aguardando-triagem': 'AGUARDANDO_TRIAGEM',
  'aguardando-medico': 'AGUARDANDO_MEDICO',
  'em-atendimento': 'EM_ATENDIMENTO',
  confirmado: 'FINALIZADO',
  cancelado: 'CANCELADO'
};
const DB_TO_UI_STATUS = Object.fromEntries(
  Object.entries(UI_TO_DB_STATUS).map(([ui, db]) => [db, ui])
);

function invalid(message) {
  const error = new Error(message);
  error.code = 'INVALID_DATA';
  return error;
}

function validate(config, data, creating = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw invalid('Informe um objeto com os dados do registro');
  }
  for (const field of config.required) {
    if ((creating || Object.hasOwn(data, field)) &&
        (data[field] === undefined || data[field] === null || String(data[field]).trim() === '')) {
      throw invalid(`Campo obrigatório: ${field}`);
    }
  }
  for (const [field, options] of Object.entries(config.enums || {})) {
    if (Object.hasOwn(data, field) && !options.includes(data[field])) {
      throw invalid(`Valor inválido para ${field}`);
    }
  }
}

function toDatabaseStatus(status) {
  const mapped = UI_TO_DB_STATUS[status];
  if (!mapped) throw invalid('Status de atendimento inválido');
  return mapped;
}

function selectedFields(config) {
  return [config.id, ...config.fields.filter((field) => field !== 'senha')];
}

function mapAtendimento(row) {
  return {
    id: row.numero_atendimento,
    dbId: row.id_atendimento,
    nome: row.nome_completo,
    nascimento: row.data_nascimento,
    sexo: row.sexo,
    cpf: row.cpf,
    rg: row.rg,
    pai: row.nome_pai,
    mae: row.nome_mae,
    endereco: row.endereco,
    telefone: row.telefone,
    criadoEm: row.data_hora_chegada,
    status: DB_TO_UI_STATUS[row.status],
    queixaPrincipal: row.queixa_principal,
    triagem: row.id_triagem ? {
      pa: row.pressao_arterial,
      temp: row.temperatura,
      bpm: row.frequencia_cardiaca,
      queixas: row.queixa_principal,
      classificacao: row.classificacao_manchester.toLowerCase(),
      id_profissional: row.id_enfermeiro
    } : null,
    medico: row.id_atendimento_medico ? {
      medicacoes: row.medicacoes_prescritas,
      observacoes: row.observacoes_medicas,
      diagnostico: row.diagnostico,
      id_profissional: row.id_medico
    } : null
  };
}

const ATENDIMENTO_SELECT = `
  SELECT a.id_atendimento, a.numero_atendimento, a.data_hora_chegada, a.status,
         p.nome_completo, p.data_nascimento, p.sexo, p.cpf, p.rg,
         p.nome_pai, p.nome_mae, p.endereco, p.telefone,
         t.id_triagem, t.pressao_arterial, t.temperatura, t.frequencia_cardiaca,
         t.queixa_principal, t.classificacao_manchester, t.id_enfermeiro,
         m.id_atendimento_medico, m.medicacoes_prescritas,
         m.observacoes AS observacoes_medicas, m.diagnostico, m.id_medico
    FROM atendimento a
    JOIN paciente p ON p.id_paciente = a.id_paciente
    LEFT JOIN triagem t ON t.id_atendimento = a.id_atendimento
    LEFT JOIN atendimento_medico m ON m.id_atendimento = a.id_atendimento
`;

export class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async health() {
    await this.pool.query('SELECT 1');
  }

  async autenticar(email, senha) {
    if (typeof email !== 'string' || typeof senha !== 'string' || senha.length > 128) return null;
    const { rows } = await this.pool.query(
      'SELECT id_profissional, senha FROM profissional WHERE LOWER(email) = $1 AND ativo = TRUE',
      [email.trim().toLowerCase()]
    );
    const row = rows[0];
    if (!row || !await verifyPassword(senha, row.senha)) return null;
    if (!row.senha.startsWith('scrypt$')) {
      const upgraded = await hashPassword(senha, { legacy: true });
      await this.pool.query('UPDATE profissional SET senha = $1 WHERE id_profissional = $2 AND senha = $3',
        [upgraded, row.id_profissional, row.senha]);
    }
    return this.buscarPorId('profissionais', row.id_profissional);
  }

  async listar(entidade, filtros = {}) {
    const config = ENTITIES[entidade];
    const filters = { ...filtros };
    if (entidade === 'profissionais' && filters.perfil_acesso !== undefined) {
      if (!Object.hasOwn(ROLES, filters.perfil_acesso)) throw invalid('Perfil de acesso inválido');
      filters.cargo = ROLES[filters.perfil_acesso];
      filters.ativo = true;
      delete filters.perfil_acesso;
    }
    const conditions = [];
    const values = [];
    validate(config, filters);
    for (const [field, value] of Object.entries(filters)) {
      if (!config.fields.includes(field)) continue;
      values.push(value);
      conditions.push(`${field} = $${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT ${selectedFields(config).join(', ')} FROM ${config.table}${where} ORDER BY ${config.id}`,
      values
    );
    return rows;
  }

  async buscarPorId(entidade, id, executor = this.pool) {
    const config = ENTITIES[entidade];
    const { rows } = await executor.query(
      `SELECT ${selectedFields(config).join(', ')} FROM ${config.table} WHERE ${config.id} = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async criar(entidade, dados) {
    const config = ENTITIES[entidade];
    validate(config, dados, true);
    if (entidade === 'profissionais') {
      if (typeof dados.email !== 'string') throw invalid('Email inválido');
      dados = { ...dados, senha: await hashPassword(dados.senha), email: dados.email.trim().toLowerCase() };
    }
    const fields = config.fields.filter((field) => Object.hasOwn(dados, field));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO ${config.table} (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${selectedFields(config).join(', ')}`,
        fields.map((field) => dados[field])
      );
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async atualizar(entidade, id, dados) {
    const config = ENTITIES[entidade];
    validate(config, dados);
    if (entidade === 'profissionais' && Object.hasOwn(dados, 'senha')) {
      dados = { ...dados, senha: await hashPassword(dados.senha) };
    }
    const fields = config.fields.filter((field) => Object.hasOwn(dados, field));
    if (!fields.length) throw invalid('Nenhum campo válido foi informado');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE ${config.table} SET ${fields.map((field, i) => `${field} = $${i + 1}`).join(', ')} WHERE ${config.id} = $${fields.length + 1} RETURNING ${selectedFields(config).join(', ')}`,
        [...fields.map((field) => dados[field]), id]
      );
      await client.query('COMMIT');
      return rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async remover(entidade, id) {
    const config = ENTITIES[entidade];
    const result = await this.pool.query(
      `DELETE FROM ${config.table} WHERE ${config.id} = $1`, [id]
    );
    return result.rowCount > 0;
  }

  async listarAtendimentos() {
    const { rows } = await this.pool.query(
      `${ATENDIMENTO_SELECT} ORDER BY a.data_hora_chegada DESC, a.id_atendimento DESC`
    );
    return rows.map(mapAtendimento);
  }

  async salvarAtendimento(dados, actor) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      throw invalid('Informe um objeto com os dados do atendimento');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let existing;
      if (dados.id) {
        const { rows } = await client.query(
          'SELECT id_atendimento FROM atendimento WHERE numero_atendimento = $1 FOR UPDATE', [dados.id]
        );
        if (!rows.length) throw new Error('Atendimento não encontrado');
        existing = await this.buscarAtendimentoPorCodigo(dados.id, null, client);
      }
      if (actor && existing) {
        if (['confirmado', 'cancelado'].includes(existing.status)) {
          throw invalid('Atendimentos finalizados ou cancelados não podem ser alterados');
        }
        if (actor.cargo === 'Enfermeiro' &&
            (existing.status !== 'aguardando-triagem' || !dados.triagem || dados.status !== 'aguardando-medico')) {
          throw invalid('A triagem exige um atendimento aguardando triagem e deve encaminhá-lo ao médico');
        }
        if (actor.cargo === 'Medico' &&
            (!existing.triagem || !['aguardando-medico', 'em-atendimento'].includes(existing.status) ||
             !dados.medico || !['em-atendimento', 'confirmado'].includes(dados.status))) {
          throw invalid('A consulta exige triagem concluída e status de atendimento médico ou alta');
        }
      }
      const data = { ...existing, ...dados };
      if (!existing && data.status !== undefined && data.status !== 'aguardando-triagem') {
        throw invalid('Novos atendimentos devem aguardar triagem');
      }
      const status = existing ? toDatabaseStatus(data.status) : 'AGUARDANDO_TRIAGEM';
      const patient = {
        nome_completo: data.nome, cpf: data.cpf, rg: data.rg, nome_mae: data.mae,
        nome_pai: data.pai ?? null, data_nascimento: data.nascimento, sexo: data.sexo,
        telefone: data.telefone ?? null, endereco: data.endereco ?? null
      };
      validate(ENTITIES.pacientes, patient, true);
      const fields = Object.keys(patient);
      const savedPatient = await client.query(`
        INSERT INTO paciente (${fields.join(', ')})
        VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
        ON CONFLICT (cpf) DO UPDATE SET
          ${fields.filter((field) => field !== 'cpf').map((field) => `${field} = EXCLUDED.${field}`).join(', ')}
        RETURNING id_paciente
      `, Object.values(patient));

      let idAtendimento = existing?.dbId;
      if (existing) {
        await client.query(
          'UPDATE atendimento SET id_paciente = $1, status = $2 WHERE id_atendimento = $3',
          [savedPatient.rows[0].id_paciente, status, idAtendimento]
        );
      } else {
        const idRecepcionista = await this.profissionalId(client, data.id_profissional, 'recepcao');
        // A identidade reserva o número sem disputa entre criações concorrentes.
        const created = await client.query(`
          INSERT INTO atendimento (numero_atendimento, id_paciente, id_recepcionista)
          VALUES ($1, $2, $3) RETURNING id_atendimento
        `, [randomBytes(10).toString('hex'), savedPatient.rows[0].id_paciente, idRecepcionista]);
        idAtendimento = created.rows[0].id_atendimento;
        await client.query(
          'UPDATE atendimento SET numero_atendimento = $1 WHERE id_atendimento = $2',
          [`AT${String(idAtendimento).padStart(4, '0')}`, idAtendimento]
        );
      }

      if (dados.triagem) {
        const triage = dados.triagem;
        const idEnfermeiro = await this.profissionalId(client, triage.id_profissional, 'enfermeiro');
        const values = {
          id_atendimento: idAtendimento,
          id_enfermeiro: idEnfermeiro,
          pressao_arterial: triage.pa ?? null,
          temperatura: triage.temp === '' ? null : triage.temp ?? null,
          frequencia_cardiaca: triage.bpm === '' ? null : triage.bpm ?? null,
          queixa_principal: triage.queixas,
          classificacao_manchester: typeof triage.classificacao === 'string'
            ? triage.classificacao.toUpperCase() : triage.classificacao
        };
        validate(ENTITIES.triagens, values, true);
        const columns = Object.keys(values);
        await client.query(`
          INSERT INTO triagem (${columns.join(', ')})
          VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
          ON CONFLICT (id_atendimento) DO UPDATE SET
            ${columns.slice(1).map((field) => `${field} = EXCLUDED.${field}`).join(', ')}
        `, Object.values(values));
      }

      if (dados.medico) {
        const medical = dados.medico;
        const idMedico = await this.profissionalId(client, medical.id_profissional, 'medico');
        await client.query(`
          INSERT INTO atendimento_medico
            (id_atendimento, id_medico, medicacoes_prescritas, diagnostico, observacoes)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id_atendimento) DO UPDATE SET id_medico = EXCLUDED.id_medico,
            medicacoes_prescritas = EXCLUDED.medicacoes_prescritas,
            diagnostico = EXCLUDED.diagnostico, observacoes = EXCLUDED.observacoes
        `, [
          idAtendimento, idMedico, medical.medicacoes ?? null,
          medical.diagnostico ?? null, medical.observacoes ?? null
        ]);
      }
      if (status === 'FINALIZADO') {
        await client.query(`
          UPDATE atendimento_medico SET data_hora_fim = COALESCE(data_hora_fim, CURRENT_TIMESTAMP)
          WHERE id_atendimento = $1
        `, [idAtendimento]);
      }
      const result = await this.buscarAtendimentoPorCodigo(null, idAtendimento, client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async profissionalId(client, suppliedId, role) {
    const hasId = suppliedId !== undefined && suppliedId !== null && suppliedId !== '';
    const { rows } = await client.query(`
      SELECT id_profissional FROM profissional
       WHERE ativo = TRUE AND cargo = $1 ${hasId ? 'AND id_profissional = $2' : ''}
       ORDER BY id_profissional LIMIT 1
    `, hasId ? [ROLES[role], suppliedId] : [ROLES[role]]);
    if (!rows.length) {
      throw invalid(hasId
        ? `Selecione um profissional ativo com perfil "${role}"`
        : `Cadastre um profissional ativo com perfil "${role}" antes de continuar`);
    }
    return rows[0].id_profissional;
  }

  async buscarAtendimentoPorCodigo(codigo, id, executor = this.pool) {
    const condition = codigo ? 'a.numero_atendimento = $1' : 'a.id_atendimento = $1';
    const { rows } = await executor.query(
      `${ATENDIMENTO_SELECT} WHERE ${condition}`, [codigo || id]
    );
    return rows[0] ? mapAtendimento(rows[0]) : null;
  }

  async cancelarAtendimento(codigo) {
    const result = await this.pool.query(
      "UPDATE atendimento SET status = 'CANCELADO' WHERE numero_atendimento = $1", [codigo]
    );
    return result.rowCount > 0;
  }
}

export { ENTITIES };
