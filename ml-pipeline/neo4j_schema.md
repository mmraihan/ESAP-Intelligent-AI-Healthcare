# Neo4j Knowledge Graph Schema
## MIMIC-IV Disease-Prediction — Explainability + Serving Layer

> Phase 2 implementation reference. Designed against the data shapes that exist in
> `ml.*` as of 2026-06-20. Roles: (1) ontology embedding regularizer for Tower C,
> (2) traversable explainability paths, (3) incrementally-updatable per-patient
> serving view.

---

## 1. Node Types — Full Property Schema

### `:Condition`
One node per CCSR category (~502 nodes total, plus 3 synthetic hierarchy nodes per body
system and category group — see Section 3 hierarchy notes).

| Property | Type | Source | Notes |
|---|---|---|---|
| `ccsr_code` | String (PK) | `ml.icd_to_ccsr.ccsr` | e.g. `"END003"` |
| `label` | String | CCSR reference file (offline) | Human-readable name, e.g. `"Type 2 diabetes mellitus"` |
| `body_system` | String | First 3 chars of `ccsr_code` | e.g. `"END"` (Endocrine) |
| `category_group` | String | CCSR reference 2nd-level | e.g. `"Diabetes mellitus"` |
| `is_fac` | Boolean | `left(ccsr_code,3) = 'FAC'` | TRUE = facility/administrative — excluded from prediction target |
| `is_sym` | Boolean | `left(ccsr_code,3) = 'SYM'` | TRUE = symptom code — excluded from prediction target |
| `icd10_count` | Integer | COUNT from `ml.icd_to_ccsr` | How many distinct ICD-10 codes map here |
| `train_prevalence` | Float | Computed from `ml.labels` ∩ train split | Fraction of training admissions that have this label |
| `embedding_vec` | Float[] | Populated in Phase 2 | 128-dim GRAM/KAT-GNN embedding (null until Tower C training) |

Index on: `ccsr_code` (unique constraint), `body_system`, `is_fac`, `is_sym`.

---

### `:BodySystem`
Synthetic hierarchy node — one per CCSR body system abbreviation (~21 total).

| Property | Type | Notes |
|---|---|---|
| `code` | String (PK) | e.g. `"END"` |
| `label` | String | e.g. `"Endocrine, Nutritional and Metabolic Diseases"` |
| `condition_count` | Integer | How many `:Condition` nodes are children |

---

### `:CategoryGroup`
Mid-level hierarchy node — one per CCSR category group (~180 total).

| Property | Type | Notes |
|---|---|---|
| `code` | String (PK) | e.g. `"END-DM"` (synthesized from CCSR reference) |
| `label` | String | e.g. `"Diabetes mellitus"` |
| `body_system_code` | String | FK to `:BodySystem` |

---

### `:Drug`
One node per normalized drug name from `ml.drug_vocab` (500 nodes initially; grows
when Qwen RxNorm normalization lands in Phase 1).

| Property | Type | Source | Notes |
|---|---|---|---|
| `drug_norm` | String (PK) | `ml.drug_vocab.drug_norm` | Lowercased/trimmed MIMIC name |
| `rxnorm_cui` | String | Phase 1: Qwen extraction → RxNorm | Null until Phase 1 drug-norm pipeline |
| `atc_class_l1` | String | Derived from RxNorm→ATC | e.g. `"C"` (cardiovascular) |
| `atc_class_l2` | String | Derived from RxNorm→ATC | e.g. `"C09"` (ACE inhibitors) |
| `atc_class_label` | String | Human-readable ATC L2 name | |
| `train_frequency` | Integer | `ml.drug_vocab.n` | Count of prescriptions in training corpus |

Index on: `drug_norm` (unique), `atc_class_l1`, `rxnorm_cui`.

---

### `:LabTest`
One node per MIMIC lab item (~800 nodes for clinically-relevant tests; `ml.feat_labs_early`
not yet built as of this writing — this schema anticipates Phase 1 output).

| Property | Type | Source | Notes |
|---|---|---|---|
| `itemid` | Integer (PK) | `mimic_hosp.d_labitems_typed.itemid` | |
| `label` | String | `d_labitems_typed.label` | e.g. `"Creatinine"` |
| `fluid` | String | `d_labitems_typed.fluid` | e.g. `"Blood"`, `"Urine"` |
| `category` | String | `d_labitems_typed.category` | e.g. `"Chemistry"`, `"Hematology"` |
| `loinc_code` | String | `d_labitems_typed.loinc_code` | Null for ~40% of items |
| `top150_flag` | Boolean | Derived | TRUE = in the top-150 by order frequency (Phase 1 target items) |
| `voi_score` | Float | Computed by VOI engine (Phase 3) | Value-of-information score for next-best-test; updated per-patient |

Index on: `itemid` (unique), `category`, `top150_flag`, `loinc_code`.

---

### `:Symptom`
Phase 3 placeholder — populated when Qwen negation-aware concept extraction runs over
`ml.note_intake_sections`. Schema defined now so relationships can be added incrementally.

| Property | Type | Notes |
|---|---|---|
| `concept_id` | String (PK) | Synthesized from UMLS CUI or a slug if no CUI |
| `label` | String | e.g. `"increased thirst"` |
| `umls_cui` | String | UMLS Concept Unique Identifier if resolved |
| `snomed_id` | String | SNOMED CT concept ID if resolved |
| `extraction_count` | Integer | How many admissions this was extracted from |

Index on: `concept_id` (unique), `umls_cui`.

---

### `:Patient`
Lightweight anchor — one per `subject_id`. Carries no clinical detail (race/insurance
are audit-only, not stored in the graph per CLAUDE.md locked decisions).

| Property | Type | Source | Notes |
|---|---|---|---|
| `subject_id` | Integer (PK) | `ml.cohort_spine.subject_id` | |
| `gender` | String | `ml.cohort_spine.gender` | `"M"` / `"F"` |
| `anchor_year_group` | String | `ml.cohort_spine.anchor_year_group` | Era for ICD coding epoch split |
| `n_admissions` | Integer | Computed | Total admissions in dataset |
| `has_prior_history` | Boolean | Derived | FALSE = cold-start patient |

Index on: `subject_id` (unique).

---

### `:Admission`
One node per hospital admission (546,028 nodes).

| Property | Type | Source | Notes |
|---|---|---|---|
| `hadm_id` | Integer (PK) | `ml.cohort_spine.hadm_id` | |
| `admit_year_group` | String | `ml.cohort_spine.anchor_year_group` | ICD coding era; used to gate sequence model eval |
| `admission_age` | Integer | `ml.cohort_spine.admission_age` | Derived field from ETL |
| `admission_type` | String | `ml.cohort_spine.admission_type` | e.g. `"EMERGENCY"` |
| `arrived_via_ed` | Boolean | `ml.cohort_spine.arrived_via_ed` | |
| `split` | String | `ml.split.split` | `"train"` / `"val"` / `"test"` |
| `has_note` | Boolean | Derived | TRUE = discharge note present in `mimic_note.discharge` |
| `has_prior_history` | Boolean | Derived | FALSE = cold-start (no `feat_prior_dx` rows) |
| `n_prior_admissions` | Integer | Derived | Count of prior admits for this patient |
| `tower_a_score` | Float[] | Phase 2 | 502-dim Tower A probability vector (null until training) |
| `tower_b_score` | Float[] | Phase 2 | 502-dim Tower B vector (null if no note) |
| `tower_c_score` | Float[] | Phase 2 | 502-dim Tower C vector (null if no history) |
| `fused_score` | Float[] | Phase 2 | 502-dim calibrated fused vector |

Index on: `hadm_id` (unique), `split`, `has_note`, `has_prior_history`.

---

## 2. Relationship Types — Full Property Schema

### `(:Patient)-[:HAS_ADMISSION]->(:Admission)`
| Property | Type | Notes |
|---|---|---|
| `admit_seq` | Integer | 1-based ordinal (1 = first ever admission for this patient) |
| `days_since_prior` | Float | Days since previous admission (null for first) |

---

### `(:Admission)-[:DIAGNOSED_WITH {confidence: float}]->(:Condition)`
Populated from `ml.labels`. Only actual-diagnosis ground-truth labels at load time;
`confidence` = 1.0 for ground truth, model probability for serving-time predictions.

| Property | Type | Notes |
|---|---|---|
| `confidence` | Float | 1.0 = ground truth; <1.0 = model prediction (Phase 2+) |
| `is_principal` | Boolean | `ml.labels.is_principal` |
| `source` | String | `"ground_truth"` / `"tower_a"` / `"tower_b"` / `"tower_c"` / `"fused"` |
| `rank` | Integer | Rank in the differential (1 = highest confidence) |

---

### `(:Admission)-[:PRESCRIBED {at_admission: bool}]->(:Drug)`
| Property | Type | Notes |
|---|---|---|
| `at_admission` | Boolean | TRUE = sourced from `feat_meds` (prior-admission proxy for home meds) |
| `rxnorm_cui` | String | Populated in Phase 1 when Qwen normalizes |
| `source` | String | `"feat_meds"` / `"note_extraction"` (Phase 1) |

---

### `(:Admission)-[:HAS_LAB {value: float, flag: string}]->(:LabTest)`
Early labs only (value at t0 or most-recent pre-admission reading). Populated from
`ml.feat_labs_early` in Phase 1.

| Property | Type | Notes |
|---|---|---|
| `value` | Float | Numeric result |
| `unit` | String | Units string from `d_labitems` |
| `flag` | String | `"normal"` / `"abnormal"` / `"critical"` |
| `hours_before_t0` | Float | How far before admittime the reading was taken |

---

### `(:Condition)-[:CO_OCCURS_WITH {count: int, pmi: float}]->(:Condition)`
Computed from `ml.labels` on the TRAINING split only (no test leakage). Undirected
logically but stored as directed pairs (lower ccsr_code → higher) to avoid duplicates.

| Property | Type | Notes |
|---|---|---|
| `count` | Integer | Number of training admissions with both conditions |
| `pmi` | Float | Pointwise mutual information = log(P(A,B) / (P(A)*P(B))) |
| `npmi` | Float | Normalized PMI ∈ [-1, 1] — use this for ranking |
| `lift` | Float | P(A∩B) / (P(A)*P(B)) — ratio form of PMI |
| `co_occurs_in_prior` | Boolean | TRUE = computed from prior-dx co-occurrence too (not just labels) |

Only pairs with `count >= 50` are stored to keep the graph tractable.
Estimated ~50k–150k edges at that threshold.

---

### `(:Condition)-[:SUBCATEGORY_OF]->(:Condition)` / `->(:CategoryGroup)` / `->(:BodySystem)`
CCSR ontology hierarchy. Traversed by the GRAM/KAT-GNN regularizer and by
explainability path queries.

| Property | Type | Notes |
|---|---|---|
| `level` | Integer | 1 = CCSR code → CategoryGroup, 2 = CategoryGroup → BodySystem |

---

### `(:Drug)-[:TREATS]->(:Condition)`
Loaded from a clinical knowledge source (DrugBank / RxNorm indication data).
Filtered to the 500-drug vocab ∩ 502 CCSR categories. Phase 1 partially populated
via Qwen drug→RxNorm; full population requires a DrugBank→CCSR mapping step.

| Property | Type | Notes |
|---|---|---|
| `evidence_level` | String | `"established"` / `"probable"` / `"possible"` |
| `source` | String | `"drugbank"` / `"rxnorm"` / `"qwen_inferred"` |

---

### `(:LabTest)-[:INDICATES]->(:Condition)`
Clinical knowledge: which lab abnormality points toward which condition. Bootstrapped
from LOINC→SNOMED mappings and validated against MIMIC co-occurrence. Used by the
next-best-test engine.

| Property | Type | Notes |
|---|---|---|
| `direction` | String | `"elevated"` / `"low"` / `"positive"` / `"any_abnormal"` |
| `sensitivity` | Float | Estimated diagnostic sensitivity (0–1) |
| `specificity` | Float | Estimated diagnostic specificity (0–1) |
| `evidence_level` | String | `"established"` / `"inferred"` |

---

### `(:Condition)-[:CONFIRMED_BY]->(:LabTest)`
Reverse of `INDICATES`; makes "which test confirms this condition" traversal O(1).
Same properties as `INDICATES` (mirrored at load time).

---

### `(:Symptom)-[:SUGGESTS]->(:Condition)` *(Phase 3)*
| Property | Type | Notes |
|---|---|---|
| `count` | Integer | How many admissions with this symptom got this diagnosis |
| `pmi` | Float | Symptom→condition PMI from training data |
| `negated` | Boolean | FALSE = symptom present; TRUE = symptom explicitly denied |

---

### `(:Admission)-[:EXHIBITS]->(:Symptom)` *(Phase 3)*
| Property | Type | Notes |
|---|---|---|
| `negated` | Boolean | TRUE = Qwen extracted as negated ("denies thirst") |
| `confidence` | Float | Qwen extraction confidence |
| `source_section` | String | Note section: `"chief_complaint"` / `"hpi"` / `"pmh"` |

---

## 3. Cypher DDL — Constraints and Indexes

```cypher
// ── Unique constraints (automatically create backing index) ──────────────────

CREATE CONSTRAINT condition_ccsr_unique
  IF NOT EXISTS
  FOR (c:Condition) REQUIRE c.ccsr_code IS UNIQUE;

CREATE CONSTRAINT body_system_code_unique
  IF NOT EXISTS
  FOR (b:BodySystem) REQUIRE b.code IS UNIQUE;

CREATE CONSTRAINT category_group_code_unique
  IF NOT EXISTS
  FOR (g:CategoryGroup) REQUIRE g.code IS UNIQUE;

CREATE CONSTRAINT drug_norm_unique
  IF NOT EXISTS
  FOR (d:Drug) REQUIRE d.drug_norm IS UNIQUE;

CREATE CONSTRAINT lab_itemid_unique
  IF NOT EXISTS
  FOR (l:LabTest) REQUIRE l.itemid IS UNIQUE;

CREATE CONSTRAINT symptom_concept_unique
  IF NOT EXISTS
  FOR (s:Symptom) REQUIRE s.concept_id IS UNIQUE;

CREATE CONSTRAINT patient_subject_unique
  IF NOT EXISTS
  FOR (p:Patient) REQUIRE p.subject_id IS UNIQUE;

CREATE CONSTRAINT admission_hadm_unique
  IF NOT EXISTS
  FOR (a:Admission) REQUIRE a.hadm_id IS UNIQUE;

// ── Lookup / filter indexes ───────────────────────────────────────────────────

// Condition filters (used by embedding regularizer + explainability)
CREATE INDEX condition_body_system_idx
  IF NOT EXISTS
  FOR (c:Condition) ON (c.body_system);

CREATE INDEX condition_is_fac_idx
  IF NOT EXISTS
  FOR (c:Condition) ON (c.is_fac);

CREATE INDEX condition_is_sym_idx
  IF NOT EXISTS
  FOR (c:Condition) ON (c.is_sym);

CREATE INDEX condition_prevalence_idx
  IF NOT EXISTS
  FOR (c:Condition) ON (c.train_prevalence);

// Drug filters (ATC class browsing, RxNorm lookup)
CREATE INDEX drug_atc_l1_idx
  IF NOT EXISTS
  FOR (d:Drug) ON (d.atc_class_l1);

CREATE INDEX drug_rxnorm_idx
  IF NOT EXISTS
  FOR (d:Drug) ON (d.rxnorm_cui);

// Lab filters (next-best-test engine queries by category)
CREATE INDEX lab_category_idx
  IF NOT EXISTS
  FOR (l:LabTest) ON (l.category);

CREATE INDEX lab_top150_idx
  IF NOT EXISTS
  FOR (l:LabTest) ON (l.top150_flag);

CREATE INDEX lab_loinc_idx
  IF NOT EXISTS
  FOR (l:LabTest) ON (l.loinc_code);

// Admission filters (most queries scope to split + flags)
CREATE INDEX admission_split_idx
  IF NOT EXISTS
  FOR (a:Admission) ON (a.split);

CREATE INDEX admission_has_note_idx
  IF NOT EXISTS
  FOR (a:Admission) ON (a.has_note);

CREATE INDEX admission_has_history_idx
  IF NOT EXISTS
  FOR (a:Admission) ON (a.has_prior_history);

// Composite: split + flags (GDS projections filter here heavily)
CREATE INDEX admission_split_note_hist_idx
  IF NOT EXISTS
  FOR (a:Admission) ON (a.split, a.has_note, a.has_prior_history);

// Co-occurrence relationship property index (for threshold filtering)
CREATE INDEX co_occurs_npmi_idx
  IF NOT EXISTS
  FOR ()-[r:CO_OCCURS_WITH]-() ON (r.npmi);

CREATE INDEX co_occurs_count_idx
  IF NOT EXISTS
  FOR ()-[r:CO_OCCURS_WITH]-() ON (r.count);

// DIAGNOSED_WITH indexes (confidence-ranked traversal at serving time)
CREATE INDEX diagnosed_confidence_idx
  IF NOT EXISTS
  FOR ()-[r:DIAGNOSED_WITH]-() ON (r.confidence);

CREATE INDEX diagnosed_source_idx
  IF NOT EXISTS
  FOR ()-[r:DIAGNOSED_WITH]-() ON (r.source);
```

---

## 4. ETL Plan — Populating Each Node and Relationship Type

### Prerequisites

- Neo4j 5.x Community/Enterprise with GDS 2.x and APOC 5.x plugins
- Python driver: `neo4j>=5.0` (`pip install neo4j`)
- All `ml.*` tables built and populated in Postgres
- CCSR reference file (offline, from `icd-mappings` package bundled data or AHRQ website)
- `d_labitems_typed` available in `mimic_hosp`

All ETL scripts write to Neo4j via the Bolt driver in batches of 1,000 using
`UNWIND $rows AS row ... MERGE ... SET` patterns to be idempotent.

---

### Step 1 — Ontology nodes (`:BodySystem`, `:CategoryGroup`, `:Condition`)

**Source:** `ml.icd_to_ccsr` JOIN with CCSR reference file (AHRQ CCSR_v2023-1.xlsx or
the bundled `icd-mappings` CCSR metadata).

**Query to extract from Postgres:**
```sql
SELECT DISTINCT
    ccsr                         AS ccsr_code,
    left(ccsr, 3)                AS body_system,
    -- category_group requires the CCSR reference crosswalk table
    count(DISTINCT icd_code)     AS icd10_count
FROM ml.icd_to_ccsr
GROUP BY ccsr;
```

**Prevalence computation (run on training split):**
```sql
SELECT l.ccsr,
       round(count(*)::numeric / (SELECT count(*) FROM ml.cohort_spine s
             JOIN ml.split sp USING (hadm_id) WHERE sp.split='train'), 6) AS train_prevalence
FROM ml.labels l
JOIN ml.split sp USING (hadm_id)
WHERE sp.split = 'train'
GROUP BY l.ccsr;
```

**Cypher load (batched UNWIND):**
```cypher
UNWIND $rows AS row
MERGE (c:Condition {ccsr_code: row.ccsr_code})
SET   c.body_system      = row.body_system,
      c.category_group   = row.category_group,
      c.label            = row.label,
      c.is_fac           = row.ccsr_code STARTS WITH 'FAC',
      c.is_sym           = row.ccsr_code STARTS WITH 'SYM',
      c.icd10_count      = row.icd10_count,
      c.train_prevalence = row.train_prevalence

MERGE (b:BodySystem {code: row.body_system})
SET   b.label = row.body_system_label

MERGE (g:CategoryGroup {code: row.category_group_code})
SET   g.label = row.category_group_label,
      g.body_system_code = row.body_system

MERGE (c)-[:SUBCATEGORY_OF {level: 1}]->(g)
MERGE (g)-[:SUBCATEGORY_OF {level: 2}]->(b);
```

**Estimated time:** < 1 minute (502 conditions + ~180 groups + 21 systems).

---

### Step 2 — `:Drug` nodes

**Source:** `ml.drug_vocab` (500 rows).

```sql
SELECT drug_norm, n AS train_frequency FROM ml.drug_vocab ORDER BY n DESC;
```

**Cypher:**
```cypher
UNWIND $rows AS row
MERGE (d:Drug {drug_norm: row.drug_norm})
SET   d.train_frequency = row.train_frequency,
      d.rxnorm_cui      = null,
      d.atc_class_l1    = null,
      d.atc_class_l2    = null;
```

**Phase 1 enrichment** (once Qwen drug-norm pipeline runs): re-run with `rxnorm_cui`
and `atc_class_*` populated from `ml.drug_rxnorm` (to be created in Phase 1 ETL).

---

### Step 3 — `:LabTest` nodes

**Source:** `mimic_hosp.d_labitems_typed` filtered to top-150 by order frequency
(Phase 1 `feat_labs_early` itemids). Until `feat_labs_early` exists, load all
items from `d_labitems_typed`.

```sql
SELECT itemid, label, fluid, category, loinc_code
FROM mimic_hosp.d_labitems_typed
ORDER BY itemid;
```

Mark `top150_flag = TRUE` for the Phase 1 target set once `feat_labs_early` is built.

**Cypher:**
```cypher
UNWIND $rows AS row
MERGE (l:LabTest {itemid: row.itemid})
SET   l.label        = row.label,
      l.fluid        = row.fluid,
      l.category     = row.category,
      l.loinc_code   = row.loinc_code,
      l.top150_flag  = row.top150_flag;
```

---

### Step 4 — `:Patient` and `:Admission` nodes + `HAS_ADMISSION` edges

**Source:** `ml.cohort_spine` JOIN `ml.split`.

```sql
SELECT
    s.subject_id, s.gender, s.anchor_year_group,
    s.hadm_id, s.admission_age, s.admission_type,
    s.arrived_via_ed, s.admittime, s.dischtime,
    sp.split,
    (EXISTS (SELECT 1 FROM ml.feat_prior_dx p WHERE p.hadm_id = s.hadm_id)) AS has_prior_history,
    (EXISTS (SELECT 1 FROM mimic_note.discharge n WHERE n.hadm_id::int = s.hadm_id)) AS has_note,
    -- ordinal within patient (ordered by admittime)
    row_number() OVER (PARTITION BY s.subject_id ORDER BY s.admittime) AS admit_seq,
    extract(epoch FROM (s.admittime - lag(s.admittime)
        OVER (PARTITION BY s.subject_id ORDER BY s.admittime))) / 86400.0 AS days_since_prior
FROM ml.cohort_spine s
JOIN ml.split sp USING (hadm_id);
```

**Cypher (batch size 1,000):**
```cypher
UNWIND $rows AS row
MERGE (p:Patient {subject_id: row.subject_id})
SET   p.gender            = row.gender,
      p.anchor_year_group = row.anchor_year_group

MERGE (a:Admission {hadm_id: row.hadm_id})
SET   a.admission_age      = row.admission_age,
      a.admission_type     = row.admission_type,
      a.arrived_via_ed     = row.arrived_via_ed,
      a.admit_year_group   = row.anchor_year_group,
      a.split              = row.split,
      a.has_prior_history  = row.has_prior_history,
      a.has_note           = row.has_note,
      a.n_prior_admissions = row.admit_seq - 1

MERGE (p)-[r:HAS_ADMISSION]->(a)
SET   r.admit_seq        = row.admit_seq,
      r.days_since_prior = row.days_since_prior;
```

**Estimated time:** 546,028 admissions / 1,000 per batch = ~546 batches. With Bolt
async session ~10–15 minutes on localhost.

---

### Step 5 — `DIAGNOSED_WITH` edges (ground truth)

**Source:** `ml.labels` (5.4M rows). This is the largest ETL step.

```sql
SELECT hadm_id, ccsr, is_principal FROM ml.labels;
```

**Cypher:**
```cypher
UNWIND $rows AS row
MATCH (a:Admission {hadm_id: row.hadm_id})
MATCH (c:Condition {ccsr_code: row.ccsr})
MERGE (a)-[r:DIAGNOSED_WITH]->(c)
SET   r.confidence  = 1.0,
      r.is_principal = row.is_principal,
      r.source       = 'ground_truth',
      r.rank         = null;
```

**Tip:** Use `neo4j-admin database import` bulk loader for this step instead of
driver UNWIND — it is 10–50x faster for 5M+ edges. Export to CSV first:

```bash
# Postgres side
psql -h 176.9.16.194 -p 5434 -U postgres -d "Healthcare-Dataset" \
  -c "\COPY ml.labels TO '/tmp/labels.csv' CSV HEADER"
```

Then use the Neo4j CSV import format and reference in the import command.

---

### Step 6 — `PRESCRIBED` edges

**Source:** `ml.feat_meds` (~several million rows).

```sql
SELECT hadm_id, drug_norm FROM ml.feat_meds;
```

**Cypher:**
```cypher
UNWIND $rows AS row
MATCH (a:Admission {hadm_id: row.hadm_id})
MATCH (d:Drug {drug_norm: row.drug_norm})
MERGE (a)-[r:PRESCRIBED]->(d)
SET   r.at_admission = true,
      r.source       = 'feat_meds';
```

---

### Step 7 — `CO_OCCURS_WITH` edges (condition co-occurrence)

Computed entirely in Postgres on the training split, then loaded into Neo4j.

```sql
-- Compute pairwise co-occurrence on TRAINING split only
WITH train_labels AS (
    SELECT l.hadm_id, l.ccsr
    FROM ml.labels l
    JOIN ml.split sp USING (hadm_id)
    WHERE sp.split = 'train'
      AND left(l.ccsr, 3) NOT IN ('FAC', 'SYM')
),
n_train AS (
    SELECT count(DISTINCT hadm_id) AS n FROM ml.split WHERE split = 'train'
),
pairs AS (
    SELECT
        least(a.ccsr, b.ccsr)    AS ccsr_a,
        greatest(a.ccsr, b.ccsr) AS ccsr_b,
        count(*)                 AS co_count
    FROM train_labels a
    JOIN train_labels b
      ON a.hadm_id = b.hadm_id AND a.ccsr < b.ccsr
    GROUP BY 1, 2
    HAVING count(*) >= 50
),
marginals AS (
    SELECT ccsr, count(DISTINCT hadm_id) AS n_a
    FROM train_labels
    GROUP BY ccsr
)
SELECT
    p.ccsr_a, p.ccsr_b, p.co_count,
    round(
        log(p.co_count::numeric * n_train.n /
            (ma.n_a::numeric * mb.n_a::numeric))::numeric, 4
    ) AS pmi,
    round(
        log(p.co_count::numeric * n_train.n /
            (ma.n_a::numeric * mb.n_a::numeric))::numeric /
        (-log(p.co_count::numeric / n_train.n))::numeric, 4
    ) AS npmi,
    round((p.co_count::numeric * n_train.n) /
          (ma.n_a::numeric * mb.n_a::numeric), 4) AS lift
FROM pairs p
JOIN marginals ma ON ma.ccsr = p.ccsr_a
JOIN marginals mb ON mb.ccsr = p.ccsr_b
CROSS JOIN n_train
ORDER BY p.co_count DESC;
```

Save output to `ml.condition_cooccurrence` table, then load into Neo4j:

```cypher
UNWIND $rows AS row
MATCH (a:Condition {ccsr_code: row.ccsr_a})
MATCH (b:Condition {ccsr_code: row.ccsr_b})
MERGE (a)-[r:CO_OCCURS_WITH]->(b)
SET   r.count             = row.co_count,
      r.pmi               = row.pmi,
      r.npmi              = row.npmi,
      r.lift              = row.lift,
      r.co_occurs_in_prior = false;
```

---

### Step 8 — `TREATS` and `INDICATES` / `CONFIRMED_BY` edges

These are clinical-knowledge edges, not derived from MIMIC. Three approaches in
priority order:

**Option A (recommended for Phase 2):** Use the `drugbank-approved.xml` file
(academic license, free) to extract drug→indication mappings. Map drug names to
`ml.drug_vocab` via RxNorm (Qwen Phase 1 output), map indication ICD codes through
`ml.icd_to_ccsr`.

**Option B (bootstrap):** Use Qwen to generate `(:Drug)-[:TREATS]->(:Condition)`
triples for the top-100 drugs × top-50 conditions. Prompt: "For the drug [drug_norm],
list CCSR condition codes it is a primary treatment for. Be conservative; only
established clinical indications." Mark `source='qwen_inferred'`, `evidence_level='probable'`.
Use as a placeholder until DrugBank is integrated.

**Option C (lab→condition):** Query LOINC→SNOMED indication mappings from
`https://loinc.org/downloads/loinc/` (offline CSV). Map SNOMED→ICD-10→CCSR through
the existing `ml.icd_to_ccsr` pipeline.

---

### ETL Execution Order

```
1. Ontology nodes      (~502 + ~180 + ~21)    < 1 min
2. Drug nodes          (500)                   < 1 min
3. LabTest nodes       (~800)                  < 1 min
4. Patient + Admission (364k + 546k)           10–15 min
5. DIAGNOSED_WITH      (5.4M)                  bulk import: 20–30 min
6. PRESCRIBED          (varies, ~3–8M)         bulk import: 20–40 min
7. HAS_LAB             (Phase 1: ~10–50M)      bulk import: 30–60 min
8. CO_OCCURS_WITH      (~50k–150k)             < 2 min
9. TREATS / INDICATES  (Phase 1/2)             < 5 min
10. SUBCATEGORY_OF     (~502 + ~180)           < 1 min
```

---

## 5. Example Cypher Queries — The 3 Roles

### Query 1: Explainability Path
**"Given patient P predicted with CKD (END002), find the strongest evidence path"**

```cypher
// Find the top-ranked evidence chains for CKD on a given admission
// Returns: what features + prior conditions most support the CKD prediction

MATCH (a:Admission {hadm_id: $hadm_id})

// Path 1: Prior diagnosis → CKD
OPTIONAL MATCH (a)-[:DIAGNOSED_WITH]->(prior_cond:Condition)
WHERE prior_cond.ccsr_code IN ['END003','CIR007','END002']  // diabetes, HTN, CKD itself (from prior)
  AND NOT (prior_cond.ccsr_code = 'END002')                 // exclude current prediction target
OPTIONAL MATCH (prior_cond)-[co:CO_OCCURS_WITH]->(target:Condition {ccsr_code: 'END002'})

// Path 2: Prior drug → condition known to cause CKD
OPTIONAL MATCH (a)-[:PRESCRIBED]->(d:Drug)-[:TREATS]->(ckd:Condition {ccsr_code: 'END002'})

// Path 3: Lab result → CKD confirmation
OPTIONAL MATCH (a)-[lab_edge:HAS_LAB]->(lab:LabTest)-[:INDICATES]->(ckd2:Condition {ccsr_code: 'END002'})
WHERE lab_edge.flag IN ['abnormal', 'critical']

RETURN
    // Prior-condition evidence
    collect(DISTINCT {
        type: 'prior_condition',
        ccsr: prior_cond.ccsr_code,
        label: prior_cond.label,
        co_occurrence_npmi: co.npmi,
        co_occurrence_count: co.count
    }) AS prior_condition_evidence,

    // Drug evidence
    collect(DISTINCT {
        type: 'drug',
        drug_norm: d.drug_norm,
        atc_class: d.atc_class_l2,
        evidence_level: 'established'
    }) AS drug_evidence,

    // Lab evidence
    collect(DISTINCT {
        type: 'lab',
        lab_label: lab.label,
        value: lab_edge.value,
        flag: lab_edge.flag,
        hours_before_admit: lab_edge.hours_before_t0
    }) AS lab_evidence

ORDER BY prior_condition_evidence DESC
LIMIT 1;
```

---

### Query 2: Co-occurrence Expansion
**"Given top-3 predicted conditions, find all strongly co-occurring conditions not yet predicted"**

```cypher
// Find co-occurring conditions not in the model's current top-K differential
// Use case: surface 'hidden' conditions the model may have missed given strong co-occurrence signal

WITH $predicted_ccsr_codes AS predicted   // e.g. ['END003', 'CIR007', 'END002']
WITH predicted, $hadm_id AS hadm_id

MATCH (seed:Condition)
WHERE seed.ccsr_code IN predicted

MATCH (seed)-[co:CO_OCCURS_WITH]-(neighbor:Condition)
WHERE NOT neighbor.ccsr_code IN predicted
  AND NOT neighbor.is_fac
  AND NOT neighbor.is_sym
  AND co.npmi > 0.15          // only positively correlated pairs
  AND co.count > 100          // minimum support

// Aggregate across all seed conditions
WITH neighbor,
     collect(seed.label)  AS driven_by,
     sum(co.npmi)         AS total_npmi,
     max(co.lift)         AS max_lift,
     sum(co.count)        AS total_co_count

// Also check if this patient has a prior history of the neighbor condition
OPTIONAL MATCH (a:Admission {hadm_id: hadm_id})-[:DIAGNOSED_WITH]->(neighbor)
WHERE a.split = 'test'   // just checking the current admission — won't match for predictions

RETURN
    neighbor.ccsr_code          AS ccsr_code,
    neighbor.label              AS condition_label,
    neighbor.body_system        AS body_system,
    neighbor.train_prevalence   AS base_prevalence,
    total_npmi                  AS co_occurrence_score,
    max_lift                    AS max_lift,
    driven_by                   AS driven_by_conditions,
    total_co_count              AS supporting_admissions

ORDER BY total_npmi DESC
LIMIT 20;
```

---

### Query 3: Next-Best-Test
**"Which lab test would most narrow the differential between CKD (END002) and Heart Failure (CIR019)?"**

```cypher
// Find the lab test that differentiates two conditions most clearly:
// high sensitivity for one + high specificity against the other

WITH 'END002' AS cond_a, 'CIR019' AS cond_b

// Labs that indicate CKD
MATCH (lab_a:LabTest)-[ind_a:INDICATES]->(ca:Condition {ccsr_code: cond_a})
WHERE lab_a.top150_flag = true

// Labs that indicate Heart Failure
MATCH (lab_b:LabTest)-[ind_b:INDICATES]->(cb:Condition {ccsr_code: cond_b})
WHERE lab_b.top150_flag = true

// Find labs that discriminate (strongly indicate ONE but not the other)
WITH lab_a, ind_a, cond_a, lab_b, ind_b, cond_b

// Case: lab distinguishes CKD from CHF
UNION

// Labs informative for CKD (high sensitivity) but NOT indicating CHF (or low)
MATCH (lab:LabTest)-[ia:INDICATES]->(a:Condition {ccsr_code: 'END002'})
WHERE lab.top150_flag = true
  AND ia.sensitivity > 0.6
  AND NOT (lab)-[:INDICATES]->(:Condition {ccsr_code: 'CIR019'})

RETURN
    lab.itemid         AS itemid,
    lab.label          AS lab_label,
    lab.category       AS category,
    'discriminates_for_CKD' AS discriminates_for,
    ia.sensitivity     AS sensitivity,
    ia.specificity     AS specificity,
    ia.direction       AS abnormal_direction

UNION

// Labs informative for CHF but NOT CKD
MATCH (lab:LabTest)-[ib:INDICATES]->(b:Condition {ccsr_code: 'CIR019'})
WHERE lab.top150_flag = true
  AND ib.sensitivity > 0.6
  AND NOT (lab)-[:INDICATES]->(:Condition {ccsr_code: 'END002'})

RETURN
    lab.itemid         AS itemid,
    lab.label          AS lab_label,
    lab.category       AS category,
    'discriminates_for_CHF' AS discriminates_for,
    ib.sensitivity     AS sensitivity,
    ib.specificity     AS specificity,
    ib.direction       AS abnormal_direction

ORDER BY sensitivity DESC
LIMIT 10;
```

---

### Query 4: Personalized PageRank / Graph Proximity Ranking
**"Given this patient's prior diagnosis history, rank all conditions by graph proximity"**

This query is intended to be run via the **GDS library** (not plain Cypher). The
pattern below shows the GDS call structure.

```cypher
// Step 1: Project a per-patient subgraph (conditions reachable from this patient's history)
// Run once per patient at serving time

CALL gds.graph.project.cypher(
  'patient_subgraph_' + toString($subject_id),
  // Nodes: all conditions reachable within 3 hops from patient's prior diagnoses
  'MATCH (p:Patient {subject_id: $subject_id})-[:HAS_ADMISSION]->(a:Admission)
   -[:DIAGNOSED_WITH]->(seed:Condition)
   MATCH (seed)-[:CO_OCCURS_WITH*0..2]-(neighbor:Condition)
   WHERE NOT neighbor.is_fac AND NOT neighbor.is_sym
   RETURN id(neighbor) AS id',
  // Edges: co-occurrence edges with npmi as weight
  'MATCH (a:Condition)-[r:CO_OCCURS_WITH]-(b:Condition)
   RETURN id(a) AS source, id(b) AS target, r.npmi AS weight',
  {parameters: {subject_id: $subject_id}}
)
YIELD graphName, nodeCount, relationshipCount;

// Step 2: Run Personalized PageRank seeded from patient's known conditions
CALL gds.pageRank.stream(
  'patient_subgraph_' + toString($subject_id),
  {
    maxIterations: 20,
    dampingFactor: 0.85,
    sourceNodes: [
      // Seed nodes = conditions from patient's most recent admission(s)
      // Retrieve these node IDs first
    ],
    relationshipWeightProperty: 'weight'
  }
)
YIELD nodeId, score

WITH gds.util.asNode(nodeId) AS condition, score
WHERE NOT condition.is_fac AND NOT condition.is_sym
RETURN
    condition.ccsr_code       AS ccsr_code,
    condition.label           AS label,
    condition.body_system     AS body_system,
    condition.train_prevalence AS base_prevalence,
    score                     AS pagerank_proximity_score

ORDER BY score DESC
LIMIT 30;

// Step 3: Drop the ephemeral projection after serving
CALL gds.graph.drop('patient_subgraph_' + toString($subject_id));
```

**Note for implementation:** For production serving, pre-compute and cache these
scores at admission load time rather than on-the-fly. Store results in
`a.pagerank_scores` (a map property) on the `:Admission` node, refreshed when
new data arrives (the "anytime" update).

---

### Query 5: Ontology Embedding Regularizer
**"Find all sibling CCSR codes to END003 (Type 2 diabetes) for embedding regularization"**

This query feeds the GRAM/KAT-GNN ontology regularizer used in Tower C. For each
CCSR code in a patient's prior-admission sequence, we need its siblings, cousins,
and ancestors so the embedding smoother can share signal across rare codes.

```cypher
// For a given CCSR code, retrieve:
// 1. Direct parent (CategoryGroup)
// 2. Grandparent (BodySystem)
// 3. Siblings (same CategoryGroup, different code)
// 4. Cousins (same BodySystem, different CategoryGroup)

WITH 'END003' AS target_ccsr

MATCH (target:Condition {ccsr_code: target_ccsr})

// Walk up the hierarchy
MATCH (target)-[:SUBCATEGORY_OF]->(parent:CategoryGroup)
MATCH (parent)-[:SUBCATEGORY_OF]->(grandparent:BodySystem)

// Siblings: same CategoryGroup
MATCH (sibling:Condition)-[:SUBCATEGORY_OF]->(parent)
WHERE sibling.ccsr_code <> target_ccsr
  AND NOT sibling.is_fac AND NOT sibling.is_sym

// Cousins: same BodySystem, different CategoryGroup
MATCH (cousin:Condition)-[:SUBCATEGORY_OF]->(cousin_group:CategoryGroup)
       -[:SUBCATEGORY_OF]->(grandparent)
WHERE cousin_group <> parent
  AND NOT cousin.is_fac AND NOT cousin.is_sym

RETURN
    // Target info
    target.ccsr_code          AS target_code,
    target.label              AS target_label,

    // Hierarchy
    parent.code               AS parent_group_code,
    parent.label              AS parent_group_label,
    grandparent.code          AS body_system_code,
    grandparent.label         AS body_system_label,

    // Siblings (same category group — highest embedding similarity weight)
    collect(DISTINCT {
        ccsr_code: sibling.ccsr_code,
        label: sibling.label,
        prevalence: sibling.train_prevalence,
        relation: 'sibling',
        embedding_weight: 0.8   // regularization weight parameter
    }) AS siblings,

    // Cousins (same body system — lower similarity weight)
    collect(DISTINCT {
        ccsr_code: cousin.ccsr_code,
        label: cousin.label,
        prevalence: cousin.train_prevalence,
        relation: 'cousin',
        embedding_weight: 0.3
    }) AS cousins

LIMIT 1;
```

**Programmatic use in Tower C training:**
```python
# Called once per unique CCSR code before training to build the ontology adjacency
def get_ontology_neighbors(session, ccsr_code):
    result = session.run(QUERY_5, target_ccsr=ccsr_code).single()
    return {
        "siblings": result["siblings"],
        "cousins":  result["cousins"],
        "parent":   result["parent_group_code"],
        "grandparent": result["body_system_code"],
    }
```

---

## 6. Neo4j Version and Plugin Recommendations

### Neo4j Version
**Neo4j 5.20 LTS** (latest Long-Term Support as of 2026-Q2). Reasons:
- Stable property index support for relationship properties (needed for `CO_OCCURS_WITH.npmi` index)
- Composite node key constraints
- Native vector index (`CREATE VECTOR INDEX`) for `condition.embedding_vec` (128-dim GRAM vectors)
- Better memory management for graph projections (important given the 4 GB VRAM constraint — GDS runs CPU-side anyway)

**Deployment:** Docker on the same host as PostgreSQL and Qwen (176.9.16.194).
Allocate 8–16 GB heap (`dbms.memory.heap.max_size=12g`) and 4–8 GB page cache
(`dbms.memory.pagecache.size=6g`). Neo4j itself is CPU-only; no GPU contention.

```yaml
# docker-compose snippet
neo4j:
  image: neo4j:5.20-enterprise   # or community if no clustering needed
  environment:
    NEO4J_AUTH: neo4j/your_password
    NEO4J_PLUGINS: '["graph-data-science", "apoc"]'
    NEO4J_dbms_memory_heap_max__size: 12g
    NEO4J_dbms_memory_pagecache_size: 6g
    NEO4J_dbms_security_procedures_unrestricted: 'gds.*,apoc.*'
  ports:
    - "7474:7474"   # HTTP browser
    - "7687:7687"   # Bolt
  volumes:
    - ./neo4j_data:/data
    - ./neo4j_logs:/logs
```

### Required Plugins

| Plugin | Version | Role in this project |
|---|---|---|
| **Graph Data Science (GDS) 2.x** | ≥ 2.10 | Personalized PageRank (Query 4); future: FastRP node embeddings as pre-training for GRAM vectors; community detection for condition clustering |
| **APOC 5.x** | Match Neo4j 5.x | `apoc.periodic.iterate` for batched bulk writes; `apoc.refactor.mergeNodes` if dedup needed; `apoc.math.sigmoid` for VOI scoring; JSON import/export for Tower C embedding sync |

### Optional but Recommended

| Plugin | Role |
|---|---|
| **Neo4j Vector Index (built-in from 5.13+)** | Store and query 128-dim GRAM embeddings on `:Condition` nodes — `db.index.vector.queryNodes('condition_embeddings', 10, queryVector)` to find k-nearest CCSR codes during inference |
| **Bloom (visualization)** | Clinician-facing graph browser for explaining paths — commercial, but free for single-user |

---

## 7. Estimated Graph Size

All estimates are based on stated dataset figures (364,627 patients, 546,028
admissions, 502 CCSR categories, 500 drugs, ~800 lab items, 5.4M label rows,
28,189 ICD→CCSR mappings).

### Node Counts

| Label | Count | Notes |
|---|---|---|
| `:Patient` | 364,627 | One per `subject_id` |
| `:Admission` | 546,028 | One per `hadm_id` |
| `:Condition` | 502 | All CCSR categories |
| `:CategoryGroup` | ~180 | CCSR mid-level groups |
| `:BodySystem` | ~21 | CCSR body system abbreviations |
| `:Drug` | 500 | `ml.drug_vocab` |
| `:LabTest` | ~800 | `d_labitems_typed` (all); ~150 in top-150 flag |
| `:Symptom` | ~2,000–5,000 | Phase 3 estimate from NLP extraction |
| **Total nodes** | **~912,000** | ~2.5M with Phase 3 symptoms |

### Relationship Counts

| Type | Estimated Count | Notes |
|---|---|---|
| `HAS_ADMISSION` | 546,028 | One-to-one with admissions |
| `DIAGNOSED_WITH` | ~5,400,000 | From `ml.labels` (5.4M rows) |
| `PRESCRIBED` | ~3,000,000–8,000,000 | Estimate: ~60% of admissions × ~10 drugs avg |
| `HAS_LAB` | ~10,000,000–50,000,000 | Phase 1; wide range until `feat_labs_early` is sized |
| `CO_OCCURS_WITH` | ~50,000–150,000 | Condition pairs with count ≥ 50; 502²/2 = 126k max |
| `SUBCATEGORY_OF` | ~700 | 502 + ~180 + ~21 hierarchy edges |
| `TREATS` | ~2,000–5,000 | Drug × condition clinical knowledge |
| `INDICATES` + `CONFIRMED_BY` | ~3,000–8,000 | Lab × condition (×2 for reverse) |
| `EXHIBITS` (Phase 3) | ~5,000,000 | ~500k admissions × ~10 symptoms avg |
| `SUGGESTS` (Phase 3) | ~10,000 | Symptom × condition pairs |
| **Total relationships** | **~19–64M** | Without Phase 3 labs/symptoms: ~9–14M |

### Disk and Memory Estimates

| Scenario | Nodes | Relationships | Estimated Disk | Page Cache Needed |
|---|---|---|---|---|
| Phase 2 launch (no labs, no symptoms) | ~912k | ~9M | ~4–6 GB | 4 GB |
| Phase 2 full (with early labs) | ~912k | ~19–24M | ~10–14 GB | 6–8 GB |
| Phase 3 (+ symptoms, + serving scores) | ~917k | ~60M+ | ~30–40 GB | 12–16 GB |

**Key sizing note:** The `tower_a_score`, `tower_b_score`, `tower_c_score`, and
`fused_score` Float[] properties on `:Admission` nodes each store a 502-element
vector. At 4 bytes/float × 502 × 4 towers × 546,028 admissions = ~4.4 GB of
property storage just for these vectors. Consider storing them in a separate
`ml.admission_scores` Postgres table and only syncing the `fused_score` (top-K
sparse) into Neo4j if disk is a concern.

---

## 8. Implementation Notes for Phase 2

1. **Build ETL as a Python module** (`neo4j_etl.py`) that reads from Postgres via
   `db.py` and writes to Neo4j via the `neo4j` Python driver. Batch size 1,000 for
   all MERGE operations. Use `apoc.periodic.iterate` for bulk re-loads.

2. **Leakage guard in the graph:** The `split` property on `:Admission` must be
   respected in all co-occurrence and PageRank computations. The `CO_OCCURS_WITH`
   edges are derived from training data only and are static — they do not change
   at serving time. Only `DIAGNOSED_WITH` edges with `source != 'ground_truth'`
   (i.e., model predictions) are written at serving time.

3. **Anytime update protocol:** When new data arrives for an in-progress admission,
   the serving layer does:
   - `MERGE (a:Admission {hadm_id: $hadm_id})-[r:HAS_LAB]->(l:LabTest {itemid: $itemid})`
     with the new lab value
   - Re-run the fused tower scoring
   - `SET a.fused_score = $new_scores`
   - Update `DIAGNOSED_WITH` edges: adjust `confidence` and `rank` properties

4. **Tower C embedding sync:** After GRAM/KAT-GNN training in Phase 2, write the
   128-dim embeddings back to `:Condition.embedding_vec` and create a vector index:
   ```cypher
   CREATE VECTOR INDEX condition_embedding_idx
   FOR (c:Condition) ON (c.embedding_vec)
   OPTIONS {indexConfig: {`vector.dimensions`: 128, `vector.similarity_function`: 'cosine'}};
   ```

5. **Race/insurance are NOT stored** in the graph per project locked decisions.
   They exist only in Postgres for the fairness audit and never enter Neo4j.
