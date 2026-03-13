(function () {
  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function serializeAndNavigate(form) {
    try {
      const action = form.getAttribute('action') || window.location.pathname;
      const params = new URLSearchParams();
      const elements = Array.from(form.elements || []);

      elements.forEach((el) => {
        if (!el.name || el.disabled) return;
        const name = el.name;
        let value = '';

        if (el.type === 'checkbox') {
          if (!el.checked) return;
          value = el.value || 'on';
        } else if (el.type === 'radio') {
          if (!el.checked) return;
          value = el.value;
        } else if (el.tagName === 'SELECT' && el.multiple) {
          Array.from(el.selectedOptions).forEach((opt) => {
            if (opt.value != null && String(opt.value).length) params.append(name, opt.value);
          });
          return;
        } else {
          value = el.value;
        }

        if (value == null) return;
        const str = String(value).trim();
        if (str.length === 0) return;

        // map 'desc' => 'search' to keep server-side compatibility
        if (name === 'desc') {
          params.set('search', str);
        } else {
          params.set(name, str);
        }
      });

      const qs = params.toString();
      const url = qs ? `${action}${action.indexOf('?') === -1 ? '?' : '&'}${qs}` : action;
      window.location.href = url;
    } catch (err) {
      console.error('auto-filter error', err);
      form.submit();
    }
  }

  function findTargetTable(form) {
    // explicit selector via data-filter-target
    const targetSelector = form.dataset.filterTarget;
    if (targetSelector) {
      const el = document.querySelector(targetSelector);
      if (el && el.tagName === 'TABLE') return el;
    }

    // try to find table in closest panel or content area
    const panel = form.closest('.wf-panel') || form.closest('.wf-content') || form.parentElement;
    if (panel) {
      const table = panel.querySelector('table.wf-table');
      if (table) return table;
    }

    // fallback: next table sibling
    let sib = form.parentElement && form.parentElement.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'TABLE' && sib.classList.contains('wf-table')) return sib;
      const childTable = sib.querySelector && sib.querySelector('table.wf-table');
      if (childTable) return childTable;
      sib = sib.nextElementSibling;
    }

    return null;
  }

  function buildHeaderMap(table) {
    const headers = [];
    const thead = table.tHead || table.querySelector('thead');
    if (thead) {
      const ths = Array.from(thead.querySelectorAll('th'));
      ths.forEach((th) => headers.push((th.textContent || '').trim().toLowerCase()));
    }
    return headers;
  }

  function isPlaceholderRow(row) {
    if (!row || !row.cells || row.cells.length !== 1) return false;
    return Number(row.cells[0].colSpan || 0) > 1;
  }

  function parseDateFromCell(text) {
    if (!text) return null;
    // expect dd/mm/yyyy or dd/mm/yyyy hh:mm
    const parts = text.trim().split(' ');
    const datePart = parts[0];
    const m = datePart.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3]);
    let hour = 0, minute = 0;
    if (parts[1]) {
      const tm = parts[1].match(/(\d{1,2}):(\d{2})/);
      if (tm) { hour = Number(tm[1]); minute = Number(tm[2]); }
    }
    return new Date(year, month, day, hour, minute, 0, 0);
  }

  function rowMatchesFilters(row, headers, filters) {
    const cells = Array.from(row.cells || []);
    for (const key in filters) {
      const raw = String(filters[key] || '').trim();
      if (!raw) continue;
      const val = raw.toLowerCase();

      if (key === 'startDate' || key === 'endDate') {
        // find date column index
        const dateIdx = headers.findIndex(h => h.includes('data') || h.includes('iniciado') || h.includes('criado'));
        if (dateIdx === -1) {
          // fallback: try to match within whole row text
          const rowText = (row.textContent || '').toLowerCase();
          if (!rowText.includes(val)) return false;
          continue;
        }
        const cellText = (cells[dateIdx] && cells[dateIdx].textContent) ? cells[dateIdx].textContent.trim() : '';
        const cellDate = parseDateFromCell(cellText);
        if (!cellDate) return false;
        const filterDate = new Date(val);
        if (key === 'startDate' && cellDate < filterDate) return false;
        if (key === 'endDate') {
          // include the end date entire day
          const end = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 23, 59, 59, 999);
          if (cellDate > end) return false;
        }
        continue;
      }

      // map filter key to header index heuristically
      let idx = -1;
      if (key === 'processName' || key.toLowerCase().includes('process')) idx = headers.findIndex(h => h.includes('process') || h.includes('processo'));
      if (idx === -1 && (key === 'instanciaId' || key.toLowerCase().includes('instancia') || key.toLowerCase().includes('solicit'))) idx = headers.findIndex(h => h.includes('solicit') || h.includes('#') || h.includes('solicita'));
      if (idx === -1 && key === 'identificador') idx = headers.findIndex(h => h.includes('identificador'));
      if (idx === -1 && (key === 'desc' || key.toLowerCase().includes('desc'))) idx = headers.findIndex(h => h.includes('desc') || h.includes('descri'));
      if (idx === -1 && key === 'responsavel') idx = headers.findIndex(h => h.includes('respons') || h.includes('responsável'));
      if (idx === -1 && key === 'status') idx = headers.findIndex(h => h.includes('status'));

      let cellText = '';
      if (idx !== -1 && cells[idx]) {
        cellText = (cells[idx].textContent || '').toLowerCase();
      } else {
        cellText = (row.textContent || '').toLowerCase();
      }

      if (!cellText.includes(val)) return false;
    }
    return true;
  }

  function applyDomFilter(form) {
    const table = findTargetTable(form);
    if (!table) return serializeAndNavigate(form); // fallback to server navigation

    const headers = buildHeaderMap(table);
    const tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
    if (!tbody) return;

    const elements = Array.from(form.elements || []);
    const filters = {};
    elements.forEach((el) => {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) return;
        filters[el.name] = el.value;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        const vals = Array.from(el.selectedOptions).map(o => o.value).filter(Boolean);
        if (vals.length) filters[el.name] = vals.join(' ');
      } else {
        const v = String(el.value || '').trim();
        if (v.length) filters[el.name] = v;
      }
    });

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let anyVisible = false;
    rows.forEach((row) => {
      if (isPlaceholderRow(row)) return; // keep placeholders handled by pagination
      const visible = rowMatchesFilters(row, headers, filters);
      row.style.display = visible ? '' : 'none';
      if (visible) anyVisible = true;
    });

    // after hiding rows, refresh pagination so it recalculates pages
    if (window.WorkflowTablePagination && typeof window.WorkflowTablePagination.refresh === 'function') {
      window.WorkflowTablePagination.refresh(table);
    }

    // if no rows visible we keep placeholders visible via pagination
    return anyVisible;
  }

  function init() {
    const forms = Array.from(document.querySelectorAll('.wf-filter-bar form'));
    forms.forEach((form) => {
      // hide submit buttons inside filter forms
      Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]')).forEach((btn) => {
        btn.style.display = 'none';
      });
      // intercept manual submits (enter key)
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        applyDomFilter(form);
      });

      const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
      inputs.forEach((el) => {
        if (!el.name) return;
        // ignore hidden inputs
        if (el.type === 'hidden') return;
        if (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio') {
          el.addEventListener('change', debounce(() => applyDomFilter(form), 200));
        } else {
          el.addEventListener('input', debounce(() => applyDomFilter(form), 300));
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
