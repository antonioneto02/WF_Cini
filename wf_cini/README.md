# Workflow BPM Corporativo - WF CINI

Implementacao completa de um modulo BPM dentro do ERP Node existente em `WF_Cini/wf_cini`, com frontend EJS + TailwindCSS + Vanilla JS e backend Express + MySQL.

## Stack

- Backend: Node.js + Express
- Frontend: EJS + TailwindCSS + JavaScript puro
- Banco: MySQL (via `mysql2`)
- Modelagem BPMN: `bpmn-js` no navegador
- Motor BPM: Node.js proprio (sem framework BPM pronto)
- Autenticacao: middleware existente (`ensureAuth`) reaproveitado

## Estrutura

```text
/backend
  app.js
  /routes
  /controllers
  /services
  /repositories
  /middlewares
  /models

/frontend
  /views
  /public
    /css
    /js
    /bpmn
    /images

/sql
  01_processos.sql
  02_versoes.sql
  03_instancias.sql
  04_tarefas.sql
  05_historico.sql
  06_propriedades_bpmn.sql
```

## Rotas Principais

- Web:
  - `/processos`
  - `/processos/novo`
  - `/processos/:id`
  - `/processos/:id/modelar`
  - `/processos/:id/publicar`
  - `/tarefas`
  - `/tarefas/:id`
  - `/formularios/construtor`

- API:
  - `/api/processos`
  - `/api/tarefas`
  - `/api/instancias`
  - `/api/formularios`

Todas protegidas por autenticacao existente.

## Funcionalidades Entregues

- Modelador BPMN visual com `bpmn-js`:
  - drag and drop, zoom, mini-map, grid, undo/redo, multiselect, copy/paste, reconnect, delete de nos/conexoes, bendpoints, snap
  - suporte a StartEvent, EndEvent, UserTask, ServiceTask, gateways exclusive/parallel/inclusive, subprocessos
  - edicao de label no canvas e condicoes de fluxo via painel lateral
- Painel lateral manual de propriedades:
  - nome, id tecnico, tipo, responsavel, SLA, condicao, fluxo padrao, script, formulario vinculado
  - persistencia em JSON junto ao BPMN XML
- Versionamento:
  - cada salvamento cria nova versao
  - publicacao de versao
  - apenas versao publicada e executada
- Motor BPM proprio:
  - interpreta XML BPMN
  - inicia instancia
  - cria tarefas humanas
  - avalia condicoes
  - executa timers (agendamento em memoria)
  - movimenta fluxo automaticamente
  - finaliza em EndEvent
  - registra historico completo
- Central de tarefas:
  - Kanban (Minhas tarefas / Em andamento / Concluidas)
  - drag and drop em JS puro
  - filtros, busca e pagina
  - detalhe da tarefa com historico + aprovar/rejeitar + observacao
- Formularios dinamicos:
  - construtor (texto, numero, data, select, radio, checkbox, upload, textarea)
  - schema salvo em JSON
  - vinculo com UserTask
  - renderizacao dinamica na abertura da tarefa

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente no `.env`:

```env
PORT=3000
SESSION_SECRET=seu_segredo

# MySQL (preferencial)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=senha
MYSQL_DATABASE=workflow_bpm

# fallback para reaproveitar padrao atual do projeto
DB_SERVER_ERP=localhost
DB_USER_ERP=root
DB_PASSWORD_ERP=senha
DB_DATABASE_BI=workflow_bpm
```

3. Execute SQL na ordem:

1. `sql/01_processos.sql`
2. `sql/02_versoes.sql`
3. `sql/03_instancias.sql`
4. `sql/04_tarefas.sql`
5. `sql/05_historico.sql`
6. `sql/06_propriedades_bpmn.sql`

4. Suba o servidor:

```bash
npm run dev
```

ou

```bash
npm start
```

5. Acesse:

- `http://localhost:3000/processos`
- `http://localhost:3000/tarefas`
- `http://localhost:3000/formularios/construtor`

## Observacoes

- O login nao foi recriado: o BPM usa o middleware de autenticacao existente.
- Timers do motor BPM sao agendados em memoria de processo Node (em caso de restart, timers pendentes devem ser reprocessados pela aplicacao).
- Upload no formulario dinamico salva nome do arquivo na resposta; integracao de armazenamento fisico pode ser adicionada conforme padrao do ERP.
