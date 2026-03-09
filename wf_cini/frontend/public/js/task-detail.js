(function () {
  const seedEl = document.getElementById('taskDetailSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent) : {};

  const formRoot = document.getElementById('dynamicFormRoot');
  const completeForm = document.getElementById('taskCompleteForm');

  function createField(field) {
    const wrapper = document.createElement('div');
    wrapper.className = 'grid gap-1';

    const label = document.createElement('label');
    label.textContent = field.label || field.name;
    label.className = 'text-sm font-semibold';
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
    } else if (field.type === 'radio') {
      input = document.createElement('div');
      input.className = 'flex flex-wrap gap-3';
      (field.options || []).forEach(function (opt) {
        const item = document.createElement('label');
        item.className = 'inline-flex items-center gap-2';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = field.name;
        radio.value = opt.value;
        item.appendChild(radio);
        item.appendChild(document.createTextNode(opt.label));
        input.appendChild(item);
      });
      wrapper.appendChild(input);
      return wrapper;
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      if (field.checkedValue !== undefined) input.dataset.checkedValue = String(field.checkedValue);
      if (field.uncheckedValue !== undefined) input.dataset.uncheckedValue = String(field.uncheckedValue);
    } else if (field.type === 'date') {
      input = document.createElement('input');
      input.type = 'date';
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
    } else if (field.type === 'upload') {
      input = document.createElement('input');
      input.type = 'file';
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }

    input.name = field.name;
    if (field.required) input.required = true;
    const maxLength = Number(field.maxLength || field.size);
    if ((input.type === 'text' || input.tagName === 'TEXTAREA') && Number.isFinite(maxLength) && maxLength > 0) {
      input.maxLength = maxLength;
    }
    if (field.type === 'checkbox') {
      input.className = 'h-4 w-4 rounded border border-slate-300 justify-self-start mt-1';
    } else {
      input.className = 'w-full px-3 py-2 rounded-xl border border-slate-300';
    }
    wrapper.appendChild(input);
    return wrapper;
  }

  function renderDynamicForm() {
    if (!formRoot) return;

    const schema = seed.form && seed.form.schema_json ? JSON.parse(seed.form.schema_json) : { fields: [] };

    if (!schema.fields || !schema.fields.length) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-slate-500';
      empty.textContent = 'Esta tarefa nao possui formulario vinculado.';
      formRoot.appendChild(empty);
      return;
    }

    schema.fields.forEach(function (field) {
      formRoot.appendChild(createField(field));
    });
  }

  function collectResponse() {
    const response = {};
    const controls = completeForm.querySelectorAll('[name]');

    controls.forEach(function (control) {
      if (!control.name) return;

      if (control.type === 'checkbox') {
        const trueValue = control.dataset.checkedValue;
        const falseValue = control.dataset.uncheckedValue;
        if (trueValue !== undefined || falseValue !== undefined) {
          response[control.name] = control.checked ? (trueValue !== undefined ? trueValue : true) : (falseValue !== undefined ? falseValue : false);
        } else {
          response[control.name] = Boolean(control.checked);
        }
      } else if (control.type === 'radio') {
        if (control.checked) response[control.name] = control.value;
      } else if (control.type === 'file') {
        response[control.name] = control.files && control.files[0] ? control.files[0].name : null;
      } else {
        response[control.name] = control.value;
      }
    });

    return response;
  }

  async function complete(action) {
    const taskId = Number(completeForm.dataset.taskId);
    const observacao = completeForm.observacao.value.trim();

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch(`/api/tarefas/${taskId}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          observacao,
          response: collectResponse(),
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao concluir tarefa');

      WorkflowUI.showToast('Tarefa concluida com sucesso', 'success');
      setTimeout(function () {
        window.location.href = '/tarefas';
      }, 600);
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao concluir tarefa', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  }

  async function saveDraft() {
    const taskId = Number(completeForm.dataset.taskId);
    const observacao = completeForm.observacao.value.trim();

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch(`/api/tarefas/${taskId}/rascunho`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observacao,
          response: collectResponse(),
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao salvar rascunho');

      WorkflowUI.showToast('Rascunho salvo', 'success');
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Falha ao salvar rascunho', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  }

  document.querySelectorAll('.complete-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      complete(button.dataset.action || 'aprovar');
    });
  });

  const saveDraftBtn = document.getElementById('saveDraftBtn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', saveDraft);
  }

  renderDynamicForm();
})();
