function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.statusCode || 400;
  const message = err.message || 'Erro interno';

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      ok: false,
      message,
    });
  }

  return next(err);
}

module.exports = {
  apiErrorHandler,
};
