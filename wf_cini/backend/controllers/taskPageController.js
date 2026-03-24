const taskService = require('../services/taskService');
const commentService = require('../services/commentService');
const { getCurrentUser } = require('../utils/requestUser');

async function index(req, res, next) {
  try {
    const username = (req.session && req.session.username) || (req.cookies && req.cookies.username) || null;

    const result = await taskService.listKanbanTasks({
      user: username,
      status: req.query.status || null,
      processName: req.query.processName || null,
      instanciaId: req.query.instanciaId ? Number(req.query.instanciaId) : null,
      identificador: req.query.identificador || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      responsavel: req.query.responsavel || null,
      search: req.query.search || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 30,
    });

    return res.render('tarefas/index', {
      pageTitle: 'Minhas Tarefas',
      pageDescription: 'Inbox de tarefas pendentes e em andamento',
      result,
      grouped: taskService.splitByKanbanStatus(result.data),
      filters: {
        status: req.query.status || '',
        processName: req.query.processName || '',
        instanciaId: req.query.instanciaId || '',
        identificador: req.query.identificador || '',
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || '',
        responsavel: req.query.responsavel || '',
        search: req.query.search || '',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function detalhes(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canHandle = await taskService.canUserHandleTask(taskId, currentUser);
    if (!canHandle) {
      return res.status(403).render('System/forbidden', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para abrir esta tarefa',
        user: res.locals.user,
      });
    }

    const payload = await taskService.getTaskDetails(taskId);
    const comments = await commentService.listComments({
      user: currentUser,
      tarefaId: taskId,
      instanciaId: payload.task.instancia_processo_id,
      limit: 120,
    });

    return res.render('tarefas/show', {
      pageTitle: `Tarefa #${taskId}`,
      pageDescription: payload.task.nome_etapa,
      payload,
      comments,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  index,
  detalhes,
};
