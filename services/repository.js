const ENTITIES = {
  pacientes: {
    table: 'hospitacao_paciente',
    id: 'id_paciente',
    fields: [
      'nome_completo', 'cpf', 'cartao_sus', 'data_nascimento', 'sexo',
      'telefone', 'endereco', 'email', 'senha_hash', 'rg', 'nome_pai', 'nome_mae'
    ],
    publicFields: [
      'id_paciente', 'nome_completo', 'cpf', 'cartao_sus', 'data_nascimento',
      'sexo', 'telefone', 'endereco', 'email', 'rg', 'nome_pai', 'nome_mae'
    ]
  },
  prontuarios: {
    table: 'hospitacao_prontuario',
    id: 'id_prontuario',
    fields: [
      'id_paciente', 'data_abertura', 'tipo_sanguineo', 'alergias',
      'doencas_cronicas', 'medicamentos_em_uso'
    ]
  },
  profissionais: {
    table: 'hospitacao_profissional',
    id: 'id_profissional',
    fields: [
      'nome_completo', 'cpf', 'cargo', 'registro_conselho', 'especialidade',
      'perfil_acesso', 'email', 'senha_hash', 'ativo'
    ],
    publicFields: [
      'id_profissional', 'nome_completo', 'cargo', 'registro_conselho',
      'especialidade', 'perfil_acesso', 'email', 'ativo'
    ]
  },
  atendimentos: {
    table: 'hospitacao_atendimento',
    id: 'id_atendimento',
    fields: [
      'cod_atendimento', 'id_paciente', 'id_prontuario', 'id_profissional',
      'data_hora_chegada', 'canal_entrada', 'queixa_principal', 'status'
    ]
  },
  triagens: {
    table: 'hospitacao_triagem',
    id: 'id_triagem',
    fields: [
      'id_atendimento', 'id_profissional', 'data_hora_triagem',
      'pressao_arterial', 'temperatura', 'frequencia_cardiaca',
      'saturacao_o2', 'peso', 'classificacao_risco', 'observacoes'
    ]
  }
};

const UI_TO_DB_STATUS = {
  'aguardando-triagem': 'aguardando_triagem',
  'aguardando-medico': 'aguardando_atendimento',
  'em-atendimento': 'em_atendimento',
  'em-observacao': 'em_observacao',
  confirmado: 'alta',
  cancelado: 'cancelado'
};

const DB_TO_UI_STATUS = Object.fromEntries(
  Object.entries(UI_TO_DB_STATUS).map(([ui, db]) => [db, ui])
);

function toDatabaseStatus(status) {
  if (!status) return 'aguardando_triagem';
  const mapped = UI_TO_DB_STATUS[status];
  if (!mapped) throw new Error('Status de atendimento inválido');
  return mapped;
}

function publicEntity(entity, row) {
  const fields = entity.publicFields || entity.fields;
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

function selectedFields(entity) {
  return entity.publicFields || [entity.id, ...entity.fields];
}

function mapAtendimento(row) {
  return {
    id: row.cod_atendimento,
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
    status: DB_TO_UI_STATUS[row.status] || row.status,
    queixaPrincipal: row.queixa_principal,
    triagem: row.id_triagem ? {
      pa: row.pressao_arterial,
      temp: row.temperatura,
      bpm: row.frequencia_cardiaca,
      saturacao: row.saturacao_o2,
      peso: row.peso,
      queixas: row.observacoes || row.queixa_principal || '',
      classificacao: row.classificacao_risco,
      id_profissional: row.id_profissional_triagem
    } : null,
    medico: row.id_consulta ? {
      medicacoes: row.prescricao,
      observacoes: row.observacoes_medicas,
      diagnostico: row.diagnostico,
      id_profissional: row.id_profissional_medico
    } : null
  };
}

export class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async health() {
    await this.pool.query('SELECT 1');
  }

  async listar(entidade, filtros = {}) {
    const config = ENTITIES[entidade];
    if (!config) throw new Error('Entidade inválida');
    if (entidade === 'profissionais' && filtros.perfil_acesso) filtros.ativo = true;
    const conditions = [];
    const values = [];
    for (const [field, value] of Object.entries(filtros)) {
      if (!config.fields.includes(field)) continue;
      values.push(value);
      conditions.push(`${field} = $${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT ${selectedFields(config).join(', ')} FROM ${config.table}${where} ORDER BY ${config.id}`,
      values
    );
    return result.rows.map((row) => publicEntity(config, row));
  }

  async buscarPorId(entidade, id) {
    const config = ENTITIES[entidade];
    if (!config) throw new Error('Entidade inválida');
    const result = await this.pool.query(
      `SELECT ${selectedFields(config).join(', ')} FROM ${config.table} WHERE ${config.id} = $1`,
      [id]
    );
    return result.rows[0] ? publicEntity(config, result.rows[0]) : null;
  }

  async criar(entidade, dados) {
    const config = ENTITIES[entidade];
    dados = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
    const fields = config.fields.filter((field) => Object.hasOwn(dados, field));
    if (fields.length === 0) throw new Error('Nenhum campo válido foi informado');
    const values = fields.map((field) => dados[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    const result = await this.pool.query(
      `INSERT INTO ${config.table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${config.id}, ${config.fields.join(', ')}`,
      values
    );
    return publicEntity(config, result.rows[0]);
  }

  async atualizar(entidade, id, dados) {
    const config = ENTITIES[entidade];
    dados = dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
    const fields = config.fields.filter((field) => Object.hasOwn(dados, field));
    if (fields.length === 0) throw new Error('Nenhum campo válido foi informado');
    const values = fields.map((field) => dados[field]);
    const setters = fields.map((field, index) => `${field} = $${index + 1}`);
    values.push(id);
    const result = await this.pool.query(
      `UPDATE ${config.table} SET ${setters.join(', ')} WHERE ${config.id} = $${values.length} RETURNING ${config.id}, ${config.fields.join(', ')}`,
      values
    );
    return result.rows[0] ? publicEntity(config, result.rows[0]) : null;
  }

  async remover(entidade, id) {
    const config = ENTITIES[entidade];
    const result = await this.pool.query(
      `DELETE FROM ${config.table} WHERE ${config.id} = $1 RETURNING ${config.id}`,
      [id]
    );
    return result.rowCount > 0;
  }

  async listarAtendimentos() {
    const result = await this.pool.query(`
      SELECT a.id_atendimento, a.cod_atendimento, a.id_profissional,
             a.data_hora_chegada, a.queixa_principal, a.status,
             p.nome_completo, p.data_nascimento, p.sexo, p.cpf, p.rg,
             p.nome_pai, p.nome_mae, p.endereco, p.telefone,
             t.id_triagem, t.pressao_arterial, t.temperatura,
             t.frequencia_cardiaca, t.saturacao_o2, t.peso,
             t.classificacao_risco, t.observacoes,
             t.id_profissional AS id_profissional_triagem,
             c.id_consulta, c.prescricao, c.observacoes AS observacoes_medicas,
             c.diagnostico, c.id_profissional AS id_profissional_medico
        FROM hospitacao_atendimento a
        JOIN hospitacao_paciente p ON p.id_paciente = a.id_paciente
        LEFT JOIN hospitacao_triagem t ON t.id_atendimento = a.id_atendimento
        LEFT JOIN hospitacao_consulta_medica c ON c.id_atendimento = a.id_atendimento
       ORDER BY a.data_hora_chegada DESC, a.id_atendimento DESC
    `);
    return result.rows.map(mapAtendimento);
  }

  async salvarAtendimento(dados) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const patient = {
        nome_completo: dados.nome,
        cpf: dados.cpf,
        data_nascimento: dados.nascimento,
        sexo: dados.sexo,
        telefone: dados.telefone || null,
        endereco: dados.endereco || null,
        rg: dados.rg || null,
        nome_pai: dados.pai || null,
        nome_mae: dados.mae || null
      };
      if (!patient.nome_completo || !patient.cpf || !patient.data_nascimento || !patient.sexo) {
        throw new Error('nome, cpf, nascimento e sexo são obrigatórios');
      }

      const patientResult = await client.query(`
        INSERT INTO hospitacao_paciente
          (nome_completo, cpf, data_nascimento, sexo, telefone, endereco, rg, nome_pai, nome_mae)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (cpf) DO UPDATE SET
          nome_completo = EXCLUDED.nome_completo,
          data_nascimento = EXCLUDED.data_nascimento,
          sexo = EXCLUDED.sexo,
          telefone = EXCLUDED.telefone,
          endereco = EXCLUDED.endereco,
          rg = EXCLUDED.rg,
          nome_pai = EXCLUDED.nome_pai,
          nome_mae = EXCLUDED.nome_mae
        RETURNING id_paciente
      `, [
        patient.nome_completo, patient.cpf, patient.data_nascimento, patient.sexo,
        patient.telefone, patient.endereco, patient.rg, patient.nome_pai, patient.nome_mae
      ]);
      const idPaciente = patientResult.rows[0].id_paciente;

      const prontuarioResult = await client.query(`
        INSERT INTO hospitacao_prontuario (id_paciente, data_abertura)
        VALUES ($1, CURRENT_DATE)
        ON CONFLICT (id_paciente) DO UPDATE SET id_paciente = EXCLUDED.id_paciente
        RETURNING id_prontuario
      `, [idPaciente]);
      const idProntuario = prontuarioResult.rows[0].id_prontuario;

      const existing = dados.id
        ? await client.query(
          'SELECT id_atendimento, id_paciente, status FROM hospitacao_atendimento WHERE cod_atendimento = $1 FOR UPDATE',
          [dados.id]
        )
        : { rows: [] };

      if (dados.id && existing.rows.length === 0) {
        throw new Error('Atendimento não encontrado');
      }

      let idAtendimento;
      if (existing.rows.length) {
        idAtendimento = existing.rows[0].id_atendimento;
        await client.query(`
          UPDATE hospitacao_atendimento
             SET id_paciente = $1, id_prontuario = $2, status = $3,
                 queixa_principal = $4
           WHERE id_atendimento = $5
        `, [
          idPaciente, idProntuario,
          dados.status ? toDatabaseStatus(dados.status) : existing.rows[0].status,
          dados.triagem?.queixas || dados.queixaPrincipal || null, idAtendimento
        ]);
      } else {
        const idProfissional = await this.profissionalId(
          client, dados.id_profissional, 'recepcao'
        );
        const code = await client.query(
          "SELECT 'AT' || LPAD(nextval('hospitacao_atendimento_codigo_seq')::text, 4, '0') AS cod"
        );
        const created = await client.query(`
          INSERT INTO hospitacao_atendimento
            (cod_atendimento, id_paciente, id_prontuario, id_profissional,
             canal_entrada, queixa_principal, status)
          VALUES ($1, $2, $3, $4, 'presencial', $5, 'aguardando_triagem')
          RETURNING id_atendimento
        `, [code.rows[0].cod, idPaciente, idProntuario, idProfissional, dados.queixaPrincipal || null]);
        idAtendimento = created.rows[0].id_atendimento;
      }

      if (dados.triagem) {
        const triage = dados.triagem;
        const idProfissional = await this.profissionalId(
          client, triage.id_profissional, 'enfermeiro'
        );
        await client.query(`
          INSERT INTO hospitacao_triagem
            (id_atendimento, id_profissional, data_hora_triagem,
             pressao_arterial, temperatura, frequencia_cardiaca,
             saturacao_o2, peso, classificacao_risco, observacoes)
          VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id_atendimento) DO UPDATE SET
            id_profissional = EXCLUDED.id_profissional,
            data_hora_triagem = EXCLUDED.data_hora_triagem,
            pressao_arterial = EXCLUDED.pressao_arterial,
            temperatura = EXCLUDED.temperatura,
            frequencia_cardiaca = EXCLUDED.frequencia_cardiaca,
            saturacao_o2 = EXCLUDED.saturacao_o2,
            peso = EXCLUDED.peso,
            classificacao_risco = EXCLUDED.classificacao_risco,
            observacoes = EXCLUDED.observacoes
        `, [
          idAtendimento, idProfissional, triage.pa || null, triage.temp || null,
          triage.bpm || null, triage.saturacao || null, triage.peso || null,
          triage.classificacao, triage.queixas || null
        ]);
      }

      if (dados.medico) {
        const medical = dados.medico;
        const idProfissional = await this.profissionalId(
          client, medical.id_profissional, 'medico'
        );
        await client.query(`
          INSERT INTO hospitacao_consulta_medica
            (id_atendimento, id_profissional, data_hora_consulta, prescricao, diagnostico, observacoes)
          VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
          ON CONFLICT (id_atendimento) DO UPDATE SET
            id_profissional = EXCLUDED.id_profissional,
            data_hora_consulta = EXCLUDED.data_hora_consulta,
            prescricao = EXCLUDED.prescricao,
            diagnostico = EXCLUDED.diagnostico,
            observacoes = EXCLUDED.observacoes
        `, [
          idAtendimento, idProfissional, medical.medicacoes || '',
          medical.diagnostico || null, medical.observacoes || null
        ]);
      }

      const result = await this.buscarAtendimentoPorCodigo(
        dados.id || null, idAtendimento, client
      );
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
    if (suppliedId !== undefined && suppliedId !== null && suppliedId !== '') {
      const result = await client.query(
        'SELECT id_profissional FROM hospitacao_profissional WHERE id_profissional = $1 AND ativo = TRUE AND perfil_acesso = $2',
        [suppliedId, role]
      );
      if (!result.rows.length) throw new Error(`Selecione um profissional ativo com perfil "${role}"`);
      return result.rows[0].id_profissional;
    }
    const result = await client.query(`
      SELECT id_profissional
        FROM hospitacao_profissional
       WHERE ativo = TRUE AND perfil_acesso = $1
       ORDER BY id_profissional
       LIMIT 1
    `, [role]);
    if (!result.rows.length) {
      throw new Error(`Cadastre um profissional ativo com perfil "${role}" antes de continuar`);
    }
    return result.rows[0].id_profissional;
  }

  async buscarAtendimentoPorCodigo(codigo, id, executor = this.pool) {
    const condition = codigo ? 'a.cod_atendimento = $1' : 'a.id_atendimento = $1';
    const result = await executor.query(`
      SELECT a.id_atendimento, a.cod_atendimento, a.id_profissional,
             a.data_hora_chegada, a.queixa_principal, a.status,
             p.nome_completo, p.data_nascimento, p.sexo, p.cpf, p.rg,
             p.nome_pai, p.nome_mae, p.endereco, p.telefone,
             t.id_triagem, t.pressao_arterial, t.temperatura,
             t.frequencia_cardiaca, t.saturacao_o2, t.peso,
             t.classificacao_risco, t.observacoes,
             t.id_profissional AS id_profissional_triagem,
             c.id_consulta, c.prescricao, c.observacoes AS observacoes_medicas,
             c.diagnostico, c.id_profissional AS id_profissional_medico
        FROM hospitacao_atendimento a
        JOIN hospitacao_paciente p ON p.id_paciente = a.id_paciente
        LEFT JOIN hospitacao_triagem t ON t.id_atendimento = a.id_atendimento
        LEFT JOIN hospitacao_consulta_medica c ON c.id_atendimento = a.id_atendimento
       WHERE ${condition}
    `, [codigo || id]);
    return result.rows[0] ? mapAtendimento(result.rows[0]) : null;
  }

  async cancelarAtendimento(codigo) {
    const result = await this.pool.query(`
      UPDATE hospitacao_atendimento
         SET status = 'cancelado'
       WHERE cod_atendimento = $1
       RETURNING cod_atendimento
    `, [codigo]);
    return result.rowCount > 0;
  }
}

export { ENTITIES };
