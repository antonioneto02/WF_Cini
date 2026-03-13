const integrationService = require('../services/integrationService');
const processApiCatalogService = require('../services/processApiCatalogService');
const processRepository = require('../repositories/processRepository');
const { getCurrentUser, isDevUser, normalizeUser } = require('../utils/requestUser');

async function startByProtheus(req, res, next) {
  try {
    const current = getCurrentUser(req);
    const payload = await integrationService.startByIntegration({
      sourceType: 'PROTHEUS',
      sourceKey: req.body.sourceKey || req.body.chave || req.body.documento || req.body.id,
      processoId: req.body.processoId,
      processoCodigo: req.body.processoCodigo,
      payload: {
        ...(req.body.payload || {}),
        ...(req.body.identificador !== undefined ? { identificador: req.body.identificador } : {}),
      },
      solicitante: req.body.solicitante || current,
    });

    return res.status(payload.duplicated ? 200 : 201).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function startByMysql(req, res, next) {
  try {
    const current = getCurrentUser(req);
    const payload = await integrationService.startByIntegration({
      sourceType: 'MYSQL',
      sourceKey: req.body.sourceKey || req.body.chave || req.body.pk || req.body.id,
      processoId: req.body.processoId,
      processoCodigo: req.body.processoCodigo,
      payload: {
        ...(req.body.payload || {}),
        ...(req.body.identificador !== undefined ? { identificador: req.body.identificador } : {}),
      },
      solicitante: req.body.solicitante || current,
    });

    return res.status(payload.duplicated ? 200 : 201).json(payload);
  } catch (error) {
    return next(error);
  }
}

async function publicStart(req, res, next) {
  try {
    const processoCodigo = req.params.codigo;
    const activitySlug = req.params.atividade || null;
    const apiKey = req.query.key || req.body.key || req.headers['x-process-api-key'];

    const instance = await integrationService.startByPublicApi({
      processoCodigo,
      apiKey,
      payload: {
        ...(req.body.payload || req.body || {}),
        ...(req.body.identificador !== undefined ? { identificador: req.body.identificador } : {}),
      },
      solicitante: req.body.solicitante || 'public-api',
      activitySlug,
    });

    return res.status(201).json(instance);
  } catch (error) {
    return next(error);
  }
}

async function getProcessApiConfig(req, res, next) {
  try {
    const processoId = Number(req.params.processoId);
    const actor = getCurrentUser(req);

    const process = await processRepository.getProcessById(processoId);
    if (!process) throw new Error('Processo nao encontrado');

    const isOwner = normalizeUser(process.created_by) === normalizeUser(actor);
    if (!isOwner && !isDevUser(actor)) {
      return res.status(403).json({ ok: false, message: 'Somente o criador ou dev pode ver as APIs do processo' });
    }

    const config = await processApiCatalogService.ensureProcessApiConfig(processoId, actor);
    return res.json(config);
  } catch (error) {
    return next(error);
  }
}

async function updateProcessApiConfig(req, res, next) {
  try {
    const processoId = Number(req.params.processoId);
    const actor = getCurrentUser(req);

    const process = await processRepository.getProcessById(processoId);
    if (!process) throw new Error('Processo nao encontrado');

    const isOwner = normalizeUser(process.created_by) === normalizeUser(actor);
    if (!isOwner && !isDevUser(actor)) {
      return res.status(403).json({ ok: false, message: 'Somente o criador ou dev pode editar APIs do processo' });
    }

    const config = await processApiCatalogService.updateConfig(processoId, req.body || {}, actor);
    return res.json(config);
  } catch (error) {
    return next(error);
  }
}

async function rotateProcessApiKey(req, res, next) {
  try {
    const processoId = Number(req.params.processoId);
    const actor = getCurrentUser(req);

    const process = await processRepository.getProcessById(processoId);
    if (!process) throw new Error('Processo nao encontrado');

    const isOwner = normalizeUser(process.created_by) === normalizeUser(actor);
    if (!isOwner && !isDevUser(actor)) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para rotacionar chave' });
    }

    const config = await processApiCatalogService.rotateApiKey(processoId, actor);
    return res.json(config);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  startByProtheus,
  startByMysql,
  publicStart,
  getProcessApiConfig,
  updateProcessApiConfig,
  rotateProcessApiKey,
};
