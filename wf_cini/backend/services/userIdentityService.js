const protheusUserRepository = require('../repositories/protheusUserRepository');
const { normalizeUser } = require('../utils/requestUser');

async function resolveUserAliases(identifier) {
  const normalized = normalizeUser(identifier);
  if (!normalized) return [];

  const aliasSet = new Set([normalized]);

  try {
    const mapped = await protheusUserRepository.findUserByIdentifier(normalized);
    if (mapped) {
      const mappedId = normalizeUser(mapped.id);
      const mappedCode = normalizeUser(mapped.codigo);
      const mappedEmail = normalizeUser(mapped.email);

      if (mappedId) aliasSet.add(mappedId);
      if (mappedCode) aliasSet.add(mappedCode);
      if (mappedEmail) aliasSet.add(mappedEmail);
    }
  } catch (_) {
    // Keep at least the original identifier when lookup fails.
  }

  return Array.from(aliasSet);
}

async function isSameUserIdentity(left, right) {
  const leftAliases = await resolveUserAliases(left);
  const rightAliases = await resolveUserAliases(right);

  if (!leftAliases.length || !rightAliases.length) {
    return normalizeUser(left) === normalizeUser(right);
  }

  const rightSet = new Set(rightAliases);
  return leftAliases.some((item) => rightSet.has(item));
}

module.exports = {
  resolveUserAliases,
  isSameUserIdentity,
};
