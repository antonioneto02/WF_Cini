(function () {
  const seedEl = document.getElementById('formBuilderSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent || '{}') : {};

  const state = {
    fields: [],
    editingFormId: null,
    formsMap: new Map((seed.forms || []).map((form) => [Number(form.id), form])),
  };

  const refs = {
    formBuilder: document.getElementById('formBuilder'),
    processoId: document.getElementById('processoId'),
    formNome: document.getElementById('formNome'),
    schemaPreview: document.getElementById('schemaPreview'),
    dropzone: document.getElementById('formFieldDropzone'),
    fieldList: document.getElementById('formFieldList'),
    dropzoneHint: document.getElementById('dropzoneHint'),
    saveFormBtn: document.getElementById('saveFormBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    formsList: document.getElementById('formsList'),
  };

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function parseSchema(schemaJson) {
    if (!schemaJson) return { fields: [] };
    if (typeof schemaJson === 'object') return schemaJson;
    try {
      return JSON.parse(schemaJson);
    } catch (err) {
      return { fields: [] };
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTypeDefaults(type) {
    const defaults = {
      text: { dbType: 'varchar', maxLength: 255 },
      textarea: { dbType: 'varchar', maxLength: 1000 },
      number: { dbType: 'decimal', precision: 18, scale: 2 },
      date: { dbType: 'date', dateMode: 'date' },
      select: { dbType: 'varchar', maxLength: 120, options: [{ label: 'Opcao 1', value: 'opcao_1' }] },
      checkbox: { dbType: 'bit', checkedValue: '1', uncheckedValue: '0' },
      upload: { dbType: 'varchar', maxLength: 255 },
    };
    return defaults[type] || defaults.text;
  }

  function parseOptionsText(raw) {
    if (!raw || !raw.trim()) return [];
    return raw
      .split(',')
      .map(function (item) {
        const parts = item.split('|').map(function (part) {
          return part.trim();
        });
        return {
          label: parts[0] || '',
          value: parts[1] || parts[0] || '',
        };
      })
      .filter(function (item) {
        return item.label && item.value;
      });
  }

  function optionsToText(options) {
    if (!Array.isArray(options) || !options.length) return '';
    return options
      .map(function (option) {
        return `${option.label || ''}|${option.value || ''}`;
      })
      .join(', ');
  }

  function normalizeField(field, index) {
    const type = field.type || 'text';
    const defaults = getTypeDefaults(type);
    const label = field.label || field.name || `Campo ${index + 1}`;
    const normalized = {
      label,
      name: field.name || slugify(label) || `campo_${index + 1}`,
      type,
      required: Boolean(field.required),
      dbType: field.dbType || defaults.dbType,
      options: Array.isArray(field.options) ? field.options : (defaults.options || []),
    };

    if (type === 'number') {
      normalized.precision = Number(field.precision) || defaults.precision;
      normalized.scale = Number(field.scale) || defaults.scale;
    } else if (type === 'checkbox') {
      normalized.checkedValue = String(field.checkedValue !== undefined ? field.checkedValue : defaults.checkedValue);
      normalized.uncheckedValue = String(field.uncheckedValue !== undefined ? field.uncheckedValue : defaults.uncheckedValue);
    } else if (type === 'date') {
      normalized.dateMode = field.dateMode || defaults.dateMode;
    } else {
      const maxLength = Number(field.maxLength || field.size) || defaults.maxLength || 255;
      normalized.maxLength = maxLength;
      normalized.size = maxLength;
    }

    return normalized;
  }

  function getTechnicalTypeLabel(field) {
    if (field.type === 'number') {
      return `decimal(${Number(field.precision) || 18},${Number(field.scale) || 2})`;
    }
    if (field.type === 'checkbox') {
      return 'bit';
    }
    if (field.type === 'date') {
      return field.dateMode === 'datetime' ? 'datetime' : 'date';
    }
    const maxLength = Number(field.maxLength || field.size) || 255;
    return `varchar(${maxLength})`;
  }

  function buildDefaultField(type) {
    const count = state.fields.length + 1;
    return normalizeField({
      label: `Campo ${count}`,
      type,
      required: false,
    }, count - 1);
  }

  function updateField(index, patch, options) {
    const current = state.fields[index];
    if (!current) return;
    const live = Boolean(options && options.live);

    state.fields[index] = Object.assign({}, current, patch);
    if (patch.label !== undefined) {
      const normalized = slugify(state.fields[index].label);
      if (normalized) {
        state.fields[index].name = normalized;
      }
    }
    if (state.fields[index].type !== 'number' && state.fields[index].type !== 'checkbox' && state.fields[index].type !== 'date') {
      const maxLength = Number(state.fields[index].maxLength || state.fields[index].size) || 255;
      state.fields[index].maxLength = maxLength;
      state.fields[index].size = maxLength;
    }
    if (live) {
      refreshPreviewOnly();
      return;
    }

    refreshPreview();
  }

  function renderTypeConfig(field, index) {
    if (field.type === 'number') {
      return `
        <div class="grid md:grid-cols-12 gap-2 items-end bg-white/70 rounded-lg p-2 border border-slate-200">
          <div class="md:col-span-3">
            <label class="text-xs text-slate-600 block mb-1">Precisao</label>
            <input type="number" min="1" max="38" class="field-input-precision w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${Number(field.precision) || 18}" />
          </div>
          <div class="md:col-span-3">
            <label class="text-xs text-slate-600 block mb-1">Escala</label>
            <input type="number" min="0" max="10" class="field-input-scale w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${Number(field.scale) || 2}" />
          </div>
          <div class="md:col-span-6">
            <label class="text-xs text-slate-600 block mb-1">Tipo tecnico</label>
            <input type="text" class="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-100 text-xs" value="${escapeHtml(getTechnicalTypeLabel(field))}" readonly />
          </div>
        </div>`;
    }

    if (field.type === 'checkbox') {
      return `
        <div class="grid md:grid-cols-12 gap-2 items-end bg-white/70 rounded-lg p-2 border border-slate-200">
          <div class="md:col-span-4">
            <label class="text-xs text-slate-600 block mb-1">Valor marcado</label>
            <input type="text" class="field-input-checked-value w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${escapeHtml(field.checkedValue || '1')}" />
          </div>
          <div class="md:col-span-4">
            <label class="text-xs text-slate-600 block mb-1">Valor desmarcado</label>
            <input type="text" class="field-input-unchecked-value w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${escapeHtml(field.uncheckedValue || '0')}" />
          </div>
          <div class="md:col-span-4">
            <label class="text-xs text-slate-600 block mb-1">Tipo tecnico</label>
            <input type="text" class="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-100 text-xs" value="bit" readonly />
          </div>
        </div>`;
    }

    if (field.type === 'date') {
      return `
        <div class="grid md:grid-cols-12 gap-2 items-end bg-white/70 rounded-lg p-2 border border-slate-200">
          <div class="md:col-span-4">
            <label class="text-xs text-slate-600 block mb-1">Modo de data</label>
            <select class="field-input-date-mode w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}">
              <option value="date" ${field.dateMode === 'date' ? 'selected' : ''}>Somente data</option>
              <option value="datetime" ${field.dateMode === 'datetime' ? 'selected' : ''}>Data e hora</option>
            </select>
          </div>
          <div class="md:col-span-8">
            <label class="text-xs text-slate-600 block mb-1">Tipo tecnico</label>
            <input type="text" class="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-100 text-xs" value="${escapeHtml(getTechnicalTypeLabel(field))}" readonly />
          </div>
        </div>`;
    }

    const maxLength = Number(field.maxLength || field.size) || 255;
    const selectOptions = field.type === 'select'
      ? `
          <div class="md:col-span-12">
            <label class="text-xs text-slate-600 block mb-1">Opcoes (label|valor separadas por virgula)</label>
            <input type="text" class="field-input-options w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${escapeHtml(optionsToText(field.options))}" placeholder="Aberto|aberto, Fechado|fechado" />
          </div>`
      : '';

    return `
      <div class="grid md:grid-cols-12 gap-2 items-end bg-white/70 rounded-lg p-2 border border-slate-200">
        <div class="md:col-span-4">
          <label class="text-xs text-slate-600 block mb-1">Tamanho (chars)</label>
          <input type="number" min="1" max="8000" class="field-input-maxlength w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${maxLength}" />
        </div>
        <div class="md:col-span-8">
          <label class="text-xs text-slate-600 block mb-1">Tipo tecnico</label>
          <input type="text" class="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-100 text-xs" value="${escapeHtml(getTechnicalTypeLabel(field))}" readonly />
        </div>
        ${selectOptions}
      </div>`;
  }

  function refreshPreviewOnly() {
    refs.schemaPreview.textContent = JSON.stringify({ fields: state.fields }, null, 2);
    if (refs.dropzoneHint) refs.dropzoneHint.style.display = state.fields.length ? 'none' : 'block';
  }

  function refreshPreview() {
    refreshPreviewOnly();
    renderFieldList();
  }

  function renderFieldList() {
    if (!refs.fieldList) return;
    refs.fieldList.innerHTML = '';

    state.fields.forEach(function (field, index) {
      const item = document.createElement('article');
      item.className = 'rounded-lg border border-slate-200 p-3 bg-slate-50';
      item.innerHTML = `
        <div class="grid md:grid-cols-12 gap-3 items-end">
          <div class="md:col-span-5">
            <label class="text-xs text-slate-600 block mb-1">Nome do campo</label>
            <input type="text" class="field-input-name w-full h-9 px-2 rounded-lg border border-slate-300 text-sm" data-idx="${index}" value="${escapeHtml(field.label || '')}" />
          </div>
          <div class="md:col-span-3">
            <label class="text-xs text-slate-600 block mb-1">Tipo de campo</label>
            <input type="text" class="w-full h-9 px-2 rounded-lg border border-slate-200 bg-slate-100 text-sm" value="${escapeHtml(field.type)}" readonly />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs text-slate-600 block mb-1">Obrigatorio</label>
            <label class="h-9 inline-flex items-center gap-2 text-sm">
              <input type="checkbox" class="field-input-required" data-idx="${index}" ${field.required ? 'checked' : ''} />
              <span>Sim</span>
            </label>
          </div>
          <div class="md:col-span-2">
            <button type="button" data-remove-idx="${index}" class="w-full h-9 px-2 rounded border border-rose-300 text-rose-700 text-xs">Remover</button>
          </div>
          <div class="md:col-span-12">
            ${renderTypeConfig(field, index)}
          </div>
          <div class="md:col-span-12">
            <p class="field-meta text-[11px] text-slate-500">${field.type} • ${field.name || ''}</p>
          </div>
        </div>`;
      refs.fieldList.appendChild(item);
    });

    refs.fieldList.querySelectorAll('.field-input-name').forEach(function (input) {
      input.addEventListener('input', function () {
        const idx = Number(input.dataset.idx);
        const nextLabel = input.value;
        updateField(idx, { label: nextLabel }, { live: true });

        const parent = input.closest('article');
        const meta = parent ? parent.querySelector('.field-meta') : null;
        const field = state.fields[idx];
        if (meta && field) {
          meta.textContent = `${field.type} • ${field.name || ''}`;
        }
      });

      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        if (!state.fields[idx].label || !state.fields[idx].label.trim()) {
          updateField(idx, { label: `Campo ${idx + 1}` });
          return;
        }
        refreshPreview();
      });
    });

    refs.fieldList.querySelectorAll('.field-input-maxlength').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        const parsed = Number(input.value);
        const safeSize = Math.max(1, Math.min(8000, Number.isFinite(parsed) ? parsed : 255));
        input.value = String(safeSize);
        updateField(idx, { maxLength: safeSize, size: safeSize });
      });
    });

    refs.fieldList.querySelectorAll('.field-input-precision').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        const parsed = Number(input.value);
        const safe = Math.max(1, Math.min(38, Number.isFinite(parsed) ? parsed : 18));
        input.value = String(safe);
        updateField(idx, { precision: safe });
      });
    });

    refs.fieldList.querySelectorAll('.field-input-scale').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        const parsed = Number(input.value);
        const precision = Number(state.fields[idx] && state.fields[idx].precision) || 18;
        const safe = Math.max(0, Math.min(precision, Number.isFinite(parsed) ? parsed : 2));
        input.value = String(safe);
        updateField(idx, { scale: safe });
      });
    });

    refs.fieldList.querySelectorAll('.field-input-checked-value').forEach(function (input) {
      input.addEventListener('input', function () {
        const idx = Number(input.dataset.idx);
        updateField(idx, { checkedValue: input.value }, { live: true });
      });

      input.addEventListener('change', function () {
        refreshPreview();
      });
    });

    refs.fieldList.querySelectorAll('.field-input-unchecked-value').forEach(function (input) {
      input.addEventListener('input', function () {
        const idx = Number(input.dataset.idx);
        updateField(idx, { uncheckedValue: input.value }, { live: true });
      });

      input.addEventListener('change', function () {
        refreshPreview();
      });
    });

    refs.fieldList.querySelectorAll('.field-input-date-mode').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        updateField(idx, { dateMode: input.value === 'datetime' ? 'datetime' : 'date' });
      });
    });

    refs.fieldList.querySelectorAll('.field-input-options').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        updateField(idx, { options: parseOptionsText(input.value) });
      });
    });

    refs.fieldList.querySelectorAll('.field-input-required').forEach(function (input) {
      input.addEventListener('change', function () {
        const idx = Number(input.dataset.idx);
        updateField(idx, { required: Boolean(input.checked) });
      });
    });

    refs.fieldList.querySelectorAll('button[data-remove-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const idx = Number(btn.dataset.removeIdx);
        state.fields.splice(idx, 1);
        refreshPreview();
      });
    });
  }

  function setEditMode(form) {
    state.editingFormId = Number(form.id);
    const schema = parseSchema(form.schema_json);
    state.fields = (schema.fields || []).map(function (field, index) {
      return normalizeField(field, index);
    });

    refs.formNome.value = form.nome || '';
    refs.processoId.value = String(form.processo_id || '');
    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.remove('hidden');
    if (refs.saveFormBtn) refs.saveFormBtn.textContent = 'Salvar alteracoes';

    refreshPreview();
    WorkflowUI.showToast('Formulario carregado para edicao', 'info');
  }

  function resetBuilder() {
    state.editingFormId = null;
    state.fields = [];
    refs.formBuilder.reset();
    try {
      const initial = refs.processoId.dataset ? refs.processoId.dataset.initial : null;
      if (initial) refs.processoId.value = initial;
    } catch (err) {
      // no-op
    }

    if (refs.cancelEditBtn) refs.cancelEditBtn.classList.add('hidden');
    if (refs.saveFormBtn) refs.saveFormBtn.textContent = 'Salvar formulario';
    refreshPreview();
  }

  async function submitForm(event) {
    event.preventDefault();

    if (!state.fields.length) {
      WorkflowUI.showToast('Adicione ao menos um campo', 'warning');
      return;
    }

    const processoId = Number(refs.processoId.value);
    const nome = refs.formNome.value.trim();

    if (!processoId) {
      WorkflowUI.showToast('Selecione um processo valido', 'warning');
      return;
    }

    if (!nome) {
      WorkflowUI.showToast('Informe o nome do formulario', 'warning');
      return;
    }

    const payload = {
      processoId,
      nome,
      schema: { fields: state.fields },
    };

    const isEditing = Boolean(state.editingFormId);
    const url = isEditing ? `/api/formularios/${state.editingFormId}` : '/api/formularios';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao salvar formulario');

      WorkflowUI.showToast(isEditing ? 'Formulario atualizado com sucesso' : 'Formulario salvo com sucesso', 'success');
      setTimeout(function () {
        window.location.reload();
      }, 500);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao salvar formulario', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  }

  function attachDragAndDrop() {
    document.querySelectorAll('.field-template').forEach(function (template) {
      template.addEventListener('dragstart', function (event) {
        event.dataTransfer.setData('text/plain', template.dataset.type || 'text');
      });
    });

    if (!refs.dropzone) return;

    refs.dropzone.addEventListener('dragover', function (event) {
      event.preventDefault();
      refs.dropzone.classList.add('border-ciniBlue', 'bg-cyan-50');
    });

    refs.dropzone.addEventListener('dragleave', function () {
      refs.dropzone.classList.remove('border-ciniBlue', 'bg-cyan-50');
    });

    refs.dropzone.addEventListener('drop', function (event) {
      event.preventDefault();
      refs.dropzone.classList.remove('border-ciniBlue', 'bg-cyan-50');

      const type = event.dataTransfer.getData('text/plain') || 'text';
      state.fields.push(buildDefaultField(type));
      refreshPreview();
      WorkflowUI.showToast(`Campo ${type} adicionado`, 'info');
    });
  }

  function attachEditButtons() {
    if (!refs.formsList) return;
    refs.formsList.querySelectorAll('.edit-form-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = Number(btn.dataset.formId);
        const form = state.formsMap.get(id);
        if (!form) {
          WorkflowUI.showToast('Formulario nao encontrado para edicao', 'warning');
          return;
        }
        setEditMode(form);
      });
    });
  }

  function attachDeleteButtons() {
    if (!refs.formsList) return;
    refs.formsList.querySelectorAll('.delete-form-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = Number(btn.dataset.formId);
        const name = btn.dataset.formName || `#${id}`;

        if (!WorkflowUI.confirmDelete(`Excluir formulario "${name}"?`)) {
          return;
        }

        try {
          WorkflowUI.setLoader(true);
          const response = await fetch(`/api/formularios/${id}`, { method: 'DELETE' });
          const body = await response.json();
          if (!response.ok) throw new Error(body.message || 'Erro ao excluir formulario');

          WorkflowUI.showToast('Formulario excluido com sucesso', 'success');
          setTimeout(function () {
            window.location.reload();
          }, 450);
        } catch (error) {
          WorkflowUI.showToast(error.message || 'Falha ao excluir formulario', 'error');
        } finally {
          WorkflowUI.setLoader(false);
        }
      });
    });
  }

  async function loadProcessos() {
    try {
      const res = await fetch('/api/processos?page=1&pageSize=200');
      const body = await res.json();
      const list = body && body.data ? body.data : [];
      if (!refs.processoId) return;

      refs.processoId.innerHTML = '<option value="">Selecione um processo...</option>';
      list.forEach(function (p) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.codigo ? `${p.codigo} - ` : '') + p.nome;
        refs.processoId.appendChild(opt);
      });

      try {
        const initial = refs.processoId.dataset ? refs.processoId.dataset.initial : null;
        if (initial) refs.processoId.value = initial;
      } catch (err) {
        // no-op
      }
    } catch (err) {
      WorkflowUI.showToast('Falha ao carregar processos', 'error');
    }
  }

  if (refs.formBuilder) refs.formBuilder.addEventListener('submit', submitForm);
  if (refs.cancelEditBtn) refs.cancelEditBtn.addEventListener('click', resetBuilder);

  attachDragAndDrop();
  attachEditButtons();
  attachDeleteButtons();
  refreshPreview();
  loadProcessos();
})();
