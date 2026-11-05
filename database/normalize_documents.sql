-- Normalização segura e idempotente para o esquema atual.
-- Rejeita valores ambíguos em vez de descartá-los ou inventar UF.
BEGIN;

LOCK TABLE paciente, profissional IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
    invalid_rows TEXT;
BEGIN
    SELECT string_agg(format('paciente %s: CPF "%s"', id_paciente, cpf), '; ')
      INTO invalid_rows
      FROM paciente
     WHERE regexp_replace(cpf, '[0-9.[:space:]-]', '', 'g') <> ''
        OR length(regexp_replace(cpf, '[^0-9]', '', 'g')) <> 11;
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'CPF não pode ser normalizado sem revisão manual: %', invalid_rows;
    END IF;

    SELECT string_agg(format('profissional %s: CPF "%s"', id_profissional, cpf), '; ')
      INTO invalid_rows
      FROM profissional
     WHERE regexp_replace(cpf, '[0-9.[:space:]-]', '', 'g') <> ''
        OR length(regexp_replace(cpf, '[^0-9]', '', 'g')) <> 11;
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'CPF não pode ser normalizado sem revisão manual: %', invalid_rows;
    END IF;

    SELECT string_agg(format('paciente %s: RG "%s"', id_paciente, rg), '; ')
      INTO invalid_rows
      FROM paciente
     WHERE regexp_replace(upper(rg), '[0-9X.[:space:]-]', '', 'g') <> ''
        OR regexp_replace(upper(regexp_replace(rg, '[^0-9Xx]', '', 'g')),
                          '^([0-9]{8,9}|[0-9]{7,8}X)$', '') <> '';
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'RG não pode ser normalizado sem revisão manual: %', invalid_rows;
    END IF;

    WITH council AS (
        SELECT id_profissional, cargo, registro_conselho,
               upper(trim(registro_conselho)) AS source,
               regexp_replace(
                   regexp_replace(upper(trim(registro_conselho)), '^(CRM|COREN)[[:space:]]*', ''),
                   '[/ .-]', '', 'g'
               ) AS normalized
          FROM profissional
         WHERE registro_conselho IS NOT NULL
    )
    SELECT string_agg(format('profissional %s (%s): registro "%s"',
                             id_profissional, cargo, registro_conselho), '; ')
      INTO invalid_rows
      FROM council
     WHERE regexp_replace(source, '[0-9A-Z/ .-]', '', 'g') <> ''
        OR normalized !~ '^[0-9]{6}(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
        OR (cargo = 'Medico' AND source ~ '^[[:space:]]*COREN')
        OR (cargo = 'Enfermeiro' AND source ~ '^[[:space:]]*CRM')
        OR cargo NOT IN ('Medico', 'Enfermeiro');
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'Registro CRM/COREN sem seis dígitos e UF válida; corrija os valores antes da migração: %',
            invalid_rows;
    END IF;

    SELECT string_agg(format('CPF normalizado %s (%s e %s)', normalized, ids[1], ids[2]), '; ')
      INTO invalid_rows
      FROM (
          SELECT regexp_replace(cpf, '[^0-9]', '', 'g') AS normalized,
                 array_agg(id_paciente ORDER BY id_paciente) AS ids
            FROM paciente
           GROUP BY regexp_replace(cpf, '[^0-9]', '', 'g')
          HAVING count(*) > 1
      ) duplicates;
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'CPFs duplicados após remover as máscaras; resolva antes da normalização: %',
            invalid_rows;
    END IF;

    SELECT string_agg(format('CPF normalizado %s (%s e %s)', normalized, ids[1], ids[2]), '; ')
      INTO invalid_rows
      FROM (
          SELECT regexp_replace(cpf, '[^0-9]', '', 'g') AS normalized,
                 array_agg(id_profissional ORDER BY id_profissional) AS ids
            FROM profissional
           GROUP BY regexp_replace(cpf, '[^0-9]', '', 'g')
          HAVING count(*) > 1
      ) duplicates;
    IF invalid_rows IS NOT NULL THEN
        RAISE EXCEPTION 'CPFs duplicados após remover as máscaras; resolva antes da normalização: %',
            invalid_rows;
    END IF;
END $$;

UPDATE paciente
   SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g'),
       rg = upper(regexp_replace(rg, '[^0-9Xx]', '', 'g'));

UPDATE profissional
   SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g'),
       registro_conselho = CASE
           WHEN registro_conselho IS NULL THEN NULL
           ELSE regexp_replace(
               regexp_replace(upper(trim(registro_conselho)), '^(CRM|COREN)[[:space:]]*', ''),
               '[/ .-]', '', 'g'
           )
       END;

COMMIT;
