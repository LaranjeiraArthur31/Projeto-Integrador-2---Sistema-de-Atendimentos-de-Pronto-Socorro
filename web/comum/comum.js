/* ============================================================
   COMUM.JS — estado, API e utilitários compartilhados
   ============================================================ */
const API_BASE_URL = window.location.origin;

let atendimentos = [];
let persistedAtendimentos = new Map();
const sessao = carregarSessao();

async function carregarSessao() {
  const payload = await apiRequest('/auth/me');
  const user = payload.dados;
  const home = {
    Recepcionista: '/recepcao/recepcao.html',
    Enfermeiro: '/triagem/triagem.html',
    Medico: '/medico/medico.html'
  }[user.cargo];
  document.querySelectorAll('.sidebar nav a').forEach((link) => {
    const path = new URL(link.href).pathname;
    if (path !== home && path !== '/painel/painel.html') link.remove();
  });
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const account = document.createElement('div');
    account.className = 'conta';
    const name = document.createElement('strong');
    name.textContent = user.nome_completo;
    const role = document.createElement('span');
    role.textContent = user.cargo;
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'btn btn-secondary';
    logout.textContent = 'Sair';
    logout.addEventListener('click', async () => {
      try {
        await apiRequest('/auth/logout', { method: 'POST' });
        window.location.replace('/auth/login.html');
      } catch (error) { toast(error.message, true); }
    });
    account.append(name, role, logout);
    sidebar.appendChild(account);
  }
  document.body.classList.add('autenticado');
  return user;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    if (response.status === 401) window.location.replace('/auth/login.html');
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.erro || `Falha na API (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function carregarAtendimentos() {
  try {
    await sessao;
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
  const user = await sessao;
  const profissionais = [user];
  select.replaceChildren();
  profissionais.forEach((profissional) => {
    const option = document.createElement('option');
    option.value = profissional.id_profissional;
    option.textContent = `${profissional.nome_completo} — ${profissional.cargo}`;
    select.appendChild(option);
  });
  select.value = String(user.id_profissional);
  select.disabled = true;
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
    const user = await sessao;
    for (const item of lista) {
      const previous = item.id ? persistedAtendimentos.get(item.id) : null;
      const serialized = JSON.stringify(item);
      if (!previous) {
        const fields = ['nome', 'cpf', 'rg', 'mae', 'pai', 'nascimento', 'sexo', 'telefone', 'endereco'];
        const data = Object.fromEntries(fields.filter((field) => Object.hasOwn(item, field)).map((field) => [field, item[field]]));
        const payload = await apiRequest('/atendimentos', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        Object.assign(item, payload.dados);
      } else if (previous !== serialized) {
        const fields = user.cargo === 'Recepcionista'
          ? ['nome', 'cpf', 'rg', 'mae', 'pai', 'nascimento', 'sexo', 'telefone', 'endereco']
          : user.cargo === 'Enfermeiro' ? ['triagem', 'status'] : ['medico', 'status'];
        const data = Object.fromEntries(fields.filter((field) => Object.hasOwn(item, field)).map((field) => [field, item[field]]));
        const payload = await apiRequest(`/atendimentos/${encodeURIComponent(item.id)}`, {
          method: 'PUT',
          body: JSON.stringify(data)
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
