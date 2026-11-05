export const UFS = Object.freeze([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
]);

const MASKS = {
  cpf: {
    format: formatCPF,
    unmask: unmaskCPF,
    validate: isValidCPF,
    maxLength: 14,
    inputMode: 'numeric',
    invalidMessage: 'O CPF precisa ter 11 números e dígitos verificadores corretos. Confira se digitou todos os números na ordem certa.'
  },
  rg: {
    format: formatRG,
    unmask: unmaskRG,
    validate: isValidRG,
    maxLength: 12,
    inputMode: 'numeric',
    invalidMessage: 'Informe um RG com 8 ou 9 caracteres; o último pode ser X.'
  },
  crm: {
    format: (value) => formatCouncil(value, 'crm'),
    unmask: unmaskCouncil,
    validate: (value) => isValidCouncil(value, 'crm'),
    maxLength: 9,
    inputMode: 'text',
    invalidMessage: 'Informe o CRM com 6 dígitos e uma UF válida (ex.: 123456/SP).'
  },
  coren: {
    format: (value) => formatCouncil(value, 'coren'),
    unmask: unmaskCouncil,
    validate: (value) => isValidCouncil(value, 'coren'),
    maxLength: 9,
    inputMode: 'text',
    invalidMessage: 'Informe o COREN com 6 dígitos e uma UF válida (ex.: 123456-SP).'
  }
};
const inputControllers = new WeakMap();

function text(value) {
  return String(value ?? '').toUpperCase();
}

export function unmaskCPF(value) {
  return text(value).replace(/\D/g, '').slice(0, 11);
}

export function formatCPF(value) {
  const digits = unmaskCPF(value);
  let formatted = digits.slice(0, 3);
  if (digits.length > 3) formatted += `.${digits.slice(3, 6)}`;
  if (digits.length > 6) formatted += `.${digits.slice(6, 9)}`;
  if (digits.length > 9) formatted += `-${digits.slice(9, 11)}`;
  return formatted;
}

export function isValidCPF(value) {
  const source = text(value).trim();
  if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(source)) return false;
  const digits = unmaskCPF(source);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length) => {
    const sum = digits.slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };

  return digits[9] === checkDigit(9) && digits[10] === checkDigit(10);
}

export function unmaskRG(value) {
  const tokens = text(value).replace(/[^0-9X]/g, '').slice(0, 9);
  if (!tokens.includes('X')) return tokens;
  if (tokens.endsWith('X')) return `${tokens.slice(0, -1).replace(/X/g, '').slice(0, 8)}X`;
  return tokens.replace(/X/g, '').slice(0, 9);
}

export function formatRG(value) {
  const tokens = unmaskRG(value);
  const hasCheckDigit = tokens.length === 9 || tokens.endsWith('X');
  const body = hasCheckDigit ? tokens.slice(0, -1) : tokens;
  let formatted = body.slice(0, 2);
  if (body.length > 2) formatted += `.${body.slice(2, 5)}`;
  if (body.length > 5) formatted += `.${body.slice(5, 8)}`;
  if (hasCheckDigit) formatted += `-${tokens.at(-1)}`;
  return formatted;
}

export function isValidRG(value) {
  const tokens = unmaskRG(value);
  if (!/^(?:\d{8}|\d{7}[0-9X]|\d{8}[0-9X])$/.test(tokens)) return false;
  const source = text(value).trim();
  return /^(?:\d{8,9}|\d{7,8}X)$/.test(source) || formatRG(tokens) === source;
}

function councilParts(value) {
  const source = text(value).trim();
  const compact = source.replace(/[\s/-]/g, '');
  const match = compact.match(/^(\d{0,6})([A-Z]{0,2})$/);
  return match ? { digits: match[1], uf: match[2] } : { digits: '', uf: '' };
}

export function unmaskCouncil(value) {
  const { digits, uf } = councilParts(value);
  return `${digits}${uf}`;
}

export function formatCouncil(value, type) {
  const { digits, uf } = councilParts(value);
  const separator = type === 'coren' ? '-' : '/';
  return `${digits}${digits.length === 6 ? separator : ''}${uf}`;
}

export function isValidCouncil(value, type) {
  const source = text(value).trim();
  const separator = type === 'coren' ? '-' : '/';
  if (!new RegExp(`^\\d{6}(?:${separator})?[A-Z]{2}$`).test(source)) return false;
  const { digits, uf } = councilParts(source);
  return digits.length === 6 && UFS.includes(uf);
}

export function formatDocument(value, type) {
  return MASKS[type]?.format(value) ?? '';
}

export function unmaskDocument(value, type) {
  return MASKS[type]?.unmask(value) ?? '';
}

export function validateDocument(value, type) {
  return MASKS[type]?.validate(value) ?? false;
}

export function normalizeDocument(value, type) {
  return unmaskDocument(value, type);
}

function documentType(input) {
  return input.dataset.document === 'conselho'
    ? input.dataset.documentType
    : input.dataset.document;
}

function validationMessage(input, type) {
  if (!input.value && !input.required) return '';
  if (!input.value && input.required) return 'Este campo é obrigatório.';
  if (type === 'cpf' && unmaskCPF(input.value).length < 11) {
    return 'Digite os 11 números do CPF.';
  }
  if (validateDocument(input.value, type)) return '';
  return MASKS[type]?.invalidMessage ?? 'Documento inválido.';
}

export function initializeMaskedInput(input) {
  const existingController = inputControllers.get(input);
  if (existingController) return existingController;
  const type = documentType(input);
  const mask = MASKS[type];
  if (!mask) throw new TypeError(`Tipo de documento desconhecido: ${type}`);

  input.maxLength = mask.maxLength;
  input.inputMode = mask.inputMode;
  input.autocomplete = 'off';

  let touched = false;
  let error = input.id ? document.getElementById(`${input.id}-error`) : null;
  if (!error) {
    error = document.createElement('span');
    error.id = `${input.id}-error`;
    error.className = 'document-error';
    error.setAttribute('aria-live', 'polite');
    input.insertAdjacentElement('afterend', error);
  }
  const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  input.setAttribute('aria-describedby', [...describedBy].join(' '));

  const updateValidation = (showError = touched) => {
    const currentType = documentType(input);
    const errorMessage = validationMessage(input, currentType);
    input.setCustomValidity(errorMessage);
    input.setAttribute('aria-invalid', String(Boolean(errorMessage)));
    error.textContent = showError ? errorMessage : '';
  };

  input.addEventListener('input', () => {
    const currentType = documentType(input);
    const start = input.selectionStart ?? input.value.length;
    const prefix = input.value.slice(0, start);
    const formattedPrefix = formatDocument(prefix, currentType);
    const formatted = formatDocument(input.value, currentType);
    input.value = formatted;
    const position = Math.min(formattedPrefix.length, formatted.length);
    input.setSelectionRange(position, position);
    updateValidation();
  });
  input.addEventListener('blur', () => {
    touched = true;
    updateValidation(true);
  });
  input.addEventListener('invalid', () => {
    touched = true;
    updateValidation(true);
  });
  input.form?.addEventListener('reset', () => {
    touched = false;
    input.setCustomValidity('');
    input.setAttribute('aria-invalid', 'false');
    error.textContent = '';
  });
  updateValidation(false);

  const controller = {
    format: () => formatDocument(input.value, documentType(input)),
    raw: () => unmaskDocument(input.value, documentType(input)),
    setValue: (value) => {
      input.value = formatDocument(value, documentType(input));
      updateValidation();
    },
    setType: (nextType) => {
      if (!MASKS[nextType]) throw new TypeError(`Tipo de documento desconhecido: ${nextType}`);
      input.dataset.documentType = nextType;
      input.maxLength = MASKS[nextType].maxLength;
      input.inputMode = MASKS[nextType].inputMode;
      input.value = formatDocument(input.value, nextType);
      updateValidation();
    }
  };
  inputControllers.set(input, controller);
  return controller;
}

export function initializeMaskedInputs(root = document) {
  return [...root.querySelectorAll('[data-document]')].map(initializeMaskedInput);
}

export function setDocumentInputValue(input, value) {
  const controller = inputControllers.get(input) ?? initializeMaskedInput(input);
  controller.setValue(value);
}

if (typeof window !== 'undefined') {
  window.DocumentMasks = Object.freeze({
    formatDocument,
    unmaskDocument,
    validateDocument,
    initializeMaskedInputs,
    setInputValue: setDocumentInputValue
  });
  initializeMaskedInputs();
}
