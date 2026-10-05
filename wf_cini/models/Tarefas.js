'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const Tarefas = sequelize.define('Tarefas', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  instancia_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  versao_processo_id: { type: DataTypes.BIGINT, allowNull: false },
  elemento_id: { type: DataTypes.STRING(120), allowNull: false },
  nome_etapa: { type: DataTypes.STRING(180), allowNull: false },
  responsavel: { type: DataTypes.STRING(120) },
  sla_horas: { type: DataTypes.INTEGER },
  configuracao_formulario_json: { type: DataTypes.TEXT },
  resposta_json: { type: DataTypes.TEXT },
  acao_final: { type: DataTypes.STRING(50) },
  observacao_final: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(30) },
  iniciado_em: { type: DataTypes.DATE },
  concluido_em: { type: DataTypes.DATE },
  concluido_por: { type: DataTypes.STRING(120) },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'TAREFAS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = Tarefas;
