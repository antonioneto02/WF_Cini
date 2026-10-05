'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const AutomacoesCatalogo = sequelize.define('AutomacoesCatalogo', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(180), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  url_endpoint: { type: DataTypes.STRING(1000), allowNull: false },
  metodo_http: { type: DataTypes.STRING(10) },
  tipo_autenticacao: { type: DataTypes.STRING(20) },
  valor_autenticacao: { type: DataTypes.STRING(800) },
  tempo_limite_ms: { type: DataTypes.INTEGER },
  tentativas_reenvio: { type: DataTypes.INTEGER },
  ativo: { type: DataTypes.BOOLEAN },
  criado_por: { type: DataTypes.STRING(120) },
  atualizado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'AUTOMACOES_CATALOGO',
  timestamps: false,
  freezeTableName: true,
});

module.exports = AutomacoesCatalogo;
