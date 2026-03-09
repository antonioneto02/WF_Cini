(function () {
  const deleteButtons = document.querySelectorAll('.delete-process-btn');
  if (!deleteButtons.length) return;

  deleteButtons.forEach(function (button) {
    button.addEventListener('click', async function () {
      const processId = Number(button.dataset.processId);
      const processName = button.dataset.processName || `#${processId}`;

      if (!WorkflowUI.confirmDelete(`Excluir processo "${processName}"?`)) {
        return;
      }

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/processos/${processId}`, {
          method: 'DELETE',
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Erro ao excluir processo');

        WorkflowUI.showToast('Processo excluido com sucesso', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 450);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao excluir processo', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  });
})();
