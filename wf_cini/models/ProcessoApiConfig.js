'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const ProcessoApiConfig = sequelize.define('ProcessoApiConfig', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  chave_api_publica: { type: DataTypes.STRING(120), allowNull: false },
  permite_protheus: { type: DataTypes.BOOLEAN },
  permite_mysql: { type: DataTypes.BOOLEAN },
  permite_externo: { type: DataTypes.BOOLEAN },
  ativo: { type: DataTypes.BOOLEAN },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'PROCESSO_API_CONFIG',
  timestamps: false,
  freezeTableName: true,
});

module.exports = ProcessoApiConfig;
