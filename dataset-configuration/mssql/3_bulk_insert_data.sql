-- ============================================================
-- MIMIC-IV 3.1 — BULK INSERT all 31 tables
-- Database:  Healthcare-MIMIC-IV  (176.9.16.194,1433)
-- ============================================================
-- PREREQUISITES:
--   1. Run 1_decompress_mimic.ps1  → extracts .gz to .csv
--   2. Run 2_create_database_schema.sql  → creates all tables
--   3. Do the path setup below, then run this script in SSMS.
-- ============================================================

USE [Healthcare-MIMIC-IV];
GO

-- ============================================================
-- IMPORTANT — REMOTE SERVER FILE PATH NOTICE
-- ============================================================
-- Your SQL Server is on a REMOTE machine (176.9.16.194).
-- BULK INSERT reads files from the SERVER's file system, NOT
-- from your local F: drive.
--
-- OPTION A — Share your local folder (easiest):
--   1. In Windows Explorer: right-click the folder
--      → Properties → Sharing → Share it
--      → Give the SQL Server service account READ access
--        (usually "Everyone" is enough for testing)
--   2. Find your local IP:  run  ipconfig  in PowerShell
--   3. Use the UNC path below:
--      \\YOUR_LOCAL_IP\ShareName\mimic-iv-3.1\mimic-iv-3.1
--
-- OPTION B — Copy files to the remote server:
--   Copy the decompressed CSVs to a folder on the server
--   (e.g. C:\MIMIC-IV\) and use that path below.
--
-- *** STEP: In SSMS press Ctrl+H and do Find & Replace ***
--   Find:    <DATA_PATH>
--   Replace: your actual path (no trailing backslash)
--
--   Example A (UNC share):
--     \\192.168.1.50\mimic-share\mimic-iv-3.1\mimic-iv-3.1
--   Example B (server local):
--     C:\MIMIC-IV\mimic-iv-3.1
-- ============================================================

PRINT 'Starting BULK INSERT for MIMIC-IV 3.1 ...';
GO

-- ──────────────────────────────────────────────────────────
-- HOSP tables (22)
-- ──────────────────────────────────────────────────────────

PRINT 'Loading hosp.patients ...';
BULK INSERT hosp.patients
FROM '<DATA_PATH>\hosp\patients.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.admissions ...';
BULK INSERT hosp.admissions
FROM '<DATA_PATH>\hosp\admissions.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.transfers ...';
BULK INSERT hosp.transfers
FROM '<DATA_PATH>\hosp\transfers.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.services ...';
BULK INSERT hosp.services
FROM '<DATA_PATH>\hosp\services.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.provider ...';
BULK INSERT hosp.provider
FROM '<DATA_PATH>\hosp\provider.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.d_icd_diagnoses ...';
BULK INSERT hosp.d_icd_diagnoses
FROM '<DATA_PATH>\hosp\d_icd_diagnoses.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.diagnoses_icd ...';
BULK INSERT hosp.diagnoses_icd
FROM '<DATA_PATH>\hosp\diagnoses_icd.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.d_icd_procedures ...';
BULK INSERT hosp.d_icd_procedures
FROM '<DATA_PATH>\hosp\d_icd_procedures.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.procedures_icd ...';
BULK INSERT hosp.procedures_icd
FROM '<DATA_PATH>\hosp\procedures_icd.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.d_hcpcs ...';
BULK INSERT hosp.d_hcpcs
FROM '<DATA_PATH>\hosp\d_hcpcs.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.hcpcsevents ...';
BULK INSERT hosp.hcpcsevents
FROM '<DATA_PATH>\hosp\hcpcsevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.drgcodes ...';
BULK INSERT hosp.drgcodes
FROM '<DATA_PATH>\hosp\drgcodes.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.d_labitems ...';
BULK INSERT hosp.d_labitems
FROM '<DATA_PATH>\hosp\d_labitems.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.labevents  (large — several minutes) ...';
BULK INSERT hosp.labevents
FROM '<DATA_PATH>\hosp\labevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT 'Loading hosp.microbiologyevents ...';
BULK INSERT hosp.microbiologyevents
FROM '<DATA_PATH>\hosp\microbiologyevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading hosp.omr ...';
BULK INSERT hosp.omr
FROM '<DATA_PATH>\hosp\omr.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading hosp.poe ...';
BULK INSERT hosp.poe
FROM '<DATA_PATH>\hosp\poe.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading hosp.poe_detail ...';
BULK INSERT hosp.poe_detail
FROM '<DATA_PATH>\hosp\poe_detail.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading hosp.pharmacy ...';
BULK INSERT hosp.pharmacy
FROM '<DATA_PATH>\hosp\pharmacy.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading hosp.prescriptions ...';
BULK INSERT hosp.prescriptions
FROM '<DATA_PATH>\hosp\prescriptions.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading hosp.emar  (large — several minutes) ...';
BULK INSERT hosp.emar
FROM '<DATA_PATH>\hosp\emar.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT 'Loading hosp.emar_detail  (large — several minutes) ...';
BULK INSERT hosp.emar_detail
FROM '<DATA_PATH>\hosp\emar_detail.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

-- ──────────────────────────────────────────────────────────
-- ICU tables (9)
-- ──────────────────────────────────────────────────────────

PRINT 'Loading icu.caregiver ...';
BULK INSERT icu.caregiver
FROM '<DATA_PATH>\icu\caregiver.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading icu.icustays ...';
BULK INSERT icu.icustays
FROM '<DATA_PATH>\icu\icustays.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading icu.d_items ...';
BULK INSERT icu.d_items
FROM '<DATA_PATH>\icu\d_items.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', TABLOCK);
GO

PRINT 'Loading icu.chartevents  (VERY large — 10-20+ minutes) ...';
BULK INSERT icu.chartevents
FROM '<DATA_PATH>\icu\chartevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=500000, TABLOCK);
GO

PRINT 'Loading icu.datetimeevents ...';
BULK INSERT icu.datetimeevents
FROM '<DATA_PATH>\icu\datetimeevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT 'Loading icu.inputevents ...';
BULK INSERT icu.inputevents
FROM '<DATA_PATH>\icu\inputevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT 'Loading icu.outputevents ...';
BULK INSERT icu.outputevents
FROM '<DATA_PATH>\icu\outputevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT 'Loading icu.procedureevents ...';
BULK INSERT icu.procedureevents
FROM '<DATA_PATH>\icu\procedureevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=50000, TABLOCK);
GO

PRINT 'Loading icu.ingredientevents ...';
BULK INSERT icu.ingredientevents
FROM '<DATA_PATH>\icu\ingredientevents.csv'
WITH (FORMAT='CSV', FIRSTROW=2, FIELDTERMINATOR=',', ROWTERMINATOR='0x0a', BATCHSIZE=100000, TABLOCK);
GO

PRINT '=== All 31 tables loaded successfully. ===';
GO

-- ──────────────────────────────────────────────────────────
-- Row count verification
-- ──────────────────────────────────────────────────────────
SELECT
    s.name          AS [schema],
    t.name          AS [table],
    p.rows          AS [row_count]
FROM sys.tables      t
JOIN sys.schemas     s ON t.schema_id = s.schema_id
JOIN sys.partitions  p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE s.name IN ('hosp','icu')
ORDER BY s.name, t.name;
GO
