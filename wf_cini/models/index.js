'use strict';

const sequelize = require('../database/sequelize');
const AutomacoesCatalogo = require('./AutomacoesCatalogo');
const Processos = require('./Processos');
const VersoesProcesso = require('./VersoesProcesso');
const InstanciasProcesso = require('./InstanciasProcesso');
const EcmArquivos = require('./EcmArquivos');
const Formularios = require('./Formularios');
const HistoricoFluxo = require('./HistoricoFluxo');
const ProcessoApiConfig = require('./ProcessoApiConfig');
const ProcessoIntegracaoEventos = require('./ProcessoIntegracaoEventos');
const ProcessoPermissoes = require('./ProcessoPermissoes');
const PropriedadesBpmn = require('./PropriedadesBpmn');
const Tarefas = require('./Tarefas');
const RespostasFormulario = require('./RespostasFormulario');
const WfComentarios = require('./WfComentarios');
const WfDashboardPrefs = require('./WfDashboardPrefs');
const WfNotificacoes = require('./WfNotificacoes');

const semRestricao = { constraints: false };
Tarefas.belongsTo(Processos, { as: 'processo', foreignKey: 'processo_id', ...semRestricao });
Tarefas.belongsTo(InstanciasProcesso, { as: 'instancia', foreignKey: 'instancia_processo_id', ...semRestricao });
InstanciasProcesso.belongsTo(Processos, { as: 'processo', foreignKey: 'processo_id', ...semRestricao });
InstanciasProcesso.belongsTo(VersoesProcesso, { as: 'versao', foreignKey: 'versao_processo_id', ...semRestricao });
Formularios.belongsTo(Processos, { as: 'processo', foreignKey: 'processo_id', ...semRestricao });
RespostasFormulario.belongsTo(Formularios, { as: 'formulario', foreignKey: 'formulario_id', ...semRestricao });
HistoricoFluxo.belongsTo(InstanciasProcesso, { as: 'instancia', foreignKey: 'instancia_processo_id', ...semRestricao });
WfComentarios.belongsTo(Tarefas, { as: 'tarefa', foreignKey: 'tarefa_id', ...semRestricao });
WfComentarios.belongsTo(Processos, { as: 'processo', foreignKey: 'processo_id', ...semRestricao });
ProcessoApiConfig.belongsTo(Processos, { as: 'processo', foreignKey: 'processo_id', ...semRestricao });

const ORDEM = ['AutomacoesCatalogo', 'Processos', 'VersoesProcesso', 'InstanciasProcesso', 'EcmArquivos', 'Formularios', 'HistoricoFluxo', 'ProcessoApiConfig', 'ProcessoIntegracaoEventos', 'ProcessoPermissoes', 'PropriedadesBpmn', 'Tarefas', 'RespostasFormulario', 'WfComentarios', 'WfDashboardPrefs', 'WfNotificacoes'];

module.exports = { sequelize, AutomacoesCatalogo, Processos, VersoesProcesso, InstanciasProcesso, EcmArquivos, Formularios, HistoricoFluxo, ProcessoApiConfig, ProcessoIntegracaoEventos, ProcessoPermissoes, PropriedadesBpmn, Tarefas, RespostasFormulario, WfComentarios, WfDashboardPrefs, WfNotificacoes, ORDEM };
