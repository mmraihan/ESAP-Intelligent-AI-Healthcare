# MIMIC-IV Disease Prediction

Predict the clinical conditions a patient **likely already has** (an undocumented-comorbidity
ranked differential) from intake-style inputs — prior history, current medications, vitals,
and demographics — over the full MIMIC-IV v3.x dataset.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **Frame** | Concurrent comorbidity inference | Predict conditions present *this* admission from history + current meds + vitals. Current meds are a legitimate input (e.g. metformin → probable diabetes). Avoids the leakage of same-encounter-differential and the cohort shrink of next-visit forecasting. |
| **Priority** | Peak accuracy | Graph + tabular baseline first, then graph embeddings → GNN → optional fine-tuned medical LLM, each adopted only if it beats the baseline. (Baseline uses sklearn `HistGradientBoostingClassifier`; LightGBM needs `libomp` which isn't installable on this machine without Homebrew/sudo.) |
| **End user** | Clinician decision-support | Calibration + fairness audit are requirements. Race/insurance are audit covariates, not predictors. |
| **Label space** | AHRQ **CCSR** (~502 categories) | Clinician-readable, version-unified. `FAC*`/`SYM*` (administrative/symptom) families excluded from the prediction target. |
| **ICD harmonization** | ICD-10 → CCSR native; ICD-9 → ICD-10 → CCSR (one bridge hop) | CCSR is not defined for ICD-9, so one bridge is unavoidable. 99.2% row coverage; residue quantified. Fully offline via the `icd-mappings` package. |
| **ETL outputs** | New `ml` schema in Postgres | Raw `mimic_hosp` / `mimic_icu` are read-only and never modified. |

## Database

Live source: **PostgreSQL 18.4** @ `176.9.16.194:5434`, db `Healthcare-Dataset`
(schemas `mimic_hosp`, `mimic_icu`). 364,627 patients · 546,028 admissions.
Connection config in `.env`; access via `db.py`.

> The old SQL Server backend (`:1433`) is **dead**. `schema_report.STALE-mssql.json`
> is a stale artifact from it — ignore it.

## Pipeline

```
python3 db.py                 # verify connection
python3 etl_01_spine.py       # ml.cohort_spine     one row per admission + demographics + age
python3 etl_02_labels.py      # ml.icd_to_ccsr, ml.labels   CCSR multi-label target
python3 etl_03_prior_dx.py    # ml.feat_prior_dx    prior-admission CCSR history (leakage-safe)
python3 etl_04_vitals.py      # ml.omr_vital, ml.feat_vitals   BMI/weight/height/BP at-or-before admit
python3 etl_05_meds.py        # ml.drug_vocab, ml.feat_meds     top-500 current-admission drugs
python3 etl_06_split.py       # ml.split            subject-level 70/15/15 (no patient straddles)
python3 modeling_baseline.py  # HistGradientBoosting one-vs-rest baseline -> baseline_metrics.json
```

## `ml` schema data dictionary

| Table | Grain | Contents |
|---|---|---|
| `cohort_spine` | hadm_id | subject_id, admit/disch time, **admission_age**, gender, race/insurance/marital, arrived_via_ed, anchor_year_group |
| `icd_to_ccsr` | (icd_version, icd_code) | CCSR category for every diagnosis code in use |
| `labels` | (hadm_id, ccsr) | multi-label target; `is_principal` flags the seq_num=1 diagnosis |
| `feat_prior_dx` | (hadm_id, ccsr) | CCSR categories from the patient's **strictly earlier** admissions |
| `omr_vital` | (subject_id, chartdate, measure) | parsed/typed/unit-normalized vitals (cast once) |
| `feat_vitals` | hadm_id | nearest-prior bmi, weight_kg, height_cm, bp_sys, bp_dia |
| `drug_vocab` | drug_norm | top-500 normalized drug names |
| `feat_meds` | (hadm_id, drug_norm) | current-admission medications (multi-hot, long form) |
| `split` | hadm_id | train / val / test (assigned by subject_id) |

## Leakage guards (clinician-grade)

- History features use **only** admissions with `admittime < index admittime`.
- Vitals use the nearest reading **at or before** admittime (hard anterior cut; `omr` has no hadm_id).
- The index admission's own diagnoses are the label, never a feature.
- Splits are by `subject_id` so no patient appears in two folds.
- `anchor_year_group` is retained so the ICD-9→ICD-10 coding-era transition can be held out of reporting.

## Known v1 limitations / documented upgrades

- **No symptom/chief-complaint/notes** in the loaded DB (no `mimic_ed`, no notes). MIMIC-IV-Note
  is being added; MIMIC-IV-ED (with `triage.chiefcomplaint`) is the true intake-time source.
- Meds are top-500 raw names; upgrade = RxNorm ingredient / ATC class normalization.
- Cold-start (~41% single-admission) has no prior history; needs a popularity/priors fallback.
- Charlson/Elixhauser comorbidity indices not yet added as explicit features.
