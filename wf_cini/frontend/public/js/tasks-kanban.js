(function () {
  function formatSlaBadges() {
    document.querySelectorAll('.sla-badge').forEach(function (badge) {
      const createdAt = Number(badge.dataset.createdAtMs || 0);
      const completedAt = Number(badge.dataset.completedAtMs || 0);
      const status = String(badge.dataset.status || '').toUpperCase();
      const slaHours = Number(badge.dataset.slaHours || 24);
      const expiresAt = createdAt + slaHours * 3600 * 1000;
      const referenceTime = status === 'CONCLUIDA' && completedAt ? completedAt : Date.now();
      const diff = expiresAt - referenceTime;

      if (!createdAt || Number.isNaN(expiresAt)) {
        badge.textContent = 'N/A';
        return;
      }

      const hoursDelta = Math.round(Math.abs(diff) / 3600000);

      if (status === 'CONCLUIDA') {
        if (diff < 0) {
          badge.textContent = `Concluida com atraso ${hoursDelta}h`;
          badge.className = 'sla-badge text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700';
        } else {
          badge.textContent = 'Concluida no prazo';
          badge.className = 'sla-badge text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
        }
        return;
      }

      const hoursLeft = Math.round(diff / 3600000);
      if (hoursLeft < 0) {
        badge.textContent = `Atrasada ${Math.abs(hoursLeft)}h`;
        badge.className = 'sla-badge text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700';
      } else if (hoursLeft <= 4) {
        badge.textContent = `Vence em ${hoursLeft}h`;
        badge.className = 'sla-badge text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700';
      } else {
        badge.textContent = `Dentro SLA (${hoursLeft}h)`;
        badge.className = 'sla-badge text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700';
      }
    });
  }

  formatSlaBadges();
})();
