const crypto = require('crypto');

const processApiConfigRepository = require('../repositories/processApiConfigRepository');
const processRepository = require('../repositories/processRepository');
const accessService = require('./accessService');
const processApiDefinitionService = require('./processApiDefinitionService');

function generateKey() {
  return crypto.randomBytes(24).toString('hex');
}

async function ensureProcessApiConfig(processoId, actor) {
  try {
    const current = await processApiConfigRepository.getByProcessId(processoId);
    if (current) return current;

    await processApiConfigRepository.upsertByProcessId(
      processoId,
      {
        public_api_key: generateKey(),
        allow_protheus: true,
        allow_mysql: true,
        allow_external: true,
        ativo: true,
      },
      actor
    );

    return processApiConfigRepository.getByProcessId(processoId);
  } catch (_) {
    return {
      processo_id: processoId,
      public_api_key: 'MIGRATION_REQUIRED',
      allow_protheus: true,
      allow_mysql: true,
      allow_external: true,
      ativo: true,
    };
  }
}

async function getConfigByProcessId(processoId) {
  return processApiConfigRepository.getByProcessId(processoId);
}

async function rotateApiKey(processoId, actor) {
  const current = await ensureProcessApiConfig(processoId, actor);
  await processApiConfigRepository.upsertByProcessId(
    processoId,
    {
      public_api_key: generateKey(),
      allow_protheus: Boolean(current.allow_protheus),
      allow_mysql: Boolean(current.allow_mysql),
      allow_external: Boolean(current.allow_external),
      ativo: Boolean(current.ativo),
    },
    actor
  );

  return processApiConfigRepository.getByProcessId(processoId);
}

async function updateConfig(processoId, payload, actor) {
  const current = await ensureProcessApiConfig(processoId, actor);

  await processApiConfigRepository.upsertByProcessId(
    processoId,
    {
      public_api_key: payload.public_api_key || current.public_api_key || generateKey(),
      allow_protheus: payload.allow_protheus !== undefined ? Boolean(payload.allow_protheus) : Boolean(current.allow_protheus),
      allow_mysql: payload.allow_mysql !== undefined ? Boolean(payload.allow_mysql) : Boolean(current.allow_mysql),
      allow_external: payload.allow_external !== undefined ? Boolean(payload.allow_external) : Boolean(current.allow_external),
      ativo: payload.ativo !== undefined ? Boolean(payload.ativo) : Boolean(current.ativo),
    },
    actor
  );

  return processApiConfigRepository.getByProcessId(processoId);
}

async function listAllConfigs() {
  return processApiConfigRepository.listAllConfigs();
}

async function listActivityApisForUser({ user, originHost }) {
  const processRows = await processRepository.listProcesses({
    page: 1,
    pageSize: 500,
    search: '',
    createdBy: null,
  });

  const visibleProcesses = await accessService.filterVisibleProcesses(processRows.data || [], user);
  const configRows = await processApiConfigRepository.listAllConfigs();
  const configByProcessId = new Map((configRows || []).map((item) => [Number(item.processo_id), item]));

  const normalizedOrigin = processApiDefinitionService.normalizeOriginHost(originHost);
  const apis = [];

  for (const process of visibleProcesses) {
    // eslint-disable-next-line no-await-in-loop
    const versions = await processRepository.listVersionsByProcess(process.id);
    const latestVersion = versions[0] || null;
    if (!latestVersion) continue;

    const definitions = processApiDefinitionService.buildServiceTaskApiDefinitions({
      properties: latestVersion.propriedades_json,
      processCode: process.codigo,
      originHost: normalizedOrigin,
      processId: process.id,
      versionId: latestVersion.id,
      versionNumber: latestVersion.versao,
      versionStatus: latestVersion.status,
    });

    const config = configByProcessId.get(Number(process.id)) || null;

    definitions.forEach((item) => {
      apis.push({
        ...item,
        processo_nome: process.nome,
        public_api_key: config ? config.public_api_key : null,
        api_ativa: config ? Boolean(config.ativo) : false,
      });
    });
  }

  return apis;
}

module.exports = {
  ensureProcessApiConfig,
  getConfigByProcessId,
  rotateApiKey,
  updateConfig,
  listAllConfigs,
  listActivityApisForUser,
};
