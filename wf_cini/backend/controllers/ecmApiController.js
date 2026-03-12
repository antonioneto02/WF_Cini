const fs = require('fs');

const ecmService = require('../services/ecmService');
const accessService = require('../services/accessService');
const { getCurrentUser, normalizeUser } = require('../utils/requestUser');

async function listByProcess(req, res, next) {
  try {
    const processoId = Number(req.params.processoId);
    const user = getCurrentUser(req);

    const canView = await accessService.canUser(processoId, user, 'view');
    if (!canView) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para visualizar arquivos deste processo' });
    }

    const includeAll = req.query.scope === 'all' && (await accessService.canUser(processoId, user, 'admin'));

    const files = await ecmService.listFilesByProcess({
      processoId,
      ownerUser: user,
      includeAll,
    });

    return res.json({ data: files });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    const processoId = Number(req.params.processoId);
    const user = getCurrentUser(req);
    const ownerUser = normalizeUser(req.body.ownerUser || user);

    const canExecute = await accessService.canUser(processoId, user, 'execute');
    if (!canExecute) {
      return res.status(403).json({ ok: false, message: 'Sem permissao para anexar arquivos neste processo' });
    }

    const file = await ecmService.uploadFile({
      processoId,
      instanciaId: req.body.instanciaId ? Number(req.body.instanciaId) : null,
      ownerUser,
      fileName: req.body.fileName,
      mimeType: req.body.mimeType,
      contentBase64: req.body.contentBase64,
      uploadedBy: user,
    });

    return res.status(201).json(file);
  } catch (error) {
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    const fileId = Number(req.params.id);
    const user = normalizeUser(getCurrentUser(req));

    const payload = await ecmService.getDownloadPayload(fileId);

    const canAdmin = await accessService.canUser(payload.file.processo_id, user, 'admin');
    if (!canAdmin && normalizeUser(payload.file.owner_user) !== user) {
      return res.status(403).json({ ok: false, message: 'Voce so pode baixar seus proprios anexos' });
    }

    res.setHeader('Content-Type', payload.file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.file.file_name}"`);

    return fs.createReadStream(payload.absolutePath).pipe(res);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listByProcess,
  upload,
  download,
};
