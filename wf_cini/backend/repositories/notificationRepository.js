const { WfNotificacoes, Tarefas, Processos, InstanciasProcesso } = require('../../models');
const {
  Op, col, where, maiusculo, paginar,
} = require('../../database/consultas');

async function ensureSchema() {}

async function createNotification({
  usuario,
  titulo,
  mensagem,
  tipo = 'INFO',
  escopoTipo = 'SYSTEM',
  escopoId = null,
  prioridade = 2,
  nivelEscalonamento = 0,
  metaJson = null,
}) {
  const agora = new Date();
  await WfNotificacoes.create({
    usuario,
    titulo,
    mensagem,
    tipo,
    escopo_tipo: escopoTipo,
    escopo_id: escopoId,
    prioridade,
    nivel_escalonamento: nivelEscalonamento,
    meta_json: metaJson,
    status: 'UNREAD',
    dt_criacao: agora,
    dt_atualizacao: agora,
  });
}

function normalizeUserList(users) {
  const source = Array.isArray(users) ? users : [];
  const normalized = source
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function filtroUsuarios(users) {
  const safeUsers = normalizeUserList(users);
  if (!safeUsers.length) return null;
  return where(maiusculo('usuario'), { [Op.in]: safeUsers });
}

const usuarioIgual = (nomeColuna, usuario) => where(maiusculo(nomeColuna), String(usuario || '').trim().toUpperCase());

async function listByUser({ usuario, status = null, page = 1, pageSize = 20 }) {
  return listByUsers({ usuarios: [usuario], status, page, pageSize });
}

async function listByUsers({ usuarios = [], status = null, page = 1, pageSize = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const usuariosFiltro = filtroUsuarios(usuarios);

  if (!usuariosFiltro) {
    return { data: [], total: 0, unread: 0, page: safePage, pageSize: safePageSize };
  }

  const filtro = { [Op.and]: [usuariosFiltro, ...(status !== null && status !== undefined ? [{ status }] : [])] };

  const rows = await WfNotificacoes.findAll({
    attributes: [
      'id', 'usuario', 'titulo', 'mensagem', 'tipo',
      'escopo_tipo', 'escopo_id', 'prioridade', 'nivel_escalonamento',
      'meta_json', 'status', 'lido_em', ['dt_criacao', 'created_at'],
    ],
    where: filtro,
    order: [['status', 'ASC'], ['dt_criacao', 'DESC'], ['id', 'DESC']],
    ...paginar(safePage, safePageSize),
    raw: true,
  });

  const total = await WfNotificacoes.count({ where: filtro });
  const unread = await WfNotificacoes.count({ where: { [Op.and]: [usuariosFiltro, { status: 'UNREAD' }] } });

  return {
    data: rows,
    total,
    unread,
    page: safePage,
    pageSize: safePageSize,
  };
}

async function marcarLidas(filtro) {
  const agora = new Date();
  await WfNotificacoes.update(
    { status: 'READ', lido_em: agora, dt_atualizacao: agora },
    { where: { [Op.and]: [filtro, { lido_em: null }] } }
  );
  await WfNotificacoes.update(
    { status: 'READ', dt_atualizacao: agora },
    { where: { [Op.and]: [filtro, { lido_em: { [Op.ne]: null } }] } }
  );
}

async function markAsRead({ id, usuario }) {
  return markAsReadForUsers({ id, usuarios: [usuario] });
}

async function markAsReadForUsers({ id, usuarios = [] }) {
  const usuariosFiltro = filtroUsuarios(usuarios);
  if (!usuariosFiltro) return;
  await marcarLidas({ [Op.and]: [{ id }, usuariosFiltro] });
}

async function markAllAsRead(usuario) {
  return markAllAsReadForUsers([usuario]);
}

async function markAllAsReadForUsers(usuarios = []) {
  const usuariosFiltro = filtroUsuarios(usuarios);
  if (!usuariosFiltro) return;
  await marcarLidas({ [Op.and]: [usuariosFiltro, { status: 'UNREAD' }] });
}

async function existsRecentEscalation({ usuario, escopoId, nivelEscalonamento, lookbackMinutes = 180 }) {
  const limite = new Date(Date.now() - Number(lookbackMinutes) * 60000);
  const row = await WfNotificacoes.findOne({
    attributes: ['id'],
    where: {
      [Op.and]: [
        usuarioIgual('usuario', usuario),
        {
          escopo_tipo: 'TASK',
          escopo_id: escopoId,
          tipo: 'SLA_ESCALATION',
          nivel_escalonamento: nivelEscalonamento,
          dt_criacao: { [Op.gte]: limite },
        },
      ],
    },
    raw: true,
  });

  return Boolean(row);
}

async function listLatestSlaAlerts({ usuario, limit = 8 }) {
  return listLatestSlaAlertsForUsers({ usuarios: [usuario], limit });
}

async function listLatestSlaAlertsForUsers({ usuarios = [], limit = 8 }) {
  const safeLimit = Math.max(1, Number(limit) || 8);
  const usuariosFiltro = filtroUsuarios(usuarios);
  if (!usuariosFiltro) return [];

  return WfNotificacoes.findAll({
    attributes: [
      'id', 'titulo', 'mensagem', 'prioridade', 'nivel_escalonamento',
      'escopo_tipo', 'escopo_id', 'status', ['dt_criacao', 'created_at'],
    ],
    where: { [Op.and]: [usuariosFiltro, { tipo: 'SLA_ESCALATION' }] },
    order: [['status', 'ASC'], ['dt_criacao', 'DESC'], ['id', 'DESC']],
    limit: safeLimit,
    raw: true,
  });
}

const minutoDe = data => Math.floor(data.getTime() / 60000);

async function listSlaBreachCandidates({ usuario, limit = 30 }) {
  const safeLimit = Math.max(1, Number(limit) || 30);
  const agora = new Date();

  const tarefas = await Tarefas.findAll({
    attributes: [
      ['id', 'task_id'],
      'instancia_processo_id',
      'processo_id',
      'nome_etapa',
      'responsavel',
      'sla_horas',
      'status',
      'iniciado_em',
      'dt_criacao',
      [col('processo.nome'), 'processo_nome'],
      [col('instancia.solicitante'), 'solicitante'],
    ],
    include: [
      { model: Processos, as: 'processo', attributes: [], required: true },
      { model: InstanciasProcesso, as: 'instancia', attributes: [], required: true },
    ],
    where: {
      [Op.and]: [
        { status: { [Op.in]: ['MINHAS_TAREFAS', 'EM_ANDAMENTO'] } },
        usuarioIgual('Tarefas.responsavel', usuario),
      ],
    },
    raw: true,
  });

  return tarefas
    .map((tarefa) => {
      const inicio = new Date(tarefa.iniciado_em || tarefa.dt_criacao);
      const horas = tarefa.sla_horas === null || tarefa.sla_horas === undefined ? 24 : Number(tarefa.sla_horas);
      const prazoFinal = new Date(inicio.getTime() + horas * 3600000);
      return {
        ...tarefa,
        prazo_final: prazoFinal,
        atraso_minutos: minutoDe(agora) - minutoDe(prazoFinal),
      };
    })
    .filter((tarefa) => tarefa.prazo_final < agora)
    .sort((a, b) => b.atraso_minutos - a.atraso_minutos)
    .slice(0, safeLimit);
}

module.exports = {
  ensureSchema,
  createNotification,
  listByUser,
  listByUsers,
  markAsRead,
  markAsReadForUsers,
  markAllAsRead,
  markAllAsReadForUsers,
  existsRecentEscalation,
  listLatestSlaAlerts,
  listLatestSlaAlertsForUsers,
  listSlaBreachCandidates,
};
