const taskService = require('../services/taskService');

async function index(req, res, next) {
  try {
    const username = (req.session && req.session.username) || (req.cookies && req.cookies.username) || null;

    const result = await taskService.listKanbanTasks({
      user: username,
      status: req.query.status || null,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
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
        processoId: req.query.processoId || '',
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
    const payload = await taskService.getTaskDetails(taskId);

    return res.render('tarefas/show', {
      pageTitle: `Tarefa #${taskId}`,
      pageDescription: payload.task.nome_etapa,
      payload,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  index,
  detalhes,
};
