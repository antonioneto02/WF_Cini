(function () {
  const publishButtons = document.querySelectorAll('.publish-btn');
  const startInstanceForm = document.getElementById('startInstanceForm');
  const rotateApiKeyBtn = document.getElementById('rotateApiKeyBtn');
  const ecmUploadForm = document.getElementById('ecmUploadForm');
  const ecmList = document.getElementById('ecmList');

  publishButtons.forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!WorkflowUI.confirmDelete('Publicar esta versao? A versao publicada atual sera arquivada.')) {
        return;
      }

      const processId = Number(btn.dataset.processId);
      const versionId = Number(btn.dataset.versionId);

      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/processos/${processId}/publicar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versaoId: versionId }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erro ao publicar versao');

        WorkflowUI.showToast('Versao publicada com sucesso', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 500);
      } catch (error) {
        WorkflowUI.showToast(error.message, 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  });

  if (startInstanceForm) {
    startInstanceForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const processId = Number(startInstanceForm.dataset.processId);
      let payload = {};

      const raw = (startInstanceForm.payload.value || '').trim();
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch (_) {
          WorkflowUI.showToast('Payload JSON invalido', 'warning');
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
        if (!response.ok) throw new Error(body.message || 'Erro ao iniciar instancia');

        WorkflowUI.showToast(`Instancia #${body.id} iniciada`, 'success');
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha ao iniciar instancia', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  }

  async function loadEcmFiles(processId) {
    if (!ecmList) return;

    try {
      const response = await fetch(`/api/ecm/processos/${processId}/arquivos`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Erro ao carregar anexos');

      const files = Array.isArray(body.data) ? body.data : [];
      if (!files.length) {
        ecmList.innerHTML = '<p class="text-slate-500">Nenhum anexo cadastrado.</p>';
        return;
      }

      ecmList.innerHTML = files.map(function (file) {
        return `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
          <div>
            <p class="font-medium">${file.file_name}</p>
            <p class="text-xs text-slate-500">Dono: ${file.owner_user || '-'} | Versao: v${file.versao || 1}</p>
          </div>
          <a href="/api/ecm/arquivos/${file.id}/download" class="px-3 py-1 rounded-lg border border-cyan-300 text-cyan-700">Baixar</a>
        </div>`;
      }).join('');
    } catch (error) {
      ecmList.innerHTML = `<p class="text-rose-600">${error.message || 'Falha ao carregar anexos'}</p>`;
    }
  }

  async function toBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (rotateApiKeyBtn) {
    rotateApiKeyBtn.addEventListener('click', async function () {
      if (!WorkflowUI.confirmDelete('Rotacionar chave da API publica deste processo?')) return;

      const processId = Number(rotateApiKeyBtn.dataset.processId);
      try {
        WorkflowUI.setLoader(true);
        const response = await fetch(`/api/processos/${processId}/api-config/rotate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Falha ao rotacionar chave');
        WorkflowUI.showToast('Chave API rotacionada com sucesso', 'success');
        setTimeout(function () {
          window.location.reload();
        }, 550);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Erro ao rotacionar chave', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  }

  if (ecmUploadForm) {
    const processId = Number(ecmUploadForm.dataset.processId);
    loadEcmFiles(processId);

    ecmUploadForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const input = ecmUploadForm.arquivo;
      const file = input && input.files ? input.files[0] : null;
      if (!file) {
        WorkflowUI.showToast('Selecione um arquivo para envio', 'warning');
        return;
      }

      try {
        WorkflowUI.setLoader(true);
        const base64 = await toBase64(file);

        const response = await fetch(`/api/ecm/processos/${processId}/arquivos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64: base64,
          }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Erro ao enviar arquivo');

        WorkflowUI.showToast('Arquivo enviado para o ECM', 'success');
        input.value = '';
        await loadEcmFiles(processId);
      } catch (error) {
        WorkflowUI.showToast(error.message || 'Falha no envio de arquivo', 'error');
      } finally {
        WorkflowUI.setLoader(false);
      }
    });
  }
})();
