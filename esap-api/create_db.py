"""
Run ONCE before anything else.
Creates the 'ESAP-Healthcare' database on the PostgreSQL server,
then creates all application tables inside it.

    python create_db.py
"""
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from config import settings


DB_NAME = settings.DB_NAME   # "ESAP-Healthcare"


def create_database():
    print(f"Connecting to PostgreSQL at {settings.DB_HOST}:{settings.DB_PORT} ...")
    try:
        conn = psycopg2.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            dbname="postgres",     # connect to default DB to run CREATE DATABASE
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
        if cur.fetchone():
            print(f"  DATABASE '{DB_NAME}' already exists — skipping create.")
        else:
            cur.execute(f'CREATE DATABASE "{DB_NAME}"')
            print(f"  DATABASE '{DB_NAME}' created.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR creating database: {e}")
        sys.exit(1)


def create_tables():
    print(f"Creating tables inside '{DB_NAME}' ...")
    from database import create_tables as _create_tables, check_connection
    if not check_connection():
        print("ERROR: Cannot connect to the new database. Check credentials.")
        sys.exit(1)
    _create_tables()
    print("  All tables created (or already exist).")


if __name__ == "__main__":
    create_database()
    create_tables()
    print(f"\nDone. Run  python seed.py  next to create the admin and doctor accounts.")
