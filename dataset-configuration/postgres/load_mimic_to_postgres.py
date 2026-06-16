"""
MIMIC-IV .csv.gz → PostgreSQL 18 Loader  (SERVER VERSION)
===========================================================
Run this script ON THE SERVER via RDP.
Reads .csv.gz files from the server's local disk — no network transfer.

CSV source on server:
  D:\Healthcare\mimic-iv-3.1\hosp\*.csv.gz   (22 tables)
  D:\Healthcare\mimic-iv-3.1\icu\*.csv.gz    (9 tables)

PostgreSQL target (localhost — same machine):
  Host: localhost  Port: 5432
  Database: Healthcare-Dataset

Strategy:
  - Decompresses .gz in memory on the server
  - Inserts directly into local PostgreSQL — NO network overhead
  - All columns loaded as TEXT first (zero type errors)
  - Skips tables that already have rows (safe to re-run)
  - Progress + errors logged to D:\Healthcare\mimic_load.log

Requirements (install on the SERVER):
    pip install psycopg2-binary tqdm

Usage (run on the SERVER):
    python D:\Healthcare\load_mimic_to_postgres.py
"""

import gzip
import csv
import io
import psycopg2
import time
import logging
import sys
from pathlib import Path
from tqdm import tqdm

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

# Path to MIMIC-IV on the SERVER disk
MIMIC_ROOT = Path(r"D:\Healthcare\mimic-iv-3.1")

# PostgreSQL — localhost because script runs ON the server
PG_CONFIG = {
    "host":     "localhost",
    "port":     5434,
    "dbname":   "Healthcare-Dataset",
    "user":     "postgres",
    "password": "pg1234",
}

# Schema names inside PostgreSQL
SCHEMA_HOSP = "mimic_hosp"
SCHEMA_ICU  = "mimic_icu"

# Skip tables that already have rows (safe to re-run after interruption)
SKIP_IF_EXISTS = True

# Rows to buffer before each COPY send (increase if RAM > 16 GB)
CHUNK_ROWS = 100_000

# ─── LOGGING ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("mimic_load.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def pg_connect() -> psycopg2.extensions.connection:
    conn = psycopg2.connect(**PG_CONFIG)
    conn.autocommit = False
    return conn


def tune_session(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("SET synchronous_commit = OFF")
        cur.execute("SET work_mem = '512MB'")
        cur.execute("SET maintenance_work_mem = '2GB'")
    conn.commit()
    log.info("PostgreSQL session tuned for bulk load.")


def create_schema(conn, schema: str) -> None:
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
    conn.commit()


def read_gz_header(gz_path: Path) -> list[str]:
    """Read just the first line of a .csv.gz file to get column names."""
    with gzip.open(gz_path, "rt", encoding="utf-8") as f:
        reader = csv.reader(f)
        return next(reader)


def table_has_rows(conn, schema: str, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(f'SELECT EXISTS (SELECT 1 FROM {schema}."{table}" LIMIT 1)')
        return cur.fetchone()[0]


def create_table(conn, schema: str, table: str, columns: list[str]) -> None:
    col_defs = ",\n    ".join(f'"{col}" TEXT' for col in columns)
    ddl = f'CREATE TABLE IF NOT EXISTS {schema}."{table}" (\n    {col_defs}\n)'
    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.commit()


def get_gz_size_human(path: Path) -> str:
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def load_gz_to_pg(conn, schema: str, table: str, gz_path: Path) -> int:
    """
    Decompress .csv.gz on local machine and stream rows to remote PostgreSQL
    via COPY FROM STDIN in batches of CHUNK_ROWS.
    Returns total number of rows inserted.
    """
    columns  = read_gz_header(gz_path)
    col_list = ", ".join(f'"{c}"' for c in columns)
    pg_table = f'{schema}."{table}"'
    copy_sql = (
        f"COPY {pg_table} ({col_list}) "
        f"FROM STDIN WITH (FORMAT CSV, HEADER FALSE, NULL '', ENCODING 'WIN1252')"
    )

    rows_done = 0
    batch_num = 0

    with gzip.open(gz_path, "rt", encoding="utf-8", newline="") as gz_file:
        reader = csv.reader(gz_file)
        next(reader)  # skip header row

        pbar = tqdm(unit=" rows", desc=f"    {table}", leave=True)

        while True:
            # Build a CSV buffer for one batch
            buf         = io.StringIO()
            writer      = csv.writer(buf, lineterminator="\n")
            chunk_count = 0

            for row in reader:
                writer.writerow(row)
                chunk_count += 1
                if chunk_count >= CHUNK_ROWS:
                    break

            if chunk_count == 0:
                break   # finished

            buf.seek(0)
            with conn.cursor() as cur:
                cur.copy_expert(copy_sql, buf)
            conn.commit()

            rows_done += chunk_count
            batch_num += 1
            pbar.update(chunk_count)

        pbar.close()

    return rows_done


# ─── MODULE PROCESSOR ─────────────────────────────────────────────────────────

def process_module(conn, module_dir: Path, schema: str) -> dict:
    gz_files = sorted(module_dir.glob("*.csv.gz"))
    results  = {"ok": [], "skipped": [], "failed": []}

    log.info("Module: %s  →  schema: %s  (%d files)", module_dir.name, schema, len(gz_files))

    for i, gz_path in enumerate(gz_files, 1):
        table = gz_path.name.replace(".csv.gz", "")
        size  = get_gz_size_human(gz_path)
        log.info("  [%d/%d] %s  (compressed: %s)", i, len(gz_files), table, size)

        try:
            columns = read_gz_header(gz_path)
            create_table(conn, schema, table, columns)

            if SKIP_IF_EXISTS and table_has_rows(conn, schema, table):
                log.info("    Already loaded — skipping.")
                results["skipped"].append(table)
                continue

            t0   = time.time()
            rows = load_gz_to_pg(conn, schema, table, gz_path)
            elapsed = time.time() - t0

            log.info("    Done: %s rows in %.0fs", f"{rows:,}", elapsed)
            results["ok"].append(table)

        except Exception as exc:
            conn.rollback()
            log.error("    FAILED — %s: %s", table, exc)
            results["failed"].append(table)

    return results


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main() -> None:
    start = time.time()

    log.info("=" * 60)
    log.info("MIMIC-IV .csv.gz  →  PostgreSQL 18")
    log.info("Database  : %s", PG_CONFIG["dbname"])
    log.info("Source    : %s", MIMIC_ROOT)
    log.info("=" * 60)

    if not MIMIC_ROOT.exists():
        log.error("MIMIC_ROOT not found: %s", MIMIC_ROOT)
        log.error("Check that the zip was extracted to D:\\Healthcare\\mimic-iv-3.1\\")
        sys.exit(1)

    # Verify hosp/ and icu/ exist
    for sub in ("hosp", "icu"):
        d = MIMIC_ROOT / sub
        if not d.exists():
            log.error("Folder not found: %s", d)
            sys.exit(1)

    conn = pg_connect()
    tune_session(conn)

    create_schema(conn, SCHEMA_HOSP)
    create_schema(conn, SCHEMA_ICU)
    log.info("Schemas ready: %s, %s", SCHEMA_HOSP, SCHEMA_ICU)

    all_ok      = []
    all_skipped = []
    all_failed  = []

    for module_dir, schema in [
        (MIMIC_ROOT / "hosp", SCHEMA_HOSP),
        (MIMIC_ROOT / "icu",  SCHEMA_ICU),
    ]:
        r = process_module(conn, module_dir, schema)
        all_ok      += r["ok"]
        all_skipped += r["skipped"]
        all_failed  += r["failed"]

    conn.close()

    elapsed = time.time() - start
    log.info("=" * 60)
    log.info("Finished in %.0f seconds (%.1f minutes)", elapsed, elapsed / 60)
    log.info("Loaded  : %d tables", len(all_ok))
    log.info("Skipped : %d tables (already had data)", len(all_skipped))
    if all_failed:
        log.warning("Failed  : %d — %s", len(all_failed), ", ".join(all_failed))
    else:
        log.info("Failed  : 0  — all tables loaded successfully")
    log.info("Log saved → mimic_load.log")
    log.info("Next step: run mimic_typed_schema.sql in pgAdmin")


if __name__ == "__main__":
    main()
