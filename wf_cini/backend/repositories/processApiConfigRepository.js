const db = require('../models/db');

function isMissingTableError(error) {
  return Boolean(error && error.message && /Invalid object name/i.test(error.message));
}

async function getByProcessId(processoId) {
  try {
    const rows = await db.query(
      `SELECT id, processo_id,
              chave_api_publica AS public_api_key,
              permite_protheus AS allow_protheus,
              permite_mysql AS allow_mysql,
              permite_externo AS allow_external,
              ativo,
              criado_por, dt_criacao, dt_atualizacao
       FROM processo_api_config
       WHERE processo_id = :processoId`,
      { processoId }
    );

    return rows[0] || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function upsertByProcessId(processoId, payload, actor) {
  const current = await getByProcessId(processoId);

  try {
    if (!current) {
      const result = await db.query(
        `INSERT INTO processo_api_config
          (processo_id, chave_api_publica, permite_protheus, permite_mysql, permite_externo, ativo, criado_por, dt_criacao, dt_atualizacao)
         VALUES
          (:processoId, :publicApiKey, :allowProtheus, :allowMysql, :allowExternal, :ativo, :actor, NOW(), NOW())`,
        {
          processoId,
          publicApiKey: payload.public_api_key,
          allowProtheus: payload.allow_protheus ? 1 : 0,
          allowMysql: payload.allow_mysql ? 1 : 0,
          allowExternal: payload.allow_external ? 1 : 0,
          ativo: payload.ativo ? 1 : 0,
          actor,
        }
      );

      return result.insertId;
    }

    await db.query(
      `UPDATE processo_api_config
       SET chave_api_publica = :publicApiKey,
         permite_protheus = :allowProtheus,
         permite_mysql = :allowMysql,
         permite_externo = :allowExternal,
           ativo = :ativo,
           atualizado_por = :actor,
           dt_atualizacao = NOW()
       WHERE processo_id = :processoId`,
      {
        processoId,
        publicApiKey: payload.public_api_key,
        allowProtheus: payload.allow_protheus ? 1 : 0,
        allowMysql: payload.allow_mysql ? 1 : 0,
        allowExternal: payload.allow_external ? 1 : 0,
        ativo: payload.ativo ? 1 : 0,
        actor,
      }
    );

    return current.id;
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error('Tabela de API por processo ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function listAllConfigs() {
  try {
          return db.query(
          `SELECT c.id, c.processo_id,
            c.chave_api_publica AS public_api_key,
            c.permite_protheus AS allow_protheus,
            c.permite_mysql AS allow_mysql,
            c.permite_externo AS allow_external,
            c.ativo,
            p.nome AS processo_nome, p.id AS processo_codigo,
            c.dt_criacao, c.dt_atualizacao
           FROM processo_api_config c
           JOIN processos p ON p.id = c.processo_id
           ORDER BY c.dt_atualizacao DESC`
    );
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

module.exports = {
  getByProcessId,
  upsertByProcessId,
  listAllConfigs,
};
