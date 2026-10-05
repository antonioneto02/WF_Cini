'use strict';

const { Op, fn, col, where } = require('sequelize');

const coluna = nome => (typeof nome === 'string' ? col(nome) : nome);

const aparado = nome => fn('LTRIM', fn('RTRIM', fn('COALESCE', coluna(nome), '')));

const minusculo = nome => fn('LOWER', aparado(nome));

const maiusculo = nome => fn('UPPER', aparado(nome));

function contem(nome, termo) {
  return where(fn('LOWER', coluna(nome)), Op.like, `%${String(termo).toLowerCase()}%`);
}

function igualSemCaixa(nome, valor) {
  return where(fn('LOWER', coluna(nome)), String(valor).toLowerCase());
}

function dataDoFiltro(valor, diasAMais = 0) {
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const data = new Date(`${texto}T00:00:00-03:00`);
    data.setUTCDate(data.getUTCDate() + diasAMais);
    return data;
  }
  const data = new Date(texto);
  if (diasAMais) data.setTime(data.getTime() + diasAMais * 86400000);
  return data;
}

const paginar = (pagina, tamanho) => ({ offset: (pagina - 1) * tamanho, limit: tamanho });

const idInserido = registro => (registro && registro.id != null ? Number(registro.id) : null);

const tabelaInexistente = erro => Boolean(erro && erro.message && /Invalid object name|relation ".*" does not exist/i.test(erro.message));

module.exports = {
  Op,
  fn,
  col,
  where,
  aparado,
  minusculo,
  maiusculo,
  contem,
  igualSemCaixa,
  dataDoFiltro,
  paginar,
  idInserido,
  tabelaInexistente,
};
