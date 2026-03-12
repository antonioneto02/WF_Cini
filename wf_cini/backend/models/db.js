const sql = require('mssql');
const dbConfig = require('../../config/database');

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }

  return poolPromise;
}

function normalizeSql(rawSql) {
  return rawSql
    .replace(/NOW\(\)/gi, 'GETDATE()')
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '@$1');
}

function bindInputs(request, params = {}) {
  Object.entries(params).forEach(([name, value]) => {
    request.input(name, value === undefined ? null : value);
  });
}

async function runStatement(request, rawSql, params = {}) {
  bindInputs(request, params);

  const sqlText = normalizeSql(rawSql);
  const isInsert = /^\s*INSERT\b/i.test(sqlText);
  const statement = isInsert
    ? `${sqlText}; SELECT CAST(SCOPE_IDENTITY() AS INT) AS insertId;`
    : sqlText;

  const result = await request.query(statement);

  if (isInsert) {
    const insertRow =
      (result.recordsets && result.recordsets[1] && result.recordsets[1][0]) ||
      (result.recordset && result.recordset[0]) ||
      null;

    return {
      insertId: insertRow ? insertRow.insertId : null,
      rowsAffected: Array.isArray(result.rowsAffected) ? result.rowsAffected[0] || 0 : 0,
    };
  }

  return result.recordset || [];
}

async function query(rawSql, params = {}) {
  const pool = await getPool();
  return runStatement(pool.request(), rawSql, params);
}

async function withTransaction(work) {
  if (typeof work !== 'function') {
    throw new Error('work deve ser uma funcao para transacao');
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  const txQuery = (rawSql, params = {}) => runStatement(new sql.Request(transaction), rawSql, params);

  try {
    const payload = await work({ query: txQuery });
    await transaction.commit();
    return payload;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (_) {
      // noop
    }
    throw error;
  }
}

async function close() {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  close,
};
