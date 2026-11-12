const path = require('path');
const express = require('express');
require('dotenv').config();

const pacienteRoutes = require('./routes/pacienteRoutes');
const atendimentoRoutes = require('./routes/atendimentoRoutes');
const triagemRoutes = require('./routes/triagemRoutes');
const medicoRoutes = require('./routes/medicoRoutes');
const historicoRoutes = require('./routes/historicoRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/pacientes', pacienteRoutes);
app.use('/api/atendimentos', atendimentoRoutes);
app.use('/api/triagens', triagemRoutes);
app.use('/api/medicos', medicoRoutes);
app.use('/api/historico', historicoRoutes);

app.use('/api', (req, res) => res.status(404).json({ mensagem: 'Rota não encontrada.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
