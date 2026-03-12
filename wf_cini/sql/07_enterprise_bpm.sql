USE [dw]
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PROCESSO_PERMISSOES](
  [id] [bigint] IDENTITY(1,1) NOT NULL,
  [processo_id] [bigint] NOT NULL,
  [usuario] [nvarchar](120) NOT NULL,
  [pode_visualizar] [bit] NOT NULL,
  [pode_editar] [bit] NOT NULL,
  [pode_modelar] [bit] NOT NULL,
  [pode_executar] [bit] NOT NULL,
  [pode_administrar] [bit] NOT NULL,
  [criado_por] [nvarchar](120) NULL,
  [dt_criacao] [datetime2](7) NOT NULL,
  CONSTRAINT [PK_PROCESSO_PERMISSOES] PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT ((1)) FOR [pode_visualizar]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT ((0)) FOR [pode_editar]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT ((0)) FOR [pode_modelar]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT ((0)) FOR [pode_executar]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT ((0)) FOR [pode_administrar]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO
ALTER TABLE [dbo].[PROCESSO_PERMISSOES] ADD CONSTRAINT [FK_PROCESSO_PERMISSOES_PROCESSO] FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO
CREATE UNIQUE INDEX [UQ_PROCESSO_PERMISSOES_USER] ON [dbo].[PROCESSO_PERMISSOES] ([processo_id], [usuario])
GO

CREATE TABLE [dbo].[PROCESSO_API_CONFIG](
  [id] [bigint] IDENTITY(1,1) NOT NULL,
  [processo_id] [bigint] NOT NULL,
  [chave_api_publica] [nvarchar](120) NOT NULL,
  [permite_protheus] [bit] NOT NULL,
  [permite_mysql] [bit] NOT NULL,
  [permite_externo] [bit] NOT NULL,
  [ativo] [bit] NOT NULL,
  [criado_por] [nvarchar](120) NULL,
  [atualizado_por] [nvarchar](120) NULL,
  [dt_criacao] [datetime2](7) NOT NULL,
  [dt_atualizacao] [datetime2](7) NULL,
  CONSTRAINT [PK_PROCESSO_API_CONFIG] PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD DEFAULT ((1)) FOR [permite_protheus]
GO
ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD DEFAULT ((1)) FOR [permite_mysql]
GO
ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD DEFAULT ((1)) FOR [permite_externo]
GO
ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD DEFAULT ((1)) FOR [ativo]
GO
ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO
ALTER TABLE [dbo].[PROCESSO_API_CONFIG] ADD CONSTRAINT [FK_PROCESSO_API_CONFIG_PROCESSO] FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO
CREATE UNIQUE INDEX [UQ_PROCESSO_API_CONFIG_PROCESSO] ON [dbo].[PROCESSO_API_CONFIG] ([processo_id])
GO

CREATE TABLE [dbo].[PROCESSO_INTEGRACAO_EVENTOS](
  [id] [bigint] IDENTITY(1,1) NOT NULL,
  [tipo_origem] [nvarchar](40) NOT NULL,
  [chave_origem] [nvarchar](180) NOT NULL,
  [processo_id] [bigint] NOT NULL,
  [instancia_processo_id] [bigint] NOT NULL,
  [dt_criacao] [datetime2](7) NOT NULL,
  CONSTRAINT [PK_PROCESSO_INTEGRACAO_EVENTOS] PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[PROCESSO_INTEGRACAO_EVENTOS] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO
ALTER TABLE [dbo].[PROCESSO_INTEGRACAO_EVENTOS] ADD CONSTRAINT [FK_INTEGRACAO_EVENTOS_PROCESSO] FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO
ALTER TABLE [dbo].[PROCESSO_INTEGRACAO_EVENTOS] ADD CONSTRAINT [FK_INTEGRACAO_EVENTOS_INSTANCIA] FOREIGN KEY([instancia_processo_id]) REFERENCES [dbo].[INSTANCIAS_PROCESSO]([id])
GO
CREATE UNIQUE INDEX [UQ_PROCESSO_INTEGRACAO_EVENTOS] ON [dbo].[PROCESSO_INTEGRACAO_EVENTOS] ([tipo_origem], [chave_origem])
GO

CREATE TABLE [dbo].[AUTOMACOES_CATALOGO](
  [id] [bigint] IDENTITY(1,1) NOT NULL,
  [nome] [nvarchar](180) NOT NULL,
  [descricao] [nvarchar](max) NULL,
  [url_endpoint] [nvarchar](1000) NOT NULL,
  [metodo_http] [nvarchar](10) NOT NULL,
  [tipo_autenticacao] [nvarchar](20) NOT NULL,
  [valor_autenticacao] [nvarchar](800) NULL,
  [tempo_limite_ms] [int] NOT NULL,
  [tentativas_reenvio] [int] NOT NULL,
  [ativo] [bit] NOT NULL,
  [criado_por] [nvarchar](120) NULL,
  [atualizado_por] [nvarchar](120) NULL,
  [dt_criacao] [datetime2](7) NOT NULL,
  [dt_atualizacao] [datetime2](7) NULL,
  CONSTRAINT [PK_AUTOMACOES_CATALOGO] PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT ('POST') FOR [metodo_http]
GO
ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT ('NONE') FOR [tipo_autenticacao]
GO
ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT ((8000)) FOR [tempo_limite_ms]
GO
ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT ((0)) FOR [tentativas_reenvio]
GO
ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT ((1)) FOR [ativo]
GO
ALTER TABLE [dbo].[AUTOMACOES_CATALOGO] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO

CREATE TABLE [dbo].[ECM_ARQUIVOS](
  [id] [bigint] IDENTITY(1,1) NOT NULL,
  [processo_id] [bigint] NOT NULL,
  [instancia_processo_id] [bigint] NULL,
  [usuario_dono] [nvarchar](120) NOT NULL,
  [nome_arquivo] [nvarchar](260) NOT NULL,
  [caminho_arquivo] [nvarchar](1000) NOT NULL,
  [tipo_mime] [nvarchar](180) NULL,
  [tamanho_bytes] [bigint] NOT NULL,
  [versao] [int] NOT NULL,
  [criado_por] [nvarchar](120) NULL,
  [dt_criacao] [datetime2](7) NOT NULL,
  [dt_atualizacao] [datetime2](7) NULL,
  CONSTRAINT [PK_ECM_ARQUIVOS] PRIMARY KEY CLUSTERED ([id] ASC)
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[ECM_ARQUIVOS] ADD DEFAULT ((1)) FOR [versao]
GO
ALTER TABLE [dbo].[ECM_ARQUIVOS] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO
ALTER TABLE [dbo].[ECM_ARQUIVOS] ADD CONSTRAINT [FK_ECM_ARQUIVOS_PROCESSO] FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO
ALTER TABLE [dbo].[ECM_ARQUIVOS] ADD CONSTRAINT [FK_ECM_ARQUIVOS_INSTANCIA] FOREIGN KEY([instancia_processo_id]) REFERENCES [dbo].[INSTANCIAS_PROCESSO]([id])
GO
CREATE INDEX [IDX_ECM_ARQUIVOS_PROCESSO_USER] ON [dbo].[ECM_ARQUIVOS] ([processo_id], [usuario_dono])
GO
