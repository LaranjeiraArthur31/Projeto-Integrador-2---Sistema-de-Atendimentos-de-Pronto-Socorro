import {
  pacienteService,
  prontuarioService,
  profissionalService,
  atendimentoService,
  triagemService
} from './service.js';

class BaseController {
  constructor(service, nomeEntidade) {
    this.service = service;
    this.nomeEntidade = nomeEntidade;
  }

  listar = (req, res) => {
    const itens = this.service.listar();

    res.json({
      mensagem: `${this.nomeEntidade} listados com sucesso`,
      dados: itens
    });
  };

  buscarPorId = (req, res) => {
    try {
      const item = this.service.buscarPorId(req.params.id);

      res.json({
        mensagem: `${this.nomeEntidade} encontrado`,
        dados: item
      });
    } catch (error) {
      res.status(404).json({ erro: error.message });
    }
  };

  criar = (req, res) => {
    try {
      const item = this.service.criar(req.body);

      res.status(201).json({
        mensagem: `${this.nomeEntidade} criado com sucesso`,
        dados: item
      });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  };

  atualizar = (req, res) => {
    try {
      const item = this.service.atualizar(req.params.id, req.body);

      res.json({
        mensagem: `${this.nomeEntidade} atualizado com sucesso`,
        dados: item
      });
    } catch (error) {
      res.status(404).json({ erro: error.message });
    }
  };

  sincronizarLista = (req, res) => {
    try {
      const lista = this.service.atualizarLista(req.body?.atendimentos ?? req.body ?? []);

      res.json({
        mensagem: `${this.nomeEntidade} sincronizado com sucesso`,
        dados: lista
      });
    } catch (error) {
      res.status(400).json({ erro: error.message });
    }
  };

  remover = (req, res) => {
    try {
      this.service.remover(req.params.id);

      res.json({
        mensagem: `${this.nomeEntidade} removido com sucesso`,
        id: req.params.id
      });
    } catch (error) {
      res.status(404).json({ erro: error.message });
    }
  };
}

export const pacienteController = new BaseController(pacienteService, 'Paciente');
export const prontuarioController = new BaseController(prontuarioService, 'Prontuário');
export const profissionalController = new BaseController(profissionalService, 'Profissional');
export const atendimentoController = new BaseController(atendimentoService, 'Atendimento');
export const triagemController = new BaseController(triagemService, 'Triagem');

export default {
  pacienteController,
  prontuarioController,
  profissionalController,
  atendimentoController,
  triagemController
};

