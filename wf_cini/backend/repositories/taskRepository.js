const db = require('../models/db');

function normalizeIdentifier(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeIdentifierList(list) {
  const source = Array.isArray(list) ? list : [];
  const normalized = source
    .map((item) => normalizeIdentifier(item))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function buildUserVisibilityClause(userKeys, params) {
  if (!userKeys.length) return '';

  const parts = userKeys.map((key, index) => {
    const paramName = `userKey${index}`;
    params[paramName] = key;
    return `UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = :${paramName}`;
  });

  return `
       AND (
         UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = ''
         OR UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = 'ANY'
          OR ${parts.join('\n          OR ')}
       )`;
}

async function createTask({
  instanciaId,
  processoId,
  versaoProcessoId,
  elementId,
  nomeEtapa,
  responsavel,
  slaHoras,
  formConfigJson,
  status = 'MINHAS_TAREFAS',
}) {
  const normalizedResponsavel = normalizeIdentifier(responsavel) || null;

  const result = await db.query(
    `INSERT INTO tarefas
      (instancia_processo_id, processo_id, versao_processo_id, elemento_id, nome_etapa,
       responsavel, sla_horas, configuracao_formulario_json, status, dt_criacao, dt_atualizacao)
     VALUES
      (:instanciaId, :processoId, :versaoProcessoId, :elementId, :nomeEtapa,
       :responsavel, :slaHoras, :formConfigJson, :status, NOW(), NOW())`,
    {
      instanciaId,
      processoId,
      versaoProcessoId,
      elementId,
      nomeEtapa,
      responsavel: normalizedResponsavel,
      slaHoras,
      formConfigJson,
      status,
    }
  );

  return result.insertId;
}

async function getTaskById(taskId) {
  const rows = await db.query(
    `SELECT t.id, t.instancia_processo_id, t.processo_id, t.versao_processo_id,
            t.elemento_id AS element_id, t.nome_etapa,
            CASE WHEN UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = 'ANY' THEN '' ELSE ISNULL(t.responsavel, '') END AS responsavel,
            t.sla_horas,
            t.configuracao_formulario_json AS form_config_json, t.resposta_json,
            t.acao_final, t.observacao_final, t.status, t.iniciado_em AS started_at,
            t.concluido_em AS completed_at, t.concluido_por AS completed_by, t.dt_criacao AS created_at,
            p.nome AS processo_nome, i.solicitante, i.dados_json AS payload_json
     FROM tarefas t
     JOIN processos p ON p.id = t.processo_id
     JOIN instancias_processo i ON i.id = t.instancia_processo_id
     WHERE t.id = :taskId`,
    { taskId }
  );
  return rows[0] || null;
}

async function listKanbanTasks({
  user,
  userKeys,
  status,
  processoId,
  responsavel,
  search,
  page = 1,
  pageSize = 12,
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 12);
  const offset = (safePage - 1) * safePageSize;
  const likeSearch = `%${search || ''}%`;
  const normalizedResponsavel = normalizeIdentifier(responsavel) || null;
  const normalizedUserKeys = normalizeIdentifierList((userKeys && userKeys.length ? userKeys : [user]) || []);

  const queryParams = {
    status,
    processoId,
    responsavel: normalizedResponsavel,
    likeSearch,
    limit: safePageSize,
    offset,
  };

  const userVisibilityClause = buildUserVisibilityClause(normalizedUserKeys, queryParams);
  const baseFromWhere = `
     FROM tarefas t
     JOIN processos p ON p.id = t.processo_id
     JOIN instancias_processo i ON i.id = t.instancia_processo_id
     WHERE (:status IS NULL OR t.status = :status)
       AND (:processoId IS NULL OR t.processo_id = :processoId)
       AND (:responsavel IS NULL OR UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = :responsavel)
       ${userVisibilityClause}
       AND (
          t.nome_etapa LIKE :likeSearch
          OR p.nome LIKE :likeSearch
          OR i.solicitante LIKE :likeSearch
       )`;

  const rows = await db.query(
      `SELECT t.id, t.nome_etapa, t.status,
        CASE WHEN UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = 'ANY' THEN '' ELSE ISNULL(t.responsavel, '') END AS responsavel,
        t.sla_horas,
        t.elemento_id AS element_id, t.versao_processo_id,
            t.dt_criacao AS created_at, t.iniciado_em AS started_at, t.concluido_em AS completed_at, t.instancia_processo_id,
            p.nome AS processo_nome, i.solicitante
     ${baseFromWhere}
     ORDER BY t.dt_criacao DESC
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    queryParams
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     ${baseFromWhere}`,
    queryParams
  );

  return {
    data: rows,
    total: countRows[0] ? countRows[0].total : 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function updateTaskStatus(taskId, status) {
  await db.query(
    `UPDATE tarefas
     SET status = :status,
         iniciado_em = CASE WHEN :status = 'EM_ANDAMENTO' AND iniciado_em IS NULL THEN NOW() ELSE iniciado_em END,
         concluido_em = CASE WHEN :status = 'CONCLUIDA' THEN NOW() ELSE concluido_em END,
         dt_atualizacao = NOW()
     WHERE id = :taskId`,
    { taskId, status }
  );
}

async function completeTask({ taskId, action, observacao, responseJson, user }) {
  await db.query(
    `UPDATE tarefas
     SET status = 'CONCLUIDA', acao_final = :action, observacao_final = :observacao,
         resposta_json = :responseJson, concluido_por = :user, concluido_em = NOW(), dt_atualizacao = NOW()
     WHERE id = :taskId`,
    { taskId, action, observacao, responseJson, user }
  );
}

async function saveTaskDraft({ taskId, observacao, responseJson, user }) {
  await db.query(
    `UPDATE tarefas
     SET status = CASE WHEN status = 'MINHAS_TAREFAS' THEN 'EM_ANDAMENTO' ELSE status END,
         observacao_final = :observacao,
         resposta_json = :responseJson,
         iniciado_em = CASE WHEN iniciado_em IS NULL THEN NOW() ELSE iniciado_em END,
         atualizado_por = :user,
         dt_atualizacao = NOW()
     WHERE id = :taskId`,
    { taskId, observacao, responseJson, user }
  );
}

async function findOpenTasksByInstance(instanciaId) {
  return db.query(
    `SELECT *
     FROM tarefas
     WHERE instancia_processo_id = :instanciaId
       AND status IN ('MINHAS_TAREFAS', 'EM_ANDAMENTO')`,
    { instanciaId }
  );
}

async function listTasksByInstance(instanciaId) {
  return db.query(
    `SELECT t.id, t.elemento_id AS element_id, t.nome_etapa,
            CASE WHEN UPPER(LTRIM(RTRIM(ISNULL(t.responsavel, '')))) = 'ANY' THEN '' ELSE ISNULL(t.responsavel, '') END AS responsavel,
            t.sla_horas,
            t.status, t.acao_final, t.observacao_final,
            t.iniciado_em AS started_at, t.concluido_em AS completed_at,
            t.concluido_por AS completed_by, t.dt_criacao AS created_at
     FROM tarefas t
     WHERE t.instancia_processo_id = :instanciaId
     ORDER BY t.dt_criacao ASC`,
    { instanciaId }
  );
}

module.exports = {
  createTask,
  getTaskById,
  listKanbanTasks,
  updateTaskStatus,
  completeTask,
  saveTaskDraft,
  findOpenTasksByInstance,
  listTasksByInstance,
};
