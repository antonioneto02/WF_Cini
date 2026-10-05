const { Tarefas, Processos, InstanciasProcesso } = require('../../models');
const {
  Op, fn, col, where, minusculo, contem, dataDoFiltro, paginar, idInserido,
} = require('../../database/consultas');

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentifierList(list) {
  const source = Array.isArray(list) ? list : [];
  const normalized = source
    .map((item) => normalizeIdentifier(item))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function responsavelExibido(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim().toLowerCase() === 'any' ? '' : valor;
}

function comResponsavelExibido(row) {
  return row ? { ...row, responsavel: responsavelExibido(row.responsavel) } : row;
}

const juncoes = [
  { model: Processos, as: 'processo', attributes: [], required: true },
  { model: InstanciasProcesso, as: 'instancia', attributes: [], required: true },
];

const descricaoIdentificador = [fn('COALESCE', col('processo.desc_iden'), col('instancia.desc_iden')), 'processo_desc_iden'];

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
  criadoPor = null,
}) {
  const agora = new Date();
  const registro = await Tarefas.create({
    instancia_processo_id: instanciaId,
    processo_id: processoId,
    versao_processo_id: versaoProcessoId,
    elemento_id: elementId,
    nome_etapa: nomeEtapa,
    responsavel: normalizeIdentifier(responsavel) || null,
    sla_horas: slaHoras,
    configuracao_formulario_json: formConfigJson,
    status,
    criado_por: criadoPor ? String(criadoPor).trim().toLowerCase() : null,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return idInserido(registro);
}

async function getTaskById(taskId) {
  const row = await Tarefas.findOne({
    attributes: [
      'id', 'instancia_processo_id', 'processo_id', 'versao_processo_id',
      ['elemento_id', 'element_id'], 'nome_etapa', 'responsavel', 'sla_horas',
      ['configuracao_formulario_json', 'form_config_json'], 'resposta_json',
      'acao_final', 'observacao_final', 'status', ['iniciado_em', 'started_at'],
      ['concluido_em', 'completed_at'], ['concluido_por', 'completed_by'], ['dt_criacao', 'created_at'],
      [col('processo.nome'), 'processo_nome'],
      [col('instancia.solicitante'), 'solicitante'],
      [col('instancia.identificador'), 'identificador'],
      [col('instancia.dados_json'), 'payload_json'],
      descricaoIdentificador,
    ],
    include: juncoes,
    where: { id: taskId },
    raw: true,
  });

  return comResponsavelExibido(row);
}

function filtroKanban({
  status, processoId, processName, instanciaId, identificador, startDate, endDate, responsavel, userKeys, search,
}) {
  const condicoes = [];
  if (status !== null && status !== undefined) condicoes.push({ status });
  if (processoId !== null && processoId !== undefined) condicoes.push({ processo_id: processoId });
  if (processName) condicoes.push(contem('processo.nome', processName));
  if (instanciaId) condicoes.push({ instancia_processo_id: instanciaId });
  if (identificador) condicoes.push(contem('instancia.identificador', identificador));
  if (startDate) condicoes.push({ dt_criacao: { [Op.gte]: dataDoFiltro(startDate) } });
  if (endDate) condicoes.push({ dt_criacao: { [Op.lt]: dataDoFiltro(endDate, 1) } });
  if (responsavel) condicoes.push(where(minusculo('Tarefas.responsavel'), responsavel));
  if (userKeys.length) condicoes.push(where(minusculo('Tarefas.responsavel'), { [Op.in]: ['', 'any', ...userKeys] }));
  if (search) {
    condicoes.push({
      [Op.or]: [
        contem('Tarefas.nome_etapa', search),
        contem('processo.nome', search),
        contem('instancia.solicitante', search),
      ],
    });
  }
  return { [Op.and]: condicoes };
}

async function listKanbanTasks({
  user,
  userKeys,
  status,
  processoId,
  processName = null,
  instanciaId = null,
  identificador = null,
  startDate = null,
  endDate = null,
  responsavel,
  search,
  page = 1,
  pageSize = 12,
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 12);
  const filtro = filtroKanban({
    status,
    processoId,
    processName: processName && String(processName).trim() ? String(processName).trim() : null,
    instanciaId: instanciaId ? Number(instanciaId) : null,
    identificador: identificador && String(identificador).trim() ? String(identificador).trim() : null,
    startDate: startDate && String(startDate).trim() ? String(startDate).trim() : null,
    endDate: endDate && String(endDate).trim() ? String(endDate).trim() : null,
    responsavel: normalizeIdentifier(responsavel) || null,
    userKeys: normalizeIdentifierList((userKeys && userKeys.length ? userKeys : [user]) || []),
    search: search || '',
  });

  const rows = await Tarefas.findAll({
    attributes: [
      'id', 'nome_etapa', 'status', 'responsavel', 'sla_horas',
      ['elemento_id', 'element_id'], 'versao_processo_id',
      ['dt_criacao', 'created_at'], ['iniciado_em', 'started_at'], ['concluido_em', 'completed_at'], 'instancia_processo_id',
      [col('processo.nome'), 'processo_nome'],
      [col('instancia.solicitante'), 'solicitante'],
      [col('instancia.identificador'), 'identificador'],
      descricaoIdentificador,
    ],
    include: juncoes,
    where: filtro,
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    ...paginar(safePage, safePageSize),
    raw: true,
  });

  const total = await Tarefas.count({ include: juncoes, where: filtro });

  return {
    data: rows.map(comResponsavelExibido),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function updateTaskStatus(taskId, status) {
  const tarefa = await Tarefas.findOne({ attributes: ['iniciado_em', 'concluido_em'], where: { id: taskId }, raw: true });
  if (!tarefa) return;
  const agora = new Date();
  await Tarefas.update({
    status,
    iniciado_em: status === 'EM_ANDAMENTO' && !tarefa.iniciado_em ? agora : tarefa.iniciado_em,
    concluido_em: status === 'CONCLUIDA' ? agora : tarefa.concluido_em,
    dt_atualizacao: agora,
  }, { where: { id: taskId } });
}

async function completeTask({ taskId, action, observacao, responseJson, user }) {
  const tarefa = await Tarefas.findOne({ attributes: ['iniciado_em'], where: { id: taskId }, raw: true });
  if (!tarefa) return;
  const agora = new Date();
  await Tarefas.update({
    status: 'CONCLUIDA',
    acao_final: action,
    observacao_final: observacao,
    resposta_json: responseJson,
    concluido_por: user,
    concluido_em: agora,
    iniciado_em: tarefa.iniciado_em || agora,
    atualizado_por: user,
    dt_atualizacao: agora,
  }, { where: { id: taskId } });
}

async function saveTaskDraft({ taskId, observacao, responseJson, user }) {
  const tarefa = await Tarefas.findOne({ attributes: ['status', 'iniciado_em'], where: { id: taskId }, raw: true });
  if (!tarefa) return;
  const agora = new Date();
  await Tarefas.update({
    status: tarefa.status === 'MINHAS_TAREFAS' ? 'EM_ANDAMENTO' : tarefa.status,
    observacao_final: observacao,
    resposta_json: responseJson,
    iniciado_em: tarefa.iniciado_em || agora,
    atualizado_por: user,
    dt_atualizacao: agora,
  }, { where: { id: taskId } });
}

async function findOpenTasksByInstance(instanciaId) {
  return Tarefas.findAll({
    where: { instancia_processo_id: instanciaId, status: { [Op.in]: ['MINHAS_TAREFAS', 'EM_ANDAMENTO'] } },
    order: [['id', 'ASC']],
    raw: true,
  });
}

async function listTasksByInstance(instanciaId) {
  const rows = await Tarefas.findAll({
    attributes: [
      'id', ['elemento_id', 'element_id'], 'nome_etapa', 'responsavel', 'sla_horas',
      'status', 'acao_final', 'observacao_final',
      ['iniciado_em', 'started_at'], ['concluido_em', 'completed_at'],
      ['concluido_por', 'completed_by'], ['dt_criacao', 'created_at'],
    ],
    where: { instancia_processo_id: instanciaId },
    order: [['dt_criacao', 'ASC'], ['id', 'ASC']],
    raw: true,
  });
  return rows.map(comResponsavelExibido);
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
