"""
Load MIMIC-IV-Note v2.2 into the live Postgres (new schema: mimic_note).

IMPORTANT: the target database is encoded WIN1252 (verified), not UTF-8 — a legacy
of the original SQL Server migration. The note CSVs are UTF-8 and contain a few
characters with no WIN1252 equivalent (e.g. stray control char U+0095). So we
recode the stream UTF-8 -> WIN1252 on the fly (errors='replace' -> '?' for the rare
unmappable char) and set client_encoding=WIN1252 so the server stores bytes directly.

Streams each gzipped CSV (decompress + recode on the fly; never sits in RAM).
COPY ... FORMAT csv handles the embedded newlines in the `text` field.

Usage:  python3 notes_load.py [discharge|discharge_detail|radiology|radiology_detail|all]
"""
import sys, io, gzip, time
from db import connect

DIR = "/Users/nilab-personal/Downloads/mimic-iv-note-deidentified-free-text-clinical-notes-2.2/note"

NOTE_COLS   = ["note_id", "subject_id", "hadm_id", "note_type",
               "note_seq", "charttime", "storetime", "text"]
DETAIL_COLS = ["note_id", "subject_id", "field_name", "field_value", "field_ordinal"]
TABLES = {
    "discharge": NOTE_COLS, "radiology": NOTE_COLS,
    "discharge_detail": DETAIL_COLS, "radiology_detail": DETAIL_COLS,
}


class Utf8ToWin1252(io.RawIOBase):
    """Reads a UTF-8 gzip file and yields WIN1252 bytes (unmappable -> '?')."""
    def __init__(self, path):
        self.text = gzip.open(path, "rt", encoding="utf-8", errors="replace")
        self.pending = b""

    def readable(self):
        return True

    def readinto(self, b):
        while len(self.pending) < len(b):
            chunk = self.text.read(131072)
            if not chunk:
                break
            self.pending += chunk.encode("cp1252", errors="replace")
        n = min(len(b), len(self.pending))
        b[:n], self.pending = self.pending[:n], self.pending[n:]
        return n


def load(tbl):
    cols = TABLES[tbl]
    coldef = ", ".join(f"{c} text" for c in cols)
    path = f"{DIR}/{tbl}.csv.gz"
    t0 = time.time()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("CREATE SCHEMA IF NOT EXISTS mimic_note")
        cur.execute(f"DROP TABLE IF EXISTS mimic_note.{tbl}")
        cur.execute(f"CREATE UNLOGGED TABLE mimic_note.{tbl} ({coldef})")
        cur.execute("SET client_encoding TO 'WIN1252'")
        conn.commit()
        print(f"[{tbl}] streaming COPY (utf8->win1252) from {path} ...", flush=True)
        stream = io.BufferedReader(Utf8ToWin1252(path), buffer_size=1 << 20)
        cur.copy_expert(
            f"COPY mimic_note.{tbl} FROM STDIN WITH (FORMAT csv, HEADER true)", stream)
        conn.commit()
        cur.execute(f"SELECT count(*) FROM mimic_note.{tbl}")
        n = cur.fetchone()[0]
        if "hadm_id" in cols:
            cur.execute(f"CREATE INDEX ix_{tbl}_subj ON mimic_note.{tbl} (subject_id)")
            cur.execute(f"CREATE INDEX ix_{tbl}_hadm ON mimic_note.{tbl} (hadm_id)")
        else:
            cur.execute(f"CREATE INDEX ix_{tbl}_note ON mimic_note.{tbl} (note_id)")
        conn.commit()
        print(f"[{tbl}] {n:,} rows in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "discharge"
    for t in (list(TABLES) if arg == "all" else [arg]):
        load(t)
