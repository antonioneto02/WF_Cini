(function () {
  const seedEl = document.getElementById('taskDetailSeed');
  const seed = seedEl ? JSON.parse(seedEl.textContent) : {};

  const formRoot = document.getElementById('dynamicFormRoot');
  const completeForm = document.getElementById('taskCompleteForm');
  const commentsPanel = document.getElementById('taskCommentsPanel');
  const commentsList = document.getElementById('taskCommentsList');
  const commentForm = document.getElementById('taskCommentForm');
  const commentInput = document.getElementById('taskCommentInput');
  const commentMentionSuggestions = document.getElementById('taskCommentMentionSuggestions');

  const mentionState = {
    debounceTimer: null,
    selectedUsers: new Map(),
  };

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  const taskFormConfig = safeJsonParse(seed.task && seed.task.form_config_json ? seed.task.form_config_json : null, {});
  const decisionGatewayConfig = taskFormConfig && typeof taskFormConfig.decisionGateway === 'object'
    ? taskFormConfig.decisionGateway
    : null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function normalizeUserId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function normalizeDecisionValue(value) {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (!normalized) return null;
    if (['SIM', 'S', 'YES', 'Y', 'TRUE', '1', 'APROVAR', 'APROVADO', 'OK'].includes(normalized)) return 'SIM';
    if (['NAO', 'N', 'NO', 'FALSE', '0', 'REJEITAR', 'REPROVAR', 'NEGAR'].includes(normalized)) return 'NAO';
    return null;
  }

  function getDecisionAnswerField(config) {
    return String((config && config.answerField) || '__decisionAnswer').trim() || '__decisionAnswer';
  }

  function getDecisionOptionLabel(config, optionValue, fallbackLabel) {
    const options = config && Array.isArray(config.options) ? config.options : [];
    const option = options.find(function (item) {
      return String((item && item.value) || '').trim().toUpperCase() === optionValue;
    });

    return option && option.label ? String(option.label).trim() : fallbackLabel;
  }

  function createDecisionField(config) {
    const answerField = getDecisionAnswerField(config);
    const question = String((config && config.question) || 'Selecione Sim ou Nao para decidir o proximo passo').trim();
    const yesLabel = getDecisionOptionLabel(config, 'SIM', 'Sim');
    const noLabel = getDecisionOptionLabel(config, 'NAO', 'Nao');

    const wrapper = document.createElement('fieldset');
    wrapper.className = 'grid gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50';

    const legend = document.createElement('legend');
    legend.textContent = question;
    legend.className = 'text-sm font-semibold px-1';
    wrapper.appendChild(legend);

    const options = document.createElement('div');
    options.className = 'flex flex-wrap gap-4';

    const yesItem = document.createElement('label');
    yesItem.className = 'inline-flex items-center gap-2';
    const yesInput = document.createElement('input');
    yesInput.type = 'radio';
    yesInput.name = answerField;
    yesInput.value = 'SIM';
    yesInput.required = true;
    yesItem.appendChild(yesInput);
    yesItem.appendChild(document.createTextNode(yesLabel));

    const noItem = document.createElement('label');
    noItem.className = 'inline-flex items-center gap-2';
    const noInput = document.createElement('input');
    noInput.type = 'radio';
    noInput.name = answerField;
    noInput.value = 'NAO';
    noItem.appendChild(noInput);
    noItem.appendChild(document.createTextNode(noLabel));

    options.appendChild(yesItem);
    options.appendChild(noItem);
    wrapper.appendChild(options);

    return wrapper;
  }

  function hideMentionSuggestions() {
    if (!commentMentionSuggestions) return;
    commentMentionSuggestions.style.display = 'none';
    commentMentionSuggestions.innerHTML = '';
  }

  function getActiveMentionQuery() {
    if (!commentInput) return null;

    const cursor = Number(commentInput.selectionStart || 0);
    const prefix = String(commentInput.value || '').slice(0, cursor);
    const match = prefix.match(/(?:^|\s)@([^\s@]{1,40})$/);
    if (!match) return null;

    const query = String(match[1] || '').trim();
    const tokenStart = prefix.lastIndexOf(`@${query}`);
    if (tokenStart < 0) return null;

    return {
      query,
      tokenStart,
      tokenEnd: cursor,
    };
  }

  async function searchMentionUsers(term) {
    const response = await fetch(`/api/protheus/usuarios?search=${encodeURIComponent(term)}&limit=10`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Falha ao pesquisar usuarios');
    return Array.isArray(body.data) ? body.data : [];
  }

  function applyMentionSelection(user, mentionQuery) {
    if (!commentInput || !mentionQuery) return;

    const id = normalizeUserId(user && user.id ? user.id : user && user.usuario ? user.usuario : '');
    const displayName = String(user && user.nome ? user.nome : id || '').trim();
    if (!id || !displayName) return;

    const source = String(commentInput.value || '');
    const before = source.slice(0, mentionQuery.tokenStart);
    const after = source.slice(mentionQuery.tokenEnd);
    const inserted = `@${displayName} `;
    commentInput.value = `${before}${inserted}${after}`;

    const nextCursor = before.length + inserted.length;
    commentInput.focus();
    commentInput.setSelectionRange(nextCursor, nextCursor);

    mentionState.selectedUsers.set(id, {
      id,
      nome: displayName,
    });

    hideMentionSuggestions();
  }

  function renderMentionSuggestions(users, mentionQuery) {
    if (!commentMentionSuggestions) return;

    const list = Array.isArray(users) ? users : [];
    if (!list.length) {
      commentMentionSuggestions.innerHTML = '<div class="wf-perm-empty">Nenhum usuario encontrado</div>';
      commentMentionSuggestions.style.display = 'block';
      return;
    }

    commentMentionSuggestions.innerHTML = list.map((user) => {
      const id = normalizeUserId(user.id || user.usuario || '');
      const nome = String(user.nome || id || '').trim();
      const email = String(user.email || '').trim();
      return `<button type="button" class="wf-perm-suggestion-item" data-user-id="${escapeHtml(id)}" data-user-name="${escapeHtml(nome)}"><div class="wf-perm-suggestion-title">${escapeHtml(nome)}</div><div class="wf-perm-suggestion-subtitle">${escapeHtml(id)}${email ? ` • ${escapeHtml(email)}` : ''}</div></button>`;
    }).join('');

    commentMentionSuggestions.querySelectorAll('.wf-perm-suggestion-item').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-user-id') || '';
        const nome = button.getAttribute('data-user-name') || id;
        applyMentionSelection({ id, nome }, mentionQuery);
      });
    });

    commentMentionSuggestions.style.display = 'block';
  }

  function bindMentionAutocomplete() {
    if (!commentInput || !commentMentionSuggestions) return;

    const triggerSearch = () => {
      const mentionQuery = getActiveMentionQuery();
      if (!mentionQuery || !mentionQuery.query || mentionQuery.query.length < 1) {
        hideMentionSuggestions();
        return;
      }

      if (mentionState.debounceTimer) {
        clearTimeout(mentionState.debounceTimer);
        mentionState.debounceTimer = null;
      }

      mentionState.debounceTimer = setTimeout(async () => {
        try {
          const users = await searchMentionUsers(mentionQuery.query);
          renderMentionSuggestions(users, mentionQuery);
        } catch (_) {
          hideMentionSuggestions();
        }
      }, 180);
    };

    commentInput.addEventListener('input', triggerSearch);
    commentInput.addEventListener('click', triggerSearch);
    commentInput.addEventListener('keyup', triggerSearch);

    document.addEventListener('click', (event) => {
      if (event.target === commentInput) return;
      if (commentMentionSuggestions.contains(event.target)) return;
      hideMentionSuggestions();
    });
  }

  function renderComments(items) {
    if (!commentsList) return;
    const list = Array.isArray(items) ? items : [];

    if (!list.length) {
      commentsList.innerHTML = '<div class="wf-comment-item"><div class="wf-comment-meta">Sem comentarios ainda</div><div class="wf-comment-text">Se precisar alinhar aprovacao, mencione alguem com @usuario.</div></div>';
      return;
    }

    commentsList.innerHTML = list
      .map(function (item) {
        return `<div class="wf-comment-item">
          <div class="wf-comment-meta"><strong>${escapeHtml(item.autor || '-')}</strong> &middot; ${escapeHtml(formatDate(item.created_at))}</div>
          <div class="wf-comment-text">${escapeHtml(item.mensagem || '')}</div>
        </div>`;
      })
      .join('');
  }

  async function loadComments() {
    if (!commentsPanel) return;

    const taskId = Number(commentsPanel.dataset.taskId || 0);
    const instanceId = Number(commentsPanel.dataset.instanceId || 0);
    if (!taskId || !instanceId) return;

    try {
      const response = await fetch(`/api/comentarios?tarefaId=${taskId}&instanciaId=${instanceId}&limit=120`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Falha ao carregar comentarios');
      renderComments(body.data || []);
    } catch (error) {
      if (window.WorkflowUI) WorkflowUI.showToast(error.message || 'Erro ao carregar comentarios', 'error');
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    if (!commentsPanel || !commentInput) return;

    const taskId = Number(commentsPanel.dataset.taskId || 0);
    const instanceId = Number(commentsPanel.dataset.instanceId || 0);
    const mensagem = (commentInput.value || '').trim();

    if (!mensagem) {
      WorkflowUI.showToast('Digite um comentario antes de enviar', 'warning');
      return;
    }

    try {
      WorkflowUI.setLoader(true);
      const response = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarefaId: taskId,
          instanciaId: instanceId,
          mensagem,
          mentionUsers: Array.from(mentionState.selectedUsers.keys()),
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Falha ao salvar comentario');

      commentInput.value = '';
      mentionState.selectedUsers.clear();
      hideMentionSuggestions();
      WorkflowUI.showToast('Comentario enviado', 'success');
      await loadComments();
    } catch (error) {
      WorkflowUI.showToast(error.message || 'Erro ao enviar comentario', 'error');
    } finally {
      WorkflowUI.setLoader(false);
    }
  }

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

    const schema = seed.form && seed.form.schema_json
      ? safeJsonParse(seed.form.schema_json, { fields: [] })
      : { fields: [] };
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const hasDecisionForm = Boolean(decisionGatewayConfig);

    if (hasDecisionForm) {
      formRoot.appendChild(createDecisionField(decisionGatewayConfig));
    }

    if (!fields.length && !hasDecisionForm) {
      const empty = document.createElement('p');
      empty.className = 'text-sm text-slate-500';
      empty.textContent = 'Esta tarefa nao possui formulario vinculado.';
      formRoot.appendChild(empty);
      return;
    }

    fields.forEach(function (field) {
      formRoot.appendChild(createField(field));
    });
  }

  function validateDecisionGatewayResponse() {
    if (!decisionGatewayConfig || !completeForm) return null;

    const answerField = getDecisionAnswerField(decisionGatewayConfig);
    const selected = completeForm.querySelector(`input[type="radio"][name="${answerField}"]:checked`);
    if (!selected) {
      return 'Selecione Sim ou Nao para decidir o caminho do processo.';
    }

    const normalized = normalizeDecisionValue(selected.value);
    if (!normalized) {
      return 'Valor da decisao invalido. Escolha Sim ou Nao.';
    }

    selected.value = normalized;
    return null;
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

  function extractFieldLabel(control) {
    if (!control) return 'campo obrigatorio';

    const fieldset = control.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend && legend.textContent && legend.textContent.trim()) {
        return legend.textContent.trim();
      }
    }

    const wrapper = control.closest('div');
    if (wrapper) {
      const label = wrapper.querySelector('label');
      if (label && label.textContent && label.textContent.trim()) {
        return label.textContent.trim();
      }
    }

    return control.name || 'campo obrigatorio';
  }

  function validateRequiredControls() {
    if (!completeForm) return null;

    const requiredControls = Array.from(completeForm.querySelectorAll('[name][required]'));
    const checkedRadioNames = new Set();

    for (const control of requiredControls) {
      if (!control || control.disabled) continue;

      if (control.type === 'radio') {
        if (checkedRadioNames.has(control.name)) continue;
        checkedRadioNames.add(control.name);

        const selected = completeForm.querySelector(`input[type="radio"][name="${control.name}"]:checked`);
        if (!selected) {
          return `Preencha o campo obrigatorio: ${extractFieldLabel(control)}`;
        }
        continue;
      }

      if (control.type === 'checkbox') {
        if (!control.checked) {
          return `Preencha o campo obrigatorio: ${extractFieldLabel(control)}`;
        }
        continue;
      }

      if (control.type === 'file') {
        if (!control.files || !control.files[0]) {
          return `Preencha o campo obrigatorio: ${extractFieldLabel(control)}`;
        }
        continue;
      }

      if (!String(control.value || '').trim()) {
        return `Preencha o campo obrigatorio: ${extractFieldLabel(control)}`;
      }
    }

    return null;
  }

  async function complete(action) {
    const taskId = Number(completeForm.dataset.taskId);
    const observacao = completeForm.observacao.value.trim();
    const requiredValidationError = validateRequiredControls();

    if (requiredValidationError) {
      WorkflowUI.showToast(requiredValidationError, 'warning');
      return;
    }

    const decisionValidationError = validateDecisionGatewayResponse();

    if (decisionValidationError) {
      WorkflowUI.showToast(decisionValidationError, 'warning');
      return;
    }

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

  if (commentForm) {
    commentForm.addEventListener('submit', submitComment);
    bindMentionAutocomplete();
    renderComments(seed.comments || []);
    loadComments();
  }

  renderDynamicForm();
})();
