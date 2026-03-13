const processRepository = require('../repositories/processRepository');
const formRepository = require('../repositories/formRepository');
const historyRepository = require('../repositories/historyRepository');
const instanceRepository = require('../repositories/instanceRepository');
const { parseXml, buildGraph } = require('./bpmnParserService');
const accessService = require('./accessService');
const processApiCatalogService = require('./processApiCatalogService');
const processApiDefinitionService = require('./processApiDefinitionService');
const automationService = require('./automationService');
const notificationService = require('./notificationService');
const { buildProgressFromVersion } = require('./processProgressService');

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(normalized);
}

function normalizeIdentifierType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === 'TEXTO') return 'TEXTO';
  if (normalized === 'SEQUENCIAL' || normalized === 'NUMERICO' || normalized === 'NUMERO') return 'SEQUENCIAL';
  throw new Error('Tipo de identificador invalido. Use TEXTO ou SEQUENCIAL');
}

function resolveIdentifierConfig(inputConfig, currentProcess) {
  const safeInput = inputConfig && typeof inputConfig === 'object' ? inputConfig : {};
  const hasInput =
    safeInput.enabled !== undefined ||
    safeInput.usaIdentificador !== undefined ||
    safeInput.type !== undefined ||
    safeInput.tipoIdentificador !== undefined;

  const fallbackEnabled = toBoolean(currentProcess && currentProcess.usa_identificador);
  const fallbackType = normalizeIdentifierType(currentProcess && currentProcess.tipo_identificador);

  if (!hasInput) {
    return {
      usaIdentificador: fallbackEnabled,
      tipoIdentificador: fallbackEnabled ? fallbackType : null,
    };
  }

  const enabled = safeInput.enabled !== undefined || safeInput.usaIdentificador !== undefined
    ? toBoolean(safeInput.enabled !== undefined ? safeInput.enabled : safeInput.usaIdentificador)
    : fallbackEnabled;

  if (!enabled) {
    return {
      usaIdentificador: false,
      tipoIdentificador: null,
    };
  }

  const type = safeInput.type !== undefined || safeInput.tipoIdentificador !== undefined
    ? normalizeIdentifierType(safeInput.type !== undefined ? safeInput.type : safeInput.tipoIdentificador)
    : fallbackType;

  if (!type) {
    throw new Error('Selecione o tipo do identificador: TEXTO ou SEQUENCIAL');
  }

  return {
    usaIdentificador: true,
    tipoIdentificador: type,
  };
}

async function listProcesses(query) {
  const safeQuery = query || {};
  const result = await processRepository.listProcesses(safeQuery);

  let data = result.data || [];
  if (safeQuery.user) {
    data = await accessService.filterVisibleProcesses(data, safeQuery.user);
  }

  const enriched = [];
  for (const item of data) {
    let progress = {
      steps: [],
      current_element_id: item.latest_current_element_id || null,
      is_completed: String(item.latest_instance_status || '').toUpperCase() === 'CONCLUIDA',
      summary_text: String(item.latest_instance_status || '').toUpperCase() === 'CONCLUIDA' ? 'Concluido' : 'Fluxo sem execucao ativa',
    };
    const versionId = item.latest_instance_version_id || item.versao_id;
    if (versionId) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const version = await processRepository.getVersionById(versionId);
        if (version && version.bpmn_xml) {
          // eslint-disable-next-line no-await-in-loop
          progress = await buildProgressFromVersion({
            bpmnXml: version.bpmn_xml,
            propriedadesJson: version.propriedades_json,
            currentElementId: item.latest_current_element_id || null,
            instanceStatus: item.latest_instance_status || null,
          });
        }
      } catch (_) {
        progress = {
          steps: [],
          current_element_id: item.latest_current_element_id || null,
          is_completed: String(item.latest_instance_status || '').toUpperCase() === 'CONCLUIDA',
          summary_text: String(item.latest_instance_status || '').toUpperCase() === 'CONCLUIDA' ? 'Concluido' : 'Fluxo sem execucao ativa',
        };
      }
    }

    enriched.push({
      ...item,
      progress,
      can_edit: safeQuery.user ? await accessService.canUser(item.id, safeQuery.user, 'edit') : true,
      can_model: safeQuery.user ? await accessService.canUser(item.id, safeQuery.user, 'model') : true,
      can_admin: safeQuery.user ? await accessService.canUser(item.id, safeQuery.user, 'admin') : true,
      can_execute: safeQuery.user ? await accessService.canUser(item.id, safeQuery.user, 'execute') : true,
    });
  }

  return {
    ...result,
    data: enriched,
    total: safeQuery.user ? enriched.length : result.total,
  };
}

async function createProcess({ nome, codigo, descricao, permissions, identifierConfig, createdBy }) {
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

  const resolvedIdentifierConfig = resolveIdentifierConfig(identifierConfig, null);
  const descIden = identifierConfig && typeof identifierConfig === 'object' ? String(identifierConfig.fieldName || '').trim() : null;

  const processId = await processRepository.createProcess({
    nome,
    codigo: finalCodigo,
    descricao: descricao || null,
    usaIdentificador: resolvedIdentifierConfig.usaIdentificador,
    tipoIdentificador: resolvedIdentifierConfig.tipoIdentificador,
    descIden: descIden || null,
    criadoPor: createdBy || null,
  });

  const assignedPermissions = await accessService.setProcessPermissions({
    processoId: processId,
    config: permissions || {},
    actor: createdBy || null,
  });

  await processApiCatalogService.ensureProcessApiConfig(processId, createdBy || null);

  const createdProcess = await processRepository.getProcessById(processId);

  await notificationService.notifyProcessUserAssignments({
    processId,
    processName: createdProcess ? createdProcess.nome : nome,
    processCode: createdProcess ? createdProcess.codigo : finalCodigo,
    actor: createdBy || null,
    currentPermissions: assignedPermissions,
    previousPermissions: [],
  });

  return createdProcess;
}

async function getProcessDetails(processoId) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const versions = await processRepository.listVersionsByProcess(processoId);
  const forms = await formRepository.listForms({ processId: processoId, page: 1, pageSize: 100 });
  const instances = await instanceRepository.listInstances({ processoId, page: 1, pageSize: 1 });
  const latestInstance = instances && Array.isArray(instances.data) && instances.data.length
    ? instances.data[0]
    : null;
  const acl = await accessService.getAcl(processoId);
  const apiConfig = await processApiCatalogService.ensureProcessApiConfig(processoId, process.created_by || 'sistema');

  // derive a human-friendly identifier label (descIden) from process row or version properties
  let identifierLabel = null;
  try {
    if (process && process.desc_iden) {
      identifierLabel = String(process.desc_iden || '').trim() || null;
    }

    if (!identifierLabel) {
      // prefer published version properties, else fallback to first available version
      let preferredVersion = null;
      try {
        preferredVersion = await processRepository.getPublishedVersion(processoId);
      } catch (_) {
        preferredVersion = null;
      }
      if (!preferredVersion && Array.isArray(versions) && versions.length) preferredVersion = versions[0];

      if (preferredVersion && preferredVersion.propriedades_json) {
        try {
          const props = typeof preferredVersion.propriedades_json === 'object'
            ? preferredVersion.propriedades_json
            : JSON.parse(preferredVersion.propriedades_json || '{}');

          function findLabel(obj) {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of Object.keys(obj)) {
              const val = obj[key];
              if (typeof key === 'string' && /fieldName|fieldname|identifierFieldName|desc_iden|descIden|label|identificador.*nome|nome_identificador|identificadorLabel/i.test(key) && typeof val === 'string' && val.trim()) {
                return val.trim();
              }
              if (typeof val === 'object') {
                const found = findLabel(val);
                if (found) return found;
              }
            }
            return null;
          }

          identifierLabel = findLabel(props) || identifierLabel;
        } catch (_) {
          // ignore parsing errors
        }
      }
    }
  } catch (_) {
    identifierLabel = null;
  }

  return {
    process,
    versions,
    forms: forms.data,
    hasStarted: Number(instances.total || 0) > 0,
    latestInstance,
    totalInstances: Number(instances.total || 0),
    acl,
    apiConfig,
    identifierLabel,
  };
}

async function updateProcess({ processoId, nome, descricao, status, permissions, identifierConfig, updatedBy }) {
  const current = await processRepository.getProcessById(processoId);
  if (!current) throw new Error('Processo nao encontrado');
  if (!nome || !nome.trim()) throw new Error('Nome do processo e obrigatorio');

  const resolvedIdentifierConfig = resolveIdentifierConfig(identifierConfig, current);
  const descIden = identifierConfig && typeof identifierConfig === 'object' ? String(identifierConfig.fieldName || '').trim() : null;

  await processRepository.updateProcess({
    id: processoId,
    nome: nome.trim(),
    descricao: descricao ? descricao.trim() : null,
    status: status || current.status || 'ATIVO',
    usaIdentificador: resolvedIdentifierConfig.usaIdentificador,
    tipoIdentificador: resolvedIdentifierConfig.tipoIdentificador,
    updatedBy: updatedBy || null,
    descIden: descIden || null,
  });

  if (permissions) {
    const previousPermissions = await accessService.getAcl(processoId);
    const assignedPermissions = await accessService.setProcessPermissions({
      processoId,
      config: permissions,
      actor: updatedBy || null,
    });

    await notificationService.notifyProcessUserAssignments({
      processId: processoId,
      processName: nome.trim(),
      processCode: current.codigo,
      actor: updatedBy || null,
      currentPermissions: assignedPermissions,
      previousPermissions,
    });
  }

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

async function getProcessInstancesLine({ processoId, page = 1, pageSize = 100, status = null, identificador = null, solicitante = null, startDate = null, endDate = null }) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const instances = await instanceRepository.listInstances({
    processoId,
    page,
    pageSize,
    status,
    identificador,
    solicitante,
    startDate,
    endDate,
  });

  const stats = await instanceRepository.getProcessInstanceStats(processoId);

  const versionsCache = new Map();
  const enrichedInstances = [];

  for (const instance of instances.data || []) {
    const versionId = Number(instance.versao_processo_id || 0) || null;

    if (versionId && !versionsCache.has(versionId)) {
      // eslint-disable-next-line no-await-in-loop
      const version = await processRepository.getVersionById(versionId);
      versionsCache.set(versionId, version || null);
    }

    const version = versionId ? versionsCache.get(versionId) : null;

    let progress = {
      steps: [],
      current_element_id: instance.current_element_id || null,
      is_completed: String(instance.status || '').toUpperCase() === 'CONCLUIDA',
      summary_text: String(instance.status || '').toUpperCase() === 'CONCLUIDA' ? 'Concluido' : 'Fluxo sem mapeamento',
    };

    if (version && version.bpmn_xml) {
      try {
        // eslint-disable-next-line no-await-in-loop
        progress = await buildProgressFromVersion({
          bpmnXml: version.bpmn_xml,
          propriedadesJson: version.propriedades_json,
          currentElementId: instance.current_element_id || null,
          instanceStatus: instance.status || null,
        });
      } catch (_) {
        progress = {
          steps: [],
          current_element_id: instance.current_element_id || null,
          is_completed: String(instance.status || '').toUpperCase() === 'CONCLUIDA',
          summary_text: String(instance.status || '').toUpperCase() === 'CONCLUIDA' ? 'Concluido' : 'Fluxo sem mapeamento',
        };
      }
    }

    enrichedInstances.push({
      ...instance,
      progress,
    });
  }

  const total = Number(stats.total || 0);
  const concluidas = Number(stats.concluidas || 0);

  return {
    process,
    summary: {
      ...stats,
      taxa_sucesso: total > 0 ? Math.round((concluidas / total) * 100) : 0,
    },
    result: {
      ...instances,
      data: enrichedInstances,
    },
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
  const automations = await automationService.listAutomations({ page: 1, pageSize: 200, onlyActive: true });

  return {
    process,
    version,
    forms: forms.data,
    automations: automations.data,
  };
}

function validateBpmnForPublication(xml, propriedadesJson) {
  if (!xml || !xml.trim()) {
    throw new Error('BPMN XML nao pode ficar vazio');
  }

  function normalizeDecisionOutcome(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return null;
    if (normalized === 'SIM' || normalized === 'YES' || normalized === 'TRUE') return 'SIM';
    if (normalized === 'NAO' || normalized === 'NO' || normalized === 'FALSE') return 'NAO';
    return null;
  }

  function readElementProperty(graph, elementId, key, fallback = null) {
    const props = graph.properties && graph.properties.elements ? graph.properties.elements[elementId] : null;
    if (!props || typeof props !== 'object') return fallback;
    if (props[key] === undefined || props[key] === null || props[key] === '') return fallback;
    return props[key];
  }

  function readFlowProperty(graph, flowId, key, fallback = null) {
    const props = graph.properties && graph.properties.flows ? graph.properties.flows[flowId] : null;
    if (!props || typeof props !== 'object') return fallback;
    if (props[key] === undefined || props[key] === null || props[key] === '') return fallback;
    return props[key];
  }

  function formatElementName(element) {
    const name = String((element && element.name) || '').trim();
    const id = String((element && element.id) || '').trim();
    return name ? `${name} (${id})` : id;
  }

  return parseXml(xml).then((definitions) => {
    const graph = buildGraph(definitions, propriedadesJson);
    const errors = [];

    if (!graph.startEvents.length) {
      errors.push('Processo BPMN deve conter ao menos um StartEvent.');
    }

    const hasEndEvent = Object.values(graph.elementMap).some((el) => el.$type === 'bpmn:EndEvent');
    if (!hasEndEvent) {
      errors.push('Processo BPMN deve conter ao menos um EndEvent.');
    }

    Object.values(graph.sequenceFlowMap || {}).forEach((flow) => {
      const sourceId = flow && flow.sourceRef ? flow.sourceRef.id : null;
      const targetId = flow && flow.targetRef ? flow.targetRef.id : null;
      if (!sourceId || !targetId) {
        errors.push(`Fluxo ${flow.id} esta sem origem ou destino.`);
      }
    });

    Object.values(graph.elementMap || {}).forEach((element) => {
      if (!element || element.$type === 'bpmn:SequenceFlow') return;

      const incoming = graph.incomingByElement[element.id] || [];
      const outgoing = graph.outgoingByElement[element.id] || [];
      const elementName = formatElementName(element);

      if (element.$type !== 'bpmn:StartEvent' && !incoming.length) {
        errors.push(`Elemento ${elementName} esta sem fluxo de entrada.`);
      }

      if (element.$type !== 'bpmn:EndEvent' && !outgoing.length) {
        errors.push(`Elemento ${elementName} esta sem fluxo de saida.`);
      }

      if (element.$type === 'bpmn:UserTask') {
        const taskType = String(readElementProperty(graph, element.id, 'taskType', 'USER') || 'USER').toUpperCase();
        if (taskType === 'MANAGER') {
          const managers = readElementProperty(graph, element.id, 'managerUsers', []);
          if (!Array.isArray(managers) || !managers.length) {
            errors.push(`Atividade ${elementName} com tipo MANAGER exige ao menos um gestor aprovador.`);
          }
        }
      }

      if (element.$type === 'bpmn:ServiceTask') {
        const taskType = String(readElementProperty(graph, element.id, 'taskType', 'SERVICE') || 'SERVICE').toUpperCase();
        if (taskType === 'AUTOMATION') {
          const endpoint = String(readElementProperty(graph, element.id, 'automationEndpoint', '') || '').trim();
          const automationId = Number(readElementProperty(graph, element.id, 'automationId', 0)) || 0;
          if (!endpoint && !automationId) {
            errors.push(`Atividade ${elementName} do tipo AUTOMATION exige endpoint ou automacao cadastrada.`);
          }
        }

        if (taskType === 'DB') {
          const query = String(readElementProperty(graph, element.id, 'dbQuery', '') || '').trim().toUpperCase();
          if (!query) {
            errors.push(`Atividade ${elementName} do tipo DB exige consulta SQL.`);
          } else if (!(query.startsWith('SELECT') || query.startsWith('EXEC'))) {
            errors.push(`Atividade ${elementName} do tipo DB aceita apenas comandos SELECT ou EXEC.`);
          }
        }
      }

      if (element.$type === 'bpmn:ExclusiveGateway') {
        if (outgoing.length > 1) {
          const defaultFlowId = readElementProperty(graph, element.id, 'defaultFlow', null)
            || (element.default && element.default.id)
            || null;

          if (defaultFlowId && !outgoing.includes(defaultFlowId)) {
            errors.push(`Gateway ${elementName} possui fluxo padrao invalido.`);
          }

          const nonDefaultFlowIds = outgoing.filter((flowId) => flowId !== defaultFlowId);
          const outcomes = new Set();
          let hasConditionOrOutcome = false;

          nonDefaultFlowIds.forEach((flowId) => {
            const flow = graph.sequenceFlowMap[flowId];
            if (!flow) return;

            const condition = String(readFlowProperty(graph, flowId, 'condition', '') || '').trim();
            const outcome = normalizeDecisionOutcome(readFlowProperty(graph, flowId, 'decisionOutcome', null));

            if (condition || outcome) {
              hasConditionOrOutcome = true;
            }

            if (outcome) {
              if (outcomes.has(outcome)) {
                errors.push(`Gateway ${elementName} possui saidas duplicadas para a decisao ${outcome}.`);
              }
              outcomes.add(outcome);
            }
          });

          if (!hasConditionOrOutcome && !defaultFlowId) {
            errors.push(`Gateway ${elementName} e ambiguo. Defina condicoes, mapeamento SIM/NAO ou fluxo padrao.`);
          }

          if (outcomes.size === 1 && nonDefaultFlowIds.length > 1) {
            errors.push(`Gateway ${elementName} possui apenas um resultado de decisao mapeado. Configure SIM e NAO.`);
          }

          if (outcomes.size > 0) {
            const question = String(readElementProperty(graph, element.id, 'decisionQuestion', '') || '').trim();
            const answerField = String(readElementProperty(graph, element.id, 'decisionAnswerField', '') || '').trim();
            if (!question) {
              errors.push(`Gateway ${elementName} com decisao SIM/NAO precisa de pergunta de decisao.`);
            }
            if (!answerField) {
              errors.push(`Gateway ${elementName} com decisao SIM/NAO precisa de campo de resposta.`);
            }
          }
        }
      }
    });

    if (errors.length) {
      throw new Error(`Validacao BPM falhou:\n- ${errors.join('\n- ')}`);
    }

    return true;
  });
}

async function saveVersion({ processoId, bpmnXml, propriedadesJson, createdBy, originHost }) {
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
  const normalizedOriginHost = processApiDefinitionService.normalizeOriginHost(originHost);
  props.meta.processoId = processoId;
  props.meta.processoCodigo = process ? process.codigo : null;
  props.meta.apiHostOrigin = normalizedOriginHost;
  props.meta.generatedApis = processApiDefinitionService.buildServiceTaskApiDefinitions({
    properties: props,
    processCode: process ? process.codigo : null,
    originHost: normalizedOriginHost,
    processId: processoId,
  });

  const current = await processRepository.getLatestVersionNumber(processoId);
  const nextVersion = Number(current) + 1;

  const versionId = await processRepository.createVersion({
    processoId,
    versao: nextVersion,
    bpmnXml,
    propriedadesJson: JSON.stringify(props),
    createdBy,
  });

  await processRepository.publishVersion({
    processoId,
    versaoId: versionId,
    observacao: 'Publicacao automatica ao salvar versao',
    publishedBy: createdBy || null,
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
  getProcessInstancesLine,
  getModelerPayload,
  saveVersion,
  publishVersion,
  getPublishedVersion,
};
