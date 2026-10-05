/* ============================================================
   COMUM.JS — estado, API e utilitários compartilhados
   ============================================================ */
const API_BASE_URL = window.location.origin;

let atendimentos = [];
let persistedAtendimentos = new Map();

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.erro || `Falha na API (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function carregarAtendimentos() {
  try {
    const payload = await apiRequest('/atendimentos');
    atendimentos = Array.isArray(payload.dados) ? payload.dados : [];
    persistedAtendimentos = new Map(
      atendimentos.map((item) => [item.id, JSON.stringify(item)])
    );
    return atendimentos;
  } catch (error) {
    toast(`Não foi possível carregar os atendimentos: ${error.message}`, true);
    console.error('Falha ao carregar atendimentos da API.', error);
    throw error;
  }
}

async function carregarProfissionais(perfil, selectId) {
  const select = document.getElementById(selectId);
  let payload;
  try {
    payload = await apiRequest(`/profissionais?perfil_acesso=${encodeURIComponent(perfil)}`);
  } catch (error) {
    toast(`Não foi possível carregar os profissionais: ${error.message}`, true);
    throw error;
  }
  const profissionais = Array.isArray(payload.dados) ? payload.dados : [];
  profissionais.forEach((profissional) => {
    const option = document.createElement('option');
    option.value = profissional.id_profissional;
    option.textContent = `${profissional.nome_completo} — ${profissional.cargo}`;
    select.appendChild(option);
  });
  if (profissionais.length === 0) {
    select.disabled = true;
    toast(`Cadastre um profissional ativo com perfil "${perfil}" para continuar.`, true);
  }
  return profissionais;
}

async function salvarAtendimentos(lista) {
  if (!Array.isArray(lista)) throw new Error('Lista de atendimentos inválida');
  const atual = new Set(lista.map((item) => item.id).filter(Boolean));

  try {
    for (const item of lista) {
      const previous = item.id ? persistedAtendimentos.get(item.id) : null;
      const serialized = JSON.stringify(item);
      if (!previous) {
        const payload = await apiRequest('/atendimentos', {
          method: 'POST',
          body: JSON.stringify(item)
        });
        Object.assign(item, payload.dados);
      } else if (previous !== serialized) {
        const payload = await apiRequest(`/atendimentos/${encodeURIComponent(item.id)}`, {
          method: 'PUT',
          body: JSON.stringify(item)
        });
        Object.assign(item, payload.dados);
      }
      atual.add(item.id);
      persistedAtendimentos.set(item.id, JSON.stringify(item));
    }

    for (const [id] of persistedAtendimentos) {
      if (atual.has(id)) continue;
      await apiRequest(`/atendimentos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      persistedAtendimentos.delete(id);
    }
    atendimentos = lista;
    return atendimentos;
  } catch (error) {
    toast(`Não foi possível salvar: ${error.message}`, true);
    console.error('Falha ao salvar atendimentos na API.', error);
    throw error;
  }
}

function proximoNumero() {
  return null;
}

const MANCHESTER_ORDEM = { vermelho:1, laranja:2, amarelo:3, verde:4, azul:5 };
const MANCHESTER_LABEL = {
  vermelho:'🔴 Vermelho', laranja:'🟠 Laranja', amarelo:'🟡 Amarelo', verde:'🟢 Verde', azul:'🔵 Azul'
};
const STATUS_LABEL = {
  'aguardando-recepcao':'Aguardando Recepção',
  'aguardando-triagem':'Aguardando Triagem',
  'aguardando-medico':'Aguardando Médico',
  'em-atendimento':'Em Atendimento',
  'em-observacao':'Em Observação',
  'confirmado':'Alta médica',
  'cancelado':'Cancelado'
};

function toast(msg, isErr=false){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(()=> t.className = 'toast', 3500);
}

function confirmarModal(titulo, texto){
  return new Promise(resolve=>{
    const bg = document.getElementById('modal-bg');
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-text').textContent = texto;
    bg.classList.add('show');
    const onConfirm = ()=>{ cleanup(); resolve(true); };
    const onCancel = ()=>{ cleanup(); resolve(false); };
    function cleanup(){
      bg.classList.remove('show');
      document.getElementById('modal-confirm').removeEventListener('click', onConfirm);
      document.getElementById('modal-cancel').removeEventListener('click', onCancel);
    }
    document.getElementById('modal-confirm').addEventListener('click', onConfirm);
    document.getElementById('modal-cancel').addEventListener('click', onCancel);
  });
}

function calcularIdade(dataNasc){
  if(!dataNasc) return '';
  const nasc = new Date(dataNasc + 'T00:00:00');
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if(m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade + ' anos';
}
function formatarData(iso){
  if (!iso) return '-';
  const [y,m,d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function atualizarRelogio(){
  const el = document.getElementById('relogio');
  if(el) el.textContent = new Date().toLocaleString('pt-BR');
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

window.carregarAtendimentos = carregarAtendimentos;
window.carregarProfissionais = carregarProfissionais;
window.salvarAtendimentos = salvarAtendimentos;
