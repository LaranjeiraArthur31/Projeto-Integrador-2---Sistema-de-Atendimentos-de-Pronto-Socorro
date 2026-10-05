CREATE TABLE IF NOT EXISTS hospitacao_paciente (
    id_paciente INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cartao_sus VARCHAR(20) UNIQUE,
    data_nascimento DATE NOT NULL,
    sexo VARCHAR(10) NOT NULL CHECK (sexo IN ('M', 'F', 'outro')),
    telefone VARCHAR(20),
    endereco VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    senha_hash VARCHAR(255),
    rg VARCHAR(20),
    nome_pai VARCHAR(100),
    nome_mae VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS hospitacao_prontuario (
    id_prontuario INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_paciente INT NOT NULL UNIQUE,
    data_abertura DATE NOT NULL,
    tipo_sanguineo VARCHAR(12) NOT NULL DEFAULT 'desconhecido'
        CHECK (tipo_sanguineo IN (
            'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'desconhecido'
        )),
    alergias TEXT,
    doencas_cronicas TEXT,
    medicamentos_em_uso TEXT,
    CONSTRAINT fk_prontuario_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES hospitacao_paciente(id_paciente)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS hospitacao_profissional (
    id_profissional INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo VARCHAR(50) NOT NULL,
    registro_conselho VARCHAR(20) UNIQUE,
    especialidade VARCHAR(50),
    perfil_acesso VARCHAR(20) NOT NULL
        CHECK (perfil_acesso IN ('recepcao', 'enfermeiro', 'medico', 'admin')),
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS hospitacao_atendimento (
    id_atendimento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cod_atendimento VARCHAR(20) NOT NULL UNIQUE,
    id_paciente INT NOT NULL,
    id_prontuario INT NOT NULL,
    id_profissional INT NOT NULL,
    data_hora_chegada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal_entrada VARCHAR(20) NOT NULL
        CHECK (canal_entrada IN ('presencial', 'digital')),
    queixa_principal TEXT,
    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'aguardando_triagem', 'aguardando_atendimento', 'em_atendimento',
            'em_observacao', 'alta', 'internado', 'transferido', 'obito', 'cancelado'
        )),
    CONSTRAINT fk_atendimento_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES hospitacao_paciente(id_paciente)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_atendimento_prontuario
        FOREIGN KEY (id_prontuario)
        REFERENCES hospitacao_prontuario(id_prontuario)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_atendimento_profissional
        FOREIGN KEY (id_profissional)
        REFERENCES hospitacao_profissional(id_profissional)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS hospitacao_triagem (
    id_triagem INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_profissional INT NOT NULL,
    data_hora_triagem TIMESTAMP NOT NULL,
    pressao_arterial VARCHAR(20),
    temperatura DECIMAL(4,2),
    frequencia_cardiaca INT,
    saturacao_o2 INT,
    peso DECIMAL(5,2),
    classificacao_risco VARCHAR(10) NOT NULL
        CHECK (classificacao_risco IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul')),
    observacoes TEXT,
    CONSTRAINT fk_triagem_atendimento
        FOREIGN KEY (id_atendimento)
        REFERENCES hospitacao_atendimento(id_atendimento)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_triagem_profissional
        FOREIGN KEY (id_profissional)
        REFERENCES hospitacao_profissional(id_profissional)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS hospitacao_consulta_medica (
    id_consulta INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_profissional INT NOT NULL,
    data_hora_consulta TIMESTAMP NOT NULL,
    prescricao TEXT NOT NULL,
    diagnostico TEXT,
    observacoes TEXT,
    CONSTRAINT fk_consulta_atendimento
        FOREIGN KEY (id_atendimento)
        REFERENCES hospitacao_atendimento(id_atendimento)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_consulta_profissional
        FOREIGN KEY (id_profissional)
        REFERENCES hospitacao_profissional(id_profissional)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE SEQUENCE IF NOT EXISTS hospitacao_atendimento_codigo_seq;
SELECT setval(
    'hospitacao_atendimento_codigo_seq',
    GREATEST(COALESCE((
        SELECT MAX(SUBSTRING(cod_atendimento FROM '^AT([0-9]+)$')::BIGINT)
        FROM hospitacao_atendimento
    ), 0) + 1, 1),
    FALSE
);
