(function () {
  const form = document.getElementById('startProcessForm');
  const formSelect = document.getElementById('startFormSelect');
  const formRoot = document.getElementById('startDynamicFormRoot');
  const seedEl = document.getElementById('startProcessSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent) : { forms: [] };

  if (!form || !formSelect || !formRoot) return;

  function parseSchema(raw) {
    if (!raw) return { fields: [] };
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return { fields: [] };
    }
  }

  function createField(field) {
    const wrapper = document.createElement('div');
    wrapper.className = 'grid gap-1';

    const label = document.createElement('label');
    label.className = 'text-sm font-semibold';
    label.textContent = field.label || field.name || 'Campo';
    wrapper.appendChild(label);

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      (field.options || []).forEach(function (opt) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        input.appendChild(option);
      });
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      if (field.checkedValue !== undefined) input.dataset.checkedValue = String(field.checkedValue);
      if (field.uncheckedValue !== undefined) input.dataset.uncheckedValue = String(field.uncheckedValue);
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
    } else if (field.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
    } else if (field.type === 'upload') {
      input = document.createElement('input');
      input.type = 'file';
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }

    input.name = field.name || '';
    if (field.type === 'checkbox') {
      input.className = 'h-4 w-4 rounded border border-slate-300 justify-self-start mt-1';
    } else {
      input.className = 'w-full px-3 py-2 rounded-xl border border-slate-300';
    }
    if (field.required) input.required = true;
    const maxLength = Number(field.maxLength || field.size);
    if ((input.type === 'text' || input.tagName === 'TEXTAREA') && Number.isFinite(maxLength) && maxLength > 0) {
      input.maxLength = maxLength;
    }
    wrapper.appendChild(input);
    return wrapper;
  }

  function renderFormBySelection() {
    const selectedId = Number(formSelect.value || 0);
    const selected = (seed.forms || []).find(function (f) {
      return Number(f.id) === selectedId;
    });

    formRoot.innerHTML = '';
    if (!selected) return;

    const schema = parseSchema(selected.schema_json);
    const fields = Array.isArray(schema.fields) ? schema.fields : [];

    if (!fields.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-slate-500';
      empty.textContent = 'Formulario selecionado nao possui campos.';
      formRoot.appendChild(empty);
      return;
    }

    fields.forEach(function (field) {
      formRoot.appendChild(createField(field));
    });
  }

  function collectDynamicPayload() {
    const payload = {};
    formRoot.querySelectorAll('[name]').forEach(function (input) {
      if (!input.name) return;
      if (input.type === 'checkbox') {
        const trueValue = input.dataset.checkedValue;
        const falseValue = input.dataset.uncheckedValue;
        if (trueValue !== undefined || falseValue !== undefined) {
          payload[input.name] = input.checked ? (trueValue !== undefined ? trueValue : true) : (falseValue !== undefined ? falseValue : false);
        } else {
          payload[input.name] = Boolean(input.checked);
        }
      }
      else if (input.type === 'file') payload[input.name] = input.files && input.files[0] ? input.files[0].name : null;
      else payload[input.name] = input.value;
    });
    return payload;
  }

  formSelect.addEventListener('change', renderFormBySelection);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const processId = Number(form.dataset.processId);
    const payload = collectDynamicPayload();

    const rawExtra = (form.extraPayload.value || '').trim();
    if (rawExtra) {
      try {
        const parsed = JSON.parse(rawExtra);
        Object.assign(payload, parsed);
      } catch (_) {
        WorkflowUI.showToast('Payload complementar em JSON invalido', 'warning');
        return;
      }
    }

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch('/api/instancias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processoId: processId, payload }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao iniciar processo');

      WorkflowUI.showToast(`Solicitacao #${body.id} iniciada com sucesso`, 'success');
      setTimeout(function () {
        window.location.href = '/solicitacoes';
      }, 700);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao iniciar processo', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  });

  if ((seed.forms || []).length > 0) {
    formSelect.value = String(seed.forms[0].id);
    renderFormBySelection();
  }
})();
