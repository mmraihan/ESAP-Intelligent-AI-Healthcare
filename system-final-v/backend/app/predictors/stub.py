"""Deterministic stub predictors.

These are **not** the trained models, and every response says so:
`ModelOutcome.status == "stub"` with a `reason`. They exist so the whole system
— intake, assess, explain, acknowledge, release — runs end-to-end without the
DUA-restricted artifacts. `MODEL_MODE=real` swaps in `real.py` with no change
to the API.

Two properties are deliberate rather than incidental:

1. **The stub is an actual linear model.** Each outcome is a weighted sum of
   named intake features through a logistic link. That makes the `exact-linear`
   explanation it returns *true of the thing that produced the number*
   (contribution = coef x value, sum + intercept = logit, self-checked), instead
   of a plausible-looking list attached to an opaque score. A fabricated
   explanation is worse than none: it teaches the clinician to trust a rationale
   that nothing generated.

2. **Missingness is modelled, not imputed away.** A missing dense feature is
   filled with a population stand-in and flagged, which is what drives
   `calibration_validity = "reduced"` and the §3.1 badge hard-suppress. That is
   the same failure mode the real M-01 bundle has (it ships no train medians),
   so the UI exercises the honest path.

Weights are fixed constants chosen for clinical plausibility of *direction*
(age raises mortality, a normal BP does not). Their magnitudes are arbitrary
and no number here should be read as evidence about anything.
"""

from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass

from ..catalogs import MEDS as _MED_SET
from ..catalogs import ccsr_index, lab_label
from ..schemas.clinical import (
    DifferentialItem,
    DifferentialResult,
    Explanation,
    ExplanationContributor,
    ExplanationRationale,
    FeatureCoverage,
    IntakeFeatures,
    LOSResult,
    ModelOutcome,
    ReadmissionResult,
    RiskResult,
)

STUB_REASON = "MODEL_MODE=stub — deterministic placeholder, not a trained artifact"
VERSION = "stub-1.0.0"

# Population stand-ins for absent dense features. Using one of these is what
# makes a case's calibration "reduced" — see `DenseValue.imputed`.
POPULATION = {
    "age": 62.0,
    "bp_sys": 128.0,
    "bp_dia": 74.0,
    "bmi": 27.5,
    "creatinine": 1.0,
    "wbc": 8.0,
    "hemoglobin": 13.0,
    "lactate": 1.2,
    "sodium": 139.0,
}

# Approximate population spread per feature. Contributions are computed on
# (value - population) / scale, so every coefficient below is "per standard
# deviation" and no single feature can saturate the logit just by being
# measured in large units (sodium in mEq/L vs creatinine in mg/dL).
SCALE = {
    "age": 18.0,
    "bp_sys": 22.0,
    "bp_dia": 14.0,
    "bmi": 6.0,
    "creatinine": 0.9,
    "wbc": 4.5,
    "hemoglobin": 2.2,
    "lactate": 1.4,
    "sodium": 5.0,
    "_via_ed": 1.0,
    "_prior_ccsr": 3.0,
    "_n_prior": 2.5,
    "_charlson": 2.5,
}

# itemids of the labs the stub reads, so a case supplying other labs still
# counts them for coverage without inventing a coefficient for them.
LAB_ITEMIDS = {
    "creatinine": "50912",
    "wbc": "51301",
    "hemoglobin": "51222",
    "lactate": "50813",
    "sodium": "50983",
}


@dataclass
class DenseValue:
    name: str
    label: str
    value: float
    imputed: bool
    display: str


def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    e = math.exp(x)
    return e / (1.0 + e)


def build_dense(features: IntakeFeatures) -> list[DenseValue]:
    """The dense feature block, with each slot marked present or imputed."""
    v = features.vitals
    labs = features.labs

    def vital(name: str, raw: float | None, label: str, unit: str) -> DenseValue:
        if raw is None:
            return DenseValue(name, label, POPULATION[name], True, "not recorded")
        return DenseValue(name, label, float(raw), False, f"{raw:g} {unit}".strip())

    out = [
        vital("age", float(features.demographics.admission_age), "Age", "years"),
        vital("bp_sys", v.bp_sys, "Systolic BP", "mm Hg"),
        vital("bp_dia", v.bp_dia, "Diastolic BP", "mm Hg"),
        vital("bmi", v.bmi, "BMI", ""),
    ]
    for name, itemid in LAB_ITEMIDS.items():
        raw = labs.get(itemid)
        label = lab_label(itemid)
        if raw is None:
            out.append(DenseValue(name, label, POPULATION[name], True, "not recorded"))
        else:
            out.append(DenseValue(name, label, float(raw), False, f"{raw:g}"))
    return out


# --- the linear cores -------------------------------------------------------
# name -> coefficient per standard deviation. Directions are clinically
# conventional (age raises mortality, a normal BP does not); magnitudes are
# arbitrary and carry no evidentiary weight.
#
# Each core carries a damping factor chosen so a deliberately extreme case
# lands at a plausible probability instead of pinning at ~1.0. A model that
# answers 0.99 for every sick-looking patient has stopped discriminating, and
# its calibration curve would be nonsense — which would make the calibration
# badges this system is built around meaningless in the demo.


def _core(damping: float, **weights: float) -> dict[str, float]:
    return {name: round(w * damping, 4) for name, w in weights.items()}


MORTALITY_W = _core(
    0.45,
    age=0.55, bp_sys=-0.30, bp_dia=-0.10, bmi=-0.12,
    creatinine=0.45, wbc=0.25, hemoglobin=-0.28, lactate=0.75, sodium=-0.18,
    _via_ed=0.35, _prior_ccsr=0.20, _n_prior=0.18, _charlson=0.40,
)
MORTALITY_B = -3.9   # a typical admission sits near a 2% in-hospital rate

ICU_W = _core(
    0.50,
    age=0.15, bp_sys=-0.40, bp_dia=-0.15, bmi=0.05,
    creatinine=0.35, wbc=0.30, hemoglobin=-0.20, lactate=0.85, sodium=-0.15,
    _via_ed=0.62, _prior_ccsr=0.12, _n_prior=0.10, _charlson=0.28,
)
ICU_B = -1.9

READMIT_W = _core(
    0.45,
    age=0.18, bp_sys=-0.05, bp_dia=-0.03, bmi=0.08,
    creatinine=0.22, wbc=0.06, hemoglobin=-0.18, lactate=0.12, sodium=-0.05,
    _via_ed=0.14, _prior_ccsr=0.35, _n_prior=0.48, _charlson=0.30,
)
READMIT_B = -1.9

LOS_W = _core(
    0.35,  # log1p(days)
    age=0.07, bp_sys=-0.04, bp_dia=-0.02, bmi=0.03,
    creatinine=0.10, wbc=0.08, hemoglobin=-0.06, lactate=0.14, sodium=-0.04,
    _via_ed=0.18, _prior_ccsr=0.09, _n_prior=0.08, _charlson=0.12,
)
LOS_B = 1.45   # expm1(1.45) ~ 3.3 days for a typical admission


def _context_values(features: IntakeFeatures) -> list[DenseValue]:
    ph = features.prior_history
    ctx = features.admission_context
    via = 1.0 if ctx.via_ed else 0.0
    return [
        DenseValue("_via_ed", "Arrived via emergency department", via, ctx.via_ed is None,
                   "yes" if via else ("not recorded" if ctx.via_ed is None else "no")),
        DenseValue("_prior_ccsr", "Prior conditions on record", float(len(ph.prior_ccsr)), False,
                   f"{len(ph.prior_ccsr)} coded"),
        DenseValue("_n_prior", "Previous admissions", float(ph.n_prior_admissions), False,
                   f"{ph.n_prior_admissions}"),
        DenseValue("_charlson", "Charlson comorbidity index",
                   float(ph.charlson_index if ph.charlson_index is not None else 1.0),
                   ph.charlson_index is None,
                   "not recorded" if ph.charlson_index is None else str(ph.charlson_index)),
    ]


def _centered(dv: DenseValue) -> float:
    """Standardise: centre on the population value, divide by its spread.

    A typical patient then sits at the intercept, and a contribution reads as
    "how far this patient is from typical, in standard deviations" — comparable
    across features measured in different units.
    """
    base = POPULATION.get(dv.name, 0.0)
    return (dv.value - base) / SCALE.get(dv.name, 1.0)


def _linear(values: list[DenseValue], weights: dict[str, float], bias: float):
    total = bias
    contributions: list[tuple[DenseValue, float]] = []
    for dv in values:
        w = weights.get(dv.name)
        if w is None:
            continue
        c = w * _centered(dv)
        total += c
        contributions.append((dv, c))
    return total, contributions


def _explanation(
    contributions, *, basis: str, logit: float, bias: float, caveats: list[str], top_k: int = 6
) -> Explanation:
    ranked = sorted(contributions, key=lambda t: abs(t[1]), reverse=True)[:top_k]
    tops = [
        ExplanationContributor(
            feature=dv.name.lstrip("_"),
            human_label=dv.label,
            patient_value=None if dv.imputed else dv.value,
            value_display=dv.display,
            direction="increases" if c >= 0 else "decreases",
            contribution=round(c, 4),
            from_missing=dv.imputed,
        )
        for dv, c in ranked
    ]
    reconstructed = bias + sum(c for _, c in contributions)
    up = [t.human_label.lower() for t in tops if t.direction == "increases"][:2]
    down = [t.human_label.lower() for t in tops if t.direction == "decreases"][:2]
    parts = []
    if up:
        parts.append("raised mainly by " + " and ".join(up))
    if down:
        parts.append("lowered by " + " and ".join(down))
    text = "Relative to a typical admission, this estimate is " + "; ".join(parts) + "." if parts else \
        "This patient sits close to the population average on every feature the model reads."

    return Explanation(
        method="exact-linear",
        basis=basis,
        top_contributors=tops,
        caveats=caveats,
        rationale=ExplanationRationale(text=text, generated=True, grounded_on="top_contributors"),
        reconstruction_ok=abs(reconstructed - logit) < 1e-9,
    )


def _percentile(p: float, anchor: float) -> int:
    """Where this probability sits in the population, the primary display.

    A crude monotone map from probability to percentile against a population
    anchor rate — enough to order patients honestly; it is not a calibrated
    population quantile and the stub reason says so.
    """
    ratio = p / max(anchor, 1e-6)
    pct = 100.0 * (1.0 - math.exp(-0.85 * ratio))
    return max(1, min(99, int(round(pct))))


def _caveats(dense: list[DenseValue], extra: list[str] | None = None) -> list[str]:
    out = list(extra or [])
    missing = [d.label for d in dense if d.imputed]
    if missing:
        out.append(
            "Filled with a population stand-in (not this patient): " + ", ".join(missing[:6]) + "."
        )
    out.append(STUB_REASON)
    return out


# --- per-model entry points -------------------------------------------------


def _outcome(model_id: str, result, explanation, started: float) -> ModelOutcome:
    return ModelOutcome(
        model_id=model_id,
        status="stub",
        model_version=VERSION,
        result=result.model_dump() if result is not None else None,
        latency_ms=round((time.perf_counter() - started) * 1000, 3),
        reason=STUB_REASON,
        explanation=explanation,
    )


def mortality(features: IntakeFeatures) -> ModelOutcome:
    t = time.perf_counter()
    dense = build_dense(features)
    values = dense + _context_values(features)
    logit, contribs = _linear(values, MORTALITY_W, MORTALITY_B)
    p = _sigmoid(logit)
    result = RiskResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, 0.021),
        calibrated=True,  # M-02..M-05 keep native missingness; §3.1 does not suppress them
        threshold=0.0204,
        flag=None,  # null unless screening_mode is explicitly enabled
        operating_point="sensitivity@0.80 (screening only)",
    )
    expl = _explanation(
        contribs, basis="Logistic model over intake-only features, cut at t0.",
        logit=logit, bias=MORTALITY_B,
        caveats=_caveats(dense, ["Screening operating point — not a per-patient flag."]),
    )
    return _outcome("M-02", result, expl, t)


def icu(features: IntakeFeatures) -> ModelOutcome:
    t = time.perf_counter()
    dense = build_dense(features)
    values = dense + _context_values(features)
    logit, contribs = _linear(values, ICU_W, ICU_B)
    p = _sigmoid(logit)
    result = RiskResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, 0.15),
        calibrated=True,
        threshold=0.1609,
        flag=None,
        operating_point="sensitivity@0.80 (screening only)",
    )
    expl = _explanation(
        contribs, basis="Logistic model over intake-only features, cut at t0.",
        logit=logit, bias=ICU_B, caveats=_caveats(dense),
    )
    return _outcome("M-03", result, expl, t)


def readmission(features: IntakeFeatures, frame: str = "intake") -> ModelOutcome:
    t = time.perf_counter()
    dense = build_dense(features)
    values = dense + _context_values(features)
    logit, contribs = _linear(values, READMIT_W, READMIT_B)
    p = _sigmoid(logit)
    result = ReadmissionResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, 0.13),
        calibrated=True,
        threshold=None,
        flag=None,
        operating_point="precision@top-decile (alert budget)",
        frame=frame,  # type: ignore[arg-type]
        alert_budget="precision@top-decile",
        top_decile_flag=p >= 0.28,
        lace_score=None,  # discharge frame only, and that needs post-t0 fields
    )
    expl = _explanation(
        contribs, basis="Logistic model, intake frame — discharge features are excluded by construction.",
        logit=logit, bias=READMIT_B,
        caveats=_caveats(dense, ["Top-decile is a budget for how many alerts fire, not a verdict on this patient."]),
    )
    return _outcome("M-04", result, expl, t)


def los(features: IntakeFeatures) -> ModelOutcome:
    """Length of stay as a conformal interval.

    The interval is the primary object and the point estimate is secondary —
    with R^2 near zero, a single number would imply a precision the model does
    not have. Margins are asymmetric in log1p space (a wider upper margin is
    what covers the long-stay tail), matching the shipped M-05 bundle's
    `conformal_mode: "asymmetric"`.
    """
    t = time.perf_counter()
    dense = build_dense(features)
    values = dense + _context_values(features)
    med_log, contribs = _linear(values, LOS_W, LOS_B)

    q_lo_log, q_hi_log = med_log - 0.25, med_log + 0.42  # the 3 quantiles, log1p space
    margin_lo, margin_hi = 0.1137, 0.9196  # per-side conformal margins, log1p space
    low = max(0.0, math.expm1(q_lo_log - margin_lo))
    high = math.expm1(q_hi_log + margin_hi)

    result = LOSResult(
        interval_low=round(low, 2),
        interval_high=round(high, 2),
        point_days=round(math.expm1(med_log), 2),
        level=0.95,
        coverage=0.953,           # pooled
        tail_coverage_reduced=True,  # D10 covers 0.824 — never badge a flat 95%
        low_signal=True,             # R^2 ~ 0.00 on intake-only features
    )
    expl = _explanation(
        contribs, basis="Quantile model on log1p(days) with an asymmetric split-conformal interval.",
        logit=med_log, bias=LOS_B,
        caveats=_caveats(dense, [
            "Low predictive signal: intake-only length of stay explains very little variance.",
            "Coverage shown is pooled; the longest-stay decile is covered below the nominal level.",
        ]),
    )
    return _outcome("M-05", result, expl, t)


def _label_weight(ccsr: str, feature: str) -> float:
    """A fixed pseudo-weight per (label, feature).

    Derived from a hash so it is stable across processes and machines without
    shipping a 502 x N weight table. It is a placeholder, not a trained value.
    """
    h = hashlib.sha256(f"{ccsr}|{feature}".encode()).digest()
    raw = int.from_bytes(h[:4], "big") / 0xFFFFFFFF
    return (raw - 0.5) * 0.6


def differential(features: IntakeFeatures, top_n: int = 10) -> ModelOutcome:
    t = time.perf_counter()
    dense = build_dense(features)
    values = dense + _context_values(features)
    index = ccsr_index()
    prior = set(features.prior_history.prior_ccsr)

    scored: list[tuple[float, DifferentialItem, Explanation]] = []
    for code, meta in index.items():
        weights = {dv.name: _label_weight(code, dv.name) for dv in values}
        bias = -1.2 + _label_weight(code, "_bias")
        if code in prior:
            # A condition already on the problem list is far likelier to be
            # active now. This is history at t0, not the admission's own coding.
            bias += 1.6
        logit, contribs = _linear(values, weights, bias)
        p = _sigmoid(logit)
        item = DifferentialItem(
            ccsr=code,
            probability=round(p, 4),
            family=meta["family"],
            calibrated=True,  # may be hard-suppressed below
            from_unconfirmed_extraction=False,
        )
        expl = _explanation(
            contribs, basis=f"Per-label linear model for {meta['description']}.",
            logit=logit, bias=bias, caveats=_caveats(dense), top_k=4,
        )
        scored.append((p, item, expl))

    scored.sort(key=lambda s: s[0], reverse=True)
    top = scored[:top_n]
    for _, item, expl in top:
        item.explanation = expl

    unmatched = [c for c in prior if c not in index]
    result = DifferentialResult(
        items=[item for _, item, _ in top],
        top_n=top_n,
        fusion_status="tower_a_only",
        towers_used=["A"],
        tower_contributions={"A": round(top[0][0], 4) if top else None, "B": None, "C": None},
        # Labels the stub carries no weights for can never rank: a blind spot
        # the clinician is told about rather than one the ranking hides.
        unscored_ccsr_count=max(0, 502 - len(index)),
        unmatched_ccsr=sorted(unmatched),
        unmatched_meds=sorted(
            m for m in features.meds
            if m.strip().lower() not in {x.lower() for x in _MED_SET}
        ),
    )
    return _outcome("M-01", result, None, t)


def coverage(features: IntakeFeatures) -> tuple[FeatureCoverage, list[str]]:
    """Feature coverage and the warnings the UI surfaces.

    `calibration_validity` is "reduced" exactly when the M-01 path imputed at
    least one dense feature, which is the §3.1 trigger for suppressing the
    calibrated badge on every differential row.
    """
    dense = build_dense(features)
    imputed = [d for d in dense if d.imputed]
    v = features.vitals
    has_vitals = any(x is not None for x in (v.bmi, v.weight_kg, v.height_cm, v.bp_sys, v.bp_dia))
    n_labs = len(features.labs)
    n_prior = len(features.prior_history.prior_ccsr)
    has_notes = features.notes is not None and any(
        getattr(features.notes, f) for f in features.notes.model_fields
    )
    minimum_signal = has_vitals or n_labs > 0 or n_prior > 0

    fc = FeatureCoverage(
        has_vitals=has_vitals,
        has_labs=n_labs > 0,
        has_prior_history=n_prior > 0,
        has_notes=bool(has_notes),
        n_labs_present=n_labs,
        n_prior_ccsr=n_prior,
        minimum_signal_met=minimum_signal,
        calibration_validity="reduced" if imputed else "full",
    )

    warnings: list[str] = []
    if imputed:
        warnings.append(
            "calibration_validity=reduced: "
            f"{len(imputed)} feature(s) imputed at serve time "
            "(population stand-in) -> M-01 'calibrated' badge suppressed on all rows"
        )
    if not minimum_signal:
        warnings.append(
            "minimum signal not met: no vitals, labs or prior history — outputs are a "
            "population baseline, not a patient-specific estimate"
        )
    if n_prior == 0:
        warnings.append("cold-start: no prior history on record")
    if 0 < n_labs < 6:
        warnings.append(f"labs coverage low ({n_labs} of the intake panel)")
    if not has_notes:
        warnings.append("no admission note supplied — Tower B would have nothing to read")
    return fc, warnings
