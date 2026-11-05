const ICONS = {
  success: '✓',
  error: '×',
  warning: '!',
  info: 'i'
};
const LABELS = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Atenção',
  info: 'Informação'
};

let host;
let confirmationQueue = Promise.resolve();

function notificationHost() {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'notification-stack';
  host.setAttribute('aria-label', 'Notificações');
  document.body.appendChild(host);
  return host;
}

export function showNotification(type, message, { duration = 5000 } = {}) {
  if (!Object.hasOwn(ICONS, type)) throw new TypeError(`Tipo de notificação desconhecido: ${type}`);

  const notification = document.createElement('section');
  notification.className = `notification notification-${type}`;
  notification.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  notification.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');
  notification.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[type];

  const content = document.createElement('div');
  content.className = 'notification-content';
  const title = document.createElement('strong');
  title.textContent = LABELS[type];
  const text = document.createElement('p');
  text.textContent = String(message);
  content.append(title, text);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'notification-close';
  close.setAttribute('aria-label', 'Fechar notificação');
  close.textContent = '×';

  let timer;
  const remove = () => {
    window.clearTimeout(timer);
    notification.remove();
  };
  close.addEventListener('click', remove);
  notification.addEventListener('mouseenter', () => window.clearTimeout(timer));
  notification.addEventListener('mouseleave', startTimer);
  notification.addEventListener('focusin', () => window.clearTimeout(timer));
  notification.addEventListener('focusout', startTimer);
  notification.append(icon, content, close);
  notificationHost().appendChild(notification);

  function startTimer() {
    if (duration > 0) timer = window.setTimeout(remove, duration);
  }
  startTimer();
  return notification;
}

export function formatApiError(status, payload) {
  const detail = payload && typeof payload.erro === 'string' ? payload.erro.trim() : '';
  const messages = {
    400: detail ? `Confira os dados informados: ${detail}.` : 'Confira os dados e tente novamente.',
    401: 'Sua sessão expirou ou os dados de acesso estão incorretos. Entre novamente.',
    403: 'Você não tem permissão para realizar esta ação.',
    404: 'O registro solicitado não foi encontrado. Atualize a tela e tente novamente.',
    409: 'Não foi possível salvar porque o registro já existe ou está vinculado a outro dado.',
    413: 'Os dados enviados são grandes demais. Revise as informações e tente novamente.',
    429: 'Muitas tentativas em sequência. Aguarde um momento e tente novamente.',
    500: 'O sistema teve uma falha ao acessar os dados. Tente novamente; se persistir, contate o suporte.'
  };
  if (status === 400 && detail) return messages[400];
  return messages[status] || 'Não foi possível concluir a operação. Tente novamente.';
}

function openConfirmation({ title, message, confirmLabel, cancelLabel, destructive }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-bg show';
    const dialog = document.createElement('section');
    dialog.className = 'modal notification-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirmation-title');
    dialog.setAttribute('aria-describedby', 'confirmation-message');
    dialog.tabIndex = -1;

    const heading = document.createElement('h2');
    heading.id = 'confirmation-title';
    heading.textContent = title;
    const body = document.createElement('p');
    body.id = 'confirmation-message';
    body.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-secondary';
    cancel.textContent = cancelLabel;
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = destructive ? 'btn btn-danger' : 'btn btn-primary';
    confirm.textContent = confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(heading, body, actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(result);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === cancel ? confirm : cancel).focus();
      }
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish(false);
    });
    document.addEventListener('keydown', onKeydown);
    cancel.focus();
  });
}

export function confirmDialog({
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false
}) {
  const task = confirmationQueue.then(() => openConfirmation({
    title, message, confirmLabel, cancelLabel, destructive
  }));
  confirmationQueue = task.then(() => undefined, () => undefined);
  return task;
}

if (typeof window !== 'undefined') {
  window.NotificationService = Object.freeze({
    show: showNotification,
    confirm: confirmDialog,
    formatApiError
  });
  for (const [type, message] of window.pendingNotifications || []) {
    showNotification(type, message);
  }
  delete window.pendingNotifications;
}
