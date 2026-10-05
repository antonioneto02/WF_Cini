'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../database/sequelize');

const EcmArquivos = sequelize.define('EcmArquivos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  processo_id: { type: DataTypes.BIGINT, allowNull: false },
  instancia_processo_id: { type: DataTypes.BIGINT },
  usuario_dono: { type: DataTypes.STRING(120), allowNull: false },
  nome_arquivo: { type: DataTypes.STRING(260), allowNull: false },
  caminho_arquivo: { type: DataTypes.STRING(1000), allowNull: false },
  tipo_mime: { type: DataTypes.STRING(180) },
  tamanho_bytes: { type: DataTypes.BIGINT, allowNull: false },
  versao: { type: DataTypes.INTEGER },
  criado_por: { type: DataTypes.STRING(120) },
  dt_criacao: { type: DataTypes.DATE },
  dt_atualizacao: { type: DataTypes.DATE },
}, {
  tableName: 'ECM_ARQUIVOS',
  timestamps: false,
  freezeTableName: true,
});

module.exports = EcmArquivos;
