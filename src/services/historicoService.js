const historicoRepository = require('../repositories/historicoRepository');
const AppError = require('../errors/AppError');

function lerData(valor, nome) {
    const data = String(valor || '').trim();
    if (!data) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(new Date(`${data}T00:00:00`).getTime())) {
        throw new AppError(`${nome} inválida. Use o formato AAAA-MM-DD.`);
    }
    return data;
}

const historicoService = {
    // Cada profissional vê apenas o que ele mesmo registrou, de acordo com o cargo.
    async listar(profissional, { data_inicio, data_fim, busca }) {
        const filtros = {
            dataInicio: lerData(data_inicio, 'Data inicial'),
            dataFim: lerData(data_fim, 'Data final'),
            busca: String(busca || '').trim()
        };

        if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
            throw new AppError('A data inicial não pode ser maior que a data final.');
        }

        const id = profissional.id_profissional;
        switch (profissional.cargo) {
            case 'Recepcionista':
                return historicoRepository.listarDaRecepcao(id, filtros);
            case 'Enfermeiro':
                return historicoRepository.listarDaTriagem(id, filtros);
            case 'Medico':
                return historicoRepository.listarDoMedico(id, filtros);
            default:
                throw new AppError('Cargo sem histórico disponível.', 403);
        }
    }
};

module.exports = historicoService;
