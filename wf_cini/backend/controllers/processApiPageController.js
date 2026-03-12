const processApiCatalogService = require('../services/processApiCatalogService');
const { getCurrentUser } = require('../utils/requestUser');

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || '';
  if (!host) return '';
  return `${protocol}://${host}`;
}

async function index(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const apis = await processApiCatalogService.listActivityApisForUser({
      user: currentUser,
      originHost: getRequestOrigin(req),
    });

    return res.render('apis/processos', {
      pageTitle: 'APIs dos Processos',
      pageDescription: 'Catalogo de endpoints gerados no modelador por atividade de servico/API',
      apis,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
