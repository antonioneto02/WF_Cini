const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('controllers', () => {
  test('loginController exporta as funções esperadas', () => {
    const mod = require('../../controllers/loginController');
    assert.equal(typeof mod.validaLogin, 'function');
  });

  // O módulo BPM (backend/app.js) registra dezenas de services/controllers/
  // rotas internamente -- em vez de testar cada um isoladamente, verifica
  // que a cadeia inteira de require carrega sem erro e expõe o ponto de
  // entrada esperado, o que já cobre imports quebrados em qualquer um
  // desses arquivos.
  test('backend/app (módulo BPM) carrega e exporta registerBpmModule', () => {
    const mod = require('../../backend/app');
    assert.equal(typeof mod.registerBpmModule, 'function');
  });
});
