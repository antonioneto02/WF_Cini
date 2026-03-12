const processRepository = require('../repositories/processRepository');
const { parseXml, buildGraph } = require('./bpmnParserService');
const {
  buildFriendlyElementName,
  shouldReplaceWithFriendlyName,
  formatWorkflowStatus,
} = require('../utils/bpmnNaming');

async function getElementIndexByVersionId(versionId, cache) {
  const safeVersionId = Number(versionId || 0);
  if (!safeVersionId) return null;

  if (cache.has(safeVersionId)) {
    return cache.get(safeVersionId);
  }

  try {
    const version = await processRepository.getVersionById(safeVersionId);
    if (!version || !version.bpmn_xml) {
      cache.set(safeVersionId, null);
      return null;
    }

    const definitions = await parseXml(version.bpmn_xml);
    const graph = buildGraph(definitions, version.propriedades_json);
    const index = {};

    Object.values(graph.elementMap || {}).forEach((element) => {
      if (!element || !element.id) return;
      index[element.id] = {
        id: element.id,
        name: element.name || null,
        type: element.$type || null,
      };
    });

    cache.set(safeVersionId, index);
    return index;
  } catch (_) {
    cache.set(safeVersionId, null);
    return null;
  }
}

function resolveElementName(index, elementId) {
  const id = String(elementId || '').trim();
  if (!id) return '-';

  const data = index && index[id] ? index[id] : null;
  return buildFriendlyElementName({
    elementId: id,
    elementName: data ? data.name : null,
    elementType: data ? data.type : null,
  });
}

async function enrichTasksWithFriendlyNames(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return list;

  const cache = new Map();
  const enriched = [];

  for (const task of list) {
    const item = { ...task };
    const index = await getElementIndexByVersionId(item.versao_processo_id, cache);

    if (shouldReplaceWithFriendlyName(item.nome_etapa, item.element_id)) {
      item.nome_etapa = resolveElementName(index, item.element_id);
    }

    item.status_label = formatWorkflowStatus(item.status);
    enriched.push(item);
  }

  return enriched;
}

async function enrichInstancesWithFriendlyNames(instances) {
  const list = Array.isArray(instances) ? instances : [];
  if (!list.length) return list;

  const cache = new Map();
  const enriched = [];

  for (const instance of list) {
    const item = { ...instance };
    const index = await getElementIndexByVersionId(item.versao_processo_id, cache);

    item.atividade_atual_nome = resolveElementName(index, item.current_element_id);
    item.status_label = formatWorkflowStatus(item.status);
    enriched.push(item);
  }

  return enriched;
}

module.exports = {
  enrichTasksWithFriendlyNames,
  enrichInstancesWithFriendlyNames,
  resolveElementName,
};