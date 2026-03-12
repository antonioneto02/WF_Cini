(function () {
  const seedEl = document.getElementById('dashboardPersonalizationSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent || '{}') : {};
  const personalization = seed.personalization || {};

  const openBtn = document.getElementById('wfCustomizeDashboardBtn');
  const modal = document.getElementById('wfDashboardPrefsModal');
  const cancelBtn = document.getElementById('wfCancelPrefsBtn');
  const form = document.getElementById('wfDashboardPrefsForm');
  const unreadCountEl = document.getElementById('wfDashboardNotifUnread');

  function decrementUnreadCounter() {
    if (!unreadCountEl) return;
    const current = Number(unreadCountEl.textContent || 0);
    unreadCountEl.textContent = String(Math.max(0, current - 1));
  }

  function bindNotificationActions() {
    document.querySelectorAll('.wf-dashboard-notif-read').forEach(function (button) {
      button.addEventListener('click', async function (event) {
        event.preventDefault();

        const id = Number(button.dataset.id || 0);
        if (!id) return;

        try {
          WorkflowUI.setLoader(true);
          const response = await fetch(`/api/notificacoes/${id}/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          });

          let body = {};
          try {
            body = await response.json();
          } catch (_) {}

          if (!response.ok) {
            throw new Error(body.message || 'Falha ao marcar notificacao como lida');
          }

          const row = button.closest('tr');
          const statusCell = row ? row.querySelector('[data-role="notif-status"]') : null;
          if (statusCell) {
            statusCell.innerHTML = '<span class="wf-badge-green">Lida</span>';
          }

          button.remove();
          decrementUnreadCounter();
          WorkflowUI.showToast('Notificacao marcada como lida', 'success');
        } catch (error) {
          WorkflowUI.showToast(error.message || 'Falha ao atualizar notificacao', 'error');
        } finally {
          WorkflowUI.setLoader(false);
        }
      });
    });
  }

  bindNotificationActions();

  if (!openBtn || !modal || !form) return;

  function setInitialChecks() {
    const current = new Set((personalization.widgets || []).map((item) => String(item || '').toLowerCase()));
    form.querySelectorAll('input[name="widgets"]').forEach(function (input) {
      input.checked = current.has(String(input.value || '').toLowerCase());
    });
  }

  function openModal() {
    setInitialChecks();
    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  openBtn.addEventListener('click', openModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const selectedWidgets = Array.from(form.querySelectorAll('input[name="widgets"]:checked')).map(function (input) {
      return input.value;
    });

    if (!selectedWidgets.length) {
      WorkflowUI.showToast('Selecione ao menos um widget', 'warning');
      return;
    }

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch('/api/dashboard/preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgets: selectedWidgets,
          perfil: personalization.perfil || null,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Nao foi possivel salvar as preferencias');

      WorkflowUI.showToast('Painel atualizado', 'success');
      setTimeout(function () {
        window.location.reload();
      }, 250);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao salvar preferencias', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  });
})();
