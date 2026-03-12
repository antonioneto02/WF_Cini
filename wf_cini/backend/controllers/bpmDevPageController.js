const processApiCatalogService = require('../services/processApiCatalogService');

async function index(req, res, next) {
  try {
    const configs = await processApiCatalogService.listAllConfigs();

    return res.render('bpm/dev-apis', {
      pageTitle: 'Modo Dev - APIs de Processos',
      pageDescription: 'Catalogo tecnico de endpoints por processo e integrações',
      configs,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
