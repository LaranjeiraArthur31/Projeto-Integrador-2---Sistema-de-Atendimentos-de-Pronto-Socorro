// SGPS - Telas do Médico: Fila de atendimento e Em consulta

function sinaisVitais(item) {
  return `PA ${esc(item.pressao_arterial)} | Temp. ${esc(formatarTemperatura(item.temperatura))} | FC ${esc(item.frequencia_cardiaca)} bpm`;
}

// ---------- Fila de atendimento (painel) ----------

async function carregarPainel() {
  try {
    const itens = await api('/medicos/painel');

    const linhas = itens.map((i, posicao) => `
      <tr>
        <td>${posicao + 1}º</td>
        <td>${etiquetaManchester(i.classificacao_manchester)}</td>
        <td>${esc(i.numero_atendimento)}</td>
        <td>${esc(i.nome_paciente)}<br><small class="texto-fraco">${esc(calcularIdade(i.data_nascimento))}</small></td>
        <td>${esc(i.queixa_principal)}<br><small class="texto-fraco">${sinaisVitais(i)}</small></td>
        <td>${esc(formatarDataHora(i.data_hora_chegada))}</td>
        <td class="acoes"><button class="btn-pequeno" data-id="${i.id_atendimento}" data-numero="${esc(i.numero_atendimento)}">Chamar</button></td>
      </tr>`);

    $('painel-medico').innerHTML = montarTabela(
      ['Ordem', 'Classificação', 'Nº', 'Paciente', 'Queixa / sinais vitais', 'Chegada', 'Ação'],
      linhas,
      'Nenhum paciente aguardando atendimento médico.'
    );
  } catch (erro) {
    mostrarErroNaLista('painel-medico', erro);
  }
}

async function chamarPaciente(evento) {
  const botao = evento.target.closest('button[data-id]');
  if (!botao) return;

  try {
    await api('/medicos/iniciar', enviar('POST', { id_atendimento: Number(botao.dataset.id) }));
    abrirSecao('secao-consulta');
    mostrarMensagem('consulta-status', `Consulta do atendimento ${botao.dataset.numero} iniciada. Clique em "Atender" para registrar.`);
  } catch (erro) {
    mostrarMensagem('painel-status', erro.message, true);
    carregarPainel();
  }
}

// ---------- Em consulta ----------

async function carregarEmAtendimento() {
  try {
    const itens = await api('/medicos/em-atendimento');
    state.emConsulta = itens;

    const linhas = itens.map((i) => `
      <tr>
        <td>${etiquetaManchester(i.classificacao_manchester)}</td>
        <td>${esc(i.numero_atendimento)}</td>
        <td>${esc(i.nome_paciente)}<br><small class="texto-fraco">${esc(calcularIdade(i.data_nascimento))}</small></td>
        <td>${esc(formatarDataHora(i.data_hora_inicio))}</td>
        <td class="acoes"><button class="btn-pequeno" data-id="${i.id_atendimento}">Atender</button></td>
      </tr>`);

    $('em-atendimento').innerHTML = montarTabela(
      ['Classificação', 'Nº', 'Paciente', 'Início da consulta', 'Ação'],
      linhas,
      'Nenhum paciente em consulta. Chame um paciente na Fila de atendimento.'
    );
  } catch (erro) {
    mostrarErroNaLista('em-atendimento', erro);
  }
}

function fecharFormularioConsulta() {
  $('consulta-form').reset();
  $('consulta-form').classList.add('hidden');
}

function selecionarParaConsulta(evento) {
  const botao = evento.target.closest('button[data-id]');
  if (!botao) return;

  const item = state.emConsulta.find((i) => i.id_atendimento === Number(botao.dataset.id));
  const form = $('consulta-form');
  form.reset();
  form.elements.id_atendimento.value = item.id_atendimento;
  $('consulta-selecionado').textContent = `Paciente: ${item.numero_atendimento} - ${item.nome_paciente}`;
  $('consulta-triagem').innerHTML = `
    <strong>Dados da triagem</strong> ${etiquetaManchester(item.classificacao_manchester)}<br>
    Queixa: ${esc(item.queixa_principal)}<br>
    ${sinaisVitais(item)}`;
  form.classList.remove('hidden');
  mostrarMensagem('consulta-status', '');
  form.scrollIntoView({ behavior: 'smooth' });
}

async function finalizarConsulta(evento) {
  evento.preventDefault();
  const dados = dadosDoFormulario(evento.target);

  try {
    await api('/medicos/finalizar', enviar('PUT', { ...dados, id_atendimento: Number(dados.id_atendimento) }));
    fecharFormularioConsulta();
    mostrarMensagem('consulta-status', 'Atendimento finalizado. O registro está disponível em "Meu histórico".');
    carregarEmAtendimento();
  } catch (erro) {
    mostrarMensagem('consulta-status', erro.message, true);
  }
}

function iniciarMedico() {
  $('painel-atualizar').addEventListener('click', carregarPainel);
  $('painel-medico').addEventListener('click', chamarPaciente);
  $('em-atendimento').addEventListener('click', selecionarParaConsulta);
  $('consulta-form').addEventListener('submit', finalizarConsulta);
  $('consulta-cancelar').addEventListener('click', fecharFormularioConsulta);
}
