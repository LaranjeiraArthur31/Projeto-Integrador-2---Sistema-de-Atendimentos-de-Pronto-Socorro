# Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro

## Integrantes

* Arthur Lopes Laranjeira
* Gabriel Henrique Rodrigues Rocha
* Igor Mastrangelo Domingos
* Jorge Rodrigues Dos Santos Neto
* Maximus Daniel Nascimento

# Sistema de Atendimento de Pronto Socorro

## Descrição

Sistema web desenvolvido para gerenciamento e controle de atendimentos em unidades de Pronto Socorro, acompanhando o paciente desde a recepção até a alta médica.

O sistema permite:

- Cadastro de pacientes e geração de número de atendimento (ex: AT0001)
- Inclusão, alteração, consulta e cancelamento de atendimentos na recepção
- Registro de sinais vitais (pressão, temperatura, batimentos) e queixas na triagem
- Classificação automática de risco pelo Protocolo de Manchester
- Painel médico com fila ordenada por prioridade de urgência
- Registro de prescrição de medicamentos e alta médica

---

# Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- MySQL Workbench 8.0 CE
- Git e GitHub

---

# Estrutura do projeto

Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro/

pronto-socorro/
├── web/
│   ├── css/
│   ├── js/
│   ├── recepcao.html
│   ├── triagem.html
│   └── medico.html
│
├── services/
│   ├── controllers/
│   ├── routes/
│   └── server.js
│
├── database/
│   ├── schema.sql
│   └── seeds.sql
│
├── .gitignore  
└── README.md
---

# Como executar o projeto

## 1. Clone o repositório

git clone https://github.com/LaranjeiraArthur31/Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro.git

---

## 2. Acesse a pasta do projeto

cd Projeto-Integrador-2---Sistema-de-Atendimentos-de-Pronto-Socorro



# Configuração do banco

## 1. Abra o MySQL Workbench

Execute o arquivo:

database/schema.sql

Isso criará:
- banco de dados (`projetoIntegrador`)
- tabelas (`pacientes`, `atendimentos`, `triagem`, `consulta_medica`)
