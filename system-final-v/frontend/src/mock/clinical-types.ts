/**
 * Typed mirror of the backend API_CONTRACT.md schemas (FastAPI + Pydantic v2).
 *
 * SOURCE-OF-TRUTH NOTE: the spec calls for these types (and the intake Zod schema)
 * to be *generated from the backend's exported OpenAPI* so there is one contract
 * source, not two. The backend is not built yet in this checkout, so these are
 * hand-authored from API_CONTRACT.md as a faithful placeholder. When the backend
 * ships, replace this file with `openapi-typescript` output and derive the Zod
 * schema from it. See TODO in README of intended workflow. The shapes here match
 * API_CONTRACT.md §2–§6 field-for-field.
 */

// ---------------------------------------------------------------------------
// Request — IntakeRequest (API_CONTRACT §2)
// ---------------------------------------------------------------------------

export interface Demographics {
  admission_age: number; // 0-120, REQUIRED
  is_female: number; // 0 | 1, REQUIRED
}

export interface AdmissionContext {
  via_ed?: number | null; // 0 | 1
  admission_type?: string | null; // enum; unknown/rare -> OTHER server-side
  admission_location?: string | null;
}

export interface Vitals {
  bmi?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  bp_sys?: number | null;
  bp_dia?: number | null;
}

export interface PriorHistory {
  prior_ccsr: string[]; // /^[A-Z]{3}\d{3}$/
  n_prior_admissions: number;
  charlson_index?: number | null;
}

export interface NoteSections {
  chief_complaint?: string | null;
  hpi?: string | null;
  pmh?: string | null;
  meds_on_admission?: string | null;
  allergies?: string | null;
  social_hx?: string | null;
  family_hx?: string | null;
  physical_exam?: string | null;
  review_of_systems?: string | null;
}

export interface PriorEvent {
  prior_hadm?: string | null;
  ccsr: string;
  gap_days: number;
}

/** The ONLY object any model adapter receives. */
export interface IntakeFeatures {
  demographics: Demographics;
  admission_context: AdmissionContext;
  vitals: Vitals;
  labs: Record<string, number>; // itemid(str) -> value; keys whitelisted
  prior_history: PriorHistory;
  meds: string[];
  notes: NoteSections | null;
  coded_sequence: PriorEvent[];
}

/** CAPTURED for the fairness audit; NEVER a model input. Sibling of features. */
export interface AuditCovariates {
  race?: string | null;
  insurance?: string | null;
  marital_status?: string | null;
}

export type ProvenanceSource = "form" | "chat" | "voice" | "db_prefill";

export interface Provenance {
  source: ProvenanceSource;
  field_confidence: Record<string, number>;
  needs_confirmation: string[];
}

export interface IntakeRequest {
  features: IntakeFeatures;
  audit_covariates: AuditCovariates;
  provenance: Provenance;
  request_id?: string | null;
}

// ---------------------------------------------------------------------------
// Response — AssessResponse (API_CONTRACT §3)
// ---------------------------------------------------------------------------

// "suppressed" = withheld for this tenant by a Settings → Model display toggle
// or because the plan does not include the model. Not a failure; simply not shown.
export type ModelStatus = "live" | "stub" | "degraded" | "error" | "not_ready" | "suppressed";

export interface ModelOutcome<R = unknown> {
  model_id: string; // "M-01".."M-05"
  status: ModelStatus;
  model_version: string;
  result: R | null;
  error?: string | null;
  latency_ms: number;
  // Stub predictors additionally carry these (SYSTEM_DESIGN §6); optional here.
  reason?: string | null;
  model_status?: string; // e.g. "stub" — the placeholder marker the backend sets
  // Faithful drivers for single-outcome models (M-02..M-05). Null on stub/error.
  explanation?: Explanation | null;
}

// --- Explainability (EXPLAINABILITY.md) --------------------------------------
// Every contributor is COMPUTED from the real model — never guessed. M-01 uses
// exact-linear (contribution = coef*value; Σ+intercept = logit); M-02..M-05 use
// marginal-occlusion, an approximate model-agnostic local method (NOT SHAP).

export type ExplainMethod = "exact-linear" | "shap" | "marginal-occlusion";

export interface ExplanationContributor {
  feature: string;
  human_label: string;
  patient_value?: number | null;
  value_display: string;
  direction: "increases" | "decreases";
  contribution: number;
  from_missing: boolean;
}

export interface ExplanationRationale {
  text: string;
  generated: boolean; // always true — a generated summary, not a model output
  grounded_on: string; // "top_contributors"
}

export interface Explanation {
  method: ExplainMethod;
  basis: string;
  top_contributors: ExplanationContributor[];
  caveats: string[];
  rationale?: ExplanationRationale | null;
  reconstruction_ok?: boolean | null; // exact-linear self-check
}

export interface DifferentialItem {
  ccsr: string;
  probability: number;
  family: string;
  /**
   * False when this label's cal_method=='raw' OR when the case's
   * feature_coverage.calibration_validity=='reduced' (HARD-SUPPRESS, §3.1).
   */
  calibrated: boolean;
  from_unconfirmed_extraction: boolean;
  // Per-condition faithful drivers (exact-linear). Null in stub mode (no real weights).
  explanation?: Explanation | null;
}

export type FusionStatus = "tower_a_only" | "pending" | "fused";

export interface DifferentialResult {
  label: string; // "Likely concurrent conditions"
  items: DifferentialItem[];
  top_n: number;
  fusion_status: FusionStatus;
  towers_used: string[];
  tower_contributions: Record<string, number | null>;
  unscored_ccsr_count: number;
  unmatched_ccsr: string[];
  unmatched_meds: string[];
}

export interface RiskResult {
  probability: number;
  population_percentile: number;
  calibrated: boolean;
  threshold?: number | null;
  flag?: boolean | null;
  operating_point: string;
}

export interface ReadmissionResult extends RiskResult {
  frame: "intake" | "discharge";
  alert_budget: string;
  top_decile_flag: boolean;
  lace_score?: number | null;
}

export interface LOSResult {
  interval_low: number; // >= 0
  interval_high: number;
  point_days: number; // secondary; never shown without the interval
  level: number; // nominal target (e.g. 0.95)
  coverage: number; // measured pooled coverage
  tail_coverage_reduced: boolean;
  low_signal: boolean;
}

export type CalibrationValidity = "full" | "reduced";

export interface FeatureCoverage {
  has_vitals: boolean;
  has_labs: boolean;
  has_prior_history: boolean;
  has_notes: boolean;
  n_labs_present: number;
  n_prior_ccsr: number;
  minimum_signal_met: boolean;
  calibration_validity: CalibrationValidity;
}

export interface AssessResponse {
  request_id: string;
  generated_at: string;
  schema_version: string;
  disclaimer: string;
  differential: ModelOutcome<DifferentialResult>;
  mortality: ModelOutcome<RiskResult>;
  icu: ModelOutcome<RiskResult>;
  readmission: ModelOutcome<ReadmissionResult>;
  los: ModelOutcome<LOSResult>;
  feature_coverage: FeatureCoverage;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Extraction — future/stub (API_CONTRACT §4)
// ---------------------------------------------------------------------------

export interface FieldConfidence {
  field: string; // dotted path
  value: unknown;
  confidence: number;
  needs_confirmation: boolean;
  source_span?: string | null;
  mapping?: { from?: string; to_code?: string; to_name?: string } | null;
}

export interface ExtractionResponse {
  features: IntakeFeatures;
  fields: FieldConfidence[];
  ask_back: string[];
  unresolved: string[];
  model_status?: string; // e.g. "live" | "stub" — the placeholder marker the backend sets
}

// ---------------------------------------------------------------------------
// Catalog / registry endpoints
// ---------------------------------------------------------------------------

export interface LabCatalogEntry {
  itemid: string;
  label: string;
  units?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  panel?: string | null; // e.g. "BMP" | "CBC" | "ABG"
}

export interface CcsrCatalogEntry {
  ccsr: string;
  family: string;
  description: string;
  lay?: string | null;
}

export interface MedVocabEntry {
  name: string;
}

export interface EnumCatalog {
  admission_type: string[];
  admission_location: string[];
}

export interface ModelRegistryEntry {
  model_id: string;
  name: string;
  status: ModelStatus;
  served_by?: string;
  fusion_status?: FusionStatus;
  towers_used?: string[];
  model_version?: string;
  trained?: string;
  artifact?: string;
  ref_metric?: { name: string; value: number; target_band?: string; below_target?: boolean };
  calibration?: string;
  env?: { sklearn?: string; matched?: boolean };
  loaded?: boolean;
  reason?: string;
  enabled?: boolean;
  target_band?: string;
  below_target?: boolean;
  conformal_mode?: string;
  tail_coverage_reduced?: boolean;
  low_signal?: boolean;
  frames?: Record<string, { auroc: number }>;
}

// ---------------------------------------------------------------------------
// Error envelope (API_CONTRACT §5)
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detail?: unknown;
    request_id?: string;
  };
}
