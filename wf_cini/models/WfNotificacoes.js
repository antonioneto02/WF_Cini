'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const WfNotificacoes = sequelize.define('WfNotificacoes', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuario: { type: DataTypes.STRING(120), allowNull: false },
  titulo: { type: DataTypes.STRING(180), allowNull: false },
  mensagem: { type: DataTypes.TEXT },
  tipo: { type: DataTypes.STRING(40) },
  escopo_tipo: { type: DataTypes.STRING(30) },
  escopo_id: { type: DataTypes.BIGINT },
  prioridade: { type: DataTypes.INTEGER },
  nivel_escalonamento: { type: DataTypes.INTEGER },
  meta_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(20) },
  lido_em: { type: DataTypes.DATE },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'WF_NOTIFICACOES',
  timestamps: false,
  freezeTableName: true,
});

module.exports = WfNotificacoes;
