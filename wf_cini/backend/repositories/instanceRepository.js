const db = require('../models/db');

const _instanceColumnCache = {};

async function hasInstanceColumn(columnName) {
  if (_instanceColumnCache[columnName] !== undefined) return _instanceColumnCache[columnName];
  try {
    const rows = await db.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'INSTANCIAS_PROCESSO' AND COLUMN_NAME = :columnName`,
      { columnName }
    );
    const exists = rows && rows[0] && Number(rows[0].cnt || 0) > 0;
    _instanceColumnCache[columnName] = exists;
    return exists;
  } catch (err) {
    _instanceColumnCache[columnName] = false;
    return false;
  }
}

async function createInstance({ processoId, versaoId, solicitante, identificador = null, descIden = null, payloadJson, status = 'EM_ANDAMENTO', currentElementId = null }) {
  const hasDesc = await hasInstanceColumn('desc_iden');

  const fields = ['processo_id', 'versao_processo_id', 'solicitante', 'identificador'];
  const values = [':processoId', ':versaoId', ':solicitante', ':identificador'];
  const params = { processoId, versaoId, solicitante, identificador, payloadJson, status, currentElementId };

  if (hasDesc) {
    fields.push('desc_iden');
    values.push(':descIden');
    params.descIden = descIden;
  }

  // rest of fields
  fields.push('dados_json', 'estado_execucao_json', 'status', 'elemento_atual_id', 'iniciado_em', 'dt_criacao', 'dt_atualizacao');
  values.push(':payloadJson', "'{}'", ':status', ':currentElementId', 'NOW()', 'NOW()', 'NOW()');

  const sql = `INSERT INTO instancias_processo (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  const result = await db.query(sql, params);
  return result.insertId;
}

async function getInstanceById(instanceId) {
  const includeInstDesc = await hasInstanceColumn('desc_iden');

  let selectSql = `SELECT i.id, i.processo_id, i.versao_processo_id, i.solicitante, i.identificador`;
  if (includeInstDesc) selectSql += `, i.desc_iden`;
  selectSql += `, i.dados_json AS payload_json, i.estado_execucao_json AS runtime_state_json,
            i.elemento_atual_id AS current_element_id, i.status,
            i.iniciado_em AS started_at, i.encerrado_em AS ended_at,
            i.criado_por AS created_by, i.atualizado_por AS updated_by,
            i.dt_criacao AS created_at, i.dt_atualizacao AS updated_at
     FROM instancias_processo i
     WHERE id = :instanceId`;

  const rows = await db.query(selectSql, { instanceId });
  return rows[0] || null;
}

async function updateInstancePointer(instanceId, currentElementId) {
  await db.query(
    `UPDATE instancias_processo
     SET elemento_atual_id = :currentElementId, dt_atualizacao = NOW()
     WHERE id = :instanceId`,
    { instanceId, currentElementId }
  );
}

async function updateRuntimeState(instanceId, runtimeStateJson) {
  await db.query(
    `UPDATE instancias_processo
     SET estado_execucao_json = :runtimeStateJson, dt_atualizacao = NOW()
     WHERE id = :instanceId`,
    { instanceId, runtimeStateJson }
  );
}

async function finishInstance(instanceId, finalStatus = 'CONCLUIDA') {
  await db.query(
    `UPDATE instancias_processo
     SET status = :finalStatus, encerrado_em = NOW(), dt_atualizacao = NOW()
     WHERE id = :instanceId`,
    { instanceId, finalStatus }
  );
}

async function listInstances({ page = 1, pageSize = 10, processoId = null, status = null, identificador = null, solicitante = null, startDate = null, endDate = null }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const offset = (safePage - 1) * safePageSize;
  let hasProcessDesc = false;
  let hasInstDesc = false;
  try {
    const cols = await db.query(
      `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_NAME = 'PROCESSOS' OR TABLE_NAME = 'INSTANCIAS_PROCESSO') AND COLUMN_NAME = 'desc_iden'`
    );
    (cols || []).forEach((r) => {
      if (String(r.TABLE_NAME || '').toUpperCase() === 'PROCESSOS') hasProcessDesc = true;
      if (String(r.TABLE_NAME || '').toUpperCase() === 'INSTANCIAS_PROCESSO') hasInstDesc = true;
    });
  } catch (_) {
    hasProcessDesc = false;
    hasInstDesc = false;
  }

  let selectSql = `SELECT i.id, i.processo_id, i.versao_processo_id, i.solicitante, i.identificador`;
  if (hasInstDesc) selectSql += `, i.desc_iden AS instance_desc_iden`;
  selectSql += `, i.dados_json AS payload_json, i.estado_execucao_json AS runtime_state_json,
            i.elemento_atual_id AS current_element_id, i.status, i.iniciado_em AS started_at,
            i.encerrado_em AS ended_at, i.dt_criacao AS created_at,
            p.nome AS processo_nome`;
  if (hasProcessDesc) selectSql += `, p.desc_iden AS processo_desc_iden`;
  selectSql += `, v.versao
     FROM instancias_processo i
     JOIN processos p ON p.id = i.processo_id
     JOIN versoes_processo v ON v.id = i.versao_processo_id
      WHERE (:processoId IS NULL OR i.processo_id = :processoId)
        AND (:status IS NULL OR i.status = :status)
        AND (:identificador IS NULL OR i.identificador LIKE :identificadorLike)
        AND (:solicitante IS NULL OR i.solicitante LIKE :solicitanteLike)
        AND (:startDate IS NULL OR i.iniciado_em >= :startDate)
        AND (:endDate IS NULL OR i.iniciado_em < DATEADD(day, 1, :endDate))
      ORDER BY i.dt_criacao DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

  const rows = await db.query(selectSql, {
    processoId,
    status,
    identificador,
    solicitante,
    startDate,
    endDate,
    identificadorLike: identificador ? `%${identificador}%` : null,
    solicitanteLike: solicitante ? `%${solicitante}%` : null,
    limit: safePageSize,
    offset,
  });

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM instancias_processo i
     WHERE (:processoId IS NULL OR i.processo_id = :processoId)
       AND (:status IS NULL OR i.status = :status)
       AND (:identificador IS NULL OR i.identificador LIKE :identificadorLike)
       AND (:solicitante IS NULL OR i.solicitante LIKE :solicitanteLike)
       AND (:startDate IS NULL OR i.iniciado_em >= :startDate)
       AND (:endDate IS NULL OR i.iniciado_em < DATEADD(day, 1, :endDate))`,
    { processoId, status, identificador, solicitante, startDate, endDate, identificadorLike: identificador ? `%${identificador}%` : null, solicitanteLike: solicitante ? `%${solicitante}%` : null }
  );

  return {
    data: rows,
    total: countRows[0] ? countRows[0].total : 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function getProcessInstanceStats(processoId) {
  const rows = await db.query(
    `SELECT status, COUNT(*) AS total
     FROM instancias_processo
     WHERE processo_id = :processoId
     GROUP BY status`,
    { processoId }
  );

  const summary = {
    total: 0,
    concluidas: 0,
    em_andamento: 0,
    com_erro: 0,
  };

  rows.forEach((row) => {
    const amount = Number(row.total || 0);
    const status = String(row.status || '').toUpperCase();
    summary.total += amount;

    if (status === 'CONCLUIDA') {
      summary.concluidas += amount;
      return;
    }

    if (status === 'ERRO' || status === 'FALHA') {
      summary.com_erro += amount;
      return;
    }

    summary.em_andamento += amount;
  });

  return summary;
}

module.exports = {
  createInstance,
  getInstanceById,
  updateInstancePointer,
  updateRuntimeState,
  finishInstance,
  listInstances,
  getProcessInstanceStats,
};
