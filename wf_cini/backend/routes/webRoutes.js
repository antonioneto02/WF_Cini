const express = require('express');

const processPageController = require('../controllers/processPageController');
const taskPageController = require('../controllers/taskPageController');
const formPageController = require('../controllers/formPageController');
const solicitacaoPageController = require('../controllers/solicitacaoPageController');
const bpmAdminPageController = require('../controllers/bpmAdminPageController');

function createWebRoutes(authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware);

  router.get('/processos', processPageController.index);
  router.get('/processos/novo', processPageController.novo);
  router.get('/processos/:id', processPageController.detalhes);
  router.get('/processos/:id/editar', processPageController.editar);
  router.get('/processos/:id/historico', processPageController.historico);
  router.get('/processos/:id/iniciar', processPageController.iniciar);
  router.get('/processos/:id/modelar', processPageController.modelar);
  router.get('/processos/:id/publicar', processPageController.publicar);

  router.get('/tarefas', taskPageController.index);
  router.get('/tarefas/:id', taskPageController.detalhes);

  router.get('/formularios/construtor', formPageController.builder);

  router.get('/solicitacoes', solicitacaoPageController.index);
  router.get('/modelador', (req, res) => res.redirect('/processos'));
  router.get('/bpm/admin', bpmAdminPageController.index);

  return router;
}

module.exports = {
  createWebRoutes,
};
