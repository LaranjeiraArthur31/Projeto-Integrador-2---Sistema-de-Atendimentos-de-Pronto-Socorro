const express = require('express');
const historicoController = require('../controllers/historicoController');
const verificarCargo = require('../middlewares/authMiddleware');

const router = express.Router();

// Todos os perfis têm histórico; o service decide o que mostrar pelo cargo.
router.get('/', verificarCargo(['Recepcionista', 'Enfermeiro', 'Medico']), historicoController.listar);

module.exports = router;
