const processService = require('../services/processService');

async function index(req, res, next) {
  try {
    const result = await processService.listProcesses({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 10,
      search: req.query.search || '',
    });

    return res.render('processos/index', {
      pageTitle: 'Processos BPM',
      pageDescription: 'Gestao de processos e versoes BPMN',
      result,
      search: req.query.search || '',
    });
  } catch (err) {
    return next(err);
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
    const details = await processService.getProcessDetails(processoId);

    return res.render('processos/show', {
      pageTitle: `Processo ${details.process.codigo}`,
      pageDescription: details.process.nome,
      details,
    });
  } catch (err) {
    return next(err);
  }
}

async function editar(req, res, next) {
  try {
    const processoId = Number(req.params.id);
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

async function iniciar(req, res, next) {
  try {
    const processoId = Number(req.params.id);
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

    const payload = await processService.getModelerPayload(processoId, versaoId);

    return res.render('processos/modelar', {
      pageTitle: `Modelar ${payload.process.nome}`,
      pageDescription: 'Editor visual BPMN',
      payload,
      bpmnXml: payload.version ? payload.version.bpmn_xml : null,
      propriedades: payload.version ? payload.version.propriedades_json : null,
    });
  } catch (err) {
    return next(err);
  }
}

async function publicar(req, res) {
  const processoId = Number(req.params.id);
  const versaoId = Number(req.query.versaoId || 0);
  const publishedBy = (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'sistema';

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
  novo,
  detalhes,
  editar,
  historico,
  iniciar,
  modelar,
  publicar,
};
