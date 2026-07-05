"""
Extract first 1000 data rows from each gzipped CSV in the MIMIC-IV-Note dataset.
Streams the gzip — never loads the full file into memory.
Output: csv_exports/mimic_note_files__<name>.csv  (same folder as export_csv.py output)
"""
import gzip, csv, os

NOTE_DIR = "/Users/nilab-personal/Downloads/mimic-iv-note-deidentified-free-text-clinical-notes-2.2/note"
OUT_DIR  = os.path.join(os.path.dirname(__file__), "csv_exports")
os.makedirs(OUT_DIR, exist_ok=True)

LIMIT = 1000

files = [f for f in os.listdir(NOTE_DIR) if f.endswith(".csv.gz")]
files.sort()

for fname in files:
    src  = os.path.join(NOTE_DIR, fname)
    stem = fname.replace(".csv.gz", "")
    dst  = os.path.join(OUT_DIR, f"mimic_note_files__{stem}.csv")

    print(f"  reading {fname} ...", flush=True)
    with gzip.open(src, "rt", encoding="utf-8", errors="replace") as gz:
        reader = csv.reader(gz)
        header = next(reader)
        rows = []
        for i, row in enumerate(reader):
            rows.append(row)
            if i + 1 >= LIMIT:
                break

    with open(dst, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  ✓  {stem} → {len(rows)} rows, {len(header)} cols  →  {os.path.basename(dst)}", flush=True)

print(f"\nDone. {len(files)} files exported → {OUT_DIR}")
