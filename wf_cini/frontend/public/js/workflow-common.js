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
  } catch (e) {}
});
