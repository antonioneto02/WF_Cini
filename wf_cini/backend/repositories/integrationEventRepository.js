const { ProcessoIntegracaoEventos } = require('../../models');
const { idInserido, tabelaInexistente } = require('../../database/consultas');

async function getBySource(sourceType, sourceKey) {
  try {
    return await ProcessoIntegracaoEventos.findOne({
      attributes: [
        'id',
        ['tipo_origem', 'source_type'],
        ['chave_origem', 'source_key'],
        'processo_id',
        'instancia_processo_id',
        'dt_criacao',
      ],
      where: { tipo_origem: sourceType, chave_origem: sourceKey },
      order: [['id', 'ASC']],
      raw: true,
    });
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

async function createEvent({ sourceType, sourceKey, processoId, instanciaProcessoId }) {
  try {
    const registro = await ProcessoIntegracaoEventos.create({
      tipo_origem: sourceType,
      chave_origem: sourceKey,
      processo_id: processoId,
      instancia_processo_id: instanciaProcessoId,
      dt_criacao: new Date(),
    });

    return idInserido(registro);
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

module.exports = {
  getBySource,
  createEvent,
};
