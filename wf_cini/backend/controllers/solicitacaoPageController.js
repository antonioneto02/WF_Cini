const instanceRepository = require('../repositories/instanceRepository');

async function index(req, res, next) {
  try {
    const result = await instanceRepository.listInstances({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 40,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
      status: req.query.status || null,
    });

    return res.render('solicitacoes/index', {
      pageTitle: 'Solicitacoes',
      pageDescription: 'Acompanhe as instancias iniciadas',
      result,
      filters: {
        processoId: req.query.processoId || '',
        status: req.query.status || '',
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  index,
};
