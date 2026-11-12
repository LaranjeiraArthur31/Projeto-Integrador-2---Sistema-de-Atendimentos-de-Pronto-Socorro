# Sistema de Atendimentos de Pronto Socorro

Projeto Integrador 2 — PUC-Campinas. Sistema web para o fluxo de um pronto-socorro: recepção, triagem (Protocolo de Manchester), painel de chamada e atendimento médico.

## Requisitos

- [Node.js](https://nodejs.org/) 20 ou mais recente (inclui o `npm`)
- [PostgreSQL](https://www.postgresql.org/download/) 14 ou mais recente, com o serviço em execução. Anote a senha do usuário `postgres` definida na instalação.

O `psql` **não** é necessário: o banco é criado pelo próprio projeto.

## Início rápido

No terminal (PowerShell ou Prompt de Comando), dentro da pasta do projeto:

```
copy .env.example .env
```

Abra o `.env` e preencha `DB_PASSWORD` com a senha do PostgreSQL. Se o PostgreSQL não estiver na porta 5432, ajuste também `DB_PORT`.

```
npm install
npm run setup
npm start
```

Abra no navegador o endereço exibido (padrão: <http://127.0.0.1:3000>).

O `npm run setup` cria o `.env` se ele não existir, cria o banco `DB_NAME` (UTF-8), cria as tabelas e carrega os dados de demonstração. Pode ser executado de novo sem duplicar dados.

## Usuários de demonstração

Senha de todos: `123456`

| Cargo | E-mail | Telas |
|---|---|---|
| Recepcionista | `recepcao@hospital.com` | Recepção, Painel |
| Enfermeiro | `enfermagem@hospital.com` | Triagem, Painel |
| Médico | `medico@hospital.com` | Atendimento Médico, Painel |

Novos profissionais podem se cadastrar pela tela de login.

## Solução de problemas

| Mensagem ou sintoma | O que fazer |
|---|---|
| "a porta 3000 já está em uso" | Outro programa usa a porta. Troque `PORT` no `.env` (ex.: `PORT=3001`). |
| "Usuário ou senha do PostgreSQL recusados" | Corrija `DB_USER` e `DB_PASSWORD` no `.env`. |
| "o banco parece estar desligado ou em outra porta" | Inicie o serviço `postgresql-x64-<versão>` em `services.msc` e confira `DB_PORT`. A porta configurada fica em `postgresql.conf` (linha `port =`) na pasta `data` da instalação. |
| "O banco ... não existe" ou "As tabelas do sistema não existem" | Rode `npm run setup`. |
| Acentos aparecem errados | Se o setup avisou que o banco não é UTF8, use outro `DB_NAME` no `.env` e rode `npm run setup`. No terminal antigo do Windows, `chcp 65001` corrige a exibição das mensagens. |
| `psql` não é reconhecido no Windows | Não é preciso para rodar o projeto. Para usá-lo, chame pelo caminho completo, ex.: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres`. |

## Testes

```
npm test
```

O teste de integração com PostgreSQL só roda se a variável `API_TEST_DB_PORT` estiver definida. Ele usa um banco `api_schema_test` já existente (opcionalmente `API_TEST_DB_USER` e `API_TEST_DB_PASSWORD`).

## Estrutura

```
database/   schema.sql (tabelas) e insert.sql (dados de demonstração)
scripts/    setup.js (npm run setup)
services/   servidor Express, API, autenticação e acesso ao banco
web/        telas: auth, recepcao, triagem, painel, medico
tests/      testes automatizados (node:test)
```
