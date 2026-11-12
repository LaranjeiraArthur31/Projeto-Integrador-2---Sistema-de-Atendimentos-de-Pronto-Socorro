// F) Codificação: acentos, ç, ã, travessão e emoji chegam ao banco e voltam idênticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, ambienteDoTeste, atender, cpfAleatorio, criarAtendimento, emailAleatorio, esperarStatus, triar
} from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };
const TEXTO = 'João Conceição Ação — Ñandú Über çÇãÃõÕéÊ ° º ª “aspas” 😀🏥 𝄞';

test('o banco de testes usa UTF8', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t, { dados: false });
  const { rows } = await amb.query('SELECT current_setting(\'server_encoding\') AS servidor, current_setting(\'client_encoding\') AS cliente');
  assert.equal(rows[0].servidor, 'UTF8');
  assert.equal(rows[0].cliente, 'UTF8');
});

test('paciente, triagem e consulta com acentos e emoji voltam idênticos pela API e pelo banco', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem, medico] = [await amb.recepcao(), await amb.enfermagem(), await amb.medico()];
  const criado = await criarAtendimento(recepcao, { nome: TEXTO.slice(0, 60), mae: 'Mãe Ângela Lúcia', endereco: TEXTO });
  await triar(enfermagem, criado.id, { queixas: TEXTO });
  await atender(medico, criado.id, 'confirmado', { medicacoes: TEXTO, diagnostico: TEXTO, observacoes: TEXTO });

  const api = esperarStatus(await recepcao.get(`/atendimentos/${criado.id}`), 200).dados;
  assert.equal(api.nome, TEXTO.slice(0, 60), 'nome alterado pela API');
  assert.equal(api.mae, 'Mãe Ângela Lúcia');
  assert.equal(api.endereco, TEXTO, 'endereço alterado pela API');
  assert.equal(api.triagem.queixas, TEXTO, 'queixa alterada pela API');
  assert.equal(api.medico.medicacoes, TEXTO);
  assert.equal(api.medico.observacoes, TEXTO);

  const { rows } = await amb.query(`
    SELECT p.nome_completo, p.endereco, t.queixa_principal, m.diagnostico
      FROM atendimento a JOIN paciente p USING (id_paciente)
      JOIN triagem t USING (id_atendimento) JOIN atendimento_medico m USING (id_atendimento)
     WHERE a.numero_atendimento = $1`, [criado.id]);
  assert.equal(rows[0].nome_completo, TEXTO.slice(0, 60), 'nome gravado errado no banco');
  assert.equal(rows[0].endereco, TEXTO, 'endereço gravado errado no banco');
  assert.equal(rows[0].queixa_principal, TEXTO);
  assert.equal(rows[0].diagnostico, TEXTO);
});

test('o limite das colunas conta caracteres, não bytes (100 letras acentuadas cabem no nome)', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const nome = 'ç'.repeat(99) + '😀';
  const criado = await criarAtendimento(recepcao, { nome });
  assert.equal(criado.nome, nome);
});

test('os dados de demonstração com acentos estão corretos no banco e na API', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const lista = esperarStatus(await recepcao.get('/atendimentos'), 200).dados;
  const nomes = lista.map((a) => a.nome);
  for (const nome of ['Sebastião Simões Neto', 'Antônio Gonçalves Pereira', 'Lúcia Helena Araújo', 'Márcia Conceição Ribeiro']) {
    assert.ok(nomes.includes(nome), `nome de demonstração "${nome}" não voltou idêntico`);
  }
  const at3 = lista.find((a) => a.id === 'AT0003');
  assert.equal(at3.triagem.queixas, 'Febre alta e vômitos desde ontem');
});

test('cadastro e login com nome e senha acentuados', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const email = emailAleatorio();
  const senha = 'Coração—çã😀1';
  const criado = esperarStatus(await amb.cliente().post('/auth/cadastro', {
    nome_completo: 'Conceição Araújo — Enfermagem', cpf: cpfAleatorio(), cargo: 'Enfermeiro', email, senha
  }), 201).dados;
  assert.equal(criado.nome_completo, 'Conceição Araújo — Enfermagem');
  const login = esperarStatus(await amb.cliente().post('/auth/login', { email, senha }), 200, 'login com senha acentuada');
  assert.equal(login.dados.nome_completo, 'Conceição Araújo — Enfermagem');
});
