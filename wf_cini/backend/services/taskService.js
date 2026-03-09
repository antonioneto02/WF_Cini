const taskRepository = require('../repositories/taskRepository');
const historyRepository = require('../repositories/historyRepository');
const formRepository = require('../repositories/formRepository');
const protheusUserRepository = require('../repositories/protheusUserRepository');

function normalizeIdentifier(value) {
  return String(value || '').trim().toUpperCase();
}

async function resolveUserTaskKeys(user) {
  const baseKey = normalizeIdentifier(user);
  if (!baseKey) return [];

  const keySet = new Set([baseKey]);

  try {
    const mapped = await protheusUserRepository.findUserByIdentifier(baseKey);
    if (mapped) {
      const mappedId = normalizeIdentifier(mapped.id);
      const mappedCode = normalizeIdentifier(mapped.codigo);
      if (mappedId) keySet.add(mappedId);
      if (mappedCode) keySet.add(mappedCode);
    }
  } catch (_) {
    // If Protheus lookup fails, keep filtering by current login only.
  }

  return Array.from(keySet);
}

async function listKanbanTasks(query) {
  const safeQuery = query || {};
  const userKeys = await resolveUserTaskKeys(safeQuery.user);
  return taskRepository.listKanbanTasks({
    ...safeQuery,
    userKeys,
  });
}

function splitByKanbanStatus(tasks) {
  const colunas = {
    MINHAS_TAREFAS: [],
    EM_ANDAMENTO: [],
    CONCLUIDA: [],
  };

  tasks.forEach((task) => {
    if (colunas[task.status]) colunas[task.status].push(task);
  });

  return colunas;
}

async function getTaskDetails(taskId) {
  const task = await taskRepository.getTaskById(taskId);
  if (!task) throw new Error('Tarefa nao encontrada');

  const history = await historyRepository.listHistoryByInstance(task.instancia_processo_id);

  let form = null;
  let responses = [];

  if (task.form_config_json) {
    try {
      const cfg = JSON.parse(task.form_config_json);
      if (cfg.formId) {
        form = await formRepository.getFormById(cfg.formId);
      }
    } catch (_) {}
  }

  responses = await formRepository.listResponsesByInstance(task.instancia_processo_id);

  return {
    task,
    history,
    form,
    responses,
  };
}

async function moveTask(taskId, status) {
  await taskRepository.updateTaskStatus(taskId, status);
}

async function saveTaskDraft({ taskId, observacao, response, user }) {
  const task = await taskRepository.getTaskById(taskId);
  if (!task) throw new Error('Tarefa nao encontrada');

  await taskRepository.saveTaskDraft({
    taskId,
    observacao: observacao || null,
    responseJson: JSON.stringify(response || {}),
    user: user || 'sistema',
  });

  return taskRepository.getTaskById(taskId);
}

module.exports = {
  listKanbanTasks,
  splitByKanbanStatus,
  getTaskDetails,
  moveTask,
  saveTaskDraft,
};
