const db = require('../models/db');

const rawDbName = process.env.DB_DATABASE_PROTHEUS || 'p11_prod';
const protheusDbName = /^[A-Za-z0-9_]+$/.test(rawDbName) ? rawDbName : 'p11_prod';
const sysUsrTable = `[${protheusDbName}].[dbo].[SYS_USR]`;

function normalizeIdentifier(value) {
  return String(value || '').trim().toUpperCase();
}

async function searchUsers({ search = '', limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const normalizedSearch = String(search || '').trim();
  const likeSearch = `%${normalizedSearch}%`;

  if (!normalizedSearch) {
    return [];
  }

  const rows = await db.query(
    `SELECT TOP (:limit)
            [USR_ID],
            [USR_UUID],
            [USR_CODIGO],
            [USR_PSWMD5],
            [USR_NOME],
            [USR_MSBLQL],
            [USR_MSBLQD],
            [USR_EMAIL],
            [USR_DEPTO],
            [USR_CARGO],
            [USR_ANO],
            [USR_VERSAO],
            [USR_CHGPSW],
            [USR_IDMID],
            [USR_CHKSUM],
            [USR_CODSAL],
            [USR_DTINC],
            [USR_KEY_SP],
            [USR_SEQ_SP],
            [USR_DTBASE],
            [USR_REDTBS],
            [USR_AVDTBS],
            [USR_RAMAL],
            [USR_ALLEMP],
            [USR_RESOUR],
            [D_E_L_E_T_],
            [R_E_C_N_O_],
            [R_E_C_D_E_L_],
            [USR_SERIE_SP],
            [USR_QTDEXPPSW],
            [USR_GRPRULE],
            [USR_NEEDROLE],
            [USR_DTCHGPSW],
            [USR_DTAVICHGPSW],
            [USR_DTLOGON],
            [USR_HRLOGON],
            [USR_IPLOGON],
            [USR_CNLOGON],
            [USR_USERSOLOGON],
            [USR_DTTENTBLQ],
            [USR_HRTENTBLQ],
            [USR_QTDTENTBLQ],
            [USR_DATABLQ],
            [USR_HORABLQ],
            [USR_ULTSPSW],
            [USR_L_ADMIN_CH],
            [USR_BLQ_USR],
            [USR_DTALASTALT],
            [USR_HRLASTALT],
            [USR_TYPEBLOCK],
            [USR_QTDACESSOS],
            [USR_TIMEOUT],
            [USR_LISTNER],
            [USR_NIVELREAD]
     FROM ${sysUsrTable}
     WHERE (
       [USR_CODIGO] LIKE :likeSearch
       OR [USR_ID] LIKE :likeSearch
       OR [USR_NOME] LIKE :likeSearch
       OR [USR_EMAIL] LIKE :likeSearch
     )
     ORDER BY USR_NOME ASC, USR_ID ASC`,
    { limit: safeLimit, likeSearch }
  );

  return rows.map((row) => ({
    id: (row.USR_ID || '').trim(),
    nome: (row.USR_NOME || '').trim(),
    email: (row.USR_EMAIL || '').trim(),
    codigo: (row.USR_CODIGO || '').trim(),
    departamento: (row.USR_DEPTO || '').trim(),
    cargo: (row.USR_CARGO || '').trim(),
  }));
}

async function findUserByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;

  const rows = await db.query(
    `SELECT TOP (1)
            [USR_ID],
            [USR_CODIGO],
            [USR_NOME],
            [USR_EMAIL]
     FROM ${sysUsrTable}
     WHERE UPPER(LTRIM(RTRIM(ISNULL([USR_ID], '')))) = :normalized
        OR UPPER(LTRIM(RTRIM(ISNULL([USR_CODIGO], '')))) = :normalized
        OR UPPER(LTRIM(RTRIM(ISNULL([USR_EMAIL], '')))) = :normalized
        OR UPPER(LTRIM(RTRIM(ISNULL([USR_NOME], '')))) = :normalized
     ORDER BY USR_NOME ASC, USR_ID ASC`,
    { normalized }
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.USR_ID || '').trim(),
    codigo: String(row.USR_CODIGO || '').trim(),
    nome: String(row.USR_NOME || '').trim(),
    email: String(row.USR_EMAIL || '').trim(),
  };
}

module.exports = {
  searchUsers,
  findUserByIdentifier,
};
