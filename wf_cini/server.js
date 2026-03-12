const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const sql = require('mssql');

require('dotenv').config();

const loginController = require('./controllers/loginController');
const dbConfig = require('./config/database');
const dbProtheus = require('./config/dbConfigProtheus');
const dbDw = require('./config/dbConfigDw');
const { registerBpmModule } = require('./backend/app');

const app = express();
const PORT = process.env.PORT;
const DEFAULT_AUTH_REDIRECT = '/processos';

app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'frontend', 'views'),
]);
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'PortalConsultasCini', 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'PortalConsultasCini', 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'PortalConsultasCini', 'public', 'images')));

app.use((req, res, next) => {
  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  res.locals.currentPath = req.path || '/';
  const login = (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'Usuario';
  const normalizedLogin = String(login || '').trim().toUpperCase();
  res.locals.user = {
    nome: login,
    email: (req.session && req.session.user_email) || '',
    id: (req.session && req.session.user_id) || null,
    login: normalizedLogin,
    isDev: normalizedLogin === '000460',
  };

  // Global helpers for EJS views to keep all date rendering consistent.
  res.locals.fmtDateTime = (value) => {
    const date = parseDate(value);
    if (!date) return '-';
    return dateTimeFormatter.format(date);
  };

  res.locals.toEpochMs = (value) => {
    const date = parseDate(value);
    if (!date) return '';
    return String(date.getTime());
  };

  next();
});

function isAuthenticated(req) {
  const hasSession = req.session && req.session.username;
  const hasToken = req.cookies && (req.cookies.token || req.cookies.refresh_token);
  return Boolean(hasSession || hasToken);
}

function ensureAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.redirect('/loginPage');
  }

  if (req.session && !req.session.username && req.cookies && req.cookies.username) {
    req.session.username = req.cookies.username;
  }

  if (req.session && !req.session.user_code && req.cookies && req.cookies.user_code) {
    req.session.user_code = req.cookies.user_code;
  }

  return next();
}

function buildUser(req) {
  return {
    nome: (req.session && req.session.username) || (req.cookies && req.cookies.username) || 'Usuario',
    email: (req.session && req.session.user_email) || '',
    id: (req.session && req.session.user_id) || null,
  };
}

function renderShell(pageTitle, pageDescription) {
  return (req, res) => {
    res.render('erpShell', {
      pageTitle,
      pageDescription,
      user: buildUser(req),
    });
  };
}

app.get('/', (req, res) => {
  if (isAuthenticated(req)) return res.redirect(DEFAULT_AUTH_REDIRECT);
  return res.redirect('/loginPage');
});

app.get('/loginPage', (req, res) => {
  if (isAuthenticated(req)) return res.redirect(DEFAULT_AUTH_REDIRECT);
  const error = req.query.error || null;
  return res.render('System/loginPage', { error, req });
});

app.post('/login', async (req, res) => {
  const username = (req.body.username || req.body.user || req.body.email || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    return res.status(400).json({ message: 'Preencha todos os campos' });
  }

  try {
    return await loginController.validaLogin(username, password, res, req);
  } catch (err) {
    console.error('Erro no login:', err && err.message ? err.message : err);
    return res.redirect('/loginPage?error=invalid_credentials');
  }
});

app.get('/logout', (req, res) => {
  try {
    res.clearCookie('token');
    res.clearCookie('refresh_token');
    res.clearCookie('username');
    res.clearCookie('user_code');
    if (req.session) {
      req.session.destroy(() => {});
    }
  } catch (_) {}

  return res.redirect('/loginPage?logout=true');
});

app.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', { user: buildUser(req) });
});

app.get('/retiras', ensureAuth, renderShell('Retiras Portaria', 'Modulo vazio'));
app.get('/cadastro-recebimentos', ensureAuth, renderShell('Cadastro Recebimentos', 'Modulo vazio'));
app.get('/agendamentos', ensureAuth, renderShell('Agendamentos', 'Modulo vazio'));
app.get('/horarios-retira', ensureAuth, renderShell('Retiras', 'Modulo vazio'));
app.get('/listagem/agendamento-portal', ensureAuth, renderShell('Listagem Visitas', 'Modulo vazio'));
app.get('/listagem/horarios-agendamento', ensureAuth, renderShell('Listagem Retiras', 'Modulo vazio'));
app.get('/listagem/cargas-portaria', ensureAuth, renderShell('Listagem Cargas', 'Modulo vazio'));
app.get('/conferencia', ensureAuth, renderShell('Conferencia Pessoas', 'Modulo vazio'));

app.get('/db-status', ensureAuth, async (req, res) => {
  async function check(label, config) {
    try {
      const pool = await new sql.ConnectionPool(config).connect();
      await pool.close();
      return { ok: true, label };
    } catch (err) {
      return {
        ok: false,
        label,
        error: err && err.message ? err.message : String(err),
      };
    }
  }

  const [erp, dw, protheus] = await Promise.all([
    check('ERP', dbConfig),
    check('DW', dbDw),
    check('PROTHEUS', dbProtheus),
  ]);

  return res.json({ erp, dw, protheus });
});

registerBpmModule(app, {
  ensureAuth,
});

app.use((req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/loginPage');
  return res.redirect(DEFAULT_AUTH_REDIRECT);
});

app.listen(PORT, () => {
  console.log(`ERP Login Vazio rodando em http://localhost:${PORT}`);
});
