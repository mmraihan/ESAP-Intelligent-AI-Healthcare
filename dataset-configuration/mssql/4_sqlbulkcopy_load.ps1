# ============================================================
# MIMIC-IV 3.1 — Load all 31 tables via SqlBulkCopy
# Reads CSV files from YOUR LOCAL machine
# Streams data directly to REMOTE SQL Server
# No need to copy files to the server
# ============================================================

Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Data

# ── Connection settings ──────────────────────────────────
$server   = "176.9.16.194,1433"
$database = "Healthcare-MIMIC-IV"
$username = "sa"

$secPwd   = Read-Host "Enter SQL Server (sa) password" -AsSecureString
$plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd))

$connStr  = "Server=$server;Database=$database;User Id=$username;" +
            "Password=$plainPwd;TrustServerCertificate=True;Encrypt=True;" +
            "Connection Timeout=60;"

# ── Local CSV folder ─────────────────────────────────────
$dataDir = "F:\Office-Empowering-Energy\ESAP-API\ESAP-Intelligent-AI-Healthcare\Dataset\mimic-iv-3.1\mimic-iv-3.1"

# ── Table list: csv path → SQL table ────────────────────
$tables = @(
    # HOSP schema
    @{ csv = "hosp\patients.csv";             table = "hosp.patients" },
    @{ csv = "hosp\admissions.csv";           table = "hosp.admissions" },
    @{ csv = "hosp\transfers.csv";            table = "hosp.transfers" },
    @{ csv = "hosp\services.csv";             table = "hosp.services" },
    @{ csv = "hosp\provider.csv";             table = "hosp.provider" },
    @{ csv = "hosp\d_icd_diagnoses.csv";      table = "hosp.d_icd_diagnoses" },
    @{ csv = "hosp\diagnoses_icd.csv";        table = "hosp.diagnoses_icd" },
    @{ csv = "hosp\d_icd_procedures.csv";     table = "hosp.d_icd_procedures" },
    @{ csv = "hosp\procedures_icd.csv";       table = "hosp.procedures_icd" },
    @{ csv = "hosp\d_hcpcs.csv";              table = "hosp.d_hcpcs" },
    @{ csv = "hosp\hcpcsevents.csv";          table = "hosp.hcpcsevents" },
    @{ csv = "hosp\drgcodes.csv";             table = "hosp.drgcodes" },
    @{ csv = "hosp\d_labitems.csv";           table = "hosp.d_labitems" },
    @{ csv = "hosp\labevents.csv";            table = "hosp.labevents" },
    @{ csv = "hosp\microbiologyevents.csv";   table = "hosp.microbiologyevents" },
    @{ csv = "hosp\omr.csv";                  table = "hosp.omr" },
    @{ csv = "hosp\poe.csv";                  table = "hosp.poe" },
    @{ csv = "hosp\poe_detail.csv";           table = "hosp.poe_detail" },
    @{ csv = "hosp\pharmacy.csv";             table = "hosp.pharmacy" },
    @{ csv = "hosp\prescriptions.csv";        table = "hosp.prescriptions" },
    @{ csv = "hosp\emar.csv";                 table = "hosp.emar" },
    @{ csv = "hosp\emar_detail.csv";          table = "hosp.emar_detail" },
    # ICU schema
    @{ csv = "icu\caregiver.csv";             table = "icu.caregiver" },
    @{ csv = "icu\icustays.csv";              table = "icu.icustays" },
    @{ csv = "icu\d_items.csv";              table = "icu.d_items" },
    @{ csv = "icu\chartevents.csv";           table = "icu.chartevents" },
    @{ csv = "icu\datetimeevents.csv";        table = "icu.datetimeevents" },
    @{ csv = "icu\inputevents.csv";           table = "icu.inputevents" },
    @{ csv = "icu\outputevents.csv";          table = "icu.outputevents" },
    @{ csv = "icu\procedureevents.csv";       table = "icu.procedureevents" },
    @{ csv = "icu\ingredientevents.csv";      table = "icu.ingredientevents" }
)

# ── Load function ────────────────────────────────────────
function Load-Table {
    param([string]$csvPath, [string]$tableName)

    if (!(Test-Path $csvPath)) {
        Write-Host "  [SKIP] File not found: $csvPath" -ForegroundColor Yellow
        return
    }

    $fileSize = [math]::Round((Get-Item $csvPath).Length / 1MB, 1)
    Write-Host ""
    Write-Host "Loading $tableName  ($fileSize MB) ..." -ForegroundColor Cyan

    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()

    $bulkCopy = New-Object System.Data.SqlClient.SqlBulkCopy(
        $conn,
        [System.Data.SqlClient.SqlBulkCopyOptions]::TableLock,
        $null)
    $bulkCopy.DestinationTableName = $tableName
    $bulkCopy.BatchSize            = 50000
    $bulkCopy.BulkCopyTimeout      = 0

    # Streaming CSV parser — handles quoted fields with embedded commas
    $parser = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($csvPath)
    $parser.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
    $parser.SetDelimiters(",")
    $parser.HasFieldsEnclosedInQuotes = $true

    # Read header row
    $headers = $parser.ReadFields()

    # Build DataTable schema and column mappings
    $dt = New-Object System.Data.DataTable
    foreach ($h in $headers) {
        $dt.Columns.Add($h) | Out-Null
        $bulkCopy.ColumnMappings.Add($h, $h) | Out-Null
    }

    $total = 0
    $sw    = [System.Diagnostics.Stopwatch]::StartNew()

    while (!$parser.EndOfData) {
        try { $fields = $parser.ReadFields() } catch { continue }

        $row = $dt.NewRow()
        for ($i = 0; $i -lt $headers.Length; $i++) {
            if ($i -lt $fields.Length -and $fields[$i] -ne '') {
                $row[$i] = $fields[$i]
            } else {
                $row[$i] = [DBNull]::Value
            }
        }
        $dt.Rows.Add($row)
        $total++

        if ($dt.Rows.Count -ge 50000) {
            $bulkCopy.WriteToServer($dt)
            $dt.Clear()
            $elapsed = [math]::Round($sw.Elapsed.TotalSeconds, 0)
            Write-Host "  ... $("{0:N0}" -f $total) rows  ($elapsed s)" -ForegroundColor Gray
        }
    }

    if ($dt.Rows.Count -gt 0) { $bulkCopy.WriteToServer($dt) }

    $parser.Close()
    $bulkCopy.Close()
    $conn.Close()
    $sw.Stop()

    $mins = [math]::Round($sw.Elapsed.TotalMinutes, 1)
    Write-Host "  DONE: $("{0:N0}" -f $total) rows loaded in $mins min" -ForegroundColor Green
}

# ── Run all tables ───────────────────────────────────────
$start = Get-Date
Write-Host "========================================" -ForegroundColor White
Write-Host " MIMIC-IV SqlBulkCopy Load — Starting  " -ForegroundColor White
Write-Host "========================================" -ForegroundColor White

foreach ($t in $tables) {
    $csvFull = Join-Path $dataDir $t.csv
    Load-Table -csvPath $csvFull -tableName $t.table
}

$totalMin = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " ALL 31 TABLES LOADED in $totalMin min  " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
