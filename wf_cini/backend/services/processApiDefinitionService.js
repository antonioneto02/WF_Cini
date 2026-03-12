function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeOriginHost(originHost) {
  const raw = String(originHost || '').trim();
  if (!raw) return '';

  const sanitized = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  if (/^https?:\/\//i.test(sanitized)) return sanitized;
  return '';
}

function slugify(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return text;
}

function normalizeApiParams(rawParams, rawCount) {
  const safeCount = Math.max(0, Number(rawCount || 0) || 0);
  const source = Array.isArray(rawParams) ? rawParams : [];
  const limited = safeCount > 0 ? source.slice(0, safeCount) : source;

  const names = [];
  limited.forEach((item) => {
    const value = typeof item === 'string'
      ? item
      : item && typeof item === 'object'
        ? item.name || item.path || ''
        : '';

    const trimmed = String(value || '').trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (names.some((name) => name.toLowerCase() === key)) return;
    names.push(trimmed);
  });

  return names;
}

function buildServiceTaskApiDefinitions({ properties, processCode, originHost, processId = null, versionId = null, versionNumber = null, versionStatus = null }) {
  const parsed = safeJsonParse(properties, {});
  const elements = parsed && parsed.elements && typeof parsed.elements === 'object' ? parsed.elements : {};
  const normalizedOrigin = normalizeOriginHost(originHost);
  const code = String(processCode || '').trim();

  if (!code) return [];

  const usedSlugs = new Set();
  const definitions = [];

  Object.entries(elements).forEach(([elementId, item]) => {
    const store = item && typeof item === 'object' ? item : {};
    const taskType = String(store.taskType || '').trim().toUpperCase();
    if (taskType !== 'SERVICE') return;

    const activityName = String(store.name || elementId || 'atividade').trim();
    let slugBase = slugify(activityName);
    if (!slugBase) slugBase = slugify(elementId) || 'atividade';

    let activitySlug = slugBase;
    let suffix = 2;
    while (usedSlugs.has(activitySlug)) {
      activitySlug = `${slugBase}-${suffix}`;
      suffix += 1;
    }
    usedSlugs.add(activitySlug);

    const expectedParamNames = normalizeApiParams(store.apiParams, store.apiParamCount);
    const expectedParams = expectedParamNames.map((name) => ({ name }));

    const endpointPath = `/api/public/processos/${encodeURIComponent(code)}/atividades/${encodeURIComponent(activitySlug)}/start`;
    const endpointUrl = normalizedOrigin ? `${normalizedOrigin}${endpointPath}` : endpointPath;

    definitions.push({
      processo_id: processId,
      processo_codigo: code,
      versao_id: versionId,
      versao_numero: versionNumber,
      versao_status: versionStatus,
      atividade_id: elementId,
      atividade_nome: activityName,
      atividade_slug: activitySlug,
      metodo_http: 'POST',
      endpoint_path: endpointPath,
      endpoint_url: endpointUrl,
      expected_params: expectedParams,
      expected_param_names: expectedParamNames,
    });
  });

  return definitions;
}

function findDefinitionByActivitySlug(definitions, activitySlug) {
  const slug = String(activitySlug || '').trim().toLowerCase();
  if (!slug) return null;

  const list = Array.isArray(definitions) ? definitions : [];
  return list.find((item) => String(item.atividade_slug || '').trim().toLowerCase() === slug) || null;
}

module.exports = {
  normalizeOriginHost,
  buildServiceTaskApiDefinitions,
  findDefinitionByActivitySlug,
};
