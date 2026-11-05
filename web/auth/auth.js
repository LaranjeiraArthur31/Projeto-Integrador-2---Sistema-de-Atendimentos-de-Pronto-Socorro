import { normalizeDocument, validateDocument } from '../comum/documentos.js';
import { formatApiError, showNotification } from '../comum/notificacoes.js';

const form = document.querySelector('form');
const message = document.getElementById('mensagem');
const registering = form.id === 'cadastro-form';
const councilInput = document.getElementById('registro_conselho');
const cargoInput = document.getElementById('cargo');

if (registering) {
  const councilField = councilInput.closest('.field');
  const updateCouncilType = () => {
    const type = cargoInput.value === 'Medico' ? 'crm' : 'coren';
    const applicable = ['Medico', 'Enfermeiro'].includes(cargoInput.value);
    councilField.hidden = !applicable;
    councilInput.disabled = !applicable;
    councilInput.dataset.documentType = type;
    councilInput.value = window.DocumentMasks.formatDocument(councilInput.value, type);
    councilInput.setCustomValidity(
      councilInput.value && !validateDocument(councilInput.value, type)
        ? type === 'crm'
          ? 'Informe o CRM com 6 dígitos e uma UF válida (ex.: 123456/SP).'
          : 'Informe o COREN com 6 dígitos e uma UF válida (ex.: 123456-SP).'
        : ''
    );
    const invalid = Boolean(councilInput.validationMessage);
    councilInput.setAttribute('aria-invalid', String(invalid));
    document.getElementById('registro_conselho-error').textContent = invalid
      ? councilInput.validationMessage
      : '';
  };
  cargoInput.addEventListener('change', updateCouncilType);
  updateCouncilType();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  message.className = 'auth-message';
  if (registering) {
    data.cpf = normalizeDocument(data.cpf, 'cpf');
    if (data.registro_conselho) {
      data.registro_conselho = normalizeDocument(
        data.registro_conselho,
        cargoInput.value === 'Medico' ? 'crm' : 'coren'
      );
    }
  }
  if (registering && data.senha !== data.confirmacao) {
    message.textContent = 'As senhas não coincidem.';
    showNotification('warning', 'As senhas não coincidem. Confira os dois campos.');
    return;
  }
  delete data.confirmacao;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  message.textContent = registering ? 'Criando sua conta...' : 'Entrando...';
  try {
    const response = await fetch(registering ? '/auth/cadastro' : '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(formatApiError(response.status, payload));
    if (registering) {
      form.reset();
      message.className = 'auth-message success';
      message.textContent = 'Conta criada! Use o link Entrar abaixo para acessar sua área.';
      showNotification('success', 'Conta criada. Use o link Entrar abaixo para acessar sua área.');
    } else {
      window.location.replace(payload.destino);
    }
  } catch (error) {
    const friendlyMessage = error instanceof TypeError
      ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
      : error.message;
    message.textContent = friendlyMessage;
    showNotification('error', friendlyMessage);
  } finally {
    button.disabled = false;
  }
});
