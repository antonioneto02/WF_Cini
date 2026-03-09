const protheusUserRepository = require('../repositories/protheusUserRepository');

async function searchUsers({ search = '', limit = 20 }) {
  return protheusUserRepository.searchUsers({ search, limit });
}

module.exports = {
  searchUsers,
};
