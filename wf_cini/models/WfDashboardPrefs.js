'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const WfDashboardPrefs = sequelize.define('WfDashboardPrefs', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuario: { type: DataTypes.STRING(120), allowNull: false },
  perfil: { type: DataTypes.STRING(40), allowNull: false },
  widgets_json: { type: DataTypes.TEXT },
  atalhos_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(20) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'WF_DASHBOARD_PREFS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = WfDashboardPrefs;
