const form = document.querySelector('form');
const message = document.getElementById('mensagem');
const registering = form.id === 'cadastro-form';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  message.className = 'auth-message';
  if (registering && data.senha !== data.confirmacao) {
    message.textContent = 'As senhas não coincidem.';
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
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.erro || 'Não foi possível concluir a operação.');
    if (registering) {
      form.reset();
      message.className = 'auth-message success';
      message.textContent = 'Conta criada! Use o link Entrar abaixo para acessar sua área.';
    } else {
      window.location.replace(payload.destino);
    }
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
