import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITIES } from './repository.js';

const webPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');

function sendError(res, error) {
  if (error.message === 'Registro não encontrado' || error.message === 'Atendimento não encontrado') {
    return res.status(404).json({ erro: error.message });
  }
  if (error.code === '23505' || error.code === '23503') {
    return res.status(409).json({ erro: 'O registro viola uma restrição de unicidade ou relacionamento' });
  }
  if (error.code === '23514' || error.code === '22P02' || error.code === '23502' ||
      error.code === '22001' || error.message.includes('obrigatórios') ||
      error.message.includes('Nenhum campo válido') || error.message.includes('Cadastre um profissional') ||
      error.message.includes('Selecione um profissional') || error.message.includes('Status de atendimento inválido')) {
    const mensagem = error.message.includes('Cadastre um profissional') ||
      error.message.includes('Selecione um profissional')
      ? error.message
      : 'Dados inválidos ou campos obrigatórios ausentes';
    return res.status(400).json({ erro: mensagem });
  }
  console.error('Falha na API:', error);
  return res.status(500).json({ erro: 'Falha ao acessar os dados do sistema' });
}

function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function createApp(repository) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', asyncHandler(async (_req, res) => {
    await repository.health();
    res.json({ status: 'ok', banco: 'conectado' });
  }));

  for (const entityName of Object.keys(ENTITIES)) {
    if (entityName === 'atendimentos') continue;
    app.get(`/${entityName}`, asyncHandler(async (req, res) => {
      const filters = {};
      if (entityName === 'profissionais' && req.query.perfil_acesso) {
        filters.perfil_acesso = req.query.perfil_acesso;
      }
      const dados = await repository.listar(entityName, filters);
      res.json({ dados });
    }));
    app.get(`/${entityName}/:id`, asyncHandler(async (req, res) => {
      const dados = await repository.buscarPorId(entityName, req.params.id);
      if (!dados) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json({ dados });
    }));
    app.post(`/${entityName}`, asyncHandler(async (req, res) => {
      const dados = await repository.criar(entityName, req.body);
      res.status(201).json({ dados });
    }));
    app.put(`/${entityName}/:id`, asyncHandler(async (req, res) => {
      const dados = await repository.atualizar(entityName, req.params.id, req.body);
      if (!dados) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json({ dados });
    }));
    app.delete(`/${entityName}/:id`, asyncHandler(async (req, res) => {
      const removido = await repository.remover(entityName, req.params.id);
      if (!removido) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.status(204).end();
    }));
  }

  app.get('/atendimentos', asyncHandler(async (_req, res) => {
    res.json({ dados: await repository.listarAtendimentos() });
  }));
  app.get('/atendimentos/:codigo', asyncHandler(async (req, res) => {
    const dados = await repository.buscarAtendimentoPorCodigo(req.params.codigo);
    if (!dados) return res.status(404).json({ erro: 'Atendimento não encontrado' });
    res.json({ dados });
  }));
  app.post('/atendimentos', asyncHandler(async (req, res) => {
    res.status(201).json({ dados: await repository.salvarAtendimento(req.body) });
  }));
  app.put('/atendimentos/:codigo', asyncHandler(async (req, res) => {
    res.json({
      dados: await repository.salvarAtendimento({ ...req.body, id: req.params.codigo })
    });
  }));
  app.delete('/atendimentos/:codigo', asyncHandler(async (req, res) => {
    const cancelado = await repository.cancelarAtendimento(req.params.codigo);
    if (!cancelado) return res.status(404).json({ erro: 'Atendimento não encontrado' });
    res.status(204).end();
  }));

  app.get('/', (_req, res) => res.redirect('/recepcao/recepcao.html'));
  app.use(express.static(webPath));
  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ erro: 'JSON inválido' });
    }
    return next(error);
  });
  return app;
}

export default createApp;
