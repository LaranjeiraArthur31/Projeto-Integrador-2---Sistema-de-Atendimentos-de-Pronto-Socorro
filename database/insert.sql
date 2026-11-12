SET client_encoding = 'UTF8';

-- Dados de demonstração (idempotente: pode ser executado mais de uma vez).
-- As chaves estrangeiras são buscadas por CPF, e-mail e número do atendimento,
-- sem depender dos IDs gerados.

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
    '123.456.789-00',
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
    '987.654.321-00',
    '87654321',
    'Paula Souza',
    'Carlos Souza',
    '1985-10-20',
    'F',
    '(19)99999-2222',
    'Rua B, 200',
    'ana@email.com'
)
ON CONFLICT DO NOTHING;

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
    '111.111.111-11',
    'Recepcionista',
    NULL,
    NULL,
    'recepcao@hospital.com',
    '123456'
),
(
    'Fernanda Costa',
    '222.222.222-22',
    'Enfermeiro',
    'COREN12345',
    NULL,
    'enfermagem@hospital.com',
    '123456'
),
(
    'Ricardo Oliveira',
    '333.333.333-33',
    'Medico',
    'CRM54321',
    'Clínico Geral',
    'medico@hospital.com',
    '123456'
)
ON CONFLICT DO NOTHING;

-- ATENDIMENTO

INSERT INTO atendimento (
    numero_atendimento,
    id_paciente,
    id_recepcionista,
    status
)
SELECT 'AT0001', p.id_paciente, r.id_profissional, 'AGUARDANDO_MEDICO'
FROM paciente p, profissional r
WHERE p.cpf = '123.456.789-00'
  AND r.email = 'recepcao@hospital.com'
ON CONFLICT DO NOTHING;

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
SELECT a.id_atendimento, e.id_profissional, '12x8', 36.8, 78,
       'Dor de cabeça persistente', 'VERDE'
FROM atendimento a, profissional e
WHERE a.numero_atendimento = 'AT0001'
  AND e.email = 'enfermagem@hospital.com'
ON CONFLICT DO NOTHING;

-- ATENDIMENTO MÉDICO

INSERT INTO atendimento_medico (
    id_atendimento,
    id_medico,
    diagnostico,
    medicacoes_prescritas,
    observacoes
)
SELECT a.id_atendimento, m.id_profissional,
       'Cefaleia tensional',
       'Dipirona 500mg de 6 em 6 horas',
       'Paciente orientado a retornar caso os sintomas persistam'
FROM atendimento a, profissional m
WHERE a.numero_atendimento = 'AT0001'
  AND m.email = 'medico@hospital.com'
ON CONFLICT DO NOTHING;
