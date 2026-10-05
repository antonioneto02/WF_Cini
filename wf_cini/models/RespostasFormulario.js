'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const RespostasFormulario = sequelize.define('RespostasFormulario', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  tarefa_id: { type: DataTypes.BIGINT, allowNull: false },
  instancia_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  formulario_id: { type: DataTypes.BIGINT, allowNull: false },
  resposta_json: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(30) },
  respondido_por: { type: DataTypes.STRING(120) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'RESPOSTAS_FORMULARIO',
  timestamps: false,
  freezeTableName: true,
});

module.exports = RespostasFormulario;
