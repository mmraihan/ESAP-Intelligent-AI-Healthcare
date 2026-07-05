# CLAUDE.md — MIMIC-IV Disease-Prediction Project

> Source of truth for this project. Read top-to-bottom before doing anything.
> Last updated: 2026-06-20.

## Goal
Predict the clinical conditions a patient **likely already has** — a ranked, explained
**differential** — from intake-style inputs (symptoms, prior history, home meds, vitals,
labs). Build it as an **anytime** system: works with whatever subset of data is given and
**sharpens as more arrives**; also recommends the **next best test** and explains **why**.

## Locked decisions (do not silently change)
- **Frame:** concurrent comorbidity inference (predict THIS admission's conditions from
  leakage-safe intake inputs). NOT next-visit forecasting, NOT same-encounter differential.
- **Label space:** AHRQ **CCSR**, ~502 disease categories. `FAC*`/`SYM*` families excluded
  from the prediction target (kept as features only).
- **End user:** clinician decision support → calibration + subgroup fairness are requirements.
  race/insurance/marital are **audit covariates only, never model inputs**.
- **Priority:** maximum accuracy + **explainability** (the graph is the explainability layer).
- **Compute:** ONE shared GPU host also serving Qwen; only ~4 GB VRAM free for training →
  lean on frozen/cached embeddings + light heads + LoRA/8-bit; slow training is acceptable.
- **t0 (intake cutoff):** = `admittime`. Nothing after t0 may enter features.

## Databases
- **Live data (canonical):** PostgreSQL 18.4 @ `176.9.16.194:5434`, db `Healthcare-Dataset`,
  user `postgres`. Full MIMIC-IV v3.x: schemas `mimic_hosp`, `mimic_icu`. 364,627 patients,
  546,028 admissions. Config in `.env`; connect via `db.py`.
- **⚠ Database encoding is WIN1252** (not UTF-8) — legacy of a SQL Server migration. When
  loading UTF-8 files, recode UTF-8→WIN1252 (`errors='replace'`) and `SET client_encoding='WIN1252'`.
- **⚠ All base tables are TEXT**; each has a `_typed` sibling with real types. Use `_typed`
  or cast. `omr` has NO `_typed` sibling (parse it manually).
- **⚠ `hadm_id` type mismatch:** `_typed`/`ml.*` tables use INTEGER; raw text tables and
  `mimic_note.*` use TEXT. Cast on join (`::int`).
- **Dead/legacy:** old SQL Server @ `:1433` and `schema_report.STALE-mssql.json` — IGNORE.

## Self-hosted LLM (Qwen)
- vLLM, OpenAI-compatible @ `LLM_BASE_URL` in `.env`. Model `qwen3.5-9b`, 32k ctx.
- **Reasoning model:** thinking is token-hungry. `llm.py` defaults thinking OFF
  (`chat_template_kwargs={"enable_thinking": false}`) for bulk extraction. Self-signed cert → `verify=False`.
- **Role: GENERATIVE extractor only** — drug→RxNorm/ATC, note section-extraction fallback,
  negation-aware concept extraction (gate through a deterministic linker), weak labels, RAG
  rationales. **NOT** an embedder, **NOT** the note sectionizer, **NOT** the primary scorer.

## Target architecture — 3-tower late-fusion ensemble
See `architecture.html` for the visual. Towers each emit per-CCSR probabilities:
- **Tower A — Tabular (CPU):** GBM/LR over demographics, vitals, prior-dx, home-meds, early
  labs, Charlson/Elixhauser. The calibration/fairness reference + cold-start fallback.
- **Tower B — Clinical text (GPU):** Clinical-Longformer over **allowlisted admission-only**
  note sections. Biggest lift; carries cold-start patients. Frozen embeddings first; LoRA only if needed.
- **Tower C — Coded sequence (GPU):** Med-BERT/CEHR-BERT over the **prior-admission timeline**
  (tokenized THROUGH `ml.icd_to_ccsr`, era-invariant). Carries repeat patients.
- **Fusion:** calibrated meta-learner on **out-of-fold** tower predictions + routing flags
  (`has_note`, `has_history`, `n_prior_admissions`). Per-label isotonic calibration on fused probs.
- **Graph:** NOT the predictor. Only (a) ontology embedding regularizer (GRAM/KAT-GNN) for
  Tower C rare codes, (b) explainability paths, (c) updatable serving view.

## LEAKAGE GUARDS (non-negotiable — clinician-facing)
- Every feature cut at **t0 = admittime**. Plan: add `ml.cohort_spine.t0` + one assertion test
  that re-derives each feature's max source timestamp ≤ t0 on a sample.
- **Meds:** only orders `starttime <= admittime` (home/admission meds). In-stay/discharge meds
  are treatment-response and MUST be dropped. (Fixed in `etl_05_meds.py`.)
- **Prior dx:** prior stay must DISCHARGE before index admit (`dischtime < admittime`).
  (Fixed in `etl_03_prior_dx.py`.)
- **Vitals:** `chartdate < admittime::date` (strict; omr is date-granular). (Fixed in `etl_04`.)
- **Notes:** NEVER feed a whole discharge summary. Fail-closed section ALLOWLIST — keep Chief
  Complaint/HPI/PMH/Meds-on-Admission/Allergies/Social+Family Hx/admission Physical Exam; HARD-DROP
  everything from "Brief Hospital Course"/"Discharge Diagnosis" onward; drop the note if the
  boundary can't be found. PMH/HPI are near-label-strength — keep ablatable, run PMH-reconstruction audit.
- **Radiology:** prior-encounter reports only, or same-stay INDICATION text behind an audit. Never FINDINGS/IMPRESSION.
- **Input codes:** harmonize through `ml.icd_to_ccsr` (currently labels-only) before any sequence model;
  hold out the `anchor_year_group` (ICD-9↔10 coding era) split in eval.
- **3 mandatory leakage probes** before trusting note metrics: (1) negative-control (admission-only
  vs full note), (2) mentioned-vs-not-mentioned AUROC gap, (3) token-leakage probe.
- **Honest ceiling:** Recall@20 ≈ 0.45–0.55 (note-covered/history strata). Anchor: THCM-CAL 0.46
  on MIMIC-IV. **Any pooled intake-only Recall@20 > ~0.60 = LEAKAGE ALARM**, re-run negative-control.
- Report Recall@10/@20 + micro/macro-AUPRC + ECE, STRATIFIED by `has_note` and `has_prior_history`.

## What's built (files + `ml` schema)
| File | Purpose |
|---|---|
| `db.py` | Postgres connection + `query_df` |
| `llm.py` | Qwen client (`chat`, `extract_json`) |
| `etl_01_spine.py` → `ml.cohort_spine` | one row/admission + demographics + admission_age |
| `etl_02_labels.py` → `ml.icd_to_ccsr`, `ml.labels` | CCSR grouper + multi-label target (99% cov, 502 cats) |
| `etl_03_prior_dx.py` → `ml.feat_prior_dx` | prior-admission CCSR history (leakage-safe) |
| `etl_04_vitals.py` → `ml.omr_vital`, `ml.feat_vitals` | BMI/wt/ht/BP from omr (parse-once) |
| `etl_05_meds.py` → `ml.drug_vocab`, `ml.feat_meds` | home/admission meds (top-500) |
| `etl_06_split.py` → `ml.split` | subject-level 70/15/15 (no straddle) |
| `notes_load.py` → `mimic_note.*` | load MIMIC-IV-Note (UTF-8→WIN1252 stream) |
| `modeling_baseline.py` → `baseline_metrics.json` | sparse-LR multi-label floor (MEMORY-LIGHT; keep sparse) |
| `demo_train.py` → `demo_model.pkl` | fast 100k-sample demo model |
| `demo_app.py` | local web demo @ localhost:8000 (stdlib only) |
| `architecture.html` | the visual architecture/dataflow/timeline |

ICD→CCSR uses the offline `icd-mappings` package (ICD-10→CCSR native; ICD-9→ICD-10→CCSR bridge).
Installed Python deps: psycopg2-binary, python-dotenv, pandas, scipy, scikit-learn, requests, icd-mappings.
**LightGBM does NOT work here** (needs `libomp`, no Homebrew/sudo) → use sklearn `HistGradientBoosting` or sparse LR.

## Roadmap (status)
- **Foundation** ✅ done — DB, ETL spine, CCSR labels, features, split.
- **Phase 0 — Correctness** 🟠 in progress — 3 leak fixes DONE; corrected ETL rebuilding;
  then run `modeling_baseline.py` for the honest floor (expect it to DROP — that's correct).
- **Phase 1 — Signal** 🟠 starting — notes loading; build fail-closed section sectionizer
  (`ml.note_intake_sections`); `ml.feat_labs_early` from `labevents_typed` (top ~150 itemids,
  windowed, indexed — NEVER full-scan/cast-in-WHERE); Qwen drug→RxNorm; wire the 3 leakage probes.
- **Phase 2 — Fusion** ⏳ — build 3 towers + calibrated stacking meta-learner + fairness audit.
- **Phase 3 — Interactive** ⏳ — next-best-test (value of information), what-if re-rank,
  graph explanation paths, Qwen rationales.

## Gotchas / lessons
- A killed Python client can leave a **server-side query holding a lock** (stuck in ClientWrite),
  blocking DDL. Fix: kill the local client; if needed ask the user to allow `pg_terminate_backend`
  (terminating shared-server backends is gated by the permission classifier).
- Don't pull 20M+ rows into pandas; keep feature matrices **sparse**; train on the GPU box, not RAM.
- Cold-start: ~123k single-admission patients (subject-level ~55%) have no prior history → need a
  popularity/age-sex prevalence fallback. Measure exact rate before sizing it.

## Current in-flight (as of last session)
- Background: corrected ETL re-run (prior_dx→vitals→meds) + discharge notes COPY.
- Next concrete step: once features land, run `demo_train.py` then `demo_app.py`; then start Phase 1.
