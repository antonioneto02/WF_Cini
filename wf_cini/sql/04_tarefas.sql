USE [dw]
GO

/****** Object:  Table [dbo].[TAREFAS]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[TAREFAS](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [instancia_processo_id] [bigint] NOT NULL,
    [processo_id] [bigint] NOT NULL,
    [versao_processo_id] [bigint] NOT NULL,
    [elemento_id] [nvarchar](120) NOT NULL,
    [nome_etapa] [nvarchar](180) NOT NULL,
    [responsavel] [nvarchar](120) NULL,
    [sla_horas] [int] NOT NULL,
    [configuracao_formulario_json] [nvarchar](max) NULL,
    [resposta_json] [nvarchar](max) NULL,
    [acao_final] [nvarchar](50) NULL,
    [observacao_final] [nvarchar](max) NULL,
    [status] [nvarchar](30) NOT NULL,
    [iniciado_em] [datetime2](7) NULL,
    [concluido_em] [datetime2](7) NULL,
    [concluido_por] [nvarchar](120) NULL,
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

ALTER TABLE [dbo].[TAREFAS] ADD  DEFAULT (24) FOR [sla_horas]
GO

ALTER TABLE [dbo].[TAREFAS] ADD  DEFAULT ('MINHAS_TAREFAS') FOR [status]
GO

ALTER TABLE [dbo].[TAREFAS] ADD  DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[TAREFAS] ADD CONSTRAINT fk_tarefas_instancia FOREIGN KEY([instancia_processo_id]) REFERENCES [dbo].[INSTANCIAS_PROCESSO]([id])
GO

ALTER TABLE [dbo].[TAREFAS] ADD CONSTRAINT fk_tarefas_processo FOREIGN KEY([processo_id]) REFERENCES [dbo].[PROCESSOS]([id])
GO

ALTER TABLE [dbo].[TAREFAS] ADD CONSTRAINT fk_tarefas_versao FOREIGN KEY([versao_processo_id]) REFERENCES [dbo].[VERSOES_PROCESSO]([id])
GO

CREATE INDEX idx_tarefas_status ON [dbo].[TAREFAS] ([status])
GO

CREATE INDEX idx_tarefas_responsavel ON [dbo].[TAREFAS] ([responsavel])
GO

CREATE INDEX idx_tarefas_instancia_status ON [dbo].[TAREFAS] ([instancia_processo_id],[status])
GO

/****** Object:  Table [dbo].[RESPOSTAS_FORMULARIO]    Script Date: 05/03/2026 14:35:00 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[RESPOSTAS_FORMULARIO](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [tarefa_id] [bigint] NOT NULL,
    [instancia_processo_id] [bigint] NOT NULL,
    [formulario_id] [bigint] NOT NULL,
    [resposta_json] [nvarchar](max) NOT NULL,
    [status] [nvarchar](30) NOT NULL,
    [respondido_por] [nvarchar](120) NULL,
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

ALTER TABLE [dbo].[RESPOSTAS_FORMULARIO] ADD  DEFAULT ('ATIVO') FOR [status]
GO

ALTER TABLE [dbo].[RESPOSTAS_FORMULARIO] ADD  DEFAULT (getdate()) FOR [dt_criacao]
GO

ALTER TABLE [dbo].[RESPOSTAS_FORMULARIO] ADD CONSTRAINT fk_respostas_tarefa FOREIGN KEY([tarefa_id]) REFERENCES [dbo].[TAREFAS]([id])
GO

ALTER TABLE [dbo].[RESPOSTAS_FORMULARIO] ADD CONSTRAINT fk_respostas_instancia FOREIGN KEY([instancia_processo_id]) REFERENCES [dbo].[INSTANCIAS_PROCESSO]([id])
GO

ALTER TABLE [dbo].[RESPOSTAS_FORMULARIO] ADD CONSTRAINT fk_respostas_formulario FOREIGN KEY([formulario_id]) REFERENCES [dbo].[FORMULARIOS]([id])
GO

CREATE INDEX idx_respostas_instancia ON [dbo].[RESPOSTAS_FORMULARIO] ([instancia_processo_id])
GO

CREATE INDEX idx_respostas_formulario ON [dbo].[RESPOSTAS_FORMULARIO] ([formulario_id])
GO

CREATE INDEX idx_respostas_status ON [dbo].[RESPOSTAS_FORMULARIO] ([status])
GO
