// G) Banco: restrições do esquema e idempotência do schema.sql, do insert.sql e do npm run setup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  SEM_BANCO, ambienteDoTeste, contar, criarAtendimento, criarEsquema, esperarStatus, lerSql, subirApi
} from '../helpers/ambiente.js';
import { RAIZ, envDoBanco, executar } from '../helpers/processo.js';

const opcoes = { skip: SEM_BANCO };
const TABELAS = { paciente: 6, profissional: 3, atendimento: 6, triagem: 5, atendimento_medico: 1 };

async function esperarErroSql(promessa, codigo, contexto) {
  await assert.rejects(promessa, (error) => {
    assert.equal(error.code, codigo, `${contexto}: esperado erro ${codigo} do PostgreSQL, recebido ${error.code} (${error.message})`);
    return true;
  }, `${contexto}: o banco deveria ter recusado a operação`);
}

async function conferirContagens(esquema, contexto) {
  for (const [tabela, esperado] of Object.entries(TABELAS)) {
    assert.equal(await contar(esquema, tabela), esperado, `${contexto}: a tabela ${tabela} deveria ter ${esperado} linhas`);
  }
}

// O próximo atendimento criado pela API deve ser AT0007 (sem pular número).
async function conferirProximoNumero(esquema, contexto) {
  const amb = await subirApi(esquema);
  try {
    const criado = await criarAtendimento(await amb.recepcao());
    assert.equal(criado.id, 'AT0007', `${contexto}: o próximo atendimento deveria ser AT0007, veio ${criado.id}`);
  } finally {
    await amb.fechar();
  }
}

test('CPF de paciente e de profissional é único no banco', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  await esperarErroSql(amb.query(`INSERT INTO paciente (nome_completo, cpf, rg, nome_mae, data_nascimento, sexo)
    VALUES ('Outro', '123.456.789-00', '1', 'M', '2000-01-01', 'M')`), '23505', 'paciente com CPF repetido');
  await esperarErroSql(amb.query(`INSERT INTO profissional (nome_completo, cpf, cargo, email, senha)
    VALUES ('Outro', '111.111.111-11', 'Medico', 'outro@x.com', 'x')`), '23505', 'profissional com CPF repetido');
  await esperarErroSql(amb.query(`INSERT INTO profissional (nome_completo, cpf, cargo, email, senha)
    VALUES ('Outro', '999.111.111-11', 'Medico', 'medico@hospital.com', 'x')`), '23505', 'profissional com email repetido');
  await esperarErroSql(amb.query(`INSERT INTO atendimento (numero_atendimento, id_paciente, id_recepcionista)
    VALUES ('AT0001', 1, 1)`), '23505', 'número de atendimento repetido');
  await esperarErroSql(amb.query(`INSERT INTO triagem (id_atendimento, id_enfermeiro, queixa_principal, classificacao_manchester)
    VALUES (1, 2, 'x', 'VERDE')`), '23505', 'segunda triagem no mesmo atendimento');
});

test('ON DELETE RESTRICT: não apaga paciente nem profissional com atendimentos', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  await esperarErroSql(amb.query('DELETE FROM paciente WHERE id_paciente = 1'), '23503', 'apagar paciente com atendimento');
  await esperarErroSql(amb.query('DELETE FROM profissional WHERE id_profissional = 1'), '23503', 'apagar recepcionista com atendimentos');
  await esperarErroSql(amb.query('DELETE FROM profissional WHERE id_profissional = 3'), '23503', 'apagar médico com consulta');
  await esperarErroSql(amb.query('DELETE FROM atendimento WHERE id_atendimento = 1'), '23503', 'apagar atendimento triado');
  await esperarErroSql(amb.query(`INSERT INTO atendimento (numero_atendimento, id_paciente, id_recepcionista)
    VALUES ('AT9999', 999, 1)`), '23503', 'atendimento com paciente inexistente');

  const resposta = await (await amb.recepcao()).delete('/pacientes/1');
  esperarStatus(resposta, 409, 'DELETE /pacientes/1 com atendimento vinculado');
  assert.equal(await contar(amb, 'paciente'), 6, 'o paciente não pode ter sido apagado');
});

test('CHECK: status, classificação, sexo e cargo só aceitam os valores previstos', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  await esperarErroSql(amb.query("UPDATE atendimento SET status = 'PERDIDO' WHERE id_atendimento = 6"), '23514', 'status inválido');
  await esperarErroSql(amb.query("UPDATE atendimento SET status = 'finalizado' WHERE id_atendimento = 6"), '23514', 'status em minúsculas');
  await esperarErroSql(amb.query("UPDATE triagem SET classificacao_manchester = 'ROXO' WHERE id_atendimento = 1"), '23514', 'classificação inválida');
  await esperarErroSql(amb.query("UPDATE paciente SET sexo = 'X' WHERE id_paciente = 1"), '23514', 'sexo inválido');
  await esperarErroSql(amb.query("UPDATE profissional SET cargo = 'Admin' WHERE id_profissional = 1"), '23514', 'cargo inválido');
});

test('NOT NULL: campos obrigatórios não aceitam nulo', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const coluna of ['nome_completo', 'cpf', 'rg', 'nome_mae', 'data_nascimento', 'sexo']) {
    await esperarErroSql(amb.query(`UPDATE paciente SET ${coluna} = NULL WHERE id_paciente = 1`), '23502', `paciente.${coluna} nulo`);
  }
  for (const coluna of ['nome_completo', 'cpf', 'cargo', 'email', 'senha', 'ativo']) {
    await esperarErroSql(amb.query(`UPDATE profissional SET ${coluna} = NULL WHERE id_profissional = 1`), '23502', `profissional.${coluna} nulo`);
  }
  await esperarErroSql(amb.query('UPDATE atendimento SET status = NULL WHERE id_atendimento = 6'), '23502', 'atendimento.status nulo');
  await esperarErroSql(amb.query('UPDATE triagem SET queixa_principal = NULL WHERE id_atendimento = 1'), '23502', 'triagem.queixa_principal nula');
  await esperarErroSql(amb.query('UPDATE triagem SET classificacao_manchester = NULL WHERE id_atendimento = 1'), '23502', 'triagem.classificacao nula');
});

test('schema.sql e insert.sql aplicados de novo não duplicam nem pulam números', opcoes, async (t) => {
  const esquema = await criarEsquema();
  let removido = false;
  t.after(() => removido || esquema.remover());
  await conferirContagens(esquema, 'após a primeira carga');
  for (let vez = 2; vez <= 3; vez += 1) {
    await esquema.query(await lerSql('schema.sql'));
    await esquema.query(await lerSql('insert.sql'));
    await conferirContagens(esquema, `após aplicar os scripts pela ${vez}ª vez`);
  }
  removido = true;
  await conferirProximoNumero(esquema, 'após aplicar os scripts 3 vezes');
});

test('npm run setup pode rodar duas vezes no mesmo banco sem duplicar dados', { ...opcoes, timeout: 60_000 }, async (t) => {
  const esquema = await criarEsquema({ tabelas: false });
  let removido = false;
  t.after(() => removido || esquema.remover());

  // O setup cria o .env se não existir; nesse caso o arquivo criado é apagado no final.
  const arquivoEnv = path.join(RAIZ, '.env');
  const envExistia = await access(arquivoEnv).then(() => true, () => false);
  t.after(async () => { if (!envExistia) await rm(arquivoEnv, { force: true }); });

  const env = envDoBanco({ schema: esquema.schema });
  for (let vez = 1; vez <= 2; vez += 1) {
    const saida = await executar('scripts/setup.js', env, { timeout: 30_000 });
    assert.equal(saida.codigo, 0, `o setup (${vez}ª vez) terminou com código ${saida.codigo}.\n${saida.stderr}`);
    assert.match(saida.stdout, /schema\.sql aplicado/, `o setup (${vez}ª vez) não aplicou o schema.sql`);
    assert.match(saida.stdout, /insert\.sql aplicado/, `o setup (${vez}ª vez) não aplicou o insert.sql`);
    await conferirContagens(esquema, `após o setup rodar ${vez} vez(es)`);
  }
  removido = true;
  await conferirProximoNumero(esquema, 'após o setup rodar 2 vezes');
});
