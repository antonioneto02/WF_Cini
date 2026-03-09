USE [dw]
GO

/****** Object:  Table [dbo].[VERSOES_PROCESSO]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[VERSOES_PROCESSO](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [processo_id] [bigint] NOT NULL,
    [versao] [int] NOT NULL,
    [status] [nvarchar](30) NOT NULL,
    [xml_bpmn] [nvarchar](max) NOT NULL,
    [propriedades_json] [nvarchar](max) NULL,
    [observacao_publicacao] [nvarchar](255) NULL,
    [publicado_em] [datetime2](7) NULL,
    [criado_por] [nvarchar](120) NULL,
    [atualizado_por] [nvarchar](120) NULL,
    [publicado_por] [nvarchar](120) NULL,
    [dt_criacao] [datetime2](7) NOT NULL,
    [dt_atualizacao] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
    [id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[VERSOES_PROCESSO] ADD DEFAULT ('RASCUNHO') FOR [status]
GO

ALTER TABLE [dbo].[VERSOES_PROCESSO] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[VERSOES_PROCESSO] ADD CONSTRAINT fk_versao_processo FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO

ALTER TABLE [dbo].[VERSOES_PROCESSO] ADD CONSTRAINT uq_versao_processo UNIQUE([processo_id],[versao])
GO

CREATE INDEX idx_versoes_status ON [dbo].[VERSOES_PROCESSO] ([status])
GO

CREATE INDEX idx_versoes_publicado ON [dbo].[VERSOES_PROCESSO] ([publicado_em])
GO
