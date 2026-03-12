const instanceRepository = require('../repositories/instanceRepository');
const historyRepository = require('../repositories/historyRepository');
const taskRepository = require('../repositories/taskRepository');
const processRepository = require('../repositories/processRepository');
const commentService = require('../services/commentService');
const accessService = require('../services/accessService');
const workflowLabelService = require('../services/workflowLabelService');
const { getCurrentUser } = require('../utils/requestUser');

async function index(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const result = await instanceRepository.listInstances({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 40,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
      status: req.query.status || null,
    });

    const visibleItems = [];
    for (const item of result.data) {
      // eslint-disable-next-line no-await-in-loop
      const canView = await accessService.canUser(item.processo_id, currentUser, 'view');
      if (canView) visibleItems.push(item);
    }

    const enrichedItems = await workflowLabelService.enrichInstancesWithFriendlyNames(visibleItems);

    const filteredResult = {
      ...result,
      data: enrichedItems,
      total: enrichedItems.length,
    };

    return res.render('solicitacoes/index', {
      pageTitle: 'Solicitacoes',
      pageDescription: 'Acompanhe as instancias iniciadas',
      result: filteredResult,
      filters: {
        processoId: req.query.processoId || '',
        status: req.query.status || '',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function detalhes(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const instanceId = Number(req.params.id);
    const instance = await instanceRepository.getInstanceById(instanceId);
    if (!instance) {
      return res.status(404).render('solicitacoes/index', {
        pageTitle: 'Solicitacoes',
        pageDescription: 'Solicitacao nao encontrada',
        result: { data: [], total: 0 },
        filters: { processoId: '', status: '' },
      });
    }

    const canView = await accessService.canUser(instance.processo_id, currentUser, 'view');
    if (!canView) {
      return res.status(403).render('solicitacoes/index', {
        pageTitle: 'Solicitacoes',
        pageDescription: 'Sem permissao para visualizar esta solicitacao',
        result: { data: [], total: 0 },
        filters: { processoId: '', status: '' },
      });
    }

    const process = await processRepository.getProcessById(instance.processo_id);
    const history = await historyRepository.listHistoryByInstance(instanceId);
    const tasks = await taskRepository.listTasksByInstance(instanceId);
    const comments = await commentService.listComments({
      user: currentUser,
      instanciaId: instanceId,
      limit: 120,
    });

    return res.render('solicitacoes/show', {
      pageTitle: 'Solicitacao #' + instanceId,
      pageDescription: '',
      instance,
      process,
      history,
      tasks,
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
