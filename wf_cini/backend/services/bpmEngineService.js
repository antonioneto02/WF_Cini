const vm = require('vm');

const processRepository = require('../repositories/processRepository');
const instanceRepository = require('../repositories/instanceRepository');
const taskRepository = require('../repositories/taskRepository');
const historyRepository = require('../repositories/historyRepository');
const formRepository = require('../repositories/formRepository');
const db = require('../models/db');
const automationService = require('./automationService');
const notificationService = require('./notificationService');
const {
  parseXml,
  buildGraph,
  getDefaultFlowId,
  getFlowCondition,
  hasTimerDefinition,
  getTimerExpression,
} = require('./bpmnParserService');
const { buildFriendlyElementName } = require('../utils/bpmnNaming');

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

function readElementProperty(graph, elementId, key, fallback = null) {
  const props = graph.properties && graph.properties.elements ? graph.properties.elements[elementId] : null;
  if (!props || typeof props !== 'object') return fallback;
  if (props[key] === undefined || props[key] === null || props[key] === '') return fallback;
  return props[key];
}

function parseDurationToMs(value) {
  if (!value || typeof value !== 'string') return 0;

  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const iso = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i.exec(trimmed);
  if (!iso) {
    const dateMs = Date.parse(trimmed);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
    return 0;
  }

  const hours = Number(iso[1] || 0);
  const minutes = Number(iso[2] || 0);
  const seconds = Number(iso[3] || 0);

  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function evaluateExpression(expression, contextData = {}) {
  if (!expression) return true;

  try {
    const sandbox = {
      ...contextData,
      result: false,
    };
    const script = new vm.Script(`result = Boolean(${expression});`);
    script.runInNewContext(sandbox, { timeout: 50 });
    return Boolean(sandbox.result);
  } catch (_) {
    return false;
  }
}

function normalizeDecisionKeyword(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDecisionAnswer(value) {
  if (typeof value === 'boolean') return value ? 'SIM' : 'NAO';

  if (typeof value === 'number') {
    if (value === 1) return 'SIM';
    if (value === 0) return 'NAO';
  }

  const normalized = normalizeDecisionKeyword(value);
  if (!normalized) return null;

  const yesValues = new Set(['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'APROVAR', 'APROVADO', 'ACEITO', 'OK']);
  if (yesValues.has(normalized)) return 'SIM';

  const noValues = new Set(['NAO', 'N', 'NO', 'FALSE', '0', 'REJEITAR', 'REPROVAR', 'NEGAR', 'NEGADO']);
  if (noValues.has(normalized)) return 'NAO';

  return null;
}

function buildDecisionEvaluationContext(contextData, decisionAnswer) {
  if (!decisionAnswer) return contextData;

  const safeContext = contextData && typeof contextData === 'object' ? contextData : {};
  const response = safeContext.response && typeof safeContext.response === 'object'
    ? { ...safeContext.response }
    : {};

  response.__decisionAnswer = decisionAnswer;
  response.decision = decisionAnswer;
  response.decisao = decisionAnswer;

  return {
    ...safeContext,
    response,
    decision: decisionAnswer,
    decisionAnswer,
    isYes: decisionAnswer === 'SIM',
    isNo: decisionAnswer === 'NAO',
  };
}

function readValueByPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return undefined;

  if (Object.prototype.hasOwnProperty.call(source, normalizedPath)) {
    return source[normalizedPath];
  }

  if (!normalizedPath.includes('.')) {
    return source[normalizedPath];
  }

  return normalizedPath.split('.').reduce((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return acc[key];
  }, source);
}

function resolveDecisionAnswerFromContext(contextData, answerField = '__decisionAnswer') {
  const safeContext = contextData && typeof contextData === 'object' ? contextData : {};
  const candidatePaths = Array.from(
    new Set([
      String(answerField || '').trim(),
      '__decisionAnswer',
      'decisao',
      'decision',
      'decisionAnswer',
      'aprovacao',
      'aprovado',
      'resultado',
    ].filter(Boolean))
  );

  const sources = [
    safeContext.response && typeof safeContext.response === 'object' ? safeContext.response : null,
    safeContext.payload && typeof safeContext.payload === 'object' ? safeContext.payload : null,
  ].filter(Boolean);

  for (const source of sources) {
    for (const path of candidatePaths) {
      const normalized = normalizeDecisionAnswer(readValueByPath(source, path));
      if (normalized) return normalized;
    }
  }

  return normalizeDecisionAnswer(safeContext.action);
}

function getFlowLabel(flow, properties) {
  const saved = properties && properties.flows ? properties.flows[flow.id] || {} : {};
  return String(saved.name || flow.name || '').trim();
}

function inferDecisionOutcomeFromFlow(flow, properties) {
  const saved = properties && properties.flows ? properties.flows[flow.id] || {} : {};
  const explicit = normalizeDecisionAnswer(saved.decisionOutcome);
  if (explicit) return explicit;

  const normalizedLabel = normalizeDecisionKeyword(getFlowLabel(flow, properties));
  if (!normalizedLabel) return null;

  if (/\b(SIM|YES|TRUE|APROV|ACEIT|OK)\b/.test(normalizedLabel)) return 'SIM';
  if (/\b(NAO|NO|FALSE|REPROV|REJEIT|NEG)\b/.test(normalizedLabel)) return 'NAO';
  return null;
}

function selectDecisionFlowByAnswer({ graph, element, answer }) {
  if (!graph || !element || element.$type !== 'bpmn:ExclusiveGateway') return null;

  const outgoingIds = graph.outgoingByElement[element.id] || [];
  if (!outgoingIds.length) return null;

  const outgoingFlows = outgoingIds
    .map((flowId) => graph.sequenceFlowMap[flowId])
    .filter(Boolean);

  const labeled = outgoingFlows.find((flow) => inferDecisionOutcomeFromFlow(flow, graph.properties) === answer);
  if (labeled) return labeled;

  if (outgoingFlows.length === 2) {
    return answer === 'SIM' ? outgoingFlows[0] : outgoingFlows[1];
  }

  const defaultFlowId = getDefaultFlowId(element, graph.properties);
  if (defaultFlowId && graph.sequenceFlowMap[defaultFlowId]) {
    return graph.sequenceFlowMap[defaultFlowId];
  }

  return null;
}

function resolveGatewayDecisionConfig(graph, element, elementDisplayName) {
  const question = String(
    readElementProperty(graph, element.id, 'decisionQuestion', element.name || elementDisplayName || 'Pergunta de decisao') || ''
  ).trim() || 'Pergunta de decisao';

  const answerField = String(readElementProperty(graph, element.id, 'decisionAnswerField', '__decisionAnswer') || '').trim()
    || '__decisionAnswer';

  const sla = Math.max(1, Number(readElementProperty(graph, element.id, 'sla', 24)) || 24);
  const formId = Number(readElementProperty(graph, element.id, 'formId', 0)) || null;
  const responsavel = String(readElementProperty(graph, element.id, 'responsible', '') || '').trim();

  return {
    question,
    answerField,
    sla,
    formId,
    responsavel,
  };
}

function setValueByPath(target, path, value) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return;

  if (!normalizedPath.includes('.')) {
    target[normalizedPath] = value;
    return;
  }

  const parts = normalizedPath.split('.').filter(Boolean);
  if (!parts.length) return;

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function buildAutomationPayloadFromContext(contextData, mappingConfig) {
  const sourceResponse = contextData && contextData.response && typeof contextData.response === 'object'
    ? contextData.response
    : {};
  const sourcePayload = contextData && contextData.payload && typeof contextData.payload === 'object'
    ? contextData.payload
    : {};

  const mappings = Array.isArray(mappingConfig) ? mappingConfig : [];
  if (!mappings.length) {
    return Object.keys(sourceResponse).length ? sourceResponse : sourcePayload;
  }

  const output = {};
  let matched = 0;

  mappings.forEach((entry) => {
    const sourcePath = String((entry && entry.source) || entry || '').trim();
    const targetPath = String((entry && entry.target) || sourcePath).trim();
    if (!sourcePath || !targetPath) return;

    let value = readValueByPath(sourceResponse, sourcePath);
    if (value === undefined) {
      value = readValueByPath(sourcePayload, sourcePath);
    }
    if (value === undefined) return;

    setValueByPath(output, targetPath, value);
    matched += 1;
  });

  if (!matched) {
    return Object.keys(sourceResponse).length ? sourceResponse : sourcePayload;
  }

  return output;
}

function isSafeDbCommand(commandText) {
  const trimmed = String(commandText || '').trim().toUpperCase();
  return trimmed.startsWith('SELECT') || trimmed.startsWith('EXEC');
}

function executeScript(scriptCode, contextData = {}) {
  if (!scriptCode) return;
  const sandbox = {
    ...contextData,
    output: null,
  };
  const script = new vm.Script(scriptCode);
  script.runInNewContext(sandbox, { timeout: 150 });
  return sandbox.output;
}

async function buildExecutionContext(version) {
  const definitions = await parseXml(version.bpmn_xml);
  const graph = buildGraph(definitions, version.propriedades_json);
  return graph;
}

function normalizarPayloadHistorico(value) {
  const keyMap = {
    action: 'acao',
    currentUser: 'usuario_atual',
    response: 'resposta',
    responsible: 'responsavel',
    sla: 'sla_horas',
    timerExpr: 'expressao_temporizador',
    delayMs: 'atraso_ms',
    formId: 'formulario_id',
    payload: 'dados',
  };

  if (Array.isArray(value)) {
    return value.map((item) => normalizarPayloadHistorico(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value).reduce((acc, key) => {
    const normalizedKey = keyMap[key] || key;
    acc[normalizedKey] = normalizarPayloadHistorico(value[key]);
    return acc;
  }, {});
}

async function logHistory(params) {
  const payloadNormalizado = params.payloadJson ? normalizarPayloadHistorico(params.payloadJson) : null;
  await historyRepository.addHistory({
    instanciaId: params.instanciaId,
    processoId: params.processoId,
    versaoProcessoId: params.versaoProcessoId,
    origemElementId: params.origemElementId || null,
    destinoElementId: params.destinoElementId || null,
    tipoEvento: params.tipoEvento,
    descricao: params.descricao || null,
    executor: params.executor || null,
    payloadJson: payloadNormalizado ? JSON.stringify(payloadNormalizado) : null,
  });
}

async function scheduleTimer(nextContext, delayMs) {
  setTimeout(async () => {
    try {
      await continueFlow(nextContext);
    } catch (err) {
      console.error('Erro na execucao de timer do BPM:', err && err.message ? err.message : err);
    }
  }, delayMs);
}

async function handleOutgoingFlows({ graph, element, contextData, allowMultiple }) {
  const outgoingIds = graph.outgoingByElement[element.id] || [];
  if (!outgoingIds.length) return [];

  const outgoingFlows = outgoingIds
    .map((flowId) => graph.sequenceFlowMap[flowId])
    .filter(Boolean);

  const defaultFlowId = getDefaultFlowId(element, graph.properties);

  if (element.$type === 'bpmn:ExclusiveGateway') {
    const decisionAnswerField = readElementProperty(graph, element.id, 'decisionAnswerField', '__decisionAnswer');
    const decisionAnswer = resolveDecisionAnswerFromContext(contextData, decisionAnswerField);

    if (decisionAnswer) {
      const selectedByDecision = selectDecisionFlowByAnswer({
        graph,
        element,
        answer: decisionAnswer,
      });
      if (selectedByDecision) return [selectedByDecision];
    }

    const evaluationContext = buildDecisionEvaluationContext(contextData, decisionAnswer);
    const candidates = outgoingFlows.filter((flow) => flow.id !== defaultFlowId);
    const matched = [];

    candidates.forEach((flow) => {
      const condition = getFlowCondition(flow, graph.properties);
      if (condition) {
        if (evaluateExpression(condition, evaluationContext)) {
          matched.push(flow);
        }
        return;
      }

      const decisionOutcome = inferDecisionOutcomeFromFlow(flow, graph.properties);
      if (!decisionOutcome) {
        matched.push(flow);
      }
    });

    if (matched.length) {
      return [matched[0]];
    }

    if (defaultFlowId && graph.sequenceFlowMap[defaultFlowId]) {
      return [graph.sequenceFlowMap[defaultFlowId]];
    }

    return [];
  }

  const selected = [];
  const evaluationContext = contextData && typeof contextData === 'object' ? contextData : {};

  outgoingFlows.forEach((flow) => {
    const condition = getFlowCondition(flow, graph.properties);
    if (!condition) {
      selected.push(flow);
      return;
    }

    const ok = evaluateExpression(condition, evaluationContext);
    if (ok) selected.push(flow);
  });

  if (!selected.length && defaultFlowId && graph.sequenceFlowMap[defaultFlowId]) {
    selected.push(graph.sequenceFlowMap[defaultFlowId]);
  }

  if (!allowMultiple && selected.length > 1) {
    return [selected[0]];
  }

  return selected;
}

async function handleGatewayJoin({ graph, element, instance }) {
  const incoming = graph.incomingByElement[element.id] || [];
  if (incoming.length <= 1) return true;

  const runtime = safeJsonParse(instance.runtime_state_json, {});
  const key = `join_${element.id}`;
  const current = Number(runtime[key] || 0) + 1;
  runtime[key] = current;

  await instanceRepository.updateRuntimeState(instance.id, JSON.stringify(runtime));

  if (current < incoming.length) {
    return false;
  }

  runtime[key] = 0;
  await instanceRepository.updateRuntimeState(instance.id, JSON.stringify(runtime));
  return true;
}

async function maybeFinishInstance(instanciaId) {
  const openTasks = await taskRepository.findOpenTasksByInstance(instanciaId);
  if (!openTasks.length) {
    await instanceRepository.finishInstance(instanciaId, 'CONCLUIDA');
  }
}

async function continueFlow({
  instance,
  processVersion,
  graph,
  elementId,
  sourceElementId,
  contextData,
  executor,
  visited = new Set(),
}) {
  if (!elementId) return;

  const loopKey = `${instance.id}:${elementId}:${sourceElementId || 'ROOT'}`;
  if (visited.has(loopKey)) return;
  visited.add(loopKey);

  const element = graph.elementMap[elementId];
  if (!element) return;
  const elementDisplayName = buildFriendlyElementName({
    elementId: element.id,
    elementName: element.name,
    elementType: element.$type,
  });

  await instanceRepository.updateInstancePointer(instance.id, element.id);

  await logHistory({
    instanciaId: instance.id,
    processoId: instance.processo_id,
    versaoProcessoId: instance.versao_processo_id,
    origemElementId: sourceElementId || null,
    destinoElementId: element.id,
    tipoEvento: 'ENTRADA_ELEMENTO',
    descricao: `Entrada no elemento ${elementDisplayName} (${element.$type})`,
    executor,
    payloadJson: contextData,
  });

  const elementType = element.$type;

  if (elementType === 'bpmn:StartEvent' || elementType === 'bpmn:SubProcess') {
    const outgoing = await handleOutgoingFlows({
      graph,
      element,
      contextData,
      allowMultiple: true,
    });

    for (const flow of outgoing) {
      await continueFlow({
        instance,
        processVersion,
        graph,
        elementId: flow.targetRef ? flow.targetRef.id : null,
        sourceElementId: element.id,
        contextData,
        executor,
        visited,
      });
    }

    return;
  }

  if (elementType === 'bpmn:UserTask') {
    const taskType = readElementProperty(graph, element.id, 'taskType', 'USER');
    let responsible = String(readElementProperty(graph, element.id, 'responsible', '') || '').trim();
    if (taskType === 'MANAGER') {
      const managers = readElementProperty(graph, element.id, 'managerUsers', []);
      if (Array.isArray(managers) && managers.length) {
        responsible = String(managers[0] || '').trim();
      }
    }
    const sla = Number(readElementProperty(graph, element.id, 'sla', 24));
    const formId = Number(readElementProperty(graph, element.id, 'formId', 0)) || null;

    const taskConfig = {
      formId,
      script: readElementProperty(graph, element.id, 'script', null),
      taskType,
    };

    const createdTaskId = await taskRepository.createTask({
      instanciaId: instance.id,
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      elementId: element.id,
      nomeEtapa: elementDisplayName,
      responsavel: responsible,
      slaHoras: sla,
      formConfigJson: JSON.stringify(taskConfig),
      status: 'MINHAS_TAREFAS',
    });

    await logHistory({
      instanciaId: instance.id,
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      origemElementId: sourceElementId || null,
      destinoElementId: element.id,
      tipoEvento: 'TAREFA_CRIADA',
      descricao: responsible ? `Tarefa criada para ${responsible}` : 'Tarefa criada sem responsavel definido',
      executor,
      payloadJson: { responsavel: responsible, sla_horas: sla },
    });

    await notificationService.notifyTaskCreated({
      responsavel: responsible,
      taskId: createdTaskId,
      instanciaId: instance.id,
      processoNome: contextData && contextData.payload ? contextData.payload.processo_codigo || null : null,
      nomeEtapa: elementDisplayName,
      actor: executor,
    });

    return;
  }

  if (elementType === 'bpmn:ServiceTask') {
    const taskType = readElementProperty(graph, element.id, 'taskType', 'SERVICE');
    const script = readElementProperty(graph, element.id, 'script', null);
    const automationId = Number(readElementProperty(graph, element.id, 'automationId', 0)) || null;
    const automationEndpoint = readElementProperty(graph, element.id, 'automationEndpoint', null);
    const automationMethod = readElementProperty(graph, element.id, 'automationMethod', 'POST');
    const automationPayloadMap = readElementProperty(graph, element.id, 'automationPayloadMap', []);
    const dbQuery = readElementProperty(graph, element.id, 'dbQuery', null);

    if (script) {
      executeScript(script, {
        payload: contextData && contextData.payload ? contextData.payload : {},
        action: contextData && contextData.action ? contextData.action : null,
        currentUser: executor,
      });
    }

    if (taskType === 'AUTOMATION') {
      const automationPayload = buildAutomationPayloadFromContext(contextData, automationPayloadMap);
      const automationRequestBody = {
        processo_id: instance.processo_id,
        instancia_id: instance.id,
        atividade_id: element.id,
        atividade_nome: elementDisplayName,
        acao: contextData && contextData.action ? contextData.action : null,
        usuario_atual: executor,
        resposta_formulario: automationPayload,
        resposta_original: contextData && contextData.response ? contextData.response : {},
        payload_fluxo: contextData && contextData.payload ? contextData.payload : {},
      };

      try {
        let automationResult = null;
        if (automationEndpoint) {
          automationResult = await automationService.invokeEndpoint({
            endpointUrl: automationEndpoint,
            method: automationMethod,
            payload: automationRequestBody,
            triggerUser: executor,
          });
        } else if (automationId) {
          automationResult = await automationService.invokeAutomation({
            automationId,
            payload: automationRequestBody,
            triggerUser: executor,
          });
        } else {
          throw new Error('Automacao externa sem endpoint e sem automacao cadastrada');
        }

        await logHistory({
          instanciaId: instance.id,
          processoId: instance.processo_id,
          versaoProcessoId: instance.versao_processo_id,
          origemElementId: sourceElementId || null,
          destinoElementId: element.id,
          tipoEvento: 'AUTOMACAO_EXECUTADA',
          descricao: automationEndpoint
            ? `Automacao externa em ${automationEndpoint} executada com status ${automationResult.status}`
            : `Automacao ${automationId} executada com status ${automationResult.status}`,
          executor,
          payloadJson: automationResult,
        });
      } catch (error) {
        await logHistory({
          instanciaId: instance.id,
          processoId: instance.processo_id,
          versaoProcessoId: instance.versao_processo_id,
          origemElementId: sourceElementId || null,
          destinoElementId: element.id,
          tipoEvento: 'AUTOMACAO_ERRO',
          descricao: error.message || 'Falha na automacao externa',
          executor,
        });
      }
    }

    if (taskType === 'DB' && dbQuery && isSafeDbCommand(dbQuery)) {
      try {
        const rows = await db.query(dbQuery, {});
        await logHistory({
          instanciaId: instance.id,
          processoId: instance.processo_id,
          versaoProcessoId: instance.versao_processo_id,
          origemElementId: sourceElementId || null,
          destinoElementId: element.id,
          tipoEvento: 'DB_CONSULTA_EXECUTADA',
          descricao: 'Consulta SQL executada no no de banco de dados',
          executor,
          payloadJson: {
            total_linhas: Array.isArray(rows) ? rows.length : 0,
          },
        });
      } catch (error) {
        await logHistory({
          instanciaId: instance.id,
          processoId: instance.processo_id,
          versaoProcessoId: instance.versao_processo_id,
          origemElementId: sourceElementId || null,
          destinoElementId: element.id,
          tipoEvento: 'DB_CONSULTA_ERRO',
          descricao: error.message || 'Falha na consulta SQL do no',
          executor,
        });
      }
    }

    const outgoing = await handleOutgoingFlows({
      graph,
      element,
      contextData,
      allowMultiple: true,
    });

    for (const flow of outgoing) {
      await continueFlow({
        instance,
        processVersion,
        graph,
        elementId: flow.targetRef ? flow.targetRef.id : null,
        sourceElementId: element.id,
        contextData,
        executor,
        visited,
      });
    }
    return;
  }

  if (elementType === 'bpmn:ExclusiveGateway') {
    const outgoingIds = graph.outgoingByElement[element.id] || [];
    const decisionConfig = resolveGatewayDecisionConfig(graph, element, elementDisplayName);
    const decisionAnswer = outgoingIds.length > 1
      ? resolveDecisionAnswerFromContext(contextData, decisionConfig.answerField)
      : null;

    if (outgoingIds.length > 1 && !decisionAnswer) {
      const responsavelDecisao = decisionConfig.responsavel || String(executor || '').trim() || null;
      const taskName = `Decisao: ${decisionConfig.question}`;

      const decisionTaskConfig = {
        formId: decisionConfig.formId,
        taskType: 'DECISION',
        decisionGateway: {
          gatewayId: element.id,
          question: decisionConfig.question,
          answerField: decisionConfig.answerField,
          options: [
            { value: 'SIM', label: 'Sim' },
            { value: 'NAO', label: 'Nao' },
          ],
        },
      };

      const createdTaskId = await taskRepository.createTask({
        instanciaId: instance.id,
        processoId: instance.processo_id,
        versaoProcessoId: instance.versao_processo_id,
        elementId: element.id,
        nomeEtapa: taskName,
        responsavel: responsavelDecisao,
        slaHoras: decisionConfig.sla,
        formConfigJson: JSON.stringify(decisionTaskConfig),
        status: 'MINHAS_TAREFAS',
      });

      await logHistory({
        instanciaId: instance.id,
        processoId: instance.processo_id,
        versaoProcessoId: instance.versao_processo_id,
        origemElementId: sourceElementId || null,
        destinoElementId: element.id,
        tipoEvento: 'TAREFA_CRIADA',
        descricao: 'Tarefa de decisao aguardando resposta Sim ou Nao',
        executor,
        payloadJson: {
          responsavel: responsavelDecisao,
          sla_horas: decisionConfig.sla,
          pergunta: decisionConfig.question,
          campo_resposta: decisionConfig.answerField,
        },
      });

      await notificationService.notifyTaskCreated({
        responsavel: responsavelDecisao,
        taskId: createdTaskId,
        instanciaId: instance.id,
        processoNome: contextData && contextData.payload ? contextData.payload.processo_codigo || null : null,
        nomeEtapa: taskName,
        actor: executor,
      });

      return;
    }

    const outgoing = await handleOutgoingFlows({
      graph,
      element,
      contextData,
      allowMultiple: false,
    });

    const chosen = outgoing[0];
    if (!chosen) {
      await logHistory({
        instanciaId: instance.id,
        processoId: instance.processo_id,
        versaoProcessoId: instance.versao_processo_id,
        origemElementId: element.id,
        destinoElementId: null,
        tipoEvento: 'FLUXO_BLOQUEADO',
        descricao: 'Gateway exclusivo sem condicao valida',
        executor,
      });
      return;
    }

    await continueFlow({
      instance,
      processVersion,
      graph,
      elementId: chosen.targetRef ? chosen.targetRef.id : null,
      sourceElementId: element.id,
      contextData,
      executor,
      visited,
    });

    return;
  }

  if (elementType === 'bpmn:InclusiveGateway') {
    const outgoing = await handleOutgoingFlows({
      graph,
      element,
      contextData,
      allowMultiple: true,
    });

    for (const flow of outgoing) {
      await continueFlow({
        instance,
        processVersion,
        graph,
        elementId: flow.targetRef ? flow.targetRef.id : null,
        sourceElementId: element.id,
        contextData,
        executor,
        visited,
      });
    }

    return;
  }

  if (elementType === 'bpmn:ParallelGateway') {
    const canPassJoin = await handleGatewayJoin({ graph, element, instance });
    if (!canPassJoin) {
      await logHistory({
        instanciaId: instance.id,
        processoId: instance.processo_id,
        versaoProcessoId: instance.versao_processo_id,
        origemElementId: sourceElementId || null,
        destinoElementId: element.id,
        tipoEvento: 'AGUARDANDO_JUNCAO_PARALELA',
        descricao: 'Gateway paralelo aguardando outras ramificacoes',
        executor,
      });
      return;
    }

    const outgoing = await handleOutgoingFlows({
      graph,
      element,
      contextData,
      allowMultiple: true,
    });

    for (const flow of outgoing) {
      await continueFlow({
        instance,
        processVersion,
        graph,
        elementId: flow.targetRef ? flow.targetRef.id : null,
        sourceElementId: element.id,
        contextData,
        executor,
        visited,
      });
    }

    return;
  }

  if (hasTimerDefinition(element)) {
    const timerExpr = getTimerExpression(element);
    const delayMs = parseDurationToMs(timerExpr);

    await logHistory({
      instanciaId: instance.id,
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      origemElementId: sourceElementId || null,
      destinoElementId: element.id,
      tipoEvento: 'AGUARDANDO_TEMPORIZADOR',
      descricao: `Timer programado para ${delayMs}ms`,
      executor,
      payloadJson: { expressao_temporizador: timerExpr, atraso_ms: delayMs },
    });

    const outgoing = graph.outgoingByElement[element.id] || [];
    const nextFlow = outgoing[0] ? graph.sequenceFlowMap[outgoing[0]] : null;
    const nextElementId = nextFlow && nextFlow.targetRef ? nextFlow.targetRef.id : null;

    if (nextElementId) {
      await scheduleTimer(
        {
          instance,
          processVersion,
          graph,
          elementId: nextElementId,
          sourceElementId: element.id,
          contextData,
          executor,
          visited: new Set(),
        },
        delayMs
      );
    }

    return;
  }

  if (elementType === 'bpmn:EndEvent') {
    await logHistory({
      instanciaId: instance.id,
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      origemElementId: sourceElementId || null,
      destinoElementId: element.id,
      tipoEvento: 'INSTANCIA_FINALIZADA',
      descricao: 'Fim do processo atingido',
      executor,
    });

    await maybeFinishInstance(instance.id);

    const refreshedInstance = await instanceRepository.getInstanceById(instance.id);
    if (refreshedInstance && String(refreshedInstance.status || '').toUpperCase() === 'CONCLUIDA') {
      await notificationService.notifyInstanceFinished({
        solicitante: refreshedInstance.solicitante,
        instanciaId: refreshedInstance.id,
        processoNome: contextData && contextData.payload ? contextData.payload.processo_codigo || null : null,
      });
    }
    return;
  }

  const fallbackOutgoing = graph.outgoingByElement[element.id] || [];
  for (const flowId of fallbackOutgoing) {
    const flow = graph.sequenceFlowMap[flowId];
    await continueFlow({
      instance,
      processVersion,
      graph,
      elementId: flow && flow.targetRef ? flow.targetRef.id : null,
      sourceElementId: element.id,
      contextData,
      executor,
      visited,
    });
  }
}

async function startInstance({ processoId, solicitante, payload }) {
  const processVersion = await processRepository.getPublishedVersion(processoId);
  if (!processVersion) {
    throw new Error('Somente versao publicada pode ser executada');
  }

  const graph = await buildExecutionContext(processVersion);
  if (!graph.startEvents.length) {
    throw new Error('Processo sem StartEvent');
  }

  function normalizeProcessIdentifierType(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return null;
    if (normalized === 'TEXTO') return 'TEXTO';
    if (normalized === 'SEQUENCIAL' || normalized === 'NUMERICO' || normalized === 'NUMERO') return 'SEQUENCIAL';
    return null;
  }

  function resolveInstanceIdentifier(processInfo, sourcePayload) {
    const mustUseIdentifier = Boolean(processInfo && processInfo.usa_identificador);
    if (!mustUseIdentifier) return null;

    const payloadObject = sourcePayload && typeof sourcePayload === 'object' ? sourcePayload : {};
    const rawIdentifier = payloadObject.identificador !== undefined ? payloadObject.identificador : payloadObject.identifier;
    const identifier = String(rawIdentifier || '').trim();

    if (!identifier) {
      throw new Error('Este processo exige identificador. Informe o identificador para iniciar a solicitacao');
    }

    const identifierType = normalizeProcessIdentifierType(processInfo && processInfo.tipo_identificador);
    if (identifierType === 'SEQUENCIAL') {
      // allow digits with common separators (dot, comma, dash, space)
      const allowedChars = /^[0-9.,\s\-]+$/.test(identifier);
      const digitsOnly = /^\d+$/.test(identifier.replace(/[.,\s\-]/g, ''));
      if (!allowedChars || !digitsOnly) {
        throw new Error('O identificador deste processo deve ser numérico (dígitos; separadores . , - e espaços permitidos)');
      }
    }

    return identifier;
  }

  const processInfo = await processRepository.getProcessById(processoId);
  const instanceIdentifier = resolveInstanceIdentifier(processInfo, payload);
  const fullPayload = Object.assign({}, payload || {}, {
    processo_id: processoId,
    processo_codigo: processInfo ? processInfo.codigo : null,
    identificador: instanceIdentifier,
  });

  const instanceId = await instanceRepository.createInstance({
    processoId,
    versaoId: processVersion.id,
    solicitante: solicitante || 'sistema',
    identificador: instanceIdentifier,
    descIden: processInfo ? processInfo.desc_iden : null,
    payloadJson: JSON.stringify(fullPayload || {}),
    status: 'EM_ANDAMENTO',
    currentElementId: graph.startEvents[0].id,
  });

  const instance = await instanceRepository.getInstanceById(instanceId);

  await logHistory({
    instanciaId: instance.id,
    processoId: instance.processo_id,
    versaoProcessoId: instance.versao_processo_id,
    origemElementId: null,
    destinoElementId: graph.startEvents[0].id,
    tipoEvento: 'INSTANCIA_INICIADA',
    descricao: 'Instancia iniciada',
    executor: solicitante,
    payloadJson: fullPayload,
  });

  await continueFlow({
    instance,
    processVersion,
    graph,
    elementId: graph.startEvents[0].id,
    sourceElementId: null,
    contextData: {
      payload: fullPayload || {},
      action: 'start',
      currentUser: solicitante,
    },
    executor: solicitante,
    visited: new Set(),
  });

  return instanceRepository.getInstanceById(instance.id);
}

async function completeUserTask({ taskId, action, observacao, response, user }) {
  const task = await taskRepository.getTaskById(taskId);
  if (!task) throw new Error('Tarefa nao encontrada');

  const safeResponse = response && typeof response === 'object' ? { ...response } : {};

  let formConfig = {};
  try {
    formConfig = JSON.parse(task.form_config_json || '{}');
  } catch (_) {
    formConfig = {};
  }

  const decisionGateway = formConfig && typeof formConfig.decisionGateway === 'object'
    ? formConfig.decisionGateway
    : null;

  if (decisionGateway) {
    const answerField = String(decisionGateway.answerField || '__decisionAnswer').trim() || '__decisionAnswer';
    const normalizedAnswer = resolveDecisionAnswerFromContext(
      { response: safeResponse, action },
      answerField
    );

    if (!normalizedAnswer) {
      throw new Error('Selecione Sim ou Nao para concluir a tarefa de decisao');
    }

    safeResponse[answerField] = normalizedAnswer;
    safeResponse.__decisionAnswer = normalizedAnswer;
    safeResponse.decision = normalizedAnswer;
    safeResponse.decisao = normalizedAnswer;
  }

  await taskRepository.completeTask({
    taskId,
    action,
    observacao,
    responseJson: JSON.stringify(safeResponse),
    user: user || 'sistema',
  });

  if (formConfig.formId) {
    await formRepository.saveResponse({
      tarefaId: task.id,
      instanciaId: task.instancia_processo_id,
      formularioId: formConfig.formId,
      respostaJson: JSON.stringify(safeResponse),
      respondidoPor: user || 'sistema',
    });
  }

  await logHistory({
    instanciaId: task.instancia_processo_id,
    processoId: task.processo_id,
    versaoProcessoId: task.versao_processo_id,
    origemElementId: task.element_id,
    destinoElementId: null,
    tipoEvento: 'TAREFA_CONCLUIDA',
    descricao: `Tarefa concluida com acao ${action || 'aprovar'}`,
    executor: user,
    payloadJson: {
      observacao,
      acao: action,
    },
  });

  await notificationService.notifyTaskCompleted({
    solicitante: task.solicitante,
    taskId: task.id,
    instanciaId: task.instancia_processo_id,
    nomeEtapa: task.nome_etapa,
    action,
  });

  const processVersion = await processRepository.getVersionById(task.versao_processo_id);
  if (!processVersion) throw new Error('Versao do processo nao encontrada');
  const graph = await buildExecutionContext(processVersion);

  const instance = await instanceRepository.getInstanceById(task.instancia_processo_id);

  const taskElement = graph.elementMap[task.element_id];
  if (!taskElement) return task;

  const outgoing = await handleOutgoingFlows({
    graph,
    element: taskElement,
    contextData: {
      payload: safeJsonParse(task.payload_json, {}),
      action: action || 'aprovar',
      currentUser: user,
      response: safeResponse,
    },
    allowMultiple: true,
  });

  for (const flow of outgoing) {
    await continueFlow({
      instance,
      processVersion,
      graph,
      elementId: flow.targetRef ? flow.targetRef.id : null,
      sourceElementId: task.element_id,
      contextData: {
        payload: safeJsonParse(task.payload_json, {}),
        action: action || 'aprovar',
        currentUser: user,
        response: safeResponse,
      },
      executor: user,
      visited: new Set(),
    });
  }

  await maybeFinishInstance(task.instancia_processo_id);

  return taskRepository.getTaskById(taskId);
}

module.exports = {
  startInstance,
  completeUserTask,
};
