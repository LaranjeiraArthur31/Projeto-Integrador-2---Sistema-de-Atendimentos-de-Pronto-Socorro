import express from 'express';
import cors from 'cors';
import {
  pacienteController,
  prontuarioController,
  profissionalController,
  atendimentoController,
  triagemController
} from './controllers.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/pacientes', pacienteController.listar);
  app.get('/pacientes/:id', pacienteController.buscarPorId);
  app.post('/pacientes', pacienteController.criar);
  app.put('/pacientes/:id', pacienteController.atualizar);
  app.delete('/pacientes/:id', pacienteController.remover);

  app.get('/prontuarios', prontuarioController.listar);
  app.get('/prontuarios/:id', prontuarioController.buscarPorId);
  app.post('/prontuarios', prontuarioController.criar);
  app.put('/prontuarios/:id', prontuarioController.atualizar);
  app.delete('/prontuarios/:id', prontuarioController.remover);

  app.get('/profissionais', profissionalController.listar);
  app.get('/profissionais/:id', profissionalController.buscarPorId);
  app.post('/profissionais', profissionalController.criar);
  app.put('/profissionais/:id', profissionalController.atualizar);
  app.delete('/profissionais/:id', profissionalController.remover);

  app.get('/atendimentos', atendimentoController.listar);
  app.get('/atendimentos/:id', atendimentoController.buscarPorId);
  app.post('/atendimentos', atendimentoController.criar);
  app.put('/atendimentos', atendimentoController.sincronizarLista);
  app.put('/atendimentos/:id', atendimentoController.atualizar);
  app.delete('/atendimentos/:id', atendimentoController.remover);

  app.get('/triagens', triagemController.listar);
  app.get('/triagens/:id', triagemController.buscarPorId);
  app.post('/triagens', triagemController.criar);
  app.put('/triagens/:id', triagemController.atualizar);
  app.delete('/triagens/:id', triagemController.remover);

  return app;
}

export default createApp();

