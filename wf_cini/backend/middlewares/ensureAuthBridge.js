function createEnsureAuthBridge(ensureAuth) {
  return function ensureAuthBridge(req, res, next) {
    return ensureAuth(req, res, next);
  };
}

module.exports = {
  createEnsureAuthBridge,
};
