import {
  pacienteRepository,
  prontuarioRepository,
  profissionalRepository,
  atendimentoRepository,
  triagemRepository
} from './repository.js';

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  listar() {
    return this.repository.listar();
  }

  buscarPorId(id) {
    const item = this.repository.buscarPorId(id);

    if (!item) {
      throw new Error('Registro não encontrado');
    }

    return item;
  }

  criar(dados) {
    return this.repository.criar(dados);
  }

  atualizar(id, dados) {
    const atualizado = this.repository.atualizar(id, dados);

    if (!atualizado) {
      throw new Error('Registro não encontrado');
    }

    return atualizado;
  }

  atualizarLista(lista) {
    if (!Array.isArray(lista)) {
      throw new Error('Lista inválida');
    }

    this.repository.items = lista;
    return this.repository.listar();
  }

  remover(id) {
    const removido = this.repository.remover(id);

    if (!removido) {
      throw new Error('Registro não encontrado');
    }

    return true;
  }
}

class PacienteService extends BaseService {
  constructor(repository = pacienteRepository) {
    super(repository);
  }

  criar(dados) {
    if (!dados?.nome_completo || !dados?.cpf || !dados?.data_nascimento || !dados?.sexo) {
      throw new Error('nome_completo, cpf, data_nascimento e sexo são obrigatórios');
    }

    return super.criar(dados);
  }
}

class ProntuarioService extends BaseService {
  constructor(repository = prontuarioRepository) {
    super(repository);
  }

  criar(dados) {
    if (!dados?.id_paciente || !dados?.data_abertura) {
      throw new Error('id_paciente e data_abertura são obrigatórios');
    }

    return super.criar(dados);
  }
}

class ProfissionalService extends BaseService {
  constructor(repository = profissionalRepository) {
    super(repository);
  }

  criar(dados) {
    if (!dados?.nome_completo || !dados?.cpf || !dados?.cargo || !dados?.email || !dados?.perfil_acesso) {
      throw new Error('nome_completo, cpf, cargo, email e perfil_acesso são obrigatórios');
    }

    return super.criar(dados);
  }
}

class AtendimentoService extends BaseService {
  constructor(repository = atendimentoRepository) {
    super(repository);
  }

  criar(dados) {
    if (!dados?.cod_atendimento || !dados?.id_paciente || !dados?.id_prontuario || !dados?.id_profissional) {
      throw new Error('cod_atendimento, id_paciente, id_prontuario e id_profissional são obrigatórios');
    }

    return super.criar(dados);
  }
}

class TriagemService extends BaseService {
  constructor(repository = triagemRepository) {
    super(repository);
  }

  criar(dados) {
    if (!dados?.id_atendimento || !dados?.id_profissional || !dados?.data_hora_triagem) {
      throw new Error('id_atendimento, id_profissional e data_hora_triagem são obrigatórios');
    }

    return super.criar(dados);
  }
}

export const pacienteService = new PacienteService();
export const prontuarioService = new ProntuarioService();
export const profissionalService = new ProfissionalService();
export const atendimentoService = new AtendimentoService();
export const triagemService = new TriagemService();

export default {
  pacienteService,
  prontuarioService,
  profissionalService,
  atendimentoService,
  triagemService
};
