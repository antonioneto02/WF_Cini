const automationService = require('../services/automationService');

async function index(req, res, next) {
  try {
    const result = await automationService.listAutomations({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 100,
      search: req.query.search || '',
    });

    return res.render('automacoes/index', {
      pageTitle: 'Automacoes Externas',
      pageDescription: 'Catalogo central para integrações e robos reutilizaveis',
      result,
      filters: {
        search: req.query.search || '',
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
