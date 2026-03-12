function normalizeText(value) {
  return String(value || '').trim();
}

function isFixedAutoLabel(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return /^(Atividade|Servico|Inicio|Fim|Subprocesso|Decisao|Paralelo|Rota inclusiva|Espera)(\s+\d+)?$/i.test(text);
}

function buildFriendlyElementName({ elementId, elementName }) {
  const explicitName = normalizeText(elementName);
  const id = normalizeText(elementId);
  if (explicitName) return explicitName;
  if (id) return id;
  return '-';
}

function shouldReplaceWithFriendlyName(currentName, elementId) {
  const current = normalizeText(currentName);
  const id = normalizeText(elementId);
  if (!current) return true;
  if (id && current === id) return true;
  return isFixedAutoLabel(current);
}

function formatWorkflowStatus(status) {
  const key = String(status || '').trim().toUpperCase();
  const map = {
    MINHAS_TAREFAS: 'Minhas tarefas',
    EM_ANDAMENTO: 'Em andamento',
    CONCLUIDA: 'Concluida',
    ATIVO: 'Ativo',
    INATIVO: 'Inativo',
    RASCUNHO: 'Rascunho',
    PUBLICADA: 'Publicada',
    ARQUIVADA: 'Arquivada',
  };
  return map[key] || (status || '-');
}

module.exports = {
  buildFriendlyElementName,
  shouldReplaceWithFriendlyName,
  formatWorkflowStatus,
};