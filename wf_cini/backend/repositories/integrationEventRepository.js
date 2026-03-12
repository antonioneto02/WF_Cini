const db = require('../models/db');

function isMissingTableError(error) {
  return Boolean(error && error.message && /Invalid object name/i.test(error.message));
}

async function getBySource(sourceType, sourceKey) {
  try {
    const rows = await db.query(
      `SELECT TOP (1)
              id,
              tipo_origem AS source_type,
              chave_origem AS source_key,
              processo_id,
              instancia_processo_id,
              dt_criacao
       FROM processo_integracao_eventos
       WHERE tipo_origem = :sourceType
         AND chave_origem = :sourceKey`,
      { sourceType, sourceKey }
    );

    return rows[0] || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function createEvent({ sourceType, sourceKey, processoId, instanciaProcessoId }) {
  try {
    const result = await db.query(
      `INSERT INTO processo_integracao_eventos
        (tipo_origem, chave_origem, processo_id, instancia_processo_id, dt_criacao)
       VALUES
        (:sourceType, :sourceKey, :processoId, :instanciaProcessoId, NOW())`,
      { sourceType, sourceKey, processoId, instanciaProcessoId }
    );

    return result.insertId;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

module.exports = {
  getBySource,
  createEvent,
};
