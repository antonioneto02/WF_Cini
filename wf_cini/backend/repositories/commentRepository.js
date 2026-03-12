const db = require('../models/db');

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = db
    .query(
      `IF OBJECT_ID('dbo.WF_COMENTARIOS', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.WF_COMENTARIOS (
           id BIGINT IDENTITY(1,1) PRIMARY KEY,
           processo_id BIGINT NOT NULL,
           instancia_processo_id BIGINT NOT NULL,
           tarefa_id BIGINT NULL,
           autor NVARCHAR(120) NOT NULL,
           mensagem NVARCHAR(MAX) NOT NULL,
           mencoes_json NVARCHAR(MAX) NULL,
           status NVARCHAR(20) NOT NULL DEFAULT 'ATIVO',
           dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
           dt_atualizacao DATETIME2 NULL
         );

         CREATE INDEX idx_wf_comentarios_instancia
           ON dbo.WF_COMENTARIOS(instancia_processo_id, dt_criacao DESC);

         CREATE INDEX idx_wf_comentarios_tarefa
           ON dbo.WF_COMENTARIOS(tarefa_id, dt_criacao DESC);

         CREATE INDEX idx_wf_comentarios_autor
           ON dbo.WF_COMENTARIOS(autor, dt_criacao DESC);
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

async function createComment({
  processoId,
  instanciaId,
  tarefaId = null,
  autor,
  mensagem,
  mencoesJson = null,
}) {
  await ensureSchema();

  const result = await db.query(
    `INSERT INTO WF_COMENTARIOS
      (processo_id, instancia_processo_id, tarefa_id, autor, mensagem, mencoes_json, dt_criacao, dt_atualizacao)
     VALUES
      (:processoId, :instanciaId, :tarefaId, :autor, :mensagem, :mencoesJson, NOW(), NOW())`,
    {
      processoId,
      instanciaId,
      tarefaId,
      autor,
      mensagem,
      mencoesJson,
    }
  );

  return result.insertId;
}

async function listByScope({ instanciaId = null, tarefaId = null, limit = 120 }) {
  await ensureSchema();

  const safeLimit = Math.max(1, Number(limit) || 120);

  return db.query(
    `SELECT TOP (:limit)
            c.id,
            c.processo_id,
            c.instancia_processo_id,
            c.tarefa_id,
            c.autor,
            c.mensagem,
            c.mencoes_json,
            c.dt_criacao AS created_at,
            t.nome_etapa,
            p.nome AS processo_nome
     FROM WF_COMENTARIOS c
     LEFT JOIN TAREFAS t ON t.id = c.tarefa_id
     LEFT JOIN PROCESSOS p ON p.id = c.processo_id
     WHERE c.status = 'ATIVO'
       AND (:instanciaId IS NULL OR c.instancia_processo_id = :instanciaId)
       AND (:tarefaId IS NULL OR c.tarefa_id = :tarefaId)
     ORDER BY c.dt_criacao DESC`,
    {
      limit: safeLimit,
      instanciaId,
      tarefaId,
    }
  );
}

async function listRecentByUserContext({ usuario, limit = 10 }) {
  await ensureSchema();

  const safeLimit = Math.max(1, Number(limit) || 10);

  return db.query(
    `SELECT TOP (:limit)
            c.id,
            c.processo_id,
            c.instancia_processo_id,
            c.tarefa_id,
            c.autor,
            c.mensagem,
            c.mencoes_json,
            c.dt_criacao AS created_at,
            p.nome AS processo_nome,
            t.nome_etapa
     FROM WF_COMENTARIOS c
     LEFT JOIN PROCESSOS p ON p.id = c.processo_id
     LEFT JOIN TAREFAS t ON t.id = c.tarefa_id
     WHERE c.status = 'ATIVO'
       AND (
         UPPER(LTRIM(RTRIM(c.autor))) = UPPER(LTRIM(RTRIM(:usuario)))
         OR c.mencoes_json LIKE :mentionLike
       )
     ORDER BY c.dt_criacao DESC`,
    {
      limit: safeLimit,
      usuario,
      mentionLike: `%${String(usuario || '').trim().toUpperCase()}%`,
    }
  );
}

module.exports = {
  ensureSchema,
  createComment,
  listByScope,
  listRecentByUserContext,
};
