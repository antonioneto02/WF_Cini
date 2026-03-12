const db = require('../models/db');

function isMissingTableError(error) {
  return Boolean(error && error.message && /Invalid object name/i.test(error.message));
}

async function createFileRecord({
  processoId,
  instanciaId,
  ownerUser,
  fileName,
  filePath,
  mimeType,
  fileSize,
  version,
  uploadedBy,
}) {
  try {
    const result = await db.query(
      `INSERT INTO ecm_arquivos
        (processo_id, instancia_processo_id, usuario_dono, nome_arquivo, caminho_arquivo, tipo_mime, tamanho_bytes, versao,
         criado_por, dt_criacao, dt_atualizacao)
       VALUES
        (:processoId, :instanciaId, :ownerUser, :fileName, :filePath, :mimeType, :fileSize, :version,
         :uploadedBy, NOW(), NOW())`,
      {
        processoId,
        instanciaId,
        ownerUser,
        fileName,
        filePath,
        mimeType,
        fileSize,
        version,
        uploadedBy,
      }
    );

    return result.insertId;
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error('Tabela de ECM ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function getLatestVersion(processoId, ownerUser, fileName) {
  try {
    const rows = await db.query(
      `SELECT MAX(versao) AS ultima_versao
       FROM ecm_arquivos
       WHERE processo_id = :processoId
         AND usuario_dono = :ownerUser
         AND nome_arquivo = :fileName`,
      { processoId, ownerUser, fileName }
    );

    return Number(rows[0] ? rows[0].ultima_versao : 0) || 0;
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function listFilesByProcess({ processoId, ownerUser = null }) {
  try {
    return db.query(
      `SELECT id, processo_id, instancia_processo_id,
              usuario_dono AS owner_user,
              nome_arquivo AS file_name,
              caminho_arquivo AS file_path,
              tipo_mime AS mime_type,
              tamanho_bytes AS file_size,
              versao, criado_por, dt_criacao, dt_atualizacao
       FROM ecm_arquivos
       WHERE processo_id = :processoId
         AND (:ownerUser IS NULL OR usuario_dono = :ownerUser)
       ORDER BY dt_criacao DESC`,
      { processoId, ownerUser }
    );
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function getFileById(id) {
  try {
    const rows = await db.query(
      `SELECT id, processo_id, instancia_processo_id,
              usuario_dono AS owner_user,
              nome_arquivo AS file_name,
              caminho_arquivo AS file_path,
              tipo_mime AS mime_type,
              tamanho_bytes AS file_size,
              versao, criado_por, dt_criacao, dt_atualizacao
       FROM ecm_arquivos
       WHERE id = :id`,
      { id }
    );

    return rows[0] || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

module.exports = {
  createFileRecord,
  getLatestVersion,
  listFilesByProcess,
  getFileById,
};
