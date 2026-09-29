"""Assemble one AssessResponse from the five model outcomes.

Two rules live here rather than in any single predictor, because they are
properties of the *case* and not of a model:

1. **`/assess` always returns 200 for a well-formed request.** A model that
   raises is carried as `status:"error"` inside its own `ModelOutcome`, so the
   other gauges still render. A 500 would blank a screen that had four working
   answers on it.

2. **The §3.1 calibration hard-suppress.** When the M-01 path imputed a dense
   feature, `feature_coverage.calibration_validity` is "reduced" and *every*
   differential row's `calibrated` flips to False, whatever that label's own
   calibration method says. Never badge "calibrated" over a known calibrator
   mismatch. M-02..M-05 keep missingness native and are not suppressed.
"""

from __future__ import annotations

import uuid

from . import predictors
from .schemas.clinical import AssessResponse, IntakeRequest, ModelOutcome
from .security import iso, utcnow


def _safe(fn, model_id: str, *args, **kwargs) -> ModelOutcome:
    try:
        return fn(*args, **kwargs)
    except Exception as exc:  # noqa: BLE001 - deliberate: one model must not sink the response
        return ModelOutcome(
            model_id=model_id,
            status="error",
            model_version="unknown",
            result=None,
            error=f"{type(exc).__name__}: {exc}",
            latency_ms=0.0,
        )


def assess(req: IntakeRequest, *, top_n: int = 10, frame: str = "intake") -> AssessResponse:
    p = predictors.backend()
    features = req.features

    try:
        fc, warnings = p.coverage(features)
    except Exception as exc:  # noqa: BLE001
        # Without coverage we cannot honestly state calibration validity, so the
        # safe answer is the conservative one: assume reduced and say why.
        from .schemas.clinical import FeatureCoverage

        fc = FeatureCoverage(
            has_vitals=False, has_labs=False, has_prior_history=False, has_notes=False,
            n_labs_present=0, n_prior_ccsr=0, minimum_signal_met=False,
            calibration_validity="reduced",
        )
        warnings = [f"feature coverage unavailable ({type(exc).__name__}) — treating calibration as reduced"]

    differential = _safe(p.differential, "M-01", features, top_n)
    mortality = _safe(p.mortality, "M-02", features)
    icu = _safe(p.icu, "M-03", features)
    readmission = _safe(p.readmission, "M-04", features, frame)
    los = _safe(p.los, "M-05", features)

    if fc.calibration_validity == "reduced" and differential.result:
        for item in differential.result.get("items", []):
            item["calibrated"] = False

    # Anything the clinician did not confirm taints the rows it drove (§4).
    unconfirmed = set(req.provenance.needs_confirmation)
    if unconfirmed and differential.result:
        touches_history = any(f.startswith("prior_history") or f.startswith("coded_sequence")
                              for f in unconfirmed)
        if touches_history:
            for item in differential.result.get("items", []):
                item["from_unconfirmed_extraction"] = True
            warnings.append(
                "differential includes signal from extracted history the clinician has not confirmed"
            )

    return AssessResponse(
        request_id=req.request_id or str(uuid.uuid4()),
        generated_at=utcnow(),
        differential=differential,
        mortality=mortality,
        icu=icu,
        readmission=readmission,
        los=los,
        feature_coverage=fc,
        warnings=warnings,
    )


#: The AssessResponse attribute name for each model id.
_MODEL_ATTR = {"M-01": "differential", "M-02": "mortality", "M-03": "icu",
               "M-04": "readmission", "M-05": "los"}


def merge_unit_override(policy: dict, unit_id: str | None) -> dict:
    """Fold a unit's model-display override into the tenant-wide policy.

    Settings → Model display lets an admin suppress a model on one unit (an
    ICU-admission estimate on a patient already in the ICU is noise, not
    signal) without turning it off hospital-wide. That per-unit map
    (``unitOverrides``) was being saved but never read anywhere the display
    policy is actually applied — every gauge showed regardless of the unit
    override. This is where it is honoured: for this one response, a model the
    unit suppressed is turned off the same way a tenant-wide toggle would.
    """
    if not policy or not unit_id:
        return policy
    overrides = (policy.get("unitOverrides") or {}).get(unit_id)
    if not overrides:
        return policy
    merged = dict(policy)
    enabled = dict(policy.get("enabled") or {})
    for model_id in overrides:
        enabled[model_id] = False
    merged["enabled"] = enabled
    return merged


def apply_display_policy(response: AssessResponse, policy: dict) -> AssessResponse:
    """Apply a tenant's Settings → Model display policy to a fresh AssessResponse.

    This runs at the serving boundary (the /assess route), never inside a
    predictor, because it is a per-tenant *display* decision, not a property of
    the model:

    * A model turned off for the tenant (``enabled[id] == False``) has its gauge
      withheld: the outcome is returned with ``status="suppressed"`` and no
      result, so no probability for it ever reaches a screen here.
    * CCSR categories the tenant suppressed (e.g. an ethics-committee decision
      not to surface behavioural-health codes from a model) are removed from the
      M-01 differential, with the unscored count adjusted so a dropped row is
      never silently read as "ruled out".
    * The differential is capped to ``differentialTopN``.

    Nothing here weakens a safety signal: calibration, the Why panel and the
    degraded label are untouched on whatever remains visible.
    """
    if not policy:
        return response

    enabled = policy.get("enabled", {}) or {}
    for model_id, attr in _MODEL_ATTR.items():
        if enabled.get(model_id, True) is False:
            outcome: ModelOutcome = getattr(response, attr)
            outcome.status = "suppressed"
            outcome.result = None
            outcome.explanation = None
            outcome.error = None
            outcome.reason = "Turned off for this site in Settings → Model display."

    suppressed = {c.get("ccsr") for c in (policy.get("suppressedCategories") or []) if c.get("ccsr")}
    top_n = policy.get("differentialTopN")
    diff = response.differential
    if diff.result and diff.status != "suppressed":
        items = diff.result.get("items", [])
        if suppressed:
            kept = [i for i in items if i.get("ccsr") not in suppressed]
            dropped = len(items) - len(kept)
            if dropped:
                # A suppressed row was in contention; keep the "never ruled out"
                # accounting honest by folding it into the unscored tally.
                diff.result["unscored_ccsr_count"] = int(diff.result.get("unscored_ccsr_count", 0)) + dropped
            items = kept
        if isinstance(top_n, int) and top_n > 0:
            items = items[:top_n]
            diff.result["top_n"] = min(diff.result.get("top_n", top_n), top_n)
        diff.result["items"] = items
    return response


def apply_entitlements(response: AssessResponse, allowed_models: set) -> AssessResponse:
    """Withhold any model the tenant's plan does not include (§17).

    Distinct from the display policy: that is an admin toggle within the plan;
    this is the plan boundary itself. A model outside the plan comes back
    ``status="suppressed"`` with a reason that points at the plan, so "Free" and
    "Enterprise" are no longer the same product once signed in.
    """
    for model_id, attr in _MODEL_ATTR.items():
        if model_id not in allowed_models:
            outcome: ModelOutcome = getattr(response, attr)
            if outcome.status == "suppressed":
                continue
            outcome.status = "suppressed"
            outcome.result = None
            outcome.explanation = None
            outcome.error = None
            outcome.reason = "Not included in this plan."
    return response


def worklist_patch(response: AssessResponse) -> dict:
    """The denormalised fields the worklist row carries, from a fresh assess.

    The worklist shows headline risks so it does not have to hold a full
    AssessResponse per patient; this keeps that copy derived from the response
    rather than recomputed, so the two can never disagree.
    """
    def result(outcome: ModelOutcome) -> dict:
        return outcome.result or {}

    diff = result(response.differential)
    los = result(response.los)
    from .catalogs import ccsr_name

    top = [
        {
            "ccsr": i["ccsr"],
            "name": ccsr_name(i["ccsr"]),
            "family": i["family"],
            "probability": i["probability"],
        }
        for i in diff.get("items", [])[:5]
    ]
    fc = response.feature_coverage
    present = sum([fc.has_vitals, fc.has_labs, fc.has_prior_history, fc.has_notes])

    return {
        "state": "assessed",
        "risks": {
            "mortality": result(response.mortality).get("probability"),
            "icu": result(response.icu).get("probability"),
            "readmission": result(response.readmission).get("probability"),
            "losLow": los.get("interval_low"),
            "losHigh": los.get("interval_high"),
        },
        "topDifferential": top,
        "calibrated": fc.calibration_validity == "full",
        "calibrationValidity": fc.calibration_validity,
        "signalCompleteness": round(present / 4, 2),
        "hasNotes": fc.has_notes,
        "hasPriorHistory": fc.has_prior_history,
        "lastAssessedAt": iso(response.generated_at),
    }
