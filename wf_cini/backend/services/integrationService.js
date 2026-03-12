const processRepository = require('../repositories/processRepository');
const integrationEventRepository = require('../repositories/integrationEventRepository');
const processApiCatalogService = require('./processApiCatalogService');
const processApiDefinitionService = require('./processApiDefinitionService');
const bpmEngineService = require('./bpmEngineService');

function readValueByPath(payload, name) {
  if (!payload || typeof payload !== 'object' || !name) return undefined;

  if (Object.prototype.hasOwnProperty.call(payload, name)) {
    return payload[name];
  }

  if (!name.includes('.')) return undefined;

  return name.split('.').reduce((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return acc[key];
  }, payload);
}

function isMissingValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim());
}

function collectRequiredParams(definitions, activitySlug) {
  if (!Array.isArray(definitions) || !definitions.length) {
    return {
      definition: null,
      requiredParams: [],
    };
  }

  if (activitySlug) {
    const matched = processApiDefinitionService.findDefinitionByActivitySlug(definitions, activitySlug);
    if (!matched) {
      throw new Error('Atividade de API nao encontrada para este processo');
    }

    return {
      definition: matched,
      requiredParams: Array.isArray(matched.expected_param_names) ? matched.expected_param_names : [],
    };
  }

  const merged = [];
  const seen = new Set();

  definitions.forEach((item) => {
    const names = Array.isArray(item.expected_param_names) ? item.expected_param_names : [];
    names.forEach((name) => {
      const normalized = String(name || '').trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(normalized);
    });
  });

  return {
    definition: null,
    requiredParams: merged,
  };
}

async function validateApiPayloadForProcess({ processoId, processCode, payload, activitySlug = null }) {
  const publishedVersion = await processRepository.getPublishedVersion(processoId);
  if (!publishedVersion) {
    return { definition: null, requiredParams: [] };
  }

  const definitions = processApiDefinitionService.buildServiceTaskApiDefinitions({
    properties: publishedVersion.propriedades_json,
    processCode,
    originHost: '',
    processId: processoId,
    versionId: publishedVersion.id,
    versionNumber: publishedVersion.versao,
    versionStatus: 'PUBLICADA',
  });

  const { definition, requiredParams } = collectRequiredParams(definitions, activitySlug);
  if (!requiredParams.length) {
    return { definition, requiredParams: [] };
  }

  const sourcePayload = payload && typeof payload === 'object' ? payload : {};
  const missing = requiredParams.filter((paramName) => isMissingValue(readValueByPath(sourcePayload, paramName)));

  if (missing.length) {
    throw new Error(`Payload da API incompleto. Parametros obrigatorios: ${requiredParams.join(', ')}. Faltando: ${missing.join(', ')}`);
  }

  return {
    definition,
    requiredParams,
  };
}

async function resolveProcessId({ processoId, processoCodigo }) {
  if (processoId) return Number(processoId);
  if (!processoCodigo) throw new Error('processoId ou processoCodigo e obrigatorio');

  const process = await processRepository.getProcessByCodigo(String(processoCodigo).trim());
  if (!process) throw new Error('Processo nao encontrado para o codigo informado');
  return Number(process.id);
}

async function startByIntegration({ sourceType, sourceKey, processoId, processoCodigo, payload, solicitante }) {
  const finalProcessId = await resolveProcessId({ processoId, processoCodigo });
  const process = await processRepository.getProcessById(finalProcessId);
  const config = await processApiCatalogService.ensureProcessApiConfig(finalProcessId, solicitante || 'sistema');

  if (!config || !config.ativo) {
    throw new Error('API do processo esta desativada');
  }

  if (String(sourceType || '').toUpperCase() === 'PROTHEUS' && !config.allow_protheus) {
    throw new Error('Processo nao permite inicializacao via Protheus');
  }

  if (String(sourceType || '').toUpperCase() === 'MYSQL' && !config.allow_mysql) {
    throw new Error('Processo nao permite inicializacao via MySQL');
  }

  if (!sourceKey || !String(sourceKey).trim()) {
    throw new Error('sourceKey e obrigatorio para idempotencia');
  }

  await validateApiPayloadForProcess({
    processoId: finalProcessId,
    processCode: process ? process.codigo : processoCodigo,
    payload: payload || {},
  });

  const existing = await integrationEventRepository.getBySource(sourceType, String(sourceKey).trim());
  if (existing && existing.instancia_processo_id) {
    return {
      duplicated: true,
      instanciaId: Number(existing.instancia_processo_id),
    };
  }

  const instance = await bpmEngineService.startInstance({
    processoId: finalProcessId,
    solicitante,
    payload: {
      ...(payload || {}),
      trigger_source: sourceType,
      trigger_key: String(sourceKey).trim(),
    },
  });

  await integrationEventRepository.createEvent({
    sourceType,
    sourceKey: String(sourceKey).trim(),
    processoId: finalProcessId,
    instanciaProcessoId: instance.id,
  });

  return {
    duplicated: false,
    instanciaId: Number(instance.id),
  };
}

async function startByPublicApi({ processoCodigo, apiKey, payload, solicitante, activitySlug = null }) {
  const process = await processRepository.getProcessByCodigo(String(processoCodigo || '').trim());
  if (!process) throw new Error('Processo nao encontrado');

  const config = await processApiCatalogService.getConfigByProcessId(process.id);
  if (!config || !config.ativo) throw new Error('API publica deste processo esta desativada');
  if (!config.allow_external) throw new Error('Processo nao permite inicializacao externa');

  if (String(config.public_api_key || '') !== String(apiKey || '')) {
    throw new Error('Chave de API invalida');
  }

  const validation = await validateApiPayloadForProcess({
    processoId: process.id,
    processCode: process.codigo,
    payload: payload || {},
    activitySlug,
  });

  const instance = await bpmEngineService.startInstance({
    processoId: process.id,
    solicitante,
    payload: {
      ...(payload || {}),
      trigger_source: 'PUBLIC_API',
      trigger_activity_slug: activitySlug || null,
      trigger_activity_name: validation.definition ? validation.definition.atividade_nome : null,
    },
  });

  return instance;
}

module.exports = {
  startByIntegration,
  startByPublicApi,
};
