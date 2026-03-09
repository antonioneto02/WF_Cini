const db = require('../models/db');

async function addHistory({
  instanciaId,
  processoId,
  versaoProcessoId,
  origemElementId,
  destinoElementId,
  tipoEvento,
  descricao,
  executor,
  payloadJson,
}) {
  const result = await db.query(
    `INSERT INTO historico_fluxo
      (instancia_processo_id, processo_id, versao_processo_id,
       elemento_origem_id, elemento_destino_id, tipo_evento,
       descricao, executor, dados_json, dt_criacao, dt_atualizacao)
     VALUES
      (:instanciaId, :processoId, :versaoProcessoId,
       :origemElementId, :destinoElementId, :tipoEvento,
       :descricao, :executor, :payloadJson, NOW(), NOW())`,
    {
      instanciaId,
      processoId,
      versaoProcessoId,
      origemElementId,
      destinoElementId,
      tipoEvento,
      descricao,
      executor,
      payloadJson,
    }
  );

  return result.insertId;
}

async function listHistoryByInstance(instanciaId) {
  return db.query(
    `SELECT id, elemento_origem_id AS origem_element_id, elemento_destino_id AS destino_element_id,
            tipo_evento, descricao, executor, dados_json AS payload_json, dt_criacao AS created_at
     FROM historico_fluxo
     WHERE instancia_processo_id = :instanciaId
     ORDER BY dt_criacao ASC`,
    { instanciaId }
  );
}

async function listHistoryByProcess(processoId, limit = 400) {
  const safeLimit = Math.max(1, Number(limit) || 400);
  return db.query(
    `SELECT TOP (:limit)
            h.id,
            h.instancia_processo_id,
            h.elemento_origem_id AS origem_element_id,
            h.elemento_destino_id AS destino_element_id,
            h.tipo_evento,
            h.descricao,
            h.executor,
            h.dados_json AS payload_json,
            h.dt_criacao AS created_at,
            i.solicitante
     FROM historico_fluxo h
     JOIN instancias_processo i ON i.id = h.instancia_processo_id
     WHERE h.processo_id = :processoId
     ORDER BY h.dt_criacao DESC`,
    { processoId, limit: safeLimit }
  );
}

module.exports = {
  addHistory,
  listHistoryByInstance,
  listHistoryByProcess,
};
