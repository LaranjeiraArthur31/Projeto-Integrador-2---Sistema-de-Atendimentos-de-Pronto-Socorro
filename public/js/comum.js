// SGPS - Código comum usado por todas as telas

const API_BASE = '/api';

// Login mock (sem autenticação real, fora do escopo do semestre).
// Os IDs correspondem aos profissionais cadastrados em database/schema.sql.
const MOCK_LOGIN = { email: 'teste@teste.com', senha: '123' };
const MOCK_PROFISSIONAIS = {
  Recepcionista: { id: 3, nome: 'Recepcionista Geral', rotulo: 'Recepção' },
  Enfermeiro: { id: 2, nome: 'Enfermeiro Triagem', rotulo: 'Enfermagem' },
  Medico: { id: 1, nome: 'Médico Plantonista', rotulo: 'Médico' }
};

const STATUS_ROTULOS = {
  AGUARDANDO_TRIAGEM: 'Aguardando triagem',
  AGUARDANDO_MEDICO: 'Aguardando médico',
  EM_ATENDIMENTO: 'Em atendimento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado'
};

const MANCHESTER_ROTULOS = {
  VERMELHO: 'Vermelho',
  LARANJA: 'Laranja',
  AMARELO: 'Amarelo',
  VERDE: 'Verde',
  AZUL: 'Azul'
};

// Status em que a recepção ainda pode alterar/cancelar o atendimento.
const STATUS_EDITAVEIS = ['AGUARDANDO_TRIAGEM', 'AGUARDANDO_MEDICO'];

// Dados da sessão atual.
const state = {
  profissional: null,
  atendimentoEmAlteracao: null, // atendimento que terá o paciente trocado
  pacientes: [],                // última lista de pacientes exibida
  emConsulta: [],               // pacientes em consulta do médico
  historico: []                 // último histórico carregado
};

// ---------- Funções de apoio ----------

function $(id) {
  return document.getElementById(id);
}

// Escapa o texto vindo do banco antes de colocar no innerHTML (evita XSS).
function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatarCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarData(valor) {
  if (!valor) return '-';
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatarTemperatura(valor) {
  return `${Number(valor).toFixed(1).replace('.', ',')} °C`;
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return '-';
  const nascimento = new Date(`${String(dataNascimento).slice(0, 10)}T00:00:00`);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario = hoje.getMonth() < nascimento.getMonth()
    || (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade--;
  return `${idade} anos`;
}

// Etiqueta colorida de status ou de classificação de Manchester.
function etiquetaStatus(status) {
  return `<span class="etiqueta etiqueta-${esc(status)}">${esc(STATUS_ROTULOS[status] || status)}</span>`;
}

function etiquetaManchester(cor) {
  if (!cor) return '-';
  return `<span class="etiqueta etiqueta-${esc(cor)}">${esc(MANCHESTER_ROTULOS[cor] || cor)}</span>`;
}

// Monta uma tabela HTML. `linhas` já deve vir em HTML (<tr>...</tr>).
function montarTabela(cabecalhos, linhas, textoVazio) {
  if (!linhas.length) {
    return `<p class="vazio">${esc(textoVazio)}</p>`;
  }
  return `
    <table>
      <thead><tr>${cabecalhos.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table>`;
}

function mostrarMensagem(id, mensagem, erro = false) {
  const el = $(id);
  el.textContent = mensagem;
  el.classList.toggle('erro', erro);
  el.classList.toggle('ok', !erro && Boolean(mensagem));
}

function mostrarErroNaLista(id, erro) {
  $(id).innerHTML = `<p class="vazio">${esc(erro.message)}</p>`;
}

function dadosDoFormulario(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// ---------- Comunicação com a API ----------

async function api(url, opcoes = {}) {
  const resposta = await fetch(`${API_BASE}${url}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'x-profissional-id': String(state.profissional.id),
      'x-profissional-cargo': state.profissional.cargo
    }
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.mensagem || 'Erro na requisição.');
  }
  return dados;
}

function enviar(metodo, corpo) {
  return { method: metodo, body: JSON.stringify(corpo) };
}
