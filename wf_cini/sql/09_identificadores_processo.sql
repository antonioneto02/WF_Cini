USE [dw]
GO

IF COL_LENGTH('dbo.PROCESSOS', 'usa_identificador') IS NULL
BEGIN
    ALTER TABLE [dbo].[PROCESSOS]
    ADD [usa_identificador] [bit] NOT NULL
        CONSTRAINT [DF_PROCESSOS_USA_IDENTIFICADOR] DEFAULT ((0));
END
GO

IF COL_LENGTH('dbo.PROCESSOS', 'tipo_identificador') IS NULL
BEGIN
    ALTER TABLE [dbo].[PROCESSOS]
    ADD [tipo_identificador] [nvarchar](20) NULL;
END
GO

IF OBJECT_ID('dbo.CK_PROCESSOS_TIPO_IDENTIFICADOR', 'C') IS NULL
BEGIN
    ALTER TABLE [dbo].[PROCESSOS]
    ADD CONSTRAINT [CK_PROCESSOS_TIPO_IDENTIFICADOR]
    CHECK ([tipo_identificador] IS NULL OR [tipo_identificador] IN ('TEXTO', 'SEQUENCIAL'));
END
GO

IF COL_LENGTH('dbo.INSTANCIAS_PROCESSO', 'identificador') IS NULL
BEGIN
    ALTER TABLE [dbo].[INSTANCIAS_PROCESSO]
    ADD [identificador] [nvarchar](180) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_instancias_identificador'
      AND object_id = OBJECT_ID('dbo.INSTANCIAS_PROCESSO')
)
BEGIN
    CREATE INDEX idx_instancias_identificador ON [dbo].[INSTANCIAS_PROCESSO] ([identificador]);
END
GO
