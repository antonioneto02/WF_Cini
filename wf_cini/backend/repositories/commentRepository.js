const { WfComentarios, Tarefas, Processos } = require('../../models');
const {
  Op, col, where, maiusculo, contem, idInserido,
} = require('../../database/consultas');

async function ensureSchema() {}

const ATRIBUTOS = [
  'id',
  'processo_id',
  'instancia_processo_id',
  'tarefa_id',
  'autor',
  'mensagem',
  'mencoes_json',
  ['dt_criacao', 'created_at'],
];

const juncoes = [
  { model: Tarefas, as: 'tarefa', attributes: [], required: false },
  { model: Processos, as: 'processo', attributes: [], required: false },
];

async function createComment({
  processoId,
  instanciaId,
  tarefaId = null,
  autor,
  mensagem,
  mencoesJson = null,
}) {
  const agora = new Date();
  const registro = await WfComentarios.create({
    processo_id: processoId,
    instancia_processo_id: instanciaId,
    tarefa_id: tarefaId,
    autor,
    mensagem,
    mencoes_json: mencoesJson,
    dt_criacao: agora,
    dt_atualizacao: agora,
  });

  return idInserido(registro);
}

async function listByScope({ instanciaId = null, tarefaId = null, limit = 120 }) {
  const safeLimit = Math.max(1, Number(limit) || 120);
  const filtro = { status: 'ATIVO' };
  if (instanciaId !== null && instanciaId !== undefined) filtro.instancia_processo_id = instanciaId;
  if (tarefaId !== null && tarefaId !== undefined) filtro.tarefa_id = tarefaId;

  return WfComentarios.findAll({
    attributes: [...ATRIBUTOS, [col('tarefa.nome_etapa'), 'nome_etapa'], [col('processo.nome'), 'processo_nome']],
    include: juncoes,
    where: filtro,
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    limit: safeLimit,
    raw: true,
  });
}

async function listRecentByUserContext({ usuario, limit = 10 }) {
  const safeLimit = Math.max(1, Number(limit) || 10);
  const usuarioNormalizado = String(usuario || '').trim().toUpperCase();

  return WfComentarios.findAll({
    attributes: [...ATRIBUTOS, [col('processo.nome'), 'processo_nome'], [col('tarefa.nome_etapa'), 'nome_etapa']],
    include: juncoes,
    where: {
      [Op.and]: [
        { status: 'ATIVO' },
        {
          [Op.or]: [
            where(maiusculo('WfComentarios.autor'), usuarioNormalizado),
            contem('WfComentarios.mencoes_json', usuarioNormalizado),
          ],
        },
      ],
    },
    order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
    limit: safeLimit,
    raw: true,
  });
}

module.exports = {
  ensureSchema,
  createComment,
  listByScope,
  listRecentByUserContext,
};
