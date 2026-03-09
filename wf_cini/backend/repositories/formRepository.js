const db = require('../models/db');

async function listForms({ processId = null, page = 1, pageSize = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const offset = (safePage - 1) * safePageSize;

  const rows = await db.query(
    `SELECT f.id, f.processo_id, f.nome, f.propriedades_json AS schema_json,
            p.nome AS processo_nome,
            f.status, f.criado_por AS created_by, f.atualizado_por AS updated_by,
            f.dt_criacao AS created_at, f.dt_atualizacao AS updated_at
     FROM formularios f
     LEFT JOIN processos p ON p.id = f.processo_id
     WHERE (:processId IS NULL OR f.processo_id = :processId)
     ORDER BY f.dt_criacao DESC
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    { processId, limit: safePageSize, offset }
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM formularios f
     WHERE (:processId IS NULL OR f.processo_id = :processId)`,
    { processId }
  );

  return {
    data: rows,
    total: countRows[0] ? countRows[0].total : 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function getFormById(formId) {
  const rows = await db.query(
    `SELECT id, processo_id, nome, propriedades_json AS schema_json,
            status, criado_por AS created_by, atualizado_por AS updated_by,
            dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM formularios
     WHERE id = :formId`,
    { formId }
  );
  return rows[0] || null;
}

async function createForm({ processoId, nome, schemaJson, xmlBpmn = '', createdBy, status = 'ATIVO' }) {
  const result = await db.query(
    `INSERT INTO formularios
      (processo_id, nome, xml_bpmn, propriedades_json, status, criado_por, dt_criacao, dt_atualizacao)
     VALUES
      (:processoId, :nome, :xmlBpmn, :schemaJson, :status, :createdBy, NOW(), NOW())`,
    { processoId, nome, xmlBpmn, schemaJson, status, createdBy }
  );

  return result.insertId;
}

async function updateForm({ formId, processoId, nome, schemaJson, updatedBy, status = 'ATIVO' }) {
  await db.query(
    `UPDATE formularios
     SET processo_id = :processoId,
         nome = :nome,
         propriedades_json = :schemaJson,
         status = :status,
         atualizado_por = :updatedBy,
         dt_atualizacao = NOW()
     WHERE id = :formId`,
    { formId, processoId, nome, schemaJson, status, updatedBy }
  );
}

async function saveResponse({ tarefaId, instanciaId, formularioId, respostaJson, respondidoPor }) {
  const result = await db.query(
    `INSERT INTO respostas_formulario
      (tarefa_id, instancia_processo_id, formulario_id, resposta_json, respondido_por, dt_criacao, dt_atualizacao)
     VALUES
      (:tarefaId, :instanciaId, :formularioId, :respostaJson, :respondidoPor, NOW(), NOW())`,
    { tarefaId, instanciaId, formularioId, respostaJson, respondidoPor }
  );

  return result.insertId;
}

async function listResponsesByInstance(instanciaId) {
  return db.query(
    `SELECT rf.id, rf.tarefa_id, rf.instancia_processo_id, rf.formulario_id, rf.resposta_json,
            rf.status, rf.respondido_por, rf.dt_criacao AS created_at, f.nome AS formulario_nome
     FROM respostas_formulario rf
     JOIN formularios f ON f.id = rf.formulario_id
     WHERE rf.instancia_processo_id = :instanciaId
     ORDER BY rf.dt_criacao ASC`,
    { instanciaId }
  );
}

async function getFormDeleteDependencies(formId) {
  const responseRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM respostas_formulario
     WHERE formulario_id = :formId`,
    { formId }
  );

  const taskRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM tarefas
     WHERE ISJSON(configuracao_formulario_json) = 1
       AND TRY_CONVERT(INT, JSON_VALUE(configuracao_formulario_json, '$.formId')) = :formId`,
    { formId }
  );

  return {
    responses: Number(responseRows[0] ? responseRows[0].total : 0),
    tasks: Number(taskRows[0] ? taskRows[0].total : 0),
  };
}

async function deleteForm(formId) {
  await db.query(
    `DELETE FROM formularios
     WHERE id = :formId`,
    { formId }
  );
}

module.exports = {
  listForms,
  getFormById,
  createForm,
  updateForm,
  getFormDeleteDependencies,
  deleteForm,
  saveResponse,
  listResponsesByInstance,
};
