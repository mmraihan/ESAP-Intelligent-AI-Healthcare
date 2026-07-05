"""
Concept-harmonization probe. Characterizes the ACTUAL data patterns that
drive the mapping decisions for:
  (1) ICD-9/ICD-10 -> disease target grouping (CCSR / PheCode)
  (2) emar free-text drug -> RxNorm ingredient / ATC
  (3) labevents itemid -> LOINC (via external d_labitems)
Read-only. Uses TOP / sampling so it is cheap against the 30M+ row tables.
"""
import json
from dotenv import dotenv_values
import pymssql

config = dotenv_values("/Users/nilab-personal/Downloads/healthcare-backend/.env")
conn = pymssql.connect(server=config["DB_HOST"], port=int(config["DB_PORT"]),
                       database=config["DB_NAME"], user=config["DB_USER"],
                       password=config["DB_PASSWORD"], tds_version="7.0")
cur = conn.cursor(as_dict=True)
out = {}

def q(sql):
    cur.execute(sql)
    return cur.fetchall()

# ---- (1) ICD target layer ----
# distinct code counts per version (drives label-space size argument)
out["icd_distinct_by_version"] = q("""
  SELECT icd_version, COUNT(DISTINCT icd_code) AS distinct_codes,
         COUNT(*) AS rows
  FROM hosp.diagnoses_icd GROUP BY icd_version""")

# principal-dx (seq_num=1) distinct codes -> the actual TARGET cardinality
out["principal_dx_distinct"] = q("""
  SELECT icd_version, COUNT(DISTINCT icd_code) AS distinct_principal
  FROM hosp.diagnoses_icd WHERE seq_num = 1 GROUP BY icd_version""")

# sample raw codes per version to confirm formatting (dotless? leading zeros? E/V codes?)
out["icd9_samples"] = q("""SELECT DISTINCT TOP 15 icd_code FROM hosp.diagnoses_icd
  WHERE icd_version=9 ORDER BY icd_code""")
out["icd10_samples"] = q("""SELECT DISTINCT TOP 15 icd_code FROM hosp.diagnoses_icd
  WHERE icd_version=10 ORDER BY icd_code""")
# E/V code presence in ICD-9 (external cause / supplementary) + R-codes in ICD-10 (symptoms)
out["icd9_EV_codes"] = q("""SELECT TOP 10 icd_code, COUNT(*) n FROM hosp.diagnoses_icd
  WHERE icd_version=9 AND (icd_code LIKE 'E%' OR icd_code LIKE 'V%')
  GROUP BY icd_code ORDER BY n DESC""")
out["icd10_R_symptom_codes"] = q("""SELECT TOP 10 d.icd_code, dd.long_title, COUNT(*) n
  FROM hosp.diagnoses_icd d LEFT JOIN hosp.d_icd_diagnoses dd
    ON d.icd_code=dd.icd_code AND d.icd_version=dd.icd_version
  WHERE d.icd_version=10 AND d.icd_code LIKE 'R%'
  GROUP BY d.icd_code, dd.long_title ORDER BY n DESC""")
# code length distribution (CCSR needs full-detail billing codes, not truncated)
out["icd_code_lengths"] = q("""SELECT icd_version, LEN(icd_code) AS code_len,
  COUNT(*) n FROM hosp.diagnoses_icd GROUP BY icd_version, LEN(icd_code)
  ORDER BY icd_version, code_len""")

# ---- (2) emar drug normalization ----
out["emar_event_txt_dist"] = q("""SELECT TOP 15 event_txt, COUNT(*) n
  FROM hosp.emar GROUP BY event_txt ORDER BY n DESC""")
out["emar_distinct_meds_est"] = q("""SELECT COUNT(*) AS distinct_med_strings FROM
  (SELECT DISTINCT medication FROM hosp.emar) z""")
out["emar_top_meds"] = q("""SELECT TOP 40 medication, COUNT(*) n
  FROM hosp.emar GROUP BY medication ORDER BY n DESC""")
# look for brand/formulation noise: strings with dose/route tokens
out["emar_messy_examples"] = q("""SELECT DISTINCT TOP 25 medication FROM hosp.emar
  WHERE medication LIKE '%mg%' OR medication LIKE '%/%' OR medication LIKE '%tablet%'
     OR medication LIKE '%injection%' OR medication LIKE '%[0-9]%'
  ORDER BY medication""")

# ---- (3) labevents itemid ----
out["lab_distinct_itemids"] = q("""SELECT COUNT(DISTINCT itemid) AS distinct_itemids
  FROM hosp.labevents""")
out["lab_top_itemids"] = q("""SELECT TOP 25 itemid, COUNT(*) n,
  SUM(CASE WHEN flag='abnormal' THEN 1 ELSE 0 END) AS abnormal_n
  FROM hosp.labevents GROUP BY itemid ORDER BY n DESC""")
out["lab_flag_dist"] = q("""SELECT flag, COUNT(*) n FROM
  (SELECT TOP 2000000 flag FROM hosp.labevents) z GROUP BY flag""")
# range of itemid values to confirm they are the public MIMIC 5xxxx/coded ids
out["lab_itemid_range"] = q("""SELECT MIN(itemid) lo, MAX(itemid) hi FROM hosp.labevents""")

cur.close(); conn.close()

print(json.dumps(out, indent=2, default=str))
