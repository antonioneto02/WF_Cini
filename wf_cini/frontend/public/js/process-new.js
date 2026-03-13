(function () {
  const form = document.getElementById('processCreateForm');
  if (!form) return;

  const useIdentifierInput = form.querySelector('#useIdentifier');
  const identifierTypeInput = form.querySelector('#identifierType');

  function syncIdentifierInputs() {
    if (!identifierTypeInput || !useIdentifierInput) return;
    const enabled = Boolean(useIdentifierInput.checked);
    identifierTypeInput.disabled = !enabled;
    identifierTypeInput.required = enabled;
    if (!enabled) identifierTypeInput.value = '';
  }

  if (useIdentifierInput) {
    useIdentifierInput.addEventListener('change', syncIdentifierInputs);
  }
  syncIdentifierInputs();

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const identifierEnabled = Boolean(useIdentifierInput && useIdentifierInput.checked);
    const identifierType = identifierTypeInput ? String(identifierTypeInput.value || '').trim() : '';

    if (identifierEnabled && !identifierType) {
      WorkflowUI.showToast('Selecione o tipo do identificador', 'warning');
      return;
    }

    const payload = {
      nome: form.nome.value.trim(),
      descricao: form.descricao.value.trim(),
      identifier: {
        enabled: identifierEnabled,
        type: identifierEnabled ? identifierType : null,
        fieldName: identifierEnabled && form.identifierFieldName ? String(form.identifierFieldName.value || '').trim() : null,
      },
      permissions: {
        viewers: form.viewers ? form.viewers.value : '',
        editors: form.editors ? form.editors.value : '',
        modelers: form.modelers ? form.modelers.value : '',
        executors: form.executors ? form.executors.value : '',
        admins: form.admins ? form.admins.value : '',
      },
      apiConfig: {
        allow_protheus: Boolean(form.allow_protheus && form.allow_protheus.checked),
        allow_mysql: Boolean(form.allow_mysql && form.allow_mysql.checked),
        allow_external: Boolean(form.allow_external && form.allow_external.checked),
        ativo: true,
      },
    };

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch('/api/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao salvar processo');

      WorkflowUI.showToast('Passo 1 concluido. Abrindo modelador...', 'success');
      setTimeout(function () {
        window.location.href = `/processos/${body.id}/modelar?fromWizard=1`;
      }, 400);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Erro inesperado', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  });
})();
