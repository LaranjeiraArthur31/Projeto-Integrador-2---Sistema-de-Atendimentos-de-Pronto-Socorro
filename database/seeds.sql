USE BD240226119;

INSERT INTO hospitacao_paciente (
    nome_completo,
    cpf,
    cartao_sus,
    data_nascimento,
    sexo,
    telefone,
    endereco,
    email,
    senha_hash
) VALUES (
    'Maria da Silva',
    '123.456.789-00',
    '123456789012345',
    '1990-05-10',
    'F',
    '(11) 99999-0001',
    'Rua A, 100',
    'maria@email.com',
    'hash_demo'
);

INSERT INTO hospitacao_prontuario (
    id_paciente,
    data_abertura,
    tipo_sanguineo,
    alergias,
    doencas_cronicas,
    medicamentos_em_uso
) VALUES (
    1,
    '2026-10-01',
    'O+',
    'Nenhuma',
    'Hipertensão',
    'Losartana'
);

INSERT INTO hospitacao_profissional (
    nome_completo,
    cpf,
    cargo,
    registro_conselho,
    especialidade,
    perfil_acesso,
    email,
    senha_hash,
    ativo
) VALUES (
    'Dr. Carlos Santos',
    '987.654.321-11',
    'Médico',
    'CRM-12345',
    'Clínica Geral',
    'medico',
    'carlos@hospital.com',
    'hash_demo',
    TRUE
);

INSERT INTO hospitacao_atendimento (
    cod_atendimento,
    id_paciente,
    id_prontuario,
    id_profissional,
    canal_entrada,
    queixa_principal,
    status
) VALUES (
    'AT0001',
    1,
    1,
    1,
    'presencial',
    'Dor abdominal intensa',
    'aguardando_triagem'
);

INSERT INTO hospitacao_triagem (
    id_atendimento,
    id_profissional,
    data_hora_triagem,
    pressao_arterial,
    temperatura,
    frequencia_cardiaca,
    saturacao_o2,
    peso,
    classificacao_risco,
    observacoes
) VALUES (
    1,
    1,
    '2026-10-01 08:15:00',
    '120/80',
    36.8,
    78,
    98,
    68.5,
    'verde',
    'Paciente estável.'
);

