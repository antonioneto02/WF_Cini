(function () {
  const form = document.getElementById('startProcessForm');
  const identifierInput = document.getElementById('startIdentifierInput');
  const seedEl = document.getElementById('startProcessSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent) : { identifier: { required: false, type: null } };

  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const processId = Number(form.dataset.processId);
    const payload = {};

    if (seed.identifier && seed.identifier.required) {
      const identifierValue = String((identifierInput && identifierInput.value) || '').trim();
      if (!identifierValue) {
        WorkflowUI.showToast('Informe o identificador da solicitacao', 'warning');
        if (identifierInput) identifierInput.focus();
        return;
      }

      if (String(seed.identifier.type || '').toUpperCase() === 'SEQUENCIAL') {
        const allowedChars = /^[0-9.,\s\-]+$/.test(identifierValue);
        const digitsOnly = /^\d+$/.test(identifierValue.replace(/[.,\s\-]/g, ''));
        if (!allowedChars || !digitsOnly) {
          WorkflowUI.showToast('O identificador deve conter apenas números (dígitos e separadores . , - são permitidos)', 'warning');
          if (identifierInput) identifierInput.focus();
          return;
        }
      }

      payload.identificador = identifierValue;
    }

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch('/api/instancias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processoId: processId, payload }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao iniciar processo');

      WorkflowUI.showToast(`Solicitacao #${body.id} iniciada com sucesso`, 'success');
      setTimeout(function () {
        window.location.href = '/solicitacoes';
      }, 700);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao iniciar processo', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  });
})();
