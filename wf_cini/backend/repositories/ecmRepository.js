const { EcmArquivos } = require('../../models');
const { Op, idInserido, tabelaInexistente, igualSemCaixa } = require('../../database/consultas');

const ATRIBUTOS = [
  'id', 'processo_id', 'instancia_processo_id',
  ['usuario_dono', 'owner_user'],
  ['nome_arquivo', 'file_name'],
  ['caminho_arquivo', 'file_path'],
  ['tipo_mime', 'mime_type'],
  ['tamanho_bytes', 'file_size'],
  'versao', 'criado_por', 'dt_criacao', 'dt_atualizacao',
];

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
    const agora = new Date();
    const registro = await EcmArquivos.create({
      processo_id: processoId,
      instancia_processo_id: instanciaId,
      usuario_dono: ownerUser,
      nome_arquivo: fileName,
      caminho_arquivo: filePath,
      tipo_mime: mimeType,
      tamanho_bytes: fileSize,
      versao: version,
      criado_por: uploadedBy,
      dt_criacao: agora,
      dt_atualizacao: agora,
    });

    return idInserido(registro);
  } catch (error) {
    if (tabelaInexistente(error)) {
      throw new Error('Tabela de ECM ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function getLatestVersion(processoId, ownerUser, fileName) {
  try {
    const ultima = await EcmArquivos.max('versao', {
      where: { [Op.and]: [{ processo_id: processoId }, igualSemCaixa('usuario_dono', ownerUser), igualSemCaixa('nome_arquivo', fileName)] },
    });

    return Number(ultima || 0) || 0;
  } catch (error) {
    if (tabelaInexistente(error)) return 0;
    throw error;
  }
}

async function listFilesByProcess({ processoId, ownerUser = null }) {
  try {
    const filtro = [{ processo_id: processoId }];
    if (ownerUser !== null && ownerUser !== undefined) filtro.push(igualSemCaixa('usuario_dono', ownerUser));
    return await EcmArquivos.findAll({
      attributes: ATRIBUTOS,
      where: { [Op.and]: filtro },
      order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
      raw: true,
    });
  } catch (error) {
    if (tabelaInexistente(error)) return [];
    throw error;
  }
}

async function getFileById(id) {
  try {
    return await EcmArquivos.findOne({ attributes: ATRIBUTOS, where: { id }, raw: true });
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

module.exports = {
  createFileRecord,
  getLatestVersion,
  listFilesByProcess,
  getFileById,
};
