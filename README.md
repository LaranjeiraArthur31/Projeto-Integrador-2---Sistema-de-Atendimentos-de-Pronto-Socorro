# Sistema de Atendimento de Pronto-Socorro

Aplicação web para acompanhamento do atendimento desde a recepção até a alta médica. O backend Express persiste os dados em PostgreSQL e serve a própria aplicação web.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL

## Configuração

1. Crie o banco de dados que será usado pelo sistema.
2. Copie `.env.example` para `.env` e informe as credenciais locais do PostgreSQL.
3. Execute `database/schema.sql` para criar as tabelas em um banco vazio.
4. Para um banco que já contém as tabelas `hospitacao_*`, execute `database/migrate.sql` para adicionar os campos, status e registros médicos usados pelo web.
5. (Opcional) Execute `database/seeds.sql` para inserir um paciente e profissionais de demonstração.
6. Instale dependências e inicie:

```sh
npm install
npm start
```

Acesse `http://localhost:3000`. A API e as páginas web são servidas na mesma origem. `npm run dev` inicia o servidor com reinicialização automática e `npm test` executa os testes automatizados.

## Configuração do banco

O servidor lê `HOST`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`. Os valores padrão apontam apenas para a própria máquina (`127.0.0.1:3000`) e para PostgreSQL local (`localhost:5432`, banco `BD240226119`). O processo da API pode iniciar sem o banco disponível; `GET /health` indica se a conexão está funcionando.

O projeto ainda não implementa autenticação/autorização. Mantenha-o no uso local de desenvolvimento e não altere `HOST` para expor a API em uma rede ou internet antes de adicionar controle de acesso adequado aos dados de saúde.

## API

Os recursos `pacientes`, `prontuarios`, `profissionais` e `triagens` oferecem operações REST de listagem, consulta por ID, criação, atualização e remoção. As respostas de sucesso usam a propriedade `dados`; erros retornam status HTTP apropriado e uma propriedade `erro`.

O recurso `atendimentos` apresenta o formato consumido pelas páginas web. A criação gera o código sequencial no servidor, associa o paciente ao prontuário e ao profissional da recepção, e as atualizações persistem triagem/consulta usando transações. O cancelamento mantém o registro e grava o estado `cancelado`.

```text
GET    /atendimentos
POST   /atendimentos
PUT    /atendimentos/:codigo
DELETE /atendimentos/:codigo
GET    /profissionais?perfil_acesso=recepcao|enfermeiro|medico
```

O perfil de profissional é informado pelas telas e validado contra profissionais ativos no banco. As tabelas e chaves estrangeiras continuam usando os nomes `hospitacao_*` definidos pelo esquema do projeto.
