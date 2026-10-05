const { AutomacoesCatalogo } = require('../../models');
const {
  Op, contem, paginar, idInserido, tabelaInexistente,
} = require('../../database/consultas');

const ATRIBUTOS = [
  'id', 'nome', 'descricao',
  ['url_endpoint', 'endpoint_url'],
  'metodo_http',
  ['tipo_autenticacao', 'auth_tipo'],
  ['valor_autenticacao', 'auth_valor'],
  ['tempo_limite_ms', 'timeout_ms'],
  ['tentativas_reenvio', 'retry_count'],
  'ativo', 'criado_por', 'dt_criacao', 'dt_atualizacao',
];

function filtroAutomacoes(search, onlyActive) {
  const condicoes = [];
  if (onlyActive) condicoes.push({ ativo: true });
  const termo = String(search || '').trim();
  if (termo) {
    condicoes.push({
      [Op.or]: [contem('nome', termo), contem('descricao', termo), contem('url_endpoint', termo)],
    });
  }
  return { [Op.and]: condicoes };
}

function camposAutomacao(payload) {
  return {
    nome: payload.nome,
    descricao: payload.descricao || null,
    url_endpoint: payload.endpoint_url,
    metodo_http: payload.metodo_http || 'POST',
    tipo_autenticacao: payload.auth_tipo || 'NONE',
    valor_autenticacao: payload.auth_valor || null,
    tempo_limite_ms: payload.timeout_ms || 8000,
    tentativas_reenvio: payload.retry_count || 0,
    ativo: Boolean(payload.ativo),
  };
}

async function listAutomations({ search = '', page = 1, pageSize = 20, onlyActive = false }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const filtro = filtroAutomacoes(search, onlyActive);

  try {
    const rows = await AutomacoesCatalogo.findAll({
      attributes: ATRIBUTOS,
      where: filtro,
      order: [['dt_criacao', 'DESC'], ['id', 'DESC']],
      ...paginar(safePage, safePageSize),
      raw: true,
    });

    const total = await AutomacoesCatalogo.count({ where: filtro });

    return {
      data: rows,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (error) {
    if (tabelaInexistente(error)) {
      return {
        data: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
      };
    }
    throw error;
  }
}

async function getAutomationById(id) {
  try {
    return await AutomacoesCatalogo.findOne({ attributes: ATRIBUTOS, where: { id }, raw: true });
  } catch (error) {
    if (tabelaInexistente(error)) return null;
    throw error;
  }
}

async function createAutomation(payload) {
  try {
    const agora = new Date();
    const registro = await AutomacoesCatalogo.create({
      ...camposAutomacao(payload),
      criado_por: payload.criado_por || null,
      dt_criacao: agora,
      dt_atualizacao: agora,
    });

    return idInserido(registro);
  } catch (error) {
    if (tabelaInexistente(error)) {
      throw new Error('Tabela de automacoes ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function updateAutomation(id, payload) {
  try {
    await AutomacoesCatalogo.update(
      { ...camposAutomacao(payload), dt_atualizacao: new Date() },
      { where: { id } }
    );
  } catch (error) {
    if (tabelaInexistente(error)) {
      throw new Error('Tabela de automacoes ainda nao foi criada no banco. Execute o script SQL novo.');
    }
    throw error;
  }
}

async function removeAutomation(id) {
  try {
    await AutomacoesCatalogo.destroy({ where: { id } });
  } catch (error) {
    if (tabelaInexistente(error)) return;
    throw error;
  }
}

module.exports = {
  listAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  removeAutomation,
};
