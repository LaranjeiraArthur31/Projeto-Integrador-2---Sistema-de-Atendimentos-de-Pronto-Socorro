# Sistema de Atendimentos de Pronto Socorro

Projeto Integrador 2 da PUC-Campinas. É um sistema web que acompanha o paciente dentro do pronto-socorro: ele é cadastrado na recepção, passa pela triagem (Protocolo de Manchester), aparece no painel de chamada e é atendido pelo médico.

## O que precisa ter instalado

- [Node.js](https://nodejs.org/) 20 ou mais novo
- [PostgreSQL](https://www.postgresql.org/download/) 14 ou mais novo (guarde a senha do usuário `postgres`)

Não precisa criar o banco na mão. O próprio projeto cria.

## Como rodar

Baixe o projeto (git clone ou Download ZIP no GitHub) e abra um terminal na pasta dele.

Crie o arquivo de configuração a partir do exemplo:

```
copy .env.example .env
```

(no Linux/macOS é `cp` em vez de `copy`)

Abra o `.env` e coloque a senha do PostgreSQL em `DB_PASSWORD`. Se o seu PostgreSQL não usa a porta 5432, ajuste também o `DB_PORT`.

Depois:

```
npm install
npm run setup
npm start
```

O `npm run setup` cria o banco, as tabelas e alguns dados de exemplo. Pode rodar de novo sem problema, ele não duplica nada.

Agora é só abrir <http://127.0.0.1:3000> no navegador.

## Usuários para teste

Todos com a senha `123456`:

- Recepção: `recepcao@hospital.com`
- Enfermagem: `enfermagem@hospital.com`
- Médico: `medico@hospital.com`

Também dá para criar uma conta nova pela tela de login.

## Se der algum problema

- **Porta 3000 em uso:** mude o `PORT` no `.env` (por exemplo, 3001).
- **Senha do PostgreSQL recusada:** confira `DB_USER` e `DB_PASSWORD` no `.env`.
- **Banco desligado ou em outra porta:** veja se o serviço do PostgreSQL está rodando e se o `DB_PORT` está certo.
- **Banco ou tabelas não existem:** rode `npm run setup`.
- **PowerShell diz que a execução de scripts está desabilitada:** use `npm.cmd` no lugar de `npm`, ou rode pelo Prompt de Comando.

## Testes

```
npm test
```

Sem configurar nada, só rodam os testes que não usam banco. Para rodar todos, diga onde está o PostgreSQL (exemplo no PowerShell):

```
$env:API_TEST_DB_PORT = "5432"
$env:API_TEST_DB_PASSWORD = "sua_senha"
npm test
```

Os testes usam um banco separado (`api_schema_test`), então os dados do sistema não são afetados. Os testes marcados como "todo" são melhorias que ainda não foram feitas.

## Organização das pastas

```
database/   criação das tabelas e dados de exemplo
scripts/    script do npm run setup
services/   servidor, API e acesso ao banco
web/        telas (login, recepção, triagem, painel e médico)
tests/      testes automatizados
```
