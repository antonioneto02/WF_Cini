const swaggerUi = require('swagger-ui-express');

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'WF Cini — Workflow BPM',
    version: '1.0.0',
    description: 'Sistema de workflow BPM (Business Process Management) com modelagem BPMN. Gerencia processos, tarefas e aprovações. Autenticação via sessão.',
  },
  servers: [{ url: 'http://localhost:3005', description: 'Servidor local' }],
  tags: [
    { name: 'Autenticação' },
    { name: 'Dashboard' },
    { name: 'Portaria', description: 'Módulos de portaria' },
    { name: 'Sistema', description: 'Status e utilitários' },
  ],
  paths: {
    '/loginPage': { get: { tags: ['Autenticação'], summary: 'Página de login', responses: { 200: { description: 'HTML da tela de login' } } } },
    '/login': {
      post: {
        tags: ['Autenticação'], summary: 'Autentica usuário',
        requestBody: { content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string', format: 'password' } } } } } },
        responses: { 302: { description: 'Redireciona para /dashboard ou volta com erro' } },
      },
    },
    '/logout': { get: { tags: ['Autenticação'], summary: 'Encerra sessão', responses: { 302: { description: 'Redireciona para /loginPage' } } } },
    '/dashboard': { get: { tags: ['Dashboard'], summary: 'Painel principal do WF', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Dashboard' } } } },
    '/retiras': { get: { tags: ['Portaria'], summary: 'Módulo retiras (em desenvolvimento)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/cadastro-recebimentos': { get: { tags: ['Portaria'], summary: 'Cadastro de recebimentos (em desenvolvimento)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/agendamentos': { get: { tags: ['Portaria'], summary: 'Agendamentos (em desenvolvimento)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/horarios-retira': { get: { tags: ['Portaria'], summary: 'Horários de retira (em desenvolvimento)', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/listagem/agendamento-portal': { get: { tags: ['Portaria'], summary: 'Listagem de visitas agendadas', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/listagem/horarios-agendamento': { get: { tags: ['Portaria'], summary: 'Listagem de horários de retira', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/listagem/cargas-portaria': { get: { tags: ['Portaria'], summary: 'Listagem de cargas', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/conferencia': { get: { tags: ['Portaria'], summary: 'Conferência de pessoas', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Página' } } } },
    '/db-status': { get: { tags: ['Sistema'], summary: 'Status de conexão com o banco de dados', security: [{ cookieAuth: [] }], responses: { 200: { description: 'Status das conexões MSSQL e MySQL' } } } },
  },
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'connect.sid' } },
  },
};

module.exports = { swaggerUi, swaggerDocument };
