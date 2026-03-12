const fs = require('fs');
const path = require('path');

const ecmRepository = require('../repositories/ecmRepository');
const processRepository = require('../repositories/processRepository');
const { normalizeUser } = require('../utils/requestUser');

const storageRoot = path.join(__dirname, '..', '..', 'storage', 'ecm');

function sanitizeFileName(name) {
  return String(name || 'arquivo.bin')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '') || 'arquivo.bin';
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function decodeBase64(contentBase64) {
  const normalized = String(contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(normalized, 'base64');
}

function buildStoragePath(ownerUser, processCode, fileName) {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = `${now.getTime()}`;
  const safeOwner = normalizeUser(ownerUser) || 'USUARIO';
  const safeProcessCode = sanitizeFileName(processCode || 'processo');
  const safeName = sanitizeFileName(fileName);

  const relativeDir = path.join(safeOwner, safeProcessCode, yyyy, mm);
  const absoluteDir = path.join(storageRoot, relativeDir);
  ensureDirectory(absoluteDir);

  const fileRelativePath = path.join(relativeDir, `${timestamp}__${safeName}`);
  return {
    absolutePath: path.join(storageRoot, fileRelativePath),
    relativePath: fileRelativePath,
  };
}

async function uploadFile({ processoId, instanciaId, ownerUser, fileName, mimeType, contentBase64, uploadedBy }) {
  if (!contentBase64) throw new Error('Arquivo base64 e obrigatorio');
  if (!fileName) throw new Error('Nome do arquivo e obrigatorio');

  const process = await processRepository.getProcessById(processoId);
  if (!process) throw new Error('Processo nao encontrado');

  const contentBuffer = decodeBase64(contentBase64);
  if (!contentBuffer.length) throw new Error('Arquivo vazio');

  // Guardrail: 12MB max per attachment to avoid oversized payloads in API.
  if (contentBuffer.length > 12 * 1024 * 1024) {
    throw new Error('Arquivo excede o limite de 12MB');
  }

  const storage = buildStoragePath(ownerUser, process.codigo, fileName);
  fs.writeFileSync(storage.absolutePath, contentBuffer);

  const nextVersion = (await ecmRepository.getLatestVersion(processoId, normalizeUser(ownerUser), sanitizeFileName(fileName))) + 1;

  const fileId = await ecmRepository.createFileRecord({
    processoId,
    instanciaId: instanciaId || null,
    ownerUser: normalizeUser(ownerUser),
    fileName: sanitizeFileName(fileName),
    filePath: storage.relativePath,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: contentBuffer.length,
    version: nextVersion,
    uploadedBy,
  });

  return ecmRepository.getFileById(fileId);
}

async function listFilesByProcess({ processoId, ownerUser, includeAll = false }) {
  return ecmRepository.listFilesByProcess({
    processoId,
    ownerUser: includeAll ? null : normalizeUser(ownerUser),
  });
}

async function getDownloadPayload(fileId) {
  const file = await ecmRepository.getFileById(fileId);
  if (!file) throw new Error('Arquivo nao encontrado');

  const absolutePath = path.join(storageRoot, file.file_path);
  if (!fs.existsSync(absolutePath)) throw new Error('Arquivo fisico nao encontrado');

  return {
    file,
    absolutePath,
  };
}

module.exports = {
  uploadFile,
  listFilesByProcess,
  getDownloadPayload,
};
