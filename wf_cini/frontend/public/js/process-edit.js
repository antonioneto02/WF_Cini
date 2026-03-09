(function () {
  const form = document.getElementById('processEditForm');
  if (!form) return;

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const processId = Number(form.dataset.processId);

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch(`/api/processos/${processId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.value.trim(),
          descricao: form.descricao.value.trim(),
          status: form.status.value,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao atualizar processo');

      WorkflowUI.showToast('Processo atualizado com sucesso', 'success');
      setTimeout(function () {
        window.location.href = `/processos/${processId}`;
      }, 500);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao atualizar processo', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  });
})();
