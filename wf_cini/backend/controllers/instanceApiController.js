const bpmEngineService = require('../services/bpmEngineService');
const instanceRepository = require('../repositories/instanceRepository');
const accessService = require('../services/accessService');
const { getCurrentUser } = require('../utils/requestUser');

async function start(req, res, next) {
  try {
    const processoId = Number(req.body.processoId);
    const payload = req.body.payload || {};
    const user = getCurrentUser(req);
    const canExecute = await accessService.canUser(processoId, user, 'execute');
    if (!canExecute) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para iniciar este processo' });
    }

    const instance = await bpmEngineService.startInstance({
      processoId,
      payload,
      solicitante: user,
    });

    return res.status(201).json(instance);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const user = getCurrentUser(req);
    const result = await instanceRepository.listInstances({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      processoId: req.query.processoId ? Number(req.query.processoId) : null,
      status: req.query.status || null,
    });

    const visible = [];
    for (const row of result.data) {
      // eslint-disable-next-line no-await-in-loop
      const canView = await accessService.canUser(row.processo_id, user, 'view');
      if (canView) visible.push(row);
    }

    return res.json({
      ...result,
      data: visible,
      total: visible.length,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  start,
  list,
};
