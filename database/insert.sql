-- PACIENTES

INSERT INTO paciente (
    nome_completo,
    cpf,
    rg,
    nome_mae,
    nome_pai,
    data_nascimento,
    sexo,
    telefone,
    endereco,
    email
)
VALUES
(
    'João da Silva',
    '52998224725',
    '12345678',
    'Maria da Silva',
    'José da Silva',
    '1990-05-15',
    'M',
    '(19)99999-1111',
    'Rua A, 100',
    'joao@email.com'
),
(
    'Ana Souza',
    '11144477735',
    '87654321',
    'Paula Souza',
    'Carlos Souza',
    '1985-10-20',
    'F',
    '(19)99999-2222',
    'Rua B, 200',
    'ana@email.com'
);

-- PROFISSIONAIS

INSERT INTO profissional (
    nome_completo,
    cpf,
    cargo,
    registro_conselho,
    especialidade,
    email,
    senha
)
VALUES
(
    'Lucas Almeida',
    '12345678909',
    'Recepcionista',
    NULL,
    NULL,
    'recepcao@hospital.com',
    '123456'
),
(
    'Fernanda Costa',
    '98765432100',
    'Enfermeiro',
    '123456SP',
    NULL,
    'enfermagem@hospital.com',
    '123456'
),
(
    'Ricardo Oliveira',
    '11144477735',
    'Medico',
    '654321SP',
    'Clínico Geral',
    'medico@hospital.com',
    '123456'
);

-- ATENDIMENTO

INSERT INTO atendimento (
    numero_atendimento,
    id_paciente,
    id_recepcionista,
    status
)
VALUES
(
    'AT0001',
    1,
    1,
    'AGUARDANDO_MEDICO'
);

-- TRIAGEM

INSERT INTO triagem (
    id_atendimento,
    id_enfermeiro,
    pressao_arterial,
    temperatura,
    frequencia_cardiaca,
    queixa_principal,
    classificacao_manchester
)
VALUES
(
    1,
    2,
    '12x8',
    36.8,
    78,
    'Dor de cabeça persistente',
    'VERDE'
);

-- ATENDIMENTO MÉDICO

INSERT INTO atendimento_medico (
    id_atendimento,
    id_medico,
    diagnostico,
    medicacoes_prescritas,
    observacoes
)
VALUES
(
    1,
    3,
    'Cefaleia tensional',
    'Dipirona 500mg de 6 em 6 horas',
    'Paciente orientado a retornar caso os sintomas persistam'
);