/* ============================================================
   COMUM.JS — estado, persistência e utilitários compartilhados
   ============================================================ */
const STORAGE_KEY = 'ps_atendimentos_v1';
const STORAGE_SEQ = 'ps_sequencia_v1';

function carregarAtendimentos(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function salvarAtendimentos(lista){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}
function proximoNumero(){
  let seq = parseInt(localStorage.getItem(STORAGE_SEQ) || '0', 10);
  seq += 1;
  localStorage.setItem(STORAGE_SEQ, String(seq));
  return 'AT' + String(seq).padStart(4, '0');
}

let atendimentos = carregarAtendimentos();

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

/* ============================================================
   DADOS DE EXEMPLO (apenas na primeira execução)
   ============================================================ */
function semear(){
  if(atendimentos.length > 0) return; // não sobrescreve dados já existentes no navegador

  const agora = Date.now();
  const minAtras = m => new Date(agora - m*60000).toISOString();

  const exemplos = [
    {
      nome:'Marcos Vinícius Andrade', nascimento:'1958-03-11', rg:'22.104.887-5', cpf:'104.552.998-30',
      pai:'José Andrade', mae:'Lúcia Andrade', endereco:'Rua das Palmeiras, 210 — Jardim Ipê, Campinas/SP', telefone:'(19) 98211-4402',
      criadoEm: minAtras(52), status:'aguardando-medico',
      triagem:{ pa:'160/100 mmHg', temp:'37.1', bpm:'104', queixas:'Dor forte no peito, falta de ar, sudorese', classificacao:'vermelho' }
    },
    {
      nome:'Beatriz Ferreira Lima', nascimento:'1996-07-24', rg:'41.998.220-1', cpf:'398.117.664-05',
      pai:'Carlos Lima', mae:'Sandra Ferreira', endereco:'Av. Brasil, 1340, apto 62 — Centro, Campinas/SP', telefone:'(19) 99042-7715',
      criadoEm: minAtras(38), status:'aguardando-medico',
      triagem:{ pa:'128/84 mmHg', temp:'38.9', bpm:'92', queixas:'Febre alta, dor abdominal intensa, vômitos', classificacao:'laranja' }
    },
    {
      nome:'Otávio Ribeiro Souza', nascimento:'2014-11-02', rg:'—', cpf:'—',
      pai:'Fernando Souza', mae:'Patrícia Ribeiro', endereco:'Rua Guarani, 88 — Vila Industrial, Campinas/SP', telefone:'(19) 98877-3021',
      criadoEm: minAtras(29), status:'aguardando-medico',
      triagem:{ pa:'102/68 mmHg', temp:'37.8', bpm:'110', queixas:'Queda da própria altura, dor e inchaço no braço direito', classificacao:'amarelo' }
    },
    {
      nome:'Juliana Prado Martins', nascimento:'1989-01-30', rg:'35.660.412-9', cpf:'256.884.170-91',
      pai:'Antônio Martins', mae:'Rosa Prado', endereco:'Rua Barão de Itapura, 552 — Botafogo, Campinas/SP', telefone:'(19) 99765-0188',
      criadoEm: minAtras(21), status:'aguardando-medico',
      triagem:{ pa:'118/76 mmHg', temp:'36.9', bpm:'80', queixas:'Dor lombar após esforço, sem irradiação', classificacao:'verde' }
    },
    {
      nome:'Heitor Alves Nogueira', nascimento:'2001-05-17', rg:'48.223.109-7', cpf:'412.093.556-40',
      pai:'Ricardo Nogueira', mae:'Camila Alves', endereco:'Rua Tamoios, 77 — Cambuí, Campinas/SP', telefone:'(19) 98120-6634',
      criadoEm: minAtras(14), status:'aguardando-medico',
      triagem:{ pa:'110/70 mmHg', temp:'36.6', bpm:'72', queixas:'Renovação de atestado, corte superficial no dedo já cicatrizado', classificacao:'azul' }
    },
    {
      nome:'Rosana Cardoso Teixeira', nascimento:'1972-09-08', rg:'19.887.502-3', cpf:'187.335.902-14',
      pai:'Manoel Teixeira', mae:'Ivone Cardoso', endereco:'Rua Coronel Quirino, 900 — Cambuí, Campinas/SP', telefone:'(19) 99311-8820',
      criadoEm: minAtras(95), status:'confirmado',
      triagem:{ pa:'150/95 mmHg', temp:'37.4', bpm:'98', queixas:'Dor de cabeça intensa e visão turva', classificacao:'laranja' },
      medico:{ medicacoes:'Dipirona 1g EV, Captopril 25mg VO', observacoes:'Crise hipertensiva controlada. Orientada a retorno com clínico geral em 7 dias.' }
    },
    {
      nome:'Gabriel Souza Pinto', nascimento:'1965-12-19', rg:'27.410.775-8', cpf:'223.667.410-52',
      pai:'Waldemar Pinto', mae:'Neusa Souza', endereco:'Rua Sacramento, 145 — Ponte Preta, Campinas/SP', telefone:'(19) 98456-2290',
      criadoEm: minAtras(140), status:'confirmado',
      triagem:{ pa:'132/88 mmHg', temp:'38.1', bpm:'88', queixas:'Tosse persistente e febre há 3 dias', classificacao:'verde' },
      medico:{ medicacoes:'Paracetamol 750mg VO 6/6h por 3 dias', observacoes:'Quadro compatível com IVAS. Sem sinais de gravidade. Alta com orientações.' }
    },
    {
      nome:'Cecília Moraes Duarte', nascimento:'1993-04-05', rg:'39.552.017-4', cpf:'334.219.087-66',
      pai:'Luiz Duarte', mae:'Marta Moraes', endereco:'Rua José Paulino, 310 — Centro, Campinas/SP', telefone:'(19) 99623-4471',
      criadoEm: minAtras(180), status:'cancelado',
      triagem:null
    },
    {
      nome:'Vinícius Torres Barbosa', nascimento:'2009-08-27', rg:'—', cpf:'—',
      pai:'Eduardo Barbosa', mae:'Aline Torres', endereco:'Rua Álvares Machado, 60 — Cambuí, Campinas/SP', telefone:'(19) 98890-1123',
      criadoEm: minAtras(6), status:'aguardando-triagem',
      triagem:null
    },
    {
      nome:'Sônia Aparecida Ramos', nascimento:'1949-02-14', rg:'11.774.320-6', cpf:'098.221.774-88',
      pai:'Benedito Ramos', mae:'Ester Ramos', endereco:'Rua General Osório, 415 — Vila Nova, Campinas/SP', telefone:'(19) 99087-5540',
      criadoEm: minAtras(3), status:'aguardando-triagem',
      triagem:null
    }
  ];

  exemplos.forEach(ex=>{
    ex.id = proximoNumero();
    ex.medico = ex.medico || null;
    atendimentos.push(ex);
  });

  atendimentos.sort((a,b)=> new Date(b.criadoEm) - new Date(a.criadoEm));
  salvarAtendimentos(atendimentos);
}
semear();
