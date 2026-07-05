r"""
Phase 1 / Step 4 — Vitals & anthropometrics from omr (height, weight, BMI, BP).

omr is all-TEXT, has NO hadm_id, and is keyed by (subject_id, chartdate). So we:
  (a) parse/cast ONCE into ml.omr_vital  (long: subject_id, chartdate, measure, val)
  (b) snap, per admission and measure, the most recent reading at-or-before admittime
      (HARD anterior cut -> no leakage of post-admission treatment response)
  (c) pivot to one wide row per admission -> ml.feat_vitals

Units normalized: Weight (Lbs)->kg, Height (Inches)->cm. BP 'sys/dia' -> two numerics.
Implausible values are filtered.
"""
from db import connect

PARSE = r"""
DROP TABLE IF EXISTS ml.omr_vital;
CREATE TABLE ml.omr_vital AS
  SELECT subject_id, chartdate::date AS chartdate, 'bmi'::text AS measure,
         result_value::numeric AS val
  FROM mimic_hosp.omr
  WHERE result_name = 'BMI (kg/m2)'
    AND result_value ~ '^[0-9]+(\.[0-9]+)?$'
    AND result_value::numeric BETWEEN 8 AND 120
UNION ALL
  SELECT subject_id, chartdate::date, 'weight_kg',
         round((result_value::numeric * 0.453592)::numeric, 1)
  FROM mimic_hosp.omr
  WHERE result_name = 'Weight (Lbs)'
    AND result_value ~ '^[0-9]+(\.[0-9]+)?$'
    AND result_value::numeric BETWEEN 50 AND 1000
UNION ALL
  SELECT subject_id, chartdate::date, 'height_cm',
         round((result_value::numeric * 2.54)::numeric, 1)
  FROM mimic_hosp.omr
  WHERE result_name = 'Height (Inches)'
    AND result_value ~ '^[0-9]+(\.[0-9]+)?$'
    AND result_value::numeric BETWEEN 36 AND 96
UNION ALL
  SELECT subject_id, chartdate::date, 'bp_sys',
         split_part(result_value, '/', 1)::numeric
  FROM mimic_hosp.omr
  WHERE result_name = 'Blood Pressure'
    AND result_value ~ '^[0-9]+/[0-9]+$'
    AND split_part(result_value,'/',1)::numeric BETWEEN 50 AND 300
UNION ALL
  SELECT subject_id, chartdate::date, 'bp_dia',
         split_part(result_value, '/', 2)::numeric
  FROM mimic_hosp.omr
  WHERE result_name = 'Blood Pressure'
    AND result_value ~ '^[0-9]+/[0-9]+$'
    AND split_part(result_value,'/',2)::numeric BETWEEN 20 AND 200;
CREATE INDEX ix_omrvital ON ml.omr_vital (subject_id, measure, chartdate);
"""

NEAREST = """
DROP TABLE IF EXISTS ml.vital_nearest;
CREATE TABLE ml.vital_nearest AS
SELECT DISTINCT ON (s.hadm_id, v.measure)
       s.hadm_id, v.measure, v.val
FROM ml.cohort_spine s
JOIN ml.omr_vital v
  ON v.subject_id = s.subject_id::text
 AND v.chartdate < s.admittime::date      -- strict: exclude same-day (omr is date-granular) to avoid post-admit leak
ORDER BY s.hadm_id, v.measure, v.chartdate DESC;
"""

PIVOT = """
DROP TABLE IF EXISTS ml.feat_vitals;
CREATE TABLE ml.feat_vitals AS
SELECT hadm_id,
       max(val) FILTER (WHERE measure='bmi')       AS bmi,
       max(val) FILTER (WHERE measure='weight_kg') AS weight_kg,
       max(val) FILTER (WHERE measure='height_cm') AS height_cm,
       max(val) FILTER (WHERE measure='bp_sys')    AS bp_sys,
       max(val) FILTER (WHERE measure='bp_dia')    AS bp_dia
FROM ml.vital_nearest
GROUP BY hadm_id;
ALTER TABLE ml.feat_vitals ADD PRIMARY KEY (hadm_id);
"""

if __name__ == "__main__":
    with connect() as conn:
        cur = conn.cursor()
        for label, sql in [("parse omr", PARSE), ("nearest-prior", NEAREST), ("pivot", PIVOT)]:
            cur.execute(sql); conn.commit()
            print(f"  [done] {label}")
        cur.execute("SELECT count(*) FROM ml.cohort_spine")
        total = cur.fetchone()[0]
        cur.execute("""SELECT
            count(*) AS n,
            count(bmi) AS bmi, count(weight_kg) AS wt, count(height_cm) AS ht,
            count(bp_sys) AS bp,
            round(avg(bmi)::numeric,1), round(avg(bp_sys)::numeric,0), round(avg(bp_dia)::numeric,0)
          FROM ml.feat_vitals""")
        n, bmi, wt, ht, bp, abmi, asys, adia = cur.fetchone()
        print(f"\nml.feat_vitals: {n:,} admissions with >=1 vital ({100*n/total:.1f}% of {total:,})")
        print(f"  coverage: bmi={100*bmi/total:.0f}%  weight={100*wt/total:.0f}%  "
              f"height={100*ht/total:.0f}%  bp={100*bp/total:.0f}%")
        print(f"  sanity: avg BMI={abmi}, avg BP={asys}/{adia}")
