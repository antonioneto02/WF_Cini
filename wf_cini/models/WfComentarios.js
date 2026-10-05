'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const WfComentarios = sequelize.define('WfComentarios', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  instancia_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  tarefa_id: { type: DataTypes.BIGINT },
  autor: { type: DataTypes.STRING(120), allowNull: false },
  mensagem: { type: DataTypes.TEXT, allowNull: false },
  mencoes_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(20) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'WF_COMENTARIOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = WfComentarios;
