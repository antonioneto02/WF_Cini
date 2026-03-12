const adminMaintenanceService = require('../services/adminMaintenanceService');
const { getCurrentUser } = require('../utils/requestUser');

async function purgeAllWorkflowData(req, res, next) {
  try {
    const payload = await adminMaintenanceService.purgeAllWorkflowData({
      confirmText: req.body && req.body.confirmText,
      actor: getCurrentUser(req),
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  purgeAllWorkflowData,
};
