/* ============================================================
   COMUM.JS — estado, persistência e utilitários compartilhados
   ============================================================ */
const STORAGE_KEY = 'ps_atendimentos_v1';
const STORAGE_SEQ = 'ps_sequencia_v1';
const API_BASE_URL = 'http://localhost:3000';

async function carregarAtendimentos(){
  try {
    const resposta = await fetch(`${API_BASE_URL}/atendimentos`);
    if (!resposta.ok) throw new Error('API indisponível');

    const payload = await resposta.json();
    const lista = payload.dados || payload.atendimentos || [];
    atendimentos = Array.isArray(lista) ? lista : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atendimentos));
    return atendimentos;
  } catch (erro) {
    console.warn('Falha ao carregar atendimentos da API. Usando dados locais.', erro);
    try {
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      atendimentos = Array.isArray(local) ? local : [];
    } catch (_erro) {
      atendimentos = [];
    }
    return atendimentos;
  }
}

async function salvarAtendimentos(lista){
  atendimentos = Array.isArray(lista) ? lista : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atendimentos));

  try {
    await fetch(`${API_BASE_URL}/atendimentos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atendimentos: atendimentos })
    });
  } catch (erro) {
    console.warn('Não foi possível sincronizar com a API.', erro);
  }
}

function proximoNumero(){
  let seq = parseInt(localStorage.getItem(STORAGE_SEQ) || '0', 10);
  seq += 1;
  localStorage.setItem(STORAGE_SEQ, String(seq));
  return 'AT' + String(seq).padStart(4, '0');
}

let atendimentos = [];

const MANCHESTER_ORDEM = { vermelho:1, laranja:2, amarelo:3, verde:4, azul:5 };
const MANCHESTER_LABEL = {
  vermelho:'🔴 Vermelho', laranja:'🟠 Laranja', amarelo:'🟡 Amarelo', verde:'🟢 Verde', azul:'🔵 Azul'
};
const STATUS_LABEL = {
  'aguardando-recepcao':'Aguardando Recepção',
  'aguardando-triagem':'Aguardando Triagem',
  'aguardando-medico':'Aguardando Médico',
  'em-atendimento':'Em Atendimento',
  'confirmado':'Confirmado',
  'cancelado':'Cancelado'
};

/* ---------- TOAST + MODAL ---------- */
function toast(msg, isErr=false){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(()=> t.className = 'toast', 2200);
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

/* ---------- FORMATAÇÃO ---------- */
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
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ---------- RELÓGIO ---------- */
function atualizarRelogio(){
  const el = document.getElementById('relogio');
  if(el) el.textContent = new Date().toLocaleString('pt-BR');
}
setInterval(atualizarRelogio, 1000);
atualizarRelogio();

window.carregarAtendimentos = carregarAtendimentos;
window.salvarAtendimentos = salvarAtendimentos;
