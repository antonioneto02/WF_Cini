const dashboardPersonalizationService = require('../services/dashboardPersonalizationService');
const { getCurrentUser } = require('../utils/requestUser');

async function getPreferences(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const data = await dashboardPersonalizationService.getPreferencesForUser(currentUser);
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

async function savePreferences(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const data = await dashboardPersonalizationService.savePreferencesForUser(currentUser, req.body || {});
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPreferences,
  savePreferences,
};
