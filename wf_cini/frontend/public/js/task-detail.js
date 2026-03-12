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

  if (commentForm) {
    commentForm.addEventListener('submit', submitComment);
    bindMentionAutocomplete();
    renderComments(seed.comments || []);
    loadComments();
  }

  renderDynamicForm();
})();
