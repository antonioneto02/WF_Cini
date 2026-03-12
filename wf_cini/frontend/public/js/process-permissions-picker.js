(function () {
  function normalizeUserId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function parseUsers(value) {
    if (!value) return [];
    return Array.from(new Set(String(value)
      .split(/[;,\n\r]/g)
      .map(function (item) { return normalizeUserId(item); })
      .filter(Boolean)));
  }

  async function searchUsers(term) {
    const response = await fetch('/api/protheus/usuarios?search=' + encodeURIComponent(term) + '&limit=20');
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message || 'Erro ao pesquisar usuarios');
    }
    return Array.isArray(body.data) ? body.data : [];
  }

  function createTagElement(label, onRemove) {
    var tag = document.createElement('div');
    tag.className = 'wf-perm-tag';

    var text = document.createElement('span');
    text.textContent = label;

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.title = 'Remover usuario';
    remove.setAttribute('aria-label', 'Remover usuario');
    remove.textContent = 'x';
    remove.addEventListener('click', onRemove);

    tag.appendChild(text);
    tag.appendChild(remove);
    return tag;
  }

  function initPicker(root) {
    var storage = root.querySelector('.wf-perm-storage');
    var tagsBox = root.querySelector('[data-role="tags"]');
    var input = root.querySelector('[data-role="input"]');
    var suggestionBox = root.querySelector('[data-role="suggestions"]');

    if (!storage || !tagsBox || !input || !suggestionBox) return;

    var selectedUsers = new Map();
    var lastResults = [];
    var timer = null;

    function commitStorage() {
      storage.value = Array.from(selectedUsers.keys()).join(', ');
    }

    function hideSuggestions() {
      suggestionBox.classList.add('hidden');
    }

    function showSuggestions() {
      suggestionBox.classList.remove('hidden');
    }

    function renderTags() {
      tagsBox.innerHTML = '';

      selectedUsers.forEach(function (label, userId) {
        var tag = createTagElement(label, function () {
          selectedUsers.delete(userId);
          commitStorage();
          renderTags();
        });
        tagsBox.appendChild(tag);
      });
    }

    function addSelectedUser(user) {
      var userId = normalizeUserId(user.id || user.codigo || user.usuario || '');
      if (!userId) return;

      var userName = String(user.nome || '').trim();
      var label = userName ? (userName + ' (' + userId + ')') : userId;

      selectedUsers.set(userId, label);
      commitStorage();
      renderTags();

      input.value = '';
      suggestionBox.innerHTML = '';
      hideSuggestions();
    }

    function renderSuggestions(users) {
      suggestionBox.innerHTML = '';
      lastResults = users;

      if (!users.length) {
        var empty = document.createElement('div');
        empty.className = 'wf-perm-empty';
        empty.textContent = 'Nenhum usuario encontrado';
        suggestionBox.appendChild(empty);
        showSuggestions();
        return;
      }

      users.forEach(function (user) {
        var userId = normalizeUserId(user.id || user.codigo || user.usuario || '');
        if (!userId) return;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'wf-perm-suggestion-item';

        var title = document.createElement('div');
        title.className = 'wf-perm-suggestion-title';
        title.textContent = user.nome || userId;

        var subtitle = document.createElement('div');
        subtitle.className = 'wf-perm-suggestion-subtitle';
        subtitle.textContent = userId + (user.email ? (' • ' + user.email) : '');

        button.appendChild(title);
        button.appendChild(subtitle);
        button.addEventListener('click', function () {
          addSelectedUser(user);
        });

        suggestionBox.appendChild(button);
      });

      showSuggestions();
    }

    function hydrateFromStorage() {
      parseUsers(storage.value).forEach(function (userId) {
        selectedUsers.set(userId, userId);
      });
      commitStorage();
      renderTags();
    }

    input.addEventListener('input', function () {
      var term = String(input.value || '').trim();

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      if (term.length < 2) {
        suggestionBox.innerHTML = '';
        hideSuggestions();
        return;
      }

      timer = setTimeout(async function () {
        try {
          var users = await searchUsers(term);
          renderSuggestions(users);
        } catch (error) {
          suggestionBox.innerHTML = '';
          hideSuggestions();
          if (window.WorkflowUI && window.WorkflowUI.showToast) {
            window.WorkflowUI.showToast(error.message || 'Falha ao pesquisar usuarios', 'error');
          }
        }
      }, 220);
    });

    input.addEventListener('focus', function () {
      if (lastResults.length) showSuggestions();
    });

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!lastResults.length) return;
      addSelectedUser(lastResults[0]);
    });

    document.addEventListener('click', function (event) {
      if (root.contains(event.target)) return;
      hideSuggestions();
    });

    hydrateFromStorage();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.wf-perm-picker').forEach(function (picker) {
      initPicker(picker);
    });
  });
})();
