// C) Regras do fluxo de atendimento.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, ambienteDoTeste, atender, criarAtendimento, dadosMedico, dadosPaciente, dadosTriagem,
  esperarStatus, statusNoBanco, triar
} from '../helpers/ambiente.js';
import { renderizarPainel } from '../helpers/navegador.js';

const opcoes = { skip: SEM_BANCO };

test('números de atendimento seguem AT0007, AT0008, AT0009 sem repetir', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const numeros = [];
  for (let i = 0; i < 3; i++) numeros.push((await criarAtendimento(recepcao)).id);
  assert.deepEqual(numeros, ['AT0007', 'AT0008', 'AT0009'], 'a sequência deveria continuar depois dos dados de demonstração');
  const novo = await criarAtendimento(recepcao);
  assert.equal(novo.status, 'aguardando-triagem', 'atendimento novo deveria aguardar triagem');
  assert.equal(novo.triagem, null);
  assert.equal(novo.medico, null);
});

test('cancelar não libera o número: o próximo continua a sequência', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const primeiro = await criarAtendimento(recepcao);
  esperarStatus(await recepcao.delete(`/atendimentos/${primeiro.id}`), 204);
  const segundo = await criarAtendimento(recepcao);
  assert.equal(primeiro.id, 'AT0007');
  assert.equal(segundo.id, 'AT0008', 'número de atendimento cancelado não pode ser reutilizado');
});

test('10 criações simultâneas geram 10 números únicos e consecutivos', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const respostas = await Promise.all(Array.from({ length: 10 }, () => recepcao.post('/atendimentos', dadosPaciente())));
  respostas.forEach((r, i) => esperarStatus(r, 201, `criação simultânea ${i + 1}`));
  const numeros = respostas.map((r) => r.dados.id).sort();
  assert.equal(new Set(numeros).size, 10, `números repetidos: ${numeros.join(', ')}`);
  const esperados = Array.from({ length: 10 }, (_, i) => `AT${String(i + 7).padStart(4, '0')}`);
  assert.deepEqual(numeros, esperados, 'os números deveriam ser AT0007 a AT0016');
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM atendimento WHERE numero_atendimento !~ '^AT[0-9]{4,}$'");
  assert.equal(rows[0].n, 0, 'nenhum atendimento pode ficar com o número provisório');
});

test('fluxo completo: recepção → triagem → médico (em atendimento) → alta', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem, medico] = [await amb.recepcao(), await amb.enfermagem(), await amb.medico()];
  const { id } = await criarAtendimento(recepcao);
  const triado = await triar(enfermagem, id, { classificacao: 'laranja' });
  assert.equal(triado.status, 'aguardando-medico');
  assert.equal(triado.triagem.classificacao, 'laranja');
  assert.equal(triado.triagem.id_profissional, 2, 'a triagem deveria ficar no nome da enfermeira logada');
  const emAtendimento = await atender(medico, id, 'em-atendimento');
  assert.equal(emAtendimento.status, 'em-atendimento');
  const alta = await atender(medico, id, 'confirmado', { diagnostico: 'Final' });
  assert.equal(alta.status, 'confirmado');
  assert.equal(alta.medico.diagnostico, 'Final');
  const { rows } = await amb.query(
    'SELECT am.data_hora_fim FROM atendimento_medico am JOIN atendimento a USING (id_atendimento) WHERE a.numero_atendimento = $1', [id]
  );
  assert.ok(rows[0].data_hora_fim, 'a alta deveria registrar data_hora_fim');
});

test('não é possível triar atendimento já triado, finalizado ou cancelado', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem] = [await amb.recepcao(), await amb.enfermagem()];
  esperarStatus(await recepcao.delete('/atendimentos/AT0006'), 204, 'cancelar AT0006');
  const corpo = { status: 'aguardando-medico', triagem: dadosTriagem({ classificacao: 'vermelho' }) };
  for (const [codigo, situacao] of [['AT0001', 'já triado'], ['AT0002', 'finalizado'], ['AT0006', 'cancelado']]) {
    esperarStatus(await enfermagem.put(`/atendimentos/${codigo}`, corpo), 400, `triagem de atendimento ${situacao} (${codigo})`);
  }
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM triagem WHERE classificacao_manchester = 'VERMELHO'");
  assert.equal(rows[0].n, 1, 'só o AT0005 deveria continuar vermelho');
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'CANCELADO');
});

test('a triagem precisa encaminhar ao médico e trazer os dados da triagem', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const enfermagem = await amb.enfermagem();
  for (const corpo of [
    { status: 'aguardando-medico' },
    { status: 'em-atendimento', triagem: dadosTriagem() },
    { status: 'confirmado', triagem: dadosTriagem() },
    { status: 'cancelado', triagem: dadosTriagem() },
    { triagem: dadosTriagem() }
  ]) {
    esperarStatus(await enfermagem.put('/atendimentos/AT0006', corpo), 400, `triagem com ${JSON.stringify(Object.keys(corpo))} e status ${corpo.status}`);
  }
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'AGUARDANDO_TRIAGEM');
});

test('o médico não atende sem triagem nem com status inválido', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const medico = await amb.medico();
  esperarStatus(await medico.put('/atendimentos/AT0006', { status: 'confirmado', medico: dadosMedico() }), 400, 'alta sem triagem (AT0006)');
  esperarStatus(await medico.put('/atendimentos/AT0006', { status: 'em-atendimento', medico: dadosMedico() }), 400, 'consulta sem triagem (AT0006)');
  esperarStatus(await medico.put('/atendimentos/AT0001', { status: 'cancelado', medico: dadosMedico() }), 400, 'médico cancelando');
  esperarStatus(await medico.put('/atendimentos/AT0001', { status: 'aguardando-triagem', medico: dadosMedico() }), 400, 'médico voltando para triagem');
  esperarStatus(await medico.put('/atendimentos/AT0001', { status: 'confirmado' }), 400, 'alta sem dados médicos');
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'AGUARDANDO_TRIAGEM');
  assert.equal(await statusNoBanco(amb, 'AT0001'), 'AGUARDANDO_MEDICO');
  const { rows } = await amb.query('SELECT COUNT(*)::int AS n FROM atendimento_medico');
  assert.equal(rows[0].n, 1, 'nenhuma consulta nova deveria ter sido gravada');
});

test('atendimentos finalizados e cancelados não podem ser alterados por ninguém', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem, medico] = [await amb.recepcao(), await amb.enfermagem(), await amb.medico()];
  esperarStatus(await recepcao.delete('/atendimentos/AT0001'), 204, 'cancelar AT0001');
  for (const codigo of ['AT0002', 'AT0001']) {
    esperarStatus(await recepcao.put(`/atendimentos/${codigo}`, { nome: 'Alterado' }), 400, `recepção alterando ${codigo}`);
    esperarStatus(await enfermagem.put(`/atendimentos/${codigo}`, { status: 'aguardando-medico', triagem: dadosTriagem() }), 400, `enfermagem alterando ${codigo}`);
    esperarStatus(await medico.put(`/atendimentos/${codigo}`, { status: 'confirmado', medico: dadosMedico() }), 400, `médico alterando ${codigo}`);
  }
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM paciente WHERE nome_completo = 'Alterado'");
  assert.equal(rows[0].n, 0);
  assert.equal(await statusNoBanco(amb, 'AT0002'), 'FINALIZADO');
  assert.equal(await statusNoBanco(amb, 'AT0001'), 'CANCELADO');
});

test('cancelar atendimento finalizado falha e não muda o status', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const resposta = esperarStatus(await recepcao.delete('/atendimentos/AT0002'), 400, 'cancelar AT0002 finalizado');
  assert.match(resposta.erro, /não podem ser cancelados/);
  assert.equal(await statusNoBanco(amb, 'AT0002'), 'FINALIZADO');
});

test('cancelar funciona em aguardando triagem, aguardando médico e em atendimento', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, medico] = [await amb.recepcao(), await amb.medico()];
  await atender(medico, 'AT0003', 'em-atendimento');
  for (const [codigo, situacao] of [['AT0006', 'aguardando triagem'], ['AT0001', 'aguardando médico'], ['AT0003', 'em atendimento']]) {
    esperarStatus(await recepcao.delete(`/atendimentos/${codigo}`), 204, `cancelar ${situacao} (${codigo})`);
    assert.equal(await statusNoBanco(amb, codigo), 'CANCELADO', `${codigo} deveria ficar cancelado`);
    const consulta = esperarStatus(await recepcao.get(`/atendimentos/${codigo}`), 200).dados;
    assert.equal(consulta.status, 'cancelado');
  }
});

test('atendimento inexistente devolve 404 em consultar, alterar e cancelar', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  esperarStatus(await recepcao.get('/atendimentos/AT9999'), 404, 'GET inexistente');
  esperarStatus(await recepcao.put('/atendimentos/AT9999', { nome: 'X' }), 404, 'PUT inexistente');
  esperarStatus(await recepcao.delete('/atendimentos/AT9999'), 404, 'DELETE inexistente');
});

test('a recepção edita o paciente enquanto o atendimento não termina, sem perder a triagem', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, medico] = [await amb.recepcao(), await amb.medico()];
  const editado = esperarStatus(await recepcao.put('/atendimentos/AT0001', { telefone: '(19) 4000-1234', nome: 'João da Silva Júnior' }), 200, 'editar AT0001 aguardando médico').dados;
  assert.equal(editado.nome, 'João da Silva Júnior');
  assert.equal(editado.telefone, '(19) 4000-1234');
  assert.equal(editado.status, 'aguardando-medico', 'editar o paciente não pode mudar o status');
  assert.equal(editado.triagem?.classificacao, 'verde', 'editar o paciente não pode apagar a triagem');
  assert.equal(editado.cpf, '123.456.789-00', 'campos não enviados continuam iguais');
  esperarStatus(await recepcao.put('/atendimentos/AT0006', { endereco: 'Rua Nova, 1' }), 200, 'editar AT0006 aguardando triagem');
  await atender(medico, 'AT0003', 'em-atendimento');
  const emAtendimento = esperarStatus(await recepcao.put('/atendimentos/AT0003', { telefone: '(19) 5000-0000' }), 200, 'editar AT0003 em atendimento').dados;
  assert.equal(emAtendimento.status, 'em-atendimento');
  assert.equal(emAtendimento.medico?.medicacoes, dadosMedico().medicacoes, 'editar o paciente não pode apagar a consulta');
});

test('painel: só aguardando médico e em atendimento, por cor (vermelho → azul) e por chegada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const [recepcao, enfermagem, medico] = [await amb.recepcao(), await amb.enfermagem(), await amb.medico()];
  const novos = {};
  for (const [nome, cor] of [['vermelho2', 'vermelho'], ['laranja', 'laranja'], ['verde2', 'verde'], ['finalizado', 'vermelho'], ['cancelado', 'vermelho']]) {
    const { id } = await criarAtendimento(recepcao, { nome });
    await triar(enfermagem, id, { classificacao: cor });
    novos[nome] = id;
  }
  await atender(medico, novos.verde2, 'em-atendimento');
  await atender(medico, novos.finalizado, 'confirmado');
  esperarStatus(await recepcao.delete(`/atendimentos/${novos.cancelado}`), 204);
  await criarAtendimento(recepcao, { nome: 'sem triagem' });
  // Horários de chegada fixos (minutos atrás), para a ordem dentro da cor ser determinística.
  const chegada = {
    AT0001: 110, AT0003: 70, AT0004: 50, AT0005: 25,
    [novos.vermelho2]: 20, [novos.laranja]: 5, [novos.verde2]: 1
  };
  for (const [codigo, minutos] of Object.entries(chegada)) {
    await amb.query("UPDATE atendimento SET data_hora_chegada = CURRENT_TIMESTAMP - $1 * INTERVAL '1 minute' WHERE numero_atendimento = $2", [minutos, codigo]);
  }
  const lista = esperarStatus(await medico.get('/atendimentos'), 200).dados;
  const ordem = renderizarPainel(lista).map((item) => item.codigo);
  assert.deepEqual(ordem, ['AT0005', novos.vermelho2, novos.laranja, 'AT0003', 'AT0001', novos.verde2, 'AT0004'],
    'ordem esperada: vermelhos (por chegada), laranja, amarelo, verdes (por chegada), azul');
});

test('status desconhecido no PUT é recusado com 400', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const medico = await amb.medico();
  for (const status of ['FINALIZADO', 'alta', '', null, 1]) {
    esperarStatus(await medico.put('/atendimentos/AT0001', { status, medico: dadosMedico() }), 400, `status ${JSON.stringify(status)}`);
  }
});
