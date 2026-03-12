const notificationRepository = require('../repositories/notificationRepository');
const { normalizeUser } = require('../utils/requestUser');
const { resolveUserAliases, isSameUserIdentity } = require('./userIdentityService');

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatUserForMessage(value) {
  const normalized = normalizeUser(value);
  if (!normalized) return '';
  return normalized.toLowerCase();
}

function toFlag(value) {
  return Boolean(value);
}

function normalizePermissionEntry(entry) {
  if (!entry) return null;

  return {
    usuario: normalizeUser(entry.usuario),
    can_view: toFlag(entry.can_view),
    can_edit: toFlag(entry.can_edit),
    can_model: toFlag(entry.can_model),
    can_execute: toFlag(entry.can_execute),
    can_admin: toFlag(entry.can_admin),
  };
}

function buildPermissionMap(entries) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    const normalized = normalizePermissionEntry(entry);
    if (!normalized || !normalized.usuario) return;
    map.set(normalized.usuario, normalized);
  });
  return map;
}

function buildRoleDescription(newlyGranted) {
  const labels = [];
  if (newlyGranted.can_admin) labels.push('administrador');
  if (newlyGranted.can_model) labels.push('modelador');
  if (newlyGranted.can_edit) labels.push('editor');
  if (newlyGranted.can_execute) labels.push('executor');
  if (newlyGranted.can_view && labels.length === 0) labels.push('visualizador');
  if (!labels.length) return 'participante';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

function buildEscalationLevel(candidate) {
  const atrasoMinutos = parseNumber(candidate.atraso_minutos, 0);
  const atrasoHoras = atrasoMinutos / 60;
  if (atrasoHoras >= 8) return 2;
  if (atrasoHoras >= 2) return 1;
  return 0;
}

function getActivityLabel(nomeEtapa) {
  const label = String(nomeEtapa || '').trim();
  return label || 'atividade atual';
}

async function createNotification(payload) {
  const usuario = normalizeUser(payload && payload.usuario);
  if (!usuario) return;

  await notificationRepository.createNotification({
    usuario,
    titulo: payload.titulo,
    mensagem: payload.mensagem || null,
    tipo: payload.tipo || 'INFO',
    escopoTipo: payload.escopoTipo || 'SYSTEM',
    escopoId: payload.escopoId || null,
    prioridade: payload.prioridade == null ? 2 : payload.prioridade,
    nivelEscalonamento: payload.nivelEscalonamento || 0,
    metaJson: payload.metaJson ? JSON.stringify(payload.metaJson) : null,
  });
}

async function notifyTaskCreated({ responsavel, taskId, instanciaId, processoNome, nomeEtapa, actor = null }) {
  const usuario = normalizeUser(responsavel);
  if (!usuario || usuario === 'ANY') return;
  if (actor && await isSameUserIdentity(actor, usuario)) return;

  const activityLabel = getActivityLabel(nomeEtapa);
  await createNotification({
    usuario,
    titulo: 'Voce foi marcado como responsavel',
    mensagem: `Processo ${processoNome || '-'}: voce foi marcado como responsavel na atividade ${activityLabel}.`,
    tipo: 'TASK_CREATED',
    escopoTipo: 'TASK',
    escopoId: taskId,
    prioridade: 2,
    metaJson: {
      instancia_id: instanciaId,
      processo_nome: processoNome || null,
      etapa: nomeEtapa || null,
      atividade_atual: activityLabel,
    },
  });
}

async function notifyTaskCompleted({ solicitante, taskId, instanciaId, nomeEtapa, action }) {
  const usuario = normalizeUser(solicitante);
  if (!usuario) return;

  const activityLabel = getActivityLabel(nomeEtapa);

  await createNotification({
    usuario,
    titulo: 'Atualizacao da atividade',
    mensagem: `A atividade ${activityLabel} foi concluida com a acao ${action || 'aprovar'}.`,
    tipo: 'TASK_COMPLETED',
    escopoTipo: 'TASK',
    escopoId: taskId,
    prioridade: 1,
    metaJson: {
      instancia_id: instanciaId,
      acao: action || null,
      atividade_atual: activityLabel,
    },
  });
}

async function notifyProcessUserAssignments({
  processId,
  processName,
  processCode,
  actor,
  currentPermissions = [],
  previousPermissions = [],
}) {
  const currentMap = buildPermissionMap(currentPermissions);
  const previousMap = buildPermissionMap(previousPermissions);
  const actorUser = normalizeUser(actor);
  const actorLabel = formatUserForMessage(actorUser);

  for (const [usuario, current] of currentMap.entries()) {
    if (!usuario) continue;
    if (actorUser && await isSameUserIdentity(actorUser, usuario)) continue;

    const previous = previousMap.get(usuario) || {
      can_view: false,
      can_edit: false,
      can_model: false,
      can_execute: false,
      can_admin: false,
    };

    const newlyGranted = {
      can_view: current.can_view && !previous.can_view,
      can_edit: current.can_edit && !previous.can_edit,
      can_model: current.can_model && !previous.can_model,
      can_execute: current.can_execute && !previous.can_execute,
      can_admin: current.can_admin && !previous.can_admin,
    };

    if (!Object.values(newlyGranted).some(Boolean)) continue;

    const roleDescription = buildRoleDescription(newlyGranted);
    const processLabel = processName || processCode || `#${processId}`;
    const byActor = actorLabel ? ` por ${actorLabel}` : '';

    await createNotification({
      usuario,
      titulo: 'Voce foi marcado em um processo',
      mensagem: `Voce foi marcado como ${roleDescription} no processo ${processLabel}${byActor}.`,
      tipo: 'PROCESS_ASSIGNMENT',
      escopoTipo: 'PROCESS',
      escopoId: processId || null,
      prioridade: newlyGranted.can_admin ? 3 : 2,
      metaJson: {
        processo_id: processId || null,
        processo_nome: processName || null,
        processo_codigo: processCode || null,
        marcado_por: actorUser || null,
        papeis: newlyGranted,
      },
    });
  }
}

async function notifyInstanceFinished({ solicitante, instanciaId, processoNome }) {
  const usuario = normalizeUser(solicitante);
  if (!usuario) return;

  await createNotification({
    usuario,
    titulo: 'Fluxo concluido',
    mensagem: `O fluxo do processo ${processoNome || '-'} foi concluido.`,
    tipo: 'INSTANCE_FINISHED',
    escopoTipo: 'INSTANCE',
    escopoId: instanciaId,
    prioridade: 1,
  });
}

async function refreshSlaEscalationsForUser(user) {
  const usuario = normalizeUser(user);
  if (!usuario) return [];

  const candidates = await notificationRepository.listSlaBreachCandidates({
    usuario,
    limit: 20,
  });

  const generated = [];

  for (const candidate of candidates) {
    const level = buildEscalationLevel(candidate);
    const alreadyExists = await notificationRepository.existsRecentEscalation({
      usuario,
      escopoId: candidate.task_id,
      nivelEscalonamento: level,
      lookbackMinutes: 180,
    });

    if (alreadyExists) continue;

    const atrasoHoras = Math.max(0, Math.round(parseNumber(candidate.atraso_minutos, 0) / 60));
    const titulo = level >= 2 ? 'SLA estourado - escalonamento' : 'Alerta de SLA atrasado';
    const activityLabel = getActivityLabel(candidate.nome_etapa);

    await createNotification({
      usuario,
      titulo,
      mensagem: `A atividade ${activityLabel} em ${candidate.processo_nome} esta atrasada em ${atrasoHoras}h.`,
      tipo: 'SLA_ESCALATION',
      escopoTipo: 'TASK',
      escopoId: candidate.task_id,
      prioridade: level >= 2 ? 4 : 3,
      nivelEscalonamento: level,
      metaJson: {
        processo_id: candidate.processo_id,
        instancia_id: candidate.instancia_processo_id,
        atraso_minutos: candidate.atraso_minutos,
        atividade_atual: activityLabel,
      },
    });

    generated.push(candidate.task_id);

    if (level >= 2 && usuario !== '000460') {
      const targetUserLabel = formatUserForMessage(usuario);
      const escalatedForDev = await notificationRepository.existsRecentEscalation({
        usuario: '000460',
        escopoId: candidate.task_id,
        nivelEscalonamento: level,
        lookbackMinutes: 180,
      });

      if (!escalatedForDev) {
        await createNotification({
          usuario: '000460',
          titulo: 'Escalonamento critico de SLA',
          mensagem: `Tarefa #${candidate.task_id} (${candidate.nome_etapa}) atrasada em ${atrasoHoras}h para ${targetUserLabel || usuario}.`,
          tipo: 'SLA_ESCALATION',
          escopoTipo: 'TASK',
          escopoId: candidate.task_id,
          prioridade: 5,
          nivelEscalonamento: level,
          metaJson: {
            usuario_responsavel: usuario,
            instancia_id: candidate.instancia_processo_id,
          },
        });
      }
    }
  }

  return generated;
}

async function listNotifications({ user, status, page, pageSize }) {
  const aliases = await resolveUserAliases(user);
  if (!aliases.length) {
    return {
      data: [],
      total: 0,
      unread: 0,
      page: 1,
      pageSize: 20,
    };
  }

  for (const alias of aliases) {
    // eslint-disable-next-line no-await-in-loop
    await refreshSlaEscalationsForUser(alias);
  }

  return notificationRepository.listByUsers({
    usuarios: aliases,
    status,
    page,
    pageSize,
  });
}

async function markNotificationRead({ user, id }) {
  const aliases = await resolveUserAliases(user);
  if (!aliases.length) return;
  await notificationRepository.markAsReadForUsers({ id, usuarios: aliases });
}

async function markAllNotificationsRead(user) {
  const aliases = await resolveUserAliases(user);
  if (!aliases.length) return;
  await notificationRepository.markAllAsReadForUsers(aliases);
}

async function listSlaAlertsForDashboard(user, limit = 8) {
  const aliases = await resolveUserAliases(user);
  if (!aliases.length) return [];

  for (const alias of aliases) {
    // eslint-disable-next-line no-await-in-loop
    await refreshSlaEscalationsForUser(alias);
  }

  return notificationRepository.listLatestSlaAlertsForUsers({
    usuarios: aliases,
    limit,
  });
}

module.exports = {
  createNotification,
  notifyTaskCreated,
  notifyTaskCompleted,
  notifyProcessUserAssignments,
  notifyInstanceFinished,
  refreshSlaEscalationsForUser,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listSlaAlertsForDashboard,
};
