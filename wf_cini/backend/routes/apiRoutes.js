const express = require('express');

const processApiController = require('../controllers/processApiController');
const taskApiController = require('../controllers/taskApiController');
const instanceApiController = require('../controllers/instanceApiController');
const formApiController = require('../controllers/formApiController');
const protheusApiController = require('../controllers/protheusApiController');
const automationApiController = require('../controllers/automationApiController');
const integrationApiController = require('../controllers/integrationApiController');
const ecmApiController = require('../controllers/ecmApiController');
const dashboardPreferenceApiController = require('../controllers/dashboardPreferenceApiController');
const notificationApiController = require('../controllers/notificationApiController');
const commentApiController = require('../controllers/commentApiController');
const adminMaintenanceApiController = require('../controllers/adminMaintenanceApiController');

function createApiRoutes(authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware);

  router.get('/processos', processApiController.list);
  router.post('/processos', processApiController.create);
  router.patch('/processos/:id', processApiController.update);
  router.delete('/processos/:id', processApiController.remove);
  router.post('/processos/:id/versoes', processApiController.saveVersion);
  router.post('/processos/:id/publicar', processApiController.publish);
  router.get('/processos/:processoId/api-config', integrationApiController.getProcessApiConfig);
  router.patch('/processos/:processoId/api-config', integrationApiController.updateProcessApiConfig);
  router.post('/processos/:processoId/api-config/rotate-key', integrationApiController.rotateProcessApiKey);

  router.get('/tarefas', taskApiController.list);
  router.patch('/tarefas/:id/status', taskApiController.updateStatus);
  router.post('/tarefas/:id/rascunho', taskApiController.saveDraft);
  router.post('/tarefas/:id/concluir', taskApiController.complete);

  router.get('/instancias', instanceApiController.list);
  router.post('/instancias', instanceApiController.start);

  router.post('/integracoes/protheus/start', integrationApiController.startByProtheus);
  router.post('/integracoes/mysql/start', integrationApiController.startByMysql);

  router.get('/protheus/usuarios', protheusApiController.searchUsers);

  router.get('/formularios', formApiController.list);
  router.post('/formularios', formApiController.create);
  router.patch('/formularios/:id', formApiController.update);
  router.delete('/formularios/:id', formApiController.remove);

  router.get('/automacoes', automationApiController.list);
  router.post('/automacoes', automationApiController.create);
  router.patch('/automacoes/:id', automationApiController.update);
  router.delete('/automacoes/:id', automationApiController.remove);
  router.post('/automacoes/:id/invoke', automationApiController.invoke);

  router.get('/ecm/processos/:processoId/arquivos', ecmApiController.listByProcess);
  router.post('/ecm/processos/:processoId/arquivos', ecmApiController.upload);
  router.get('/ecm/arquivos/:id/download', ecmApiController.download);

  router.get('/dashboard/preferencias', dashboardPreferenceApiController.getPreferences);
  router.put('/dashboard/preferencias', dashboardPreferenceApiController.savePreferences);

  router.get('/notificacoes', notificationApiController.list);
  router.patch('/notificacoes/:id/read', notificationApiController.markRead);
  router.patch('/notificacoes/read-all', notificationApiController.markAllRead);

  router.get('/comentarios', commentApiController.list);
  router.post('/comentarios', commentApiController.create);

  router.post('/admin/limpeza-total', adminMaintenanceApiController.purgeAllWorkflowData);

  return router;
}

module.exports = {
  createApiRoutes,
};
