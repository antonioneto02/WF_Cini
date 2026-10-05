const modelos = require('../../models');

const { sequelize } = modelos;

const DELETE_ORDER = [
  { table: 'WF_COMENTARIOS', model: 'WfComentarios', label: 'comentarios' },
  { table: 'WF_NOTIFICACOES', model: 'WfNotificacoes', label: 'notificacoes' },
  { table: 'respostas_formulario', model: 'RespostasFormulario', label: 'respostas_formulario' },
  { table: 'tarefas', model: 'Tarefas', label: 'tarefas' },
  { table: 'historico_fluxo', model: 'HistoricoFluxo', label: 'historico_fluxo' },
  { table: 'ecm_arquivos', model: 'EcmArquivos', label: 'ecm_arquivos' },
  { table: 'processo_integracao_eventos', model: 'ProcessoIntegracaoEventos', label: 'processo_integracao_eventos' },
  { table: 'instancias_processo', model: 'InstanciasProcesso', label: 'instancias_processo' },
  { table: 'versoes_processo', model: 'VersoesProcesso', label: 'versoes_processo' },
  { table: 'formularios', model: 'Formularios', label: 'formularios' },
  { table: 'processo_api_config', model: 'ProcessoApiConfig', label: 'processo_api_config' },
  { table: 'processo_permissoes', model: 'ProcessoPermissoes', label: 'processo_permissoes' },
  { table: 'processos', model: 'Processos', label: 'processos' },
  { table: 'automacoes_catalogo', model: 'AutomacoesCatalogo', label: 'automacoes_catalogo' },
  { table: 'WF_DASHBOARD_PREFS', model: 'WfDashboardPrefs', label: 'dashboard_preferencias' },
];

async function purgeAllWorkflowData() {
  return sequelize.transaction(async (transaction) => {
    const summary = [];

    for (const item of DELETE_ORDER) {
      const Modelo = modelos[item.model];
      // eslint-disable-next-line no-await-in-loop
      const total = await Modelo.count({ transaction });
      // eslint-disable-next-line no-await-in-loop
      await Modelo.destroy({ where: {}, transaction });
      summary.push({
        table: item.table,
        scope: item.label,
        deleted: total,
      });
    }

    return summary;
  });
}

module.exports = {
  purgeAllWorkflowData,
};
