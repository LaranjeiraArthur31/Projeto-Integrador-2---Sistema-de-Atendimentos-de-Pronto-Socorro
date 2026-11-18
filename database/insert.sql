SET client_encoding = 'UTF8';

-- insere dados de teste, se não existirem. Não insere duplicados (CPF, email, CRM/COREN)
-- numero do atendimento segue a partir do ultimo ID de atendimento (AT0001 = id 1, AT0002 = id 2, etc.)

-- PACIENTES

INSERT INTO paciente (
    nome_completo, cpf, rg, nome_mae, nome_pai, data_nascimento, sexo, telefone, endereco, email
)
SELECT v.* FROM (VALUES
('João da Silva', '123.456.789-00', '12345678', 'Maria da Silva', 'José da Silva',
 '1990-05-15'::date, 'M', '(19)99999-1111', 'Rua A, 100', 'joao@email.com'),
('Ana Souza', '987.654.321-00', '87654321', 'Paula Souza', 'Carlos Souza',
 '1985-10-20', 'F', '(19)99999-2222', 'Rua B, 200', 'ana@email.com'),
('Sebastião Simões Neto', '789.123.456-00', '78912345', 'Conceição Simões', 'Sebastião Simões Filho',
 '1949-04-18', 'M', '(19)99999-3333', 'Rua São Benedito, 12', NULL),
('Antônio Gonçalves Pereira', '321.654.987-00', '32165498', 'Luíza Gonçalves', NULL,
 '1958-02-11', 'M', '(19)99999-4444', 'Avenida Brasil, 850', NULL),
('Lúcia Helena Araújo', '456.789.123-00', '45678912', 'Irene Araújo', 'Mário Araújo',
 '2001-07-30', 'F', '(19)99999-5555', 'Rua Conceição, 301', 'lucia@email.com'),
('Márcia Conceição Ribeiro', '654.321.987-00', '65432198', 'Inês Ribeiro', NULL,
 '1972-12-03', 'F', '(19)99999-6666', 'Rua José Paulino, 77', NULL)
) AS v(nome_completo, cpf, rg, nome_mae, nome_pai, data_nascimento, sexo, telefone, endereco, email)
WHERE NOT EXISTS (SELECT 1 FROM paciente p WHERE p.cpf = v.cpf);

-- PROFISSIONAIS 

INSERT INTO profissional (
    nome_completo, cpf, cargo, email, senha
)
SELECT v.* FROM (VALUES
('Lucas Almeida', '111.111.111-11', 'Recepcionista', 'recepcao@hospital.com', '123456'),
('Fernanda Costa', '222.222.222-22', 'Enfermeiro', 'enfermagem@hospital.com', '123456'),
('Ricardo Oliveira', '333.333.333-33', 'Medico', 'medico@hospital.com', '123456')
) AS v(nome_completo, cpf, cargo, email, senha)
WHERE NOT EXISTS (SELECT 1 FROM profissional x WHERE x.cpf = v.cpf OR x.email = v.email);

-- ENFERMEIROS 

INSERT INTO enfermeiro (id_profissional, coren, uf_coren)
SELECT p.id_profissional, v.coren, v.uf
FROM (VALUES
    ('enfermagem@hospital.com', '12345', 'SP')
) AS v(email, coren, uf)
JOIN profissional p ON p.email = v.email
WHERE NOT EXISTS (
    SELECT 1 FROM enfermeiro e
    WHERE e.id_profissional = p.id_profissional
       OR (e.coren = v.coren AND e.uf_coren = v.uf)
);

-- MÉDICOS 

INSERT INTO medico (id_profissional, crm, uf_crm, especialidade)
SELECT p.id_profissional, v.crm, v.uf, v.especialidade
FROM (VALUES
    ('medico@hospital.com', '54321', 'SP', 'Clínico Geral')
) AS v(email, crm, uf, especialidade)
JOIN profissional p ON p.email = v.email
WHERE NOT EXISTS (
    SELECT 1 FROM medico m
    WHERE m.id_profissional = p.id_profissional
       OR (m.crm = v.crm AND m.uf_crm = v.uf)
);

-- ATENDIMENTOS (horário de chegada relativo ao momento do setup)

INSERT INTO atendimento (id_atendimento, numero_atendimento, id_paciente, id_recepcionista, data_hora_chegada, status)
OVERRIDING SYSTEM VALUE
SELECT substring(v.numero FROM 3)::int, v.numero, p.id_paciente, r.id_profissional,
       CURRENT_TIMESTAMP - v.minutos * INTERVAL '1 minute', v.status
FROM (VALUES
    ('AT0001', '123.456.789-00', 110, 'AGUARDANDO_MEDICO'),
    ('AT0002', '789.123.456-00', 100, 'FINALIZADO'),
    ('AT0003', '321.654.987-00',  70, 'AGUARDANDO_MEDICO'),
    ('AT0004', '456.789.123-00',  50, 'AGUARDANDO_MEDICO'),
    ('AT0005', '987.654.321-00',  25, 'AGUARDANDO_MEDICO'),
    ('AT0006', '654.321.987-00',  10, 'AGUARDANDO_TRIAGEM')
) AS v(numero, cpf, minutos, status)
JOIN paciente p ON p.cpf = v.cpf
JOIN profissional r ON r.email = 'recepcao@hospital.com'
WHERE NOT EXISTS (
    SELECT 1 FROM atendimento a
    WHERE a.numero_atendimento = v.numero
       OR a.id_atendimento = substring(v.numero FROM 3)::int
);

-- TRIAGENS (AT0006 ainda aguarda triagem)
-- id_enfermeiro referencia a tabela enfermeiro.

INSERT INTO triagem (
    id_atendimento, id_enfermeiro, data_hora_triagem, pressao_arterial, temperatura,
    frequencia_cardiaca, queixa_principal, classificacao_manchester
)
SELECT a.id_atendimento, e.id_profissional, a.data_hora_chegada + INTERVAL '8 minutes',
       v.pa, v.temp, v.bpm, v.queixa, v.cor
FROM (VALUES
    ('AT0001', '120/80', 36.8,  78, 'Dor de cabeça persistente', 'VERDE'),
    ('AT0002', '130/80', 36.4,  88, 'Corte no dedo da mão esquerda com sangramento controlado', 'VERDE'),
    ('AT0003', '110/70', 39.1, 104, 'Febre alta e vômitos desde ontem', 'AMARELO'),
    ('AT0004', '118/76', 36.6,  80, 'Tosse leve há uma semana, sem febre', 'AZUL'),
    ('AT0005', '90/60',  36.9, 124, 'Dor no peito intensa, suor frio e falta de ar', 'VERMELHO')
) AS v(numero, pa, temp, bpm, queixa, cor)
JOIN atendimento a ON a.numero_atendimento = v.numero
JOIN profissional p ON p.email = 'enfermagem@hospital.com'
JOIN enfermeiro e ON e.id_profissional = p.id_profissional
WHERE NOT EXISTS (SELECT 1 FROM triagem t WHERE t.id_atendimento = a.id_atendimento);

-- ATENDIMENTO MÉDICO (somente o atendimento finalizado)

DELETE FROM atendimento_medico am
USING triagem t, atendimento a
WHERE am.id_triagem = t.id_triagem
  AND t.id_atendimento = a.id_atendimento
  AND a.numero_atendimento = 'AT0001'
  AND a.status = 'AGUARDANDO_MEDICO';

INSERT INTO atendimento_medico (
    id_triagem, id_medico, data_hora_inicio, data_hora_fim,
    diagnostico, medicacoes_prescritas, observacoes
)
SELECT t.id_triagem, m.id_profissional,
       a.data_hora_chegada + INTERVAL '40 minutes',
       a.data_hora_chegada + INTERVAL '65 minutes',
       'Ferimento cortante superficial no dedo indicador esquerdo',
       'Sutura com 3 pontos; paracetamol 750 mg de 6 em 6 horas, se dor',
       'Retirar os pontos em 7 dias na unidade básica de saúde.'
FROM atendimento a
JOIN triagem t ON t.id_atendimento = a.id_atendimento
JOIN profissional p ON p.email = 'medico@hospital.com'
JOIN medico m ON m.id_profissional = p.id_profissional
WHERE a.numero_atendimento = 'AT0002'
  AND NOT EXISTS (SELECT 1 FROM atendimento_medico x WHERE x.id_triagem = t.id_triagem);

-- AJUSTE DAS SEQUÊNCIAS: o próximo ID de cada tabela passa a ser (maior ID + 1)

SELECT setval(pg_get_serial_sequence('paciente', 'id_paciente'),
              COALESCE((SELECT MAX(id_paciente) FROM paciente), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('profissional', 'id_profissional'),
              COALESCE((SELECT MAX(id_profissional) FROM profissional), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('atendimento', 'id_atendimento'),
              COALESCE((SELECT MAX(id_atendimento) FROM atendimento), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('triagem', 'id_triagem'),
              COALESCE((SELECT MAX(id_triagem) FROM triagem), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('atendimento_medico', 'id_atendimento_medico'),
              COALESCE((SELECT MAX(id_atendimento_medico) FROM atendimento_medico), 0) + 1, false);
