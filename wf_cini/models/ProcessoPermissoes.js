'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const ProcessoPermissoes = sequelize.define('ProcessoPermissoes', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  usuario: { type: DataTypes.STRING(120), allowNull: false },
  pode_visualizar: { type: DataTypes.BOOLEAN },
  pode_editar: { type: DataTypes.BOOLEAN },
  pode_modelar: { type: DataTypes.BOOLEAN },
  pode_executar: { type: DataTypes.BOOLEAN },
  pode_administrar: { type: DataTypes.BOOLEAN },
  criado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
}, {
  tableName: 'PROCESSO_PERMISSOES',
  timestamps: false,
  freezeTableName: true,
});

module.exports = ProcessoPermissoes;
