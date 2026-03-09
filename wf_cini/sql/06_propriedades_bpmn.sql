USE [dw]
GO

/****** Object:  Table [dbo].[PROPRIEDADES_BPMN]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PROPRIEDADES_BPMN](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [versao_processo_id] [bigint] NOT NULL,
    [elemento_id] [nvarchar](120) NOT NULL,
    [tipo_elemento] [nvarchar](120) NOT NULL,
    [propriedade] [nvarchar](120) NOT NULL,
    [valor_texto] [nvarchar](max) NULL,
    [valor_json] [nvarchar](max) NULL,
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

ALTER TABLE [dbo].[PROPRIEDADES_BPMN] ADD DEFAULT ('ATIVO') FOR [status]
GO

ALTER TABLE [dbo].[PROPRIEDADES_BPMN] ADD DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[PROPRIEDADES_BPMN] ADD CONSTRAINT fk_prop_bpmn_versao FOREIGN KEY([versao_processo_id]) REFERENCES [dbo].[VERSOES_PROCESSO]([id])
GO

ALTER TABLE [dbo].[PROPRIEDADES_BPMN] ADD CONSTRAINT uq_prop_bpmn_elemento UNIQUE([versao_processo_id],[elemento_id],[propriedade])
GO

CREATE INDEX idx_prop_bpmn_element ON [dbo].[PROPRIEDADES_BPMN] ([elemento_id])
GO

CREATE INDEX idx_prop_bpmn_type ON [dbo].[PROPRIEDADES_BPMN] ([tipo_elemento])
GO

CREATE INDEX idx_prop_bpmn_status ON [dbo].[PROPRIEDADES_BPMN] ([status])
GO
