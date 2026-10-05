const { HistoricoFluxo, InstanciasProcesso } = require('../../models');
const { col, idInserido } = require('../../database/consultas');

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
  const agora = new Date();
  const registro = await HistoricoFluxo.create({
    instancia_processo_id: instanciaId,
    processo_id: processoId,
    versao_processo_id: versaoProcessoId,
    elemento_origem_id: origemElementId,
    elemento_destino_id: destinoElementId,
    tipo_evento: tipoEvento,
    descricao,
    executor,
    dados_json: payloadJson,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return idInserido(registro);
}

async function listHistoryByInstance(instanciaId) {
  return HistoricoFluxo.findAll({
    attributes: [
      'id', ['elemento_origem_id', 'origem_element_id'], ['elemento_destino_id', 'destino_element_id'],
      'tipo_evento', 'descricao', 'executor', ['dados_json', 'payload_json'], ['dt_criacao', 'created_at'],
    ],
    where: { instancia_processo_id: instanciaId },
    order: [['dt_criacao', 'ASC'], ['id', 'ASC']],
    raw: true,
  });
}

async function listHistoryByProcess(processoId, limit = 400) {
  const safeLimit = Math.max(1, Number(limit) || 400);
  return HistoricoFluxo.findAll({
    attributes: [
      'id',
      'instancia_processo_id',
      ['elemento_origem_id', 'origem_element_id'],
      ['elemento_destino_id', 'destino_element_id'],
      'tipo_evento',
      'descricao',
      'executor',
      ['dados_json', 'payload_json'],
      ['dt_criacao', 'created_at'],
      [col('instancia.solicitante'), 'solicitante'],
    ],
    include: [{ model: InstanciasProcesso, as: 'instancia', attributes: [], required: true }],
    where: { processo_id: processoId },
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    limit: safeLimit,
    raw: true,
  });
}

module.exports = {
  addHistory,
  listHistoryByInstance,
  listHistoryByProcess,
};
