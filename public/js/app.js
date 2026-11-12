// SGPS - Login, menu e inicialização da página (SPA em JavaScript puro)

// Função que recarrega os dados de cada tela quando ela é aberta.
const CARREGADORES = {
  'secao-pacientes': carregarPacientes,
  'secao-atendimentos': carregarAtendimentos,
  'secao-triagem': carregarFilaTriagem,
  'secao-painel': carregarPainel,
  'secao-consulta': carregarEmAtendimento,
  'secao-historico': carregarHistorico
};

// ---------- Navegação ----------

function mostrarTelaLogin(mostrar) {
  $('tela-login').classList.toggle('hidden', !mostrar);
  $('tela-sistema').classList.toggle('hidden', mostrar);
}

function abrirSecao(idSecao, carregar = true) {
  document.querySelectorAll('.menu-btn').forEach((botao) => {
    botao.classList.toggle('ativo', botao.dataset.secao === idSecao);
  });
  document.querySelectorAll('.secao').forEach((secao) => {
    secao.classList.toggle('hidden', secao.id !== idSecao);
  });
  document.querySelectorAll('.secao .mensagem').forEach((msg) => mostrarMensagem(msg.id, ''));

  if (carregar && CARREGADORES[idSecao]) {
    CARREGADORES[idSecao]();
  }
}

// Mostra no menu só as telas do cargo logado e abre a primeira delas.
function aplicarPerfil() {
  const { cargo, nome } = state.profissional;
  $('usuario-info').textContent = `${nome} (${MOCK_PROFISSIONAIS[cargo].rotulo})`;

  let primeira = null;
  document.querySelectorAll('.menu-btn').forEach((botao) => {
    const permitido = botao.dataset.cargo.split(' ').includes(cargo);
    botao.classList.toggle('hidden', !permitido);
    if (permitido && !primeira) primeira = botao.dataset.secao;
  });

  mostrarTelaLogin(false);
  abrirSecao(primeira);
}

// ---------- Login / logout ----------

function login(evento) {
  evento.preventDefault();

  const email = $('email').value.trim();
  const senha = $('senha').value;
  const cargo = $('cargo').value;

  if (email !== MOCK_LOGIN.email || senha !== MOCK_LOGIN.senha) {
    mostrarMensagem('login-status', 'E-mail ou senha inválidos.', true);
    return;
  }

  const perfil = MOCK_PROFISSIONAIS[cargo];
  state.profissional = { id: perfil.id, nome: perfil.nome, cargo };
  sessionStorage.setItem('usuarioAtual', JSON.stringify(state.profissional));
  mostrarMensagem('login-status', '');
  aplicarPerfil();
}

function sair() {
  sessionStorage.removeItem('usuarioAtual');
  state.profissional = null;
  state.atendimentoEmAlteracao = null;
  $('login-form').reset();
  $('historico-form').reset();
  limparFormularioPaciente();
  definirAlteracaoAtendimento(null);
  mostrarTelaLogin(true);
}

// ---------- Inicialização ----------

function iniciar() {
  $('login-form').addEventListener('submit', login);
  $('logout-btn').addEventListener('click', sair);
  document.querySelectorAll('.menu-btn').forEach((botao) => {
    botao.addEventListener('click', () => abrirSecao(botao.dataset.secao));
  });

  iniciarRecepcao();
  iniciarTriagem();
  iniciarMedico();
  iniciarHistorico();

  const salvo = sessionStorage.getItem('usuarioAtual');
  if (salvo) {
    state.profissional = JSON.parse(salvo);
    aplicarPerfil();
  } else {
    mostrarTelaLogin(true);
  }
}

iniciar();
