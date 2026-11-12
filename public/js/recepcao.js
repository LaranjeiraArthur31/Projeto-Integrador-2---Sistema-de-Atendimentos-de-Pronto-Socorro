// SGPS - Telas da Recepção: Cadastro de paciente, Pacientes e Atendimentos

// ---------- Cadastro / edição de paciente ----------

function limparFormularioPaciente() {
  $('paciente-form').reset();
  $('paciente-form').elements.id_paciente.value = '';
  $('paciente-form-titulo').textContent = 'Cadastro de paciente';
  $('paciente-submit').textContent = 'Cadastrar e abrir atendimento';
  $('paciente-cancelar').classList.add('hidden');
}

function editarPaciente(paciente) {
  const form = $('paciente-form');
  Object.keys(paciente).forEach((campo) => {
    if (form.elements[campo]) {
      form.elements[campo].value = campo === 'cpf' ? formatarCpf(paciente[campo]) : (paciente[campo] ?? '');
    }
  });

  $('paciente-form-titulo').textContent = `Alterar paciente: ${paciente.nome_completo}`;
  $('paciente-submit').textContent = 'Salvar alterações';
  $('paciente-cancelar').classList.remove('hidden');
  mostrarMensagem('paciente-status', '');
  abrirSecao('secao-cadastro', false);
}

async function salvarPaciente(evento) {
  evento.preventDefault();
  const { id_paciente: id, ...dados } = dadosDoFormulario(evento.target);

  try {
    if (id) {
      await api(`/pacientes/${id}`, enviar('PUT', dados));
      mostrarMensagem('paciente-status', 'Dados do paciente atualizados.');
    } else {
      const paciente = await api('/pacientes', enviar('POST', dados));
      const atendimento = await api('/atendimentos', enviar('POST', { id_paciente: paciente.id_paciente }));
      mostrarMensagem('paciente-status', `Paciente cadastrado. Atendimento ${atendimento.numero_atendimento} aberto e aguardando triagem.`);
    }
    limparFormularioPaciente();
  } catch (erro) {
    mostrarMensagem('paciente-status', erro.message, true);
  }
}

// ---------- Lista de pacientes ----------

async function carregarPacientes() {
  try {
    const busca = encodeURIComponent($('paciente-busca').value.trim());
    const pacientes = await api(`/pacientes?busca=${busca}`);
    state.pacientes = pacientes;

    const emAlteracao = state.atendimentoEmAlteracao;
    const linhas = pacientes.map((p) => `
      <tr>
        <td>${esc(p.nome_completo)}</td>
        <td>${esc(formatarCpf(p.cpf))}</td>
        <td>${esc(formatarData(p.data_nascimento))}</td>
        <td>${esc(p.nome_mae)}</td>
        <td class="acoes">
          ${emAlteracao
            ? `<button class="btn-pequeno" data-acao="vincular" data-id="${p.id_paciente}">Vincular a ${esc(emAlteracao.numero)}</button>`
            : `<button class="btn-pequeno" data-acao="abrir-atendimento" data-id="${p.id_paciente}">Abrir atendimento</button>`}
          <button class="btn-pequeno btn-secundario" data-acao="editar-paciente" data-id="${p.id_paciente}">Editar</button>
        </td>
      </tr>`);

    $('paciente-lista').innerHTML = montarTabela(
      ['Nome', 'CPF', 'Nascimento', 'Nome da mãe', 'Ações'],
      linhas,
      'Nenhum paciente encontrado.'
    );
  } catch (erro) {
    mostrarErroNaLista('paciente-lista', erro);
  }
}

// Modo "trocar paciente do atendimento": a lista de pacientes mostra o botão Vincular.
function definirAlteracaoAtendimento(atendimento) {
  state.atendimentoEmAlteracao = atendimento;
  const aviso = $('vinculo-aviso');
  aviso.classList.toggle('hidden', !atendimento);
  aviso.innerHTML = atendimento
    ? `Escolha abaixo o paciente correto para o atendimento <strong>${esc(atendimento.numero)}</strong>.
       <button class="btn-pequeno btn-secundario" data-acao="cancelar-vinculo" type="button">Cancelar</button>`
    : '';
}

async function tratarAcaoPacientes(evento) {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  const { acao, id } = botao.dataset;

  try {
    if (acao === 'abrir-atendimento') {
      const a = await api('/atendimentos', enviar('POST', { id_paciente: Number(id) }));
      mostrarMensagem('pacientes-status', `Atendimento ${a.numero_atendimento} aberto e aguardando triagem.`);
    } else if (acao === 'editar-paciente') {
      editarPaciente(state.pacientes.find((p) => p.id_paciente === Number(id)));
    } else if (acao === 'cancelar-vinculo') {
      definirAlteracaoAtendimento(null);
      carregarPacientes();
    } else if (acao === 'vincular') {
      const numero = state.atendimentoEmAlteracao.numero;
      await api(`/atendimentos/${state.atendimentoEmAlteracao.id}`, enviar('PUT', { id_paciente: Number(id) }));
      definirAlteracaoAtendimento(null);
      abrirSecao('secao-atendimentos');
      mostrarMensagem('atendimento-status', `Paciente do atendimento ${numero} alterado.`);
    }
  } catch (erro) {
    mostrarMensagem('pacientes-status', erro.message, true);
  }
}

// ---------- Atendimentos ----------

async function carregarAtendimentos() {
  try {
    const status = encodeURIComponent($('atendimento-filtro').value);
    const atendimentos = await api(`/atendimentos?status=${status}`);

    const linhas = atendimentos.map((a) => `
      <tr>
        <td>${esc(a.numero_atendimento)}</td>
        <td>${esc(a.nome_paciente)}<br><small class="texto-fraco">CPF ${esc(formatarCpf(a.cpf))}</small></td>
        <td>${esc(formatarDataHora(a.data_hora_chegada))}</td>
        <td>${etiquetaManchester(a.classificacao_manchester)}</td>
        <td>${etiquetaStatus(a.status)}${a.motivo_cancelamento ? `<br><small class="texto-fraco">Motivo: ${esc(a.motivo_cancelamento)}</small>` : ''}</td>
        <td class="acoes">
          ${STATUS_EDITAVEIS.includes(a.status) ? `
            <button class="btn-pequeno btn-secundario" data-acao="alterar-atendimento" data-id="${a.id_atendimento}" data-numero="${esc(a.numero_atendimento)}">Trocar paciente</button>
            <button class="btn-pequeno btn-perigo" data-acao="cancelar-atendimento" data-id="${a.id_atendimento}" data-numero="${esc(a.numero_atendimento)}">Cancelar</button>` : '-'}
        </td>
      </tr>`);

    $('atendimento-lista').innerHTML = montarTabela(
      ['Nº', 'Paciente', 'Chegada', 'Classificação', 'Status', 'Ações'],
      linhas,
      'Nenhum atendimento encontrado.'
    );
  } catch (erro) {
    mostrarErroNaLista('atendimento-lista', erro);
  }
}

async function tratarAcaoAtendimentos(evento) {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  const { acao, id, numero } = botao.dataset;

  try {
    if (acao === 'alterar-atendimento') {
      definirAlteracaoAtendimento({ id: Number(id), numero });
      abrirSecao('secao-pacientes');
    } else if (acao === 'cancelar-atendimento') {
      const motivo = window.prompt(`Motivo do cancelamento do atendimento ${numero}:`);
      if (motivo === null) return;
      await api(`/atendimentos/${id}/cancelar`, enviar('PUT', { motivo }));
      mostrarMensagem('atendimento-status', `Atendimento ${numero} cancelado.`);
      carregarAtendimentos();
    }
  } catch (erro) {
    mostrarMensagem('atendimento-status', erro.message, true);
  }
}

// ---------- Eventos ----------

function iniciarRecepcao() {
  $('paciente-form').addEventListener('submit', salvarPaciente);
  $('paciente-cancelar').addEventListener('click', () => {
    limparFormularioPaciente();
    mostrarMensagem('paciente-status', '');
  });
  $('paciente-form').elements.cpf.addEventListener('input', (e) => {
    e.target.value = formatarCpf(e.target.value);
  });

  $('paciente-busca').addEventListener('input', carregarPacientes);
  $('secao-pacientes').addEventListener('click', tratarAcaoPacientes);

  $('atendimento-filtro').addEventListener('change', carregarAtendimentos);
  $('atendimento-atualizar').addEventListener('click', carregarAtendimentos);
  $('atendimento-lista').addEventListener('click', tratarAcaoAtendimentos);
}
