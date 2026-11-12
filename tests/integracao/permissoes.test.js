// B) Matriz de permissões: rota × cargo × método.
// (As páginas HTML por cargo são testadas em tests/front/paginas.test.js.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, USUARIOS, ambienteDoTeste, criarAtendimento, dadosMedico, dadosPaciente, dadosTriagem,
  esperarStatus, pacienteDireto, statusNoBanco
} from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };
const CARGOS = Object.keys(USUARIOS);

async function clientes(amb) {
  return {
    Anonimo: amb.cliente(),
    Recepcionista: await amb.recepcao(),
    Enfermeiro: await amb.enfermagem(),
    Medico: await amb.medico()
  };
}

// Rotas genéricas: só o cargo dono acessa (GET 200, POST 201, PUT 200, DELETE 204);
// os outros recebem 403; sem login, 401.
const RECURSOS = {
  pacientes: {
    dono: 'Recepcionista',
    novo: () => pacienteDireto(),
    alteracao: { telefone: '(19) 3333-0000' }
  },
  triagens: {
    dono: 'Enfermeiro',
    novo: () => ({ id_atendimento: 6, queixa_principal: 'Teste de permissão', classificacao_manchester: 'VERDE' }),
    alteracao: { queixa_principal: 'Alterada' }
  },
  'atendimentos-medicos': {
    dono: 'Medico',
    novo: () => ({ id_atendimento: 1, diagnostico: 'Teste de permissão' }),
    alteracao: { diagnostico: 'Alterado' }
  }
};

for (const [recurso, config] of Object.entries(RECURSOS)) {
  test(`/${recurso}: ${config.dono} tem acesso total; os outros cargos recebem 403; sem login, 401`, opcoes, async (t) => {
    const amb = await ambienteDoTeste(t);
    const c = await clientes(amb);

    // Cargos sem permissão e anônimo: nenhum método passa, nada é gravado.
    for (const quem of ['Anonimo', ...CARGOS.filter((cargo) => cargo !== config.dono)]) {
      const esperado = quem === 'Anonimo' ? 401 : 403;
      const cliente = c[quem];
      esperarStatus(await cliente.get(`/${recurso}`), esperado, `${quem} GET /${recurso}`);
      esperarStatus(await cliente.get(`/${recurso}/1`), esperado, `${quem} GET /${recurso}/1`);
      esperarStatus(await cliente.post(`/${recurso}`, config.novo()), esperado, `${quem} POST /${recurso}`);
      esperarStatus(await cliente.put(`/${recurso}/1`, config.alteracao), esperado, `${quem} PUT /${recurso}/1`);
      esperarStatus(await cliente.delete(`/${recurso}/1`), esperado, `${quem} DELETE /${recurso}/1`);
    }

    // Cargo dono: ciclo completo.
    const dono = c[config.dono];
    esperarStatus(await dono.get(`/${recurso}`), 200, `${config.dono} GET /${recurso}`);
    const criado = esperarStatus(await dono.post(`/${recurso}`, config.novo()), 201, `${config.dono} POST /${recurso}`).dados;
    const id = Object.values(criado)[0];
    esperarStatus(await dono.get(`/${recurso}/${id}`), 200, `${config.dono} GET /${recurso}/${id}`);
    esperarStatus(await dono.put(`/${recurso}/${id}`, config.alteracao), 200, `${config.dono} PUT /${recurso}/${id}`);
    esperarStatus(await dono.delete(`/${recurso}/${id}`), 204, `${config.dono} DELETE /${recurso}/${id}`);
    esperarStatus(await dono.get(`/${recurso}/${id}`), 404, `${config.dono} GET /${recurso}/${id} após apagar`);
    esperarStatus(await dono.delete(`/${recurso}/${id}`), 404, `${config.dono} DELETE repetido`);
  });
}

test('/triagens e /atendimentos-medicos gravam o profissional logado, não o enviado', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const enfermagem = await amb.enfermagem();
  const triagem = esperarStatus(await enfermagem.post('/triagens', {
    ...RECURSOS.triagens.novo(), id_enfermeiro: USUARIOS.Medico.id
  }), 201).dados;
  assert.equal(triagem.id_enfermeiro, USUARIOS.Enfermeiro.id, 'a triagem deveria ficar no nome de quem está logado');
  const medico = await amb.medico();
  const consulta = esperarStatus(await medico.post('/atendimentos-medicos', {
    ...RECURSOS['atendimentos-medicos'].novo(), id_medico: USUARIOS.Enfermeiro.id
  }), 201).dados;
  assert.equal(consulta.id_medico, USUARIOS.Medico.id, 'a consulta deveria ficar no nome de quem está logado');
});

test('/profissionais: cada cargo vê só o próprio cadastro e não cria, altera ou apaga ninguém', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const c = await clientes(amb);
  esperarStatus(await c.Anonimo.get('/profissionais'), 401, 'anônimo GET /profissionais');
  esperarStatus(await c.Anonimo.post('/profissionais', {}), 401, 'anônimo POST /profissionais');
  for (const cargo of CARGOS) {
    const { id } = USUARIOS[cargo];
    const lista = esperarStatus(await c[cargo].get('/profissionais'), 200, `${cargo} GET /profissionais`).dados;
    assert.deepEqual(lista.map((p) => p.id_profissional), [id], `${cargo} deveria ver apenas a si mesmo`);
    esperarStatus(await c[cargo].get(`/profissionais/${id}`), 200, `${cargo} GET o próprio cadastro`);
    const outro = id === 1 ? 2 : 1;
    esperarStatus(await c[cargo].get(`/profissionais/${outro}`), 403, `${cargo} GET cadastro de outro`);
    esperarStatus(await c[cargo].post('/profissionais', { nome_completo: 'X', cargo: 'Medico' }), 403, `${cargo} POST /profissionais`);
    esperarStatus(await c[cargo].put(`/profissionais/${id}`, { cargo: 'Medico', ativo: true }), 403, `${cargo} PUT o próprio cadastro`);
    esperarStatus(await c[cargo].delete(`/profissionais/${outro}`), 403, `${cargo} DELETE /profissionais`);
  }
  const { rows } = await amb.query('SELECT id_profissional, cargo, ativo FROM profissional ORDER BY 1');
  assert.deepEqual(rows.map((r) => r.cargo), ['Recepcionista', 'Enfermeiro', 'Medico'], 'nenhum cargo pode ter mudado');
});

test('/atendimentos: listar e consultar exigem login; criar e cancelar são só da recepção', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const c = await clientes(amb);
  esperarStatus(await c.Anonimo.get('/atendimentos'), 401, 'anônimo GET /atendimentos');
  esperarStatus(await c.Anonimo.get('/atendimentos/AT0001'), 401, 'anônimo GET /atendimentos/AT0001');
  esperarStatus(await c.Anonimo.post('/atendimentos', dadosPaciente()), 401, 'anônimo POST /atendimentos');
  esperarStatus(await c.Anonimo.put('/atendimentos/AT0001', { nome: 'X' }), 401, 'anônimo PUT /atendimentos');
  esperarStatus(await c.Anonimo.delete('/atendimentos/AT0006'), 401, 'anônimo DELETE /atendimentos');

  for (const cargo of CARGOS) {
    const lista = esperarStatus(await c[cargo].get('/atendimentos'), 200, `${cargo} GET /atendimentos`).dados;
    assert.equal(lista.length, 6, `${cargo} deveria ver os 6 atendimentos de demonstração`);
    esperarStatus(await c[cargo].get('/atendimentos/AT0001'), 200, `${cargo} GET /atendimentos/AT0001`);
  }
  for (const cargo of ['Enfermeiro', 'Medico']) {
    esperarStatus(await c[cargo].post('/atendimentos', dadosPaciente()), 403, `${cargo} POST /atendimentos`);
    esperarStatus(await c[cargo].delete('/atendimentos/AT0006'), 403, `${cargo} DELETE /atendimentos`);
  }
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'AGUARDANDO_TRIAGEM', 'AT0006 não poderia ter sido cancelado');
  esperarStatus(await c.Recepcionista.post('/atendimentos', dadosPaciente()), 201, 'recepção POST /atendimentos');
  esperarStatus(await c.Recepcionista.delete('/atendimentos/AT0006'), 204, 'recepção DELETE /atendimentos/AT0006');
});

test('/atendimentos PUT: cada cargo só altera a sua parte', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const c = await clientes(amb);
  // Recepção: dados do paciente (200). Enfermagem: triagem (200). Médico: consulta (200).
  esperarStatus(await c.Recepcionista.put('/atendimentos/AT0006', { telefone: '(19) 1111-2222' }), 200, 'recepção altera paciente');
  esperarStatus(await c.Enfermeiro.put('/atendimentos/AT0006', { status: 'aguardando-medico', triagem: dadosTriagem() }), 200, 'enfermagem faz triagem');
  esperarStatus(await c.Medico.put('/atendimentos/AT0006', { status: 'em-atendimento', medico: dadosMedico() }), 200, 'médico inicia consulta');
});

test('enfermeiro e médico não podem enviar campos do paciente', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const c = await clientes(amb);
  const casos = [
    ['Enfermeiro', 'AT0006', { nome: 'Trocado' }],
    ['Enfermeiro', 'AT0006', { status: 'aguardando-medico', triagem: dadosTriagem(), cpf: '000.000.000-00' }],
    ['Enfermeiro', 'AT0006', { status: 'aguardando-medico', triagem: dadosTriagem(), medico: dadosMedico() }],
    ['Medico', 'AT0001', { nome: 'Trocado' }],
    ['Medico', 'AT0001', { status: 'confirmado', medico: dadosMedico(), nascimento: '2000-01-01' }],
    ['Medico', 'AT0001', { status: 'confirmado', medico: dadosMedico(), triagem: dadosTriagem() }]
  ];
  for (const [cargo, codigo, corpo] of casos) {
    const resposta = await c[cargo].put(`/atendimentos/${codigo}`, corpo);
    esperarStatus(resposta, 403, `${cargo} enviando ${Object.keys(corpo).join(', ')}`);
    assert.equal(resposta.erro, 'Campos não permitidos para seu cargo');
  }
  const { rows } = await amb.query("SELECT nome_completo FROM paciente WHERE cpf IN ('123.456.789-00', '654.321.987-00') ORDER BY cpf");
  assert.deepEqual(rows.map((r) => r.nome_completo), ['João da Silva', 'Márcia Conceição Ribeiro'], 'os pacientes não poderiam mudar');
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'AGUARDANDO_TRIAGEM');
  assert.equal(await statusNoBanco(amb, 'AT0001'), 'AGUARDANDO_MEDICO');
});

test('recepção não pode enviar triagem, dados médicos nem status', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const casos = [
    ['PUT', 'AT0006', { triagem: dadosTriagem() }],
    ['PUT', 'AT0001', { medico: dadosMedico() }],
    ['PUT', 'AT0001', { status: 'confirmado' }],
    ['PUT', 'AT0001', { nome: 'João da Silva', status: 'cancelado' }],
    ['POST', null, { ...dadosPaciente(), triagem: dadosTriagem() }],
    ['POST', null, { ...dadosPaciente(), status: 'aguardando-medico' }],
    ['POST', null, { ...dadosPaciente(), id_profissional: 3 }]
  ];
  for (const [metodo, codigo, corpo] of casos) {
    const resposta = metodo === 'POST'
      ? await recepcao.post('/atendimentos', corpo)
      : await recepcao.put(`/atendimentos/${codigo}`, corpo);
    esperarStatus(resposta, 403, `recepção ${metodo} com ${Object.keys(corpo).join(', ')}`);
  }
  assert.equal(await statusNoBanco(amb, 'AT0001'), 'AGUARDANDO_MEDICO');
  assert.equal(await statusNoBanco(amb, 'AT0006'), 'AGUARDANDO_TRIAGEM');
  const { rows } = await amb.query('SELECT COUNT(*)::int AS n FROM atendimento');
  assert.equal(rows[0].n, 6, 'nenhum atendimento novo deveria ter sido criado');
});

test('o atendimento criado fica no nome da recepcionista logada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const novo = await criarAtendimento(recepcao);
  const { rows } = await amb.query('SELECT id_recepcionista FROM atendimento WHERE numero_atendimento = $1', [novo.id]);
  assert.equal(rows[0].id_recepcionista, USUARIOS.Recepcionista.id);
});
