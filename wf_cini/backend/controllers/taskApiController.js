const taskService = require('../services/taskService');
const bpmEngineService = require('../services/bpmEngineService');
const { getCurrentUser } = require('../utils/requestUser');

async function list(req, res, next) {
  try {
    const result = await taskService.listKanbanTasks({
      user: getCurrentUser(req),
      status: req.query.status || null,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
      responsavel: req.query.responsavel || null,
      search: req.query.search || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 12,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const status = req.body.status;
    const user = getCurrentUser(req);
    const canHandle = await taskService.canUserHandleTask(taskId, user);
    if (!canHandle) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para alterar esta tarefa' });
    }

    await taskService.moveTask(taskId, status);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function complete(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const user = getCurrentUser(req);
    const canHandle = await taskService.canUserHandleTask(taskId, user);
    if (!canHandle) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para concluir esta tarefa' });
    }

    const updatedTask = await bpmEngineService.completeUserTask({
      taskId,
      action: req.body.action || 'aprovar',
      observacao: req.body.observacao || null,
      response: req.body.response || {},
      user,
    });

    return res.json(updatedTask);
  } catch (err) {
    return next(err);
  }
}

async function saveDraft(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const user = getCurrentUser(req);
    const canHandle = await taskService.canUserHandleTask(taskId, user);
    if (!canHandle) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para editar rascunho desta tarefa' });
    }

    const updatedTask = await taskService.saveTaskDraft({
      taskId,
      observacao: req.body.observacao || null,
      response: req.body.response || {},
      user,
    });
    return res.json(updatedTask);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  updateStatus,
  complete,
  saveDraft,
};
