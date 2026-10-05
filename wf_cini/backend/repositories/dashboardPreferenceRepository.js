const { WfDashboardPrefs } = require('../../models');
const { Op, where, maiusculo } = require('../../database/consultas');

async function ensureSchema() {}

async function getByUser(usuario) {
  return WfDashboardPrefs.findOne({
    attributes: ['id', 'usuario', 'perfil', 'widgets_json', 'atalhos_json', 'dt_criacao', 'dt_atualizacao'],
    where: {
      [Op.and]: [
        where(maiusculo('usuario'), String(usuario || '').trim().toUpperCase()),
        { status: 'ATIVO' },
      ],
    },
    order: [['id', 'ASC']],
    raw: true,
  });
}

async function upsertByUser({ usuario, perfil, widgetsJson, atalhosJson }) {
  const existing = await getByUser(usuario);
  const agora = new Date();
  if (existing) {
    await WfDashboardPrefs.update(
      {
        perfil,
        widgets_json: widgetsJson,
        atalhos_json: atalhosJson,
        dt_atualizacao: agora,
      },
      { where: { id: existing.id } }
    );

    return getByUser(usuario);
  }

  await WfDashboardPrefs.create({
    usuario,
    perfil,
    widgets_json: widgetsJson,
    atalhos_json: atalhosJson,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return getByUser(usuario);
}

module.exports = {
  ensureSchema,
  getByUser,
  upsertByUser,
};
