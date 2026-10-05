'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Formularios = sequelize.define('Formularios', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  nome: { type: DataTypes.STRING(180), allowNull: false },
  xml_bpmn: { type: DataTypes.TEXT, allowNull: false },
  propriedades_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'FORMULARIOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Formularios;
