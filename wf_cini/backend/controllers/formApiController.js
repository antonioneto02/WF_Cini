const formService = require('../services/formService');

function currentUser(req) {
  return (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'sistema';
}

async function list(req, res, next) {
  try {
    const result = await formService.listForms({
      processId: req.query.processoId ? Number(req.query.processoId) : null,
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const form = await formService.createForm({
      processoId: Number(req.body.processoId),
      nome: req.body.nome,
      schema: req.body.schema,
      createdBy: currentUser(req),
    });

    return res.status(201).json(form);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const formId = Number(req.params.id);
    const form = await formService.updateForm({
      formId,
      processoId: Number(req.body.processoId),
      nome: req.body.nome,
      schema: req.body.schema,
      updatedBy: currentUser(req),
    });

    return res.json(form);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const formId = Number(req.params.id);
    const payload = await formService.deleteForm({ formId });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
};
