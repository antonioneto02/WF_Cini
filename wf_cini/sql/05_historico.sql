USE [dw]
GO

/****** Object:  Table [dbo].[HISTORICO_FLUXO]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[HISTORICO_FLUXO](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [instancia_processo_id] [bigint] NOT NULL,
    [processo_id] [bigint] NOT NULL,
    [versao_processo_id] [bigint] NOT NULL,
    [elemento_origem_id] [nvarchar](120) NULL,
    [elemento_destino_id] [nvarchar](120) NULL,
    [tipo_evento] [nvarchar](60) NOT NULL,
    [descricao] [nvarchar](max) NULL,
    [executor] [nvarchar](120) NULL,
    [dados_json] [nvarchar](max) NULL,
    [status] [nvarchar](30) NOT NULL,
    [criado_por] [nvarchar](120) NULL,
    [atualizado_por] [nvarchar](120) NULL,
    [dt_criacao] [datetime2](7) NOT NULL,
    [dt_atualizacao] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
    [id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[HISTORICO_FLUXO] ADD DEFAULT ('ATIVO') FOR [status]
GO

ALTER TABLE [dbo].[HISTORICO_FLUXO] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[HISTORICO_FLUXO] ADD CONSTRAINT fk_historico_instancia FOREIGN KEY([instancia_processo_id]) REFERENCES [dbo].[INSTANCIAS_PROCESSO]([id])
GO

ALTER TABLE [dbo].[HISTORICO_FLUXO] ADD CONSTRAINT fk_historico_processo FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO

ALTER TABLE [dbo].[HISTORICO_FLUXO] ADD CONSTRAINT fk_historico_versao FOREIGN KEY([versao_processo_id]) REFERENCES [dbo].[VERSOES_PROCESSO]([id])
GO

CREATE INDEX idx_historico_instancia ON [dbo].[HISTORICO_FLUXO] ([instancia_processo_id])
GO

CREATE INDEX idx_historico_evento ON [dbo].[HISTORICO_FLUXO] ([tipo_evento])
GO

CREATE INDEX idx_historico_data ON [dbo].[HISTORICO_FLUXO] ([dt_criacao])
GO
