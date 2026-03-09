const vm = require('vm');

const processRepository = require('../repositories/processRepository');
const instanceRepository = require('../repositories/instanceRepository');
const taskRepository = require('../repositories/taskRepository');
const historyRepository = require('../repositories/historyRepository');
const formRepository = require('../repositories/formRepository');
const {
  parseXml,
  buildGraph,
  getDefaultFlowId,
  getFlowCondition,
  hasTimerDefinition,
  getTimerExpression,
} = require('./bpmnParserService');

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

  if (!outgoingIds.length) return [];

  const selected = [];
  const defaultFlowId = getDefaultFlowId(element, graph.properties);

  outgoingIds.forEach((flowId) => {
    const flow = graph.sequenceFlowMap[flowId];
    if (!flow) return;

    const condition = getFlowCondition(flow, graph.properties);
    if (!condition) {
      selected.push(flow);
      return;
    }

    const ok = evaluateExpression(condition, contextData);
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

  await instanceRepository.updateInstancePointer(instance.id, element.id);

  await logHistory({
    instanciaId: instance.id,
    processoId: instance.processo_id,
    versaoProcessoId: instance.versao_processo_id,
    origemElementId: sourceElementId || null,
    destinoElementId: element.id,
    tipoEvento: 'ENTRADA_ELEMENTO',
    descricao: `Entrada no elemento ${element.name || element.id} (${element.$type})`,
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
    const responsible = readElementProperty(graph, element.id, 'responsible', 'ANY');
    const sla = Number(readElementProperty(graph, element.id, 'sla', 24));
    const formId = Number(readElementProperty(graph, element.id, 'formId', 0)) || null;

    const taskConfig = {
      formId,
      script: readElementProperty(graph, element.id, 'script', null),
    };

    await taskRepository.createTask({
      instanciaId: instance.id,
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      elementId: element.id,
      nomeEtapa: element.name || element.id,
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
      descricao: `Tarefa criada para ${responsible}`,
      executor,
      payloadJson: { responsavel: responsible, sla_horas: sla },
    });

    return;
  }

  if (elementType === 'bpmn:ServiceTask') {
    const script = readElementProperty(graph, element.id, 'script', null);

    if (script) {
      executeScript(script, {
        payload: contextData && contextData.payload ? contextData.payload : {},
        action: contextData && contextData.action ? contextData.action : null,
        currentUser: executor,
      });
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

  // include processo identifiers in the instance payload
  const processInfo = await processRepository.getProcessById(processoId);
  const fullPayload = Object.assign({}, payload || {}, {
    processo_id: processoId,
    processo_codigo: processInfo ? processInfo.codigo : null,
  });

  const instanceId = await instanceRepository.createInstance({
    processoId,
    versaoId: processVersion.id,
    solicitante: solicitante || 'sistema',
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

  await taskRepository.completeTask({
    taskId,
    action,
    observacao,
    responseJson: JSON.stringify(response || {}),
    user: user || 'sistema',
  });

  let formConfig = {};
  try {
    formConfig = JSON.parse(task.form_config_json || '{}');
  } catch (_) {
    formConfig = {};
  }

  if (formConfig.formId) {
    await formRepository.saveResponse({
      tarefaId: task.id,
      instanciaId: task.instancia_processo_id,
      formularioId: formConfig.formId,
      respostaJson: JSON.stringify(response || {}),
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
      response: response || {},
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
        response: response || {},
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
