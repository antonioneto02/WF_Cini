'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Processos = sequelize.define('Processos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(180), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
  usa_identificador: { type: DataTypes.BOOLEAN },
  tipo_identificador: { type: DataTypes.STRING(20) },
  desc_iden: { type: DataTypes.STRING(180) },
}, {
  tableName: 'PROCESSOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Processos;
