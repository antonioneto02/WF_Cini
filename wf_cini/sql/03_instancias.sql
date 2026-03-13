USE [dw]
GO

/****** Object:  Table [dbo].[INSTANCIAS_PROCESSO]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[INSTANCIAS_PROCESSO](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [processo_id] [bigint] NOT NULL,
    [versao_processo_id] [bigint] NOT NULL,
    [solicitante] [nvarchar](120) NULL,
    [identificador] [nvarchar](180) NULL,
    [dados_json] [nvarchar](max) NULL,
    [estado_execucao_json] [nvarchar](max) NULL,
    [elemento_atual_id] [nvarchar](120) NULL,
    [status] [nvarchar](30) NOT NULL,
    [iniciado_em] [datetime2](7) NOT NULL,
    [encerrado_em] [datetime2](7) NULL,
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

ALTER TABLE [dbo].[INSTANCIAS_PROCESSO] ADD DEFAULT ('EM_ANDAMENTO') FOR [status]
GO

ALTER TABLE [dbo].[INSTANCIAS_PROCESSO] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[INSTANCIAS_PROCESSO] ADD CONSTRAINT fk_instancias_processo FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO

ALTER TABLE [dbo].[INSTANCIAS_PROCESSO] ADD CONSTRAINT fk_instancias_versao FOREIGN KEY([versao_processo_id]) REFERENCES [dbo].[VERSOES_PROCESSO]([id])
GO

CREATE INDEX idx_instancias_status ON [dbo].[INSTANCIAS_PROCESSO] ([status])
GO

CREATE INDEX idx_instancias_processo_status ON [dbo].[INSTANCIAS_PROCESSO] ([processo_id],[status])
GO

CREATE INDEX idx_instancias_iniciado ON [dbo].[INSTANCIAS_PROCESSO] ([iniciado_em])
GO

CREATE INDEX idx_instancias_identificador ON [dbo].[INSTANCIAS_PROCESSO] ([identificador])
GO
