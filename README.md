# Sistema de Atendimento de Pronto-Socorro

Aplicação web para acompanhamento do atendimento desde a recepção até a alta médica. O backend Express persiste os dados em PostgreSQL e serve a própria aplicação web.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL

## Configuração

1. Crie o banco de dados que será usado pelo sistema.
2. Copie `.env.example` para `.env` e informe as credenciais locais do PostgreSQL.
3. Execute [database/schema.sql](database/schema.sql) no banco vazio para criar as tabelas.
4. Instale dependências e inicie:

```sh
npm install
npm start
```

Acesse `http://localhost:3000`. A API e as páginas web são servidas na mesma origem. `npm run dev` inicia o servidor com reinicialização automática e `npm test` executa os testes automatizados.

O esquema usa as tabelas `paciente`, `profissional`, `atendimento`, `triagem` e `atendimento_medico`, com identidades e restrições `CHECK` PostgreSQL. O antigo [database/migrate.sql](database/migrate.sql) é exclusivo das tabelas anteriores `hospitacao_*`: não o execute no novo esquema. A API não migra dados antigos automaticamente. Para dados de demonstração em um banco recém-criado, execute [database/insert.sql](database/insert.sql) após o esquema.

## Configuração do banco

O servidor lê `HOST`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`. Os valores padrão apontam apenas para a própria máquina (`127.0.0.1:3000`) e para PostgreSQL local (`localhost:5432`, usuário `postgres`, banco `BD240226119`). Para PostgreSQL em contêiner, use em `DB_PORT` a porta publicada no host (por exemplo, `6081`), não necessariamente a porta interna `5432`. O `.env` existente não é sobrescrito. Reinicie o servidor após alterar essas variáveis. O processo da API pode iniciar sem o banco disponível; `GET /health` indica se a conexão está funcionando.

## Login, cadastro e permissões

A página inicial abre o login. Use **Cadastre-se** para criar um profissional com nome, CPF, email, senha (8 a 128 caracteres) e cargo. Após o cadastro, faça login; o servidor abre a área correspondente:

| Cargo | Área exclusiva | Área compartilhada |
| --- | --- | --- |
| Recepcionista | Recepção e cadastro de pacientes | Painel de atendimento |
| Enfermeiro | Triagem | Painel de atendimento |
| Médico | Atendimento e alta médica | Painel de atendimento |

Os links de outras áreas não aparecem no menu. Acesso direto às páginas é redirecionado para a área do usuário; requisições à API sem sessão retornam 401 e operações de outro cargo retornam 403. O responsável pelos registros é sempre o usuário autenticado, não um profissional escolhido na tela. O menu mostra o nome, cargo e botão **Sair**.

**Cadastro livre foi habilitado para demonstração:** qualquer pessoa pode escolher um dos três cargos, sem verificação de habilitação. Portanto, não exponha este sistema ou dados reais de saúde à internet. Para produção, é necessário aprovação de contas/cargos por um responsável, HTTPS e revisão dos requisitos de proteção de dados.

As senhas novas são armazenadas com scrypt e salt individual. As senhas antigas de demonstração são convertidas em hash no primeiro login válido. Os usuários de [database/insert.sql](database/insert.sql) usam `recepcao@hospital.com`, `enfermagem@hospital.com` e `medico@hospital.com`, com senha `123456`, somente para demonstração local.

A sessão usa um cookie HttpOnly, SameSite=Strict (Secure em HTTPS), dura oito horas e é invalidada no logout. Sessões são mantidas na memória do processo: reiniciar o servidor exige novo login; múltiplas instâncias exigem um armazenamento compartilhado de sessões. Contas inativas perdem acesso, inclusive com sessão previamente aberta. Login e cadastro possuem limite de tentativas por IP.

```text
POST /auth/cadastro   # nome_completo, cpf, cargo, email, senha; conselho/especialidade opcionais
POST /auth/login      # email, senha
GET  /auth/me         # profissional autenticado e destino
POST /auth/logout
```

Os endpoints de autenticação usam a mesma origem das telas. O cadastro não permite definir `ativo`, IDs ou campos de administração. Não é necessário alterar as tabelas de um banco que já contém o novo esquema.

## API

Os recursos `pacientes` (recepcionista), `triagens` (enfermeiro) e `atendimentos-medicos` (médico) oferecem operações REST de listagem, consulta por ID, criação, atualização e remoção, sempre com sessão autenticada:

```text
GET    /:recurso
GET    /:recurso/:id
POST   /:recurso
PUT    /:recurso/:id
DELETE /:recurso/:id
```

As respostas de sucesso usam a propriedade `dados`; erros retornam status HTTP apropriado e uma propriedade `erro`. Remoções bem-sucedidas retornam 204, sem corpo. Campos desses recursos seguem os nomes do esquema:

- Paciente: `nome_completo`, `cpf`, `rg`, `nome_mae`, `data_nascimento` e `sexo` (`M` ou `F`) são obrigatórios.
- Profissional: cadastro somente por `/auth/cadastro`. `GET /profissionais` retorna apenas o próprio usuário; `GET /profissionais/:id` permite somente o próprio ID. Alteração de cargo, senha ou exclusão por essas rotas é bloqueada. Senhas e hashes nunca são retornados.
- Triagem: `id_atendimento`, `id_enfermeiro`, `queixa_principal` e `classificacao_manchester` são obrigatórios. A classificação usa `VERMELHO`, `LARANJA`, `AMARELO`, `VERDE` ou `AZUL`.
- Atendimento médico: `id_atendimento` e `id_medico` são obrigatórios; `diagnostico`, `medicacoes_prescritas`, `observacoes` e as datas são opcionais.

`prontuarios` não existe no novo banco e não é mais exposto. Campos antigos, como `cartao_sus`, `senha_hash`, `saturacao_o2` e `peso`, não fazem parte do novo contrato.

### Fluxo das telas

O recurso `atendimentos` mantém o formato consumido pelas páginas web:

```text
GET    /atendimentos
GET    /atendimentos/:codigo
POST   /atendimentos
PUT    /atendimentos/:codigo
DELETE /atendimentos/:codigo
GET    /profissionais
```

A criação, exclusiva da recepção, recebe `nome`, `cpf`, `rg`, `mae`, `nascimento`, `sexo` e, opcionalmente, `pai`, `telefone` e `endereco`. O recepcionista é obtido da sessão. Gera `AT0001`, `AT0002`, etc., a partir do ID auto-incrementado, sem reutilizar códigos de registros excluídos. Pacientes são criados ou atualizados por CPF. As gravações são transacionais.

Os campos de CPF e RG são formatados nas telas; a API recebe e persiste os documentos sem máscara. CPF é validado com os dígitos verificadores, RG aceita de 8 a 9 caracteres com `X` opcional no final, e registros de CRM/COREN exigem seis dígitos e uma UF válida. Essas validações também são aplicadas no servidor.

### Migração de documentos

O esquema novo armazena CPF em 11 caracteres, RG em até 9 e CRM/COREN como seis dígitos seguidos pela UF, sem pontuação. CPF continua único e novas restrições verificam o formato. O índice único já existente em CPF atende à busca/conflito; não há índice de registro profissional porque ele não é usado como chave de busca.

Antes de migrar, faça e verifique um backup do banco:

```sh
pg_dump -Fc -h DB_HOST -U DB_USER -d DB_NAME -f backup-antes-documentos.dump
pg_restore --list backup-antes-documentos.dump
```

Pare temporariamente as gravações do sistema e aplique, em um banco exclusivo para validação, `database/migrations/20261104_documents_up.sql`. A migração valida e normaliza os dados dentro de uma transação, bloqueia brevemente as tabelas `paciente` e `profissional` e aborta sem alterações se encontrar documentos ambíguos, duplicados após normalização ou registro CRM/COREN sem UF. Não invente a UF: corrija esses registros com a fonte oficial antes de repetir. O antigo seed de demonstração tinha registros de conselho sem UF; o seed atualizado usa valores normalizados.

```sh
psql -v ON_ERROR_STOP=1 -h DB_HOST -U DB_USER -d DB_NAME -f database/migrations/20261104_documents_up.sql
```

`database/normalize_documents.sql` executa apenas a etapa transacional de normalização e validação, sem estreitar colunas nem adicionar restrições; é opcional, pois a migration `up` já contém essa etapa. O rollback `database/migrations/20261104_documents_down.sql` remove as restrições e restaura as larguras anteriores, mas mantém os valores sem máscara: a pontuação original não pode ser recuperada exatamente. Portanto, faça backup antes de migrar e não execute `down` para tentar recuperar máscaras. A alteração não remove linhas, mas pode interromper a migration até que registros legados incompletos sejam corrigidos.

A atualização aceita campos de paciente somente para recepcionistas. Enfermeiros enviam apenas `status: "aguardando-medico"` e `triagem` com `pa`, `temp`, `bpm`, `queixas` e `classificacao` (minúscula), para atendimentos aguardando triagem. Médicos enviam apenas `status` (`em-atendimento` ou `confirmado`) e `medico` com `medicacoes`, `diagnostico` e `observacoes`, após a triagem. O responsável clínico é obtido da sessão; IDs enviados no objeto clínico não substituem o usuário autenticado. Campos de outras áreas são rejeitados. Atendimentos finalizados ou cancelados não podem ser editados.

| Status das telas | Status no PostgreSQL |
| --- | --- |
| `aguardando-triagem` | `AGUARDANDO_TRIAGEM` |
| `aguardando-medico` | `AGUARDANDO_MEDICO` |
| `em-atendimento` | `EM_ATENDIMENTO` |
| `confirmado` | `FINALIZADO` |
| `cancelado` | `CANCELADO` |

O estado `em-observacao` não é suportado pelo novo esquema. A alta registra `data_hora_fim` na consulta médica sem alterar sua data de início; o cancelamento, exclusivo da recepção, mantém o atendimento e grava `CANCELADO`. O CRUD direto de triagens/consultas é restrito ao cargo correspondente e não altera o status do atendimento; use o fluxo acima para atualizar os dados clínicos e o status na mesma transação.

### Testes com PostgreSQL real

Os testes de integração são opcionais e usam um esquema temporário em um banco **exclusivo para testes**, chamado `api_schema_test`, em PostgreSQL local. Defina `API_TEST_DB_PORT` com a porta desse servidor; as credenciais padrão são usuário `postgres` sem senha (podem ser alteradas por `API_TEST_DB_USER` e `API_TEST_DB_PASSWORD`). Execute `npm test`. O teste aplica o esquema SQL e os dados de demonstração nesse esquema temporário e o remove ao terminar; nunca usa o banco de desenvolvimento. Sem essa variável, apenas os testes unitários/HTTP são executados.
