const protheusUserService = require('../services/protheusUserService');

async function searchUsers(req, res, next) {
  try {
    const search = req.query.search || '';
    const limit = req.query.limit || 20;

    const data = await protheusUserService.searchUsers({ search, limit });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  searchUsers,
};
