# 🏷️ WF Cini — Workflow BPM

> Sistema corporativo de BPM (Gerenciamento de Processos de Negócio) com modelagem BPMN para definição e execução de fluxos de trabalho.

## 📋 Sobre o Projeto

O **WF Cini** é um sistema de **Workflow / BPM** (Business Process Management) desenvolvido para gerenciar a definição e execução de processos de negócio dentro da empresa. Ele permite modelar fluxos de trabalho usando a notação **BPMN** (Business Process Model and Notation), registrar módulos e acompanhar a execução de cada etapa.

O sistema resolve a necessidade de:
- **Padronizar** processos corporativos em fluxos visuais
- **Automatizar** a sequência de aprovações e tarefas
- **Rastrear** o andamento de cada processo em tempo real
- **Centralizar** a gestão de processos de diferentes áreas

## 🛠️ Tecnologias

| Tecnologia | Descrição |
|---|---|
| **Node.js** | Ambiente de execução |
| **Express** | Framework web |
| **EJS** | Motor de templates (renderização no servidor) |
| **bpmn-moddle** | Interpretação e modelagem de processos BPMN |
| **mssql** | Conexão com SQL Server |
| **mysql2** | Conexão com MySQL |
| **cookie-parser + express-session** | Gerenciamento de sessão e cookies |
| **swagger-ui-express** | Documentação da API |
| **PM2** | Gerenciador de processos (`wf-cini`) |
| **Porta** | `3008` |

## 🔧 Como Funciona

1. **Autenticação** — O usuário acessa via SSO do **Hub Cini**. O token SSO é recebido pela query string e armazenado em cookie. Após autenticação, o redirecionamento padrão é para `/processos`.
2. **Editor de Processos** — O sistema disponibiliza um editor visual para criar e editar definições de workflow usando a notação BPMN.
3. **Listagem de Processos** — A tela `/processos` exibe todos os processos cadastrados com seus respectivos estados.
4. **Módulos BPM** — O sistema suporta o registro de módulos BPM que podem ser acoplados aos fluxos de trabalho.
5. **Execução** — Cada processo segue o fluxo definido no modelo BPMN, passando pelas etapas configuradas.
6. **Shell ERP** — As páginas são renderizadas dentro de um layout shell (`erpShell.ejs`) que mantém a navegação consistente.

## 📡 Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **Listagem de Processos** (`/processos`) | Exibe todos os processos de workflow cadastrados |
| **Editor de Workflow** | Interface visual para modelagem de processos BPMN |
| **Registro de Módulos BPM** | Cadastro e configuração de módulos de processo |
| **Dashboard** | Painel com visão geral dos processos |
| **Integração SSO** | Login único via Hub Cini |

### Bancos de dados acessados

| Banco | Biblioteca | Uso |
|---|---|---|
| SQL Server (`wf`) | `mssql` | Dados de workflow e processos |
| SQL Server (`p11_prod`) | `mssql` | Dados do ERP Protheus |
| MySQL (`totvsbi`) | `mysql2` | Dados de BI (Business Intelligence) |

## 🗄️ Banco de Dados

- **SQL Server** (biblioteca `mssql`):
  - `wf` — Banco principal de workflow (definições de processos, etapas, execuções)
  - `p11_prod` — Protheus ERP (dados auxiliares)
- **MySQL** (biblioteca `mysql2`):
  - `totvsbi` — TOTVS BI (consultas de Business Intelligence)

## 🔗 Integrações

| Sistema | Tipo | Descrição |
|---|---|---|
| **Hub Cini** | SSO | Autenticação via Single Sign-On (recebe `sso_token` via query string) |
| **PortalConsultasCini** | Recursos estáticos | Compartilha CSS, JavaScript e imagens (`/css`, `/js`, `/images`) |
| **Protheus ERP** | Banco de dados | Consulta dados do ERP via banco `p11_prod` |
| **TOTVS BI** | Banco de dados | Consulta dados de BI via MySQL |

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Porta do servidor
PORT=3008

# SQL Server
DB_USER_ERP=seu_usuario
DB_PASSWORD_ERP=sua_senha
DB_SERVER_ERP=localhost
DB_DATABASE_DW=wf
DB_DATABASE_PROTHEUS=p11_prod

# MySQL (BI)
DB_DATABASE_BI=totvsbi

# Protheus
PROTHEUS_SERVER=protheus.cini.com.br

# Integração
GESTAO_WEBHOOK_TOKEN=token_do_webhook
```

## 📖 Documentação Swagger

A documentação interativa está disponível em:

```
http://localhost:3008/docs
```

## 🚀 Como Rodar

### Pré-requisitos
- Node.js instalado
- SQL Server com os bancos `wf` e `p11_prod` acessíveis
- MySQL com o banco `totvsbi` acessível
- Pasta `PortalConsultasCini` no mesmo diretório do projeto (para CSS/JS/imagens compartilhados)
- PM2 (opcional, para produção)

### Instalação

```bash
# Acessar o diretório do projeto
cd E:/Projetos/WF_Cini/wf_cini

# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Editar o arquivo .env com as credenciais corretas
```

### Executar em desenvolvimento

```bash
npm run dev
```

### Executar em produção (PM2)

```bash
pm2 start server.js --name wf-cini
```

O sistema estará disponível em `http://localhost:3008`.

### Estrutura de pastas

```
wf_cini/
├── backend/             # Lógica de negócio e módulos BPM
├── config/              # Configurações de banco de dados
├── controllers/         # Controladores (loginController)
├── frontend/
│   └── views/           # Templates EJS do frontend
├── views/               # Templates EJS principais
│   ├── partials/        # Componentes reutilizáveis
│   └── System/          # Telas de sistema (login, etc.)
├── assets/              # Recursos estáticos
├── PortalConsultasCini/ # CSS/JS/imagens compartilhados
├── server.js            # Ponto de entrada
└── swagger.js           # Configuração Swagger
```
