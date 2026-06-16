# MIMIC-IV Local CSV → PostgreSQL 18 — Step-by-Step Guide

**Source :** Local CSV files in `Dataset/mimic-iv-3.1/mimic-iv-3.1/`
**Target :** Local PostgreSQL 18 — database `Healthcare-Dataset-Mimic`
**Script :** `load_mimic_to_postgres.py`

---

## Dataset Overview

| Module | Folder | Tables | Largest file |
|--------|--------|--------|-------------|
| Hospital | `hosp/` | 21 tables | `labevents.csv` — 18 GB |
| ICU | `icu/` | 9 tables | `chartevents.csv` — 40 GB |
| **Total** | | **30 tables** | **~100+ GB** |

---

## Step 1 — Verify the Database Exists in pgAdmin

You already have `Healthcare-Dataset-Mimic` visible in pgAdmin.
If it doesn't exist yet, create it:

```sql
-- Run in pgAdmin Query Tool connected to postgres database
CREATE DATABASE "Healthcare-Dataset-Mimic";
```

---

## Step 2 — Tune PostgreSQL for Bulk Load (Do Once)

In pgAdmin → select `Healthcare-Dataset-Mimic` → Tools → **Query Tool**, run:

```sql
SHOW config_file;
```

Open that file (e.g. `C:\Program Files\PostgreSQL\18\data\postgresql.conf`) and set:

```ini
shared_buffers               = 4GB       # 25% of your RAM
work_mem                     = 256MB
maintenance_work_mem         = 2GB       # for index builds
wal_buffers                  = 64MB
checkpoint_timeout           = 30min
checkpoint_completion_target = 0.9
max_wal_size                 = 4GB
max_parallel_maintenance_workers = 4
```

Restart PostgreSQL: **Win+R** → `services.msc` → `postgresql-x64-18` → **Restart**

---

## Step 3 — Install Python Dependency

```powershell
pip install psycopg2-binary tqdm
```

---

## Step 4 — Set Your PostgreSQL Password in the Script

Open [load_mimic_to_postgres.py](load_mimic_to_postgres.py) and update line ~37:

```python
PG_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "Healthcare-Dataset-Mimic",
    "user":     "postgres",
    "password": "YOUR_PASSWORD_HERE",   # <- change this
}
```

---

## Step 5 — Run the Loader

```powershell
cd "f:\Office-Empowering-Energy\ESAP-API\ESAP-Intelligent-AI-Healthcare\Dataset\postgres"
python load_mimic_to_postgres.py
```

**What happens:**

1. Creates schema `mimic_hosp` (hospital tables)
2. Creates schema `mimic_icu` (ICU tables)
3. For each CSV file:
   - Creates the table with TEXT columns (zero type errors)
   - Loads data using PostgreSQL native COPY (reads file directly — fastest method)
   - Falls back to Python streaming if direct file read fails

**Expected output:**

```
2026-06-14 10:00:00  INFO     MIMIC-IV Local CSV -> PostgreSQL 18
2026-06-14 10:00:01  INFO     Session tuned for bulk load.
2026-06-14 10:00:02  INFO     Module: hosp  ->  schema: mimic_hosp  (21 tables)
2026-06-14 10:00:03  INFO       [1/21] admissions  (247.3 MB)
2026-06-14 10:00:15  INFO         Done in 12s (20.6 MB/s)
...
2026-06-14 11:30:00  INFO       [8/21] labevents  (18.0 GB)
2026-06-14 14:45:00  INFO         Done in 11700s (1.5 MB/s)
```

**The script is safe to re-run.** Tables that already have data are skipped.

---

## Step 6 — Estimated Time Per Table

| Table | Size | Est. time |
|-------|------|-----------|
| patients | small | < 1 min |
| admissions | ~250 MB | 1-3 min |
| transfers | ~200 MB | 1-2 min |
| diagnoses_icd | ~500 MB | 2-5 min |
| prescriptions | ~1 GB | 5-10 min |
| microbiologyevents | ~2 GB | 10-20 min |
| emar | 5.9 GB | 30-60 min |
| **labevents** | **18 GB** | **1-3 hours** |
| icustays | small | < 1 min |
| inputevents | ~3 GB | 15-30 min |
| **chartevents** | **40 GB** | **3-6 hours** |
| **Total** | **~100 GB** | **~6-12 hours** |

Times depend on disk speed (SSD is 5-10x faster than HDD).

---

## Step 7 — Apply Proper Data Types (After Load)

Once all data is loaded, open pgAdmin -> `Healthcare-Dataset-Mimic` -> Query Tool.

Open the file [mimic_typed_schema.sql](mimic_typed_schema.sql):
- File -> Open -> select `mimic_typed_schema.sql`
- Click **Execute** (F5)

This converts TEXT columns to proper types (INTEGER, TIMESTAMP, NUMERIC, etc.)
and creates all primary keys and indexes.

> The chartevents and labevents typed conversions take 30-90 minutes each — normal for 100M+ row tables.

---

## Step 8 — Verify Row Counts

Run in pgAdmin Query Tool:

```sql
SELECT
    schemaname,
    tablename,
    n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname IN ('mimic_hosp', 'mimic_icu')
ORDER BY schemaname, n_live_tup DESC;
```

Expected approximate counts:

| Table | Approx rows |
|-------|-------------|
| chartevents | ~330 million |
| labevents | ~120 million |
| emar | ~74 million |
| inputevents | ~9 million |
| admissions | ~524,000 |
| patients | ~364,000 |
| icustays | ~94,000 |

---

## Step 9 — Run ANALYZE

```sql
ANALYZE;
```

Updates the query planner so all queries run at full speed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `password authentication failed` | Wrong password in `PG_CONFIG` |
| `database "Healthcare-Dataset-Mimic" does not exist` | Create it first (Step 1) |
| `could not open file ... Permission denied` | Script auto-falls-back to Python client-side streaming |
| Disk full mid-load | Free space and re-run — already-loaded tables are skipped |
| Very slow on labevents/chartevents | Normal for 18-40 GB files — run overnight |
| `UnicodeDecodeError` | Change `UTF8` to `LATIN1` in the COPY command inside the script |

---

## Folder Structure After Load

```
Dataset/
├── mimic-iv-3.1/
│   └── mimic-iv-3.1/
│       ├── hosp/          <- 21 CSV files (source)
│       └── icu/           <- 9 CSV files (source)
└── postgres/
    ├── load_mimic_to_postgres.py         <- loader script  (run this)
    ├── mimic_typed_schema.sql            <- typed schema + indexes (run after)
    ├── mimic-postgres-migration-guide.md
    └── mimic_load.log                    <- created when script runs
```

PostgreSQL `Healthcare-Dataset-Mimic` after full load:

```
mimic_hosp/   <- 21 tables (TEXT) + 21 _typed tables with proper types
mimic_icu/    <- 9 tables  (TEXT) + 9  _typed tables with proper types
```
