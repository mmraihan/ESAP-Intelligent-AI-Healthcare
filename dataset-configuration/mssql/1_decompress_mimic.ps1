# ============================================================
# MIMIC-IV 3.1 — Decompress all .csv.gz files to .csv
# Run this FIRST before any SQL import steps.
# ============================================================

# Search for all .gz files from current directory recursively
$gzFiles = Get-ChildItem -Path "." -Recurse -Filter "*.csv.gz"

Write-Host "Found $($gzFiles.Count) compressed files. Starting decompression..." -ForegroundColor Cyan

foreach ($gz in $gzFiles) {
    $csvPath = $gz.FullName -replace '\.gz$', ''

    if (Test-Path $csvPath) {
        Write-Host "  [SKIP] Already exists: $($gz.Name)" -ForegroundColor Yellow
        continue
    }

    Write-Host "  Decompressing: $($gz.Name) ..." -NoNewline

    try {
        $inputStream  = [System.IO.File]::OpenRead($gz.FullName)
        $gzStream     = [System.IO.Compression.GzipStream]::new($inputStream,
                            [System.IO.Compression.CompressionMode]::Decompress)
        $outputStream = [System.IO.File]::Create($csvPath)
        $gzStream.CopyTo($outputStream)

        $outputStream.Close()
        $gzStream.Close()
        $inputStream.Close()

        $sizeMB = [math]::Round((Get-Item $csvPath).Length / 1MB, 1)
        Write-Host " done ($sizeMB MB)" -ForegroundColor Green
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Decompression complete. CSV files are alongside their .gz originals." -ForegroundColor Cyan
Write-Host "Next step: run  2_create_database_schema.sql  in SSMS." -ForegroundColor White
