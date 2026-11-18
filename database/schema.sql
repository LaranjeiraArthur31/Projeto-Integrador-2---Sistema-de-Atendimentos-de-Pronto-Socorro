SET client_encoding = 'UTF8';


-- pacientes
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(20) NOT NULL,
    nome_mae VARCHAR(100) NOT NULL,
    nome_pai VARCHAR(100),
    data_nascimento DATE NOT NULL,
    sexo CHAR(1) NOT NULL CHECK (sexo IN ('M', 'F')),
    telefone VARCHAR(20),
    endereco VARCHAR(150),
    email VARCHAR(100)
);

-- profissionais
CREATE TABLE IF NOT EXISTS profissional (
    id_profissional INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo VARCHAR(20) NOT NULL CHECK (cargo IN ('Medico', 'Enfermeiro', 'Recepcionista')),
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL, -- armazenar hash
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- enfermeiros (especialização de profissional, 1:1)
CREATE TABLE IF NOT EXISTS enfermeiro (
    id_profissional INT PRIMARY KEY,
    coren VARCHAR(20) NOT NULL,
    uf_coren CHAR(2) NOT NULL,

    CONSTRAINT uq_enfermeiro_coren UNIQUE (coren, uf_coren),
    CONSTRAINT fk_enfermeiro_profissional FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional) ON DELETE CASCADE
);

-- medicos (especialização de profissional, 1:1)
CREATE TABLE IF NOT EXISTS medico (
    id_profissional INT PRIMARY KEY,
    crm VARCHAR(20) NOT NULL,
    uf_crm CHAR(2) NOT NULL,
    especialidade VARCHAR(50) NOT NULL,

    CONSTRAINT uq_medico_crm UNIQUE (crm, uf_crm),
    CONSTRAINT fk_medico_profissional FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional) ON DELETE CASCADE
);

-- atendimentos (triagem e consulta médica) — 1:N com paciente e recepcionista
CREATE TABLE IF NOT EXISTS atendimento (
    id_atendimento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_atendimento VARCHAR(20) NOT NULL UNIQUE, -- AT0001
    id_paciente INT NOT NULL,
    id_recepcionista INT NOT NULL,
    data_hora_chegada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM'
        CHECK (status IN ('AGUARDANDO_TRIAGEM', 'AGUARDANDO_MEDICO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO')),

    CONSTRAINT fk_atendimento_paciente FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE RESTRICT,
    CONSTRAINT fk_atendimento_recepcionista FOREIGN KEY (id_recepcionista) REFERENCES profissional(id_profissional) ON DELETE RESTRICT
);

-- triagem (realizada por enfermeiro) — 1:1 com atendimento
CREATE TABLE IF NOT EXISTS triagem (
    id_triagem INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_enfermeiro INT NOT NULL,
    data_hora_triagem TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pressao_arterial VARCHAR(10), -- Ex: "120/80"
    temperatura DECIMAL(4,2),
    frequencia_cardiaca INT,
    queixa_principal TEXT NOT NULL,
    classificacao_manchester VARCHAR(10) NOT NULL
        CHECK (classificacao_manchester IN ('VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL')),

    CONSTRAINT fk_triagem_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento(id_atendimento) ON DELETE RESTRICT,
    CONSTRAINT fk_triagem_enfermeiro FOREIGN KEY (id_enfermeiro) REFERENCES enfermeiro(id_profissional) ON DELETE RESTRICT
);

-- atendimento médico (realizado por médico) — 1:1 com triagem
CREATE TABLE IF NOT EXISTS atendimento_medico (
    id_atendimento_medico INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_triagem INT NOT NULL UNIQUE,
    id_medico INT NOT NULL,
    data_hora_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_hora_fim TIMESTAMP NULL,
    diagnostico TEXT,
    medicacoes_prescritas TEXT, -- atende ao requisito de registrar medicações
    observacoes TEXT,

    CONSTRAINT ck_consulta_datas CHECK (data_hora_fim IS NULL OR data_hora_fim >= data_hora_inicio),
    CONSTRAINT fk_consulta_triagem FOREIGN KEY (id_triagem) REFERENCES triagem(id_triagem) ON DELETE RESTRICT,
    CONSTRAINT fk_consulta_medico FOREIGN KEY (id_medico) REFERENCES medico(id_profissional) ON DELETE RESTRICT
);

-- fks e índices
CREATE INDEX IF NOT EXISTS idx_atendimento_paciente ON atendimento(id_paciente);
CREATE INDEX IF NOT EXISTS idx_atendimento_recepcionista ON atendimento(id_recepcionista);
CREATE INDEX IF NOT EXISTS idx_atendimento_status ON atendimento(status);
CREATE INDEX IF NOT EXISTS idx_triagem_enfermeiro ON triagem(id_enfermeiro);
CREATE INDEX IF NOT EXISTS idx_consulta_medico ON atendimento_medico(id_medico);
