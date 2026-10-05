'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const HistoricoFluxo = sequelize.define('HistoricoFluxo', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  instancia_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  versao_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  elemento_origem_id: { type: DataTypes.STRING(120) },
  elemento_destino_id: { type: DataTypes.STRING(120) },
  tipo_evento: { type: DataTypes.STRING(60), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  executor: { type: DataTypes.STRING(120) },
  dados_json: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'HISTORICO_FLUXO',
  timestamps: false,
  freezeTableName: true,
});

module.exports = HistoricoFluxo;
