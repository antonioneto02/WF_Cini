function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Erro interno';

  const isApi = String(req.originalUrl || req.url || '').startsWith('/api/') || String(req.path || '').startsWith('/api/');
  if (isApi) {
    return res.status(status).json({
      ok: false,
      message,
    });
  }

  const viewData = {
    pageTitle: status === 403 ? 'Acesso negado' : status === 404 ? 'Página não encontrada' : 'Erro interno do sistema',
    pageDescription: message,
    error: err,
    user: res.locals && res.locals.user ? res.locals.user : null,
  };

  if (status === 403) return res.status(403).render('System/forbidden', viewData);
  if (status === 404) return res.status(404).render('System/error404', viewData);
  if (status >= 500) return res.status(500).render('System/error500', viewData);

  return res.status(status).render('System/error', viewData);
}

module.exports = {
  apiErrorHandler,
};
