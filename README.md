# Sistema de Atendimentos de Pronto Socorro

Projeto Integrador 2 — PUC-Campinas. Sistema web para o fluxo de um pronto-socorro: recepção, triagem (Protocolo de Manchester), painel de chamada e atendimento médico.

- [Requisitos](#requisitos)
- [Passo a passo 1 — seu computador (ou qualquer outro)](#passo-a-passo-1--seu-computador-ou-qualquer-outro)
- [Passo a passo 2 — computador do laboratório da PUC](#passo-a-passo-2--computador-do-laboratório-da-puc)
- [Usuários de demonstração](#usuários-de-demonstração)
- [Regras de validação](#regras-de-validação)
- [Solução de problemas](#solução-de-problemas)
- [Testes](#testes)
- [Estrutura](#estrutura)

## Requisitos

- [Node.js](https://nodejs.org/) 20 ou mais recente (versão LTS recomendada; já inclui o `npm`)
- [PostgreSQL](https://www.postgresql.org/download/) 14 ou mais recente, com o serviço em execução, e a senha do usuário `postgres`
- Acesso à internet na primeira vez (para o `npm install`)

O `psql` e o pgAdmin **não** são necessários: o banco, as tabelas e os dados de demonstração são criados pelo próprio projeto (`npm run setup`).

## Passo a passo 1 — seu computador (ou qualquer outro)

Funciona em Windows, Linux e macOS. Os comandos abaixo valem para PowerShell, Prompt de Comando e terminais Linux/macOS (no Linux/macOS use `cp` no lugar de `copy`).

1. **Instale o Node.js LTS** pelo site <https://nodejs.org/> e confira no terminal:
   ```
   node -v
   npm -v
   ```
   `node -v` deve mostrar `v20` ou mais recente.

2. **Instale o PostgreSQL** pelo site <https://www.postgresql.org/download/>. Durante a instalação, **anote a senha** do usuário `postgres` e a **porta** (padrão `5432`). Se o PostgreSQL já estiver instalado, só confirme a senha e a porta.

3. **Baixe o projeto.** Com git:
   ```
   git clone https://github.com/LaranjeiraArthur31/Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro.git
   cd Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro
   ```
   Sem git: no GitHub, clique em **Code → Download ZIP**, extraia a pasta e abra o terminal dentro dela.

4. **Crie o arquivo de configuração:**
   ```
   copy .env.example .env
   ```
   Abra o `.env` num editor de texto e ajuste:
   - `DB_PASSWORD` = a senha do `postgres`
   - `DB_PORT` = a porta do PostgreSQL, se não for `5432`

5. **Instale as dependências, crie o banco e inicie:**
   ```
   npm install
   npm run setup
   npm start
   ```
   O `npm run setup` cria o banco `pronto_socorro` (UTF-8), as tabelas e os dados de demonstração. Ele pode ser rodado de novo sem duplicar nada.

6. **Abra no navegador** o endereço que aparecer no terminal (padrão: <http://127.0.0.1:3000>) e entre com um dos [usuários de demonstração](#usuários-de-demonstração).

Para parar o servidor, pressione `Ctrl + C` no terminal. Para usar de novo depois, basta `npm start`.

## Passo a passo 2 — computador do laboratório da PUC

Os computadores do laboratório normalmente são Windows, sem permissão de administrador, e às vezes apagam os arquivos ao reiniciar. Por isso este roteiro **não instala nada no sistema**. Use o **PowerShell** (menu Iniciar → digite "PowerShell").

**Antes de sair de casa (recomendado):** copie a pasta do projeto **já com a pasta `node_modules`** (depois de rodar `npm install`) para um pendrive. Assim o projeto funciona mesmo se o laboratório bloquear a internet ou o `npm`. **Não leve o seu `.env`**, porque ele tem a sua senha; no laboratório você cria outro.

### 1. Copie o projeto para a Área de Trabalho

Use o pendrive, o **Download ZIP** do GitHub ou `git clone`. Evite rodar direto do pendrive ou de unidade de rede. Depois entre na pasta:
```
cd "$HOME\Desktop\Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro"
```
Se a pasta extraída do ZIP tiver outro nome (ex.: terminar em `-main`), ajuste o caminho.

### 2. Verifique o Node.js

```
node -v
```

- Se mostrar `v20` ou mais recente, siga para o passo 3.
- Se der "não é reconhecido" ou for uma versão antiga, use o Node **portátil**, que não precisa de administrador:
  1. Em <https://nodejs.org/en/download>, baixe o **Windows Binary (.zip)** da versão LTS (x64).
  2. Extraia o ZIP na Área de Trabalho e renomeie a pasta para `node`.
  3. No PowerShell (vale só para esta janela; se abrir outra, repita):
     ```
     $env:Path = "$HOME\Desktop\node;$env:Path"
     node -v
     ```

Se o PowerShell disser que **"a execução de scripts foi desabilitada neste sistema"** ao rodar `npm`, use `npm.cmd` no lugar de `npm` em todos os comandos (ex.: `npm.cmd install`).

### 3. Verifique o PostgreSQL

Veja se existe um serviço do PostgreSQL rodando:
```
Get-Service *postgres*
```

**Caso A — aparece um serviço com Status `Running`:** o PostgreSQL já está instalado.
- **Senha:** pergunte ao professor ou ao técnico do laboratório qual é a senha do usuário `postgres`.
- **Porta:** descubra com o comando abaixo. O número depois de `:` na coluna `LocalAddress` é a porta, normalmente `5432`.
  ```
  Get-NetTCPConnection -State Listen | Where-Object OwningProcess -in (Get-Process postgres).Id | Select-Object LocalAddress, LocalPort
  ```

**Caso B — não aparece nada, ou não há a senha:** use o PostgreSQL **portátil**, que não precisa de administrador nem de senha.
1. Em <https://www.enterprisedb.com/download-postgresql-binaries>, baixe o ZIP (versão 16 ou 17, Windows x86-64).
2. Extraia o ZIP na Área de Trabalho. Isso cria a pasta `pgsql`.
3. Crie e inicie um banco próprio na porta **5433**, para não conflitar com outro PostgreSQL:
   ```
   & "$HOME\Desktop\pgsql\bin\initdb.exe" -D "$HOME\Desktop\pgdata" -U postgres -A trust -E UTF8
   & "$HOME\Desktop\pgsql\bin\pg_ctl.exe" -D "$HOME\Desktop\pgdata" -o "-p 5433" -l "$HOME\Desktop\pg.log" start
   ```
   Com `-A trust`, o banco aceita qualquer senha e só pode ser acessado deste computador.
4. Ao terminar os testes, desligue o banco:
   ```
   & "$HOME\Desktop\pgsql\bin\pg_ctl.exe" -D "$HOME\Desktop\pgdata" stop
   ```

### 4. Configure o `.env`

```
copy .env.example .env
notepad .env
```

- **Caso A:** coloque em `DB_PASSWORD` a senha do laboratório e em `DB_PORT` a porta encontrada.
- **Caso B:** use `DB_PORT=5433`. O `DB_PASSWORD` pode ficar como está, porque o modo `trust` ignora a senha.

Salve e feche o Bloco de Notas.

### 5. Instale, crie o banco e inicie

```
npm install
npm run setup
npm start
```

Se você trouxe a pasta `node_modules` no pendrive, pule o `npm install`. Se usar `npm.cmd`, troque também nestes comandos.

### 6. Abra o sistema

Abra <http://127.0.0.1:3000> no navegador e entre com os [usuários de demonstração](#usuários-de-demonstração). Para testar o fluxo completo, use três abas: **Recepção**, **Triagem** e **Médico** (o Painel abre em qualquer cargo).

Para parar, use `Ctrl + C` no PowerShell. **Antes de ir embora:** apague o `.env` se ele tiver a senha do laboratório e, no Caso B, desligue o banco (passo 3.B.4).

## Usuários de demonstração

Senha de todos: `123456`

| Cargo | E-mail | Telas |
|---|---|---|
| Recepcionista | `recepcao@hospital.com` | Recepção, Painel |
| Enfermeiro | `enfermagem@hospital.com` | Triagem, Painel |
| Médico | `medico@hospital.com` | Atendimento Médico, Painel |

Novos profissionais podem se cadastrar pela tela de login.

## Regras de validação

A API recusa dados inválidos com mensagem em português (HTTP 400):

| Campo | Regra |
|---|---|
| Data de nascimento | Não pode estar no futuro nem indicar mais de 130 anos |
| CPF | 11 dígitos, com ou sem máscara (`12345678900` ou `123.456.789-00`); é gravado sempre com máscara. Os dígitos verificadores não são conferidos |
| Pressão arterial | Formato `120/80`, com `mmHg` opcional (`120/80 mmHg`) |
| Temperatura | Entre 25 e 45 °C, com vírgula ou ponto (`36,5` ou `36.5`) |
| Batimentos cardíacos | Número inteiro entre 20 e 250 bpm |
| Medicações (alta médica) | Obrigatórias para dar alta; se não houver, escreva `Nenhuma` |

Triagem e consulta médica são gravadas apenas pelas telas (`PUT /atendimentos/:codigo`). As rotas `/triagens` e `/atendimentos-medicos` são somente leitura e respondem `405` a POST, PUT e DELETE. O painel e as demais telas ignoram atendimentos que ainda não passaram pela triagem.

## Solução de problemas

| Mensagem ou sintoma | O que fazer |
|---|---|
| "a porta 3000 já está em uso" | Outro programa usa a porta. Troque `PORT` no `.env` (ex.: `PORT=3001`) e abra o novo endereço. |
| "Usuário ou senha do PostgreSQL recusados" | Corrija `DB_USER` e `DB_PASSWORD` no `.env`. |
| "o banco parece estar desligado ou em outra porta" | Confira `DB_PORT`. No Windows com PostgreSQL instalado, inicie o serviço `postgresql-x64-<versão>` em `services.msc`; a porta fica em `postgresql.conf` (linha `port =`) na pasta `data` da instalação. No PostgreSQL portátil, rode de novo o `pg_ctl ... start`. |
| "O banco ... não existe" ou "As tabelas do sistema não existem" | Rode `npm run setup`. |
| "a execução de scripts foi desabilitada neste sistema" | Use `npm.cmd` no lugar de `npm`, ou abra o **Prompt de Comando** em vez do PowerShell. |
| `node` não é reconhecido | Instale o Node.js ou use o Node portátil (passo a passo 2, item 2). |
| `npm install` falha por falta de internet ou proxy | Traga a pasta `node_modules` pronta de outro computador (veja o início do passo a passo 2). |
| Acentos aparecem errados | Se o setup avisou que o banco não é UTF8, use outro `DB_NAME` no `.env` e rode `npm run setup`. No terminal antigo do Windows, `chcp 65001` corrige a exibição das mensagens. |
| `psql` não é reconhecido no Windows | Não é preciso para rodar o projeto. Para usá-lo, chame pelo caminho completo, ex.: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres`. |

## Testes

```
npm test
```

Sem configuração extra, rodam só os testes que não usam banco; os de integração aparecem como "skipped". Para rodar todos, informe um PostgreSQL de teste. No PowerShell:

```
$env:API_TEST_DB_PORT = "5432"
$env:API_TEST_DB_PASSWORD = "sua_senha"
npm test
```

No Linux/macOS: `API_TEST_DB_PORT=5432 API_TEST_DB_PASSWORD=sua_senha npm test`. O usuário padrão é `postgres` (mude com `API_TEST_DB_USER`).

Os testes criam e usam apenas o banco `api_schema_test`, com um esquema temporário por teste. O banco do sistema (`pronto_socorro`) não é tocado. Os testes marcados como "todo" são propostas de melhoria ainda não implementadas e não contam como falha.

## Estrutura

```
database/   schema.sql (tabelas) e insert.sql (dados de demonstração)
scripts/    setup.js (npm run setup)
services/   servidor Express, API, autenticação e acesso ao banco
web/        telas: auth, recepcao, triagem, painel, medico
tests/      testes automatizados (node:test): integracao/, front/ e helpers/
```
