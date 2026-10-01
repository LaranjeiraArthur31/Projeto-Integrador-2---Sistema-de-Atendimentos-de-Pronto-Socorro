import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createApp } from '../services/server.js';

test('createApp deve montar as rotas do sistema hospitalar', () => {
  const app = createApp();
  assert.ok(app instanceof express.application.constructor);

  const routes = app._router?.stack || [];
  const hasPacientesRoute = routes.some((layer) => {
    return layer.route && layer.route.path === '/pacientes';
  });

  const hasAtendimentosRoute = routes.some((layer) => {
    return layer.route && layer.route.path === '/atendimentos';
  });

  assert.equal(hasPacientesRoute, true);
  assert.equal(hasAtendimentosRoute, true);
});
