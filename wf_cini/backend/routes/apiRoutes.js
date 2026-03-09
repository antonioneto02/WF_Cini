const express = require('express');

const processApiController = require('../controllers/processApiController');
const taskApiController = require('../controllers/taskApiController');
const instanceApiController = require('../controllers/instanceApiController');
const formApiController = require('../controllers/formApiController');
const protheusApiController = require('../controllers/protheusApiController');

function createApiRoutes(authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware);

  router.get('/processos', processApiController.list);
  router.post('/processos', processApiController.create);
  router.patch('/processos/:id', processApiController.update);
  router.delete('/processos/:id', processApiController.remove);
  router.post('/processos/:id/versoes', processApiController.saveVersion);
  router.post('/processos/:id/publicar', processApiController.publish);

  router.get('/tarefas', taskApiController.list);
  router.patch('/tarefas/:id/status', taskApiController.updateStatus);
  router.post('/tarefas/:id/rascunho', taskApiController.saveDraft);
  router.post('/tarefas/:id/concluir', taskApiController.complete);

  router.get('/instancias', instanceApiController.list);
  router.post('/instancias', instanceApiController.start);

  router.get('/protheus/usuarios', protheusApiController.searchUsers);

  router.get('/formularios', formApiController.list);
  router.post('/formularios', formApiController.create);
  router.patch('/formularios/:id', formApiController.update);
  router.delete('/formularios/:id', formApiController.remove);

  return router;
}

module.exports = {
  createApiRoutes,
};
