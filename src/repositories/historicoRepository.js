const { pool } = require('../config/db');

// Monta o filtro opcional de período e de busca (nome do paciente ou número do atendimento).
// `campoData` é a coluna de data usada no período de cada histórico.
function montarFiltros(campoData, { dataInicio, dataFim, busca }) {
    const condicoes = [];
    const valores = [];

    if (dataInicio) {
        condicoes.push(`${campoData} >= ?`);
        valores.push(`${dataInicio} 00:00:00`);
    }
    if (dataFim) {
        condicoes.push(`${campoData} < DATE_ADD(?, INTERVAL 1 DAY)`);
        valores.push(dataFim);
    }
    if (busca) {
        condicoes.push('(p.nome_completo LIKE ? OR a.numero_atendimento LIKE ?)');
        valores.push(`%${busca}%`, `%${busca}%`);
    }

    return {
        sql: condicoes.length ? ` AND ${condicoes.join(' AND ')}` : '',
        valores
    };
}

class HistoricoRepository {
    // Recepção: atendimentos abertos pelo recepcionista.
    async listarDaRecepcao(idRecepcionista, filtros) {
        const filtro = montarFiltros('a.data_hora_chegada', filtros);
        const [rows] = await pool.execute(
            `SELECT a.id_atendimento, a.numero_atendimento, a.status, a.data_hora_chegada,
                    a.motivo_cancelamento, a.data_hora_cancelamento,
                    p.nome_completo AS nome_paciente, p.cpf,
                    t.classificacao_manchester
               FROM atendimento a
               INNER JOIN paciente p ON p.id_paciente = a.id_paciente
               LEFT JOIN triagem t ON t.id_atendimento = a.id_atendimento
              WHERE a.id_recepcionista = ?${filtro.sql}
              ORDER BY a.data_hora_chegada DESC, a.id_atendimento DESC
              LIMIT 200`,
            [idRecepcionista, ...filtro.valores]
        );
        return rows;
    }

    // Enfermagem: triagens registradas pelo enfermeiro.
    async listarDaTriagem(idEnfermeiro, filtros) {
        const filtro = montarFiltros('t.data_hora_triagem', filtros);
        const [rows] = await pool.execute(
            `SELECT a.id_atendimento, a.numero_atendimento, a.status,
                    p.nome_completo AS nome_paciente, p.cpf,
                    t.data_hora_triagem, t.pressao_arterial, t.temperatura,
                    t.frequencia_cardiaca, t.queixa_principal, t.classificacao_manchester
               FROM triagem t
               INNER JOIN atendimento a ON a.id_atendimento = t.id_atendimento
               INNER JOIN paciente p ON p.id_paciente = a.id_paciente
              WHERE t.id_enfermeiro = ?${filtro.sql}
              ORDER BY t.data_hora_triagem DESC, t.id_triagem DESC
              LIMIT 200`,
            [idEnfermeiro, ...filtro.valores]
        );
        return rows;
    }

    // Médico: consultas já finalizadas pelo médico.
    async listarDoMedico(idMedico, filtros) {
        const filtro = montarFiltros('am.data_hora_inicio', filtros);
        const [rows] = await pool.execute(
            `SELECT a.id_atendimento, a.numero_atendimento, a.status,
                    p.nome_completo AS nome_paciente, p.cpf,
                    t.classificacao_manchester, t.queixa_principal,
                    am.data_hora_inicio, am.data_hora_fim,
                    am.diagnostico, am.medicacoes_prescritas, am.observacoes
               FROM atendimento_medico am
               INNER JOIN atendimento a ON a.id_atendimento = am.id_atendimento
               INNER JOIN paciente p ON p.id_paciente = a.id_paciente
               LEFT JOIN triagem t ON t.id_atendimento = a.id_atendimento
              WHERE am.id_medico = ? AND am.data_hora_fim IS NOT NULL${filtro.sql}
              ORDER BY am.data_hora_inicio DESC, am.id_atendimento_medico DESC
              LIMIT 200`,
            [idMedico, ...filtro.valores]
        );
        return rows;
    }
}

module.exports = new HistoricoRepository();
