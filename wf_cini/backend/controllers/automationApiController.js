const automationService = require('../services/automationService');
const { getCurrentUser } = require('../utils/requestUser');

async function list(req, res, next) {
  try {
    const result = await automationService.listAutomations({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 30,
      search: req.query.search || '',
      onlyActive: req.query.onlyActive === '1',
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const item = await automationService.createAutomation({
      ...req.body,
      criado_por: getCurrentUser(req),
    });
    return res.status(201).json(item);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const item = await automationService.updateAutomation(id, req.body);
    return res.json(item);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = await automationService.removeAutomation(id);
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

async function invoke(req, res, next) {
  try {
    const id = Number(req.params.id);
    const payload = await automationService.invokeAutomation({
      automationId: id,
      payload: req.body.payload || {},
      triggerUser: getCurrentUser(req),
    });
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  invoke,
};
