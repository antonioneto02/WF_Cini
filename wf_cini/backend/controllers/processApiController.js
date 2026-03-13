const processService = require('../services/processService');
const accessService = require('../services/accessService');
const { getCurrentUser } = require('../utils/requestUser');
const processApiCatalogService = require('../services/processApiCatalogService');

async function list(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const result = await processService.listProcesses({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      search: req.query.search || '',
      createdBy: req.query.createdBy || null,
      user: currentUser,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const payload = await processService.createProcess({
      nome: req.body.nome,
      codigo: req.body.codigo,
      descricao: req.body.descricao,
      permissions: req.body.permissions || {},
      identifierConfig: req.body.identifier || req.body.identifierConfig || null,
      createdBy: currentUser,
    });

    if (req.body.apiConfig) {
      await processApiCatalogService.updateConfig(payload.id, req.body.apiConfig, currentUser);
    }

    return res.status(201).json(payload);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canEdit = await accessService.canUser(processoId, currentUser, 'edit');
    if (!canEdit) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para editar este processo' });
    }

    const payload = await processService.updateProcess({
      processoId,
      nome: req.body.nome,
      descricao: req.body.descricao,
      status: req.body.status,
      permissions: req.body.permissions || null,
      identifierConfig: req.body.identifier || req.body.identifierConfig || null,
      updatedBy: currentUser,
    });

    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canAdmin = await accessService.canUser(processoId, currentUser, 'admin');
    if (!canAdmin) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para excluir este processo' });
    }

    const payload = await processService.deleteProcess({ processoId });
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

async function saveVersion(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canModel = await accessService.canUser(processoId, currentUser, 'model');
    if (!canModel) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para modelar este processo' });
    }

    const version = await processService.saveVersion({
      processoId,
      bpmnXml: req.body.bpmnXml,
      propriedadesJson: req.body.propriedadesJson,
      originHost: req.body.originHost,
      createdBy: currentUser,
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
    const currentUser = getCurrentUser(req);
    const canAdmin = await accessService.canUser(processoId, currentUser, 'admin');
    if (!canAdmin) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para publicar este processo' });
    }

    const version = await processService.publishVersion({
      processoId,
      versaoId,
      observacao: req.body.observacao,
      publishedBy: currentUser,
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
