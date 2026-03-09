const BpmnModdle = require('bpmn-moddle');

const moddle = new BpmnModdle();

function normalizeProperties(rawJson) {
  if (!rawJson) return { elements: {}, flows: {}, meta: {} };
  if (typeof rawJson === 'object') {
    return {
      elements: rawJson.elements || {},
      flows: rawJson.flows || {},
      meta: rawJson.meta || {},
    };
  }

  try {
    const parsed = JSON.parse(rawJson);
    return {
      elements: parsed.elements || {},
      flows: parsed.flows || {},
      meta: parsed.meta || {},
    };
  } catch (_) {
    return { elements: {}, flows: {}, meta: {} };
  }
}

async function parseXml(xml) {
  const { rootElement } = await moddle.fromXML(xml);
  return rootElement;
}

function getExecutableProcess(definitions) {
  const rootElements = definitions.rootElements || [];
  return rootElements.find((el) => el.$type === 'bpmn:Process') || null;
}

function flattenFlowElements(flowElements, map) {
  (flowElements || []).forEach((element) => {
    map[element.id] = element;

    if (element.$type === 'bpmn:SubProcess') {
      flattenFlowElements(element.flowElements || [], map);
    }
  });
}

function buildGraph(definitions, propertiesRaw) {
  const process = getExecutableProcess(definitions);
  if (!process) throw new Error('Processo BPMN nao encontrado no XML');

  const elementMap = {};
  flattenFlowElements(process.flowElements || [], elementMap);

  const startEvents = Object.values(elementMap).filter((el) => el.$type === 'bpmn:StartEvent');
  const sequenceFlows = Object.values(elementMap).filter((el) => el.$type === 'bpmn:SequenceFlow');

  const outgoingByElement = {};
  const incomingByElement = {};

  sequenceFlows.forEach((flow) => {
    const sourceId = flow.sourceRef && flow.sourceRef.id;
    const targetId = flow.targetRef && flow.targetRef.id;

    if (sourceId) {
      if (!outgoingByElement[sourceId]) outgoingByElement[sourceId] = [];
      outgoingByElement[sourceId].push(flow.id);
    }

    if (targetId) {
      if (!incomingByElement[targetId]) incomingByElement[targetId] = [];
      incomingByElement[targetId].push(flow.id);
    }
  });

  return {
    process,
    elementMap,
    sequenceFlows,
    sequenceFlowMap: sequenceFlows.reduce((acc, flow) => {
      acc[flow.id] = flow;
      return acc;
    }, {}),
    outgoingByElement,
    incomingByElement,
    startEvents,
    properties: normalizeProperties(propertiesRaw),
  };
}

function getDefaultFlowId(element, properties) {
  if (element.default && element.default.id) return element.default.id;

  const gatewayProps = properties.elements[element.id] || {};
  if (gatewayProps.defaultFlow) return gatewayProps.defaultFlow;

  return null;
}

function getFlowCondition(flow, properties) {
  const saved = properties.flows[flow.id] || {};
  if (saved.condition) return saved.condition;

  const conditionExpression = flow.conditionExpression;
  if (conditionExpression && conditionExpression.body) {
    return conditionExpression.body;
  }

  return null;
}

function hasTimerDefinition(element) {
  const defs = element.eventDefinitions || [];
  return defs.some((d) => d.$type === 'bpmn:TimerEventDefinition');
}

function getTimerExpression(element) {
  const defs = element.eventDefinitions || [];
  const timer = defs.find((d) => d.$type === 'bpmn:TimerEventDefinition');
  if (!timer) return null;

  if (timer.timeDuration && timer.timeDuration.body) return timer.timeDuration.body;
  if (timer.timeDate && timer.timeDate.body) return timer.timeDate.body;
  if (timer.timeCycle && timer.timeCycle.body) return timer.timeCycle.body;

  return null;
}

module.exports = {
  parseXml,
  buildGraph,
  getDefaultFlowId,
  getFlowCondition,
  hasTimerDefinition,
  getTimerExpression,
};
