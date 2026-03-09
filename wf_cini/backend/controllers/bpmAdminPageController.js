const processService = require('../services/processService');
const taskService = require('../services/taskService');
const instanceRepository = require('../repositories/instanceRepository');
const formService = require('../services/formService');

async function index(req, res, next) {
  try {
    const [processes, tasks, instances, forms] = await Promise.all([
      processService.listProcesses({ page: 1, pageSize: 1 }),
      taskService.listKanbanTasks({ page: 1, pageSize: 1 }),
      instanceRepository.listInstances({ page: 1, pageSize: 1 }),
      formService.listForms({ page: 1, pageSize: 1 }),
    ]);

    return res.render('bpm/admin', {
      pageTitle: 'Administracao BPM',
      pageDescription: 'Visao geral de configuracoes e volume do modulo BPM',
      stats: {
        processos: processes.total || 0,
        tarefas: tasks.total || 0,
        solicitacoes: instances.total || 0,
        formularios: forms.total || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  index,
};
