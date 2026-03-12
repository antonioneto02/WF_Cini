const processService = require('../services/processService');
const taskService = require('../services/taskService');
const instanceRepository = require('../repositories/instanceRepository');
const formService = require('../services/formService');
const automationService = require('../services/automationService');
const accessService = require('../services/accessService');
const dashboardPersonalizationService = require('../services/dashboardPersonalizationService');
const notificationService = require('../services/notificationService');
const commentService = require('../services/commentService');
const { getCurrentUser } = require('../utils/requestUser');

async function index(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);

    const [processes, tasks, instances, forms, automations, activeAutomations, personalization, notifications, slaAlerts, collaborationFeed] = await Promise.all([
      processService.listProcesses({ page: 1, pageSize: 500, user: currentUser }),
      taskService.listKanbanTasks({ page: 1, pageSize: 200, user: currentUser }),
      instanceRepository.listInstances({ page: 1, pageSize: 200 }),
      formService.listForms({ page: 1, pageSize: 1 }),
      automationService.listAutomations({ page: 1, pageSize: 6, onlyActive: false }),
      automationService.listAutomations({ page: 1, pageSize: 1, onlyActive: true }),
      dashboardPersonalizationService.getPreferencesForUser(currentUser),
      notificationService.listNotifications({ user: currentUser, page: 1, pageSize: 8 }),
      notificationService.listSlaAlertsForDashboard(currentUser, 8),
      commentService.listRecentCollaborationFeed(currentUser, 8),
    ]);

    const groupedTasks = taskService.splitByKanbanStatus(tasks.data || []);

    const visibleInstances = [];
    for (const item of instances.data || []) {
      // eslint-disable-next-line no-await-in-loop
      const canView = await accessService.canUser(item.processo_id, currentUser, 'view');
      if (canView) visibleInstances.push(item);
    }

    const instanceOpenCount = visibleInstances.filter((item) => String(item.status || '').toUpperCase() !== 'CONCLUIDA').length;
    const instanceDoneCount = visibleInstances.filter((item) => String(item.status || '').toUpperCase() === 'CONCLUIDA').length;

    return res.render('dashboard/index', {
      pageTitle: 'Dashboard BPM',
      pageDescription: 'Visao executiva do workflow com operacao, filas e configuracoes',
      stats: {
        processos: (processes.data || []).length,
        tarefasPendentes: (groupedTasks.MINHAS_TAREFAS || []).length,
        tarefasAndamento: (groupedTasks.EM_ANDAMENTO || []).length,
        tarefasConcluidas: (groupedTasks.CONCLUIDA || []).length,
        solicitacoesAbertas: instanceOpenCount,
        solicitacoesConcluidas: instanceDoneCount,
        automacoesAtivas: activeAutomations.total || 0,
        formularios: forms.total || 0,
      },
      highlights: {
        processos: (processes.data || []).slice(0, 6),
        tarefas: (tasks.data || []).slice(0, 6),
        solicitacoes: visibleInstances.slice(0, 6),
        automacoes: (automations.data || []).slice(0, 6),
      },
      personalization,
      notifications: notifications.data || [],
      notificationUnread: notifications.unread || 0,
      slaAlerts,
      collaborationFeed,
      currentUser,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  index,
};
