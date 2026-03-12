const axios = require('axios');
const automationRepository = require('../repositories/automationRepository');

async function listAutomations(query) {
  return automationRepository.listAutomations(query || {});
}

async function getAutomation(id) {
  const item = await automationRepository.getAutomationById(id);
  if (!item) throw new Error('Automacao nao encontrada');
  return item;
}

async function createAutomation(payload) {
  if (!payload.nome || !String(payload.nome).trim()) {
    throw new Error('Nome da automacao e obrigatorio');
  }
  if (!payload.endpoint_url || !String(payload.endpoint_url).trim()) {
    throw new Error('Endpoint da automacao e obrigatorio');
  }

  const id = await automationRepository.createAutomation(payload);
  return automationRepository.getAutomationById(id);
}

async function updateAutomation(id, payload) {
  const existing = await automationRepository.getAutomationById(id);
  if (!existing) throw new Error('Automacao nao encontrada');

  await automationRepository.updateAutomation(id, payload);
  return automationRepository.getAutomationById(id);
}

async function removeAutomation(id) {
  await automationRepository.removeAutomation(id);
  return { ok: true };
}

function buildRequestConfig(automation, bodyPayload, triggerUser) {
  const method = String(automation.metodo_http || 'POST').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    'X-Workflow-Automation-Id': String(automation.id),
    'X-Workflow-Trigger-User': String(triggerUser || 'sistema'),
  };

  if (String(automation.auth_tipo || '').toUpperCase() === 'BEARER' && automation.auth_valor) {
    headers.Authorization = `Bearer ${automation.auth_valor}`;
  }

  if (String(automation.auth_tipo || '').toUpperCase() === 'API_KEY' && automation.auth_valor) {
    headers['X-API-Key'] = automation.auth_valor;
  }

  return {
    method,
    url: automation.endpoint_url,
    timeout: Number(automation.timeout_ms || 8000),
    headers,
    data: bodyPayload || {},
  };
}

async function invokeAutomation({ automationId, payload, triggerUser }) {
  const automation = await getAutomation(automationId);
  const retries = Math.max(0, Number(automation.retry_count || 0));
  const requestConfig = buildRequestConfig(automation, payload, triggerUser);

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios(requestConfig);
      return {
        ok: true,
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError && lastError.message ? lastError.message : 'Falha ao executar automacao');
}

async function invokeEndpoint({ endpointUrl, method = 'POST', payload, triggerUser, timeoutMs = 8000 }) {
  const url = String(endpointUrl || '').trim();
  if (!url) {
    throw new Error('Endpoint da automacao externa nao informado');
  }

  const response = await axios({
    method: String(method || 'POST').toUpperCase(),
    url,
    timeout: Number(timeoutMs || 8000),
    headers: {
      'Content-Type': 'application/json',
      'X-Workflow-Trigger-User': String(triggerUser || 'sistema'),
    },
    data: payload || {},
  });

  return {
    ok: true,
    status: response.status,
    data: response.data,
  };
}

module.exports = {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  removeAutomation,
  invokeAutomation,
  invokeEndpoint,
};
