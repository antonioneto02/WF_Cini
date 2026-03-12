const commentRepository = require('../repositories/commentRepository');
const taskRepository = require('../repositories/taskRepository');
const instanceRepository = require('../repositories/instanceRepository');
const historyRepository = require('../repositories/historyRepository');
const notificationService = require('./notificationService');
const accessService = require('./accessService');
const { normalizeUser } = require('../utils/requestUser');
const { isSameUserIdentity } = require('./userIdentityService');

function extractMentions(text) {
  const matches = String(text || '').match(/@([A-Za-z0-9_.-]+)/g) || [];
  const mentions = matches
    .map((item) => normalizeUser(item.replace('@', '')))
    .filter(Boolean);
  return Array.from(new Set(mentions));
}

function normalizeMentionUsers(list) {
  if (!Array.isArray(list)) return [];

  const normalized = list
    .map((item) => normalizeUser(item))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function sanitizeMessage(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 2000);
}

function formatUserForMessage(value) {
  const normalized = normalizeUser(value);
  if (!normalized) return '';
  return normalized.toLowerCase();
}

function getActivityLabel(nomeEtapa) {
  const label = String(nomeEtapa || '').trim();
  return label || 'atividade atual';
}

async function resolveScope({ instanciaId, tarefaId }) {
  if (tarefaId) {
    const task = await taskRepository.getTaskById(tarefaId);
    if (!task) throw new Error('Tarefa nao encontrada para comentario');
    return {
      processoId: task.processo_id,
      versaoProcessoId: task.versao_processo_id,
      instanciaId: task.instancia_processo_id,
      tarefaId: task.id,
      solicitante: task.solicitante || null,
      responsavel: task.responsavel || null,
      nomeEtapa: task.nome_etapa || null,
    };
  }

  if (instanciaId) {
    const instance = await instanceRepository.getInstanceById(instanciaId);
    if (!instance) throw new Error('Solicitacao nao encontrada para comentario');
    return {
      processoId: instance.processo_id,
      versaoProcessoId: instance.versao_processo_id,
      instanciaId: instance.id,
      tarefaId: null,
      solicitante: instance.solicitante || null,
      responsavel: null,
      nomeEtapa: null,
    };
  }

  throw new Error('Informe instanciaId ou tarefaId para comentar');
}

async function ensureCanComment({ processoId, user }) {
  const canView = await accessService.canUser(processoId, user, 'view');
  if (!canView) throw new Error('Sem permissao para comentar neste fluxo');
}

async function addComment({ user, instanciaId = null, tarefaId = null, mensagem, mentionUsers = [] }) {
  const autor = normalizeUser(user);
  const autorLabel = formatUserForMessage(autor);
  if (!autor) throw new Error('Usuario invalido');

  const texto = sanitizeMessage(mensagem);
  if (!texto) throw new Error('Comentario vazio');

  const scope = await resolveScope({ instanciaId, tarefaId });
  await ensureCanComment({ processoId: scope.processoId, user: autor });

  const mentionsFromText = extractMentions(texto);
  const mentionsFromPicker = normalizeMentionUsers(mentionUsers);
  const mentions = Array.from(new Set(mentionsFromText.concat(mentionsFromPicker)));

  const commentId = await commentRepository.createComment({
    processoId: scope.processoId,
    instanciaId: scope.instanciaId,
    tarefaId: scope.tarefaId,
    autor,
    mensagem: texto,
    mencoesJson: JSON.stringify(mentions),
  });

  await historyRepository.addHistory({
    instanciaId: scope.instanciaId,
    processoId: scope.processoId,
    versaoProcessoId: scope.versaoProcessoId,
    origemElementId: null,
    destinoElementId: null,
    tipoEvento: 'COMENTARIO',
    descricao: `${autorLabel || autor} comentou: ${texto.slice(0, 120)}`,
    executor: autor,
    payloadJson: JSON.stringify({ comentario_id: commentId, mencoes: mentions }),
  });

  const recipientReasons = new Map();

  async function addReason(recipient, reason) {
    const normalized = normalizeUser(recipient);
    if (!normalized) return;
    if (await isSameUserIdentity(autor, normalized)) return;
    if (!recipientReasons.has(normalized)) {
      recipientReasons.set(normalized, new Set());
    }
    recipientReasons.get(normalized).add(reason);
  }

  for (const recipient of mentions) {
    // eslint-disable-next-line no-await-in-loop
    await addReason(recipient, 'MENTION');
  }
  if (scope.solicitante) {
    await addReason(scope.solicitante, 'REQUESTER');
  }
  if (scope.responsavel) {
    const responsible = normalizeUser(scope.responsavel);
    if (responsible && responsible !== 'ANY') {
      await addReason(responsible, 'RESPONSIBLE');
    }
  }

  for (const [recipient, reasons] of recipientReasons.entries()) {
    const hasMention = reasons.has('MENTION');
    const hasResponsible = reasons.has('RESPONSIBLE');
    const activityLabel = getActivityLabel(scope.nomeEtapa);

    const preview = `${autorLabel || autor}: ${texto.slice(0, 120)}${texto.length > 120 ? '...' : ''}`;
    const title = hasMention
      ? 'Voce foi mencionado em um comentario'
      : hasResponsible
        ? 'Novo comentario em tarefa sob sua responsabilidade'
        : 'Novo comentario no seu fluxo';

    const message = hasMention
      ? `${autorLabel || autor} marcou voce em um comentario na atividade ${activityLabel}.`
      : hasResponsible
        ? `Ha uma nova interacao na atividade ${activityLabel} em que voce foi marcado como responsavel.`
        : `Ha um novo comentario na atividade ${activityLabel} do seu fluxo.`;

    await notificationService.createNotification({
      usuario: recipient,
      titulo: title,
      mensagem: `${message} ${preview}`,
      tipo: hasMention ? 'COMMENT_MENTION' : 'COMMENT',
      escopoTipo: scope.tarefaId ? 'TASK' : 'INSTANCE',
      escopoId: scope.tarefaId || scope.instanciaId,
      prioridade: hasMention ? 3 : 2,
      metaJson: {
        comentario_id: commentId,
        instancia_id: scope.instanciaId,
        tarefa_id: scope.tarefaId,
        motivos: Array.from(reasons),
      },
    });
  }

  const comments = await listComments({ user: autor, instanciaId: scope.instanciaId, tarefaId: scope.tarefaId, limit: 1 });
  return comments[0] || null;
}

async function listComments({ user, instanciaId = null, tarefaId = null, limit = 120 }) {
  const actor = normalizeUser(user);
  const scope = await resolveScope({ instanciaId, tarefaId });
  await ensureCanComment({ processoId: scope.processoId, user: actor });

  const rows = await commentRepository.listByScope({
    instanciaId: scope.instanciaId,
    tarefaId: scope.tarefaId,
    limit,
  });

  return rows.map((row) => ({
    ...row,
    mencoes: (() => {
      try {
        return JSON.parse(row.mencoes_json || '[]');
      } catch (_) {
        return [];
      }
    })(),
  }));
}

async function listRecentCollaborationFeed(user, limit = 10) {
  const actor = normalizeUser(user);
  if (!actor) return [];

  const rows = await commentRepository.listRecentByUserContext({
    usuario: actor,
    limit,
  });

  return rows.map((row) => ({
    ...row,
    mencoes: (() => {
      try {
        return JSON.parse(row.mencoes_json || '[]');
      } catch (_) {
        return [];
      }
    })(),
  }));
}

module.exports = {
  addComment,
  listComments,
  listRecentCollaborationFeed,
};
