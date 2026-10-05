const { InstanciasProcesso, Processos, VersoesProcesso } = require('../../models');
const {
  Op, col, contem, dataDoFiltro, paginar, idInserido,
} = require('../../database/consultas');

async function createInstance({ processoId, versaoId, solicitante, identificador = null, descIden = null, payloadJson, status = 'EM_ANDAMENTO', currentElementId = null }) {
  const agora = new Date();
  const registro = await InstanciasProcesso.create({
    processo_id: processoId,
    versao_processo_id: versaoId,
    solicitante,
    identificador,
    desc_iden: descIden,
    dados_json: payloadJson,
    estado_execucao_json: '{}',
    status,
    elemento_atual_id: currentElementId,
    iniciado_em: agora,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });
  return idInserido(registro);
}

async function getInstanceById(instanceId) {
  return InstanciasProcesso.findOne({
    attributes: [
      'id', 'processo_id', 'versao_processo_id', 'solicitante', 'identificador', 'desc_iden',
      ['dados_json', 'payload_json'], ['estado_execucao_json', 'runtime_state_json'],
      ['elemento_atual_id', 'current_element_id'], 'status',
      ['iniciado_em', 'started_at'], ['encerrado_em', 'ended_at'],
      ['criado_por', 'created_by'], ['atualizado_por', 'updated_by'],
      ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
    ],
    where: { id: instanceId },
    raw: true,
  });
}

async function updateInstancePointer(instanceId, currentElementId) {
  await InstanciasProcesso.update(
    { elemento_atual_id: currentElementId, dt_atualizacao: new Date() },
    { where: { id: instanceId } }
  );
}

async function updateRuntimeState(instanceId, runtimeStateJson) {
  await InstanciasProcesso.update(
    { estado_execucao_json: runtimeStateJson, dt_atualizacao: new Date() },
    { where: { id: instanceId } }
  );
}

async function finishInstance(instanceId, finalStatus = 'CONCLUIDA') {
  const agora = new Date();
  await InstanciasProcesso.update(
    { status: finalStatus, encerrado_em: agora, dt_atualizacao: agora },
    { where: { id: instanceId } }
  );
}

function filtroInstancias({ processoId, status, identificador, solicitante, startDate, endDate }) {
  const condicoes = [];
  if (processoId !== null && processoId !== undefined) condicoes.push({ processo_id: processoId });
  if (status !== null && status !== undefined) condicoes.push({ status });
  if (identificador) condicoes.push(contem('InstanciasProcesso.identificador', identificador));
  if (solicitante) condicoes.push(contem('InstanciasProcesso.solicitante', solicitante));
  if (startDate) condicoes.push({ iniciado_em: { [Op.gte]: dataDoFiltro(startDate) } });
  if (endDate) condicoes.push({ iniciado_em: { [Op.lt]: dataDoFiltro(endDate, 1) } });
  return { [Op.and]: condicoes };
}

async function listInstances({ page = 1, pageSize = 10, processoId = null, status = null, identificador = null, solicitante = null, startDate = null, endDate = null }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const filtro = filtroInstancias({ processoId, status, identificador, solicitante, startDate, endDate });

  const rows = await InstanciasProcesso.findAll({
    attributes: [
      'id', 'processo_id', 'versao_processo_id', 'solicitante', 'identificador',
      ['desc_iden', 'instance_desc_iden'],
      ['dados_json', 'payload_json'], ['estado_execucao_json', 'runtime_state_json'],
      ['elemento_atual_id', 'current_element_id'], 'status', ['iniciado_em', 'started_at'],
      ['encerrado_em', 'ended_at'], ['dt_criacao', 'created_at'],
      [col('processo.nome'), 'processo_nome'],
      [col('processo.desc_iden'), 'processo_desc_iden'],
      [col('versao.versao'), 'versao'],
    ],
    include: [
      { model: Processos, as: 'processo', attributes: [], required: true },
      { model: VersoesProcesso, as: 'versao', attributes: [], required: true },
    ],
    where: filtro,
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    ...paginar(safePage, safePageSize),
    raw: true,
  });

  const total = await InstanciasProcesso.count({ where: filtro });

  return {
    data: rows,
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function getProcessInstanceStats(processoId) {
  const rows = await InstanciasProcesso.findAll({
    attributes: ['status'],
    where: { processo_id: processoId },
    raw: true,
  });

  const summary = {
    total: 0,
    concluidas: 0,
    em_andamento: 0,
    com_erro: 0,
  };

  rows.forEach((row) => {
    const status = String(row.status || '').toUpperCase();
    summary.total += 1;

    if (status === 'CONCLUIDA') {
      summary.concluidas += 1;
      return;
    }

    if (status === 'ERRO' || status === 'FALHA') {
      summary.com_erro += 1;
      return;
    }

    summary.em_andamento += 1;
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
