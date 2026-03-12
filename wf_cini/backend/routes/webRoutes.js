const express = require('express');

const processPageController = require('../controllers/processPageController');
const taskPageController = require('../controllers/taskPageController');
const formPageController = require('../controllers/formPageController');
const solicitacaoPageController = require('../controllers/solicitacaoPageController');
const automationPageController = require('../controllers/automationPageController');
const bpmDevPageController = require('../controllers/bpmDevPageController');
const processApiPageController = require('../controllers/processApiPageController');
const adminMaintenancePageController = require('../controllers/adminMaintenancePageController');
const { requireDevUser } = require('../middlewares/requireDevUser');

function createWebRoutes(authMiddleware) {
  const router = express.Router();

  router.use(authMiddleware);

  router.get('/dashboard', (req, res) => res.redirect('/processos'));

  router.get('/processos', processPageController.index);
  router.get('/processos/meus', processPageController.meus);
  router.get('/processos/novo', processPageController.novo);
  router.get('/processos/:id', processPageController.detalhes);
  router.get('/processos/:id/editar', processPageController.editar);
  router.get('/processos/:id/historico', processPageController.historico);
  router.get('/processos/:id/instancias', processPageController.instancias);
  router.get('/processos/:id/iniciar', processPageController.iniciar);
  router.get('/processos/:id/modelar', processPageController.modelar);
  router.get('/processos/:id/publicar', processPageController.publicar);

  router.get('/tarefas', taskPageController.index);
  router.get('/tarefas/:id', taskPageController.detalhes);

  router.get('/formularios/construtor', formPageController.builder);

  router.get('/solicitacoes', solicitacaoPageController.index);
  router.get('/solicitacoes/:id', solicitacaoPageController.detalhes);
  router.get('/automacoes', automationPageController.index);
  router.get('/apis/processos', processApiPageController.index);
  router.get('/admin/limpeza-total', adminMaintenancePageController.index);
  router.get('/modelador', (req, res) => res.redirect('/processos'));
  router.get('/bpm/admin', (req, res) => res.redirect('/dashboard'));
  router.get('/bpm/dev/apis', requireDevUser, bpmDevPageController.index);

  return router;
}

module.exports = {
  createWebRoutes,
};
