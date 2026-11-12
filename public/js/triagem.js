// SGPS - Tela da Enfermagem: Fila de triagem

async function carregarFilaTriagem() {
  try {
    const atendimentos = await api('/atendimentos?status=AGUARDANDO_TRIAGEM');
    // A API devolve do mais recente para o mais antigo; a fila é por ordem de chegada.
    atendimentos.reverse();

    const linhas = atendimentos.map((a, posicao) => `
      <tr>
        <td>${posicao + 1}º</td>
        <td>${esc(a.numero_atendimento)}</td>
        <td>${esc(a.nome_paciente)}</td>
        <td>${esc(calcularIdade(a.data_nascimento))}</td>
        <td>${esc(formatarDataHora(a.data_hora_chegada))}</td>
        <td class="acoes">
          <button class="btn-pequeno" data-id="${a.id_atendimento}" data-descricao="${esc(`${a.numero_atendimento} - ${a.nome_paciente}`)}">Triar</button>
        </td>
      </tr>`);

    $('fila-triagem').innerHTML = montarTabela(
      ['Ordem', 'Nº', 'Paciente', 'Idade', 'Chegada', 'Ação'],
      linhas,
      'Nenhum paciente aguardando triagem.'
    );
  } catch (erro) {
    mostrarErroNaLista('fila-triagem', erro);
  }
}

function fecharFormularioTriagem() {
  $('triagem-form').reset();
  $('triagem-form').classList.add('hidden');
}

function selecionarParaTriagem(evento) {
  const botao = evento.target.closest('button[data-id]');
  if (!botao) return;

  const form = $('triagem-form');
  form.reset();
  form.elements.id_atendimento.value = botao.dataset.id;
  $('triagem-selecionado').textContent = `Paciente: ${botao.dataset.descricao}`;
  form.classList.remove('hidden');
  mostrarMensagem('triagem-status', '');
  form.scrollIntoView({ behavior: 'smooth' });
}

async function registrarTriagem(evento) {
  evento.preventDefault();
  const dados = dadosDoFormulario(evento.target);

  try {
    const r = await api('/triagens', enviar('POST', dados));
    fecharFormularioTriagem();

    let mensagem = `Triagem registrada. Classificação: ${MANCHESTER_ROTULOS[r.classificacao_manchester]}.`;
    if (r.classificacao_manchester !== r.classificacao_sugerida) {
      mensagem += ` (Sugerida pelo sistema: ${MANCHESTER_ROTULOS[r.classificacao_sugerida]}.)`;
    }
    mostrarMensagem('triagem-status', mensagem);
    carregarFilaTriagem();
  } catch (erro) {
    mostrarMensagem('triagem-status', erro.message, true);
  }
}

function iniciarTriagem() {
  $('triagem-atualizar').addEventListener('click', carregarFilaTriagem);
  $('fila-triagem').addEventListener('click', selecionarParaTriagem);
  $('triagem-form').addEventListener('submit', registrarTriagem);
  $('triagem-cancelar').addEventListener('click', fecharFormularioTriagem);
}
