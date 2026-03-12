USE [dw]
GO

IF OBJECT_ID('dbo.WF_DASHBOARD_PREFS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WF_DASHBOARD_PREFS (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario NVARCHAR(120) NOT NULL,
    perfil NVARCHAR(40) NOT NULL,
    widgets_json NVARCHAR(MAX) NULL,
    atalhos_json NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
    dt_atualizacao DATETIME2 NULL
  );

  CREATE UNIQUE INDEX uq_wf_dashboard_prefs_usuario
    ON dbo.WF_DASHBOARD_PREFS(usuario);
END
GO

/* Notificacoes e alertas SLA com escalonamento */
IF OBJECT_ID('dbo.WF_NOTIFICACOES', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WF_NOTIFICACOES (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    usuario NVARCHAR(120) NOT NULL,
    titulo NVARCHAR(180) NOT NULL,
    mensagem NVARCHAR(MAX) NULL,
    tipo NVARCHAR(40) NOT NULL DEFAULT 'INFO',
    escopo_tipo NVARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    escopo_id BIGINT NULL,
    prioridade INT NOT NULL DEFAULT 2,
    nivel_escalonamento INT NOT NULL DEFAULT 0,
    meta_json NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'UNREAD',
    lido_em DATETIME2 NULL,
    dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
    dt_atualizacao DATETIME2 NULL
  );

  CREATE INDEX idx_wf_notificacoes_usuario_status
    ON dbo.WF_NOTIFICACOES(usuario, status, dt_criacao DESC);

  CREATE INDEX idx_wf_notificacoes_escopo
    ON dbo.WF_NOTIFICACOES(escopo_tipo, escopo_id, nivel_escalonamento, dt_criacao DESC);
END
GO

/* Comentarios colaborativos */
IF OBJECT_ID('dbo.WF_COMENTARIOS', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.WF_COMENTARIOS (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    instancia_processo_id BIGINT NOT NULL,
    tarefa_id BIGINT NULL,
    autor NVARCHAR(120) NOT NULL,
    mensagem NVARCHAR(MAX) NOT NULL,
    mencoes_json NVARCHAR(MAX) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    dt_criacao DATETIME2 NOT NULL DEFAULT GETDATE(),
    dt_atualizacao DATETIME2 NULL
  );

  CREATE INDEX idx_wf_comentarios_instancia
    ON dbo.WF_COMENTARIOS(instancia_processo_id, dt_criacao DESC);

  CREATE INDEX idx_wf_comentarios_tarefa
    ON dbo.WF_COMENTARIOS(tarefa_id, dt_criacao DESC);

  CREATE INDEX idx_wf_comentarios_autor
    ON dbo.WF_COMENTARIOS(autor, dt_criacao DESC);
END
GO
