(function () {
  const PAGE_SIZE_ALL = 'all';
  const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, PAGE_SIZE_ALL];
  const DEFAULT_PAGE_SIZE = 10;

  function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
  }

  function normalizePageSize(value, fallback) {
    if (value === PAGE_SIZE_ALL || value === String(PAGE_SIZE_ALL)) {
      return PAGE_SIZE_ALL;
    }

    const num = toNumber(value, NaN);
    if (Number.isFinite(num) && PAGE_SIZE_OPTIONS.includes(num)) {
      return num;
    }

    return fallback;
  }

  function isPlaceholderRow(row) {
    if (!row || !row.cells || row.cells.length !== 1) return false;
    return Number(row.cells[0].colSpan || 0) > 1;
  }

  function setVisible(row, visible) {
    row.style.display = visible ? '' : 'none';
  }

  function buildButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wf-page-btn';
    button.dataset.action = action;
    button.textContent = label;
    return button;
  }

  function buildPageSizeSelector(initialValue) {
    const wrapper = document.createElement('label');
    wrapper.className = 'wf-page-size';
    wrapper.textContent = 'Registros por pagina';

    const select = document.createElement('select');
    select.className = 'wf-page-size-select';
    select.setAttribute('aria-label', 'Registros por pagina');

    PAGE_SIZE_OPTIONS.forEach((optionValue) => {
      const option = document.createElement('option');
      option.value = String(optionValue);
      option.textContent = optionValue === PAGE_SIZE_ALL ? 'Todos' : String(optionValue);
      if (optionValue === initialValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    wrapper.appendChild(select);

    return { wrapper, select };
  }

  // Keep state per table so we can refresh when rows are hidden/shown by filters
  const tableStates = new WeakMap();

  function initTablePagination(table) {
    if (!table) return;

    const tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
    if (!tbody) return;

    // compute current rows dynamically (only visible data rows are considered)
    function collectRows() {
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const placeholderRows = allRows.filter(isPlaceholderRow);
      const dataRows = allRows.filter((row) => !isPlaceholderRow(row) && getComputedStyle(row).display !== 'none');
      return { allRows, placeholderRows, dataRows };
    }

    let state = tableStates.get(table);
    if (!state) {
      // initial setup
      const { placeholderRows, dataRows } = collectRows();

      state = {
        table,
        tbody,
        pageSize: normalizePageSize(table.dataset.pageSize, DEFAULT_PAGE_SIZE),
        currentPage: 1,
        placeholderRows,
        dataRows,
        host: null,
        info: null,
        pageSizeSelect: null,
        prevBtn: null,
        nextBtn: null,
      };

      const host = document.createElement('div');
      host.className = 'wf-table-pagination';

      const info = document.createElement('div');
      info.className = 'wf-table-pagination-info';

      const controls = document.createElement('div');
      controls.className = 'wf-table-pagination-controls';

      const { wrapper: pageSizeWrapper, select: pageSizeSelect } = buildPageSizeSelector(state.pageSize);

      const prevBtn = buildButton('Anterior', 'prev');
      const nextBtn = buildButton('Proxima', 'next');

      controls.appendChild(pageSizeWrapper);
      controls.appendChild(prevBtn);
      controls.appendChild(nextBtn);

      host.appendChild(info);
      host.appendChild(controls);

      table.insertAdjacentElement('afterend', host);

      state.host = host;
      state.info = info;
      state.pageSizeSelect = pageSizeSelect;
      state.prevBtn = prevBtn;
      state.nextBtn = nextBtn;

      prevBtn.addEventListener('click', () => {
        state.currentPage -= 1;
        renderState(state);
      });

      nextBtn.addEventListener('click', () => {
        state.currentPage += 1;
        renderState(state);
      });

      pageSizeSelect.addEventListener('change', () => {
        state.pageSize = normalizePageSize(pageSizeSelect.value, DEFAULT_PAGE_SIZE);
        state.currentPage = 1;
        renderState(state);
      });

      tableStates.set(table, state);
    } else {
      // refresh existing state (e.g., on filter change)
      const rows = collectRows();
      state.placeholderRows = rows.placeholderRows;
      state.dataRows = rows.dataRows;
      // keep current page but clamp later
    }

    // render uses state to show/hide rows
    function renderState(s) {
      const totalItems = s.dataRows.length;
      const effectivePageSize = s.pageSize === PAGE_SIZE_ALL ? Math.max(1, totalItems) : s.pageSize;
      const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

      if (s.currentPage > totalPages) s.currentPage = totalPages;
      if (s.currentPage < 1) s.currentPage = 1;

      if (!totalItems) {
        s.placeholderRows.forEach((row) => setVisible(row, true));
      } else {
        const start = (s.currentPage - 1) * effectivePageSize;
        const end = start + effectivePageSize;
        // hide all data rows first
        const allData = Array.from(s.tbody.querySelectorAll('tr')).filter((r) => !isPlaceholderRow(r));
        allData.forEach((row) => setVisible(row, false));
        // show only the ones in current page that are visible
        s.dataRows.forEach((row, index) => setVisible(row, index >= start && index < end));
        s.placeholderRows.forEach((row) => setVisible(row, false));
      }

      const startItem = totalItems ? ((s.currentPage - 1) * effectivePageSize) + 1 : 0;
      const endItem = totalItems ? Math.min(s.currentPage * effectivePageSize, totalItems) : 0;
      s.info.textContent = `Pagina ${s.currentPage} de ${totalPages} • ${startItem}-${endItem} de ${totalItems}`;

      s.prevBtn.disabled = s.currentPage <= 1;
      s.nextBtn.disabled = s.currentPage >= totalPages;
    }

    // ensure state has up-to-date arrays
    const currentState = tableStates.get(table);
    const rows = (function () {
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      return {
        placeholderRows: allRows.filter(isPlaceholderRow),
        dataRows: allRows.filter((row) => !isPlaceholderRow(row) && getComputedStyle(row).display !== 'none'),
      };
    })();
    currentState.placeholderRows = rows.placeholderRows;
    currentState.dataRows = rows.dataRows;
    renderState(currentState);
    table.dataset.paginationReady = '1';
  }

  function initAllTables() {
    document.querySelectorAll('table.wf-table').forEach((table) => {
      if (table.dataset.pagination === 'off') return;
      initTablePagination(table);
    });
  }

  window.WorkflowTablePagination = {
    refresh: function (table) {
      if (table) {
        initTablePagination(table);
        return;
      }
      document.querySelectorAll('table.wf-table').forEach((tbl) => initTablePagination(tbl));
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllTables);
  } else {
    initAllTables();
  }
})();
