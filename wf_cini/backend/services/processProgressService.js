const { parseXml, buildGraph } = require('./bpmnParserService');
const { buildFriendlyElementName } = require('../utils/bpmnNaming');

function isNodeEligible(element) {
  if (!element || !element.$type) return false;
  return [
    'bpmn:StartEvent',
    'bpmn:UserTask',
    'bpmn:ServiceTask',
    'bpmn:ExclusiveGateway',
    'bpmn:ParallelGateway',
    'bpmn:InclusiveGateway',
    'bpmn:SubProcess',
    'bpmn:IntermediateCatchEvent',
    'bpmn:EndEvent',
  ].includes(element.$type);
}

function buildLinearTrack(graph) {
  const nodes = [];
  const visited = new Set();
  const firstStart = graph.startEvents[0];
  if (!firstStart) return nodes;

  let current = firstStart;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (isNodeEligible(current)) {
      nodes.push({
        id: current.id,
        name: buildFriendlyElementName({
          elementId: current.id,
          elementName: current.name,
          elementType: current.$type,
        }),
        type: current.$type,
      });
    }

    const outgoing = graph.outgoingByElement[current.id] || [];
    if (!outgoing.length) break;

    const nextFlow = graph.sequenceFlowMap[outgoing[0]];
    if (!nextFlow || !nextFlow.targetRef) break;
    current = nextFlow.targetRef;
  }

  return nodes;
}

async function buildProgressFromVersion({ bpmnXml, propriedadesJson, currentElementId, instanceStatus }) {
  const isCompleted = String(instanceStatus || '').toUpperCase() === 'CONCLUIDA';

  if (!bpmnXml) {
    return {
      steps: [],
      current_element_id: currentElementId || null,
      is_completed: isCompleted,
      summary_text: isCompleted ? 'Concluido' : 'Fluxo sem execucao ativa',
    };
  }

  const definitions = await parseXml(bpmnXml);
  const graph = buildGraph(definitions, propriedadesJson);
  const track = buildLinearTrack(graph);
  const currentIndex = track.findIndex((step) => step.id === currentElementId);

  let steps = track.slice(0, 12).map((step, index) => {
    let state = 'PENDING';

    if (currentIndex >= 0) {
      if (index < currentIndex) state = 'DONE';
      if (index === currentIndex) state = 'CURRENT';
    }

    return {
      ...step,
      state,
    };
  });

  if (isCompleted && steps.length) {
    steps = steps.map((step) => ({
      ...step,
      state: 'DONE',
    }));
  }

  const current = steps.find((step) => step.state === 'CURRENT');

  return {
    steps,
    current_element_id: currentElementId || null,
    is_completed: isCompleted,
    summary_text: isCompleted ? 'Concluido' : (current ? `Parado em: ${current.name}` : 'Fluxo sem execucao ativa'),
  };
}

module.exports = {
  buildProgressFromVersion,
};
