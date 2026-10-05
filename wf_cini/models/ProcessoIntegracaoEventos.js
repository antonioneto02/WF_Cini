'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const ProcessoIntegracaoEventos = sequelize.define('ProcessoIntegracaoEventos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  tipo_origem: { type: DataTypes.STRING(40), allowNull: false },
  chave_origem: { type: DataTypes.STRING(180), allowNull: false },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  instancia_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  dt_criacao: { type: DataTypes.DATE },
}, {
  tableName: 'PROCESSO_INTEGRACAO_EVENTOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = ProcessoIntegracaoEventos;
