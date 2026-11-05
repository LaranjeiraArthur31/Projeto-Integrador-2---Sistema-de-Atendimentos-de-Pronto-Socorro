import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCPF,
  formatCouncil,
  formatRG,
  isValidCPF,
  isValidCouncil,
  isValidRG,
  unmaskDocument,
  validateDocument
} from '../web/comum/documentos.js';

test('CPF formata progressivamente, aceita colagem e remove a máscara', () => {
  assert.equal(formatCPF('123'), '123');
  assert.equal(formatCPF('1234'), '123.4');
  assert.equal(formatCPF('52998224725'), '529.982.247-25');
  assert.equal(formatCPF('529.982.247-25'), '529.982.247-25');
  assert.equal(unmaskDocument('529.982.247-25', 'cpf'), '52998224725');
});

test('CPF valida dígitos verificadores e rejeita incompletos e sequências repetidas', () => {
  assert.equal(isValidCPF('52998224725'), true);
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(validateDocument('5299822472', 'cpf'), false);
  assert.equal(isValidCPF('52998224724'), false);
  assert.equal(isValidCPF('11111111111'), false);
  assert.equal(isValidCPF('abc52998224725'), false);
});

test('RG aplica a máscara progressiva e aceita X somente como verificador final', () => {
  assert.equal(formatRG('123'), '12.3');
  assert.equal(formatRG('12345678'), '12.345.678');
  assert.equal(formatRG('12345678x'), '12.345.678-X');
  assert.equal(formatRG('12.345.678-X'), '12.345.678-X');
  assert.equal(unmaskDocument('12.345.678-X', 'rg'), '12345678X');
  assert.equal(isValidRG('12345678'), true);
  assert.equal(isValidRG('12345678X'), true);
  assert.equal(isValidRG('1234567X'), true);
  assert.equal(isValidRG('12.345.67-X'), true);
  assert.equal(isValidRG('1234567'), false);
  assert.equal(isValidRG('1234567X8'), false);
});

test('CRM e COREN formatam e validam UF existente no padrão de cada conselho', () => {
  assert.equal(formatCouncil('123', 'crm'), '123');
  assert.equal(formatCouncil('123456sp', 'crm'), '123456/SP');
  assert.equal(formatCouncil('123456-sp', 'coren'), '123456-SP');
  assert.equal(unmaskDocument('123456/SP', 'crm'), '123456SP');
  assert.equal(isValidCouncil('123456/SP', 'crm'), true);
  assert.equal(isValidCouncil('123456-SP', 'coren'), true);
  assert.equal(isValidCouncil('123456/XX', 'crm'), false);
  assert.equal(isValidCouncil('12345/SP', 'crm'), false);
  assert.equal(isValidCouncil('123456/SP', 'coren'), false);
});
