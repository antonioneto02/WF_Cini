import BpmnModeler from 'https://esm.sh/bpmn-js@17.11.1/lib/Modeler?bundle';
import minimapModule from 'https://esm.sh/diagram-js-minimap@2.0.0?bundle';
import gridModule from 'https://esm.sh/diagram-js-grid@0.2.0?bundle';

const seedElement = document.getElementById('modelerSeed');
const seed = seedElement ? JSON.parse(seedElement.textContent) : {};

const defaultXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Inicio">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="Aprovacao">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="Fim">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_Start" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task" bpmnElement="Task_1">
        <dc:Bounds x="280" y="98" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End" bpmnElement="EndEvent_1">
        <dc:Bounds x="450" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_1" bpmnElement="Flow_1">
        <di:waypoint x="216" y="138" />
        <di:waypoint x="280" y="138" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_2" bpmnElement="Flow_2">
        <di:waypoint x="380" y="138" />
        <di:waypoint x="450" y="138" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function normalizeProperties(raw) {
  if (!raw) return { elements: {}, flows: {}, meta: {} };
  if (typeof raw === 'object') {
    return {
      elements: raw.elements || {},
      flows: raw.flows || {},
      meta: raw.meta || {},
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      elements: parsed.elements || {},
      flows: parsed.flows || {},
      meta: parsed.meta || {},
    };
  } catch (_) {
    return { elements: {}, flows: {}, meta: {} };
  }
}

const propsStore = normalizeProperties(seed.propriedades);

const modeler = new BpmnModeler({
  container: '#bpmnCanvas',
  keyboard: { bindTo: document },
  additionalModules: [minimapModule, gridModule],
});

const selected = {
  element: null,
  flowInsertOverlayId: null,
  iconOverlayIds: [],
};

const connectMode = {
  active: false,
  source: null,
};

const refs = {
  selectedElementId: document.getElementById('selectedElementId'),
  name: document.getElementById('propName'),
  taskType: document.getElementById('propTaskType'),
  responsible: document.getElementById('propResponsible'),
  responsibleId: document.getElementById('propResponsibleId'),
  responsibleList: document.getElementById('responsibleUsersList'),
  responsibleHint: document.getElementById('propResponsibleHint'),
  sla: document.getElementById('propSla'),
  condition: document.getElementById('propCondition'),
  formId: document.getElementById('propFormId'),
  applyProps: document.getElementById('btnApplyProps'),
  contextMenu: document.getElementById('modelerContextMenu'),
  flowInsertFab: document.getElementById('flowInsertFab'),
};

const formById = (seed.forms || []).reduce((acc, form) => {
  acc[String(form.id)] = form;
  return acc;
}, {});

const responsibleLookup = new Map();
let lastResponsibleResults = [];
let responsibleSearchTimer = null;

function setFieldValue(ref, value) {
  if (!ref) return;
  ref.value = value == null ? '' : String(value);
}

function setFieldText(ref, value) {
  if (!ref) return;
  ref.textContent = value == null ? '' : String(value);
}

function normalizeUserId(value) {
  return String(value || '').trim().toUpperCase();
}

function hideResponsibleSuggestions() {
  if (!refs.responsibleList) return;
  refs.responsibleList.classList.add('hidden');
}

function showResponsibleSuggestions() {
  if (!refs.responsibleList) return;
  refs.responsibleList.classList.remove('hidden');
}

function updateResponsibleHintById(userId) {
  if (!refs.responsibleHint) return;
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    setFieldText(refs.responsibleHint, 'Digite ao menos 2 letras do nome para filtrar usuarios.');
    return;
  }

  const user = responsibleLookup.get(normalized);
  if (!user) {
    setFieldText(refs.responsibleHint, `Responsavel selecionado: ${normalized}`);
    return;
  }

  const details = [user.nome || '', user.email || ''].filter(Boolean).join(' • ');
  setFieldText(refs.responsibleHint, details || `Responsavel selecionado: ${normalized}`);
}

function renderResponsibleList(users) {
  if (!refs.responsibleList) return;
  refs.responsibleList.innerHTML = '';
  lastResponsibleResults = users;

  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'px-3 py-2 text-xs text-slate-500';
    empty.textContent = 'Nenhum usuario encontrado';
    refs.responsibleList.appendChild(empty);
    showResponsibleSuggestions();
    return;
  }

  users.forEach((user) => {
    const id = normalizeUserId(user.id);
    if (!id) return;
    responsibleLookup.set(id, user);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'w-full text-left px-3 py-2 hover:bg-slate-100 border-b border-slate-100 last:border-b-0';
    item.dataset.userId = id;
    item.dataset.userName = user.nome || id;
    item.innerHTML = `<p class="text-sm font-medium">${user.nome || id}</p><p class="text-xs text-slate-500">${id}${user.email ? ` • ${user.email}` : ''}</p>`;
    item.addEventListener('click', () => {
      setFieldValue(refs.responsible, user.nome || id);
      setFieldValue(refs.responsibleId, id);
      updateResponsibleHintById(id);
      hideResponsibleSuggestions();
    });
    refs.responsibleList.appendChild(item);
  });

  showResponsibleSuggestions();
}

async function searchResponsibleUsers(term) {
  const response = await fetch(`/api/protheus/usuarios?search=${encodeURIComponent(term)}&limit=20`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || 'Erro ao pesquisar usuarios Protheus');
  }
  return Array.isArray(body.data) ? body.data : [];
}

function bindResponsibleLookup() {
  if (!refs.responsible) return;

  refs.responsible.addEventListener('input', () => {
    const term = refs.responsible.value.trim();
    setFieldValue(refs.responsibleId, '');
    updateResponsibleHintById('');

    if (responsibleSearchTimer) {
      clearTimeout(responsibleSearchTimer);
      responsibleSearchTimer = null;
    }

    if (term.length < 2) {
      hideResponsibleSuggestions();
      return;
    }

    responsibleSearchTimer = setTimeout(async () => {
      try {
        const users = await searchResponsibleUsers(term);
        renderResponsibleList(users);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao consultar usuarios', 'error');
      }
    }, 220);
  });

  refs.responsible.addEventListener('focus', () => {
    const term = refs.responsible.value.trim();
    if (term.length >= 2 && lastResponsibleResults.length) {
      showResponsibleSuggestions();
    }
  });

  refs.responsible.addEventListener('change', () => {
    const typed = refs.responsible.value.trim().toLowerCase();
    if (!typed) {
      setFieldValue(refs.responsibleId, '');
      updateResponsibleHintById('');
      return;
    }

    const match = lastResponsibleResults.find((user) => String(user.nome || '').trim().toLowerCase() === typed);
    if (match && match.id) {
      const id = normalizeUserId(match.id);
      setFieldValue(refs.responsible, match.nome || id);
      setFieldValue(refs.responsibleId, id);
      updateResponsibleHintById(id);
    }
  });

  document.addEventListener('click', (event) => {
    if (!refs.responsibleList || !refs.responsible) return;
    if (refs.responsibleList.contains(event.target)) return;
    if (refs.responsible === event.target) return;
    hideResponsibleSuggestions();
  });
}

async function resolveResponsibleDisplay(userId) {
  const id = normalizeUserId(userId);
  if (!id) {
    setFieldValue(refs.responsible, '');
    setFieldValue(refs.responsibleId, '');
    updateResponsibleHintById('');
    return;
  }

  setFieldValue(refs.responsibleId, id);

  const cached = responsibleLookup.get(id);
  if (cached) {
    setFieldValue(refs.responsible, cached.nome || id);
    updateResponsibleHintById(id);
    return;
  }

  setFieldValue(refs.responsible, id);
  updateResponsibleHintById(id);

  try {
    const users = await searchResponsibleUsers(id);
    const exact = users.find((user) => normalizeUserId(user.id) === id);
    if (exact) {
      responsibleLookup.set(id, exact);
      setFieldValue(refs.responsible, exact.nome || id);
      updateResponsibleHintById(id);
    }
  } catch (_) {
    // keep ID fallback visible when lookup fails
  }
}

function ensureItemStore(elementId, isFlow) {
  if (isFlow) {
    if (!propsStore.flows[elementId]) propsStore.flows[elementId] = {};
    return propsStore.flows[elementId];
  }

  if (!propsStore.elements[elementId]) propsStore.elements[elementId] = {};
  return propsStore.elements[elementId];
}

function getStoreForElement(element) {
  if (!element || !element.businessObject) return null;
  const bo = element.businessObject;
  const isFlow = bo.$type === 'bpmn:SequenceFlow';
  return ensureItemStore(bo.id, isFlow);
}

function clearContextMenu() {
  if (!refs.contextMenu) return;
  refs.contextMenu.style.display = 'none';
}

function showContextMenu(x, y) {
  if (!refs.contextMenu) return;
  refs.contextMenu.style.left = `${x}px`;
  refs.contextMenu.style.top = `${y}px`;
  refs.contextMenu.style.display = 'grid';
}

function resetPropsPanel() {
  setFieldValue(refs.selectedElementId, '');
  setFieldValue(refs.name, '');
  setFieldValue(refs.taskType, 'USER');
  setFieldValue(refs.responsible, '');
  setFieldValue(refs.responsibleId, '');
  setFieldValue(refs.sla, '');
  setFieldValue(refs.condition, '');
  setFieldValue(refs.formId, '');
  updateResponsibleHintById('');
}

function syncPanelFromSelection() {
  const el = selected.element;
  if (!el || !el.businessObject) {
    resetPropsPanel();
    return;
  }

  const bo = el.businessObject;
  const store = getStoreForElement(el) || {};

  setFieldValue(refs.selectedElementId, bo.id);
  setFieldValue(refs.name, bo.name || store.name || '');
  setFieldValue(refs.taskType, store.taskType || 'USER');
  resolveResponsibleDisplay(store.responsible || '');
  setFieldValue(refs.sla, store.sla || '');
  setFieldValue(refs.condition, store.condition || '');
  setFieldValue(refs.formId, store.formId || '');
}

function applyPropertiesFromPanel() {
  const el = selected.element;
  if (!el || !el.businessObject) {
    WorkflowUI.showToast('Selecione um elemento para aplicar alteracoes', 'warning');
    return;
  }

  const bo = el.businessObject;
  const isFlow = bo.$type === 'bpmn:SequenceFlow';
  const store = ensureItemStore(bo.id, isFlow);
  const modeling = modeler.get('modeling');

  store.taskType = refs.taskType ? refs.taskType.value : 'USER';
  const selectedResponsibleId = normalizeUserId(refs.responsibleId ? refs.responsibleId.value : '');
  const typedResponsibleName = refs.responsible ? refs.responsible.value.trim() : '';
  if (typedResponsibleName && !selectedResponsibleId) {
    WorkflowUI.showToast('Selecione o responsavel na lista de sugestoes por nome.', 'warning');
    return;
  }
  store.responsible = selectedResponsibleId;
  store.sla = refs.sla ? refs.sla.value.trim() : '';
  store.condition = refs.condition ? refs.condition.value.trim() : '';
  store.formId = refs.formId && refs.formId.value ? Number(refs.formId.value) : null;

  const name = refs.name ? refs.name.value.trim() : '';
  store.name = name;
  modeling.updateProperties(el, { name });

  if (bo.$type === 'bpmn:SequenceFlow' && store.condition) {
    modeling.updateLabel(el, store.condition);
  }

  renderTypeOverlays();
  WorkflowUI.showToast('Propriedades aplicadas', 'success');
}

function getCanvasCenterPosition() {
  const canvas = modeler.get('canvas');
  const viewbox = canvas.viewbox();
  return {
    x: viewbox.x + viewbox.width / 2,
    y: viewbox.y + viewbox.height / 2,
  };
}

function createShapeByType(type) {
  const elementFactory = modeler.get('elementFactory');
  return elementFactory.createShape({ type });
}

function isConnectableElement(element) {
  if (!element || !element.businessObject) return false;

  // Ignore labels and non-flow containers (process/collaboration/lane).
  if (element.labelTarget) return false;

  const bo = element.businessObject;
  const blockedTypes = new Set([
    'bpmn:SequenceFlow',
    'bpmn:Process',
    'bpmn:Collaboration',
    'bpmn:Participant',
    'bpmn:Lane',
  ]);
  if (blockedTypes.has(bo.$type)) return false;

  if (typeof bo.$instanceOf === 'function') {
    return bo.$instanceOf('bpmn:FlowNode');
  }

  return /(Task|Event|Gateway|SubProcess|CallActivity)$/.test(String(bo.$type || ''));
}

function updateConnectModeUi() {
  document.querySelectorAll('.wf-toolbox-item[data-tool-type="bpmn:SequenceFlow"]').forEach((button) => {
    button.classList.toggle('bg-ciniBlue', connectMode.active);
    button.classList.toggle('text-white', connectMode.active);
    button.classList.toggle('border-ciniBlue', connectMode.active);
  });
}

function clearConnectMode(showMessage = false) {
  const wasActive = connectMode.active;
  connectMode.active = false;
  connectMode.source = null;
  updateConnectModeUi();

  if (wasActive && showMessage) {
    WorkflowUI.showToast('Modo de conexao finalizado', 'info');
  }
}

function activateConnectMode() {
  if (connectMode.active) {
    clearConnectMode(true);
    return;
  }

  connectMode.active = true;
  connectMode.source = null;
  updateConnectModeUi();
  WorkflowUI.showToast('Modo seta ativo: clique no elemento de origem e depois no destino', 'info');
}

function handleConnectModeClick(element) {
  if (!connectMode.active) return false;
  if (!isConnectableElement(element)) {
    WorkflowUI.showToast('Selecione um elemento valido para conectar', 'warning');
    return true;
  }

  if (!connectMode.source) {
    connectMode.source = element;
    const sourceName = element.businessObject.name || element.id;
    WorkflowUI.showToast(`Origem selecionada: ${sourceName}. Agora clique no destino.`, 'info');
    return true;
  }

  if (connectMode.source.id === element.id) {
    WorkflowUI.showToast('Escolha um destino diferente da origem', 'warning');
    return true;
  }

  const modeling = modeler.get('modeling');
  try {
    modeling.connect(connectMode.source, element, { type: 'bpmn:SequenceFlow' });
    WorkflowUI.showToast('Seta adicionada com sucesso', 'success');
    clearConnectMode();
  } catch (_) {
    WorkflowUI.showToast('Nao foi possivel conectar os elementos selecionados', 'error');
  }

  return true;
}

function addElementFromTool(type) {
  if (type === 'bpmn:SequenceFlow') {
    activateConnectMode();
    return;
  }

  if (connectMode.active) {
    clearConnectMode();
  }

  const modeling = modeler.get('modeling');
  const position = getCanvasCenterPosition();
  const shape = createShapeByType(type);

  const selectedElement = selected.element;
  const parent = selectedElement && selectedElement.parent ? selectedElement.parent : modeler.get('canvas').getRootElement();

  const newShape = modeling.createShape(shape, position, parent);

  if (selectedElement && selectedElement.businessObject && selectedElement.businessObject.$type !== 'bpmn:SequenceFlow') {
    try {
      modeling.connect(selectedElement, newShape);
    } catch (_) {
    }
  }

  selected.element = newShape;
  syncPanelFromSelection();
}

function duplicateElement(element) {
  if (!element || !element.businessObject || element.businessObject.$type === 'bpmn:SequenceFlow') return;
  const modeling = modeler.get('modeling');
  const duplicated = modeling.createShape(
    createShapeByType(element.businessObject.$type),
    { x: element.x + 180, y: element.y + 20 },
    element.parent
  );

  const originalStore = getStoreForElement(element);
  if (originalStore) {
    propsStore.elements[duplicated.id] = { ...originalStore };
  }

  selected.element = duplicated;
  syncPanelFromSelection();
}

function addElementAfterSelected(type) {
  const element = selected.element;
  if (!element || !element.businessObject) return;

  if (element.businessObject.$type === 'bpmn:SequenceFlow') {
    insertElementOnFlow(element, type);
    return;
  }

  const modeling = modeler.get('modeling');
  const newShape = modeling.createShape(createShapeByType(type), { x: element.x + 180, y: element.y + 10 }, element.parent);
  try {
    modeling.connect(element, newShape);
  } catch (_) {
  }
  selected.element = newShape;
  syncPanelFromSelection();
}

function getFlowMidpoint(flow) {
  const bo = flow.businessObject;
  if (bo && bo.waypoints && bo.waypoints.length >= 2) {
    const a = bo.waypoints[Math.floor((bo.waypoints.length - 1) / 2)];
    const b = bo.waypoints[Math.ceil((bo.waypoints.length - 1) / 2)];
    return {
      x: Math.round((a.x + b.x) / 2),
      y: Math.round((a.y + b.y) / 2),
    };
  }
  return {
    x: flow.x + 80,
    y: flow.y + 10,
  };
}

function insertElementOnFlow(flow, type) {
  if (!flow || !flow.source || !flow.target) return;

  const modeling = modeler.get('modeling');
  const midpoint = getFlowMidpoint(flow);
  const parent = flow.source.parent || flow.parent;

  const newShape = modeling.createShape(createShapeByType(type), midpoint, parent);

  try {
    modeling.removeConnection(flow);
  } catch (_) {
    modeling.removeElements([flow]);
  }

  modeling.connect(flow.source, newShape);
  modeling.connect(newShape, flow.target);

  selected.element = newShape;
  syncPanelFromSelection();
}

function handleContextAction(action) {
  const element = selected.element;
  if (!element) return;
  const directEditing = modeler.get('directEditing');
  const modeling = modeler.get('modeling');

  if (action === 'edit') {
    directEditing.activate(element);
  } else if (action === 'delete') {
    modeling.removeElements([element]);
    selected.element = null;
    resetPropsPanel();
  } else if (action === 'duplicate') {
    duplicateElement(element);
  } else if (action === 'add-task-after') {
    addElementAfterSelected('bpmn:UserTask');
  } else if (action === 'add-gateway-after') {
    addElementAfterSelected('bpmn:ExclusiveGateway');
  } else if (action === 'associate-form') {
    const current = refs.formId.value || '';
    const value = window.prompt('Informe o ID do formulario para associar', current);
    if (value !== null) {
      refs.formId.value = value.trim();
      applyPropertiesFromPanel();
    }
  } else if (action === 'set-responsible') {
    const current = refs.responsibleId ? refs.responsibleId.value : (refs.responsible.value || '');
    const value = window.prompt('Informe o ID do usuario Protheus responsavel', current);
    if (value !== null) {
      const id = normalizeUserId(value);
      setFieldValue(refs.responsibleId, id);
      setFieldValue(refs.responsible, id);
      updateResponsibleHintById(id);
      applyPropertiesFromPanel();
    }
  }

  clearContextMenu();
}

function getIconForType(type, hasForm) {
  if (hasForm) return '<i class="bi bi-ui-checks-grid"></i>';
  if (type === 'bpmn:UserTask') return '<i class="bi bi-person"></i>';
  if (type === 'bpmn:ExclusiveGateway' || type === 'bpmn:ParallelGateway') return '<i class="bi bi-sign-intersection"></i>';
  if (type === 'bpmn:StartEvent' || type === 'bpmn:EndEvent' || type === 'bpmn:IntermediateCatchEvent') return '<i class="bi bi-record-circle"></i>';
  return null;
}

function renderTypeOverlays() {
  const overlays = modeler.get('overlays');
  selected.iconOverlayIds.forEach((id) => overlays.remove(id));
  selected.iconOverlayIds = [];

  const elementRegistry = modeler.get('elementRegistry');
  elementRegistry.forEach((element) => {
    if (!element || !element.businessObject) return;
    const type = element.businessObject.$type;
    const store = propsStore.elements[element.id] || {};
    const hasForm = Boolean(store.formId && formById[String(store.formId)]);
    const icon = getIconForType(type, hasForm);
    if (!icon) return;

    const html = document.createElement('div');
    html.className = 'wf-bpmn-icon-overlay';
    html.innerHTML = icon;

    const id = overlays.add(element, {
      position: { bottom: 2, right: 2 },
      html,
    });
    selected.iconOverlayIds.push(id);
  });
}

function positionFlowInsertFab(flow) {
  if (!refs.flowInsertFab) return;
  const canvas = modeler.get('canvas');
  const midpoint = getFlowMidpoint(flow);
  const viewbox = canvas.viewbox();

  const canvasEl = document.getElementById('bpmnCanvas');
  if (!canvasEl) return;

  const left = ((midpoint.x - viewbox.x) / viewbox.width) * canvasEl.clientWidth;
  const top = ((midpoint.y - viewbox.y) / viewbox.height) * canvasEl.clientHeight;

  refs.flowInsertFab.style.left = `${left}px`;
  refs.flowInsertFab.style.top = `${top}px`;
  refs.flowInsertFab.style.display = 'flex';
}

function hideFlowInsertFab() {
  if (!refs.flowInsertFab) return;
  refs.flowInsertFab.style.display = 'none';
}

function validateDiagram() {
  const elementRegistry = modeler.get('elementRegistry');
  const elements = [];
  elementRegistry.forEach((e) => {
    if (e && e.businessObject && !e.labelTarget) elements.push(e);
  });

  const startEvents = elements.filter((e) => e.businessObject.$type === 'bpmn:StartEvent');
  const endEvents = elements.filter((e) => e.businessObject.$type === 'bpmn:EndEvent');
  const userTasks = elements.filter((e) => e.businessObject.$type === 'bpmn:UserTask');
  const serviceTasks = elements.filter((e) => e.businessObject.$type === 'bpmn:ServiceTask');

  const errors = [];
  if (!startEvents.length) errors.push('O processo precisa ter ao menos um Evento inicial.');
  if (!endEvents.length) errors.push('O processo precisa ter ao menos um Evento final.');

  userTasks.concat(serviceTasks).forEach((task) => {
    const incoming = task.incoming || [];
    const outgoing = task.outgoing || [];
    if (!incoming.length || !outgoing.length) {
      errors.push(`A atividade ${task.id} deve estar conectada com entrada e saida.`);
    }
  });

  return errors;
}

async function saveVersion() {
  const validationErrors = validateDiagram();
  if (validationErrors.length) {
    WorkflowUI.showToast('Validacao falhou. Veja os detalhes no alerta.', 'warning');
    window.alert(validationErrors.join('\n'));
    return;
  }

  try {
    WorkflowUI.setLoader(true);

    const { xml } = await modeler.saveXML({ format: true });

    const response = await fetch(`/api/processos/${seed.processoId}/versoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bpmnXml: xml,
        propriedadesJson: JSON.stringify(propsStore),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao salvar nova versao');
    }

    WorkflowUI.showToast(`Versao v${data.versao} salva com sucesso`, 'success');
    setTimeout(() => {
      window.location.href = `/processos/${seed.processoId}`;
    }, 700);
  } catch (error) {
    WorkflowUI.showToast(error.message || 'Falha ao salvar', 'error');
  } finally {
    WorkflowUI.setLoader(false);
  }
}

function bindToolbarButtons() {
  function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('click', handler);
  }

  bindClick('btnSaveVersion', saveVersion);

  bindClick('btnZoomIn', () => {
    const canvas = modeler.get('canvas');
    const current = canvas.zoom();
    canvas.zoom(current + 0.15);
  });

  bindClick('btnZoomOut', () => {
    const canvas = modeler.get('canvas');
    const current = canvas.zoom();
    canvas.zoom(Math.max(0.2, current - 0.15));
  });

  bindClick('btnFit', () => {
    modeler.get('canvas').zoom('fit-viewport');
  });

  bindClick('btnUndo', () => {
    modeler.get('commandStack').undo();
  });

  bindClick('btnRedo', () => {
    modeler.get('commandStack').redo();
  });

  bindClick('btnAlign', () => {
    const selectedElements = modeler.get('selection').get();
    if (selectedElements.length < 2) {
      WorkflowUI.showToast('Selecione pelo menos 2 elementos para alinhar', 'warning');
      return;
    }

    const align = modeler.get('alignElements', false);
    if (!align) {
      WorkflowUI.showToast('Auto-align indisponivel neste build', 'warning');
      return;
    }

    align.trigger(selectedElements, 'center');
  });
}

function bindToolbox() {
  document.querySelectorAll('.wf-toolbox-item').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.toolType;
      if (!type) return;
      addElementFromTool(type);
    });
  });
}

function bindContextMenuActions() {
  if (!refs.contextMenu) return;
  refs.contextMenu.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      handleContextAction(button.dataset.action);
    });
  });

  document.addEventListener('click', (event) => {
    if (!refs.contextMenu) return;
    if (refs.contextMenu.style.display !== 'grid') return;
    if (!refs.contextMenu.contains(event.target)) clearContextMenu();
  });
}

function bindFlowInsertFab() {
  if (!refs.flowInsertFab) return;
  refs.flowInsertFab.addEventListener('click', () => {
    const element = selected.element;
    if (!element || !element.businessObject || element.businessObject.$type !== 'bpmn:SequenceFlow') return;

    const kind = window.prompt('Inserir no fluxo: tarefa, gateway ou evento?', 'tarefa');
    if (!kind) return;

    const normalized = kind.trim().toLowerCase();
    if (normalized.startsWith('t')) {
      insertElementOnFlow(element, 'bpmn:UserTask');
    } else if (normalized.startsWith('g')) {
      insertElementOnFlow(element, 'bpmn:ExclusiveGateway');
    } else if (normalized.startsWith('e')) {
      insertElementOnFlow(element, 'bpmn:IntermediateCatchEvent');
    } else {
      WorkflowUI.showToast('Opcao invalida para insercao', 'warning');
    }
  });
}

function bindModelerEvents() {
  const directEditing = modeler.get('directEditing');

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && connectMode.active) {
      clearConnectMode(true);
    }
  });

  modeler.on('element.click', (event) => {
    if (!event || !event.element) return;
    handleConnectModeClick(event.element);
  });

  modeler.on('selection.changed', (event) => {
    const selectedElement = event.newSelection && event.newSelection.length ? event.newSelection[0] : null;
    selected.element = selectedElement;
    syncPanelFromSelection();

    if (selectedElement && selectedElement.businessObject && selectedElement.businessObject.$type === 'bpmn:SequenceFlow') {
      positionFlowInsertFab(selectedElement);
    } else {
      hideFlowInsertFab();
    }
  });

  modeler.on('element.changed', () => {
    renderTypeOverlays();
    const element = selected.element;
    if (element && element.businessObject && element.businessObject.$type === 'bpmn:SequenceFlow') {
      positionFlowInsertFab(element);
    }
  });

  modeler.on('element.contextmenu', (event) => {
    if (!event || !event.originalEvent || !event.element) return;
    event.originalEvent.preventDefault();
    selected.element = event.element;
    syncPanelFromSelection();
    showContextMenu(event.originalEvent.clientX, event.originalEvent.clientY);
  });

  modeler.on('element.dblclick', (event) => {
    if (!event || !event.element) return;
    directEditing.activate(event.element);
  });
}

function bindPropertyActions() {
  if (!refs.applyProps) return;
  refs.applyProps.addEventListener('click', applyPropertiesFromPanel);
}

async function bootstrap() {
  const xml = seed.bpmnXml || defaultXml;
  await modeler.importXML(xml);
  modeler.get('canvas').zoom('fit-viewport');

  bindToolbarButtons();
  bindToolbox();
  bindContextMenuActions();
  bindFlowInsertFab();
  bindModelerEvents();
  bindPropertyActions();
  bindResponsibleLookup();

  renderTypeOverlays();
}

bootstrap().catch((error) => {
  console.error(error);
  WorkflowUI.showToast('Erro ao carregar modelador BPMN', 'error');
});
