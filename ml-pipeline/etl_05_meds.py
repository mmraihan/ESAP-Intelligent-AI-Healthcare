"""
Phase 1 / Step 5 — Medication features (prior-admission prescriptions as proxy for home meds).

MIMIC prescriptions records in-hospital orders; starttime is when the order was activated
during the stay, so essentially all rows have starttime >= admittime. Applying a
starttime <= admittime guard (the naive approach) yields 0 rows.

Instead we use prior-admission prescriptions (same logic as feat_prior_dx): any drug
ordered in a prior admission whose discharge was before the current admission time.
This is a clean proxy for "medications this patient has been on" — equivalent to a
best-estimate home-med list from the EMR. The Qwen 'Medications on Admission' note
extractor will supersede this in Phase 1.

LEAKAGE GUARD: only admissions where sp.dischtime < s.admittime (strict <, no overlap).

Outputs:
  ml.drug_vocab (drug_norm, n)         -- top-N most frequent normalized drug names
  ml.feat_meds  (hadm_id, drug_norm)   -- multi-hot (long form) per admission
"""
from db import connect

TOP_N = 500

SQL = f"""
DROP TABLE IF EXISTS ml.drug_vocab;
CREATE TABLE ml.drug_vocab AS
SELECT lower(btrim(drug)) AS drug_norm, count(*) AS n
FROM mimic_hosp.prescriptions
WHERE drug IS NOT NULL AND btrim(drug) <> ''
GROUP BY 1
ORDER BY n DESC
LIMIT {TOP_N};
ALTER TABLE ml.drug_vocab ADD PRIMARY KEY (drug_norm);

DROP TABLE IF EXISTS ml.feat_meds;
CREATE TABLE ml.feat_meds AS
SELECT DISTINCT s.hadm_id, v.drug_norm
FROM ml.cohort_spine s
JOIN ml.cohort_spine sp ON sp.subject_id = s.subject_id
                        AND sp.dischtime < s.admittime   -- LEAKAGE GUARD: prior admits only
JOIN mimic_hosp.prescriptions p
  ON p.hadm_id ~ '^[0-9]+$'
 AND p.hadm_id::int = sp.hadm_id
JOIN ml.drug_vocab v ON v.drug_norm = lower(btrim(p.drug));
ALTER TABLE ml.feat_meds ADD PRIMARY KEY (hadm_id, drug_norm);
CREATE INDEX ix_featmeds_hadm ON ml.feat_meds (hadm_id);
"""

if __name__ == "__main__":
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(SQL); conn.commit()
        cur.execute("SELECT count(*) FROM ml.cohort_spine")
        total = cur.fetchone()[0]
        cur.execute("SELECT count(distinct hadm_id), count(*) FROM ml.feat_meds")
        nh, nr = cur.fetchone()
        print(f"ml.feat_meds: {nh:,} admissions with meds ({100*nh/total:.1f}% of {total:,}); "
              f"{nr:,} (hadm,drug) rows, vocab={TOP_N}")
        cur.execute("SELECT drug_norm, n FROM ml.drug_vocab ORDER BY n DESC LIMIT 8")
        print("  top drugs:", ", ".join(f"{d}({n:,})" for d, n in cur.fetchall()))
