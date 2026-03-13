USE [dw]
GO

/****** Object:  Table [dbo].[PROCESSOS]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[PROCESSOS](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [nome] [nvarchar](180) NOT NULL,
    [codigo] [nvarchar](100) NOT NULL,
    [descricao] [nvarchar](max) NULL,
    [status] [nvarchar](30) NOT NULL,
    [usa_identificador] [bit] NOT NULL,
    [tipo_identificador] [nvarchar](20) NULL,
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

ALTER TABLE [dbo].[PROCESSOS] ADD  DEFAULT ('ATIVO') FOR [status]
GO

ALTER TABLE [dbo].[PROCESSOS] ADD  DEFAULT ((0)) FOR [usa_identificador]
GO

ALTER TABLE [dbo].[PROCESSOS] ADD  DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[PROCESSOS] ADD CONSTRAINT uq_processos_codigo UNIQUE ([codigo])
GO

ALTER TABLE [dbo].[PROCESSOS] ADD CONSTRAINT ck_processos_tipo_identificador CHECK ([tipo_identificador] IS NULL OR [tipo_identificador] IN ('TEXTO', 'SEQUENCIAL'))
GO

CREATE INDEX idx_processos_status ON [dbo].[PROCESSOS] ([status])
GO

CREATE INDEX idx_processos_nome ON [dbo].[PROCESSOS] ([nome])
GO

/****** Object:  Table [dbo].[FORMULARIOS]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[FORMULARIOS](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [processo_id] [bigint] NOT NULL,
    [nome] [nvarchar](180) NOT NULL,
    [xml_bpmn] [nvarchar](max) NOT NULL,
    [propriedades_json] [nvarchar](max) NULL,
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

ALTER TABLE [dbo].[FORMULARIOS] ADD  DEFAULT ('ATIVO') FOR [status]
GO

ALTER TABLE [dbo].[FORMULARIOS] ADD  DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[FORMULARIOS] ADD CONSTRAINT fk_formularios_processo FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO

CREATE INDEX idx_formularios_processo ON [dbo].[FORMULARIOS] ([processo_id])
GO

CREATE INDEX idx_formularios_status ON [dbo].[FORMULARIOS] ([status])
GO
