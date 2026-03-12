const { getCurrentUser, isDevUser } = require('../utils/requestUser');

function requireDevUser(req, res, next) {
  const current = getCurrentUser(req);
  if (!isDevUser(current)) {
    const requestPath = `${req.baseUrl || ''}${req.path || ''}`;
    const isApiRequest = requestPath.startsWith('/api/') || String(req.originalUrl || '').startsWith('/api/');
    if (isApiRequest) {
      return res.status(403).json({ ok: false, message: 'Area dev restrita ao usuario 000460' });
    }

    return res.status(403).render('erpShell', {
      pageTitle: 'Acesso negado',
      pageDescription: 'Area dev restrita ao usuario 000460',
      user: res.locals.user,
    });
  }

  return next();
}

module.exports = {
  requireDevUser,
};
