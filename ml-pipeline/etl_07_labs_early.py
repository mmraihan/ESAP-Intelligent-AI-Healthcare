"""
Phase 1 / Step 7 — Early lab features (pre-admission labs as intake proxy).

Extracts the LAST measured value before admittime for each (hadm_id, itemid) pair,
restricted to the top-150 most-frequent lab items across the cohort.

LEAKAGE GUARD (strict): only rows where labevents_typed.charttime < cohort_spine.admittime.
  - charttime is TIMESTAMP, admittime is TIMESTAMP — compared directly, no cast in WHERE.
  - "Hours before" is always negative (time before admit).

Design notes:
  - NEVER cast in WHERE; all columns used in filters are already typed in labevents_typed.
  - hadm_id is INTEGER in both labevents_typed and cohort_spine — join is direct, no cast.
  - Top-150 computed server-side against the cohort (not the whole labevents table) so the
    vocab reflects what is actually observable at intake for real admissions.
  - Uses DISTINCT ON (hadm_id, itemid) + ORDER BY charttime DESC to grab the last value.
  - d_labitems_typed.itemid is INTEGER — join is direct, no cast.

Output tables:
  ml.lab_vocab       (itemid INT PK, label TEXT, fluid TEXT, category TEXT, n BIGINT)
  ml.feat_labs_early (hadm_id INT, itemid INT, valuenum FLOAT, hours_before FLOAT)
    PK: (hadm_id, itemid)
    Indexes: ix_flabs_hadm(hadm_id), ix_flabs_item(itemid)

# SCHEMA NOTE (verified 2026-06-20):
#   mimic_hosp.labevents_typed columns:
#     labevent_id  BIGINT
#     subject_id   INTEGER
#     hadm_id      INTEGER      <- indexed (idx_labevents_subject exists; no hadm_id index)
#     specimen_id  INTEGER
#     itemid       INTEGER      <- indexed (idx_labevents_itemid)
#     charttime    TIMESTAMP    <- indexed (idx_labevents_charttime)
#     storetime    TIMESTAMP
#     value        TEXT
#     valuenum     NUMERIC      <- used for float features (NULL for non-numeric results)
#     valueuom     VARCHAR
#     ref_range_lower TEXT
#     ref_range_upper TEXT
#     flag         VARCHAR
#     priority     VARCHAR
#     comments     TEXT
#
#   mimic_hosp.d_labitems_typed columns:
#     itemid       INTEGER PK
#     label        VARCHAR
#     fluid        VARCHAR
#     category     VARCHAR
#
#   ml.cohort_spine relevant columns:
#     hadm_id      INTEGER PK
#     admittime    TIMESTAMP    <- indexed (ix_spine_admit)
#
#   labevents_typed row count: 158,374,764
#   labevents_typed rows with hadm_id not null: 84,605,867
#   labevents_typed rows with hadm_id null:     73,768,897
#   NOTE: ~47% of rows have no hadm_id (outpatient/ED labs not linked to an inpatient stay).
#         These are excluded naturally by the JOIN on cohort_spine.hadm_id.
"""

from db import connect

TOP_N = 150

# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Build ml.lab_vocab — top-N itemids by frequency WITHIN the cohort.
#
# Only rows where:
#   - hadm_id matches cohort_spine (inner join)
#   - charttime < admittime (leakage guard — compares typed TIMESTAMP columns)
#   - valuenum IS NOT NULL (numeric result exists)
#
# No casts in WHERE. hadm_id and charttime are both typed; comparison is direct.
# ──────────────────────────────────────────────────────────────────────────────
SQL_VOCAB = f"""
DROP TABLE IF EXISTS ml.lab_vocab;
CREATE TABLE ml.lab_vocab AS
SELECT
    top150.itemid,
    d.label,
    d.fluid,
    d.category,
    top150.n
FROM (
    SELECT l.itemid, count(*) AS n
    FROM mimic_hosp.labevents_typed l
    JOIN ml.cohort_spine s ON l.hadm_id = s.hadm_id
    WHERE l.charttime < s.admittime          -- LEAKAGE GUARD (typed TIMESTAMP < TIMESTAMP)
      AND l.valuenum IS NOT NULL
    GROUP BY l.itemid
    ORDER BY n DESC
    LIMIT {TOP_N}
) top150
JOIN mimic_hosp.d_labitems_typed d ON d.itemid = top150.itemid   -- direct INTEGER join
ORDER BY top150.n DESC;

ALTER TABLE ml.lab_vocab ADD PRIMARY KEY (itemid);
"""

# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Build ml.feat_labs_early — last value per (hadm_id, itemid) pre-admit.
#
# DISTINCT ON (l.hadm_id, l.itemid) with ORDER BY l.charttime DESC picks the
# most-recent lab value strictly before admittime.
#
# hours_before = negative float: e.g. -2.5 means 2.5 hours before admission.
# EXTRACT(EPOCH ...) returns seconds; dividing by 3600 gives hours.
#
# The IN (SELECT itemid FROM ml.lab_vocab) subquery is small (150 rows) and
# the itemid index on labevents_typed makes it selective.
# ──────────────────────────────────────────────────────────────────────────────
SQL_FEAT = """
DROP TABLE IF EXISTS ml.feat_labs_early;
CREATE TABLE ml.feat_labs_early AS
SELECT DISTINCT ON (l.hadm_id, l.itemid)
    l.hadm_id,
    l.itemid,
    l.valuenum::float                                                   AS valuenum,
    EXTRACT(EPOCH FROM (l.charttime - s.admittime)) / 3600.0           AS hours_before
FROM mimic_hosp.labevents_typed l
JOIN ml.cohort_spine s   ON l.hadm_id = s.hadm_id
JOIN ml.lab_vocab v      ON l.itemid  = v.itemid          -- restricts to top-150 itemids
WHERE l.charttime < s.admittime                           -- LEAKAGE GUARD
  AND l.valuenum  IS NOT NULL
ORDER BY l.hadm_id, l.itemid, l.charttime DESC;          -- DESC -> DISTINCT ON gets the last

ALTER TABLE ml.feat_labs_early ADD PRIMARY KEY (hadm_id, itemid);
CREATE INDEX ix_flabs_hadm ON ml.feat_labs_early (hadm_id);
CREATE INDEX ix_flabs_item ON ml.feat_labs_early (itemid);
"""


def run_with_progress(cur, sql, label):
    """Execute a SQL block, printing label and timing."""
    import time
    print(f"  Running: {label} ...", flush=True)
    t0 = time.time()
    cur.execute(sql)
    elapsed = time.time() - t0
    print(f"  Done in {elapsed:.1f}s", flush=True)


if __name__ == "__main__":
    import time

    print("=" * 65)
    print("etl_07_labs_early.py — building ml.lab_vocab + ml.feat_labs_early")
    print("=" * 65)

    # ── Preflight: confirm labevents_typed is populated ──────────────────────
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM mimic_hosp.labevents_typed")
        lab_total = cur.fetchone()[0]

    if lab_total == 0:
        print("\n*** WARNING: mimic_hosp.labevents_typed is EMPTY (0 rows). ***")
        print("*** The ETL script will still create the tables (empty).    ***")
        print("*** Re-run after loading MIMIC-IV labevents data.           ***\n")
    else:
        print(f"labevents_typed: {lab_total:,} rows — proceeding.\n")

    # ── Execute ──────────────────────────────────────────────────────────────
    t_start = time.time()
    with connect() as conn:
        conn.autocommit = False
        cur = conn.cursor()

        run_with_progress(cur, SQL_VOCAB, "ml.lab_vocab (top-150 itemids within cohort)")
        conn.commit()

        # Show what landed in vocab
        cur.execute("""
            SELECT itemid, label, fluid, category, n
            FROM ml.lab_vocab
            ORDER BY n DESC
            LIMIT 10
        """)
        rows = cur.fetchall()
        print(f"\n  Top-10 lab items in vocab:")
        for r in rows:
            print(f"    itemid={r[0]:6d}  {r[1]:45s}  {r[2]:12s}  n={r[4]:,}")

        run_with_progress(cur, SQL_FEAT, "ml.feat_labs_early (last pre-admit value per hadm+itemid)")
        conn.commit()

    t_total = time.time() - t_start

    # ── Reporting ─────────────────────────────────────────────────────────────
    with connect() as conn:
        cur = conn.cursor()

        cur.execute("SELECT count(*) FROM ml.cohort_spine")
        total_hadm = cur.fetchone()[0]

        cur.execute("SELECT count(*) FROM ml.lab_vocab")
        n_vocab = cur.fetchone()[0]

        cur.execute("SELECT count(DISTINCT hadm_id), count(*) FROM ml.feat_labs_early")
        n_hadm, n_rows = cur.fetchone()

        cur.execute("""
            SELECT round(avg(c)::numeric, 1)
            FROM (SELECT count(*) c FROM ml.feat_labs_early GROUP BY hadm_id) t
        """)
        avg_labs = cur.fetchone()[0]

        cur.execute("""
            SELECT round(min(hours_before)::numeric, 1),
                   round(max(hours_before)::numeric, 1),
                   round(avg(hours_before)::numeric, 1)
            FROM ml.feat_labs_early
        """)
        hmin, hmax, havg = cur.fetchone()

        # Per-itemid coverage
        cur.execute("""
            SELECT v.label, f.itemid, count(*) AS n_hadm
            FROM ml.feat_labs_early f
            JOIN ml.lab_vocab v ON v.itemid = f.itemid
            GROUP BY v.label, f.itemid
            ORDER BY n_hadm DESC
            LIMIT 10
        """)
        top_coverage = cur.fetchall()

    print(f"\n{'='*65}")
    print(f"ml.lab_vocab:       {n_vocab:,} items (top-{TOP_N})")
    print(f"ml.feat_labs_early: {n_rows:,} rows")
    print(f"  Admissions with >= 1 pre-admit lab: {n_hadm:,} / {total_hadm:,} "
          f"({100*n_hadm/total_hadm:.1f}%)")
    print(f"  Admissions with NO pre-admit labs:  {total_hadm-n_hadm:,} / {total_hadm:,} "
          f"({100*(total_hadm-n_hadm)/total_hadm:.1f}%) — cold-start for labs")
    print(f"  Avg lab items per admission (lab-bearing): {avg_labs}")
    print(f"  hours_before range: [{hmin}, {hmax}]  mean={havg}  (negative = before admit)")
    print(f"\n  Top-10 items by admission coverage:")
    for label, iid, nh in top_coverage:
        print(f"    {label:45s}  itemid={iid:6d}  hadm_coverage={nh:,}")
    print(f"\nTotal wall time: {t_total:.1f}s")
    print("=" * 65)
