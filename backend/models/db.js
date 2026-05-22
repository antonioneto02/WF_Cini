'use strict';
const { Sequelize, QueryTypes } = require('sequelize');
const { registerDialectHooks } = require('./sqlHelper');
const dbConfig = require('../../config/database');

const sequelize = new Sequelize(
  dbConfig.database, dbConfig.user, dbConfig.password,
  {
    host:    dbConfig.server,
    dialect: process.env.DB_DIALECT || 'mssql',
    dialectOptions: { options: { ...(dbConfig.options || {}), requestTimeout: dbConfig.requestTimeout || 300000, connectTimeout: 30000 } },
    pool: { max: dbConfig.pool?.max || 10, min: 0, acquire: 60000, idle: dbConfig.pool?.idleTimeoutMillis || 10000 },
    logging: false,
  }
);
registerDialectHooks(sequelize);

function detectType(sql) {
  const s = sql.trim().toUpperCase();
  if (/^INSERT\b/.test(s)) return 'INSERT';
  if (/^UPDATE\b/.test(s)) return 'UPDATE';
  if (/^DELETE\b/.test(s)) return 'DELETE';
  return 'SELECT';
}

function normalizeSql(rawSql) {
  // NOW() → GETDATE() para SQL Server (no PG o hook faz GETDATE() → CURRENT_TIMESTAMP)
  if (sequelize.getDialect() === 'mssql') {
    return rawSql.replace(/\bNOW\s*\(\)/gi, 'GETDATE()');
  }
  return rawSql;
}

async function runQuery(rawSql, params = {}, transaction = null) {
  const sql = normalizeSql(rawSql);
  const type = detectType(sql);
  const opts = { replacements: params, transaction };

  if (type === 'INSERT') {
    const [insertId] = await sequelize.query(sql, { ...opts, type: QueryTypes.INSERT });
    return { insertId: insertId || null, rowsAffected: 1 };
  }
  if (type === 'UPDATE') {
    const [, meta] = await sequelize.query(sql, { ...opts, type: QueryTypes.UPDATE });
    return meta?.rowsAffected?.[0] !== undefined ? [] : [];
  }
  if (type === 'DELETE') {
    await sequelize.query(sql, { ...opts, type: QueryTypes.DELETE });
    return [];
  }
  return await sequelize.query(sql, { ...opts, type: QueryTypes.SELECT });
}

async function query(rawSql, params = {}) {
  return runQuery(rawSql, params);
}

async function withTransaction(work) {
  return await sequelize.transaction(async (t) => {
    const txQuery = (rawSql, params = {}) => runQuery(rawSql, params, t);
    return await work({ query: txQuery });
  });
}

async function close() {
  await sequelize.close();
}

function getPool() { return sequelize; }

module.exports = { getPool, query, withTransaction, close };
