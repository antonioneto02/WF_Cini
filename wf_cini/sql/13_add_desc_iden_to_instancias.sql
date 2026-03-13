USE [dw]
GO

-- 1) Add desc_iden column to INSTANCIAS_PROCESSO if it does not exist
IF COL_LENGTH('dbo.INSTANCIAS_PROCESSO', 'desc_iden') IS NULL
BEGIN
    ALTER TABLE dbo.INSTANCIAS_PROCESSO ADD desc_iden NVARCHAR(180) NULL;
END
GO

-- 2) Backfill desc_iden on instances from PROCESSOS (copy current process value)
UPDATE i
SET desc_iden = p.desc_iden
FROM dbo.INSTANCIAS_PROCESSO i
JOIN dbo.PROCESSOS p ON p.id = i.processo_id
WHERE p.desc_iden IS NOT NULL
  AND (i.desc_iden IS NULL OR i.desc_iden <> p.desc_iden);
GO

-- 3) Create an index on instancias_processo.desc_iden if not exists
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_instancias_desc_iden' AND object_id = OBJECT_ID('dbo.INSTANCIAS_PROCESSO'))
BEGIN
    CREATE INDEX idx_instancias_desc_iden ON dbo.INSTANCIAS_PROCESSO (desc_iden);
END
GO
