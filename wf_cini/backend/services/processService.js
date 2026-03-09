const processRepository = require('../repositories/processRepository');
const formRepository = require('../repositories/formRepository');
const historyRepository = require('../repositories/historyRepository');
const instanceRepository = require('../repositories/instanceRepository');
const { parseXml, buildGraph } = require('./bpmnParserService');

async function listProcesses(query) {
  return processRepository.listProcesses(query || {});
}

async function createProcess({ nome, codigo, descricao, createdBy }) {
  if (!nome) {
    throw new Error('Nome do processo e obrigatorio');
  }

  // generate codigo automatically if not provided
  let finalCodigo = codigo && String(codigo).trim() ? String(codigo).trim() : null;

  // normalize helper for slug-like codigo
  function slugify(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  if (!finalCodigo) {
    const base = slugify(nome) || `processo-${Date.now()}`;
    let attempt = 0;
    let candidate = base;
    while (true) {
      const exists = await processRepository.getProcessByCodigo(candidate);
      if (!exists) {
        finalCodigo = candidate;
        break;
      }
      attempt += 1;
      candidate = `${base}-${attempt}`;
      if (attempt > 100) {
        finalCodigo = `${base}-${Date.now()}`;
        break;
      }
    }
  } else {
    // if provided, ensure uniqueness
    const exists = await processRepository.getProcessByCodigo(finalCodigo);
    if (exists) throw new Error('Codigo ja existe para outro processo');
  }

  const processId = await processRepository.createProcess({
    nome,
    codigo: finalCodigo,
    descricao: descricao || null,
    criadoPor: createdBy || null,
  });

  return processRepository.getProcessById(processId);
}

async function getProcessDetails(processoId) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const versions = await processRepository.listVersionsByProcess(processoId);
  const forms = await formRepository.listForms({ processId: processoId, page: 1, pageSize: 100 });

  return {
    process,
    versions,
    forms: forms.data,
  };
}

async function updateProcess({ processoId, nome, descricao, status, updatedBy }) {
  const current = await processRepository.getProcessById(processoId);
  if (!current) throw new Error('Processo nao encontrado');
  if (!nome || !nome.trim()) throw new Error('Nome do processo e obrigatorio');

  await processRepository.updateProcess({
    id: processoId,
    nome: nome.trim(),
    descricao: descricao ? descricao.trim() : null,
    status: status || current.status || 'ATIVO',
    updatedBy: updatedBy || null,
  });

  return processRepository.getProcessById(processoId);
}

async function deleteProcess({ processoId }) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const deps = await processRepository.getProcessDeleteDependencies(processoId);
  const blocked = [];
  if (deps.versions > 0) blocked.push(`${deps.versions} versao(oes)`);
  if (deps.forms > 0) blocked.push(`${deps.forms} formulario(s)`);
  if (deps.instances > 0) blocked.push(`${deps.instances} instancia(s)`);
  if (deps.tasks > 0) blocked.push(`${deps.tasks} tarefa(s)`);
  if (deps.history > 0) blocked.push(`${deps.history} historico(s)`);

  if (blocked.length) {
    throw new Error(`Nao foi possivel excluir. O processo possui vinculos: ${blocked.join(', ')}.`);
  }

  await processRepository.deleteProcess(processoId);
  return { success: true };
}

async function getProcessHistory(processoId) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const instances = await instanceRepository.listInstances({
    processoId,
    page: 1,
    pageSize: 100,
  });

  const history = await historyRepository.listHistoryByProcess(processoId, 400);

  return {
    process,
    instances: instances.data,
    history,
  };
}

async function getModelerPayload(processoId, versaoId = null) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  let version = null;

  if (versaoId) {
    version = await processRepository.getVersionById(versaoId);
  } else {
    const versions = await processRepository.listVersionsByProcess(processoId);
    version = versions[0] || null;
  }

  const forms = await formRepository.listForms({ processId: processoId, page: 1, pageSize: 100 });

  return {
    process,
    version,
    forms: forms.data,
  };
}

function validateBpmnForPublication(xml, propriedadesJson) {
  if (!xml || !xml.trim()) {
    throw new Error('BPMN XML nao pode ficar vazio');
  }

  return parseXml(xml).then((definitions) => {
    const graph = buildGraph(definitions, propriedadesJson);
    if (!graph.startEvents.length) {
      throw new Error('Processo BPMN deve conter ao menos um StartEvent');
    }

    const hasEndEvent = Object.values(graph.elementMap).some((el) => el.$type === 'bpmn:EndEvent');
    if (!hasEndEvent) {
      throw new Error('Processo BPMN deve conter ao menos um EndEvent');
    }

    return true;
  });
}

async function saveVersion({ processoId, bpmnXml, propriedadesJson, createdBy }) {
  if (!bpmnXml || !bpmnXml.trim()) {
    throw new Error('BPMN XML e obrigatorio');
  }

  await validateBpmnForPublication(bpmnXml, propriedadesJson);

  // normalize and enrich propriedadesJson with process identifiers
  let props = {};
  try {
    props = propriedadesJson
      ? typeof propriedadesJson === 'string'
        ? JSON.parse(propriedadesJson)
        : propriedadesJson
      : {};
  } catch (e) {
    props = {};
  }

  props.elements = props.elements || {};
  props.flows = props.flows || {};
  props.meta = props.meta || {};

  const process = await processRepository.getProcessById(processoId);
  props.meta.processoId = processoId;
  props.meta.processoCodigo = process ? process.codigo : null;

  const current = await processRepository.getLatestVersionNumber(processoId);
  const nextVersion = Number(current) + 1;

  const versionId = await processRepository.createVersion({
    processoId,
    versao: nextVersion,
    bpmnXml,
    propriedadesJson: JSON.stringify(props),
    createdBy,
  });

  return processRepository.getVersionById(versionId);
}

async function publishVersion({ processoId, versaoId, observacao, publishedBy }) {
  const version = await processRepository.getVersionById(versaoId);
  if (!version || Number(version.processo_id) !== Number(processoId)) {
    throw new Error('Versao nao encontrada para este processo');
  }

  await validateBpmnForPublication(version.bpmn_xml, version.propriedades_json);

  await processRepository.publishVersion({
    processoId,
    versaoId,
    observacao: observacao || null,
    publishedBy: publishedBy || null,
  });

  return processRepository.getVersionById(versaoId);
}

async function getPublishedVersion(processoId) {
  const version = await processRepository.getPublishedVersion(processoId);
  if (!version) {
    throw new Error('Nao existe versao publicada para este processo');
  }
  return version;
}

module.exports = {
  listProcesses,
  createProcess,
  getProcessDetails,
  updateProcess,
  deleteProcess,
  getProcessHistory,
  getModelerPayload,
  saveVersion,
  publishVersion,
  getPublishedVersion,
};
