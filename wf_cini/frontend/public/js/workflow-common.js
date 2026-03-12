(function () {
  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const tone = type || 'info';

    const color = {
      success: 'bg-emerald-600',
      error: 'bg-rose-600',
      warning: 'bg-amber-500',
      info: 'bg-cyan-600',
    }[tone] || 'bg-cyan-600';

    toast.className = `${color} text-white px-4 py-3 rounded-xl shadow-lg mb-3 text-sm animate-[fadeIn_.2s_ease]`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'all .2s ease';
      setTimeout(function () {
        toast.remove();
      }, 240);
    }, 2700);
  }

  function setLoader(show) {
    const loader = document.getElementById('globalLoader');
    if (!loader) return;
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
  }

  window.WorkflowUI = {
    showToast,
    setLoader,
    confirmDelete: function (msg) {
      return window.confirm(msg || 'Confirma esta acao?');
    },
  };
})();
document.addEventListener('DOMContentLoaded', function () {
  try {
    const wfApp = document.querySelector('.wf-app');
    const sidebar = document.querySelector('.wf-sidebar');

    // ensure collapsed-by-default class is present for hover behavior
    if (wfApp && !wfApp.classList.contains('wf-sidebar-collapsed')) {
      wfApp.classList.add('wf-sidebar-collapsed');
    }

    // keyboard accessibility: expand while focus inside sidebar
    if (sidebar && wfApp) {
      sidebar.addEventListener('focusin', function () {
        wfApp.classList.add('wf-sidebar-hovered');
      });
      sidebar.addEventListener('focusout', function () {
        wfApp.classList.remove('wf-sidebar-hovered');
      });
    }

    // User dropdown (show logout only after clicking the user)
    const userToggle = document.getElementById('wfUserToggle');
    const userDropdown = document.getElementById('wfUserDropdown');
    function closeUserDropdown() { if (userDropdown) { userDropdown.style.display = 'none'; if (userToggle) userToggle.setAttribute('aria-expanded', 'false'); } }
    function openUserDropdown() { if (userDropdown) { userDropdown.style.display = 'block'; if (userToggle) userToggle.setAttribute('aria-expanded', 'true'); } }
    if (userToggle && userDropdown) {
      userToggle.addEventListener('click', function (e) { e.preventDefault(); if (userDropdown.style.display === 'block') closeUserDropdown(); else openUserDropdown(); });
      document.addEventListener('click', function (e) { if (userToggle && userDropdown && !userToggle.contains(e.target) && !userDropdown.contains(e.target)) closeUserDropdown(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeUserDropdown(); });
    }

    // Notifications dropdown
    const notifToggle = document.getElementById('wfNotifToggle');
    const notifDropdown = document.getElementById('wfNotifDropdown');
    const notifBadge = document.getElementById('wfNotifBadge');
    const notifList = document.getElementById('wfNotifList');
    const markAllBtn = document.getElementById('wfNotifMarkAllBtn');

    function closeNotifDropdown() {
      if (notifDropdown) notifDropdown.style.display = 'none';
      if (notifToggle) notifToggle.setAttribute('aria-expanded', 'false');
    }

    function openNotifDropdown() {
      if (notifDropdown) notifDropdown.style.display = 'block';
      if (notifToggle) notifToggle.setAttribute('aria-expanded', 'true');
    }

    function parseScopeUrl(item) {
      if (!item) return null;
      if (String(item.escopo_tipo || '').toUpperCase() === 'TASK' && item.escopo_id) return `/tarefas/${item.escopo_id}`;
      if (String(item.escopo_tipo || '').toUpperCase() === 'INSTANCE' && item.escopo_id) return `/solicitacoes/${item.escopo_id}`;
      if (String(item.escopo_tipo || '').toUpperCase() === 'PROCESS' && item.escopo_id) return `/processos/${item.escopo_id}`;
      return null;
    }

    async function markNotificationRead(id) {
      if (!id) return;
      const response = await fetch(`/api/notificacoes/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        let message = 'Falha ao marcar notificacao como lida';
        try {
          const body = await response.json();
          if (body && body.message) message = body.message;
        } catch (_) {}
        throw new Error(message);
      }
    }

    function renderNotifications(data, unread) {
      if (notifBadge) {
        const totalUnread = Number(unread || 0);
        notifBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        notifBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
      }

      if (!notifList) return;

      if (!Array.isArray(data) || !data.length) {
        notifList.innerHTML = '<p class="wf-notif-empty">Nenhuma notificacao.</p>';
        return;
      }

      notifList.innerHTML = data.map(function (item) {
        const isUnread = String(item.status || '').toUpperCase() === 'UNREAD';
        const targetUrl = parseScopeUrl(item);
        return `<div class="wf-notif-item ${isUnread ? 'unread' : ''}" data-id="${item.id}" data-url="${targetUrl || ''}">
          <div class="wf-notif-main">
            <div class="wf-notif-title">${item.titulo || '-'}</div>
            <div class="wf-notif-msg">${item.mensagem || '-'}</div>
          </div>
          <div class="wf-notif-actions">
            ${isUnread ? `<button type="button" class="wf-notif-action-read" data-id="${item.id}">Marcar lida</button>` : ''}
          </div>
        </div>`;
      }).join('');

      notifList.querySelectorAll('.wf-notif-action-read').forEach(function (button) {
        button.addEventListener('click', async function (event) {
          event.preventDefault();
          event.stopPropagation();

          const id = Number(button.dataset.id || 0);
          if (!id) return;

          try {
            await markNotificationRead(id);
            await loadNotifications();
          } catch (_) {
            if (window.WorkflowUI) window.WorkflowUI.showToast('Falha ao marcar notificacao', 'error');
          }
        });
      });

      notifList.querySelectorAll('.wf-notif-item').forEach(function (row) {
        row.addEventListener('click', async function (event) {
          if (event.target && event.target.closest('.wf-notif-action-read')) return;

          const id = Number(row.dataset.id || 0);
          const url = row.dataset.url || '';

          try {
            await markNotificationRead(id);
          } catch (_) {}

          if (url) {
            window.location.href = url;
            return;
          }

          await loadNotifications();
        });
      });
    }

    async function loadNotifications() {
      try {
        const response = await fetch('/api/notificacoes?page=1&pageSize=12');
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Falha ao carregar notificacoes');
        renderNotifications(body.data || [], body.unread || 0);
      } catch (_) {
        if (notifList) notifList.innerHTML = '<p class="wf-notif-empty">Falha ao carregar notificacoes.</p>';
      }
    }

    if (notifToggle && notifDropdown) {
      notifToggle.addEventListener('click', async function (e) {
        e.preventDefault();
        if (notifDropdown.style.display === 'block') {
          closeNotifDropdown();
          return;
        }

        openNotifDropdown();
        await loadNotifications();
      });

      document.addEventListener('click', function (e) {
        if (!notifToggle.contains(e.target) && !notifDropdown.contains(e.target)) closeNotifDropdown();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeNotifDropdown();
      });

      if (markAllBtn) {
        markAllBtn.addEventListener('click', async function () {
          try {
            await fetch('/api/notificacoes/read-all', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
            });
            await loadNotifications();
            if (window.WorkflowUI) window.WorkflowUI.showToast('Notificacoes marcadas como lidas', 'success');
          } catch (_) {
            if (window.WorkflowUI) window.WorkflowUI.showToast('Falha ao atualizar notificacoes', 'error');
          }
        });
      }

      loadNotifications();
      setInterval(loadNotifications, 60000);
    }
  } catch (e) {}
});
