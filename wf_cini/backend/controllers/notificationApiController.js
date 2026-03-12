const notificationService = require('../services/notificationService');
const { getCurrentUser } = require('../utils/requestUser');

async function list(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const result = await notificationService.listNotifications({
      user: currentUser,
      status: req.query.status || null,
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20,
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    return next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    await notificationService.markNotificationRead({
      user: currentUser,
      id: Number(req.params.id),
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    await notificationService.markAllNotificationsRead(currentUser);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead,
};
