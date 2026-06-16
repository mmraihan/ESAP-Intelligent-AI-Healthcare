# ============================================================
# MIMIC-IV 3.1 — Full reload of ALL 31 tables (hosp + icu)
# Safe to re-run: truncates each table before inserting
# Errors per table are caught and logged — does not stop
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

# ── Local CSV root ───────────────────────────────────────
$dataDir = "F:\Office-Empowering-Energy\ESAP-API\ESAP-Intelligent-AI-Healthcare\Dataset\mimic-iv-3.1\mimic-iv-3.1"

# ── All 31 tables in load order ──────────────────────────
$tables = @(
    # HOSP schema — small/medium first
    @{ csv = "hosp\patients.csv";            table = "hosp.patients" },
    @{ csv = "hosp\provider.csv";            table = "hosp.provider" },
    @{ csv = "hosp\d_labitems.csv";          table = "hosp.d_labitems" },
    @{ csv = "hosp\d_hcpcs.csv";             table = "hosp.d_hcpcs" },
    @{ csv = "hosp\d_icd_diagnoses.csv";     table = "hosp.d_icd_diagnoses" },
    @{ csv = "hosp\d_icd_procedures.csv";    table = "hosp.d_icd_procedures" },
    @{ csv = "hosp\admissions.csv";          table = "hosp.admissions" },
    @{ csv = "hosp\transfers.csv";           table = "hosp.transfers" },
    @{ csv = "hosp\services.csv";            table = "hosp.services" },
    @{ csv = "hosp\drgcodes.csv";            table = "hosp.drgcodes" },
    @{ csv = "hosp\hcpcsevents.csv";         table = "hosp.hcpcsevents" },
    @{ csv = "hosp\diagnoses_icd.csv";       table = "hosp.diagnoses_icd" },
    @{ csv = "hosp\procedures_icd.csv";      table = "hosp.procedures_icd" },
    @{ csv = "hosp\microbiologyevents.csv";  table = "hosp.microbiologyevents" },
    @{ csv = "hosp\omr.csv";                 table = "hosp.omr" },
    @{ csv = "hosp\poe_detail.csv";          table = "hosp.poe_detail" },
    @{ csv = "hosp\poe.csv";                 table = "hosp.poe" },
    # HOSP large tables last
    @{ csv = "hosp\prescriptions.csv";       table = "hosp.prescriptions" },
    @{ csv = "hosp\pharmacy.csv";            table = "hosp.pharmacy" },
    @{ csv = "hosp\emar.csv";                table = "hosp.emar" },
    @{ csv = "hosp\emar_detail.csv";         table = "hosp.emar_detail" },
    @{ csv = "hosp\labevents.csv";           table = "hosp.labevents" },
    # ICU schema
    @{ csv = "icu\caregiver.csv";            table = "icu.caregiver" },
    @{ csv = "icu\icustays.csv";             table = "icu.icustays" },
    @{ csv = "icu\d_items.csv";              table = "icu.d_items" },
    @{ csv = "icu\datetimeevents.csv";       table = "icu.datetimeevents" },
    @{ csv = "icu\inputevents.csv";          table = "icu.inputevents" },
    @{ csv = "icu\outputevents.csv";         table = "icu.outputevents" },
    @{ csv = "icu\procedureevents.csv";      table = "icu.procedureevents" },
    @{ csv = "icu\ingredientevents.csv";     table = "icu.ingredientevents" },
    @{ csv = "icu\chartevents.csv";          table = "icu.chartevents" }   # largest — last
)

# ── Results log ──────────────────────────────────────────
$results = @()

# ── Load function ────────────────────────────────────────
function Load-Table {
    param([string]$csvPath, [string]$tableName)

    if (!(Test-Path $csvPath)) {
        Write-Host "  [SKIP] File not found: $csvPath" -ForegroundColor Yellow
        return [PSCustomObject]@{ Table=$tableName; Status='SKIP'; Rows=0; Minutes=0 }
    }

    $fileSize = [math]::Round((Get-Item $csvPath).Length / 1MB, 1)
    Write-Host ""
    Write-Host "[$([System.DateTime]::Now.ToString('HH:mm:ss'))] Loading $tableName  ($fileSize MB) ..." -ForegroundColor Cyan

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # Truncate to ensure clean load on retry
        $cmd = $conn.CreateCommand()
        $cmd.CommandTimeout = 300
        $cmd.CommandText = "TRUNCATE TABLE $tableName"
        $cmd.ExecuteNonQuery() | Out-Null

        $bulkCopy = New-Object System.Data.SqlClient.SqlBulkCopy(
            $conn,
            [System.Data.SqlClient.SqlBulkCopyOptions]::TableLock,
            $null)
        $bulkCopy.DestinationTableName = $tableName
        $bulkCopy.BatchSize            = 50000
        $bulkCopy.BulkCopyTimeout      = 0

        $parser = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($csvPath)
        $parser.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
        $parser.SetDelimiters(",")
        $parser.HasFieldsEnclosedInQuotes = $true

        $headers = $parser.ReadFields()

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
        Write-Host "  OK: $("{0:N0}" -f $total) rows in $mins min" -ForegroundColor Green
        return [PSCustomObject]@{ Table=$tableName; Status='OK'; Rows=$total; Minutes=$mins }
    }
    catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        return [PSCustomObject]@{ Table=$tableName; Status='ERROR'; Rows=0; Minutes=0; Error=$_ }
    }
}

# ── Run all tables ───────────────────────────────────────
$start = Get-Date
Write-Host "================================================" -ForegroundColor White
Write-Host " MIMIC-IV Full Reload — $(Get-Date -Format 'yyyy-MM-dd HH:mm')  " -ForegroundColor White
Write-Host " 31 tables (hosp + icu)                        " -ForegroundColor White
Write-Host "================================================" -ForegroundColor White

foreach ($t in $tables) {
    $csvFull = Join-Path $dataDir $t.csv
    $results += Load-Table -csvPath $csvFull -tableName $t.table
}

$totalMin = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)

# ── Summary report ───────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host " SUMMARY after $totalMin min" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White
$results | Format-Table Table, Status, @{N='Rows';E={"{0:N0}" -f $_.Rows}}, Minutes -AutoSize

$errors = $results | Where-Object { $_.Status -eq 'ERROR' }
if ($errors.Count -gt 0) {
    Write-Host "FAILED TABLES — re-run this script to retry:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  $($_.Table): $($_.Error)" -ForegroundColor Red }
} else {
    Write-Host "All tables loaded successfully." -ForegroundColor Green
}

Write-Host ""
Write-Host "Verify in SSMS:" -ForegroundColor Yellow
Write-Host @"
SELECT s.name AS [schema], t.name AS [table], p.rows AS row_count
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE s.name IN ('hosp','icu')
ORDER BY s.name, t.name;
"@ -ForegroundColor Gray
