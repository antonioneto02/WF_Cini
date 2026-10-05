'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const PropriedadesBpmn = sequelize.define('PropriedadesBpmn', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  versao_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  elemento_id: { type: DataTypes.STRING(120), allowNull: false },
  tipo_elemento: { type: DataTypes.STRING(120), allowNull: false },
  propriedade: { type: DataTypes.STRING(120), allowNull: false },
  valor_texto: { type: DataTypes.TEXT },
  valor_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'PROPRIEDADES_BPMN',
  timestamps: false,
  freezeTableName: true,
});

module.exports = PropriedadesBpmn;
