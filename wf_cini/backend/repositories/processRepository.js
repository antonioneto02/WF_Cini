const db = require('../models/db');

const _columnCache = {};

async function hasProcessColumn(columnName) {
  if (_columnCache[columnName] !== undefined) return _columnCache[columnName];
  try {
    const rows = await db.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PROCESSOS' AND COLUMN_NAME = :columnName`,
      { columnName }
    );
    const exists = rows && rows[0] && Number(rows[0].cnt || 0) > 0;
    _columnCache[columnName] = exists;
    return exists;
  } catch (err) {
    _columnCache[columnName] = false;
    return false;
  }
}

async function listProcesses({ page = 1, pageSize = 10, search = '', createdBy = null }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const offset = (safePage - 1) * safePageSize;
  const likeSearch = `%${search || ''}%`;

  const rows = await db.query(
    `SELECT p.id, p.nome, p.descricao, p.status,
            p.usa_identificador, p.tipo_identificador,
            p.criado_por AS created_by, p.dt_criacao AS created_at,
            v.versao, v.status AS versao_status, v.id AS versao_id,
            i.id AS latest_instance_id,
            i.status AS latest_instance_status,
            i.elemento_atual_id AS latest_current_element_id,
            i.versao_processo_id AS latest_instance_version_id,
            i.iniciado_em AS latest_started_at,
            p.id AS codigo
     FROM processos p
     LEFT JOIN versoes_processo v
       ON v.processo_id = p.id
      AND v.id = (
          SELECT TOP 1 vv.id
          FROM versoes_processo vv
          WHERE vv.processo_id = p.id
          ORDER BY vv.versao DESC
      )
        LEFT JOIN instancias_processo i
         ON i.id = (
           SELECT TOP 1 ii.id
           FROM instancias_processo ii
           WHERE ii.processo_id = p.id
           ORDER BY ii.dt_criacao DESC
         )
    WHERE (p.nome LIKE :likeSearch OR p.descricao LIKE :likeSearch)
       AND (:createdBy IS NULL OR UPPER(LTRIM(RTRIM(ISNULL(p.criado_por, '')))) = UPPER(LTRIM(RTRIM(ISNULL(:createdBy, '')))))
     ORDER BY p.dt_criacao DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
       { likeSearch, createdBy, limit: safePageSize, offset }
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM processos p
     WHERE (p.nome LIKE :likeSearch OR p.descricao LIKE :likeSearch)
       AND (:createdBy IS NULL OR UPPER(LTRIM(RTRIM(ISNULL(p.criado_por, '')))) = UPPER(LTRIM(RTRIM(ISNULL(:createdBy, '')))))`,
    { likeSearch, createdBy }
  );

  return {
    data: rows,
    page: safePage,
    pageSize: safePageSize,
    total: countRows[0] ? countRows[0].total : 0,
  };
}

async function createProcess({ nome, codigo, descricao, criadoPor, usaIdentificador = false, tipoIdentificador = null, descIden = null }) {
  const hasDesc = await hasProcessColumn('desc_iden');
  const hasIdentificador = await hasProcessColumn('identificador');
  const hasCodigo = !hasIdentificador && await hasProcessColumn('codigo');

  const fields = [];
  const values = [];
  const params = { nome, descricao, usaIdentificador, tipoIdentificador, criadoPor };

  if (hasIdentificador) {
    fields.push('identificador');
    values.push(':codigo');
    params.codigo = codigo;
  } else if (hasCodigo) {
    fields.push('codigo');
    values.push(':codigo');
    params.codigo = codigo;
  }

  if (hasDesc) {
    fields.push('desc_iden');
    values.push(':descIden');
    params.descIden = descIden;
  }

  // common fields
  fields.push('nome', 'descricao', 'status', 'usa_identificador', 'tipo_identificador', 'criado_por', 'dt_criacao', 'dt_atualizacao');
  values.push(':nome', ':descricao', "'ATIVO'", ':usaIdentificador', ':tipoIdentificador', ':criadoPor', 'NOW()', 'NOW()');

  const sql = `INSERT INTO processos (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  const result = await db.query(sql, params);
  return result.insertId;
}

async function getProcessById(id) {
  const includeDesc = await hasProcessColumn('desc_iden');
  const codeColIdent = await hasProcessColumn('identificador');
  const codeColCodigo = !codeColIdent && await hasProcessColumn('codigo');

  let selectSql = `SELECT id, nome, descricao, status,
            usa_identificador, tipo_identificador,
            criado_por AS created_by, atualizado_por AS updated_by,
            dt_criacao AS created_at, dt_atualizacao AS updated_at`;
  if (includeDesc) selectSql += `, desc_iden`;
  if (codeColIdent) selectSql += `, identificador AS codigo`;
  else if (codeColCodigo) selectSql += `, codigo AS codigo`;
  else selectSql += `, id AS codigo`;

  selectSql += ` FROM processos WHERE id = :id`;

  const rows = await db.query(selectSql, { id });
  return rows[0] || null;
}

async function updateProcess({ id, nome, descricao, status, usaIdentificador, tipoIdentificador, updatedBy, descIden = null }) {
  const includeDesc = await hasProcessColumn('desc_iden');

  const sets = [
    'nome = :nome',
    'descricao = :descricao',
    'status = :status',
    'usa_identificador = :usaIdentificador',
    'tipo_identificador = :tipoIdentificador',
    'atualizado_por = :updatedBy',
    'dt_atualizacao = NOW()'
  ];

  const params = { id, nome, descricao, status, usaIdentificador, tipoIdentificador, updatedBy };
  if (includeDesc) {
    sets.splice(5, 0, 'desc_iden = :descIden');
    params.descIden = descIden;
  }

  const sql = `UPDATE processos SET ${sets.join(', ')} WHERE id = :id`;
  await db.query(sql, params);
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
  if (/^\d+$/.test(String(codigo))) {
    const rows = await db.query(
      `SELECT id, nome, descricao, status, usa_identificador, tipo_identificador,
              criado_por AS created_by, dt_criacao AS created_at, dt_atualizacao AS updated_at
       FROM processos
       WHERE id = :codigo`,
      { codigo: Number(codigo) }
    );
    if (rows && rows[0]) return rows[0];
  }

  const rows = await db.query(
    `SELECT id, nome, descricao, status, usa_identificador, tipo_identificador,
            criado_por AS created_by, dt_criacao AS created_at, dt_atualizacao AS updated_at
     FROM processos
     WHERE nome = :codigo`,
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
