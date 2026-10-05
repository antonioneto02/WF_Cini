'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const InstanciasProcesso = sequelize.define('InstanciasProcesso', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  versao_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  solicitante: { type: DataTypes.STRING(120) },
  dados_json: { type: DataTypes.TEXT },
  estado_execucao_json: { type: DataTypes.TEXT },
  elemento_atual_id: { type: DataTypes.STRING(120) },
  status: { type: DataTypes.STRING(30) },
  iniciado_em: { type: DataTypes.DATE, allowNull: false },
  encerrado_em: { type: DataTypes.DATE },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
  identificador: { type: DataTypes.STRING(180) },
  desc_iden: { type: DataTypes.STRING(180) },
}, {
  tableName: 'INSTANCIAS_PROCESSO',
  timestamps: false,
  freezeTableName: true,
});

module.exports = InstanciasProcesso;
