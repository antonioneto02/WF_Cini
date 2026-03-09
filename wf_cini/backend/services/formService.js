const formRepository = require('../repositories/formRepository');

async function listForms(query = {}) {
  return formRepository.listForms(query);
}

async function createForm({ processoId, nome, schema, createdBy }) {
  if (!processoId) throw new Error('processoId e obrigatorio');
  if (!nome) throw new Error('Nome do formulario e obrigatorio');

  const schemaJson = JSON.stringify(schema || { fields: [] });

  const formId = await formRepository.createForm({
    processoId,
    nome,
    schemaJson,
    xmlBpmn: '',
    createdBy,
  });

  return formRepository.getFormById(formId);
}

async function updateForm({ formId, processoId, nome, schema, updatedBy }) {
  if (!formId) throw new Error('formId e obrigatorio');
  if (!processoId) throw new Error('processoId e obrigatorio');
  if (!nome) throw new Error('Nome do formulario e obrigatorio');

  const current = await formRepository.getFormById(formId);
  if (!current) throw new Error('Formulario nao encontrado');

  const schemaJson = JSON.stringify(schema || { fields: [] });

  await formRepository.updateForm({
    formId,
    processoId,
    nome,
    schemaJson,
    updatedBy,
    status: current.status || 'ATIVO',
  });

  return formRepository.getFormById(formId);
}

async function deleteForm({ formId }) {
  if (!formId) throw new Error('formId e obrigatorio');

  const current = await formRepository.getFormById(formId);
  if (!current) throw new Error('Formulario nao encontrado');

  const deps = await formRepository.getFormDeleteDependencies(formId);
  const blocked = [];
  if (deps.tasks > 0) blocked.push(`${deps.tasks} tarefa(s)`);
  if (deps.responses > 0) blocked.push(`${deps.responses} resposta(s)`);

  if (blocked.length) {
    throw new Error(`Nao foi possivel excluir. O formulario possui vinculos: ${blocked.join(', ')}.`);
  }

  await formRepository.deleteForm(formId);
  return { success: true };
}

module.exports = {
  listForms,
  createForm,
  updateForm,
  deleteForm,
};
