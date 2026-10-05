'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  DIALETO, ativo, prepararBanco, emTransacaoDesfeita, restaurarIdentidades, semPermissaoDeGravar,
} = require('./ambiente');

const repo = nome => require(`../../backend/repositories/${nome}`);

describe(`Repositórios do workflow no banco real (${DIALETO || 'desligado'})`, { skip: !ativo && 'defina TESTE_DIALETO=mssql ou TESTE_DIALETO=postgres + TESTE_PG_*' }, () => {
  let modelos;
  let sequelize;
  let motivoPulo;

  before(async () => {
    modelos = require('../../models');
    sequelize = modelos.sequelize;
    assert.equal(sequelize.getDialect(), DIALETO);
    await prepararBanco(sequelize);
    motivoPulo = await semPermissaoDeGravar(sequelize);
  });

  after(async () => {
    if (!motivoPulo) await restaurarIdentidades(sequelize);
    await sequelize.close();
  });

  const cenario = fn => async (t) => {
    if (motivoPulo) return t.skip(motivoPulo);
    await emTransacaoDesfeita(sequelize, fn);
  };

  async function criarFluxo() {
    const processos = repo('processRepository');
    const instancias = repo('instanceRepository');
    const processoId = await processos.createProcess({
      nome: 'ZZ Teste ORM Compras', descricao: 'Processo de teste', criadoPor: 'Fulano.Teste', usaIdentificador: true, tipoIdentificador: 'TEXTO', descIden: 'Pedido',
    });
    const versaoId = await processos.createVersion({ processoId, versao: 1, bpmnXml: '<xml/>', propriedadesJson: '{}', createdBy: 'fulano.teste' });
    const instanciaId = await instancias.createInstance({
      processoId, versaoId, solicitante: 'Fulano.Teste', identificador: 'PED-ZZ-777', payloadJson: '{"a":1}', currentElementId: 'Inicio',
    });
    return { processoId, versaoId, instanciaId };
  }

  test('processos e versões: cria, publica, busca sem diferenciar maiúsculas e conta dependências', cenario(async () => {
    const processos = repo('processRepository');
    const { processoId, versaoId } = await criarFluxo();
    assert.equal(typeof processoId, 'number');

    const processo = await processos.getProcessById(processoId);
    assert.equal(processo.nome, 'ZZ Teste ORM Compras');
    assert.equal(processo.desc_iden, 'Pedido');
    assert.equal(processo.status, 'ATIVO');
    assert.equal(String(processo.codigo), String(processoId));
    assert.ok(processo.created_at instanceof Date);

    await processos.updateProcess({
      id: processoId, nome: 'ZZ Teste ORM Compras', descricao: 'Alterado', status: 'ATIVO', usaIdentificador: false, tipoIdentificador: null, updatedBy: 'beltrano', descIden: null,
    });
    assert.equal((await processos.getProcessById(processoId)).updated_by, 'beltrano');

    const v2 = await processos.createVersion({ processoId, versao: 2, bpmnXml: '<xml2/>', propriedadesJson: '{}', createdBy: 'x' });
    await processos.publishVersion({ processoId, versaoId, observacao: 'primeira', publishedBy: 'x' });
    await processos.publishVersion({ processoId, versaoId: v2, observacao: 'segunda', publishedBy: 'x' });
    const versoes = await processos.listVersionsByProcess(processoId);
    assert.deepEqual(versoes.map(v => [v.versao, v.status]), [[2, 'PUBLICADA'], [1, 'ARQUIVADA']]);
    assert.equal((await processos.getPublishedVersion(processoId)).bpmn_xml, '<xml2/>');
    assert.equal(await processos.getLatestVersionNumber(processoId), 2);

    const lista = await processos.listProcesses({ search: 'zz teste orm', createdBy: ' fulano.teste ' });
    assert.equal(lista.total, 1);
    assert.equal(lista.data[0].versao, 2);
    assert.equal(lista.data[0].versao_status, 'PUBLICADA');
    assert.equal(lista.data[0].latest_instance_status, 'EM_ANDAMENTO');
    assert.equal(lista.data[0].latest_current_element_id, 'Inicio');

    assert.equal(String((await processos.getProcessByCodigo('zz teste orm compras')).id), String(processoId));
    assert.equal(String((await processos.getProcessByCodigo(String(processoId))).id), String(processoId));
    assert.deepEqual(await processos.getProcessDeleteDependencies(processoId), { versions: 2, forms: 0, instances: 1, tasks: 0, history: 0 });
  }));

  test('instâncias: ponteiro, estado, filtros por texto e data, estatísticas e encerramento', cenario(async () => {
    const instancias = repo('instanceRepository');
    const { processoId, instanciaId } = await criarFluxo();

    await instancias.updateInstancePointer(instanciaId, 'Aprovacao');
    await instancias.updateRuntimeState(instanciaId, '{"passo":2}');
    let instancia = await instancias.getInstanceById(instanciaId);
    assert.equal(instancia.current_element_id, 'Aprovacao');
    assert.equal(instancia.runtime_state_json, '{"passo":2}');
    assert.equal(instancia.payload_json, '{"a":1}');
    assert.equal(instancia.ended_at, null);

    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const lista = await instancias.listInstances({ processoId, solicitante: 'fulano', identificador: 'ped-zz', startDate: hoje, endDate: hoje });
    assert.equal(lista.total, 1);
    assert.equal(lista.data[0].processo_nome, 'ZZ Teste ORM Compras');
    assert.equal(lista.data[0].processo_desc_iden, 'Pedido');
    assert.equal(lista.data[0].versao, 1);
    assert.equal((await instancias.listInstances({ processoId, endDate: '2000-01-01' })).total, 0);

    await instancias.finishInstance(instanciaId, 'ERRO');
    instancia = await instancias.getInstanceById(instanciaId);
    assert.equal(instancia.status, 'ERRO');
    assert.ok(instancia.ended_at instanceof Date);
    assert.deepEqual(await instancias.getProcessInstanceStats(processoId), { total: 1, concluidas: 0, em_andamento: 0, com_erro: 1 });
  }));

  test('tarefas: visibilidade por responsável, kanban, rascunho e conclusão', cenario(async () => {
    const tarefas = repo('taskRepository');
    const { processoId, versaoId, instanciaId } = await criarFluxo();
    const base = { instanciaId, processoId, versaoProcessoId: versaoId, slaHoras: 8, formConfigJson: null };
    const minha = await tarefas.createTask({ ...base, elementId: 'T1', nomeEtapa: 'Aprovar pedido', responsavel: ' Fulano.Teste ', criadoPor: 'SISTEMA' });
    const qualquer = await tarefas.createTask({ ...base, elementId: 'T2', nomeEtapa: 'Conferir', responsavel: 'ANY' });
    await tarefas.createTask({ ...base, elementId: 'T3', nomeEtapa: 'Outra pessoa', responsavel: 'ciclano' });

    const doFulano = await tarefas.listKanbanTasks({ user: 'FULANO.TESTE', processoId, pageSize: 50 });
    assert.equal(doFulano.total, 2);
    assert.deepEqual(doFulano.data.map(t => t.responsavel).sort(), ['', 'fulano.teste']);
    assert.equal(doFulano.data[0].processo_nome, 'ZZ Teste ORM Compras');
    assert.equal(doFulano.data[0].processo_desc_iden, 'Pedido');
    assert.equal(doFulano.data[0].identificador, 'PED-ZZ-777');

    assert.equal((await tarefas.listKanbanTasks({ user: 'x', userKeys: ['CICLANO'], processoId, search: 'OUTRA' })).total, 1);
    assert.equal((await tarefas.listKanbanTasks({ user: 'x', processoId, responsavel: 'Fulano.Teste' })).total, 0);
    assert.equal((await tarefas.listKanbanTasks({ user: 'fulano.teste', processName: 'teste orm', identificador: 'zz-777' })).total, 2);
    assert.equal((await tarefas.listKanbanTasks({ user: 'fulano.teste', processoId, page: 2, pageSize: 1 })).data.length, 1);

    const detalhe = await tarefas.getTaskById(qualquer);
    assert.equal(detalhe.responsavel, '');
    assert.equal(detalhe.solicitante, 'Fulano.Teste');
    assert.equal(detalhe.payload_json, '{"a":1}');

    await tarefas.saveTaskDraft({ taskId: minha, observacao: 'rascunho', responseJson: '{}', user: 'fulano.teste' });
    let tarefa = await tarefas.getTaskById(minha);
    assert.equal(tarefa.status, 'EM_ANDAMENTO');
    assert.ok(tarefa.started_at instanceof Date);
    const inicio = tarefa.started_at.getTime();

    await tarefas.updateTaskStatus(minha, 'EM_ANDAMENTO');
    assert.equal((await tarefas.getTaskById(minha)).started_at.getTime(), inicio);

    await tarefas.completeTask({ taskId: minha, action: 'APROVAR', observacao: 'ok', responseJson: '{"r":1}', user: 'fulano.teste' });
    tarefa = await tarefas.getTaskById(minha);
    assert.equal(tarefa.status, 'CONCLUIDA');
    assert.equal(tarefa.acao_final, 'APROVAR');
    assert.equal(tarefa.completed_by, 'fulano.teste');
    assert.equal(tarefa.started_at.getTime(), inicio);

    const abertas = await tarefas.findOpenTasksByInstance(instanciaId);
    assert.deepEqual(abertas.map(t => t.elemento_id).sort(), ['T2', 'T3']);
    assert.equal(abertas[0].configuracao_formulario_json, null);
    assert.deepEqual((await tarefas.listTasksByInstance(instanciaId)).map(t => t.element_id), ['T1', 'T2', 'T3']);
  }));

  test('notificações: não lidas, leitura, escalonamento recente e SLA estourado', cenario(async () => {
    const notificacoes = repo('notificationRepository');
    const tarefas = repo('taskRepository');
    const { processoId, versaoId, instanciaId } = await criarFluxo();
    const tarefaId = await tarefas.createTask({
      instanciaId, processoId, versaoProcessoId: versaoId, elementId: 'T1', nomeEtapa: 'Atrasada', responsavel: 'zz.sla', slaHoras: 1, formConfigJson: null,
    });
    await modelos.Tarefas.update({ iniciado_em: new Date(Date.now() - 3 * 3600000) }, { where: { id: tarefaId } });

    await notificacoes.createNotification({ usuario: 'ZZ.SLA', titulo: 'Um', escopoTipo: 'TASK', escopoId: tarefaId, tipo: 'SLA_ESCALATION', nivelEscalonamento: 1 });
    await notificacoes.createNotification({ usuario: 'zz.sla', titulo: 'Dois' });

    let lista = await notificacoes.listByUsers({ usuarios: ['Zz.Sla'] });
    assert.equal(lista.total, 2);
    assert.equal(lista.unread, 2);
    assert.equal(lista.data[0].tipo !== undefined, true);

    assert.equal(await notificacoes.existsRecentEscalation({ usuario: 'zz.sla', escopoId: tarefaId, nivelEscalonamento: 1 }), true);
    assert.equal(await notificacoes.existsRecentEscalation({ usuario: 'zz.sla', escopoId: tarefaId, nivelEscalonamento: 2 }), false);
    assert.equal((await notificacoes.listLatestSlaAlertsForUsers({ usuarios: ['zz.sla'] })).length, 1);

    const umaId = lista.data.find(n => n.titulo === 'Um').id;
    await notificacoes.markAsReadForUsers({ id: umaId, usuarios: ['ZZ.SLA'] });
    lista = await notificacoes.listByUsers({ usuarios: ['zz.sla'] });
    assert.equal(lista.unread, 1);
    const lida = lista.data.find(n => n.titulo === 'Um');
    assert.equal(lida.status, 'READ');
    assert.ok(lida.lido_em instanceof Date);
    assert.equal(lista.data[0].status, 'READ');

    await notificacoes.markAllAsReadForUsers(['zz.sla']);
    assert.equal((await notificacoes.listByUsers({ usuarios: ['zz.sla'] })).unread, 0);
    assert.deepEqual(await notificacoes.listByUsers({ usuarios: [] }), { data: [], total: 0, unread: 0, page: 1, pageSize: 20 });

    const atrasadas = await notificacoes.listSlaBreachCandidates({ usuario: 'ZZ.SLA' });
    assert.equal(atrasadas.length, 1);
    assert.equal(String(atrasadas[0].task_id), String(tarefaId));
    assert.ok(atrasadas[0].atraso_minutos >= 119 && atrasadas[0].atraso_minutos <= 121, String(atrasadas[0].atraso_minutos));
    assert.equal(atrasadas[0].processo_nome, 'ZZ Teste ORM Compras');
  }));

  test('formulários, respostas e dependências pela configuração JSON da tarefa', cenario(async () => {
    const formularios = repo('formRepository');
    const tarefas = repo('taskRepository');
    const { processoId, versaoId, instanciaId } = await criarFluxo();
    const formId = await formularios.createForm({ processoId, nome: 'Form ZZ', schemaJson: '{"campos":[]}', createdBy: 'x' });
    const base = { instanciaId, processoId, versaoProcessoId: versaoId, nomeEtapa: 'E', responsavel: 'x', slaHoras: 1 };
    const tarefaId = await tarefas.createTask({ ...base, elementId: 'A', formConfigJson: JSON.stringify({ formId }) });
    await tarefas.createTask({ ...base, elementId: 'B', formConfigJson: JSON.stringify({ formId: String(formId) }) });
    await tarefas.createTask({ ...base, elementId: 'C', formConfigJson: JSON.stringify({ formId: formId + 0.5 }) });
    await tarefas.createTask({ ...base, elementId: 'D', formConfigJson: 'formId invalido' });

    await formularios.saveResponse({ tarefaId, instanciaId, formularioId: formId, respostaJson: '{"ok":true}', respondidoPor: 'x' });
    const respostas = await formularios.listResponsesByInstance(instanciaId);
    assert.equal(respostas.length, 1);
    assert.equal(respostas[0].formulario_nome, 'Form ZZ');
    assert.deepEqual(await formularios.getFormDeleteDependencies(formId), { responses: 1, tasks: 2 });

    await formularios.updateForm({ formId, processoId, nome: 'Form ZZ 2', schemaJson: '{}', updatedBy: 'y' });
    const form = await formularios.getFormById(formId);
    assert.equal(form.nome, 'Form ZZ 2');
    assert.equal(form.updated_by, 'y');
    const lista = await formularios.listForms({ processId: processoId });
    assert.equal(lista.total, 1);
    assert.equal(lista.data[0].processo_nome, 'ZZ Teste ORM Compras');
  }));

  test('histórico, comentários, ECM, eventos de integração e preferências do painel', cenario(async () => {
    const { processoId, versaoId, instanciaId } = await criarFluxo();

    const historico = repo('historyRepository');
    await historico.addHistory({ instanciaId, processoId, versaoProcessoId: versaoId, origemElementId: 'A', destinoElementId: 'B', tipoEvento: 'TRANSICAO', descricao: 'd', executor: 'x', payloadJson: '{}' });
    assert.equal((await historico.listHistoryByInstance(instanciaId))[0].destino_element_id, 'B');
    assert.equal((await historico.listHistoryByProcess(processoId))[0].solicitante, 'Fulano.Teste');

    const comentarios = repo('commentRepository');
    await comentarios.createComment({ processoId, instanciaId, autor: 'Autor.ZZ', mensagem: 'oi', mencoesJson: '["Mencionado.ZZ"]' });
    const doEscopo = await comentarios.listByScope({ instanciaId });
    assert.equal(doEscopo.length, 1);
    assert.equal(doEscopo[0].processo_nome, 'ZZ Teste ORM Compras');
    assert.equal(doEscopo[0].nome_etapa, null);
    assert.equal((await comentarios.listRecentByUserContext({ usuario: 'mencionado.zz' })).length, 1);
    assert.equal((await comentarios.listRecentByUserContext({ usuario: 'AUTOR.ZZ' })).length, 1);

    const ecm = repo('ecmRepository');
    const arquivoId = await ecm.createFileRecord({ processoId, instanciaId, ownerUser: 'zz.dono', fileName: 'Doc.pdf', filePath: '/tmp/doc', mimeType: 'application/pdf', fileSize: 10, version: 1, uploadedBy: 'x' });
    assert.equal(await ecm.getLatestVersion(processoId, 'zz.dono', 'doc.PDF'), 1);
    assert.equal((await ecm.listFilesByProcess({ processoId, ownerUser: 'ZZ.DONO' })).length, 1);
    assert.equal(Number((await ecm.getFileById(arquivoId)).file_size), 10);

    const integracoes = repo('integrationEventRepository');
    await integracoes.createEvent({ sourceType: 'PROTHEUS', sourceKey: 'ZZ-1', processoId, instanciaProcessoId: instanciaId });
    assert.equal((await integracoes.getBySource('PROTHEUS', 'ZZ-1')).source_key, 'ZZ-1');

    const painel = repo('dashboardPreferenceRepository');
    assert.equal((await painel.upsertByUser({ usuario: 'Zz.Painel', perfil: 'GESTOR', widgetsJson: '[]', atalhosJson: '[]' })).perfil, 'GESTOR');
    const atualizado = await painel.upsertByUser({ usuario: 'ZZ.PAINEL', perfil: 'OPERADOR', widgetsJson: '[1]', atalhosJson: '[]' });
    assert.equal(atualizado.perfil, 'OPERADOR');
    assert.equal(atualizado.usuario, 'Zz.Painel');
  }));

  test('permissões, API por processo e catálogo de automações', cenario(async () => {
    const { processoId } = await criarFluxo();

    const permissoes = repo('processPermissionRepository');
    await permissoes.replacePermissions(processoId, [
      { usuario: ' Beta.ZZ ', can_view: true, can_edit: true },
      { usuario: 'alfa.zz', can_view: false, can_admin: true },
    ], 'x');
    const lista = await permissoes.listPermissionsByProcess(processoId);
    assert.deepEqual(lista.map(p => [p.usuario, p.can_view, p.can_edit, p.can_admin]), [['alfa.zz', false, false, true], ['beta.zz', true, true, false]]);
    assert.equal((await permissoes.getPermissionForUser(processoId, 'BETA.ZZ')).can_edit, true);
    assert.ok((await permissoes.listVisibleProcessIds('beta.zz')).includes(Number(processoId)));
    assert.ok(!(await permissoes.listVisibleProcessIds('alfa.zz')).includes(Number(processoId)));

    const api = repo('processApiConfigRepository');
    const configId = await api.upsertByProcessId(processoId, { public_api_key: 'chave-zz', allow_protheus: true, ativo: true }, 'x');
    assert.equal(String(await api.upsertByProcessId(processoId, { public_api_key: 'chave-zz-2', allow_external: true, ativo: false }, 'y')), String(configId));
    const config = await api.getByProcessId(processoId);
    assert.deepEqual([config.public_api_key, config.allow_protheus, config.allow_external, config.ativo], ['chave-zz-2', false, true, false]);
    assert.ok((await api.listAllConfigs()).some(c => c.public_api_key === 'chave-zz-2' && c.processo_nome === 'ZZ Teste ORM Compras'));

    const automacoes = repo('automationRepository');
    const automacaoId = await automacoes.createAutomation({ nome: 'ZZ Webhook', endpoint_url: 'https://exemplo.zz/hook', ativo: true });
    assert.equal((await automacoes.listAutomations({ search: 'EXEMPLO.ZZ', onlyActive: true })).total, 1);
    await automacoes.updateAutomation(automacaoId, { nome: 'ZZ Webhook', endpoint_url: 'https://exemplo.zz/hook', ativo: false, timeout_ms: 500 });
    const automacao = await automacoes.getAutomationById(automacaoId);
    assert.equal(automacao.timeout_ms, 500);
    assert.equal(automacao.metodo_http, 'POST');
    assert.equal((await automacoes.listAutomations({ search: 'exemplo.zz', onlyActive: true })).total, 0);
    await automacoes.removeAutomation(automacaoId);
    assert.equal(await automacoes.getAutomationById(automacaoId), null);
  }));

  test('exclusão do processo e limpeza geral do workflow', cenario(async () => {
    const processos = repo('processRepository');
    const processoId = await processos.createProcess({ nome: 'ZZ Sem dependencias', descricao: null, criadoPor: 'x' });
    await processos.deleteProcess(processoId);
    assert.equal(await processos.getProcessById(processoId), null);

    if (DIALETO !== 'postgres') return;
    await criarFluxo();
    const resumo = await repo('adminMaintenanceRepository').purgeAllWorkflowData();
    assert.equal(resumo.find(r => r.table === 'processos').deleted >= 1, true);
    assert.equal(resumo.find(r => r.table === 'instancias_processo').deleted >= 1, true);
    assert.equal(await modelos.Processos.count(), 0);
    assert.equal(await modelos.InstanciasProcesso.count(), 0);
  }));
});
