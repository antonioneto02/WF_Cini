const db = require('../models/db');

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = db
    .query(
      `IF OBJECT_ID('dbo.WF_NOTIFICACOES', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.WF_NOTIFICACOES (
           id BIGINT IDENTITY(1,1) PRIMARY KEY,
           usuario NVARCHAR(120) NOT NULL,
           titulo NVARCHAR(180) NOT NULL,
           mensagem NVARCHAR(MAX) NULL,
           tipo NVARCHAR(40) NOT NULL DEFAULT 'INFO',
           escopo_tipo NVARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
           escopo_id BIGINT NULL,
           prioridade INT NOT NULL DEFAULT 2,
           nivel_escalonamento INT NOT NULL DEFAULT 0,
           meta_json NVARCHAR(MAX) NULL,
           status NVARCHAR(20) NOT NULL DEFAULT 'UNREAD',
           lido_em DATETIME2 NULL,
           dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
           dt_atualizacao DATETIME2 NULL
         );

         CREATE INDEX idx_wf_notificacoes_usuario_status
           ON dbo.WF_NOTIFICACOES(usuario, status, dt_criacao DESC);

         CREATE INDEX idx_wf_notificacoes_escopo
           ON dbo.WF_NOTIFICACOES(escopo_tipo, escopo_id, nivel_escalonamento, dt_criacao DESC);
       END`
    )
    .then(() => {
      schemaReady = true;
    })
    .finally(() => {
      schemaPromise = null;
    });

  return schemaPromise;
}

async function createNotification({
  usuario,
  titulo,
  mensagem,
  tipo = 'INFO',
  escopoTipo = 'SYSTEM',
  escopoId = null,
  prioridade = 2,
  nivelEscalonamento = 0,
  metaJson = null,
}) {
  await ensureSchema();

  await db.query(
    `INSERT INTO WF_NOTIFICACOES
      (usuario, titulo, mensagem, tipo, escopo_tipo, escopo_id, prioridade, nivel_escalonamento, meta_json, status, dt_criacao, dt_atualizacao)
     VALUES
      (:usuario, :titulo, :mensagem, :tipo, :escopoTipo, :escopoId, :prioridade, :nivelEscalonamento, :metaJson, 'UNREAD', NOW(), NOW())`,
    {
      usuario,
      titulo,
      mensagem,
      tipo,
      escopoTipo,
      escopoId,
      prioridade,
      nivelEscalonamento,
      metaJson,
    }
  );
}

function normalizeUserList(users) {
  const source = Array.isArray(users) ? users : [];
  const normalized = source
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function buildUsersWhereClause(users, params, fieldName = 'usuario') {
  const safeUsers = normalizeUserList(users);
  if (!safeUsers.length) return '1 = 0';

  const parts = safeUsers.map((user, index) => {
    const paramName = `usuario${index}`;
    params[paramName] = user;
    return `UPPER(LTRIM(RTRIM(ISNULL(${fieldName}, '')))) = :${paramName}`;
  });

  return `(${parts.join(' OR ')})`;
}

async function listByUser({ usuario, status = null, page = 1, pageSize = 20 }) {
  return listByUsers({ usuarios: [usuario], status, page, pageSize });
}

async function listByUsers({ usuarios = [], status = null, page = 1, pageSize = 20 }) {
  await ensureSchema();

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const offset = (safePage - 1) * safePageSize;
  const whereParams = { status, offset, limit: safePageSize };
  const userWhereClause = buildUsersWhereClause(usuarios, whereParams);

  const rows = await db.query(
    `SELECT id, usuario, titulo, mensagem, tipo,
            escopo_tipo, escopo_id, prioridade, nivel_escalonamento,
            meta_json, status, lido_em, dt_criacao AS created_at
     FROM WF_NOTIFICACOES
     WHERE ${userWhereClause}
       AND (:status IS NULL OR status = :status)
     ORDER BY status ASC, dt_criacao DESC
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    whereParams
  );

  const countParams = { status };
  const userWhereForCount = buildUsersWhereClause(usuarios, countParams);
  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM WF_NOTIFICACOES
     WHERE ${userWhereForCount}
       AND (:status IS NULL OR status = :status)`,
    countParams
  );

  const unreadParams = {};
  const userWhereForUnread = buildUsersWhereClause(usuarios, unreadParams);
  const unreadRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM WF_NOTIFICACOES
     WHERE ${userWhereForUnread}
       AND status = 'UNREAD'`,
    unreadParams
  );

  return {
    data: rows,
    total: countRows[0] ? Number(countRows[0].total) : 0,
    unread: unreadRows[0] ? Number(unreadRows[0].total) : 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function markAsRead({ id, usuario }) {
  return markAsReadForUsers({ id, usuarios: [usuario] });
}

async function markAsReadForUsers({ id, usuarios = [] }) {
  await ensureSchema();

  const params = { id };
  const userWhereClause = buildUsersWhereClause(usuarios, params);

  await db.query(
    `UPDATE WF_NOTIFICACOES
     SET status = 'READ',
         lido_em = CASE WHEN lido_em IS NULL THEN NOW() ELSE lido_em END,
         dt_atualizacao = NOW()
     WHERE id = :id
       AND ${userWhereClause}`,
    params
  );
}

async function markAllAsRead(usuario) {
  return markAllAsReadForUsers([usuario]);
}

async function markAllAsReadForUsers(usuarios = []) {
  await ensureSchema();

  const params = {};
  const userWhereClause = buildUsersWhereClause(usuarios, params);

  await db.query(
    `UPDATE WF_NOTIFICACOES
     SET status = 'READ',
         lido_em = CASE WHEN lido_em IS NULL THEN NOW() ELSE lido_em END,
         dt_atualizacao = NOW()
     WHERE ${userWhereClause}
       AND status = 'UNREAD'`,
    params
  );
}

async function existsRecentEscalation({ usuario, escopoId, nivelEscalonamento, lookbackMinutes = 180 }) {
  await ensureSchema();

  const rows = await db.query(
    `SELECT TOP (1) id
     FROM WF_NOTIFICACOES
     WHERE UPPER(LTRIM(RTRIM(usuario))) = UPPER(LTRIM(RTRIM(:usuario)))
       AND escopo_tipo = 'TASK'
       AND escopo_id = :escopoId
       AND tipo = 'SLA_ESCALATION'
       AND nivel_escalonamento = :nivelEscalonamento
       AND dt_criacao >= DATEADD(MINUTE, -:lookbackMinutes, GETDATE())`,
    {
      usuario,
      escopoId,
      nivelEscalonamento,
      lookbackMinutes,
    }
  );

  return Boolean(rows[0]);
}

async function listLatestSlaAlerts({ usuario, limit = 8 }) {
  return listLatestSlaAlertsForUsers({ usuarios: [usuario], limit });
}

async function listLatestSlaAlertsForUsers({ usuarios = [], limit = 8 }) {
  await ensureSchema();

  const safeLimit = Math.max(1, Number(limit) || 8);
  const params = { limit: safeLimit };
  const userWhereClause = buildUsersWhereClause(usuarios, params);

  return db.query(
    `SELECT TOP (:limit)
            id, titulo, mensagem, prioridade, nivel_escalonamento,
            escopo_tipo, escopo_id, status, dt_criacao AS created_at
     FROM WF_NOTIFICACOES
     WHERE ${userWhereClause}
       AND tipo = 'SLA_ESCALATION'
     ORDER BY status ASC, dt_criacao DESC`,
    params
  );
}

async function listSlaBreachCandidates({ usuario, limit = 30 }) {
  await ensureSchema();

  const safeLimit = Math.max(1, Number(limit) || 30);

  return db.query(
    `SELECT TOP (:limit)
            t.id AS task_id,
            t.instancia_processo_id,
            t.processo_id,
            t.nome_etapa,
            t.responsavel,
            t.sla_horas,
            t.status,
            t.iniciado_em,
            t.dt_criacao,
            p.nome AS processo_nome,
            i.solicitante,
            DATEADD(HOUR, ISNULL(t.sla_horas, 24), COALESCE(t.iniciado_em, t.dt_criacao)) AS prazo_final,
            DATEDIFF(MINUTE, DATEADD(HOUR, ISNULL(t.sla_horas, 24), COALESCE(t.iniciado_em, t.dt_criacao)), GETDATE()) AS atraso_minutos
     FROM TAREFAS t
     JOIN PROCESSOS p ON p.id = t.processo_id
     JOIN INSTANCIAS_PROCESSO i ON i.id = t.instancia_processo_id
     WHERE t.status IN ('MINHAS_TAREFAS', 'EM_ANDAMENTO')
       AND UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = UPPER(LTRIM(RTRIM(:usuario)))
       AND DATEADD(HOUR, ISNULL(t.sla_horas, 24), COALESCE(t.iniciado_em, t.dt_criacao)) < GETDATE()
     ORDER BY atraso_minutos DESC`,
    {
      usuario,
      limit: safeLimit,
    }
  );
}

module.exports = {
  ensureSchema,
  createNotification,
  listByUser,
  listByUsers,
  markAsRead,
  markAsReadForUsers,
  markAllAsRead,
  markAllAsReadForUsers,
  existsRecentEscalation,
  listLatestSlaAlerts,
  listLatestSlaAlertsForUsers,
  listSlaBreachCandidates,
};
