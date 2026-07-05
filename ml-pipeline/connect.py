import os
from dotenv import dotenv_values
import pymssql

config = dotenv_values(".env")

host = config.get("DB_HOST")
port = int(config.get("DB_PORT", 1433))
db   = config.get("DB_NAME")
user = config.get("DB_USER")
pwd  = config.get("DB_PASSWORD")

print(f"Connecting to {host}:{port} / {db} as {user} ...")

try:
    conn = pymssql.connect(
        server=host,
        port=port,
        database=db,
        user=user,
        password=pwd,
        tds_version="7.0",
    )
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    print("Connected successfully!")
    print("SQL Server version:", row[0])
    cursor.close()
    conn.close()
except Exception as e:
    print("Connection failed:", e)
