const express = require('express');

const integrationApiController = require('../controllers/integrationApiController');

function createPublicApiRoutes() {
  const router = express.Router();

  router.post('/processos/:codigo/atividades/:atividade/start', integrationApiController.publicStart);
  router.post('/processos/:codigo/start', integrationApiController.publicStart);

  return router;
}

module.exports = {
  createPublicApiRoutes,
};
