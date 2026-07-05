"""
Export first 1000 rows from every table in mimic_hosp, mimic_icu, mimic_note, ml
to csv_exports/<schema>__<table>.csv
"""
import os, csv, sys
import psycopg2
from db import connect

OUT_DIR = os.path.join(os.path.dirname(__file__), "csv_exports")
os.makedirs(OUT_DIR, exist_ok=True)

SCHEMAS = ["mimic_hosp", "mimic_icu", "mimic_note", "ml"]

def get_tables(cur, schema):
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = %s AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """, (schema,))
    return [r[0] for r in cur.fetchall()]

def export_table(conn, schema, table, out_dir, limit=1000):
    path = os.path.join(out_dir, f"{schema}__{table}.csv")
    cur = conn.cursor()
    try:
        cur.execute(f'SELECT * FROM "{schema}"."{table}" LIMIT {limit}')
        rows = cur.fetchall()
        headers = [desc[0] for desc in cur.description]
        with open(path, "w", newline="", encoding="utf-8", errors="replace") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        print(f"  ✓  {schema}.{table} → {len(rows)} rows, {len(headers)} cols", flush=True)
        return len(rows)
    except Exception as e:
        print(f"  ✗  {schema}.{table}: {e}", flush=True)
        return 0
    finally:
        cur.close()

def main():
    with connect() as conn:
        cur = conn.cursor()
        total_tables = 0
        total_rows = 0
        for schema in SCHEMAS:
            tables = get_tables(cur, schema)
            print(f"\n── {schema} ({len(tables)} tables) ──", flush=True)
            for table in tables:
                n = export_table(conn, schema, table, OUT_DIR)
                total_rows += n
                total_tables += 1
        print(f"\nDone. {total_tables} tables exported, {total_rows:,} total rows → {OUT_DIR}")

if __name__ == "__main__":
    main()
