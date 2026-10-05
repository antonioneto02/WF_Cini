'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

const DIALETO = (process.env.DB_DIALECT || 'mssql').toLowerCase();

const OPCOES_DIALETO = {
  mssql: () => {
    Sequelize.DataTypes.mssql.DATE.prototype._stringify = function (date, options) {
      if (!date || !date._isAMomentObject) date = this._applyTimezone(date, options);
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    };
    return {
      dialectOptions: {
        options: {
          encrypt: true,
          trustServerCertificate: true,
          requestTimeout: 60000,
          useUTC: false,
        },
      },
    };
  },
  postgres: () => {
    const pg = Sequelize.DataTypes.postgres;
    pg.DECIMAL.parse = v => Number(v);
    pg.DATEONLY.parse = v => v;
    return {
      dialectOptions: process.env.DB_SSL_WF === '1' ? { ssl: { rejectUnauthorized: false } } : {},
    };
  },
};

if (!OPCOES_DIALETO[DIALETO]) throw new Error(`DB_DIALECT não suportado: ${DIALETO} (use mssql ou postgres).`);

const sequelize = new Sequelize(
  process.env.DB_DATABASE_WF || process.env.DB_DATABASE_ERP || 'wf',
  process.env.DB_USER_WF || process.env.DB_USER_ERP,
  process.env.DB_PASSWORD_WF || process.env.DB_PASSWORD_ERP,
  {
    host: process.env.DB_SERVER_WF || process.env.DB_SERVER_ERP,
    port: process.env.DB_PORT_WF ? Number(process.env.DB_PORT_WF) : undefined,
    dialect: DIALETO,
    ...OPCOES_DIALETO[DIALETO](),
    timezone: 'America/Sao_Paulo',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
