-- Rollback das restrições e larguras da migration de documentos.
-- Os documentos permanecem normalizados: sua pontuação original não é recuperável.
BEGIN;

ALTER TABLE paciente
    DROP CONSTRAINT ck_paciente_cpf_format,
    DROP CONSTRAINT ck_paciente_rg_format,
    ALTER COLUMN cpf TYPE VARCHAR(14),
    ALTER COLUMN rg TYPE VARCHAR(20);

ALTER TABLE profissional
    DROP CONSTRAINT ck_profissional_cpf_format,
    DROP CONSTRAINT ck_profissional_registro_format,
    ALTER COLUMN cpf TYPE VARCHAR(14),
    ALTER COLUMN registro_conselho TYPE VARCHAR(20);

COMMIT;
