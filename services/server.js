import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/usuarios', (req, res) => {
  res.json({
    mensagem: 'GET funcionando'
  });
});

app.post('/usuarios', (req, res) => {
  const dados = req.body;

  res.status(201).json({
    mensagem: 'POST funcionando',
    dados
  });
});

app.put('/usuarios/:id', (req, res) => {
  const id = req.params.id;
  const dados = req.body;

  res.json({
    mensagem: 'PUT funcionando',
    id,
    dados
  });
});

app.delete('/usuarios/:id', (req, res) => {
  const id = req.params.id;

  res.json({
    mensagem: 'DELETE funcionando',
    id
  });
});

app.listen(3000, () => {
  console.log('API rodando em http://localhost:3000');
});
