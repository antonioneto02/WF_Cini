const bpmEngineService = require('../services/bpmEngineService');
const instanceRepository = require('../repositories/instanceRepository');

function currentUser(req) {
  return (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'sistema';
}

async function start(req, res, next) {
  try {
    const processoId = Number(req.body.processoId);
    const payload = req.body.payload || {};

    const instance = await bpmEngineService.startInstance({
      processoId,
      payload,
      solicitante: currentUser(req),
    });

    return res.status(201).json(instance);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await instanceRepository.listInstances({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
      status: req.query.status || null,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  start,
  list,
};
