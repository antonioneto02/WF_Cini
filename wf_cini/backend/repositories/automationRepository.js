const db = require('../models/db');

function isMissingTableError(error) {
  return Boolean(error && error.message && /Invalid object name/i.test(error.message));
}

async function listAutomations({ search = '', page = 1, pageSize = 20, onlyActive = false }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const offset = (safePage - 1) * safePageSize;
  const likeSearch = `%${String(search || '').trim()}%`;

  try {
    const rows = await db.query(
      `SELECT id, nome, descricao,
              url_endpoint AS endpoint_url,
              metodo_http,
              tipo_autenticacao AS auth_tipo,
              valor_autenticacao AS auth_valor,
              tempo_limite_ms AS timeout_ms,
              tentativas_reenvio AS retry_count,
              ativo, criado_por, dt_criacao, dt_atualizacao
       FROM automacoes_catalogo
       WHERE (:onlyActive = 0 OR ativo = 1)
         AND (
           nome LIKE :likeSearch
           OR descricao LIKE :likeSearch
           OR url_endpoint LIKE :likeSearch
         )
       ORDER BY dt_criacao DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      {
        onlyActive: onlyActive ? 1 : 0,
        likeSearch,
        offset,
        limit: safePageSize,
      }
    );

    const countRows = await db.query(
      `SELECT COUNT(*) AS total
       FROM automacoes_catalogo
       WHERE (:onlyActive = 0 OR ativo = 1)
         AND (
           nome LIKE :likeSearch
           OR descricao LIKE :likeSearch
           OR url_endpoint LIKE :likeSearch
         )`,
      {
        onlyActive: onlyActive ? 1 : 0,
        likeSearch,
      }
    );

    return {
      data: rows,
      total: Number(countRows[0] ? countRows[0].total : 0),
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        data: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
      };
    }
    throw error;
  }
}

async function getAutomationById(id) {
  try {
    const rows = await db.query(
      `SELECT id, nome, descricao,
              url_endpoint AS endpoint_url,
              metodo_http,
              tipo_autenticacao AS auth_tipo,
              valor_autenticacao AS auth_valor,
              tempo_limite_ms AS timeout_ms,
              tentativas_reenvio AS retry_count,
              ativo, criado_por, dt_criacao, dt_atualizacao
       FROM automacoes_catalogo
       WHERE id = :id`,
      { id }
    );
    return rows[0] || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function createAutomation(payload) {
  try {
    const result = await db.query(
      `INSERT INTO automacoes_catalogo
        (nome, descricao, url_endpoint, metodo_http, tipo_autenticacao, valor_autenticacao, tempo_limite_ms, tentativas_reenvio, ativo, criado_por, dt_criacao, dt_atualizacao)
       VALUES
        (:nome, :descricao, :endpointUrl, :metodoHttp, :authTipo, :authValor, :timeoutMs, :retryCount, :ativo, :criadoPor, NOW(), NOW())`,
      {
        nome: payload.nome,
        descricao: payload.descricao || null,
        endpointUrl: payload.endpoint_url,
        metodoHttp: payload.metodo_http || 'POST',
        authTipo: payload.auth_tipo || 'NONE',
        authValor: payload.auth_valor || null,
        timeoutMs: payload.timeout_ms || 8000,
        retryCount: payload.retry_count || 0,
        ativo: payload.ativo ? 1 : 0,
        criadoPor: payload.criado_por || null,
      }
    );

    return result.insertId;
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error('Tabela de automacoes ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function updateAutomation(id, payload) {
  try {
    await db.query(
      `UPDATE automacoes_catalogo
       SET nome = :nome,
           descricao = :descricao,
           url_endpoint = :endpointUrl,
           metodo_http = :metodoHttp,
           tipo_autenticacao = :authTipo,
           valor_autenticacao = :authValor,
           tempo_limite_ms = :timeoutMs,
           tentativas_reenvio = :retryCount,
           ativo = :ativo,
           dt_atualizacao = NOW()
       WHERE id = :id`,
      {
        id,
        nome: payload.nome,
        descricao: payload.descricao || null,
        endpointUrl: payload.endpoint_url,
        metodoHttp: payload.metodo_http || 'POST',
        authTipo: payload.auth_tipo || 'NONE',
        authValor: payload.auth_valor || null,
        timeoutMs: payload.timeout_ms || 8000,
        retryCount: payload.retry_count || 0,
        ativo: payload.ativo ? 1 : 0,
      }
    );
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error('Tabela de automacoes ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function removeAutomation(id) {
  try {
    await db.query(
      `DELETE FROM automacoes_catalogo
       WHERE id = :id`,
      { id }
    );
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

module.exports = {
  listAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  removeAutomation,
};
