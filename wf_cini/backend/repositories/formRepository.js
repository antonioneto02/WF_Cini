const {
  Formularios, Processos, RespostasFormulario, Tarefas,
} = require('../../models');
const {
  Op, col, paginar, idInserido,
} = require('../../database/consultas');

const ATRIBUTOS = [
  'id', 'processo_id', 'nome', ['propriedades_json', 'schema_json'],
  'status', ['criado_por', 'created_by'], ['atualizado_por', 'updated_by'],
  ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
];

async function listForms({ processId = null, page = 1, pageSize = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const filtro = processId !== null && processId !== undefined ? { processo_id: processId } : {};

  const rows = await Formularios.findAll({
    attributes: [
      'id', 'processo_id', 'nome', ['propriedades_json', 'schema_json'],
      [col('processo.nome'), 'processo_nome'],
      'status', ['criado_por', 'created_by'], ['atualizado_por', 'updated_by'],
      ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
    ],
    include: [{ model: Processos, as: 'processo', attributes: [], required: false }],
    where: filtro,
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    ...paginar(safePage, safePageSize),
    raw: true,
  });

  const total = await Formularios.count({ where: filtro });

  return {
    data: rows,
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function getFormById(formId) {
  return Formularios.findOne({ attributes: ATRIBUTOS, where: { id: formId }, raw: true });
}

async function createForm({ processoId, nome, schemaJson, xmlBpmn = '', createdBy, status = 'ATIVO' }) {
  const agora = new Date();
  const registro = await Formularios.create({
    processo_id: processoId,
    nome,
    xml_bpmn: xmlBpmn,
    propriedades_json: schemaJson,
    status,
    criado_por: createdBy,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return idInserido(registro);
}

async function updateForm({ formId, processoId, nome, schemaJson, updatedBy, status = 'ATIVO' }) {
  await Formularios.update({
    processo_id: processoId,
    nome,
    propriedades_json: schemaJson,
    status,
    atualizado_por: updatedBy,
    dt_atualizacao: new Date(),
  }, { where: { id: formId } });
}

async function saveResponse({ tarefaId, instanciaId, formularioId, respostaJson, respondidoPor }) {
  const agora = new Date();
  const registro = await RespostasFormulario.create({
    tarefa_id: tarefaId,
    instancia_processo_id: instanciaId,
    formulario_id: formularioId,
    resposta_json: respostaJson,
    respondido_por: respondidoPor,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return idInserido(registro);
}

async function listResponsesByInstance(instanciaId) {
  return RespostasFormulario.findAll({
    attributes: [
      'id', 'tarefa_id', 'instancia_processo_id', 'formulario_id', 'resposta_json',
      'status', 'respondido_por', ['dt_criacao', 'created_at'], [col('formulario.nome'), 'formulario_nome'],
    ],
    include: [{ model: Formularios, as: 'formulario', attributes: [], required: true }],
    where: { instancia_processo_id: instanciaId },
    order: [['dt_criacao', 'ASC'], ['id', 'ASC']],
    raw: true,
  });
}

function formularioDaConfiguracao(texto) {
  try {
    const config = JSON.parse(texto);
    if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
    const valor = config.formId;
    if (typeof valor === 'number' && Number.isInteger(valor)) return valor;
    if (typeof valor === 'string' && /^\s*[+-]?\d+\s*$/.test(valor)) return Number(valor);
    return null;
  } catch (_) {
    return null;
  }
}

async function getFormDeleteDependencies(formId) {
  const responses = await RespostasFormulario.count({ where: { formulario_id: formId } });

  const configuracoes = await Tarefas.findAll({
    attributes: ['configuracao_formulario_json'],
    where: { configuracao_formulario_json: { [Op.like]: '%formId%' } },
    raw: true,
  });
  const alvo = Number(formId);
  const tasks = configuracoes
    .filter((tarefa) => formularioDaConfiguracao(tarefa.configuracao_formulario_json) === alvo)
    .length;

  return {
    responses,
    tasks,
  };
}

async function deleteForm(formId) {
  await Formularios.destroy({ where: { id: formId } });
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
