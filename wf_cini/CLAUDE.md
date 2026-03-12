# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WF-CINI BPM** is a corporate Business Process Management (BPM) web application integrated with the ERP CINI (Protheus). It enables workflow modeling, task management, form building, and process automation.

## Commands

```bash
# Install dependencies
npm install

# Development server (auto-reload via nodemon)
npm run dev

# Production server
npm start
```

The server runs on port 3000 by default (configurable via `PORT` in `.env`).

No test or lint commands are configured.

## Architecture

### Entry Points

- **`server.js`** — Express app setup, session management, auth middleware (`ensureAuth`), login/logout routes, and static file serving. Mounts the BPM module.
- **`backend/app.js`** — Registers all BPM sub-routes (web, API, public API) and error handler onto the Express app.

### Layer Structure

```
controllers/loginController.js   ← Authentication (Protheus OAuth2)
backend/
  routes/webRoutes.js            ← Page routes (EJS rendering)
  routes/apiRoutes.js            ← REST API endpoints (/api/...)
  controllers/                   ← Request handlers (21 files)
  services/                      ← Business logic (19 files)
  repositories/                  ← Database access (MSSQL via mssql)
  middlewares/                   ← Auth and error middleware
config/
  database.js                    ← Primary MSSQL connection (ERP)
  dbConfigDw.js                  ← Data Warehouse MSSQL connection
  dbConfigProtheus.js            ← Protheus-specific DB config
```

### Key Domain Concepts

| Entity | Portuguese term | Description |
|---|---|---|
| Process | Processo | BPMN process definition |
| Version | Versão | Versioned snapshot of a process |
| Instance | Instância | Running execution of a process |
| Task | Tarefa | Step/activity within an instance |
| Form | Formulário | Dynamic data form attached to tasks |
| Automation | Automação | Trigger/action rules on process events |

### BPMN Engine

`backend/services/bpmEngineService.js` drives workflow execution. `backend/services/bpmnParserService.js` parses BPMN XML using the `bpmn-moddle` library. The BPMN modeler UI is in `frontend/public/js/modeler.js`.

### Authentication

Login authenticates against the Protheus ERP OAuth2 endpoint, sets HTTP-only cookies (`token`, `refresh_token`, `username`, `user_code`), and stores session data. `ensureAuth` middleware in `server.js` guards all protected routes and injects user info into `res.locals`.

### Database

- **Primary (MSSQL):** ERP and BPM data — processes, instances, tasks, forms, history
- **Secondary (MySQL2):** Additional integrations
- SQL schema migrations are in `sql/01_processos.sql` through `sql/08_*.sql`

### Frontend

- **Template engine:** EJS — views split between `views/` (shell/login) and `frontend/views/` (feature pages by module)
- **Feature JS files:** `frontend/public/js/` — one file per page (e.g., `modeler.js`, `form-builder.js`, `tasks-kanban.js`)
- **Shared utilities:** `assets/app.js` (client-side session/stats/CSV), `frontend/public/js/workflow-common.js`
- Bootstrap + jQuery + DataTables are loaded from `PortalConsultasCini/public/`

### External Integrations

- **Protheus ERP** — user auth and business data (via REST and MSSQL)
- **ECM** — document storage under `storage/ecm/`, managed by `backend/services/ecmService.js`

## Environment Variables (`.env`)

```
PORT=3000
JWT_SECRET_ERP=
DB_USER_ERP=
DB_PASSWORD_ERP=
DB_SERVER_ERP=
DB_DATABASE_BI=
DB_DATABASE_DW=
DB_DATABASE_PROTHEUS=
PROTHEUS_SERVER=
```