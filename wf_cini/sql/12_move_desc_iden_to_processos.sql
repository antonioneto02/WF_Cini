USE [dw]
GO

-- 1) Add desc_iden column to PROCESSOS if it does not exist
IF COL_LENGTH('dbo.PROCESSOS', 'desc_iden') IS NULL
BEGIN
    ALTER TABLE dbo.PROCESSOS ADD desc_iden NVARCHAR(180) NULL;
END
GO

-- 2) Copy latest non-null desc_iden from INSTANCIAS_PROCESSO into PROCESSOS (one value per process)
UPDATE p
SET desc_iden = t.desc_iden
FROM dbo.processos p
CROSS APPLY (
    SELECT TOP 1 i.desc_iden
    FROM dbo.instancias_processo i
    WHERE i.processo_id = p.id AND i.desc_iden IS NOT NULL
    ORDER BY i.dt_criacao DESC
) t
WHERE p.desc_iden IS NULL AND t.desc_iden IS NOT NULL;
GO

-- 3) Create an index on processos.desc_iden if not exists
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_processos_desc_iden' AND object_id = OBJECT_ID('dbo.PROCESSOS'))
BEGIN
    CREATE INDEX idx_processos_desc_iden ON dbo.PROCESSOS (desc_iden);
END
GO

-- 4) Optional: drop desc_iden from INSTANCIAS_PROCESSO (only run AFTER the application code has been deployed that no longer uses this column)
-- NOTE: run the following block only when you are sure the application is not referencing instancias_processo.desc_iden anymore.
IF COL_LENGTH('dbo.INSTANCIAS_PROCESSO', 'desc_iden') IS NOT NULL
BEGIN
    -- drop index on instancias.desc_iden if present
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_instancias_desc_iden' AND object_id = OBJECT_ID('dbo.INSTANCIAS_PROCESSO'))
    BEGIN
        DROP INDEX idx_instancias_desc_iden ON dbo.INSTANCIAS_PROCESSO;
    END

    ALTER TABLE dbo.INSTANCIAS_PROCESSO DROP COLUMN desc_iden;
END
GO
