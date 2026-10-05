const { ProcessoApiConfig, Processos } = require('../../models');
const { col, idInserido, tabelaInexistente } = require('../../database/consultas');

const ATRIBUTOS_PERMISSAO = [
  ['chave_api_publica', 'public_api_key'],
  ['permite_protheus', 'allow_protheus'],
  ['permite_mysql', 'allow_mysql'],
  ['permite_externo', 'allow_external'],
  'ativo',
];

async function getByProcessId(processoId) {
  try {
    return await ProcessoApiConfig.findOne({
      attributes: ['id', 'processo_id', ...ATRIBUTOS_PERMISSAO, 'criado_por', 'dt_criacao', 'dt_atualizacao'],
      where: { processo_id: processoId },
      order: [['id', 'ASC']],
      raw: true,
    });
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

function camposConfiguracao(payload) {
  return {
    chave_api_publica: payload.public_api_key,
    permite_protheus: Boolean(payload.allow_protheus),
    permite_mysql: Boolean(payload.allow_mysql),
    permite_externo: Boolean(payload.allow_external),
    ativo: Boolean(payload.ativo),
  };
}

async function upsertByProcessId(processoId, payload, actor) {
  const current = await getByProcessId(processoId);
  const agora = new Date();

  try {
    if (!current) {
      const registro = await ProcessoApiConfig.create({
        processo_id: processoId,
        ...camposConfiguracao(payload),
        criado_por: actor,
        dt_criacao: agora,
        dt_atualizacao: agora,
      });

      return idInserido(registro);
    }

    await ProcessoApiConfig.update(
      { ...camposConfiguracao(payload), atualizado_por: actor, dt_atualizacao: agora },
      { where: { processo_id: processoId } }
    );

    return current.id;
  } catch (error) {
    if (tabelaInexistente(error)) {
      throw new Error('Tabela de API por processo ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

const instante = valor => (valor ? new Date(valor).getTime() : null);

async function listAllConfigs() {
  try {
    const rows = await ProcessoApiConfig.findAll({
      attributes: [
        'id', 'processo_id', ...ATRIBUTOS_PERMISSAO,
        [col('processo.nome'), 'processo_nome'], [col('processo.id'), 'processo_codigo'],
        'dt_criacao', 'dt_atualizacao',
      ],
      include: [{ model: Processos, as: 'processo', attributes: [], required: true }],
      raw: true,
    });
    return rows.sort((a, b) => {
      const ta = instante(a.dt_atualizacao);
      const tb = instante(b.dt_atualizacao);
      if (ta === tb) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    });
  } catch (error) {
    if (tabelaInexistente(error)) return [];
    throw error;
  }
}

module.exports = {
  getByProcessId,
  upsertByProcessId,
  listAllConfigs,
};
