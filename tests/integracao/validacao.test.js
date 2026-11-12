// D) Validação de dados.
// Testes marcados com { todo } são regras de negócio ainda não decididas: rodam, mas não
// derrubam a suíte. Veja a lista de propostas no relatório da bateria de testes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_BANCO, ambienteDoTeste, contar, criarAtendimento, dadosMedico, dadosPaciente, dadosTriagem, esperarStatus
} from '../helpers/ambiente.js';

const opcoes = { skip: SEM_BANCO };
const proposta = (texto) => ({ skip: SEM_BANCO, todo: `PROPOSTA (regra de negócio a decidir): ${texto}` });

// Data local (AAAA-MM-DD) daqui a N dias; com "anos", desloca também os anos.
function hojeMais(dias, anos = 0) {
  const data = new Date();
  data.setFullYear(data.getFullYear() + anos);
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`;
}

// ---------- Paciente ----------

test('paciente: campos obrigatórios ausentes ou só com espaços são recusados', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const campo of ['nome', 'cpf', 'rg', 'mae', 'nascimento', 'sexo']) {
    const semCampo = dadosPaciente();
    delete semCampo[campo];
    esperarStatus(await recepcao.post('/atendimentos', semCampo), 400, `paciente sem ${campo}`);
    for (const vazio of ['', '   ', null]) {
      esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ [campo]: vazio })), 400, `paciente com ${campo} = ${JSON.stringify(vazio)}`);
    }
  }
  esperarStatus(await recepcao.put('/atendimentos/AT0001', { nome: '  ' }), 400, 'editar paciente deixando o nome em branco');
  assert.equal(await contar(amb, 'atendimento'), 6, 'nenhum atendimento deveria ter sido criado');
});

test('paciente: campos opcionais (pai, telefone, endereço) podem faltar', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const dados = dadosPaciente();
  delete dados.pai; delete dados.telefone; delete dados.endereco;
  const criado = esperarStatus(await recepcao.post('/atendimentos', dados), 201).dados;
  assert.equal(criado.pai, null);
  assert.equal(criado.telefone, null);
});

test('paciente: sexo diferente de M ou F é recusado', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const sexo of ['X', 'Masculino', 'MF', 1, ['M']]) {
    esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ sexo })), 400, `sexo ${JSON.stringify(sexo)}`);
  }
});

test('paciente: data de nascimento inválida é recusada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const nascimento of ['abc', '2024-02-30', '2023-13-01', '31/12/1990', '1990-05']) {
    esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento })), 400, `nascimento "${nascimento}"`);
  }
});

test('paciente: data de nascimento no futuro é recusada com mensagem clara', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const nascimento of [hojeMais(2), hojeMais(30), '2999-01-01']) {
    const resposta = esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento })), 400, `nascimento ${nascimento}`);
    assert.equal(resposta.erro, 'Data de nascimento não pode estar no futuro');
  }
  const [{ id }] = (await recepcao.get('/atendimentos')).dados;
  esperarStatus(await recepcao.put(`/atendimentos/${id}`, { nascimento: hojeMais(30) }), 400, 'edição com nascimento futuro');
  esperarStatus(await recepcao.post('/pacientes', { nome_completo: 'P', cpf: '123.456.789-01', rg: '1', nome_mae: 'M', data_nascimento: hojeMais(30), sexo: 'M' }), 400, 'rota /pacientes com nascimento futuro');
});

test('paciente: idade acima de 130 anos é recusada; 130 anos exatos é aceita', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const nascimento of ['1800-01-01', hojeMais(-1, -130)]) {
    const resposta = esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento })), 400, `nascimento ${nascimento}`);
    assert.equal(resposta.erro, 'Data de nascimento inválida: a idade não pode passar de 130 anos');
  }
  esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento: hojeMais(0, -130) })), 201, 'exatamente 130 anos');
  esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento: '1926-01-01' })), 201, 'paciente centenário');
});

test('paciente: data de nascimento de hoje (recém-nascido) é aceita', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nascimento: hojeMais(0) })), 201, 'nascimento hoje');
});

test('paciente: CPF repetido atualiza o mesmo paciente em vez de duplicar', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const pacientesAntes = await contar(amb, 'paciente');
  const primeiro = await criarAtendimento(recepcao, { cpf: '111.222.333-44', nome: 'Nome Antigo' });
  const segundo = await criarAtendimento(recepcao, { cpf: '111.222.333-44', nome: 'Nome Novo' });
  assert.notEqual(primeiro.id, segundo.id, 'deveriam ser dois atendimentos');
  assert.equal(await contar(amb, 'paciente'), pacientesAntes + 1, 'o paciente não pode ser duplicado');
  const { rows } = await amb.query("SELECT nome_completo FROM paciente WHERE cpf = '111.222.333-44'");
  assert.equal(rows[0].nome_completo, 'Nome Novo', 'o cadastro do paciente deveria ser atualizado');
});

test('paciente: textos acima do limite das colunas são recusados com 400', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const limites = { nome: 100, mae: 100, pai: 100, rg: 20, cpf: 14, telefone: 20, endereco: 150 };
  for (const [campo, limite] of Object.entries(limites)) {
    const noLimite = campo === 'cpf' ? '123.456.789-99' : 'a'.repeat(limite);
    esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ [campo]: noLimite })), 201, `${campo} com ${limite} caracteres`);
    const resposta = await recepcao.post('/atendimentos', dadosPaciente({ [campo]: 'a'.repeat(limite + 1) }));
    esperarStatus(resposta, 400, `${campo} com ${limite + 1} caracteres`);
    // O CPF é barrado antes pela regra de formato, com mensagem própria.
    assert.equal(resposta.erro, campo === 'cpf' ? MSG_CPF : 'Dados inválidos ou campos obrigatórios ausentes');
  }
  esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nome: 'a'.repeat(100_000) })), 400, 'nome com 100 mil caracteres');
});

test('paciente: caracteres especiais são gravados exatamente como enviados', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const nome = `D'Ávila "Zé" & <Filho> \\ / % _ ; -- \t`;
  const criado = await criarAtendimento(recepcao, { nome, endereco: 'Rua 25 de Março, nº 7 – apto. 3/B' });
  assert.equal(criado.nome, nome);
  const { rows } = await amb.query('SELECT nome_completo, endereco FROM paciente WHERE cpf = $1', [criado.cpf]);
  assert.equal(rows[0].nome_completo, nome, 'o banco deveria guardar o nome sem alteração');
  assert.equal(rows[0].endereco, 'Rua 25 de Março, nº 7 – apto. 3/B');
});

test('paciente: listas e objetos em campos de texto são recusados', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const [campo, valor] of [['nome', ['Ana']], ['nome', { texto: 'Ana' }], ['cpf', ['123']], ['endereco', { rua: 'A' }], ['telefone', []]]) {
    esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ [campo]: valor })), 400, `${campo} = ${JSON.stringify(valor)}`);
  }
  const { rows } = await amb.query("SELECT COUNT(*)::int AS n FROM paciente WHERE nome_completo LIKE '{%' OR endereco LIKE '{%' OR telefone LIKE '{%'");
  assert.equal(rows[0].n, 0, 'nenhum texto com formato de lista/JSON deveria ter sido gravado');
});

test('paciente: número em campo de texto é recusado', proposta(
  'hoje { "nome": 123 } é gravado como "123"; sugestão: exigir texto nos campos do paciente'
), async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ nome: 123 })), 400, 'nome numérico');
});

const MSG_CPF = 'CPF inválido: informe 11 dígitos, com ou sem máscara (ex.: 123.456.789-00)';

test('paciente: CPF fora do formato de 11 dígitos é recusado com mensagem clara', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const cpf of ['abc', '123', '1234567890', '123456789012', '123.456.789-0', '123.456.789-001',
    'abc.def.ghi-jk', '123 456 789 00', '123/456/789-00', 12345678900]) {
    const resposta = esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ cpf })), 400, `CPF ${JSON.stringify(cpf)}`);
    assert.equal(resposta.erro, MSG_CPF);
  }
  esperarStatus(await recepcao.post('/pacientes', { nome_completo: 'P', cpf: '123', rg: '1', nome_mae: 'M', data_nascimento: '1990-01-01', sexo: 'M' }), 400, 'rota /pacientes com CPF "123"');
  const [{ id }] = (await recepcao.get('/atendimentos')).dados;
  esperarStatus(await recepcao.put(`/atendimentos/${id}`, { cpf: '123' }), 400, 'edição com CPF "123"');
});

test('paciente: CPF com ou sem máscara é aceito, sem conferir dígitos verificadores, e gravado com máscara', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const [cpf, gravado] of [['111.111.111-12', '111.111.111-12'], ['98765432100', '987.654.321-00'], [' 555.444.333-22 ', '555.444.333-22']]) {
    const resposta = esperarStatus(await recepcao.post('/atendimentos', dadosPaciente({ cpf })), 201, `CPF ${JSON.stringify(cpf)}`);
    assert.equal(resposta.dados.cpf, gravado, `CPF ${JSON.stringify(cpf)} deveria ser gravado como ${gravado}`);
  }
  const pacientes = await contar(amb, 'paciente');
  await criarAtendimento(recepcao, { cpf: '98765432100' });
  assert.equal(await contar(amb, 'paciente'), pacientes, 'o mesmo CPF sem máscara não pode criar outro paciente');
});

test('paciente: os CPFs dos dados de demonstração (insert.sql) passam na validação', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const { rows } = await amb.query("SELECT a.numero_atendimento, p.cpf FROM atendimento a JOIN paciente p USING (id_paciente) WHERE a.status NOT IN ('FINALIZADO', 'CANCELADO') ORDER BY 1");
  assert.ok(rows.length >= 3, 'os dados de demonstração deveriam ter atendimentos em aberto');
  for (const { numero_atendimento: id, cpf } of rows) {
    const resposta = esperarStatus(await recepcao.put(`/atendimentos/${id}`, { cpf }), 200, `reenviar o CPF ${cpf} do ${id}`);
    assert.equal(resposta.dados.cpf, cpf);
  }
  const todos = await amb.query('SELECT cpf FROM paciente UNION ALL SELECT cpf FROM profissional');
  for (const { cpf } of todos.rows) assert.match(cpf, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/, `CPF de demonstração fora do formato: ${cpf}`);
});

// ---------- Triagem ----------

async function triagem(amb, extra) {
  const enfermagem = await amb.enfermagem();
  return enfermagem.put('/atendimentos/AT0006', { status: 'aguardando-medico', triagem: dadosTriagem(extra) });
}

test('triagem: classificação inválida ou ausente é recusada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const classificacao of ['roxo', 'VERDE ', '', null, 1, ['verde']]) {
    esperarStatus(await triagem(amb, { classificacao }), 400, `classificação ${JSON.stringify(classificacao)}`);
  }
  const semClassificacao = dadosTriagem();
  delete semClassificacao.classificacao;
  const enfermagem = await amb.enfermagem();
  esperarStatus(await enfermagem.put('/atendimentos/AT0006', { status: 'aguardando-medico', triagem: semClassificacao }), 400, 'sem classificação');
  assert.equal(await contar(amb, 'triagem'), 5, 'nenhuma triagem deveria ter sido gravada');
});

test('triagem: as cinco cores, em minúsculas ou maiúsculas, são aceitas', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  for (const cor of ['vermelho', 'LARANJA', 'Amarelo', 'verde', 'azul']) {
    const { id } = await criarAtendimento(recepcao);
    const resposta = await enfermagem.put(`/atendimentos/${id}`, { status: 'aguardando-medico', triagem: dadosTriagem({ classificacao: cor }) });
    esperarStatus(resposta, 200, `cor ${cor}`);
    assert.equal(resposta.dados.triagem.classificacao, cor.toLowerCase());
  }
});

test('triagem: pressão nos formatos "120/80" e "120/80 mmHg" é aceita', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  for (const pa of ['120/80', '120/80 mmHg', '90/60mmHg', '200/110 MMHG']) {
    const { id } = await criarAtendimento(recepcao);
    const resposta = await enfermagem.put(`/atendimentos/${id}`, { status: 'aguardando-medico', triagem: dadosTriagem({ pa }) });
    esperarStatus(resposta, 200, `PA "${pa}"`);
    assert.equal(resposta.dados.triagem.pa, pa);
  }
});

test('triagem: pressão em formato inválido é recusada com mensagem clara', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const pa of ['abc', '999', '120', '120/', '/80', '120-80', '12/8', '1200/80', '120/80 mm', '120/80 mmHg extra',
    '120 / 80', '1'.repeat(21), 12080, ['120/80']]) {
    const resposta = esperarStatus(await triagem(amb, { pa }), 400, `PA ${JSON.stringify(pa)}`);
    if (typeof pa !== 'object') assert.equal(resposta.erro, 'Pressão arterial inválida: use o formato 120/80 ou 120/80 mmHg');
  }
});

test('triagem: temperatura com vírgula, ponto ou número é aceita', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  for (const [temp, esperado] of [['36,5', '36.50'], ['36.5', '36.50'], [37, '37.00'], [38.25, '38.25'], ['', null]]) {
    const { id } = await criarAtendimento(recepcao);
    const resposta = await enfermagem.put(`/atendimentos/${id}`, { status: 'aguardando-medico', triagem: dadosTriagem({ temp }) });
    esperarStatus(resposta, 200, `temperatura ${JSON.stringify(temp)}`);
    assert.equal(resposta.dados.triagem.temp, esperado, `temperatura ${JSON.stringify(temp)} gravada errada`);
  }
});

test('triagem: temperatura em texto, negativa ou com 3 casas é recusada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const temp of ['quente', '-1', '36,5,1', '36.555', '1e2', '100', [36]]) {
    const resposta = await triagem(amb, { temp });
    esperarStatus(resposta, 400, `temperatura ${JSON.stringify(temp)}`);
  }
});

test('triagem: temperatura fora de 25 a 45 °C é recusada com mensagem clara; os limites são aceitos', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const temp of ['80', '5', '24,99', '45.01', 46, 0, '99,99']) {
    const resposta = esperarStatus(await triagem(amb, { temp }), 400, `temperatura ${JSON.stringify(temp)}`);
    assert.equal(resposta.erro, 'Temperatura fora da faixa aceita: informe um valor entre 25 e 45 °C');
  }
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  for (const [temp, esperado] of [['25', '25.00'], ['45,0', '45.00'], [34.2, '34.20']]) {
    const { id } = await criarAtendimento(recepcao);
    const resposta = await enfermagem.put(`/atendimentos/${id}`, { status: 'aguardando-medico', triagem: dadosTriagem({ temp }) });
    esperarStatus(resposta, 200, `temperatura ${JSON.stringify(temp)}`);
    assert.equal(resposta.dados.triagem.temp, esperado);
  }
});

test('triagem: frequência cardíaca que não é número inteiro é recusada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const bpm of ['abc', '80.5', 80.5, '8O', 3_000_000_000, [80], { v: 80 }]) {
    esperarStatus(await triagem(amb, { bpm }), 400, `bpm ${JSON.stringify(bpm)}`);
  }
});

test('triagem: frequência cardíaca fora de 20 a 250 bpm é recusada com mensagem clara; os limites são aceitos', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const bpm of [-5, 0, 19, 251, 999, '-80']) {
    const resposta = esperarStatus(await triagem(amb, { bpm }), 400, `bpm ${JSON.stringify(bpm)}`);
    assert.equal(resposta.erro, 'Batimentos cardíacos inválidos: informe um número inteiro entre 20 e 250 bpm');
  }
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  for (const [bpm, esperado] of [[20, 20], ['250', 250], [' 72 ', 72], ['', null]]) {
    const { id } = await criarAtendimento(recepcao);
    const resposta = await enfermagem.put(`/atendimentos/${id}`, { status: 'aguardando-medico', triagem: dadosTriagem({ bpm }) });
    esperarStatus(resposta, 200, `bpm ${JSON.stringify(bpm)}`);
    assert.equal(resposta.dados.triagem.bpm, esperado);
  }
});

test('triagem: queixa vazia ou só com espaços é recusada', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  for (const queixas of ['', '   ', null, undefined]) {
    esperarStatus(await triagem(amb, { queixas }), 400, `queixa ${JSON.stringify(queixas)}`);
  }
});

// ---------- Médico ----------

async function consulta(amb, extra) {
  const medico = await amb.medico();
  return medico.put('/atendimentos/AT0001', { status: 'confirmado', medico: dadosMedico(extra) });
}

test('médico: diagnóstico e observações são opcionais', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const resposta = esperarStatus(await consulta(amb, { diagnostico: undefined, observacoes: undefined }), 200, 'alta sem diagnóstico');
  assert.equal(resposta.dados.medico.diagnostico, null);
});

test('médico: medicações vazias são recusadas', proposta(
  'a tela exige "Medicações prescritas", mas a API aceita vazio; sugestão: exigir na API também (ou tornar opcional na tela)'
), async (t) => {
  const amb = await ambienteDoTeste(t);
  esperarStatus(await consulta(amb, { medicacoes: '' }), 400, 'medicações vazias');
});

test('médico: textos longos (10 mil caracteres) são gravados inteiros', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const texto = 'Observação longa. '.repeat(560);
  const resposta = esperarStatus(await consulta(amb, { observacoes: texto, diagnostico: texto }), 200);
  assert.equal(resposta.dados.medico.observacoes, texto);
  assert.equal(resposta.dados.medico.diagnostico.length, texto.length);
});

test('médico: dados clínicos que não são objeto são recusados com 400', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const medico = await amb.medico();
  for (const valor of [null, 'texto', 1, [], ['a']]) {
    const resposta = await medico.put('/atendimentos/AT0001', { status: 'confirmado', medico: valor });
    esperarStatus(resposta, 400, `medico = ${JSON.stringify(valor)}`);
  }
  const enfermagem = await amb.enfermagem();
  esperarStatus(await enfermagem.put('/atendimentos/AT0006', { status: 'aguardando-medico', triagem: [] }), 400, 'triagem = []');
});

// ---------- Corpo da requisição ----------

test('JSON malformado devolve 400 "JSON inválido"', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  for (const corpo of ['{"nome": ', '{nome: "x"}', "{'a':1}", '{"a":1,}']) {
    const resposta = await recepcao.req('POST', '/atendimentos', { corpo, cabecalhos: { 'Content-Type': 'application/json' } });
    esperarStatus(resposta, 400, `corpo ${corpo}`);
    assert.equal(resposta.erro, 'JSON inválido');
  }
  const login = await amb.cliente().req('POST', '/auth/login', { corpo: '{', cabecalhos: { 'Content-Type': 'application/json' } });
  esperarStatus(login, 400, 'login com JSON malformado');
});

test('corpo maior que 1 MB devolve 413', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const resposta = await recepcao.post('/atendimentos', dadosPaciente({ endereco: 'x'.repeat(1_100_000) }));
  esperarStatus(resposta, 413, 'corpo de 1,1 MB');
  assert.equal(resposta.erro, 'Corpo da requisição muito grande');
});

test('/atendimentos: corpo ausente, lista, null ou texto devolve 400 (não 403)', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  const enfermagem = await amb.enfermagem();
  const casos = [
    ['recepção POST sem corpo', () => recepcao.req('POST', '/atendimentos')],
    ['recepção POST com lista', () => recepcao.post('/atendimentos', [dadosPaciente()])],
    ['recepção POST com null', () => recepcao.post('/atendimentos', null)],
    ['recepção POST com número', () => recepcao.post('/atendimentos', 42)],
    ['recepção POST com Content-Type text/plain', () => recepcao.req('POST', '/atendimentos', {
      corpo: JSON.stringify(dadosPaciente()), cabecalhos: { 'Content-Type': 'text/plain' }
    })],
    ['recepção POST como formulário', () => recepcao.req('POST', '/atendimentos', {
      corpo: 'nome=Ana&cpf=1', cabecalhos: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })],
    ['enfermagem PUT sem corpo', () => enfermagem.req('PUT', '/atendimentos/AT0006')],
    ['enfermagem PUT com lista', () => enfermagem.put('/atendimentos/AT0006', [])]
  ];
  for (const [descricao, enviar] of casos) {
    esperarStatus(await enviar(), 400, descricao);
  }
  assert.equal(await contar(amb, 'atendimento'), 6);
});

test('rotas genéricas: corpo que não é objeto devolve 400', opcoes, async (t) => {
  const amb = await ambienteDoTeste(t);
  const recepcao = await amb.recepcao();
  esperarStatus(await recepcao.post('/pacientes', [1, 2]), 400, 'POST /pacientes com lista');
  esperarStatus(await recepcao.req('POST', '/pacientes'), 400, 'POST /pacientes sem corpo');
  esperarStatus(await recepcao.put('/pacientes/1', {}), 400, 'PUT /pacientes/1 sem campos');
  esperarStatus(await recepcao.put('/pacientes/abc', { telefone: '1' }), 400, 'PUT /pacientes/abc');
  esperarStatus(await recepcao.get('/pacientes/abc'), 400, 'GET /pacientes/abc');
});
