const db = require('../models/db');

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = db
    .query(
      `IF OBJECT_ID('dbo.WF_DASHBOARD_PREFS', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.WF_DASHBOARD_PREFS (
           id BIGINT IDENTITY(1,1) PRIMARY KEY,
           usuario NVARCHAR(120) NOT NULL,
           perfil NVARCHAR(40) NOT NULL,
           widgets_json NVARCHAR(MAX) NULL,
           atalhos_json NVARCHAR(MAX) NULL,
           status NVARCHAR(20) NOT NULL DEFAULT 'ATIVO',
           dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
           dt_atualizacao DATETIME2 NULL
         );

         CREATE UNIQUE INDEX uq_wf_dashboard_prefs_usuario
           ON dbo.WF_DASHBOARD_PREFS(usuario);
       END`
    )
    .then(() => {
      schemaReady = true;
    })
    .finally(() => {
      schemaPromise = null;
    });

  return schemaPromise;
}

async function getByUser(usuario) {
  await ensureSchema();

  const rows = await db.query(
    `SELECT TOP (1)
            id,
            usuario,
            perfil,
            widgets_json,
            atalhos_json,
            dt_criacao,
            dt_atualizacao
     FROM WF_DASHBOARD_PREFS
     WHERE UPPER(LTRIM(RTRIM(usuario))) = UPPER(LTRIM(RTRIM(:usuario)))
       AND status = 'ATIVO'`,
    { usuario }
  );

  return rows[0] || null;
}

async function upsertByUser({ usuario, perfil, widgetsJson, atalhosJson }) {
  await ensureSchema();

  const existing = await getByUser(usuario);
  if (existing) {
    await db.query(
      `UPDATE WF_DASHBOARD_PREFS
       SET perfil = :perfil,
           widgets_json = :widgetsJson,
           atalhos_json = :atalhosJson,
           dt_atualizacao = NOW()
       WHERE id = :id`,
      {
        id: existing.id,
        perfil,
        widgetsJson,
        atalhosJson,
      }
    );

    return getByUser(usuario);
  }

  await db.query(
    `INSERT INTO WF_DASHBOARD_PREFS
      (usuario, perfil, widgets_json, atalhos_json, dt_criacao, dt_atualizacao)
     VALUES
      (:usuario, :perfil, :widgetsJson, :atalhosJson, NOW(), NOW())`,
    {
      usuario,
      perfil,
      widgetsJson,
      atalhosJson,
    }
  );

  return getByUser(usuario);
}

module.exports = {
  ensureSchema,
  getByUser,
  upsertByUser,
};
