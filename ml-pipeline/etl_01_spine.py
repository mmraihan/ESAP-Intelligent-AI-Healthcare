"""
Phase 1 / Step 1 — Cohort spine.

Builds ml.cohort_spine: one row per hospital admission (the prediction instance
for the concurrent-comorbidity-inference frame), with demographics and a correctly
computed age-at-admission. Reads the *_typed tables (proper types); raw MIMIC
schemas are never modified.
"""
from db import connect

DDL = """
CREATE SCHEMA IF NOT EXISTS ml;

DROP TABLE IF EXISTS ml.cohort_spine;
CREATE TABLE ml.cohort_spine AS
SELECT
    a.subject_id,
    a.hadm_id,
    a.admittime,
    a.dischtime,
    -- MIMIC age: anchor_age shifted by years between admission and anchor_year
    (p.anchor_age + (EXTRACT(YEAR FROM a.admittime)::int - p.anchor_year))::int
        AS admission_age,
    p.gender,
    p.anchor_year_group,
    a.admission_type,
    a.admission_location,
    a.discharge_location,
    a.insurance,
    a.marital_status,
    a.language,
    a.race,
    (a.edregtime IS NOT NULL) AS arrived_via_ed,
    a.hospital_expire_flag
FROM mimic_hosp.admissions_typed a
JOIN mimic_hosp.patients_typed   p USING (subject_id);

ALTER TABLE ml.cohort_spine ADD PRIMARY KEY (hadm_id);
CREATE INDEX ix_spine_subject ON ml.cohort_spine (subject_id);
CREATE INDEX ix_spine_admit   ON ml.cohort_spine (admittime);
"""

if __name__ == "__main__":
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(DDL)
        conn.commit()
        # sanity
        cur.execute("SELECT count(*), count(distinct subject_id) FROM ml.cohort_spine")
        n, npat = cur.fetchone()
        cur.execute("SELECT min(admission_age), max(admission_age), "
                    "round(avg(admission_age)::numeric,1) FROM ml.cohort_spine")
        amin, amax, aavg = cur.fetchone()
        cur.execute("SELECT count(*) FROM ml.cohort_spine WHERE arrived_via_ed")
        ned = cur.fetchone()[0]
        print(f"ml.cohort_spine built: {n:,} admissions, {npat:,} patients")
        print(f"  admission_age: min={amin} max={amax} avg={aavg}")
        print(f"  arrived via ED: {ned:,} ({100*ned/n:.1f}%)")
