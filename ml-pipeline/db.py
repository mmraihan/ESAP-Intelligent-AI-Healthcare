"""
Central database access for the MIMIC-IV disease-prediction project.

Canonical source: PostgreSQL 18.4 @ 176.9.16.194:5434, db "Healthcare-Dataset".
The old SQL Server backend (port 1433) is DEAD — do not use it.

Usage:
    from db import connect, query_df
    df = query_df("SELECT count(*) FROM mimic_hosp.admissions")
"""
import os
import psycopg2
from dotenv import dotenv_values

_cfg = dotenv_values(os.path.join(os.path.dirname(__file__), ".env"))


def connect():
    """Return a new psycopg2 connection to the live MIMIC-IV Postgres DB."""
    return psycopg2.connect(
        host=_cfg["PG_HOST"],
        port=int(_cfg["PG_PORT"]),
        dbname=_cfg["PG_DB"],
        user=_cfg["PG_USER"],
        password=_cfg["PG_PASSWORD"],
        connect_timeout=15,
    )


def query_df(sql, params=None):
    """Run a query and return a pandas DataFrame."""
    import pandas as pd
    with connect() as conn:
        return pd.read_sql_query(sql, conn, params=params)


if __name__ == "__main__":
    # Sanity check: confirm we are on the live, populated Postgres.
    with connect() as c:
        cur = c.cursor()
        cur.execute("SELECT version();")
        print("Connected:", cur.fetchone()[0][:55])
        for tbl in ["mimic_hosp.patients", "mimic_hosp.admissions",
                    "mimic_hosp.diagnoses_icd", "mimic_hosp.prescriptions",
                    "mimic_hosp.omr"]:
            cur.execute(f"SELECT count(*) FROM {tbl}")
            print(f"  {tbl}: {cur.fetchone()[0]:,} rows")
