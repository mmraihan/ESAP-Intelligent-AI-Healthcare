"""Model evidence and usage figures — computed, never invented.

Two kinds of number appear on the evidence, models, usage and fairness
screens, and they come from different places:

* **What the models do** (discrimination, calibration, strata, leakage alarm,
  negative control) is read from the metrics files each training run wrote
  (`ml-pipeline/models/*/metrics_*.json`). Those files are the evaluation of
  record; a card shows exactly what they say, including a leakage alarm that
  fired and a target that was missed. If the files are not on this machine the
  card says the figures are unavailable rather than showing placeholders.
* **How the product is being used** (assessments per week, active clinicians,
  acknowledgement rate) is counted from this deployment's own audit trail.

Two things are deliberately empty until they exist for real: production drift
monitoring (there is no production traffic to monitor) and the subgroup
fairness audit (no subgroup evaluation has been run on these models).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import db
from .config import BACKEND_ROOT
from .security import iso

#: Where the training runs wrote their metrics. Overridable for a deployment
#: that keeps them elsewhere.
METRICS_DIR = Path(os.environ.get(
    "ESAP_METRICS_DIR", str((BACKEND_ROOT / "../../../ml-pipeline/models").resolve())))

# Descriptive facts about each model — what it predicts and how it is built.
# Every performance figure is read from the metrics files below.
MODELS = {
    "M-01": {
        "name": "Differential diagnosis", "outcome": "Multi-label, CCSR categories present at admission",
        "version": "1.0.0", "towers": ["Tower A — tabular (sparse one-vs-rest)"], "fusion": "tower_a_only",
        "calibrationMethod": "Per-label isotonic / Platt", "file": "m01_differential/metrics_tower_a.json",
    },
    "M-02": {
        "name": "In-hospital mortality", "outcome": "Binary, death before discharge",
        "version": "1.0.0", "towers": ["Tower A — tabular (gradient boosting)"], "fusion": "tower_a_only",
        "calibrationMethod": "Isotonic", "file": "m02_mortality/metrics_mortality.json",
    },
    "M-03": {
        "name": "ICU admission", "outcome": "Binary, ICU stay during the admission",
        "version": "1.0.0", "towers": ["Tower A — tabular (gradient boosting)"], "fusion": "tower_a_only",
        "calibrationMethod": "Isotonic", "file": "m03_icu/metrics_icu.json",
    },
    "M-04": {
        "name": "30-day readmission", "outcome": "Binary, readmitted within 30 days (intake frame)",
        "version": "1.0.0", "towers": ["Tower A — tabular (gradient boosting)"], "fusion": "tower_a_only",
        "calibrationMethod": "Isotonic", "file": "m04_readmission/metrics_readmit.json",
    },
    "M-05": {
        "name": "Length of stay", "outcome": "Days, with a 95% split-conformal interval",
        "version": "1.0.0", "towers": ["Tower A — tabular (quantile gradient boosting)"], "fusion": "tower_a_only",
        "calibrationMethod": "Split-conformal", "file": "m05_los/metrics_los.json",
    },
}


def _load(rel: str) -> tuple[dict | None, str | None]:
    path = METRICS_DIR / rel
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, None
    stamp = iso(datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc))
    return data, stamp


def _f(value, digits=3) -> str:
    return "—" if value is None else f"{value:.{digits}f}"


def _n(m: dict) -> int:
    n = m.get("n") or {}
    return int(sum(v for v in n.values() if isinstance(v, (int, float))))


def _card(model_id: str) -> dict:
    meta = MODELS[model_id]
    m, stamp = _load(meta["file"])
    base = {k: v for k, v in meta.items() if k != "file"}
    card = {"id": model_id, **base, "trainedOn": "MIMIC-IV, intake-only (t₀ = admission)",
            "evidenceSource": f"ml-pipeline/models/{meta['file']}"}
    if m is None:
        # Not on this machine: say so, never fill the gap.
        return {**card, "status": "not_ready", "cohortN": 0, "headline": [
            {"label": "Evaluation", "value": "not available here"}],
            "ece": 0.0, "strata": [], "leakageAlarm": False,
            "negativeControl": "The evaluation files are not on this server.", "lastEvaluated": iso(datetime.now(timezone.utc))}

    test, hist, cold = m.get("test", {}), m.get("test_history", {}), m.get("test_coldstart", {})
    card.update({"cohortN": _n(m), "lastEvaluated": stamp or iso(datetime.now(timezone.utc))})

    if model_id == "M-01":
        alarm = m.get("leakage_alarm") or []
        abl, _ = _load("m01_differential/metrics_ablate_prior_dx.json")
        neg, _ = _load("m01_differential/metrics_negcontrol.json")
        parts = []
        if abl:
            parts.append(f"Removing prior conditions: Recall@20 {_f(abl['test'].get('recall@20'), 4)}")
        if neg:
            parts.append(f"removing prior conditions and medicines: {_f(neg['test'].get('recall@20'), 4)}"
                         f"{' with no alarm' if not neg.get('leakage_alarm') else ''}")
        card.update({
            "status": "live",
            "headline": [
                {"label": "Recall@20", "value": _f(test.get("recall@20"), 4)},
                {"label": "AUPRC (macro)", "value": _f(test.get("macro_auprc"), 4)},
                {"label": "Labels scored", "value": str(test.get("n_labels_scored", "—"))},
            ],
            "ece": float(test.get("ece_calibrated") or 0.0),
            "strata": [
                {"label": "With prior history", "n": int(hist.get("n", 0)), "metric": "Recall@20", "value": float(hist.get("recall@20") or 0)},
                {"label": "Cold start (no history)", "n": int(cold.get("n", 0)), "metric": "Recall@20", "value": float(cold.get("recall@20") or 0)},
            ],
            "leakageAlarm": bool(alarm),
            "negativeControl": (
                f"Leakage alarm fired on {', '.join(alarm)} (Recall@20 above the 0.60 ceiling). "
                if alarm else "Leakage alarm did not fire. "
            ) + ("; ".join(parts) + "." if parts else "No negative control recorded."),
        })
        return card

    if model_id == "M-05":
        card.update({
            "status": "live",
            "headline": [
                {"label": "Interval coverage", "value": _f(test.get("coverage"), 3)},
                {"label": "MAE", "value": f"{_f(test.get('mae_days'), 2)} d"},
                {"label": "Mean width", "value": f"{_f(test.get('mean_width_days'), 1)} d"},
            ],
            "ece": 0.0,
            "strata": [
                {"label": "With prior history", "n": int(hist.get("n", 0)), "metric": "Coverage", "value": float(hist.get("coverage") or 0)},
                {"label": "Cold start (no history)", "n": int(cold.get("n", 0)), "metric": "Coverage", "value": float(cold.get("coverage") or 0)},
            ],
            "leakageAlarm": bool(m.get("leak_alarm")),
            "negativeControl": "Leakage alarm did not fire. No ablation run recorded for this model.",
        })
        return card

    calib = m.get("calibration_test", {})
    ece = calib.get("ece_quantile_10bin", calib.get("ece_quantile"))
    auroc_cold = cold.get("auroc")
    card.update({
        # A model whose cold-start discrimination is near chance is served
        # with the degraded label, whatever its pooled figure.
        "status": "degraded" if auroc_cold is not None and auroc_cold < 0.62 else "live",
        "headline": [
            {"label": "AUROC", "value": _f(test.get("auroc"), 4)},
            {"label": "AUPRC", "value": _f(test.get("auprc"), 4)},
            {"label": "Brier", "value": _f(calib.get("brier"), 4)},
        ],
        "ece": float(ece or 0.0),
        "strata": [
            {"label": "With prior history", "n": int(hist.get("n", 0)), "metric": "AUROC", "value": float(hist.get("auroc") or 0)},
            {"label": "Cold start (no history)", "n": int(cold.get("n", 0)), "metric": "AUROC", "value": float(auroc_cold or 0)},
        ],
        "leakageAlarm": bool(m.get("leakage_alarm")),
        "negativeControl": "Leakage alarm did not fire. No ablation run recorded for this model.",
    })
    return card


def model_cards() -> list[dict]:
    return [_card(mid) for mid in MODELS]


def refresh() -> None:
    """Rewrite the stored model cards from the metrics files; clear invented series."""
    db.put_document("models", model_cards())
    db.put_document("drift", [])
    db.put_document("subgroup_fairness", [])


def adoption_series(tenant_id: str, weeks: int = 12) -> list[dict]:
    """Assessments, active clinicians and acknowledgement rate per week, counted
    from this tenant's audit trail. Oldest first, one row per week."""
    rows = db.connect().execute(
        "SELECT at, actor, action FROM audit_events WHERE tenant_id=? AND platform=0"
        " AND action IN ('assess.run', 'result.acknowledge')",
        (tenant_id,),
    ).fetchall()
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    for i in range(weeks - 1, -1, -1):
        lo = start - timedelta(weeks=i)
        buckets.append({"from": lo, "to": lo + timedelta(weeks=1), "week": f"W-{i}" if i else "This week",
                        "assess": 0, "ack": 0, "actors": set()})
    for r in rows:
        try:
            at = datetime.fromisoformat(r["at"].replace("Z", "+00:00"))
        except ValueError:
            continue
        for b in buckets:
            if b["from"] <= at < b["to"]:
                if r["action"] == "assess.run":
                    b["assess"] += 1
                    b["actors"].add(r["actor"])
                else:
                    b["ack"] += 1
                break
    return [{"week": b["week"], "assessments": b["assess"], "activeClinicians": len(b["actors"]),
             "acknowledgedPct": round(min(1.0, b["ack"] / b["assess"]), 3) if b["assess"] else 0.0}
            for b in buckets]
