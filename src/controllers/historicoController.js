const historicoService = require('../services/historicoService');

const historicoController = {
    async listar(req, res) {
        res.json(await historicoService.listar(req.profissional, req.query));
    }
};

module.exports = historicoController;
