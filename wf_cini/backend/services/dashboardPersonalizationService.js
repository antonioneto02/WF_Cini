const dashboardPreferenceRepository = require('../repositories/dashboardPreferenceRepository');
const { normalizeUser, isDevUser } = require('../utils/requestUser');

const DEFAULT_WIDGETS = {
  OPERACAO: ['kpis', 'tarefas', 'solicitacoes', 'sla', 'notificacoes', 'colaboracao'],
  GESTAO: ['kpis', 'processos', 'solicitacoes', 'sla', 'notificacoes', 'colaboracao'],
  DEV: ['kpis', 'tarefas', 'processos', 'automacoes', 'sla', 'notificacoes', 'colaboracao'],
};

const DEFAULT_SHORTCUTS = {
  OPERACAO: [
    { label: 'Abrir tarefas', href: '/tarefas', icon: 'bi-check2-square' },
    { label: 'Nova solicitacao', href: '/processos', icon: 'bi-play-circle' },
    { label: 'Acompanhar solicitacoes', href: '/solicitacoes', icon: 'bi-file-earmark-text' },
  ],
  GESTAO: [
    { label: 'Processos', href: '/processos', icon: 'bi-diagram-3' },
    { label: 'Indicadores', href: '/dashboard', icon: 'bi-speedometer2' },
    { label: 'Historico', href: '/solicitacoes', icon: 'bi-clock-history' },
  ],
  DEV: [
    { label: 'Modelador', href: '/processos', icon: 'bi-diagram-3' },
    { label: 'Automacoes', href: '/automacoes', icon: 'bi-robot' },
    { label: 'Modo Dev APIs', href: '/bpm/dev/apis', icon: 'bi-code-square' },
  ],
};

function inferProfile(user) {
  const normalized = normalizeUser(user);
  if (!normalized) return 'OPERACAO';
  if (isDevUser(normalized)) return 'DEV';
  return 'OPERACAO';
}

function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function getProfileDefaults(profile) {
  const safeProfile = String(profile || 'OPERACAO').toUpperCase();
  return {
    profile: safeProfile,
    widgets: DEFAULT_WIDGETS[safeProfile] || DEFAULT_WIDGETS.OPERACAO,
    shortcuts: DEFAULT_SHORTCUTS[safeProfile] || DEFAULT_SHORTCUTS.OPERACAO,
  };
}

function sanitizeWidgets(input, fallback) {
  if (!Array.isArray(input)) return fallback;
  const allowed = new Set(['kpis', 'tarefas', 'processos', 'solicitacoes', 'automacoes', 'sla', 'notificacoes', 'colaboracao']);
  const sanitized = input
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => allowed.has(item));
  return Array.from(new Set(sanitized));
}

function sanitizeShortcuts(input, fallback) {
  if (!Array.isArray(input)) return fallback;
  const sanitized = input
    .map((item) => ({
      label: String(item && item.label ? item.label : '').trim(),
      href: String(item && item.href ? item.href : '').trim(),
      icon: String(item && item.icon ? item.icon : 'bi-link-45deg').trim(),
    }))
    .filter((item) => item.label && item.href && item.href.startsWith('/'))
    .slice(0, 8);

  return sanitized.length ? sanitized : fallback;
}

async function getPreferencesForUser(user) {
  const usuario = normalizeUser(user);
  const profile = inferProfile(usuario);
  const defaults = getProfileDefaults(profile);

  const stored = await dashboardPreferenceRepository.getByUser(usuario);
  if (!stored) {
    return {
      usuario,
      perfil: defaults.profile,
      widgets: defaults.widgets,
      atalhos: defaults.shortcuts,
      source: 'default',
    };
  }

  return {
    usuario,
    perfil: String(stored.perfil || defaults.profile).toUpperCase(),
    widgets: sanitizeWidgets(safeJson(stored.widgets_json, defaults.widgets), defaults.widgets),
    atalhos: sanitizeShortcuts(safeJson(stored.atalhos_json, defaults.shortcuts), defaults.shortcuts),
    source: 'custom',
  };
}

async function savePreferencesForUser(user, payload = {}) {
  const usuario = normalizeUser(user);
  const profile = String(payload.perfil || inferProfile(usuario)).toUpperCase();
  const defaults = getProfileDefaults(profile);

  const widgets = sanitizeWidgets(payload.widgets, defaults.widgets);
  const atalhos = sanitizeShortcuts(payload.atalhos, defaults.shortcuts);

  await dashboardPreferenceRepository.upsertByUser({
    usuario,
    perfil: profile,
    widgetsJson: JSON.stringify(widgets),
    atalhosJson: JSON.stringify(atalhos),
  });

  return getPreferencesForUser(usuario);
}

module.exports = {
  inferProfile,
  getProfileDefaults,
  getPreferencesForUser,
  savePreferencesForUser,
};
