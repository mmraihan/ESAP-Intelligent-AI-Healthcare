"""
Phase 1 / Step 3 — Prior-diagnosis history features (the PMH backbone).

For each index admission, collect the CCSR categories the patient was diagnosed
with in any STRICTLY EARLIER admission (admittime < index admittime). Same CCSR
space as the labels, so history and target are directly comparable.

Leakage-safe: only prior admissions contribute. Single-admission patients (~123k,
cold-start) get no rows here and are handled by the cold-start fallback later.

Output: ml.feat_prior_dx (hadm_id, ccsr)  -- long form; pivoted to multi-hot at export.
"""
from db import connect

SQL = """
DROP TABLE IF EXISTS ml.feat_prior_dx;
CREATE TABLE ml.feat_prior_dx AS
SELECT s.hadm_id, l.ccsr
FROM ml.cohort_spine s
JOIN ml.cohort_spine sp
  ON sp.subject_id = s.subject_id
 AND sp.dischtime  < s.admittime          -- prior stay must DISCHARGE before index admit (no overlap/transfer leak)
JOIN ml.labels l
  ON l.hadm_id = sp.hadm_id
GROUP BY s.hadm_id, l.ccsr;
ALTER TABLE ml.feat_prior_dx ADD PRIMARY KEY (hadm_id, ccsr);
CREATE INDEX ix_priordx_hadm ON ml.feat_prior_dx (hadm_id);
"""

if __name__ == "__main__":
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(SQL); conn.commit()
        cur.execute("""SELECT count(distinct hadm_id), count(*) FROM ml.feat_prior_dx""")
        nh, nr = cur.fetchone()
        cur.execute("SELECT count(*) FROM ml.cohort_spine")
        total = cur.fetchone()[0]
        print(f"ml.feat_prior_dx: {nh:,} admissions have prior-dx history "
              f"({100*nh/total:.1f}% of {total:,}); {nr:,} (hadm,ccsr) rows")
        print(f"  -> {total-nh:,} admissions have NO prior history (cold-start cohort)")
        cur.execute("SELECT round(avg(c),2) FROM (SELECT count(*) c FROM ml.feat_prior_dx GROUP BY hadm_id) t")
        print(f"  avg prior CCSR categories per history-bearing admission: {cur.fetchone()[0]}")
