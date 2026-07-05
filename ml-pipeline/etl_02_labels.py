"""
Phase 1 / Step 2 — CCSR label pipeline.

Unifies the mixed ICD-9 / ICD-10 diagnoses into ONE label space (AHRQ CCSR,
~500 clinically-coherent categories) for the concurrent-comorbidity-inference frame.

Mapping policy (fully offline, via the icd-mappings package's bundled data):
  - ICD-10  -> CCSR            (native; CCSR is defined for ICD-10-CM)
  - ICD-9   -> ICD-10 -> CCSR  (one bridge hop; CCSR does not exist for ICD-9, so
                                some bridge is unavoidable. Residue is quantified.)

Outputs (in the ml schema; raw MIMIC tables untouched):
  ml.icd_to_ccsr (icd_version, icd_code, ccsr)   -- the grouper lookup
  ml.labels      (hadm_id, ccsr, is_principal)    -- multi-label target per admission
"""
from db import connect
from icdmappings import Mapper
from psycopg2.extras import execute_values

m = Mapper()


def build_mapping():
    """Return list of (icd_version, icd_code, ccsr) for every distinct code in use."""
    with connect() as c:
        cur = c.cursor()
        cur.execute("SELECT DISTINCT icd_version, icd_code FROM mimic_hosp.diagnoses_icd")
        codes = cur.fetchall()

    icd10 = [code for ver, code in codes if ver == '10']
    icd9  = [code for ver, code in codes if ver == '9']

    # ICD-10 -> CCSR (native)
    ccsr10 = dict(zip(icd10, m.map(icd10, source='icd10', target='ccsr')))
    # ICD-9 -> ICD-10 (bridge) -> CCSR
    to10 = dict(zip(icd9, m.map(icd9, source='icd9', target='icd10')))
    ccsr9 = {}
    for c9, c10 in to10.items():
        ccsr9[c9] = m.map(c10, source='icd10', target='ccsr') if c10 else None

    rows = []
    for ver, code in codes:
        cc = ccsr10.get(code) if ver == '10' else ccsr9.get(code)
        if cc:  # drop unmapped here; residue reported below
            rows.append((ver, code, cc))
    return rows, len(codes)


DDL = """
DROP TABLE IF EXISTS ml.icd_to_ccsr;
CREATE TABLE ml.icd_to_ccsr (
    icd_version text, icd_code text, ccsr text,
    PRIMARY KEY (icd_version, icd_code)
);
"""

LABELS = """
DROP TABLE IF EXISTS ml.labels;
CREATE TABLE ml.labels AS
SELECT d.hadm_id::int AS hadm_id,
       x.ccsr,
       bool_or(d.seq_num = '1') AS is_principal
FROM mimic_hosp.diagnoses_icd d
JOIN ml.icd_to_ccsr x
  ON x.icd_code = d.icd_code AND x.icd_version = d.icd_version
WHERE d.hadm_id IS NOT NULL
GROUP BY d.hadm_id, x.ccsr;
ALTER TABLE ml.labels ADD PRIMARY KEY (hadm_id, ccsr);
CREATE INDEX ix_labels_ccsr ON ml.labels (ccsr);
"""

if __name__ == "__main__":
    rows, n_distinct = build_mapping()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(DDL)
        execute_values(cur,
            "INSERT INTO ml.icd_to_ccsr (icd_version, icd_code, ccsr) VALUES %s", rows)
        conn.commit()
        print(f"ml.icd_to_ccsr: {len(rows):,} of {n_distinct:,} distinct codes mapped "
              f"({100*len(rows)/n_distinct:.1f}%); "
              f"{cur.execute('SELECT count(distinct ccsr) FROM ml.icd_to_ccsr') or cur.fetchone()[0]} CCSR cats")

        # row-level coverage (what fraction of actual diagnosis ROWS got a label)
        cur.execute("""SELECT
            (SELECT count(*) FROM mimic_hosp.diagnoses_icd WHERE hadm_id IS NOT NULL) AS total,
            (SELECT count(*) FROM mimic_hosp.diagnoses_icd d
               JOIN ml.icd_to_ccsr x ON x.icd_code=d.icd_code AND x.icd_version=d.icd_version
             WHERE d.hadm_id IS NOT NULL) AS mapped""")
        total, mapped = cur.fetchone()
        print(f"row-level coverage: {mapped:,}/{total:,} diagnosis rows ({100*mapped/total:.1f}%)")

        cur.execute(LABELS); conn.commit()
        cur.execute("SELECT count(distinct hadm_id), count(*), count(distinct ccsr) FROM ml.labels")
        nh, nl, nc = cur.fetchone()
        print(f"ml.labels: {nh:,} admissions, {nl:,} (hadm,ccsr) pairs, {nc} distinct CCSR categories")
        print(f"  avg labels/admission: {nl/nh:.2f}")
        cur.execute("SELECT ccsr, count(*) c FROM ml.labels GROUP BY ccsr ORDER BY c DESC LIMIT 8")
        print("  top CCSR categories:")
        for cc, c in cur.fetchall():
            print(f"    {cc}: {c:,}")
