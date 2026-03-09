const path = require('path');
const express = require('express');

const { createEnsureAuthBridge } = require('./middlewares/ensureAuthBridge');
const { apiErrorHandler } = require('./middlewares/apiErrorHandler');
const { createWebRoutes } = require('./routes/webRoutes');
const { createApiRoutes } = require('./routes/apiRoutes');

function registerBpmModule(app, dependencies = {}) {
  if (!app) throw new Error('Express app e obrigatorio');
  if (!dependencies.ensureAuth) throw new Error('ensureAuth e obrigatorio para o BPM');

  const authMiddleware = createEnsureAuthBridge(dependencies.ensureAuth);

  app.use('/workflow-assets', express.static(path.join(__dirname, '..', 'frontend', 'public')));

  app.use(createWebRoutes(authMiddleware));
  app.use('/api', createApiRoutes(authMiddleware));

  app.use(apiErrorHandler);
}

module.exports = {
  registerBpmModule,
};
