const db = require('../models/db');

async function createInstance({ processoId, versaoId, solicitante, payloadJson, status = 'EM_ANDAMENTO', currentElementId = null }) {
  const result = await db.query(
    `INSERT INTO instancias_processo
      (processo_id, versao_processo_id, solicitante, dados_json, estado_execucao_json, status, elemento_atual_id, iniciado_em, dt_criacao, dt_atualizacao)
     VALUES
      (:processoId, :versaoId, :solicitante, :payloadJson, '{}', :status, :currentElementId, NOW(), NOW(), NOW())`,
    { processoId, versaoId, solicitante, payloadJson, status, currentElementId }
  );
  return result.insertId;
}

async function getInstanceById(instanceId) {
  const rows = await db.query(
    `SELECT i.id, i.processo_id, i.versao_processo_id, i.solicitante,
            i.dados_json AS payload_json, i.estado_execucao_json AS runtime_state_json,
            i.elemento_atual_id AS current_element_id, i.status,
            i.iniciado_em AS started_at, i.encerrado_em AS ended_at,
            i.criado_por AS created_by, i.atualizado_por AS updated_by,
            i.dt_criacao AS created_at, i.dt_atualizacao AS updated_at
     FROM instancias_processo i
     WHERE id = :instanceId`,
    { instanceId }
  );
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

async function listInstances({ page = 1, pageSize = 10, processoId = null, status = null }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const offset = (safePage - 1) * safePageSize;

  const rows = await db.query(
    `SELECT i.id, i.processo_id, i.versao_processo_id, i.solicitante,
            i.dados_json AS payload_json, i.estado_execucao_json AS runtime_state_json,
            i.elemento_atual_id AS current_element_id, i.status, i.iniciado_em AS started_at,
            i.encerrado_em AS ended_at, i.dt_criacao AS created_at,
            p.nome AS processo_nome, v.versao
     FROM instancias_processo i
     JOIN processos p ON p.id = i.processo_id
     JOIN versoes_processo v ON v.id = i.versao_processo_id
     WHERE (:processoId IS NULL OR i.processo_id = :processoId)
       AND (:status IS NULL OR i.status = :status)
     ORDER BY i.dt_criacao DESC
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    {
      processoId,
      status,
      limit: safePageSize,
      offset,
    }
  );

  const countRows = await db.query(
    `SELECT COUNT(*) AS total
     FROM instancias_processo i
     WHERE (:processoId IS NULL OR i.processo_id = :processoId)
       AND (:status IS NULL OR i.status = :status)`,
    { processoId, status }
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
