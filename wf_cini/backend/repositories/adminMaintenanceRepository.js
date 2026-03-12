const db = require('../models/db');

const DELETE_ORDER = [
  { table: 'WF_COMENTARIOS', label: 'comentarios' },
  { table: 'WF_NOTIFICACOES', label: 'notificacoes' },
  { table: 'respostas_formulario', label: 'respostas_formulario' },
  { table: 'tarefas', label: 'tarefas' },
  { table: 'historico_fluxo', label: 'historico_fluxo' },
  { table: 'ecm_arquivos', label: 'ecm_arquivos' },
  { table: 'processo_integracao_eventos', label: 'processo_integracao_eventos' },
  { table: 'instancias_processo', label: 'instancias_processo' },
  { table: 'versoes_processo', label: 'versoes_processo' },
  { table: 'formularios', label: 'formularios' },
  { table: 'processo_api_config', label: 'processo_api_config' },
  { table: 'processo_permissoes', label: 'processo_permissoes' },
  { table: 'processos', label: 'processos' },
  { table: 'automacoes_catalogo', label: 'automacoes_catalogo' },
  { table: 'WF_DASHBOARD_PREFS', label: 'dashboard_preferencias' },
];

async function countRows(queryFn, tableName) {
  const rows = await queryFn(
    `SELECT CASE
              WHEN OBJECT_ID('dbo.${tableName}', 'U') IS NULL THEN 0
              ELSE (SELECT COUNT(*) FROM ${tableName})
            END AS total`
  );

  return Number(rows[0] ? rows[0].total : 0);
}

async function deleteRows(queryFn, tableName) {
  await queryFn(
    `IF OBJECT_ID('dbo.${tableName}', 'U') IS NOT NULL
     BEGIN
       DELETE FROM ${tableName}
     END`
  );
}

async function purgeAllWorkflowData() {
  return db.withTransaction(async ({ query }) => {
    const summary = [];

    for (const item of DELETE_ORDER) {
      // eslint-disable-next-line no-await-in-loop
      const total = await countRows(query, item.table);
      // eslint-disable-next-line no-await-in-loop
      await deleteRows(query, item.table);
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
