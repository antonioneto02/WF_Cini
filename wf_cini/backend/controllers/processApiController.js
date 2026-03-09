const processService = require('../services/processService');

function getCurrentUser(req) {
  return (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'sistema';
}

async function list(req, res, next) {
  try {
    const result = await processService.listProcesses({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      search: req.query.search || '',
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const payload = await processService.createProcess({
      nome: req.body.nome,
      codigo: req.body.codigo,
      descricao: req.body.descricao,
      createdBy: getCurrentUser(req),
    });

    return res.status(201).json(payload);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const payload = await processService.updateProcess({
      processoId,
      nome: req.body.nome,
      descricao: req.body.descricao,
      status: req.body.status,
      updatedBy: getCurrentUser(req),
    });

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const payload = await processService.deleteProcess({ processoId });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

async function saveVersion(req, res, next) {
  try {
    const processoId = Number(req.params.id);

    const version = await processService.saveVersion({
      processoId,
      bpmnXml: req.body.bpmnXml,
      propriedadesJson: req.body.propriedadesJson,
      createdBy: getCurrentUser(req),
    });

    return res.status(201).json(version);
  } catch (err) {
    return next(err);
  }
}

async function publish(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const versaoId = Number(req.body.versaoId || req.params.versaoId);

    const version = await processService.publishVersion({
      processoId,
      versaoId,
      observacao: req.body.observacao,
      publishedBy: getCurrentUser(req),
    });

    return res.json(version);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  saveVersion,
  publish,
};
