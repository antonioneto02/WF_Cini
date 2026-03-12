const processRepository = require('../repositories/processRepository');
const processPermissionRepository = require('../repositories/processPermissionRepository');
const { normalizeUser, isDevUser } = require('../utils/requestUser');
const { resolveUserAliases } = require('./userIdentityService');

function parseUsersInput(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normalizeUser(item)).filter(Boolean)));
  }

  return Array.from(
    new Set(
      String(value)
        .split(/[;,\n\r]/g)
        .map((item) => normalizeUser(item))
        .filter(Boolean)
    )
  );
}

function ensurePermissionEntry(target, user) {
  const normalized = normalizeUser(user);
  if (!normalized) return null;

  if (!target[normalized]) {
    target[normalized] = {
      usuario: normalized,
      can_view: false,
      can_edit: false,
      can_model: false,
      can_execute: false,
      can_admin: false,
    };
  }

  return target[normalized];
}

function buildPermissionSet(config, creator) {
  const map = {};

  const creatorEntry = ensurePermissionEntry(map, creator);
  if (creatorEntry) {
    creatorEntry.can_view = true;
    creatorEntry.can_edit = true;
    creatorEntry.can_model = true;
    creatorEntry.can_execute = true;
    creatorEntry.can_admin = true;
  }

  parseUsersInput(config.viewers).forEach((user) => {
    const entry = ensurePermissionEntry(map, user);
    if (entry) entry.can_view = true;
  });

  parseUsersInput(config.editors).forEach((user) => {
    const entry = ensurePermissionEntry(map, user);
    if (!entry) return;
    entry.can_view = true;
    entry.can_edit = true;
    entry.can_execute = true;
  });

  parseUsersInput(config.modelers).forEach((user) => {
    const entry = ensurePermissionEntry(map, user);
    if (!entry) return;
    entry.can_view = true;
    entry.can_model = true;
  });

  parseUsersInput(config.executors).forEach((user) => {
    const entry = ensurePermissionEntry(map, user);
    if (!entry) return;
    entry.can_view = true;
    entry.can_execute = true;
  });

  parseUsersInput(config.admins).forEach((user) => {
    const entry = ensurePermissionEntry(map, user);
    if (!entry) return;
    entry.can_view = true;
    entry.can_edit = true;
    entry.can_model = true;
    entry.can_execute = true;
    entry.can_admin = true;
  });

  return Object.values(map);
}

function hasCapability(permission, capability) {
  if (!permission) return false;

  if (capability === 'view') return Boolean(permission.can_view || permission.can_admin || permission.can_edit || permission.can_model || permission.can_execute);
  if (capability === 'edit') return Boolean(permission.can_edit || permission.can_admin);
  if (capability === 'model') return Boolean(permission.can_model || permission.can_admin || permission.can_edit);
  if (capability === 'execute') return Boolean(permission.can_execute || permission.can_admin || permission.can_edit);
  if (capability === 'admin') return Boolean(permission.can_admin);
  return false;
}

async function userIsCreator(processoId, userKeys) {
  const process = await processRepository.getProcessById(processoId);
  if (!process) return false;
  const creator = normalizeUser(process.created_by);
  if (!creator) return false;
  return (userKeys || []).includes(creator);
}

function findPermissionByKeys(acl, userKeys) {
  if (!Array.isArray(acl) || !acl.length) return null;
  const keySet = new Set((userKeys || []).map((key) => normalizeUser(key)).filter(Boolean));
  if (!keySet.size) return null;

  return acl.find((item) => keySet.has(normalizeUser(item.usuario))) || null;
}

async function canUserWithKeys(processoId, userKeys, capability) {
  const acl = await processPermissionRepository.listPermissionsByProcess(processoId);

  if (!acl.length) {
    if (capability === 'admin') {
      return userIsCreator(processoId, userKeys);
    }
    return true;
  }

  const permission = findPermissionByKeys(acl, userKeys);
  if (permission) return hasCapability(permission, capability);

  if (capability === 'view') {
    return userIsCreator(processoId, userKeys);
  }

  return false;
}

async function setProcessPermissions({ processoId, config, actor }) {
  const entries = buildPermissionSet(config || {}, actor);
  await processPermissionRepository.replacePermissions(processoId, entries, actor);
  return entries;
}

async function canUser(processoId, user, capability) {
  const normalizedUser = normalizeUser(user);

  if (!normalizedUser) return false;
  if (isDevUser(normalizedUser)) return true;

  const userKeys = await resolveUserAliases(normalizedUser);
  if (!userKeys.length) return false;

  return canUserWithKeys(processoId, userKeys, capability);
}

async function filterVisibleProcesses(processes, user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return [];

  if (isDevUser(normalizedUser)) return processes;

  const userKeys = await resolveUserAliases(normalizedUser);
  if (!userKeys.length) return [];

  const visible = [];
  for (const process of processes || []) {
    // eslint-disable-next-line no-await-in-loop
    const allowed = await canUserWithKeys(process.id, userKeys, 'view');
    if (allowed) visible.push(process);
  }

  return visible;
}

async function getAcl(processoId) {
  return processPermissionRepository.listPermissionsByProcess(processoId);
}

module.exports = {
  parseUsersInput,
  setProcessPermissions,
  canUser,
  filterVisibleProcesses,
  getAcl,
};
