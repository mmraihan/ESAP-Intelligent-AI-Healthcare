"""IntakeRequest / AssessResponse — API_CONTRACT §2, §3, §4.

Transcribed from the contract, which the frontend's `src/mock/clinical-types.ts`
also mirrors. `extra="forbid"` everywhere: an unknown field is a 422, never a
silent drop, because a silently ignored vital reads to the clinician as
"recorded" when it was discarded.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

CCSR_PATTERN = r"^[A-Z]{3}\d{3}$"
MAX_LABS = 300

CcsrCode = Annotated[str, StringConstraints(pattern=CCSR_PATTERN)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- request ---------------------------------------------------------------


class Vitals(Strict):
    bmi: float | None = Field(None, ge=8, le=100)
    weight_kg: float | None = Field(None, ge=20, le=300)
    height_cm: float | None = Field(None, ge=120, le=230)
    bp_sys: float | None = Field(None, ge=40, le=300)
    bp_dia: float | None = Field(None, ge=20, le=200)


class Demographics(Strict):
    admission_age: int = Field(ge=0, le=120)
    is_female: int = Field(ge=0, le=1)


class AdmissionContext(Strict):
    via_ed: int | None = Field(None, ge=0, le=1)
    admission_type: str | None = None
    admission_location: str | None = None


class PriorHistory(Strict):
    prior_ccsr: list[CcsrCode] = Field(default_factory=list)
    n_prior_admissions: int = Field(0, ge=0)
    charlson_index: int | None = Field(None, ge=0)


class NoteSections(Strict):
    chief_complaint: str | None = None
    hpi: str | None = None
    pmh: str | None = None
    meds_on_admission: str | None = None
    allergies: str | None = None
    social_hx: str | None = None
    family_hx: str | None = None
    physical_exam: str | None = None
    review_of_systems: str | None = None


class PriorEvent(Strict):
    prior_hadm: str | None = None
    ccsr: str = Field(pattern=CCSR_PATTERN)
    gap_days: int


class IntakeFeatures(Strict):
    """The only object a model adapter ever receives.

    Audit covariates are deliberately absent: they live on the sibling
    `audit_covariates` so that "never a model input" is enforced by the type,
    not by a reviewer remembering the rule (§6 guardrail 4).
    """

    demographics: Demographics
    admission_context: AdmissionContext = Field(default_factory=AdmissionContext)
    vitals: Vitals = Field(default_factory=Vitals)
    labs: dict[str, float] = Field(default_factory=dict)
    prior_history: PriorHistory = Field(default_factory=PriorHistory)
    meds: list[str] = Field(default_factory=list)
    notes: NoteSections | None = None
    coded_sequence: list[PriorEvent] = Field(default_factory=list)

    @field_validator("labs")
    @classmethod
    def _labs_are_known_itemids(cls, labs: dict[str, float]) -> dict[str, float]:
        """Lab keys are numeric itemids that exist in the catalog — never silent-drop.

        An unrecognised itemid is a 422 rather than a discarded entry: dropping
        it would show the clinician a result computed without the lab they
        believe they supplied.
        """
        if len(labs) > MAX_LABS:
            raise ValueError(f"at most {MAX_LABS} lab values per request (got {len(labs)})")

        from ..catalogs import known_lab_itemids  # local import: catalogs reads the DB

        known = known_lab_itemids()
        bad_format = sorted(k for k in labs if not k.isdigit())
        if bad_format:
            raise ValueError(f"lab keys must be numeric itemids; got {bad_format[:5]}")
        unknown = sorted(k for k in labs if k not in known)
        if unknown:
            raise ValueError(f"unknown lab itemid(s): {unknown[:5]} — see GET /api/v1/schema/labs")
        return labs


class AuditCovariates(Strict):
    race: str | None = None
    insurance: str | None = None
    marital_status: str | None = None


class Provenance(Strict):
    source: Literal["form", "chat", "voice", "db_prefill"] = "form"
    field_confidence: dict[str, float] = Field(default_factory=dict)
    needs_confirmation: list[str] = Field(default_factory=list)


class IntakeRequest(Strict):
    features: IntakeFeatures
    audit_covariates: AuditCovariates = Field(default_factory=AuditCovariates)
    provenance: Provenance = Field(default_factory=Provenance)
    request_id: str | None = None
    #: Optional link to a worklist row, so /assess can update the encounter.
    encounter_id: str | None = None


# --- response --------------------------------------------------------------


class ExplanationContributor(BaseModel):
    feature: str
    human_label: str
    patient_value: float | None = None
    value_display: str
    direction: Literal["increases", "decreases"]
    contribution: float
    from_missing: bool = False


class ExplanationRationale(BaseModel):
    text: str
    generated: bool = True
    grounded_on: str = "top_contributors"


class Explanation(BaseModel):
    method: Literal["exact-linear", "shap", "marginal-occlusion"]
    basis: str
    top_contributors: list[ExplanationContributor]
    caveats: list[str] = Field(default_factory=list)
    rationale: ExplanationRationale | None = None
    reconstruction_ok: bool | None = None


class ModelOutcome(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    # "suppressed" = this tenant turned the model off in Settings → Model display.
    # It is a display policy, not a failure: the gauge is simply not shown here.
    status: Literal["live", "stub", "degraded", "error", "not_ready", "suppressed"]
    model_version: str
    result: dict | None = None
    error: str | None = None
    latency_ms: float
    reason: str | None = None
    explanation: Explanation | None = None


class DifferentialItem(BaseModel):
    ccsr: str
    probability: float = Field(ge=0, le=1)
    family: str
    calibrated: bool
    from_unconfirmed_extraction: bool = False
    explanation: Explanation | None = None


class DifferentialResult(BaseModel):
    label: str = "Likely concurrent conditions"
    items: list[DifferentialItem]
    top_n: int
    fusion_status: Literal["tower_a_only", "pending", "fused"]
    towers_used: list[str] = Field(default_factory=lambda: ["A"])
    tower_contributions: dict[str, float | None] = Field(
        default_factory=lambda: {"A": None, "B": None, "C": None}
    )
    unscored_ccsr_count: int
    unmatched_ccsr: list[str] = Field(default_factory=list)
    unmatched_meds: list[str] = Field(default_factory=list)


class RiskResult(BaseModel):
    probability: float = Field(ge=0, le=1)
    population_percentile: int
    calibrated: bool = True
    threshold: float | None = None
    flag: bool | None = None
    operating_point: str


class ReadmissionResult(RiskResult):
    frame: Literal["intake", "discharge"]
    alert_budget: str = "precision@top-decile"
    top_decile_flag: bool
    lace_score: int | None = None


class LOSResult(BaseModel):
    interval_low: float
    interval_high: float
    point_days: float
    level: float
    coverage: float
    tail_coverage_reduced: bool
    low_signal: bool


class FeatureCoverage(BaseModel):
    has_vitals: bool
    has_labs: bool
    has_prior_history: bool
    has_notes: bool
    n_labs_present: int
    n_prior_ccsr: int
    minimum_signal_met: bool
    calibration_validity: Literal["full", "reduced"]


class AssessResponse(BaseModel):
    request_id: str
    generated_at: datetime
    schema_version: str = "1.0"
    disclaimer: str = "Decision support only — assistive and calibrated, not autonomous diagnosis."
    differential: ModelOutcome
    mortality: ModelOutcome
    icu: ModelOutcome
    readmission: ModelOutcome
    los: ModelOutcome
    feature_coverage: FeatureCoverage
    warnings: list[str] = Field(default_factory=list)


# --- extraction (§4; stub today) -------------------------------------------


class FieldConfidence(BaseModel):
    field: str
    value: Any
    confidence: float
    needs_confirmation: bool
    source_span: str | None = None
    mapping: dict | None = None


class ExtractionRequest(Strict):
    text: str = Field(min_length=1, max_length=20_000)
    confirmed: bool = False


class ExtractionResponse(BaseModel):
    features: IntakeFeatures
    fields: list[FieldConfidence]
    ask_back: list[str] = Field(default_factory=list)
    unresolved: list[str] = Field(default_factory=list)
    model_status: str = "stub"
    model_config = ConfigDict(protected_namespaces=())
