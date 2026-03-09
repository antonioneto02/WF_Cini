const formService = require('../services/formService');

async function builder(req, res, next) {
  try {
    const processoId = req.query.processoId ? Number(req.query.processoId) : null;
    const forms = await formService.listForms({ processId: processoId, page: 1, pageSize: 100 });

    return res.render('formularios/builder', {
      pageTitle: 'Construtor de Formularios',
      pageDescription: 'Defina campos dinamicos para tarefas humanas',
      forms: forms.data,
      processoId,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  builder,
};
