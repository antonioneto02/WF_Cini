(function () {
  const publishButtons = document.querySelectorAll('.publish-btn');
  const startInstanceForm = document.getElementById('startInstanceForm');

  publishButtons.forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!WorkflowUI.confirmDelete('Publicar esta versao? A versao publicada atual sera arquivada.')) {
        return;
      }

      const processId = Number(btn.dataset.processId);
      const versionId = Number(btn.dataset.versionId);

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/processos/${processId}/publicar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versaoId: versionId }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erro ao publicar versao');

        WorkflowUI.showToast('Versao publicada com sucesso', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 500);
      } catch (error) {
        WorkflowUI.showToast(error.message, 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  });

  if (startInstanceForm) {
    startInstanceForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const processId = Number(startInstanceForm.dataset.processId);
      let payload = {};

      const raw = (startInstanceForm.payload.value || '').trim();
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch (_) {
          WorkflowUI.showToast('Payload JSON invalido', 'warning');
          return;
        }
      }

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch('/api/instancias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processoId: processId, payload }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Erro ao iniciar instancia');

        WorkflowUI.showToast(`Instancia #${body.id} iniciada`, 'success');
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao iniciar instancia', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  }
})();
