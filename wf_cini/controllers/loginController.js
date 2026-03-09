const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

async function validaLogin(username, password, res, req) {
  const protheusServer = process.env.PROTHEUS_SERVER;

  try {
    if (!protheusServer) {
      return res.status(500).json({ message: 'PROTHEUS_SERVER nao configurado no .env' });
    }

    const response = await axios.post(
      `http://${protheusServer}:9001/rest/api/oauth2/v1/token`,
      null,
      {
        params: {
          grant_type: 'password',
          username,
          password,
        },
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

    if (req && req.session) {
      req.session.username = username;
      req.session.lastActivity = Date.now();
    }

    return res.status(200).json({ message: 'Login bem-sucedido!', redirect: '/processos' });
  } catch (error) {
    console.error('Erro ao realizar login:', {
      message: error.message,
      responseStatus: error.response ? error.response.status : null,
      responseData: error.response ? error.response.data : null,
      username,
      protheusServer,
    });

    return res.redirect('/loginPage?error=invalid_credentials');
  }
}

module.exports = { validaLogin };
