// SGPS - Tela "Meu histórico": cada profissional vê o que ele mesmo registrou.
// Recepção  -> atendimentos que abriu
// Enfermagem -> triagens que realizou
// Médico    -> consultas que finalizou

// Configuração de cada histórico: descrição, colunas da tabela e detalhes.
const HISTORICOS = {
  Recepcionista: {
    descricao: 'Atendimentos abertos por você na recepção.',
    cabecalhos: ['Data/hora de chegada', 'Nº', 'Paciente', 'Classificação', 'Status atual'],
    colunas: (r) => [
      esc(formatarDataHora(r.data_hora_chegada)),
      esc(r.numero_atendimento),
      esc(r.nome_paciente),
      etiquetaManchester(r.classificacao_manchester),
      etiquetaStatus(r.status)
    ],
    detalhes: (r) => [
      ['Atendimento', esc(r.numero_atendimento)],
      ['Paciente', `${esc(r.nome_paciente)} (CPF ${esc(formatarCpf(r.cpf))})`],
      ['Chegada', esc(formatarDataHora(r.data_hora_chegada))],
      ['Status atual', etiquetaStatus(r.status)],
      ['Classificação', etiquetaManchester(r.classificacao_manchester)],
      ['Cancelado em', esc(formatarDataHora(r.data_hora_cancelamento))],
      ['Motivo do cancelamento', esc(r.motivo_cancelamento || '-')]
    ]
  },
  Enfermeiro: {
    descricao: 'Triagens realizadas por você.',
    cabecalhos: ['Data/hora da triagem', 'Nº', 'Paciente', 'Classificação', 'Status atual'],
    colunas: (r) => [
      esc(formatarDataHora(r.data_hora_triagem)),
      esc(r.numero_atendimento),
      esc(r.nome_paciente),
      etiquetaManchester(r.classificacao_manchester),
      etiquetaStatus(r.status)
    ],
    detalhes: (r) => [
      ['Atendimento', esc(r.numero_atendimento)],
      ['Paciente', `${esc(r.nome_paciente)} (CPF ${esc(formatarCpf(r.cpf))})`],
      ['Data/hora da triagem', esc(formatarDataHora(r.data_hora_triagem))],
      ['Pressão arterial', esc(r.pressao_arterial)],
      ['Temperatura', esc(formatarTemperatura(r.temperatura))],
      ['Frequência cardíaca', `${esc(r.frequencia_cardiaca)} bpm`],
      ['Queixa principal', esc(r.queixa_principal)],
      ['Classificação', etiquetaManchester(r.classificacao_manchester)],
      ['Status atual', etiquetaStatus(r.status)]
    ]
  },
  Medico: {
    descricao: 'Consultas finalizadas por você.',
    cabecalhos: ['Início da consulta', 'Nº', 'Paciente', 'Classificação', 'Diagnóstico'],
    colunas: (r) => [
      esc(formatarDataHora(r.data_hora_inicio)),
      esc(r.numero_atendimento),
      esc(r.nome_paciente),
      etiquetaManchester(r.classificacao_manchester),
      esc(resumirTexto(r.diagnostico, 60))
    ],
    detalhes: (r) => [
      ['Atendimento', esc(r.numero_atendimento)],
      ['Paciente', `${esc(r.nome_paciente)} (CPF ${esc(formatarCpf(r.cpf))})`],
      ['Início da consulta', esc(formatarDataHora(r.data_hora_inicio))],
      ['Fim da consulta', esc(formatarDataHora(r.data_hora_fim))],
      ['Classificação', etiquetaManchester(r.classificacao_manchester)],
      ['Queixa (triagem)', esc(r.queixa_principal || '-')],
      ['Diagnóstico', esc(r.diagnostico)],
      ['Medicações prescritas', esc(r.medicacoes_prescritas || '-')],
      ['Observações', esc(r.observacoes || '-')]
    ]
  }
};

function resumirTexto(texto, limite) {
  const t = String(texto || '');
  return t.length > limite ? `${t.slice(0, limite)}...` : t;
}

async function carregarHistorico() {
  const config = HISTORICOS[state.profissional.cargo];
  $('historico-descricao').textContent = config.descricao;
  $('historico-detalhe').classList.add('hidden');

  try {
    const filtros = new URLSearchParams(dadosDoFormulario($('historico-form'))).toString();
    const registros = await api(`/historico?${filtros}`);
    state.historico = registros;

    $('historico-resumo').textContent = registros.length === 1
      ? '1 registro encontrado.'
      : `${registros.length} registros encontrados.`;

    const linhas = registros.map((r, indice) => `
      <tr>
        ${config.colunas(r).map((valor) => `<td>${valor}</td>`).join('')}
        <td class="acoes"><button class="btn-pequeno btn-secundario" data-indice="${indice}">Ver detalhes</button></td>
      </tr>`);

    $('historico-lista').innerHTML = montarTabela(
      [...config.cabecalhos, ''],
      linhas,
      'Nenhum registro encontrado no período.'
    );
  } catch (erro) {
    $('historico-resumo').textContent = '';
    mostrarErroNaLista('historico-lista', erro);
  }
}

function mostrarDetalheHistorico(evento) {
  const botao = evento.target.closest('button[data-indice]');
  if (!botao) return;

  const registro = state.historico[Number(botao.dataset.indice)];
  const itens = HISTORICOS[state.profissional.cargo].detalhes(registro);

  const caixa = $('historico-detalhe');
  caixa.innerHTML = `
    <h3>Detalhes do atendimento ${esc(registro.numero_atendimento)}</h3>
    <dl class="detalhes">
      ${itens.map(([titulo, valor]) => `<dt>${esc(titulo)}</dt><dd>${valor}</dd>`).join('')}
    </dl>
    <div class="botoes"><button class="btn-secundario" type="button" data-fechar>Fechar</button></div>`;
  caixa.classList.remove('hidden');
  caixa.scrollIntoView({ behavior: 'smooth' });
}

function iniciarHistorico() {
  $('historico-form').addEventListener('submit', (evento) => {
    evento.preventDefault();
    carregarHistorico();
  });
  $('historico-limpar').addEventListener('click', () => {
    $('historico-form').reset();
    carregarHistorico();
  });
  $('historico-lista').addEventListener('click', mostrarDetalheHistorico);
  $('historico-detalhe').addEventListener('click', (evento) => {
    if (evento.target.closest('[data-fechar]')) {
      $('historico-detalhe').classList.add('hidden');
    }
  });
}
