import test from 'node:test';
import assert from 'node:assert/strict';
import { formatApiError } from '../web/comum/notificacoes.js';

test('erros da API são apresentados em português com orientação acionável', () => {
  assert.equal(
    formatApiError(400, { erro: 'O CPF precisa ter 11 números e dígitos verificadores corretos' }),
    'Confira os dados informados: O CPF precisa ter 11 números e dígitos verificadores corretos.'
  );
  assert.match(formatApiError(409, { erro: 'conflito interno' }), /já existe ou está vinculado/);
  assert.match(formatApiError(500, { erro: { detalhe: 'sql raw' } }), /contate o suporte/);
  assert.match(formatApiError(401, null), /Entre novamente/);
});
