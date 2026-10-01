USE BD240226119;

CREATE TABLE hospitacao_paciente (
    id_paciente INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cartao_sus VARCHAR(20) UNIQUE,
    data_nascimento DATE NOT NULL,
    sexo ENUM('M','F','outro') NOT NULL,
    telefone VARCHAR(20),
    endereco VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    senha_hash VARCHAR(255)
);

CREATE TABLE hospitacao_prontuario (
    id_prontuario INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente INT NOT NULL UNIQUE,
    data_abertura DATE NOT NULL,
    tipo_sanguineo ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','desconhecido')
        NOT NULL DEFAULT 'desconhecido',
    alergias TEXT,
    doencas_cronicas TEXT,
    medicamentos_em_uso TEXT,

    CONSTRAINT fk_prontuario_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES hospitacao_paciente(id_paciente)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE TABLE hospitacao_profissional (
    id_profissional INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo VARCHAR(50) NOT NULL,
    registro_conselho VARCHAR(20) UNIQUE,
    especialidade VARCHAR(50),
    perfil_acesso ENUM('recepcao','enfermeiro','medico','admin') NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE hospitacao_atendimento (
    id_atendimento INT AUTO_INCREMENT PRIMARY KEY,
    cod_atendimento VARCHAR(20) NOT NULL UNIQUE,
    id_paciente INT NOT NULL,
    id_prontuario INT NOT NULL,
    id_profissional INT NOT NULL,
    data_hora_chegada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    canal_entrada ENUM('presencial','digital') NOT NULL,
    queixa_principal TEXT,
    status ENUM('aguardando_triagem','aguardando_atendimento',
                'em_atendimento','em_observacao','alta',
                'internado','transferido','obito') NOT NULL,

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

CREATE TABLE hospitacao_triagem (
    id_triagem INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_profissional INT NOT NULL,
    data_hora_triagem DATETIME NOT NULL,
    pressao_arterial VARCHAR(10),
    temperatura DECIMAL(4,2),
    frequencia_cardiaca INT,
    saturacao_o2 INT,
    peso DECIMAL(5,2),
    classificacao_risco ENUM('vermelho','laranja','amarelo','verde') NOT NULL,
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

