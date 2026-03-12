function getCurrentUser(req) {
  return (req.session && req.session.user_code)
    || (req.cookies && req.cookies.user_code)
    || (req.session && req.session.username)
    || (req.cookies && req.cookies.username)
    || 'sistema';
}

function normalizeUser(value) {
  return String(value || '').trim().toUpperCase();
}

function isDevUser(user) {
  return normalizeUser(user) === '000460';
}

module.exports = {
  getCurrentUser,
  normalizeUser,
  isDevUser,
};
