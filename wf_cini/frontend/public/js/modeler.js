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
const readOnlyMode = Boolean(seed.readOnly);

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

let _suppressGatewayModal = false;

const refs = {
  selectedElementId: document.getElementById('selectedElementId'),
  name: document.getElementById('propName'),
  taskType: document.getElementById('propTaskType'),
  apiParamsSection: document.getElementById('apiParamsSection'),
  apiEndpointPreview: document.getElementById('propApiEndpointPreview'),
  apiParamCount: document.getElementById('propApiParamCount'),
  apiParamsContainer: document.getElementById('propApiParamsContainer'),
  automationExternalSection: document.getElementById('automationExternalSection'),
  automationEndpoint: document.getElementById('propAutomationEndpoint'),
  automationMethod: document.getElementById('propAutomationMethod'),
  automationPayloadMap: document.getElementById('propAutomationPayloadMap'),
  responsible: document.getElementById('propResponsible'),
  responsibleId: document.getElementById('propResponsibleId'),
  responsibleList: document.getElementById('responsibleUsersList'),
  responsibleHint: document.getElementById('propResponsibleHint'),
  managerUsersInput: document.getElementById('propManagerUsersInput'),
  managerUsersList: document.getElementById('managerUsersList'),
  managerUsersSelected: document.getElementById('propManagerUsersSelected'),
  sla: document.getElementById('propSla'),
  condition: document.getElementById('propCondition'),
  gatewayDecisionSection: document.getElementById('gatewayDecisionSection'),
  decisionQuestion: document.getElementById('propDecisionQuestion'),
  decisionAnswerField: document.getElementById('propDecisionAnswerField'),
  defaultFlow: document.getElementById('propDefaultFlow'),
  flowDecisionSection: document.getElementById('flowDecisionSection'),
  flowDecisionOutcome: document.getElementById('propFlowDecisionOutcome'),
  formId: document.getElementById('propFormId'),
  automationId: document.getElementById('propAutomationId'),
  dbQuery: document.getElementById('propDbQuery'),
  ecmPolicy: document.getElementById('propEcmPolicy'),
  managerUsers: document.getElementById('propManagerUsers'),
  applyProps: document.getElementById('btnApplyProps'),
  contextMenu: document.getElementById('modelerContextMenu'),
  flowInsertFab: document.getElementById('flowInsertFab'),
  flowInsertMenu: document.getElementById('flowInsertMenu'),
  toolboxSearchInput: document.getElementById('toolboxSearchInput'),
  dirtyBadge: document.getElementById('modelerDirtyBadge'),
  commandPalette: document.getElementById('modelerCommandPalette'),
  commandInput: document.getElementById('modelerCommandInput'),
  commandList: document.getElementById('modelerCommandList'),
  propsForm: document.getElementById('propsForm'),
};

const formById = (seed.forms || []).reduce((acc, form) => {
  acc[String(form.id)] = form;
  return acc;
}, {});

const automationById = (seed.automations || []).reduce((acc, item) => {
  acc[String(item.id)] = item;
  return acc;
}, {});

const responsibleLookup = new Map();
let lastResponsibleResults = [];
let responsibleSearchTimer = null;
let lastManagerUsersResults = [];
let managerUsersSearchTimer = null;
let selectedManagerUsers = [];

const draftStorageKey = `wf:modeler:draft:${seed.processoId}`;
const uiState = {
  dirty: false,
  autosaveTimer: null,
  autosaveInFlight: false,
  ignoreCommandStack: false,
  commandItems: [],
  activeCommandIndex: 0,
};

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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseAutomationPayloadMapInput(rawValue) {
  const source = String(rawValue || '').trim();
  if (!source) return [];

  const entries = [];
  const seen = new Set();
  source
    .split(/[;,\n\r]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const [leftRaw, rightRaw] = chunk.split(':');
      const sourcePath = String(leftRaw || '').trim();
      const targetPath = String(rightRaw || '').trim() || sourcePath;
      if (!sourcePath) return;

      const key = `${sourcePath.toLowerCase()}::${targetPath.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      entries.push({
        source: sourcePath,
        target: targetPath,
      });
    });

  return entries;
}

function formatAutomationPayloadMap(entries) {
  if (!Array.isArray(entries) || !entries.length) return '';
  return entries
    .map((item) => {
      const sourcePath = String((item && item.source) || '').trim();
      const targetPath = String((item && item.target) || '').trim();
      if (!sourcePath) return '';
      if (!targetPath || targetPath === sourcePath) return sourcePath;
      return `${sourcePath}:${targetPath}`;
    })
    .filter(Boolean)
    .join(', ');
}

function isEditableDomTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

function setDirtyState(isDirty) {
  uiState.dirty = Boolean(isDirty);
  if (!refs.dirtyBadge) return;

  refs.dirtyBadge.classList.toggle('is-dirty', uiState.dirty);
  refs.dirtyBadge.classList.toggle('is-clean', !uiState.dirty);
  refs.dirtyBadge.textContent = uiState.dirty ? 'Alteracoes pendentes' : 'Sem alteracoes';
}

function replacePropsStore(newProps) {
  const normalized = normalizeProperties(newProps || {});
  propsStore.elements = normalized.elements || {};
  propsStore.flows = normalized.flows || {};
  propsStore.meta = normalized.meta || {};
}

function persistLocalDraft() {
  if (readOnlyMode || uiState.autosaveInFlight) return;
  uiState.autosaveInFlight = true;

  modeler.saveXML({ format: true })
    .then(({ xml }) => {
      const payload = {
        savedAt: new Date().toISOString(),
        xml,
        properties: propsStore,
      };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    })
    .catch(() => {
    })
    .finally(() => {
      uiState.autosaveInFlight = false;
    });
}

function scheduleLocalAutosave() {
  if (readOnlyMode) return;
  if (uiState.autosaveTimer) {
    clearTimeout(uiState.autosaveTimer);
    uiState.autosaveTimer = null;
  }
  uiState.autosaveTimer = setTimeout(() => {
    persistLocalDraft();
  }, 1200);
}

function clearLocalDraft() {
  if (uiState.autosaveTimer) {
    clearTimeout(uiState.autosaveTimer);
    uiState.autosaveTimer = null;
  }
  try {
    window.localStorage.removeItem(draftStorageKey);
  } catch (_) {
  }
}

function markDiagramChanged() {
  if (readOnlyMode) return;
  setDirtyState(true);
  scheduleLocalAutosave();
}

function tryRestoreLocalDraft() {
  if (readOnlyMode) return Promise.resolve(false);

  let raw = null;
  try {
    raw = window.localStorage.getItem(draftStorageKey);
  } catch (_) {
    raw = null;
  }
  if (!raw) return Promise.resolve(false);

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    clearLocalDraft();
    return Promise.resolve(false);
  }

  if (!parsed || !parsed.xml) {
    clearLocalDraft();
    return Promise.resolve(false);
  }

  const savedAtLabel = parsed.savedAt
    ? new Date(parsed.savedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'instante desconhecido';
  const shouldRestore = window.confirm(`Foi encontrado um rascunho local salvo em ${savedAtLabel}. Deseja restaurar?`);

  if (!shouldRestore) {
    clearLocalDraft();
    return Promise.resolve(false);
  }

  uiState.ignoreCommandStack = true;

  return modeler.importXML(parsed.xml)
    .then(() => {
      replacePropsStore(parsed.properties || {});
      modeler.get('canvas').zoom('fit-viewport');
      renderTypeOverlays();
      syncPanelFromSelection();
      setDirtyState(true);
      WorkflowUI.showToast('Rascunho local restaurado', 'success');
      return true;
    })
    .catch(() => false)
    .finally(() => {
      uiState.ignoreCommandStack = false;
    });
}

function applyToolboxFilter() {
  if (!refs.toolboxSearchInput) return;

  const query = String(refs.toolboxSearchInput.value || '').trim().toLowerCase();
  const panel = document.getElementById('wfToolboxPanel');
  if (!panel) return;

  const groups = Array.from(panel.querySelectorAll('.wf-toolbox-group-title'));
  groups.forEach((groupTitle) => {
    const nextList = groupTitle.nextElementSibling;
    if (!nextList || !nextList.classList.contains('wf-toolbox-list')) return;

    const buttons = Array.from(nextList.querySelectorAll('.wf-toolbox-item'));
    let visibleCount = 0;
    buttons.forEach((button) => {
      const text = String(button.textContent || '').toLowerCase();
      const show = !query || text.includes(query);
      button.style.display = show ? '' : 'none';
      if (show) visibleCount += 1;
    });

    groupTitle.style.display = visibleCount ? '' : 'none';
    nextList.style.display = visibleCount ? '' : 'none';
  });
}

function openCommandPalette() {
  if (!refs.commandPalette) return;
  refs.commandPalette.style.display = 'block';
  if (refs.commandInput) {
    refs.commandInput.value = '';
    refs.commandInput.focus();
  }
  renderCommandPaletteItems();
}

function closeCommandPalette() {
  if (!refs.commandPalette) return;
  refs.commandPalette.style.display = 'none';
}

function getCommandPaletteItems() {
  const canEdit = !readOnlyMode;
  return [
    {
      id: 'save',
      title: 'Salvar versao',
      shortcut: 'Ctrl+S',
      enabled: canEdit,
      run: () => saveVersion(),
    },
    {
      id: 'add-user-task',
      title: 'Adicionar tarefa de usuario',
      shortcut: 'Alt+1',
      enabled: canEdit,
      run: () => addElementFromTool('bpmn:UserTask'),
    },
    {
      id: 'add-service-task',
      title: 'Adicionar tarefa de servico',
      shortcut: 'Alt+2',
      enabled: canEdit,
      run: () => addElementFromTool('bpmn:ServiceTask'),
    },
    {
      id: 'add-gateway',
      title: 'Adicionar gateway de decisao',
      shortcut: 'Alt+3',
      enabled: canEdit,
      run: () => addElementFromTool('bpmn:ExclusiveGateway'),
    },
    {
      id: 'connect-mode',
      title: 'Ativar modo de conexao',
      shortcut: 'Alt+F',
      enabled: canEdit,
      run: () => activateConnectMode(),
    },
    {
      id: 'fit',
      title: 'Ajustar diagrama na tela',
      shortcut: 'F',
      enabled: true,
      run: () => modeler.get('canvas').zoom('fit-viewport'),
    },
    {
      id: 'undo',
      title: 'Desfazer',
      shortcut: 'Ctrl+Z',
      enabled: canEdit,
      run: () => modeler.get('commandStack').undo(),
    },
    {
      id: 'redo',
      title: 'Refazer',
      shortcut: 'Ctrl+Y',
      enabled: canEdit,
      run: () => modeler.get('commandStack').redo(),
    },
  ];
}

function renderCommandPaletteItems() {
  if (!refs.commandList) return;

  const query = String((refs.commandInput && refs.commandInput.value) || '').trim().toLowerCase();
  const source = getCommandPaletteItems();
  const filtered = source.filter((item) => {
    const target = `${item.title} ${item.shortcut || ''}`.toLowerCase();
    return !query || target.includes(query);
  });

  uiState.commandItems = filtered;
  uiState.activeCommandIndex = filtered.length ? Math.min(uiState.activeCommandIndex, filtered.length - 1) : 0;

  if (!filtered.length) {
    refs.commandList.innerHTML = '<div class="wf-command-item">Nenhum comando encontrado</div>';
    return;
  }

  refs.commandList.innerHTML = filtered.map((item, index) => {
    const activeClass = index === uiState.activeCommandIndex ? 'is-active' : '';
    const disabledSuffix = item.enabled ? '' : ' (somente leitura)';
    return `<button type="button" class="wf-command-item ${activeClass}" data-command-id="${item.id}"><span class="wf-command-title">${item.title}${disabledSuffix}</span><span class="wf-command-shortcut">${item.shortcut || ''}</span></button>`;
  }).join('');

  refs.commandList.querySelectorAll('.wf-command-item[data-command-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const commandId = button.getAttribute('data-command-id');
      executeCommandPaletteItem(commandId);
    });
  });
}

function executeCommandPaletteItem(commandId) {
  const item = uiState.commandItems.find((entry) => entry.id === commandId);
  if (!item || !item.enabled) return;
  closeCommandPalette();
  item.run();
}

function hideResponsibleSuggestions() {
  if (!refs.responsibleList) return;
  refs.responsibleList.style.display = 'none';
}

function showResponsibleSuggestions() {
  if (!refs.responsibleList) return;
  refs.responsibleList.style.display = 'block';
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

function normalizeManagerUsers(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[;,\n\r]/g)
        .map((item) => item.trim())
        .filter(Boolean);

  const unique = [];
  const seen = new Set();
  source.forEach((item) => {
    const id = normalizeUserId(item);
    if (!id) return;
    if (seen.has(id)) return;
    seen.add(id);
    unique.push(id);
  });
  return unique;
}

function syncManagerUsersStorage() {
  setFieldValue(refs.managerUsers, selectedManagerUsers.join(', '));
}

function renderManagerUsersSelected() {
  if (!refs.managerUsersSelected) return;
  refs.managerUsersSelected.innerHTML = '';

  if (!selectedManagerUsers.length) {
    const hint = document.createElement('span');
    hint.style.fontSize = '.78rem';
    hint.style.color = '#5f6368';
    hint.textContent = 'Nenhum gestor selecionado';
    refs.managerUsersSelected.appendChild(hint);
    return;
  }

  selectedManagerUsers.forEach((id) => {
    const user = responsibleLookup.get(id);
    const chip = document.createElement('span');
    chip.style.display = 'inline-flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
    chip.style.padding = '4px 8px';
    chip.style.borderRadius = '999px';
    chip.style.fontSize = '.78rem';
    chip.style.background = '#e8f0fe';
    chip.style.color = '#1a73e8';
    chip.style.border = '1px solid #c7dafc';
    chip.textContent = user && user.nome ? user.nome : id;

    if (!readOnlyMode) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'x';
      remove.style.border = '0';
      remove.style.background = 'transparent';
      remove.style.cursor = 'pointer';
      remove.style.color = '#1a73e8';
      remove.addEventListener('click', () => {
        selectedManagerUsers = selectedManagerUsers.filter((item) => item !== id);
        syncManagerUsersStorage();
        renderManagerUsersSelected();
      });
      chip.appendChild(remove);
    }

    refs.managerUsersSelected.appendChild(chip);
  });
}

function setManagerUsersSelection(value) {
  selectedManagerUsers = normalizeManagerUsers(value);
  syncManagerUsersStorage();
  renderManagerUsersSelected();
}

function hideManagerUsersSuggestions() {
  if (!refs.managerUsersList) return;
  refs.managerUsersList.style.display = 'none';
}

function showManagerUsersSuggestions() {
  if (!refs.managerUsersList) return;
  refs.managerUsersList.style.display = 'block';
}

function renderManagerUsersList(users) {
  if (!refs.managerUsersList) return;
  refs.managerUsersList.innerHTML = '';
  lastManagerUsersResults = users;

  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'px-3 py-2 text-xs text-slate-500';
    empty.textContent = 'Nenhum usuario encontrado';
    refs.managerUsersList.appendChild(empty);
    showManagerUsersSuggestions();
    return;
  }

  users.forEach((user) => {
    const id = normalizeUserId(user.id);
    if (!id) return;
    responsibleLookup.set(id, user);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'w-full text-left px-3 py-2 hover:bg-slate-100 border-b border-slate-100 last:border-b-0';
    item.innerHTML = `<p class="text-sm font-medium">${user.nome || id}</p><p class="text-xs text-slate-500">${id}${user.email ? ` • ${user.email}` : ''}</p>`;
    item.addEventListener('click', () => {
      if (!selectedManagerUsers.includes(id)) {
        selectedManagerUsers.push(id);
      }
      setFieldValue(refs.managerUsersInput, '');
      syncManagerUsersStorage();
      renderManagerUsersSelected();
      hideManagerUsersSuggestions();
    });
    refs.managerUsersList.appendChild(item);
  });

  showManagerUsersSuggestions();
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

async function resolveManagerUsersDisplay(value) {
  const ids = normalizeManagerUsers(value);
  setManagerUsersSelection(ids);

  for (const id of ids) {
    if (responsibleLookup.has(id)) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      const users = await searchResponsibleUsers(id);
      const exact = users.find((user) => normalizeUserId(user.id) === id);
      if (exact) {
        responsibleLookup.set(id, exact);
      }
    } catch (_) {
      // keep ID fallback when lookup fails
    }
  }

  renderManagerUsersSelected();
}

function bindManagerUsersLookup() {
  if (!refs.managerUsersInput) return;

  refs.managerUsersInput.addEventListener('input', () => {
    const term = refs.managerUsersInput.value.trim();

    if (managerUsersSearchTimer) {
      clearTimeout(managerUsersSearchTimer);
      managerUsersSearchTimer = null;
    }

    if (term.length < 2) {
      hideManagerUsersSuggestions();
      return;
    }

    managerUsersSearchTimer = setTimeout(async () => {
      try {
        const users = await searchResponsibleUsers(term);
        renderManagerUsersList(users);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao consultar gestores', 'error');
      }
    }, 220);
  });

  refs.managerUsersInput.addEventListener('focus', () => {
    const term = refs.managerUsersInput.value.trim();
    if (term.length >= 2 && lastManagerUsersResults.length) {
      showManagerUsersSuggestions();
    }
  });

  document.addEventListener('click', (event) => {
    if (!refs.managerUsersList || !refs.managerUsersInput) return;
    if (refs.managerUsersList.contains(event.target)) return;
    if (refs.managerUsersInput === event.target) return;
    hideManagerUsersSuggestions();
  });
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

function sanitizeParamCount(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(30, Math.floor(numeric)));
}

function collectApiParamValuesFromInputs() {
  if (!refs.apiParamsContainer) return [];
  const inputs = Array.from(refs.apiParamsContainer.querySelectorAll('input[data-api-param-index]'));
  return inputs.map((input) => String(input.value || '').trim());
}

function renderApiParamInputs(count, currentValues) {
  if (!refs.apiParamsContainer) return;

  const safeCount = sanitizeParamCount(count);
  const existingValues = Array.isArray(currentValues) ? currentValues : [];
  refs.apiParamsContainer.innerHTML = '';

  for (let index = 0; index < safeCount; index += 1) {
    const wrapper = document.createElement('div');
    wrapper.className = 'grid gap-1';

    const label = document.createElement('label');
    label.className = 'text-xs font-semibold text-slate-700';
    label.textContent = `Parametro ${index + 1}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-3 py-2 rounded-xl border border-slate-300';
    input.placeholder = `Ex: parametro${index + 1}`;
    input.dataset.apiParamIndex = String(index);
    input.value = String(existingValues[index] || '').trim();
    if (readOnlyMode) input.setAttribute('disabled', 'disabled');

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    refs.apiParamsContainer.appendChild(wrapper);
  }
}

function shouldShowApiParamSection() {
  const el = selected.element;
  if (!el || !el.businessObject) return false;
  if (el.businessObject.$type !== 'bpmn:ServiceTask') return false;
  const selectedTaskType = String(refs.taskType && refs.taskType.value ? refs.taskType.value : '').toUpperCase();
  return selectedTaskType === 'SERVICE';
}

function shouldShowAutomationExternalSection() {
  const el = selected.element;
  if (!el || !el.businessObject) return false;
  if (el.businessObject.$type !== 'bpmn:ServiceTask') return false;
  const selectedTaskType = String(refs.taskType && refs.taskType.value ? refs.taskType.value : '').toUpperCase();
  return selectedTaskType === 'AUTOMATION';
}


function normalizeDecisionOutcome(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'SIM') return 'SIM';
  if (normalized === 'NAO') return 'NAO';
  return '';
}

function formatDefaultFlowOptionLabel(flowElement) {
  if (!flowElement || !flowElement.businessObject) return '';
  const bo = flowElement.businessObject;
  const flowStore = propsStore.flows[bo.id] || {};
  const name = String(flowStore.name || bo.name || '').trim();
  const condition = String(flowStore.condition || '').trim();
  const outcome = normalizeDecisionOutcome(flowStore.decisionOutcome);

  if (name) return `${name} [${bo.id}]`;
  if (condition) return `${condition} [${bo.id}]`;
  if (outcome) return `${outcome} [${bo.id}]`;
  return bo.id;
}

function refreshGatewayDefaultFlowOptions(gatewayElement, selectedFlowId = '') {
  if (!refs.defaultFlow) return;

  refs.defaultFlow.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Nenhum fluxo padrao';
  refs.defaultFlow.appendChild(emptyOption);

  if (!gatewayElement || !gatewayElement.businessObject || gatewayElement.businessObject.$type !== 'bpmn:ExclusiveGateway') {
    setFieldValue(refs.defaultFlow, '');
    return;
  }

  const outgoing = Array.isArray(gatewayElement.outgoing) ? gatewayElement.outgoing : [];
  outgoing.forEach((flowElement) => {
    const flowId = flowElement && flowElement.businessObject ? flowElement.businessObject.id : '';
    if (!flowId) return;

    const option = document.createElement('option');
    option.value = flowId;
    option.textContent = formatDefaultFlowOptionLabel(flowElement);
    refs.defaultFlow.appendChild(option);
  });

  setFieldValue(refs.defaultFlow, selectedFlowId || '');
}

function updateDecisionSectionVisibility() {
  if (refs.gatewayDecisionSection) {
    refs.gatewayDecisionSection.style.display = 'none';
  }

  if (refs.flowDecisionSection) {
    refs.flowDecisionSection.style.display = 'none';
  }
}

function updateApiEndpointPreview() {
  if (!refs.apiEndpointPreview) return;
  if (!shouldShowApiParamSection()) {
    setFieldValue(refs.apiEndpointPreview, '');
    return;
  }

  const processCode = String(seed.processCode || '').trim();
  const rawActivityName = refs.name && refs.name.value
    ? refs.name.value
    : (selected.element && selected.element.businessObject ? selected.element.businessObject.name || selected.element.id : 'atividade');
  const activitySlug = slugify(rawActivityName) || 'atividade';
  const origin = window.location && window.location.origin ? window.location.origin : '';
  const endpoint = `${origin}/api/public/processos/${encodeURIComponent(processCode)}/atividades/${encodeURIComponent(activitySlug)}/start`;
  setFieldValue(refs.apiEndpointPreview, endpoint);
}

function updateApiParamSectionVisibility() {
  if (!refs.apiParamsSection) return;
  const show = shouldShowApiParamSection();
  refs.apiParamsSection.style.display = show ? 'block' : 'none';
  updateApiEndpointPreview();
}

function updateAutomationSectionVisibility() {
  if (!refs.automationExternalSection) return;
  refs.automationExternalSection.style.display = shouldShowAutomationExternalSection() ? 'block' : 'none';
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
  setFieldValue(refs.apiParamCount, '0');
  renderApiParamInputs(0, []);
  setFieldValue(refs.apiEndpointPreview, '');
  setFieldValue(refs.responsible, '');
  setFieldValue(refs.responsibleId, '');
  setFieldValue(refs.sla, '');
  setFieldValue(refs.condition, '');
  setFieldValue(refs.decisionQuestion, '');
  setFieldValue(refs.decisionAnswerField, '__decisionAnswer');
  setFieldValue(refs.flowDecisionOutcome, '');
  refreshGatewayDefaultFlowOptions(null);
  setFieldValue(refs.formId, '');
  setFieldValue(refs.automationId, '');
  setFieldValue(refs.automationEndpoint, '');
  setFieldValue(refs.automationMethod, 'POST');
  setFieldValue(refs.automationPayloadMap, '');
  setFieldValue(refs.dbQuery, '');
  setFieldValue(refs.ecmPolicy, 'OWNER_ONLY');
  setFieldValue(refs.managerUsersInput, '');
  setManagerUsersSelection([]);
  hideManagerUsersSuggestions();
  updateResponsibleHintById('');
  updateApiParamSectionVisibility();
  updateAutomationSectionVisibility();
  updateDecisionSectionVisibility();
}

function syncPanelFromSelection() {
  const el = selected.element;
  if (!el || !el.businessObject) {
    resetPropsPanel();
    return;
  }

  const bo = el.businessObject;
  const store = getStoreForElement(el) || {};
  const inferredTaskType = bo.$type === 'bpmn:ServiceTask' ? 'SERVICE' : 'USER';

  setFieldValue(refs.selectedElementId, bo.id);
  setFieldValue(refs.name, bo.name || store.name || '');
  setFieldValue(refs.taskType, store.taskType || inferredTaskType);
  const apiParams = Array.isArray(store.apiParams)
    ? store.apiParams.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return String(item.name || '').trim();
        return '';
      })
    : [];
  const apiParamCount = sanitizeParamCount(store.apiParamCount || apiParams.length || 0);
  setFieldValue(refs.apiParamCount, String(apiParamCount));
  renderApiParamInputs(apiParamCount, apiParams);
  resolveResponsibleDisplay(store.responsible || '');
  setFieldValue(refs.sla, store.sla || '');
  setFieldValue(refs.condition, store.condition || '');
  setFieldValue(refs.decisionQuestion, store.decisionQuestion || bo.name || '');
  setFieldValue(refs.decisionAnswerField, store.decisionAnswerField || '__decisionAnswer');
  setFieldValue(refs.flowDecisionOutcome, normalizeDecisionOutcome(store.decisionOutcome));
  refreshGatewayDefaultFlowOptions(el, store.defaultFlow || (bo.default && bo.default.id ? bo.default.id : ''));
  setFieldValue(refs.formId, store.formId || '');
  setFieldValue(refs.automationId, store.automationId || '');
  setFieldValue(refs.automationEndpoint, store.automationEndpoint || '');
  setFieldValue(refs.automationMethod, store.automationMethod || 'POST');
  setFieldValue(refs.automationPayloadMap, formatAutomationPayloadMap(store.automationPayloadMap));
  setFieldValue(refs.dbQuery, store.dbQuery || '');
  setFieldValue(refs.ecmPolicy, store.ecmPolicy || 'OWNER_ONLY');
  setFieldValue(refs.managerUsersInput, '');
  resolveManagerUsersDisplay(store.managerUsers || []);
  updateApiParamSectionVisibility();
  updateAutomationSectionVisibility();
  updateDecisionSectionVisibility();
}

function applyPropertiesFromPanel() {
  if (readOnlyMode) {
    WorkflowUI.showToast('Este usuario esta em modo somente leitura no modelador', 'warning');
    return;
  }

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
  if (bo.$type === 'bpmn:SequenceFlow') {
    store.decisionOutcome = normalizeDecisionOutcome(refs.flowDecisionOutcome ? refs.flowDecisionOutcome.value : '');
  }
  store.formId = refs.formId && refs.formId.value ? Number(refs.formId.value) : null;
  store.automationId = refs.automationId && refs.automationId.value ? Number(refs.automationId.value) : null;
  store.automationEndpoint = refs.automationEndpoint ? refs.automationEndpoint.value.trim() : '';
  store.automationMethod = refs.automationMethod ? refs.automationMethod.value : 'POST';
  store.automationPayloadMap = parseAutomationPayloadMapInput(refs.automationPayloadMap ? refs.automationPayloadMap.value : '');
  store.dbQuery = refs.dbQuery ? refs.dbQuery.value.trim() : '';
  store.ecmPolicy = refs.ecmPolicy ? refs.ecmPolicy.value : 'OWNER_ONLY';
  const typedManager = refs.managerUsersInput ? refs.managerUsersInput.value.trim() : '';
  if (typedManager) {
    WorkflowUI.showToast('Selecione o gestor na lista de sugestoes por nome.', 'warning');
    return;
  }
  store.managerUsers = Array.isArray(selectedManagerUsers) ? [...selectedManagerUsers] : [];

  if (shouldShowApiParamSection()) {
    const apiParamCount = sanitizeParamCount(refs.apiParamCount ? refs.apiParamCount.value : 0);
    const apiParamValues = collectApiParamValuesFromInputs();
    const selectedNames = apiParamValues.slice(0, apiParamCount).map((value) => String(value || '').trim());

    if (apiParamCount > 0 && selectedNames.some((name) => !name)) {
      WorkflowUI.showToast('Preencha o nome de todos os parametros da API.', 'warning');
      return;
    }

    const seen = new Set();
    for (const name of selectedNames) {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        WorkflowUI.showToast('Nao repita nomes de parametros da API na mesma tarefa.', 'warning');
        return;
      }
      seen.add(key);
    }

    store.apiParamCount = apiParamCount;
    store.apiParams = selectedNames.map((name) => ({ name }));
  } else {
    store.apiParamCount = 0;
    store.apiParams = [];
  }

  if (shouldShowAutomationExternalSection() && !store.automationEndpoint && !store.automationId) {
    WorkflowUI.showToast('Informe o endpoint da automacao externa ou selecione uma automacao cadastrada.', 'warning');
    return;
  }

  if (bo.$type === 'bpmn:ExclusiveGateway') {
    const gwName = refs.name ? refs.name.value.trim() : '';
    if (!store.decisionQuestion) {
      store.decisionQuestion = gwName || bo.name || 'Decisao';
    }
    if (!store.decisionAnswerField) {
      store.decisionAnswerField = '__decisionAnswer';
    }
  }

  const name = refs.name ? refs.name.value.trim() : '';
  store.name = name;

  if (bo.$type === 'bpmn:SequenceFlow') {
    let flowLabel = '';
    if (store.condition) {
      flowLabel = store.condition;
    } else if (name) {
      flowLabel = name;
    } else if (store.decisionOutcome === 'SIM') {
      flowLabel = 'Sim';
    } else if (store.decisionOutcome === 'NAO') {
      flowLabel = 'Nao';
    }
    modeling.updateProperties(el, { name: flowLabel });
    modeling.updateLabel(el, flowLabel);
  } else {
    modeling.updateProperties(el, { name });
  }

  renderTypeOverlays();
  markDiagramChanged();
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

function applyEnterprisePreset(element, enterpriseKind) {
  if (!enterpriseKind || !element || !element.businessObject) return;
  const store = ensureItemStore(element.businessObject.id, false);

  if (enterpriseKind === 'ECM') {
    store.taskType = 'ECM';
    store.ecmPolicy = 'OWNER_ONLY';
  }

  if (enterpriseKind === 'DATABASE') {
    store.taskType = 'DB';
    store.dbQuery = store.dbQuery || 'SELECT TOP 1 1 AS ok';
  }

  if (enterpriseKind === 'MANAGER') {
    store.taskType = 'MANAGER';
    store.managerUsers = store.managerUsers || [];
  }

  if (enterpriseKind === 'AUTOMATION') {
    store.taskType = 'AUTOMATION';
    const automationIds = Object.keys(automationById || {});
    if (automationIds.length && !store.automationId) {
      store.automationId = Number(automationIds[0]);
    }
  }
}

function addElementFromTool(type, enterpriseKind = '') {
  if (readOnlyMode) {
    WorkflowUI.showToast('Modelador em modo somente leitura', 'warning');
    return;
  }

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
    _suppressGatewayModal = true;
    try {
      modeling.connect(selectedElement, newShape);
    } catch (_) {
    }
    _suppressGatewayModal = false;
  }

  selected.element = newShape;

  if (!enterpriseKind && type === 'bpmn:ServiceTask') {
    const store = ensureItemStore(newShape.id, false);
    if (!store.taskType) store.taskType = 'SERVICE';
  }

  applyEnterprisePreset(newShape, enterpriseKind);
  syncPanelFromSelection();
}

function duplicateElement(element) {
  if (readOnlyMode) return;
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
  if (readOnlyMode) return;
  const element = selected.element;
  if (!element || !element.businessObject) return;

  if (element.businessObject.$type === 'bpmn:SequenceFlow') {
    insertElementOnFlow(element, type);
    return;
  }

  const modeling = modeler.get('modeling');
  const newShape = modeling.createShape(createShapeByType(type), { x: element.x + 180, y: element.y + 10 }, element.parent);
  _suppressGatewayModal = true;
  try {
    modeling.connect(element, newShape);
  } catch (_) {
  }
  _suppressGatewayModal = false;
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
  if (readOnlyMode) return;
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

  _suppressGatewayModal = true;
  modeling.connect(flow.source, newShape);
  modeling.connect(newShape, flow.target);
  _suppressGatewayModal = false;

  selected.element = newShape;
  syncPanelFromSelection();
}

function handleContextAction(action) {
  if (readOnlyMode) {
    WorkflowUI.showToast('Acao indisponivel em modo somente leitura', 'warning');
    clearContextMenu();
    return;
  }

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

function getIconForType(type, hasForm, store) {
  if (store && store.taskType === 'ECM') return '<i class="bi bi-folder2-open"></i>';
  if (store && store.taskType === 'DB') return '<i class="bi bi-database"></i>';
  if (store && store.taskType === 'AUTOMATION') return '<i class="bi bi-robot"></i>';
  if (store && store.taskType === 'MANAGER') return '<i class="bi bi-person-badge"></i>';
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
    const icon = getIconForType(type, hasForm, store);
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

  if (refs.flowInsertMenu && refs.flowInsertMenu.style.display !== 'none') {
    refs.flowInsertMenu.style.left = `${left + 18}px`;
    refs.flowInsertMenu.style.top = `${top + 12}px`;
  }
}

function hideFlowInsertFab() {
  if (!refs.flowInsertFab) return;
  refs.flowInsertFab.style.display = 'none';
  hideFlowInsertMenu();
}

function toggleFlowInsertMenu() {
  if (!refs.flowInsertMenu || !refs.flowInsertFab) return;
  if (refs.flowInsertMenu.style.display === 'grid') {
    hideFlowInsertMenu();
    return;
  }

  const left = parseFloat(refs.flowInsertFab.style.left || '0') || 0;
  const top = parseFloat(refs.flowInsertFab.style.top || '0') || 0;
  refs.flowInsertMenu.style.left = `${left + 18}px`;
  refs.flowInsertMenu.style.top = `${top + 12}px`;
  refs.flowInsertMenu.style.display = 'grid';
}

function hideFlowInsertMenu() {
  if (!refs.flowInsertMenu) return;
  refs.flowInsertMenu.style.display = 'none';
}

function validateDiagram() {
  const elementRegistry = modeler.get('elementRegistry');
  const elements = [];
  elementRegistry.forEach((e) => {
    if (e && e.businessObject && !e.labelTarget) elements.push(e);
  });

  const startEvents = elements.filter((e) => e.businessObject.$type === 'bpmn:StartEvent');
  const endEvents = elements.filter((e) => e.businessObject.$type === 'bpmn:EndEvent');
  const errors = [];

  if (!startEvents.length) errors.push('O processo precisa ter ao menos um Evento inicial.');
  if (startEvents.length > 1) errors.push('Use apenas 1 Evento inicial para garantir inicio deterministico.');
  if (!endEvents.length) errors.push('O processo precisa ter ao menos um Evento final.');

  elements.forEach((element) => {
    const bo = element.businessObject;
    const type = bo.$type;

    if (type === 'bpmn:SequenceFlow') {
      if (!bo.sourceRef || !bo.targetRef) {
        errors.push(`Fluxo ${bo.id} esta sem origem ou destino.`);
      }
      return;
    }

    const incoming = Array.isArray(element.incoming) ? element.incoming : [];
    const outgoing = Array.isArray(element.outgoing) ? element.outgoing : [];
    const store = propsStore.elements[element.id] || {};
    const elementName = bo.name ? `${bo.name} (${bo.id})` : bo.id;

    if (type !== 'bpmn:StartEvent' && type !== 'bpmn:Process' && !incoming.length) {
      errors.push(`Elemento ${elementName} esta sem entrada.`);
    }

    if (type !== 'bpmn:EndEvent' && type !== 'bpmn:Process' && !outgoing.length) {
      errors.push(`Elemento ${elementName} esta sem saida.`);
    }

    if (type === 'bpmn:UserTask') {
      const taskType = String(store.taskType || 'USER').trim().toUpperCase();
      const managers = Array.isArray(store.managerUsers) ? store.managerUsers.filter(Boolean) : [];
      if (taskType === 'MANAGER' && !managers.length) {
        errors.push(`Atividade ${elementName} com tipo MANAGER exige ao menos um gestor.`);
      }
    }

    if (type === 'bpmn:ServiceTask') {
      const taskType = String(store.taskType || 'SERVICE').trim().toUpperCase();
      const endpoint = String(store.automationEndpoint || '').trim();
      const automationId = Number(store.automationId || 0) || 0;
      const query = String(store.dbQuery || '').trim().toUpperCase();

      if (taskType === 'AUTOMATION' && !endpoint && !automationId) {
        errors.push(`Atividade ${elementName} do tipo AUTOMATION precisa de endpoint ou automacao cadastrada.`);
      }

      if (taskType === 'DB') {
        if (!query) {
          errors.push(`Atividade ${elementName} do tipo DB precisa de consulta SQL.`);
        } else if (!(query.startsWith('SELECT') || query.startsWith('EXEC'))) {
          errors.push(`Atividade ${elementName} do tipo DB aceita apenas SELECT ou EXEC.`);
        }
      }
    }

    if (type === 'bpmn:ExclusiveGateway' && outgoing.length > 1) {
      const defaultFlowId = String(store.defaultFlow || '').trim();
      if (defaultFlowId && !outgoing.some((flow) => flow.businessObject && flow.businessObject.id === defaultFlowId)) {
        errors.push(`Gateway ${elementName} possui fluxo padrao invalido.`);
      }

      const outcomes = new Set();
      let hasConditionOrOutcome = false;

      outgoing.forEach((flowElement) => {
        const flowId = flowElement && flowElement.businessObject ? flowElement.businessObject.id : '';
        if (!flowId || flowId === defaultFlowId) return;

        const flowStore = propsStore.flows[flowId] || {};
        const condition = String(flowStore.condition || '').trim();
        const storedOutcome = normalizeDecisionOutcome(flowStore.decisionOutcome);
        const flowBoName = String((flowElement.businessObject && flowElement.businessObject.name) || '').trim();
        const flowStoreName = String(flowStore.name || '').trim();
        const flowName = flowBoName || flowStoreName;

        // Auto-detect outcome from flow name if not explicitly set
        let autoOutcome = '';
        if (!storedOutcome && flowName) {
          if (/^(sim|yes|s|y)$/i.test(flowName)) autoOutcome = 'SIM';
          else if (/^(n[aã]o|nao|no|n)$/i.test(flowName)) autoOutcome = 'NAO';
        }
        const effectiveOutcome = storedOutcome || autoOutcome;

        if (condition || effectiveOutcome || flowName) {
          hasConditionOrOutcome = true;
        }

        if (effectiveOutcome) {
          if (outcomes.has(effectiveOutcome)) {
            errors.push(`Gateway ${elementName} possui mapeamento duplicado para ${effectiveOutcome}.`);
          }
          outcomes.add(effectiveOutcome);
        }
      });

      if (!hasConditionOrOutcome && !defaultFlowId) {
        errors.push(`Gateway ${elementName} esta ambiguo. Conecte as setas e escolha Sim/Nao para cada uma.`);
      }

      if (outcomes.size === 1 && !defaultFlowId) {
        errors.push(`Gateway ${elementName} tem apenas um resultado mapeado. Configure tambem a outra seta como Sim ou Nao.`);
      }
    }
  });

  return errors;
}

async function saveVersion() {
  if (readOnlyMode) {
    WorkflowUI.showToast('Sem permissao para salvar versao neste processo', 'warning');
    return;
  }

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
        originHost: window.location && window.location.origin ? window.location.origin : '',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao salvar nova versao');
    }

    setDirtyState(false);
    clearLocalDraft();
    WorkflowUI.showToast(`Versao v${data.versao} salva e publicada com sucesso`, 'success');
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
  bindClick('btnCommandPalette', openCommandPalette);
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
    if (readOnlyMode) return;
    modeler.get('commandStack').undo();
  });

  bindClick('btnRedo', () => {
    if (readOnlyMode) return;
    modeler.get('commandStack').redo();
  });

  bindClick('btnAlign', () => {
    if (readOnlyMode) return;
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

function bindToolboxSearch() {
  if (!refs.toolboxSearchInput) return;
  refs.toolboxSearchInput.addEventListener('input', applyToolboxFilter);
  applyToolboxFilter();
}

function bindCommandPalette() {
  if (!refs.commandPalette || !refs.commandInput || !refs.commandList) return;

  refs.commandInput.addEventListener('input', () => {
    uiState.activeCommandIndex = 0;
    renderCommandPaletteItems();
  });

  refs.commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!uiState.commandItems.length) return;
      uiState.activeCommandIndex = (uiState.activeCommandIndex + 1) % uiState.commandItems.length;
      renderCommandPaletteItems();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!uiState.commandItems.length) return;
      uiState.activeCommandIndex = (uiState.activeCommandIndex - 1 + uiState.commandItems.length) % uiState.commandItems.length;
      renderCommandPaletteItems();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = uiState.commandItems[uiState.activeCommandIndex];
      if (!item || !item.enabled) return;
      executeCommandPaletteItem(item.id);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeCommandPalette();
    }
  });

  refs.commandPalette.addEventListener('click', (event) => {
    if (event.target === refs.commandPalette) {
      closeCommandPalette();
    }
  });
}

function deleteSelectedElement() {
  if (readOnlyMode) return;
  const element = selected.element;
  if (!element || !element.businessObject) return;
  modeler.get('modeling').removeElements([element]);
  selected.element = null;
  resetPropsPanel();
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (isEditableDomTarget(event.target)) return;

    const key = String(event.key || '').toLowerCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;

    if (ctrlOrMeta && key === 's') {
      event.preventDefault();
      if (!readOnlyMode) saveVersion();
      return;
    }

    if (ctrlOrMeta && key === 'k') {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (key === 'escape') {
      closeCommandPalette();
      hideFlowInsertMenu();
      if (connectMode.active) clearConnectMode(true);
      return;
    }

    if (readOnlyMode) return;

    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      deleteSelectedElement();
      return;
    }

    if (event.altKey && key === '1') {
      event.preventDefault();
      addElementFromTool('bpmn:UserTask');
      return;
    }

    if (event.altKey && key === '2') {
      event.preventDefault();
      addElementFromTool('bpmn:ServiceTask');
      return;
    }

    if (event.altKey && key === '3') {
      event.preventDefault();
      addElementFromTool('bpmn:ExclusiveGateway');
      return;
    }

    if (event.altKey && key === 'f') {
      event.preventDefault();
      activateConnectMode();
      return;
    }

    if (key === 'f') {
      event.preventDefault();
      modeler.get('canvas').zoom('fit-viewport');
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (!uiState.dirty || readOnlyMode) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function bindToolbox() {
  if (readOnlyMode) {
    document.querySelectorAll('.wf-toolbox-item').forEach((button) => {
      button.setAttribute('disabled', 'disabled');
      button.classList.add('wf-toolbox-item-disabled');
    });
    return;
  }

  document.querySelectorAll('.wf-toolbox-item').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.toolType;
      if (!type) return;
      addElementFromTool(type, button.dataset.enterpriseKind || '');
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
    toggleFlowInsertMenu();
  });

  if (refs.flowInsertMenu) {
    refs.flowInsertMenu.querySelectorAll('button[data-flow-insert-type]').forEach((button) => {
      button.addEventListener('click', () => {
        const element = selected.element;
        if (!element || !element.businessObject || element.businessObject.$type !== 'bpmn:SequenceFlow') return;

        const type = String(button.getAttribute('data-flow-insert-type') || '').trim();
        if (!type) return;
        insertElementOnFlow(element, type);
        hideFlowInsertMenu();
      });
    });
  }

  document.addEventListener('click', (event) => {
    if (!refs.flowInsertMenu || !refs.flowInsertFab) return;
    if (refs.flowInsertFab.contains(event.target)) return;
    if (refs.flowInsertMenu.contains(event.target)) return;
    hideFlowInsertMenu();
  });
}

function showGatewayOutcomeModal(connection) {
  if (readOnlyMode || !connection || !connection.businessObject) return;
  const flowId = connection.businessObject.id;
  const gatewayEl = connection.source;
  if (!gatewayEl || !gatewayEl.businessObject) return;

  if (_suppressGatewayModal) return;

  const flowStore = ensureItemStore(flowId, true);
  if (flowStore.decisionOutcome === 'SIM' || flowStore.decisionOutcome === 'NAO') return;

  const flowBoName = (connection.businessObject && connection.businessObject.name) || '';
  if (/^(sim|n[aã]o|nao|yes|no)$/i.test(flowBoName.trim())) return;

  const existingSim = Array.isArray(gatewayEl.outgoing) && gatewayEl.outgoing.some((f) => {
    if (!f || !f.businessObject) return false;
    return (propsStore.flows[f.businessObject.id] || {}).decisionOutcome === 'SIM';
  });
  const existingNao = Array.isArray(gatewayEl.outgoing) && gatewayEl.outgoing.some((f) => {
    if (!f || !f.businessObject) return false;
    return (propsStore.flows[f.businessObject.id] || {}).decisionOutcome === 'NAO';
  });

  if (existingSim && existingNao) return;

  let overlay = document.getElementById('wf-gateway-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'wf-gateway-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center';
    document.body.appendChild(overlay);
  }

  const gatewayName = (gatewayEl.businessObject.name || 'Decisao').replace(/</g, '&lt;');
  const targetName = (connection.target && connection.target.businessObject && connection.target.businessObject.name
    ? connection.target.businessObject.name : '').replace(/</g, '&lt;');

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:30px 36px;min-width:300px;max-width:400px;box-shadow:0 8px 40px rgba(0,0,0,.22);text-align:center">
      <div style="font-size:1.05rem;font-weight:700;color:#202124;margin-bottom:6px">Resultado desta seta</div>
      <div style="font-size:.88rem;color:#5f6368;margin-bottom:22px;line-height:1.5">
        Gateway: <strong>${gatewayName}</strong>${targetName ? `<br>Destino: <strong>${targetName}</strong>` : ''}<br>
        Qual o resultado desta decisao?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${!existingSim ? '<button id="wf-gw-sim" class="wf-btn-primary" style="min-width:90px">Sim</button>' : ''}
        ${!existingNao ? '<button id="wf-gw-nao" style="min-width:90px;padding:8px 18px;border-radius:6px;border:1px solid #dadce0;background:#fff;color:#202124;font-size:.9rem;cursor:pointer;font-weight:500">Nao</button>' : ''}
      </div>
    </div>`;

  overlay.style.display = 'flex';

  const modeling = modeler.get('modeling');

  function applyOutcome(outcome) {
    flowStore.decisionOutcome = outcome;
    const label = outcome === 'SIM' ? 'Sim' : 'Nao';
    flowStore.name = label;
    setTimeout(() => {
      try {
        modeling.updateProperties(connection, { name: label });
        modeling.updateLabel(connection, label);
      } catch (_) {}
    }, 0);

    const gwStore = ensureItemStore(gatewayEl.businessObject.id, false);
    if (!gwStore.decisionQuestion) gwStore.decisionQuestion = gatewayEl.businessObject.name || 'Decisao';
    if (!gwStore.decisionAnswerField) gwStore.decisionAnswerField = '__decisionAnswer';

    overlay.style.display = 'none';
    markDiagramChanged();
    WorkflowUI.showToast(`Seta marcada como: ${label}`, 'success');
  }

  const simBtn = document.getElementById('wf-gw-sim');
  const naoBtn = document.getElementById('wf-gw-nao');
  if (simBtn) simBtn.addEventListener('click', () => applyOutcome('SIM'));
  if (naoBtn) naoBtn.addEventListener('click', () => applyOutcome('NAO'));
}

function bindModelerEvents() {
  const directEditing = modeler.get('directEditing');

  modeler.on('commandStack.connection.create.postExecuted', (event) => {
    if (readOnlyMode || uiState.ignoreCommandStack) return;
    const context = event.context;
    if (!context || !context.connection) return;
    const source = context.connection.source;
    if (!source || !source.businessObject || source.businessObject.$type !== 'bpmn:ExclusiveGateway') return;
    showGatewayOutcomeModal(context.connection);
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

  modeler.on('commandStack.changed', () => {
    if (uiState.ignoreCommandStack) return;
    markDiagramChanged();
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
    if (event.element.businessObject && event.element.businessObject.$type === 'bpmn:SequenceFlow') {
      selected.element = event.element;
      syncPanelFromSelection();
      if (refs.condition) refs.condition.focus();
      return;
    }
    directEditing.activate(event.element);
  });
}

function bindPropertyActions() {
  if (!refs.applyProps) return;
  refs.applyProps.addEventListener('click', applyPropertiesFromPanel);

  if (refs.propsForm) {
    refs.propsForm.addEventListener('keydown', (event) => {
      if (!event.ctrlKey || String(event.key || '').toLowerCase() !== 'enter') return;
      event.preventDefault();
      applyPropertiesFromPanel();
    });
  }

  if (refs.taskType) {
    refs.taskType.addEventListener('change', () => {
      updateApiParamSectionVisibility();
      updateAutomationSectionVisibility();
      if (!shouldShowApiParamSection()) return;
      const keepValues = collectApiParamValuesFromInputs();
      renderApiParamInputs(refs.apiParamCount ? refs.apiParamCount.value : 0, keepValues);
    });
  }

  if (refs.name) {
    refs.name.addEventListener('input', updateApiEndpointPreview);
  }

  if (refs.apiParamCount) {
    refs.apiParamCount.addEventListener('input', () => {
      const currentValues = collectApiParamValuesFromInputs();
      const safeCount = sanitizeParamCount(refs.apiParamCount.value);
      setFieldValue(refs.apiParamCount, String(safeCount));
      renderApiParamInputs(safeCount, currentValues);
    });
  }
}

async function bootstrap() {
  const xml = seed.bpmnXml || defaultXml;
  uiState.ignoreCommandStack = true;
  await modeler.importXML(xml);
  uiState.ignoreCommandStack = false;
  modeler.get('canvas').zoom('fit-viewport');
  resetPropsPanel();
  setDirtyState(false);

  if (readOnlyMode) {
    WorkflowUI.showToast('Modelador aberto em modo somente leitura', 'info');
  }

  bindToolbarButtons();
  bindToolbox();
  bindToolboxSearch();
  bindCommandPalette();
  bindContextMenuActions();
  bindFlowInsertFab();
  bindModelerEvents();
  bindPropertyActions();
  bindKeyboardShortcuts();
  bindResponsibleLookup();
  bindManagerUsersLookup();
  renderTypeOverlays();

  await tryRestoreLocalDraft();
}

bootstrap().catch((error) => {
  console.error(error);
  WorkflowUI.showToast('Erro ao carregar modelador BPMN', 'error');
});

