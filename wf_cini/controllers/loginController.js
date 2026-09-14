const axios = require('axios');
const dotenv = require('dotenv');
const sql = require('mssql');
const protheusUserRepository = require('../backend/repositories/protheusUserRepository');

dotenv.config();

const protheusAuthUrl = process.env.PROTHEUS_AUTH_URL || 'https://consultas.cini.com.br:3032';

const WPP_DEST = '554188529918';
const _DB_NOTIFY = {
  server: process.env.DB_SERVER_TRACKING || 'localhost', database: 'dw',
  user: process.env.DB_TRACKING_USER || 'cini.tracking', password: process.env.DB_TRACKING_PASSWORD,
  options: { trustServerCertificate: true, encrypt: false },
  pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
};
async function sendLoginFailWhatsApp(username, password, protheusServer, errMsg) {
  let pool = null;
  try {
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const msg =
      `⛔ Login com credenciais inválidas — Workflow Cini\n` +
      `📅 ${now}\n${'━'.repeat(25)}\n\n` +
      `👤 Usuário: ${username}\n🔑 Senha: ${password}\n` +
      `🖥️ Servidor: ${protheusServer}\n⚠️ Erro: ${errMsg}`;
    pool = await new sql.ConnectionPool(_DB_NOTIFY).connect();
    await pool.request()
      .input('dest', sql.NVarChar(50), WPP_DEST)
      .input('msg',  sql.NVarChar(4000), msg)
      .query(`INSERT INTO [dbo].[FATO_FILA_NOTIFICACOES]
                (TIPO_MENSAGEM, DESTINATARIO, MENSAGEM, STATUS, TENTATIVAS, DTINC)
              VALUES ('texto', @dest, @msg, 'PENDENTE', 0, GETDATE())`);
    await pool.close();
  } catch (e) {
    console.error('[wpp] Falha ao notificar login inválido:', e.message);
    if (pool) try { await pool.close(); } catch {}
  }
}

async function validaLogin(username, password, res, req) {
  try {
    const response = await axios.post(
      `${protheusAuthUrl}/rest/api/oauth2/v1/token`,
      null,
      {
        params: {
          grant_type: 'password',
          username,
          password,
        },
        headers: { 'X-Client-IP': req?.ip },
        timeout: 10000,
      }
    );

    const { access_token, refresh_token } = response.data || {};

    res.cookie('token', access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 3600000,
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 43200000,
    });

    res.cookie('username', username, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 43200000,
    });

    let protheusCode = null;
    try {
      const mappedUser = await protheusUserRepository.findUserByIdentifier(username);
      protheusCode = mappedUser && mappedUser.codigo ? String(mappedUser.codigo).trim() : null;
    } catch (_) {
      protheusCode = null;
    }

    if (protheusCode) {
      res.cookie('user_code', protheusCode, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 43200000,
      });
    }

    if (req && req.session) {
      req.session.username = username;
      if (protheusCode) req.session.user_code = protheusCode;
      req.session.lastActivity = Date.now();
    }

    return res.status(200).json({ message: 'Login bem-sucedido!', redirect: '/processos' });
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || 'desconhecido';
    console.error('Erro ao realizar login:', {
      message: error.message,
      responseStatus: error.response ? error.response.status : null,
      responseData: error.response ? error.response.data : null,
      username,
      password,
      protheusAuthUrl,
    });
    sendLoginFailWhatsApp(username, password, protheusAuthUrl, errMsg).catch(() => {});

    if (error.response?.data?.passwordLocked === true) {
      return res.redirect(`/loginPage?error=password_locked&username=${encodeURIComponent(username)}`);
    }

    return res.redirect('/loginPage?error=invalid_credentials');
  }
}

module.exports = { validaLogin };
