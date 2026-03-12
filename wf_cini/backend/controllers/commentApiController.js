const commentService = require('../services/commentService');
const { getCurrentUser } = require('../utils/requestUser');

async function list(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const data = await commentService.listComments({
      user: currentUser,
      instanciaId: req.query.instanciaId ? Number(req.query.instanciaId) : null,
      tarefaId: req.query.tarefaId ? Number(req.query.tarefaId) : null,
      limit: req.query.limit || 120,
    });

    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const data = await commentService.addComment({
      user: currentUser,
      instanciaId: req.body && req.body.instanciaId ? Number(req.body.instanciaId) : null,
      tarefaId: req.body && req.body.tarefaId ? Number(req.body.tarefaId) : null,
      mensagem: req.body ? req.body.mensagem : null,
      mentionUsers: req.body && Array.isArray(req.body.mentionUsers) ? req.body.mentionUsers : [],
    });

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
};
