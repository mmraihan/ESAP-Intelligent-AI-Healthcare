# ============================================================
# MIMIC-IV 3.1 — Reload MISSING hosp tables only
# Targets the 10 hosp tables confirmed empty
# Safe to run even if ICU tables already have data
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

# ── Only the 10 missing hosp tables ─────────────────────
$tables = @(
    @{ csv = "hosp\admissions.csv";          table = "hosp.admissions" },
    @{ csv = "hosp\d_labitems.csv";          table = "hosp.d_labitems" },
    @{ csv = "hosp\emar.csv";                table = "hosp.emar" },
    @{ csv = "hosp\emar_detail.csv";         table = "hosp.emar_detail" },
    @{ csv = "hosp\microbiologyevents.csv";  table = "hosp.microbiologyevents" },
    @{ csv = "hosp\omr.csv";                 table = "hosp.omr" },
    @{ csv = "hosp\pharmacy.csv";            table = "hosp.pharmacy" },
    @{ csv = "hosp\poe.csv";                 table = "hosp.poe" },
    @{ csv = "hosp\poe_detail.csv";          table = "hosp.poe_detail" },
    @{ csv = "hosp\prescriptions.csv";       table = "hosp.prescriptions" }
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

    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # Truncate first to avoid partial-load duplicates on retry
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "TRUNCATE TABLE $tableName"
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host "  Truncated existing rows." -ForegroundColor DarkGray

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
        Write-Host "  DONE: $("{0:N0}" -f $total) rows loaded in $mins min" -ForegroundColor Green
    }
    catch {
        Write-Host "  ERROR loading $tableName`: $_" -ForegroundColor Red
    }
}

# ── Run ─────────────────────────────────────────────────
$start = Get-Date
Write-Host "================================================" -ForegroundColor White
Write-Host " Reloading 10 missing hosp tables — Starting   " -ForegroundColor White
Write-Host "================================================" -ForegroundColor White

foreach ($t in $tables) {
    $csvFull = Join-Path $dataDir $t.csv
    Load-Table -csvPath $csvFull -tableName $t.table
}

$totalMin = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " DONE in $totalMin min. Verify row counts below:" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Run this in SSMS to verify:" -ForegroundColor Yellow
Write-Host @"
SELECT s.name AS [schema], t.name AS [table], p.rows AS [row_count]
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
WHERE s.name = 'hosp'
ORDER BY t.name;
"@ -ForegroundColor Gray
