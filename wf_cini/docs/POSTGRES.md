# Banco de dados: SQL Server hoje, PostgreSQL quando quiser

Mesmo padrão do Planner Cini. Este app usa variáveis próprias (`*_WF`) para não colidir com o `DB_PASSWORD` global definido no Windows deste servidor; no SQL Server, se estiverem vazias, valem as `*_ERP` de sempre.

## Como está organizado

| Conexão | Arquivo | Banco | Variáveis |
|---|---|---|---|
| Tabelas do workflow (`PROCESSOS`, `VERSOES_PROCESSO`, `INSTANCIAS_PROCESSO`, `TAREFAS`, `HISTORICO_FLUXO`, `FORMULARIOS`, `RESPOSTAS_FORMULARIO`, `PROCESSO_PERMISSOES`, `PROCESSO_API_CONFIG`, `PROCESSO_INTEGRACAO_EVENTOS`, `AUTOMACOES_CATALOGO`, `ECM_ARQUIVOS`, `PROPRIEDADES_BPMN`, `WF_NOTIFICACOES`, `WF_COMENTARIOS`, `WF_DASHBOARD_PREFS`) | `database/sequelize.js` | `mssql` (padrão) ou `postgres` | `DB_DIALECT`, `DB_SERVER_WF`, `DB_PORT_WF`, `DB_USER_WF`, `DB_PASSWORD_WF`, `DB_DATABASE_WF` (padrão `wf`), `DB_SSL_WF=1` |
| Protheus (`SYS_USR`, busca de usuários) e o nó "DB" do BPM (SQL escrito no próprio processo) | `backend/models/db.js` + `config/database.js` | sempre SQL Server | `DB_SERVER_ERP`, `DB_USER_ERP`, `DB_PASSWORD_ERP`, `DB_DATABASE_ERP`, `DB_DATABASE_PROTHEUS` (sem mudança) |
| Login, DW, fila de notificações | `controllers/loginController.js`, `config/dbConfig*.js` | sempre SQL Server | sem mudança |

- `models/`: models Sequelize das tabelas do workflow; a ordem de migração (`ORDEM`) e as junções em `models/index.js`.
- `backend/repositories/*` (exceto `protheusUserRepository.js`) não escrevem mais SQL à mão: tudo passa pelo ORM. Helpers de consulta portáveis em `database/consultas.js` (busca sem diferenciar maiúsculas, filtros de data, paginação).
- `database/sql/postgres/create_tables.sql`: DDL do PostgreSQL (inclui a CHECK `CK_PROCESSOS_TIPO_IDENTIFICADOR` do SQL Server).

Sem nenhuma variável nova no `.env`, o app continua exatamente como antes (SQL Server).

## Trocar para PostgreSQL

1. Crie o banco: `CREATE DATABASE wf ENCODING 'UTF8';`
2. Copie os dados (só lê o SQL Server; cria as tabelas, copia tudo e acerta as sequências de `id`):
   ```
   DESTINO_DB_SERVER=... DESTINO_DB_PORT=5432 DESTINO_DB_USER=... DESTINO_DB_PASSWORD=... DESTINO_DB_DATABASE=wf npm run db:migrar:postgres
   ```
3. No `.env`:
   ```
   DB_DIALECT=postgres
   DB_SERVER_WF=<postgres>  DB_PORT_WF=5432  DB_USER_WF=...  DB_PASSWORD_WF=...  DB_DATABASE_WF=wf
   (os *_ERP continuam apontando para o SQL Server)
   ```
4. Reinicie o app. Para voltar, basta remover `DB_DIALECT` e os `*_WF`.

## Testes

- `npm run test:unit`: sem banco (roda no CI). Confere a escolha do dialeto, que Protheus e o nó "DB" seguem no SQL Server, que nenhum repositório do workflow usa mais SQL direto e que o DDL do PostgreSQL tem todas as tabelas/colunas dos models.
- `npm run test:integracao`: contra bancos reais, exercitando processos, versões, instâncias, tarefas/kanban, notificações e SLA, formulários, histórico, comentários, ECM, permissões, API por processo, automações e a limpeza geral.
  - SQL Server (usa o `.env`; tudo roda numa transação desfeita no fim, nada é gravado e o `IDENTITY` das tabelas volta ao valor anterior): `TESTE_DIALETO=mssql npm run test:integracao`
  - PostgreSQL (banco vazio de teste): `TESTE_DIALETO=postgres TESTE_PG_SERVER=localhost TESTE_PG_PORT=5432 TESTE_PG_USER=postgres TESTE_PG_PASSWORD=... TESTE_PG_DATABASE=teste_wf npm run test:integracao`

## Mudanças de comportamento

- **Nó "DB" do BPM:** o SQL digitado no processo continua rodando no SQL Server (conexão `*_ERP`). Depois da troca, se esse SQL consultar tabelas do próprio workflow, ele estará lendo a cópia antiga do SQL Server; use esse nó só para dados do ERP/DW.
- `WF_NOTIFICACOES`, `WF_COMENTARIOS` e `WF_DASHBOARD_PREFS` não são mais criadas pelo app na primeira chamada (já existem no SQL Server; no PostgreSQL vêm do `create_tables.sql`).
- A detecção de colunas opcionais em tempo de execução (`desc_iden`, `identificador`, `codigo`) saiu: o esquema é o dos models, igual ao banco `wf` atual.
- `/db-status`: o item `ERP` passa a testar a conexão das tabelas do workflow (SQL Server ou PostgreSQL, conforme o `DB_DIALECT`).
- Buscas por texto (processos, instâncias, tarefas, automações, menções em comentários) e comparações de usuário ignoram maiúsculas/minúsculas nos dois bancos (no SQL Server já era assim).
- Empates de ordenação (mesma data de criação) passam a ser desempatados pelo `id`, nos dois bancos.
- O cálculo de SLA estourado (`prazo_final`, `atraso_minutos`) é feito no Node em vez de `DATEADD`/`DATEDIFF`, com o mesmo resultado.
