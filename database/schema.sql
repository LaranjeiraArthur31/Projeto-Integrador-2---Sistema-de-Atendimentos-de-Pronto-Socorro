-- 1. Tabela de Pacientes
CREATE TABLE paciente (
    id_paciente INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    rg VARCHAR(20) NOT NULL,
    nome_mae VARCHAR(100) NOT NULL,
    nome_pai VARCHAR(100),
    data_nascimento DATE NOT NULL,
    sexo ENUM('M','F') NOT NULL,
    telefone VARCHAR(20),
    endereco VARCHAR(150),
    email VARCHAR(100)
);

-- 2. Tabela de Profissionais (Recepção, Enfermagem e Médicos)
CREATE TABLE profissional (
    id_profissional INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cargo ENUM('Medico', 'Enfermeiro', 'Recepcionista') NOT NULL,
    registro_conselho VARCHAR(20), -- CRM para médicos, COREN para enfermeiros
    especialidade VARCHAR(50),
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Tabela de Atendimentos
CREATE TABLE atendimento (
    id_atendimento INT AUTO_INCREMENT PRIMARY KEY,
    numero_atendimento VARCHAR(20) NOT NULL UNIQUE, -- Ex: AT0001
    id_paciente INT NOT NULL,
    id_recepcionista INT NOT NULL,
    data_hora_chegada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('AGUARDANDO_TRIAGEM', 'AGUARDANDO_MEDICO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO') NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    
    CONSTRAINT fk_atendimento_paciente FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE RESTRICT,
    CONSTRAINT fk_atendimento_recepcionista FOREIGN KEY (id_recepcionista) REFERENCES profissional(id_profissional) ON DELETE RESTRICT
);

-- 4. Tabela de Triagem (Protocolo de Manchester)
CREATE TABLE triagem (
    id_triagem INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_enfermeiro INT NOT NULL,
    data_hora_triagem TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pressao_arterial VARCHAR(10),
    temperatura DECIMAL(4,2),
    frequencia_cardiaca INT,
    queixa_principal TEXT NOT NULL,
    classificacao_manchester ENUM('VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL') NOT NULL,

    CONSTRAINT fk_triagem_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento(id_atendimento) ON DELETE RESTRICT,
    CONSTRAINT fk_triagem_enfermeiro FOREIGN KEY (id_enfermeiro) REFERENCES profissional(id_profissional) ON DELETE RESTRICT
);

-- 5. Tabela de Atendimento Médico (Consulta Final)
CREATE TABLE atendimento_medico (
    id_atendimento_medico INT AUTO_INCREMENT PRIMARY KEY,
    id_atendimento INT NOT NULL UNIQUE,
    id_medico INT NOT NULL,
    data_hora_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_hora_fim TIMESTAMP NULL,
    diagnostico TEXT,
    medicacoes_prescritas TEXT, -- Atende ao requisito de registrar medicações
    observacoes TEXT,

    CONSTRAINT fk_consulta_atendimento FOREIGN KEY (id_atendimento) REFERENCES atendimento(id_atendimento) ON DELETE RESTRICT,
    CONSTRAINT fk_consulta_medico FOREIGN KEY (id_medico) REFERENCES profissional(id_profissional) ON DELETE RESTRICT
);
