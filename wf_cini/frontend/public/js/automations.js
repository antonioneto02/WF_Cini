(function () {
  const createForm = document.getElementById('automationCreateForm');

  if (createForm) {
    createForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const payload = {
        nome: createForm.nome.value.trim(),
        descricao: createForm.descricao.value.trim(),
        endpoint_url: createForm.endpoint_url.value.trim(),
        metodo_http: createForm.metodo_http.value,
        auth_tipo: createForm.auth_tipo.value,
        auth_valor: createForm.auth_valor.value.trim(),
        timeout_ms: Number(createForm.timeout_ms.value || 8000),
        retry_count: Number(createForm.retry_count.value || 0),
        ativo: true,
      };

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch('/api/automacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Erro ao criar automacao');

        WorkflowUI.showToast('Automacao cadastrada com sucesso', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 500);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao cadastrar automacao', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  }

  document.querySelectorAll('.automation-delete-btn').forEach(function (button) {
    button.addEventListener('click', async function () {
      if (!WorkflowUI.confirmDelete('Excluir esta automacao?')) return;

      const id = Number(button.dataset.id);
      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/automacoes/${id}`, { method: 'DELETE' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Erro ao excluir automacao');
        WorkflowUI.showToast('Automacao removida', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 400);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao excluir', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  });

  document.querySelectorAll('.automation-test-btn').forEach(function (button) {
    button.addEventListener('click', async function () {
      const id = Number(button.dataset.id);
      const payloadText = window.prompt('Informe payload JSON de teste', '{"ping":"ok"}');
      if (payloadText === null) return;

      let payload = {};
      try {
        payload = payloadText.trim() ? JSON.parse(payloadText) : {};
      } catch (_) {
        WorkflowUI.showToast('JSON invalido para teste', 'warning');
        return;
      }

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/automacoes/${id}/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: payload }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Falha no teste da automacao');

        WorkflowUI.showToast(`Teste OK (status ${body.status})`, 'success');
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Erro no teste', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  });
})();
