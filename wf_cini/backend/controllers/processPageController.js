const processService = require('../services/processService');
const accessService = require('../services/accessService');
const { getCurrentUser } = require('../utils/requestUser');

async function index(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const result = await processService.listProcesses({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      search: req.query.search || '',
      user: currentUser,
    });

    return res.render('processos/index', {
      pageTitle: 'Processos BPM',
      pageDescription: 'Gestao de processos e versoes BPMN',
      result,
      search: req.query.search || '',
      onlyMine: false,
    });
  } catch (err) {
    return next(err);
  }
}

async function meus(req, res, next) {
  try {
    const currentUser = getCurrentUser(req);
    const result = await processService.listProcesses({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20,
      search: req.query.search || '',
      createdBy: currentUser,
      user: currentUser,
    });

    return res.render('processos/index', {
      pageTitle: 'Processos que criei',
      pageDescription: 'Acompanhe em tempo real os processos criados por voce',
      result,
      search: req.query.search || '',
      onlyMine: true,
    });
  } catch (error) {
    return next(error);
  }
}

function novo(req, res) {
  return res.render('processos/new', {
    pageTitle: 'Novo Processo',
    pageDescription: 'Cadastro inicial do processo',
  });
}

async function detalhes(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canView = await accessService.canUser(processoId, currentUser, 'view');
    if (!canView) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para visualizar este processo',
        user: res.locals.user,
      });
    }

    const details = await processService.getProcessDetails(processoId);

    return res.render('processos/show', {
      pageTitle: `Processo ${details.process.codigo}`,
      pageDescription: details.process.nome,
      details,
      canEdit: await accessService.canUser(processoId, currentUser, 'edit'),
      canModel: await accessService.canUser(processoId, currentUser, 'model'),
      canExecute: await accessService.canUser(processoId, currentUser, 'execute'),
      canAdmin: await accessService.canUser(processoId, currentUser, 'admin'),
    });
  } catch (err) {
    return next(err);
  }
}

async function editar(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canEdit = await accessService.canUser(processoId, currentUser, 'edit');
    if (!canEdit) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para editar este processo',
        user: res.locals.user,
      });
    }

    const details = await processService.getProcessDetails(processoId);
    return res.render('processos/edit', {
      pageTitle: `Editar ${details.process.codigo}`,
      pageDescription: 'Atualize dados principais do processo',
      details,
    });
  } catch (err) {
    return next(err);
  }
}

async function historico(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canView = await accessService.canUser(processoId, currentUser, 'view');
    if (!canView) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para visualizar este historico',
        user: res.locals.user,
      });
    }

    const payload = await processService.getProcessHistory(processoId);
    return res.render('processos/history', {
      pageTitle: `Historico ${payload.process.codigo}`,
      pageDescription: 'Timeline de execucao do processo',
      payload,
    });
  } catch (err) {
    return next(err);
  }
}

async function instancias(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canView = await accessService.canUser(processoId, currentUser, 'view');
    if (!canView) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para visualizar as instancias deste processo',
        user: res.locals.user,
      });
    }

    const payload = await processService.getProcessInstancesLine({
      processoId,
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 100,
      status: req.query.status || null,
      identificador: req.query.identificador || null,
      solicitante: req.query.solicitante || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
    });

    return res.render('processos/instances', {
      pageTitle: `Instancias ${payload.process.codigo}`,
      pageDescription: `Linha de execucao das instancias de ${payload.process.nome}`,
      payload,
      filters: {
        status: req.query.status || '',
        identificador: req.query.identificador || '',
        solicitante: req.query.solicitante || '',
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || '',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function iniciar(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const currentUser = getCurrentUser(req);
    const canExecute = await accessService.canUser(processoId, currentUser, 'execute');
    if (!canExecute) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para iniciar este processo',
        user: res.locals.user,
      });
    }

    const details = await processService.getProcessDetails(processoId);
    return res.render('processos/start', {
      pageTitle: `Iniciar ${details.process.codigo}`,
      pageDescription: 'Preencha o formulario inicial e abra uma solicitacao',
      details,
    });
  } catch (err) {
    return next(err);
  }
}

async function modelar(req, res, next) {
  try {
    const processoId = Number(req.params.id);
    const versaoId = req.query.versaoId ? Number(req.query.versaoId) : null;
    const currentUser = getCurrentUser(req);
    const canModel = await accessService.canUser(processoId, currentUser, 'model');
    const canView = await accessService.canUser(processoId, currentUser, 'view');

    if (!canView) {
      return res.status(403).render('erpShell', {
        pageTitle: 'Acesso negado',
        pageDescription: 'Voce nao possui permissao para abrir o modelador deste processo',
        user: res.locals.user,
      });
    }

    const payload = await processService.getModelerPayload(processoId, versaoId);

    return res.render('processos/modelar', {
      pageTitle: `Modelar ${payload.process.nome}`,
      pageDescription: 'Editor visual BPMN',
      payload,
      bpmnXml: payload.version ? payload.version.bpmn_xml : null,
      propriedades: payload.version ? payload.version.propriedades_json : null,
      readOnly: !canModel,
    });
  } catch (err) {
    return next(err);
  }
}

async function publicar(req, res) {
  const processoId = Number(req.params.id);
  const versaoId = Number(req.query.versaoId || 0);
  const publishedBy = getCurrentUser(req);

  const canAdmin = await accessService.canUser(processoId, publishedBy, 'admin');
  if (!canAdmin) {
    return res.redirect(`/processos/${processoId}?error=sem_permissao_publicar`);
  }

  if (!versaoId) {
    return res.redirect(`/processos/${processoId}?error=versao_obrigatoria`);
  }

  try {
    await processService.publishVersion({
      processoId,
      versaoId,
      observacao: null,
      publishedBy,
    });

    return res.redirect(`/processos/${processoId}?published=true`);
  } catch (err) {
    return res.redirect(`/processos/${processoId}?error=${encodeURIComponent(err.message || 'erro_publicacao')}`);
  }
}

module.exports = {
  index,
  meus,
  novo,
  detalhes,
  editar,
  historico,
  instancias,
  iniciar,
  modelar,
  publicar,
};
