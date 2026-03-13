const db = require('../models/db');

function isMissingTableError(error) {
  return Boolean(error && error.message && /Invalid object name/i.test(error.message));
}

function normalizeUser(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    processo_id: row.processo_id,
    usuario: String(row.usuario || '').trim().toLowerCase(),
    can_view: Boolean(row.can_view),
    can_edit: Boolean(row.can_edit),
    can_model: Boolean(row.can_model),
    can_execute: Boolean(row.can_execute),
    can_admin: Boolean(row.can_admin),
    criado_por: row.criado_por || null,
    dt_criacao: row.dt_criacao || null,
  }));
}

async function listPermissionsByProcess(processoId) {
  try {
    const rows = await db.query(
      `SELECT id, processo_id, usuario,
              pode_visualizar AS can_view,
              pode_editar AS can_edit,
              pode_modelar AS can_model,
              pode_executar AS can_execute,
              pode_administrar AS can_admin,
              criado_por, dt_criacao
       FROM processo_permissoes
       WHERE processo_id = :processoId
       ORDER BY usuario ASC`,
      { processoId }
    );

    return normalizeRows(rows);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function replacePermissions(processoId, permissions, actor) {
  try {
    await db.query(
      `DELETE FROM processo_permissoes
       WHERE processo_id = :processoId`,
      { processoId }
    );

    for (const permission of permissions || []) {
      await db.query(
        `INSERT INTO processo_permissoes
          (processo_id, usuario, pode_visualizar, pode_editar, pode_modelar, pode_executar, pode_administrar, criado_por, dt_criacao)
         VALUES
          (:processoId, :usuario, :canView, :canEdit, :canModel, :canExecute, :canAdmin, :actor, NOW())`,
        {
          processoId,
          usuario: normalizeUser(permission.usuario),
          canView: permission.can_view ? 1 : 0,
          canEdit: permission.can_edit ? 1 : 0,
          canModel: permission.can_model ? 1 : 0,
          canExecute: permission.can_execute ? 1 : 0,
          canAdmin: permission.can_admin ? 1 : 0,
          actor,
        }
      );
    }
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

async function getPermissionForUser(processoId, user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return null;

  try {
    const rows = await db.query(
      `SELECT TOP (1)
              id, processo_id, usuario,
              pode_visualizar AS can_view,
              pode_editar AS can_edit,
              pode_modelar AS can_model,
              pode_executar AS can_execute,
              pode_administrar AS can_admin,
              criado_por, dt_criacao
       FROM processo_permissoes
       WHERE processo_id = :processoId
         AND LOWER(LTRIM(RTRIM(ISNULL(usuario, '')))) = :usuario`,
      {
        processoId,
        usuario: normalizedUser,
      }
    );

    const mapped = normalizeRows(rows);
    return mapped[0] || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function listVisibleProcessIds(user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return [];

  try {
    const rows = await db.query(
      `SELECT DISTINCT processo_id
       FROM processo_permissoes
       WHERE LOWER(LTRIM(RTRIM(ISNULL(usuario, '')))) = :usuario
         AND pode_visualizar = 1`,
      { usuario: normalizedUser }
    );

    return rows.map((row) => Number(row.processo_id)).filter((id) => Number.isFinite(id));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

module.exports = {
  listPermissionsByProcess,
  replacePermissions,
  getPermissionForUser,
  listVisibleProcessIds,
};
