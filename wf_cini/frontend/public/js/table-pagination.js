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

  function initTablePagination(table) {
    if (!table || table.dataset.paginationReady === '1') return;

    const tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
    if (!tbody) return;

    let pageSize = normalizePageSize(table.dataset.pageSize, DEFAULT_PAGE_SIZE);
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const placeholderRows = allRows.filter(isPlaceholderRow);
    const dataRows = allRows.filter((row) => !isPlaceholderRow(row));

    let currentPage = 1;

    const host = document.createElement('div');
    host.className = 'wf-table-pagination';

    const info = document.createElement('div');
    info.className = 'wf-table-pagination-info';

    const controls = document.createElement('div');
    controls.className = 'wf-table-pagination-controls';

    const { wrapper: pageSizeWrapper, select: pageSizeSelect } = buildPageSizeSelector(pageSize);

    const prevBtn = buildButton('Anterior', 'prev');
    const nextBtn = buildButton('Proxima', 'next');

    controls.appendChild(pageSizeWrapper);
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    host.appendChild(info);
    host.appendChild(controls);

    table.insertAdjacentElement('afterend', host);

    function render() {
      const totalItems = dataRows.length;
      const effectivePageSize = pageSize === PAGE_SIZE_ALL
        ? Math.max(1, totalItems)
        : pageSize;
      const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      if (!totalItems) {
        placeholderRows.forEach((row) => setVisible(row, true));
      } else {
        const start = (currentPage - 1) * effectivePageSize;
        const end = start + effectivePageSize;
        dataRows.forEach((row, index) => setVisible(row, index >= start && index < end));
        placeholderRows.forEach((row) => setVisible(row, false));
      }

      const startItem = totalItems ? ((currentPage - 1) * effectivePageSize) + 1 : 0;
      const endItem = totalItems ? Math.min(currentPage * effectivePageSize, totalItems) : 0;
      info.textContent = `Pagina ${currentPage} de ${totalPages} • ${startItem}-${endItem} de ${totalItems}`;

      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    }

    prevBtn.addEventListener('click', () => {
      currentPage -= 1;
      render();
    });

    nextBtn.addEventListener('click', () => {
      currentPage += 1;
      render();
    });

    pageSizeSelect.addEventListener('change', () => {
      pageSize = normalizePageSize(pageSizeSelect.value, DEFAULT_PAGE_SIZE);
      currentPage = 1;
      render();
    });

    render();
    table.dataset.paginationReady = '1';
  }

  function initAllTables() {
    document.querySelectorAll('table.wf-table').forEach((table) => {
      if (table.dataset.pagination === 'off') return;
      initTablePagination(table);
    });
  }

  window.WorkflowTablePagination = {
    refresh: initAllTables,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllTables);
  } else {
    initAllTables();
  }
})();
