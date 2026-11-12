# SGPS - Sistema de Gestão de Pronto Socorro

Projeto Integrador II (PUC-Campinas). Controla o atendimento de um Pronto Socorro:
**Recepção → Triagem (Protocolo de Manchester) → Médico**.

## Integrantes

* Jorge Rodrigues dos Santos Neto

## Tecnologias

- Node.js + Express
- MySQL (mysql2, SQL puro)
- dotenv / nodemon
- Front-end em HTML, CSS e JavaScript puro (SPA)

## Como executar

1. Crie o banco e as tabelas (o script recria as tabelas e cadastra 3 profissionais de teste):
   ```
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS sgps"
   mysql -u root -p sgps < database/schema.sql
   ```
   (ou abra `database/schema.sql` no MySQL Workbench e execute.)
2. Copie `.env.example` para `.env` na raiz e preencha a senha do banco:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=sua_senha
   DB_NAME=sgps
   PORT=3000
   ```
3. `npm install` e `npm start` (ou `npm run dev`). Acesse http://localhost:3000.

**Login (mock):** `teste@teste.com` / `123`, escolhendo o perfil (Recepção, Triagem ou Médico).

## Telas por perfil

| Perfil | Telas |
|---|---|
| Recepção | Cadastro de paciente, Pacientes, Atendimentos, Meu histórico |
| Enfermagem | Fila de triagem, Meu histórico |
| Médico | Fila de atendimento, Em consulta, Meu histórico |

**Meu histórico:** cada profissional consulta o que ele mesmo registrou, com filtro por período e por paciente/nº do atendimento:
- Recepção: atendimentos que abriu (com status atual e motivo de cancelamento);
- Enfermagem: triagens que realizou (sinais vitais, queixa e classificação);
- Médico: consultas que finalizou (diagnóstico, medicações e observações).

## Fluxo

| Etapa | Quem | O que faz | Status do atendimento |
|---|---|---|---|
| 1 | Recepção | Cadastra/altera paciente, abre (`AT0001`), altera ou cancela o atendimento | `AGUARDANDO_TRIAGEM` |
| 2 | Enfermagem | Registra PA, temperatura, batimentos e queixas; o sistema calcula a cor de Manchester (a enfermagem pode substituí-la) | `AGUARDANDO_MEDICO` |
| 3 | Médico | Fila ordenada por cor e chegada; chama o paciente | `EM_ATENDIMENTO` |
| 4 | Médico | Registra diagnóstico/medicações e finaliza o atendimento | `FINALIZADO` |

A recepção só pode alterar/cancelar enquanto o atendimento está `AGUARDANDO_*` (antes de o médico iniciar).

## API (headers `x-profissional-id` e `x-profissional-cargo`, enviados pelo front)

- `GET/POST /api/pacientes`, `PUT /api/pacientes/:id` — Recepção
- `GET/POST /api/atendimentos`, `PUT /api/atendimentos/:id`, `PUT /api/atendimentos/:id/cancelar` — Recepção (`GET` também para Enfermagem)
- `POST /api/triagens` — Enfermagem
- `GET /api/medicos/painel`, `GET /api/medicos/em-atendimento`, `POST /api/medicos/iniciar`, `PUT /api/medicos/finalizar` — Médico
- `GET /api/historico?data_inicio=AAAA-MM-DD&data_fim=AAAA-MM-DD&busca=texto` — todos os perfis (cada um recebe o próprio histórico)

## Estrutura

```
database/schema.sql          script do banco
public/                      front-end
  index.html
  css/styles.css
  js/comum.js                funções comuns (API, formatação, tabelas)
  js/recepcao.js             telas da recepção
  js/triagem.js              tela da enfermagem
  js/medico.js               telas do médico
  js/historico.js            tela "Meu histórico"
  js/app.js                  login, menu e inicialização
src/
  routes → controllers → services (regras de negócio e transações) → repositories (SQL)
```
