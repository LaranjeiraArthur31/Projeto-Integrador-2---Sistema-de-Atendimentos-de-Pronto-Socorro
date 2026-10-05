ALTER TABLE hospitacao_paciente
    ADD COLUMN IF NOT EXISTS rg VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nome_pai VARCHAR(100),
    ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(100);

ALTER TABLE hospitacao_atendimento
    DROP CONSTRAINT IF EXISTS hospitacao_atendimento_status_check;
ALTER TABLE hospitacao_atendimento
    ADD CONSTRAINT hospitacao_atendimento_status_check
    CHECK (status IN (
        'aguardando_triagem', 'aguardando_atendimento', 'em_atendimento',
        'em_observacao', 'alta', 'internado', 'transferido', 'obito', 'cancelado'
    ));

ALTER TABLE hospitacao_triagem
    DROP CONSTRAINT IF EXISTS hospitacao_triagem_classificacao_risco_check;
ALTER TABLE hospitacao_triagem
    ADD CONSTRAINT hospitacao_triagem_classificacao_risco_check
    CHECK (classificacao_risco IN ('vermelho', 'laranja', 'amarelo', 'verde', 'azul'));
ALTER TABLE hospitacao_triagem
    ALTER COLUMN pressao_arterial TYPE VARCHAR(20);

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
