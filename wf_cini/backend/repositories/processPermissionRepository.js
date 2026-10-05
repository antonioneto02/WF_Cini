const { ProcessoPermissoes } = require('../../models');
const {
  Op, where, minusculo, tabelaInexistente,
} = require('../../database/consultas');

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

const ATRIBUTOS = [
  'id', 'processo_id', 'usuario',
  ['pode_visualizar', 'can_view'],
  ['pode_editar', 'can_edit'],
  ['pode_modelar', 'can_model'],
  ['pode_executar', 'can_execute'],
  ['pode_administrar', 'can_admin'],
  'criado_por', 'dt_criacao',
];

async function listPermissionsByProcess(processoId) {
  try {
    const rows = await ProcessoPermissoes.findAll({
      attributes: ATRIBUTOS,
      where: { processo_id: processoId },
      raw: true,
    });

    const ordenadas = rows
      .map((row, indice) => ({ row, chave: String(row.usuario).toLowerCase(), indice }))
      .sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : a.indice - b.indice))
      .map(({ row }) => row);

    return normalizeRows(ordenadas);
  } catch (error) {
    if (tabelaInexistente(error)) return [];
    throw error;
  }
}

async function replacePermissions(processoId, permissions, actor) {
  try {
    await ProcessoPermissoes.destroy({ where: { processo_id: processoId } });

    for (const permission of permissions || []) {
      await ProcessoPermissoes.create({
        processo_id: processoId,
        usuario: normalizeUser(permission.usuario),
        pode_visualizar: Boolean(permission.can_view),
        pode_editar: Boolean(permission.can_edit),
        pode_modelar: Boolean(permission.can_model),
        pode_executar: Boolean(permission.can_execute),
        pode_administrar: Boolean(permission.can_admin),
        criado_por: actor,
        dt_criacao: new Date(),
      });
    }
  } catch (error) {
    if (tabelaInexistente(error)) return;
    throw error;
  }
}

async function getPermissionForUser(processoId, user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return null;

  try {
    const row = await ProcessoPermissoes.findOne({
      attributes: ATRIBUTOS,
      where: { [Op.and]: [{ processo_id: processoId }, where(minusculo('usuario'), normalizedUser)] },
      order: [['id', 'ASC']],
      raw: true,
    });

    return row ? normalizeRows([row])[0] : null;
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

async function listVisibleProcessIds(user) {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser) return [];

  try {
    const rows = await ProcessoPermissoes.findAll({
      attributes: ['processo_id'],
      where: { [Op.and]: [where(minusculo('usuario'), normalizedUser), { pode_visualizar: true }] },
      group: ['processo_id'],
      raw: true,
    });

    return rows.map((row) => Number(row.processo_id)).filter((id) => Number.isFinite(id));
  } catch (error) {
    if (tabelaInexistente(error)) return [];
    throw error;
  }
}

module.exports = {
  listPermissionsByProcess,
  replacePermissions,
  getPermissionForUser,
  listVisibleProcessIds,
};
