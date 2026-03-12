async function index(req, res, next) {
  try {
    return res.render('admin/limpeza-total', {
      pageTitle: 'Limpeza Total',
      pageDescription: 'Excluir todos os dados do workflow e referencias relacionadas',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
};
