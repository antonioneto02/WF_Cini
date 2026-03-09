const dotenv = require('dotenv');
dotenv.config();
if (!process.env.DB_DATABASE_ERP && process.env.NODE_ENV !== 'production') {
  console.warn('Warning: DB_DATABASE_ERP not set, defaulting to "wf" for local development');
}

const config = {
  user: process.env.DB_USER_ERP,
  password: process.env.DB_PASSWORD_ERP,
  server: process.env.DB_SERVER_ERP,
  database: process.env.DB_DATABASE_ERP || 'wf',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    useUTC: false,
  },
  requestTimeout: 300000,
};

module.exports = config;
