import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITIES } from './repository.js';
import { createAuth, HOME_BY_ROLE } from './auth.js';

const webPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');

function sendError(res, error) {
  if (error.code === 'FORBIDDEN') return res.status(403).json({ erro: error.message });
  if (error.message === 'Registro não encontrado' || error.message === 'Atendimento não encontrado') {
    return res.status(404).json({ erro: error.message });
  }
  if (['23505', '23503'].includes(error.code)) {
    return res.status(409).json({ erro: 'O registro viola uma restrição de unicidade ou relacionamento' });
  }
  if (['INVALID_DATA', '23502', '23514', '22P02', '22001',
    '22003', '22007', '22008'].includes(error.code)) {
    const mensagem = error.code === 'INVALID_DATA'
      ? error.message : 'Dados inválidos ou campos obrigatórios ausentes';
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
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  const auth = createAuth(repository);
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.get('host')}`) {
      return res.status(403).json({ erro: 'Origem da requisição não permitida' });
    }
    next();
  });

  app.get('/health', asyncHandler(async (_req, res) => {
    await repository.health();
    res.json({ status: 'ok', banco: 'conectado' });
  }));

  app.post('/auth/cadastro', auth.limit, asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
        !Object.hasOwn(HOME_BY_ROLE, body.cargo)) {
      return res.status(400).json({ erro: 'Informe um email válido e selecione um cargo' });
    }
    const fields = ['nome_completo', 'cpf', 'cargo', 'registro_conselho', 'especialidade', 'email', 'senha'];
    const data = Object.fromEntries(fields.filter((field) => Object.hasOwn(body, field))
      .map((field) => [field, body[field]]));
    const user = await repository.criar('profissionais', { ...data, ativo: true });
    res.status(201).json({ dados: user });
  }));
  app.post('/auth/login', auth.limit, asyncHandler(async (req, res) => {
    const user = await repository.autenticar(req.body?.email, req.body?.senha);
    if (!user) return res.status(401).json({ erro: 'Email ou senha inválidos, ou profissional inativo' });
    auth.start(req, res, user);
    res.json({ dados: user, destino: HOME_BY_ROLE[user.cargo] });
  }));
  app.use(auth.load);
  app.post('/auth/logout', (req, res) => {
    auth.logout(req, res);
    res.status(204).end();
  });
  app.get('/auth/me', (req, res) => {
    if (!req.user) return res.status(401).json({ erro: 'Faça login para continuar' });
    res.json({ dados: req.user, destino: HOME_BY_ROLE[req.user.cargo] });
  });
  const requireLogin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Faça login para continuar' });
    next();
  };
  const allow = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Faça login para continuar' });
    if (!roles.includes(req.user.cargo)) return res.status(403).json({ erro: 'Seu cargo não tem acesso a esta operação' });
    next();
  };
  const resourceRoles = {
    pacientes: ['Recepcionista'],
    profissionais: ['Recepcionista', 'Enfermeiro', 'Medico'],
    triagens: ['Enfermeiro'],
    'atendimentos-medicos': ['Medico']
  };
  for (const entityName of Object.keys(ENTITIES)) {
    app.use(`/${entityName}`, allow(...resourceRoles[entityName]));
    if (entityName === 'profissionais') {
      app.get('/profissionais', (req, res) => res.json({ dados: [req.user] }));
      app.get('/profissionais/:id', (req, res) => {
        if (String(req.user.id_profissional) !== req.params.id) {
          return res.status(403).json({ erro: 'Consulte apenas seu próprio cadastro' });
        }
        res.json({ dados: req.user });
      });
      app.use('/profissionais', (_req, res) => res.status(403).json({ erro: 'Utilize a tela de cadastro para criar uma conta' }));
      continue;
    }
    app.get(`/${entityName}`, asyncHandler(async (req, res) => {
      const filters = {};
      if (entityName === 'profissionais' && req.query.perfil_acesso) {
        filters.perfil_acesso = req.query.perfil_acesso;
      }
      if (entityName === 'profissionais' && req.query.cargo) {
        filters.cargo = req.query.cargo;
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
      const data = { ...req.body };
      if (entityName === 'triagens') data.id_enfermeiro = req.user.id_profissional;
      if (entityName === 'atendimentos-medicos') data.id_medico = req.user.id_profissional;
      const dados = await repository.criar(entityName, data);
      res.status(201).json({ dados });
    }));
    app.put(`/${entityName}/:id`, asyncHandler(async (req, res) => {
      const data = { ...req.body };
      if (entityName === 'triagens') data.id_enfermeiro = req.user.id_profissional;
      if (entityName === 'atendimentos-medicos') data.id_medico = req.user.id_profissional;
      const dados = await repository.atualizar(entityName, req.params.id, data);
      if (!dados) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.json({ dados });
    }));
    app.delete(`/${entityName}/:id`, asyncHandler(async (req, res) => {
      const removido = await repository.remover(entityName, req.params.id);
      if (!removido) return res.status(404).json({ erro: 'Registro não encontrado' });
      res.status(204).end();
    }));
  }

  app.use('/atendimentos', requireLogin);
  app.get('/atendimentos', asyncHandler(async (_req, res) => {
    res.json({ dados: await repository.listarAtendimentos() });
  }));
  app.get('/atendimentos/:codigo', asyncHandler(async (req, res) => {
    const dados = await repository.buscarAtendimentoPorCodigo(req.params.codigo);
    if (!dados) return res.status(404).json({ erro: 'Atendimento não encontrado' });
    res.json({ dados });
  }));
  const patientFields = ['nome', 'cpf', 'rg', 'mae', 'pai', 'nascimento', 'sexo', 'telefone', 'endereco'];
  function atendimentoData(req, creating = false) {
    const role = req.user.cargo;
    const allowed = role === 'Recepcionista' ? patientFields
      : role === 'Enfermeiro' ? ['triagem', 'status'] : ['medico', 'status'];
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).some((key) => !allowed.includes(key))) {
      throw Object.assign(new Error('Campos não permitidos para seu cargo'), { code: 'FORBIDDEN' });
    }
    const data = { ...req.body };
    if (creating) data.id_profissional = req.user.id_profissional;
    for (const field of ['triagem', 'medico']) {
      if (Object.hasOwn(data, field)) {
        if (!data[field] || typeof data[field] !== 'object' || Array.isArray(data[field])) {
          throw Object.assign(new Error('Dados clínicos inválidos'), { code: 'INVALID_DATA' });
        }
        data[field] = { ...data[field], id_profissional: req.user.id_profissional };
      }
    }
    return data;
  }
  app.post('/atendimentos', allow('Recepcionista'), asyncHandler(async (req, res) => {
    res.status(201).json({ dados: await repository.salvarAtendimento(atendimentoData(req, true), req.user) });
  }));
  app.put('/atendimentos/:codigo', asyncHandler(async (req, res) => {
    res.json({
      dados: await repository.salvarAtendimento({ ...atendimentoData(req), id: req.params.codigo }, req.user)
    });
  }));
  app.delete('/atendimentos/:codigo', allow('Recepcionista'), asyncHandler(async (req, res) => {
    const cancelado = await repository.cancelarAtendimento(req.params.codigo);
    if (!cancelado) return res.status(404).json({ erro: 'Atendimento não encontrado' });
    res.status(204).end();
  }));

  app.get('/', (req, res) => res.redirect(req.user ? HOME_BY_ROLE[req.user.cargo] : '/auth/login.html'));
  for (const [role, home] of Object.entries(HOME_BY_ROLE)) {
    app.use(home.split('/').slice(0, 2).join('/'), (req, res, next) => {
      if (!req.user) return res.redirect('/auth/login.html');
      if (req.user.cargo !== role) return res.redirect(HOME_BY_ROLE[req.user.cargo]);
      next();
    });
  }
  app.use('/painel', (req, res, next) => {
    if (!req.user) return res.redirect('/auth/login.html');
    next();
  });
  app.use((req, res, next) => {
    let normalized;
    try {
      normalized = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/'));
    } catch {
      return res.status(400).json({ erro: 'Endereço inválido' });
    }
    const directory = normalized.split('/')[1]?.toLowerCase();
    const role = { recepcao: 'Recepcionista', triagem: 'Enfermeiro', medico: 'Medico' }[directory];
    if (role || directory === 'painel') {
      if (!req.user) return res.redirect('/auth/login.html');
      if (role && req.user.cargo !== role) return res.redirect(HOME_BY_ROLE[req.user.cargo]);
    }
    next();
  });
  app.use(express.static(webPath));
  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ erro: 'JSON inválido' });
    }
    if (error.type === 'entity.too.large') return res.status(413).json({ erro: 'Corpo da requisição muito grande' });
    return sendError(res, error);
  });
  return app;
}

export default createApp;
