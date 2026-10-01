class BaseRepository {
  constructor(initial = []) {
    this.items = [...initial];
  }

  listar() {
    return [...this.items];
  }

  buscarPorId(id) {
    const itemId = Number(id);
    return this.items.find((item) => Number(item.id) === itemId) || null;
  }

  criar(dados) {
    const novoItem = {
      id: Date.now(),
      ...dados
    };

    this.items.push(novoItem);
    return novoItem;
  }

  atualizar(id, dados) {
    const index = this.items.findIndex((item) => Number(item.id) === Number(id));

    if (index === -1) {
      return null;
    }

    this.items[index] = {
      ...this.items[index],
      ...dados,
      id: Number(id)
    };

    return this.items[index];
  }

  remover(id) {
    const index = this.items.findIndex((item) => Number(item.id) === Number(id));

    if (index === -1) {
      return false;
    }

    this.items.splice(index, 1);
    return true;
  }
}

class PacienteRepository extends BaseRepository {
  constructor() {
    super([]);
  }
}

class ProntuarioRepository extends BaseRepository {
  constructor() {
    super([]);
  }
}

class ProfissionalRepository extends BaseRepository {
  constructor() {
    super([]);
  }
}

class AtendimentoRepository extends BaseRepository {
  constructor() {
    super([]);
  }
}

class TriagemRepository extends BaseRepository {
  constructor() {
    super([]);
  }
}

export const pacienteRepository = new PacienteRepository();
export const prontuarioRepository = new ProntuarioRepository();
export const profissionalRepository = new ProfissionalRepository();
export const atendimentoRepository = new AtendimentoRepository();
export const triagemRepository = new TriagemRepository();

export default {
  pacienteRepository,
  prontuarioRepository,
  profissionalRepository,
  atendimentoRepository,
  triagemRepository
};
