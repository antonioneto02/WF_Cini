const {
  Processos, VersoesProcesso, InstanciasProcesso, Formularios, Tarefas, HistoricoFluxo,
} = require('../../models');
const {
  Op, maiusculo, contem, igualSemCaixa, where, paginar, idInserido,
} = require('../../database/consultas');

function filtroProcessos(search, createdBy) {
  const condicoes = [];
  if (search) condicoes.push({ [Op.or]: [contem('Processos.nome', search), contem('Processos.descricao', search)] });
  if (createdBy !== null && createdBy !== undefined) {
    condicoes.push(where(maiusculo('Processos.criado_por'), String(createdBy).trim().toUpperCase()));
  }
  return { [Op.and]: condicoes };
}

async function listProcesses({ page = 1, pageSize = 10, search = '', createdBy = null }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const filtro = filtroProcessos(search, createdBy);

  const processos = await Processos.findAll({
    attributes: ['id', 'nome', 'descricao', 'status', 'usa_identificador', 'tipo_identificador', 'criado_por', 'dt_criacao'],
    where: filtro,
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    ...paginar(safePage, safePageSize),
    raw: true,
  });

  const rows = [];
  for (const p of processos) {
    const versao = await VersoesProcesso.findOne({
      attributes: ['id', 'versao', 'status'],
      where: { processo_id: p.id },
      order: [['versao', 'DESC'], ['id', 'DESC']],
      raw: true,
    });
    const instancia = await InstanciasProcesso.findOne({
      attributes: ['id', 'status', 'elemento_atual_id', 'versao_processo_id', 'iniciado_em'],
      where: { processo_id: p.id },
      order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
      raw: true,
    });
    rows.push({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      status: p.status,
      usa_identificador: p.usa_identificador,
      tipo_identificador: p.tipo_identificador,
      created_by: p.criado_por,
      created_at: p.dt_criacao,
      versao: versao ? versao.versao : null,
      versao_status: versao ? versao.status : null,
      versao_id: versao ? versao.id : null,
      latest_instance_id: instancia ? instancia.id : null,
      latest_instance_status: instancia ? instancia.status : null,
      latest_current_element_id: instancia ? instancia.elemento_atual_id : null,
      latest_instance_version_id: instancia ? instancia.versao_processo_id : null,
      latest_started_at: instancia ? instancia.iniciado_em : null,
      codigo: p.id,
    });
  }

  const total = await Processos.count({ where: filtro });

  return {
    data: rows,
    page: safePage,
    pageSize: safePageSize,
    total,
  };
}

async function createProcess({ nome, descricao, criadoPor, usaIdentificador = false, tipoIdentificador = null, descIden = null }) {
  const agora = new Date();
  const registro = await Processos.create({
    desc_iden: descIden,
    nome,
    descricao,
    status: 'ATIVO',
    usa_identificador: usaIdentificador,
    tipo_identificador: tipoIdentificador,
    criado_por: criadoPor,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });
  return idInserido(registro);
}

async function getProcessById(id) {
  const row = await Processos.findOne({
    attributes: [
      'id', 'nome', 'descricao', 'status', 'usa_identificador', 'tipo_identificador',
      ['criado_por', 'created_by'], ['atualizado_por', 'updated_by'],
      ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'], 'desc_iden',
    ],
    where: { id },
    raw: true,
  });
  return row ? { ...row, codigo: row.id } : null;
}

async function updateProcess({ id, nome, descricao, status, usaIdentificador, tipoIdentificador, updatedBy, descIden = null }) {
  await Processos.update({
    nome,
    descricao,
    status,
    usa_identificador: usaIdentificador,
    tipo_identificador: tipoIdentificador,
    desc_iden: descIden,
    atualizado_por: updatedBy,
    dt_atualizacao: new Date(),
  }, { where: { id } });
}

async function listVersionsByProcess(processoId) {
  return VersoesProcesso.findAll({
    attributes: [
      'id', 'processo_id', 'versao', 'status', 'publicado_em', 'observacao_publicacao',
      ['xml_bpmn', 'bpmn_xml'], 'propriedades_json', ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
    ],
    where: { processo_id: processoId },
    order: [['versao', 'DESC'], ['id', 'DESC']],
    raw: true,
  });
}

async function getVersionById(versionId) {
  return VersoesProcesso.findOne({
    attributes: [
      'id', 'processo_id', 'versao', 'status', ['xml_bpmn', 'bpmn_xml'], 'propriedades_json', 'publicado_em',
      ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
    ],
    where: { id: versionId },
    raw: true,
  });
}

async function getLatestVersionNumber(processoId) {
  const ultima = await VersoesProcesso.max('versao', { where: { processo_id: processoId } });
  return ultima || 0;
}

async function createVersion({ processoId, versao, bpmnXml, propriedadesJson, createdBy }) {
  const agora = new Date();
  const registro = await VersoesProcesso.create({
    processo_id: processoId,
    versao,
    status: 'RASCUNHO',
    xml_bpmn: bpmnXml,
    propriedades_json: propriedadesJson,
    criado_por: createdBy,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });
  return idInserido(registro);
}

async function publishVersion({ processoId, versaoId, observacao, publishedBy }) {
  await VersoesProcesso.update(
    { status: 'ARQUIVADA', dt_atualizacao: new Date() },
    { where: { processo_id: processoId, status: 'PUBLICADA' } }
  );

  const agora = new Date();
  await VersoesProcesso.update({
    status: 'PUBLICADA',
    publicado_em: agora,
    observacao_publicacao: observacao,
    publicado_por: publishedBy,
    dt_atualizacao: agora,
  }, { where: { id: versaoId, processo_id: processoId } });
}

async function getPublishedVersion(processoId) {
  return VersoesProcesso.findOne({
    attributes: ['id', 'processo_id', 'versao', ['xml_bpmn', 'bpmn_xml'], 'propriedades_json'],
    where: { processo_id: processoId, status: 'PUBLICADA' },
    order: [['versao', 'DESC'], ['id', 'DESC']],
    raw: true,
  });
}

const ATRIBUTOS_POR_CODIGO = [
  'id', 'nome', 'descricao', 'status', 'usa_identificador', 'tipo_identificador',
  ['criado_por', 'created_by'], ['dt_criacao', 'created_at'], ['dt_atualizacao', 'updated_at'],
];

async function getProcessByCodigo(codigo) {
  if (/^\d+$/.test(String(codigo))) {
    const row = await Processos.findOne({ attributes: ATRIBUTOS_POR_CODIGO, where: { id: Number(codigo) }, raw: true });
    if (row) return row;
  }

  return Processos.findOne({
    attributes: ATRIBUTOS_POR_CODIGO,
    where: igualSemCaixa('nome', codigo),
    order: [['id', 'ASC']],
    raw: true,
  });
}

async function getProcessDeleteDependencies(processoId) {
  const where = { processo_id: processoId };
  return {
    versions: await VersoesProcesso.count({ where }),
    forms: await Formularios.count({ where }),
    instances: await InstanciasProcesso.count({ where }),
    tasks: await Tarefas.count({ where }),
    history: await HistoricoFluxo.count({ where }),
  };
}

async function deleteProcess(processoId) {
  await Processos.destroy({ where: { id: processoId } });
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
