"""
Phase 1 / Step 6 — Train/val/test split.

Split is assigned at the SUBJECT level (deterministic hash of subject_id) so that
all admissions of a patient land in the same fold -> no patient straddles folds,
the dominant leakage guard. anchor_year_group is carried for ICD-9/10-era-stratified
reporting (so the coding-era transition is not mistaken for epidemiology).

Output: ml.split (hadm_id, subject_id, admittime, anchor_year_group, split)  70/15/15
"""
from db import connect

SQL = """
DROP TABLE IF EXISTS ml.split;
CREATE TABLE ml.split AS
SELECT hadm_id, subject_id, admittime, anchor_year_group,
       CASE WHEN abs(hashtext(subject_id::text)) % 100 < 70 THEN 'train'
            WHEN abs(hashtext(subject_id::text)) % 100 < 85 THEN 'val'
            ELSE 'test' END AS split
FROM ml.cohort_spine;
ALTER TABLE ml.split ADD PRIMARY KEY (hadm_id);
CREATE INDEX ix_split_split ON ml.split (split);
"""

if __name__ == "__main__":
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(SQL); conn.commit()
        cur.execute("""SELECT split, count(*) adm, count(distinct subject_id) pat
                       FROM ml.split GROUP BY split ORDER BY split""")
        print("split | admissions | patients")
        for s, adm, pat in cur.fetchall():
            print(f"  {s:5s}: {adm:>8,}  {pat:>8,}")
        # verify no subject straddles folds
        cur.execute("""SELECT count(*) FROM (
                         SELECT subject_id FROM ml.split
                         GROUP BY subject_id HAVING count(distinct split) > 1) t""")
        print(f"  subjects straddling folds (must be 0): {cur.fetchone()[0]}")
