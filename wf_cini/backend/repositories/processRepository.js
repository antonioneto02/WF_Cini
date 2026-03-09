const db = require('../models/db');

async function listProcesses({ page = 1, pageSize = 10, search = '' }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const offset = (safePage - 1) * safePageSize;
  const likeSearch = `%${search || ''}%`;

  const rows = await db.query(
    `SELECT p.id, p.nome, p.codigo, p.descricao, p.status,
            p.criado_por AS created_by, p.dt_criacao AS created_at,
            v.versao, v.status AS versao_status, v.id AS versao_id
     FROM processos p
     LEFT JOIN versoes_processo v
       ON v.processo_id = p.id
      AND v.id = (
          SELECT TOP 1 vv.id
          FROM versoes_processo vv
          WHERE vv.processo_id = p.id
          ORDER BY vv.versao DESC
      )
     WHERE p.nome LIKE :likeSearch OR p.codigo LIKE :likeSearch
     ORDER BY p.dt_criacao DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    { likeSearch, limit: safePageSize, offset }
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM processos p
     WHERE p.nome LIKE :likeSearch OR p.codigo LIKE :likeSearch`,
    { likeSearch }
  );

  return {
    data: rows,
    page: safePage,
    pageSize: safePageSize,
    total: countRows[0] ? countRows[0].total : 0,
  };
}

async function createProcess({ nome, codigo, descricao, criadoPor }) {
  const result = await db.query(
    `INSERT INTO processos (nome, codigo, descricao, status, criado_por, dt_criacao, dt_atualizacao)
     VALUES (:nome, :codigo, :descricao, 'ATIVO', :criadoPor, NOW(), NOW())`,
    { nome, codigo, descricao, criadoPor }
  );
  return result.insertId;
}

async function getProcessById(id) {
  const rows = await db.query(
    `SELECT id, nome, codigo, descricao, status,
            criado_por AS created_by, atualizado_por AS updated_by,
            dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM processos
     WHERE id = :id`,
    { id }
  );
  return rows[0] || null;
}

async function updateProcess({ id, nome, descricao, status, updatedBy }) {
  await db.query(
    `UPDATE processos
     SET nome = :nome,
         descricao = :descricao,
         status = :status,
         atualizado_por = :updatedBy,
         dt_atualizacao = NOW()
     WHERE id = :id`,
    { id, nome, descricao, status, updatedBy }
  );
}

async function listVersionsByProcess(processoId) {
  return db.query(
    `SELECT id, processo_id, versao, status, publicado_em, observacao_publicacao,
            xml_bpmn AS bpmn_xml, propriedades_json, dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM versoes_processo
     WHERE processo_id = :processoId
     ORDER BY versao DESC`,
    { processoId }
  );
}

async function getVersionById(versionId) {
  const rows = await db.query(
    `SELECT id, processo_id, versao, status, xml_bpmn AS bpmn_xml, propriedades_json, publicado_em, dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM versoes_processo
     WHERE id = :versionId`,
    { versionId }
  );
  return rows[0] || null;
}

async function getLatestVersionNumber(processoId) {
  const rows = await db.query(
    `SELECT MAX(versao) AS ultima_versao
     FROM versoes_processo
     WHERE processo_id = :processoId`,
    { processoId }
  );
  return (rows[0] && rows[0].ultima_versao) || 0;
}

async function createVersion({ processoId, versao, bpmnXml, propriedadesJson, createdBy }) {
  const result = await db.query(
    `INSERT INTO versoes_processo
      (processo_id, versao, status, xml_bpmn, propriedades_json, criado_por, dt_criacao, dt_atualizacao)
     VALUES
      (:processoId, :versao, 'RASCUNHO', :bpmnXml, :propriedadesJson, :createdBy, NOW(), NOW())`,
    { processoId, versao, bpmnXml, propriedadesJson, createdBy }
  );
  return result.insertId;
}

async function publishVersion({ processoId, versaoId, observacao, publishedBy }) {
  await db.query(
    `UPDATE versoes_processo
     SET status = 'ARQUIVADA', dt_atualizacao = NOW()
     WHERE processo_id = :processoId
       AND status = 'PUBLICADA'`,
    { processoId }
  );

  await db.query(
    `UPDATE versoes_processo
     SET status = 'PUBLICADA', publicado_em = NOW(), observacao_publicacao = :observacao,
         publicado_por = :publishedBy, dt_atualizacao = NOW()
     WHERE id = :versaoId
       AND processo_id = :processoId`,
    { processoId, versaoId, observacao, publishedBy }
  );
}

async function getPublishedVersion(processoId) {
  const rows = await db.query(
    `SELECT id, processo_id, versao, xml_bpmn AS bpmn_xml, propriedades_json
     FROM versoes_processo
     WHERE processo_id = :processoId AND status = 'PUBLICADA'
     ORDER BY versao DESC
     OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`,
    { processoId }
  );
  return rows[0] || null;
}

async function getProcessByCodigo(codigo) {
  const rows = await db.query(
    `SELECT id, nome, codigo, descricao, status, dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM processos
     WHERE codigo = :codigo`,
    { codigo }
  );
  return rows[0] || null;
}

async function getProcessDeleteDependencies(processoId) {
  const versionRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM versoes_processo
     WHERE processo_id = :processoId`,
    { processoId }
  );

  const formRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM formularios
     WHERE processo_id = :processoId`,
    { processoId }
  );

  const instanceRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM instancias_processo
     WHERE processo_id = :processoId`,
    { processoId }
  );

  const taskRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM tarefas
     WHERE processo_id = :processoId`,
    { processoId }
  );

  const historyRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM historico_fluxo
     WHERE processo_id = :processoId`,
    { processoId }
  );

  return {
    versions: Number(versionRows[0] ? versionRows[0].total : 0),
    forms: Number(formRows[0] ? formRows[0].total : 0),
    instances: Number(instanceRows[0] ? instanceRows[0].total : 0),
    tasks: Number(taskRows[0] ? taskRows[0].total : 0),
    history: Number(historyRows[0] ? historyRows[0].total : 0),
  };
}

async function deleteProcess(processoId) {
  await db.query(
    `DELETE FROM processos
     WHERE id = :processoId`,
    { processoId }
  );
}

module.exports = {
  listProcesses,
  createProcess,
  getProcessById,
  updateProcess,
  listVersionsByProcess,
  getVersionById,
  getLatestVersionNumber,
  createVersion,
  publishVersion,
  getPublishedVersion,
  getProcessByCodigo,
  getProcessDeleteDependencies,
  deleteProcess,
};
