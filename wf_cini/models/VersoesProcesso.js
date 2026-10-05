'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const VersoesProcesso = sequelize.define('VersoesProcesso', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  versao: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(30) },
  xml_bpmn: { type: DataTypes.TEXT, allowNull: false },
  propriedades_json: { type: DataTypes.TEXT },
  observacao_publicacao: { type: DataTypes.STRING(255) },
  publicado_em: { type: DataTypes.DATE },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  publicado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'VERSOES_PROCESSO',
  timestamps: false,
  freezeTableName: true,
});

module.exports = VersoesProcesso;
