"""Real-artifact adapters — the MODEL_MODE=real path.

Serves the trained bundles in `ESAP_EXPORTS_DIR` (the ml-pipeline
`model_exports/` handoff) behind the same five callables as `stub.py`:

* M-01 Tower A — 459 per-label logistic regressions over a scaled dense block
  plus prior-CCSR and medication multi-hots, each with its own calibrator.
* M-02 mortality, M-03 ICU, M-04 readmission (intake frame) — gradient-boosted
  trees with an isotonic calibrator.
* M-05 length of stay — three quantile regressors in log1p(days) space with a
  split-conformal widening.

Every feature is rebuilt exactly as the training scripts built it, from the
column names the bundle carries, so a bundle with a different layout is read
correctly or refused — never silently misaligned.

What the bundles do not carry lives in `serving_reference.json` beside them,
written by `tools/build_model_reference.py` from the same database and split
the models were trained on:

* the train-split lab winsorisation bounds (p1/p99 per itemid);
* M-01's train-split imputation medians, so a missing value is filled with the
  number training filled it with (calibration stays "full");
* the distribution of calibrated risk on the held-out test split, which is what
  `population_percentile` is read against;
* M-04's top-decile alert threshold and M-05's measured interval coverage.

No fallback to the stub, ever: if a bundle, the reference file, or the library
versions are wrong, `ready()` says so and `/readyz` returns 503.
"""

from __future__ import annotations

import bisect
import hashlib
import json
import math
import pickle
import threading
import time
import warnings
from dataclasses import dataclass, field, replace
from pathlib import Path

from ..catalogs import ccsr_family, ccsr_name, lab_label
from ..config import settings
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

REFERENCE_FILE = "serving_reference.json"

BUNDLES = {
    "M-01": "M01_TowerA_main.pkl",
    "M-02": "M02_Mortality_full.pkl",
    "M-03": "M03_ICU_full.pkl",
    "M-04": "M04_Readmit_intake_full.pkl",
    "M-05": "M05_LOS_full.pkl",
}

# The library versions the bundles were trained and pickled under. A pickle
# loaded under another scikit-learn can predict differently without any error,
# so a mismatch fails readiness instead of serving shifted probabilities.
TRAINED_WITH = {"sklearn": "1.9.0", "numpy": "2.5.1", "scipy": "1.17.1"}

VITALS = ("bmi", "weight_kg", "height_cm", "bp_sys", "bp_dia")

# Out-of-range vitals were nulled (not clipped) in training, per model.
VITAL_RANGES = {
    "M-01": {"bmi": (10.0, 80.0), "weight_kg": (20.0, 300.0), "height_cm": (120.0, 230.0),
             "bp_sys": (40.0, 300.0), "bp_dia": (20.0, 200.0)},
    "default": {"bmi": (8.0, 100.0), "weight_kg": (20.0, 300.0), "height_cm": (120.0, 230.0),
                "bp_sys": (40.0, 300.0), "bp_dia": (20.0, 200.0)},
}
LAB_SIGNED_ITEMIDS = {"50802"}  # base excess: legitimately negative (M-01 cleaning rule)

ADMISSION_TYPES = {
    "EW EMER.", "EU OBSERVATION", "OBSERVATION ADMIT", "URGENT", "SURGICAL SAME DAY ADMISSION",
    "DIRECT OBSERVATION", "DIRECT EMER.", "ELECTIVE", "AMBULATORY OBSERVATION",
}

VITAL_LABEL = {
    "bmi": ("BMI", ""), "weight_kg": ("Weight", "kg"), "height_cm": ("Height", "cm"),
    "bp_sys": ("Systolic BP", "mm Hg"), "bp_dia": ("Diastolic BP", "mm Hg"),
}

class ArtifactsUnavailable(RuntimeError):
    pass


# --- loading ----------------------------------------------------------------


@dataclass
class Loaded:
    bundles: dict[str, dict] = field(default_factory=dict)
    versions: dict[str, str] = field(default_factory=dict)  # model id -> served version string
    reference: dict = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)


_LOCK = threading.Lock()
_STATE: Loaded | None = None


def _library_problems() -> list[str]:
    out = []
    try:
        import numpy
        import scipy
        import sklearn
    except ImportError as exc:
        return [f"scientific stack missing ({exc.name}); install requirements-real.txt"]
    running = {"sklearn": sklearn.__version__, "numpy": numpy.__version__, "scipy": scipy.__version__}
    for lib, want in TRAINED_WITH.items():
        if running[lib] != want:
            out.append(f"{lib} {running[lib]} is running but the bundles were trained with {want}")
    return out


def _load() -> Loaded:
    global _STATE
    if _STATE is not None:
        return _STATE
    with _LOCK:
        if _STATE is not None:
            return _STATE
        state = Loaded()
        root = settings().exports_dir
        if root is None:
            state.problems.append("ESAP_EXPORTS_DIR is not set")
        elif not root.is_dir():
            state.problems.append(f"ESAP_EXPORTS_DIR {root} does not exist")
        state.problems += _library_problems()
        if state.problems:
            _STATE = state
            return state

        from sklearn.exceptions import InconsistentVersionWarning

        for model_id, name in BUNDLES.items():
            path = root / name
            if not path.is_file():
                state.problems.append(f"{model_id}: {name} not found in {root}")
                continue
            raw = path.read_bytes()
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always", InconsistentVersionWarning)
                bundle = pickle.loads(raw)  # noqa: S301 - our own DUA-restricted artifacts, read-only mount
            drift = [w for w in caught if issubclass(w.category, InconsistentVersionWarning)]
            if drift:
                state.problems.append(f"{model_id}: {drift[0].message}")
            state.bundles[model_id] = bundle
            trained = str(bundle.get("trained_at", "unknown"))[:10]
            state.versions[model_id] = f"{trained}+sha256.{hashlib.sha256(raw).hexdigest()[:12]}"

        ref_path = root / REFERENCE_FILE
        if not ref_path.is_file():
            state.problems.append(
                f"{REFERENCE_FILE} not found in {root} (run: python tools/build_model_reference.py)"
            )
        else:
            state.reference = json.loads(ref_path.read_text(encoding="utf-8"))
            for model_id in BUNDLES:
                if model_id not in state.reference:
                    state.problems.append(f"{model_id}: missing from {REFERENCE_FILE}")
                    continue
                digest = state.versions.get(model_id, "").split("sha256.")[-1]
                built_for = state.reference[model_id].get("bundle_sha256", "")[:12]
                if digest and built_for != digest:
                    state.problems.append(
                        f"{model_id}: {REFERENCE_FILE} was built for a different bundle "
                        f"({built_for} vs {digest}); rebuild it"
                    )
        _STATE = state
        return state


def _require(model_id: str) -> tuple[dict, dict, str]:
    state = _load()
    if state.problems:
        raise ArtifactsUnavailable("; ".join(state.problems))
    return state.bundles[model_id], state.reference[model_id], state.versions[model_id]


def ready() -> tuple[bool, list[str]]:
    state = _load()
    return (not state.problems), list(state.problems)


def served_versions() -> dict[str, str]:
    """Model id -> the version string stamped on every outcome it serves."""
    return dict(_load().versions)


def reset() -> None:
    """Forget the loaded bundles (tests; after replacing the export folder)."""
    global _STATE
    with _LOCK:
        _STATE = None


# --- the case, normalised the way training cleaned it -----------------------


@dataclass(frozen=True)
class Case:
    age: float
    is_female: int
    via_ed: int
    vitals: dict[str, float | None]
    labs: dict[str, float]
    prior_ccsr: tuple[str, ...]
    n_prior: int
    charlson: int
    meds: tuple[str, ...]
    adm_type: str
    adm_loc: str


def _case(features: IntakeFeatures, ranges: dict[str, tuple[float, float]]) -> Case:
    v = features.vitals
    vit: dict[str, float | None] = {}
    for name in VITALS:
        raw = getattr(v, name)
        lo, hi = ranges[name]
        vit[name] = float(raw) if raw is not None and lo <= raw <= hi else None
    if vit["bp_sys"] is not None and vit["bp_dia"] is not None and vit["bp_sys"] <= vit["bp_dia"]:
        vit["bp_sys"] = vit["bp_dia"] = None  # transposed reading: training nulled both
    ctx = features.admission_context
    ph = features.prior_history
    return Case(
        age=float(features.demographics.admission_age),
        is_female=int(features.demographics.is_female),
        via_ed=1 if ctx.via_ed else 0,  # training: fillna(False)
        vitals=vit,
        labs={str(k): float(x) for k, x in features.labs.items()},
        prior_ccsr=tuple(ph.prior_ccsr),
        n_prior=int(ph.n_prior_admissions),
        charlson=int(ph.charlson_index or 0),  # training: no prior admission -> 0
        meds=tuple(m.strip().lower() for m in features.meds if m.strip()),
        adm_type=(ctx.admission_type or "OTHER").strip(),
        adm_loc=(ctx.admission_location or "OTHER").strip(),
    )


def _match_meds(meds: tuple[str, ...], vocab: list[str]) -> tuple[list[str], list[str]]:
    """Map entered names onto the training vocabulary (MIMIC `drug_norm` strings).

    Exact match first; otherwise the one vocabulary entry whose base name (the
    text before a bracketed brand, e.g. "metformin (glucophage)") equals it.
    An ambiguous or absent name is reported unmatched, never guessed.
    """
    exact = {entry.strip().lower(): entry for entry in vocab}
    base: dict[str, list[str]] = {}
    for entry in vocab:
        base.setdefault(entry.split(" (")[0].strip().lower(), []).append(entry)
    hit, miss = [], []
    for m in meds:
        if m in exact:
            hit.append(exact[m])
        elif len(base.get(m, [])) == 1:
            hit.append(base[m][0])
        else:
            miss.append(m)
    return hit, miss


def _clean_lab(itemid: str, value: float, bounds: dict[str, list[float]], signed_ok: bool) -> float | None:
    b = bounds.get(itemid)
    if b is not None:
        value = min(max(value, b[0]), b[1])
    if signed_ok:
        return None if (value < 0 and itemid not in LAB_SIGNED_ITEMIDS) else value
    return None if value <= 0 else value


# --- M-02..M-05: gradient-boosted trees -------------------------------------


def _tree_row(case: Case, names: list[str], ref: dict, med_vocab: list[str]) -> list[float]:
    nan = float("nan")
    vals: dict[str, float] = {
        "age": case.age,
        "is_female": float(case.is_female),
        "via_ed": float(case.via_ed),
        "has_history": 1.0 if case.prior_ccsr else 0.0,
        "n_prior_admissions": float(case.n_prior),
        "n_early_labs_drawn": float(len(case.labs)),
        "prior_dx_count": float(len(case.prior_ccsr)),
        "charlson_index": float(case.charlson),
        "meds_count": float(len(case.meds)),
    }
    for name in VITALS:
        x = case.vitals[name]
        vals[name] = nan if x is None else x
        vals[f"{name}_miss"] = 1.0 if x is None else 0.0
    bounds = ref.get("lab_bounds", {})
    for itemid, raw in case.labs.items():
        x = _clean_lab(itemid, raw, bounds, signed_ok=False)
        vals[f"lab_{itemid}"] = nan if x is None else x
    for c in case.prior_ccsr:
        vals[f"pdx_{c}"] = 1.0
    matched, _ = _match_meds(case.meds, med_vocab)
    for m in matched:
        vals[f"med_{m}"] = 1.0

    row = [vals.get(n, nan if n.startswith("lab_") else 0.0) for n in names]

    # Admission type and location one-hots: two blocks, each with its own rare
    # "OTHER" bucket. The type block is the leading run of adm_ columns whose
    # category is an admission type (plus its OTHER, when training kept one).
    blocks: dict[str, dict[str, int]] = {"type": {}, "loc": {}}
    current = "type"
    for i, n in enumerate(names):
        if not n.startswith("adm_"):
            continue
        cat = n[4:]
        if current == "type" and cat not in ADMISSION_TYPES and cat != "OTHER":
            current = "loc"
        blocks[current][cat] = i
        if current == "type" and cat == "OTHER":
            current = "loc"
    for block, value in (("type", case.adm_type), ("loc", case.adm_loc)):
        idx = blocks[block].get(value, blocks[block].get("OTHER"))
        if idx is not None:
            row[idx] = 1.0
    return row


def _tree_predict(bundle: dict, rows: list[list[float]]):
    import numpy as np

    X = np.asarray(rows, dtype=np.float32)
    raw = bundle["model"].predict_proba(X)[:, 1]
    return bundle["calibrator"].predict(raw)


def _med_vocab(names: list[str]) -> list[str]:
    return [n[4:] for n in names if n.startswith("med_")]


def _percentile(p: float, quantiles: list[float]) -> int:
    """Where p sits among the test split's calibrated risks (1..99)."""
    lo = bisect.bisect_left(quantiles, p)
    hi = bisect.bisect_right(quantiles, p)
    pct = 100.0 * ((lo + hi) / 2) / max(len(quantiles) - 1, 1)
    return max(1, min(99, int(round(pct))))


@dataclass
class Occlusion:
    feature: str
    label: str
    display: str
    case: Case


def _occlusions(case: Case, names: set[str]) -> list[Occlusion]:
    """Each input the patient actually has, with a copy of the case without it."""
    out: list[Occlusion] = []
    for name in VITALS:
        x = case.vitals[name]
        if x is not None and name in names:
            label, unit = VITAL_LABEL[name]
            out.append(Occlusion(name, label, f"{x:g} {unit}".strip(),
                                 replace(case, vitals={**case.vitals, name: None})))
    for itemid, x in case.labs.items():
        if f"lab_{itemid}" in names:
            rest = {k: y for k, y in case.labs.items() if k != itemid}
            out.append(Occlusion(f"lab_{itemid}", lab_label(itemid), f"{x:g}", replace(case, labs=rest)))
    if case.via_ed:
        out.append(Occlusion("via_ed", "Arrived via emergency department", "yes", replace(case, via_ed=0)))
    for c in dict.fromkeys(case.prior_ccsr):
        rest = tuple(x for x in case.prior_ccsr if x != c)
        out.append(Occlusion(f"pdx_{c}", f"Prior: {ccsr_name(c)}", c, replace(case, prior_ccsr=rest)))
    if case.n_prior and "n_prior_admissions" in names:
        out.append(Occlusion("n_prior_admissions", "Previous admissions", str(case.n_prior),
                             replace(case, n_prior=0)))
    if case.charlson:
        out.append(Occlusion("charlson_index", "Charlson comorbidity index", str(case.charlson),
                             replace(case, charlson=0)))
    for m in dict.fromkeys(case.meds):
        rest = tuple(x for x in case.meds if x != m)
        out.append(Occlusion(f"med_{m}", f"Medication: {m}", "on list", replace(case, meds=rest)))
    return out


def _occlusion_explanation(
    case: Case, base: float, occl: list[Occlusion], occl_values, *, basis: str, unit: str,
    missing: list[str], extra_caveats: list[str],
) -> Explanation:
    deltas = [(o, float(base - v)) for o, v in zip(occl, occl_values)]
    ranked = sorted((d for d in deltas if abs(d[1]) > 1e-6), key=lambda d: abs(d[1]), reverse=True)[:6]
    tops = [
        ExplanationContributor(
            feature=o.feature, human_label=o.label, patient_value=None, value_display=o.display,
            direction="increases" if d >= 0 else "decreases", contribution=round(d, 5),
            from_missing=False,
        )
        for o, d in ranked
    ]
    up = [t.human_label for t in tops if t.direction == "increases"][:2]
    down = [t.human_label for t in tops if t.direction == "decreases"][:2]
    parts = []
    if up:
        parts.append("pushed up most by " + " and ".join(up))
    if down:
        parts.append("pulled down most by " + " and ".join(down))
    text = ("This estimate is " + "; ".join(parts) + ".") if parts else \
        "No single recorded input moves this estimate on its own; it rests on age, sex and admission route."
    caveats = [
        f"Each contribution is the change in the {unit} if that one input were absent. "
        "They are not additive and do not sum to the estimate.",
        "Age, sex and admission type are always present and are not taken out.",
        *extra_caveats,
    ]
    if missing:
        caveats.append("Not recorded (the model reads missingness as it was trained to): "
                       + ", ".join(missing[:8]) + ".")
    return Explanation(
        method="marginal-occlusion", basis=basis, top_contributors=tops, caveats=caveats,
        rationale=ExplanationRationale(text=text, generated=True, grounded_on="top_contributors"),
        reconstruction_ok=None,
    )


def _missing_vitals(case: Case) -> list[str]:
    return [VITAL_LABEL[n][0] for n in VITALS if case.vitals[n] is None]


def _risk(model_id: str, features: IntakeFeatures) -> tuple[float, dict, dict, str, Explanation]:
    bundle, ref, version = _require(model_id)
    names = bundle["feature_names"]
    meds = _med_vocab(names)
    case = _case(features, VITAL_RANGES["default"])
    occl = _occlusions(case, set(names))
    rows = [_tree_row(case, names, ref, meds)] + [_tree_row(o.case, names, ref, meds) for o in occl]
    probs = _tree_predict(bundle, rows)
    p = float(probs[0])
    expl = _occlusion_explanation(
        case, p, occl, probs[1:],
        basis="Gradient-boosted trees over intake-only features (cut at t0), isotonic-calibrated.",
        unit="calibrated probability", missing=_missing_vitals(case), extra_caveats=[],
    )
    return p, bundle, ref, version, expl


def _outcome(model_id: str, version: str, result, explanation, started: float, reason: str | None = None):
    return ModelOutcome(
        model_id=model_id, status="live", model_version=version,
        result=result.model_dump() if result is not None else None,
        latency_ms=round((time.perf_counter() - started) * 1000, 3),
        reason=reason, explanation=explanation,
    )


def mortality(features: IntakeFeatures) -> ModelOutcome:
    t = time.perf_counter()
    p, bundle, ref, version, expl = _risk("M-02", features)
    sens = bundle.get("sensitivity_target", 0.8)
    result = RiskResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, ref["risk_quantiles"]),
        calibrated=True,
        threshold=round(float(bundle["threshold"]), 4),
        flag=None,  # screening flag only when screening mode is enabled
        operating_point=f"sensitivity@{sens:.2f} (screening only)",
    )
    expl.caveats.insert(0, "Screening operating point — not a per-patient flag.")
    return _outcome("M-02", version, result, expl, t)


def icu(features: IntakeFeatures) -> ModelOutcome:
    t = time.perf_counter()
    p, bundle, ref, version, expl = _risk("M-03", features)
    sens = bundle.get("sensitivity_target", 0.8)
    result = RiskResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, ref["risk_quantiles"]),
        calibrated=True,
        threshold=round(float(bundle["threshold"]), 4),
        flag=None,
        operating_point=f"sensitivity@{sens:.2f} (screening only)",
    )
    return _outcome("M-03", version, result, expl, t)


def readmission(features: IntakeFeatures, frame: str = "intake") -> ModelOutcome:
    t = time.perf_counter()
    if frame != "intake":
        # The discharge bundle needs LOS, discharge location and LACE — post-t0
        # fields an intake case does not have. The router refuses it too.
        raise ArtifactsUnavailable("M-04 discharge frame needs post-t0 fields an intake case does not carry")
    p, _bundle, ref, version, expl = _risk("M-04", features)
    top_decile = float(ref["top_decile_threshold"])
    result = ReadmissionResult(
        probability=round(p, 4),
        population_percentile=_percentile(p, ref["risk_quantiles"]),
        calibrated=True,
        threshold=None,
        flag=None,
        operating_point="precision@top-decile (alert budget)",
        frame="intake",
        alert_budget="precision@top-decile",
        top_decile_flag=p >= top_decile,
        lace_score=None,  # discharge frame only
    )
    expl.caveats.insert(0, "Top-decile is a budget for how many alerts fire, not a verdict on this patient.")
    if not features.prior_history.prior_ccsr:
        expl.caveats.insert(0, "Cold-start patient: this model barely separates readmissions without "
                               "prior history (test AUROC 0.59 in that group).")
    return _outcome("M-04", version, result, expl, t)


def los(features: IntakeFeatures) -> ModelOutcome:
    """Length of stay as a split-conformal interval around quantile predictions."""
    import numpy as np

    t = time.perf_counter()
    bundle, ref, version = _require("M-05")
    names = bundle["feature_names"]
    meds = _med_vocab(names)
    case = _case(features, VITAL_RANGES["default"])
    occl = _occlusions(case, set(names))
    rows = np.asarray([_tree_row(case, names, ref, meds)] + [_tree_row(o.case, names, ref, meds) for o in occl],
                      dtype=np.float32)
    q = np.sort(np.column_stack([m.predict(rows) for m in bundle["quantile_models"]]), axis=1)
    q_hat = float(bundle["conformal_Q_hat_log"])
    low = max(0.0, math.expm1(q[0, 0] - q_hat))
    high = math.expm1(q[0, -1] + q_hat)
    points = np.expm1(q[:, 1])

    result = LOSResult(
        interval_low=round(low, 2),
        interval_high=round(high, 2),
        point_days=round(float(points[0]), 2),
        level=round(float(bundle["conformal_level"]), 3),
        coverage=round(float(ref["coverage"]), 3),
        tail_coverage_reduced=bool(ref["tail_coverage_reduced"]),
        low_signal=bool(ref["r2"] < 0.2),
    )
    expl = _occlusion_explanation(
        case, float(points[0]), occl, points[1:],
        basis="Quantile gradient-boosted trees on log1p(days) with a split-conformal interval.",
        unit="median estimate (days)", missing=_missing_vitals(case),
        extra_caveats=[
            f"Low predictive signal: intake-only features explain little of the variance (R² {ref['r2']:.2f}).",
            f"Coverage shown is pooled; the longest-stay decile is covered at {ref['tail_coverage']:.2f}.",
        ],
    )
    return _outcome("M-05", version, result, expl, t)


# --- M-01 Tower A -----------------------------------------------------------


def _m01_dense(case: Case, bundle: dict, ref: dict) -> tuple[list[float], list[tuple[str, str, str, bool]]]:
    """The dense block in `dense_columns` order, imputed with the train medians.

    Also returns, per clinical input, (group, label, display, imputed) for the
    explanation.
    """
    medians = ref["dense_medians"]
    lab_medians = ref["lab_medians"]
    bounds = ref.get("lab_bounds", {})
    values: dict[str, float] = {"age": case.age, "is_female": float(case.is_female), "via_ed": float(case.via_ed)}
    groups: list[tuple[str, str, str, bool]] = [
        ("age", "Age", f"{case.age:g} years", False),
        ("is_female", "Sex", "female" if case.is_female else "male", False),
        ("via_ed", "Arrived via emergency department", "yes" if case.via_ed else "no", False),
    ]
    for name in VITALS:
        x = case.vitals[name]
        label, unit = VITAL_LABEL[name]
        values[f"{name}_miss"] = 1.0 if x is None else 0.0
        values[name] = medians[name] if x is None else x
        groups.append((name, label, "not recorded" if x is None else f"{x:g} {unit}".strip(), x is None))
    for itemid in bundle["lab_vocab"]:
        raw = case.labs.get(itemid)
        x = None if raw is None else _clean_lab(itemid, raw, bounds, signed_ok=True)
        values[f"lab_{itemid}_miss"] = 1.0 if x is None else 0.0
        values[f"lab_{itemid}"] = lab_medians[itemid] if x is None else x
        if raw is not None:
            groups.append((f"lab_{itemid}", lab_label(itemid), f"{raw:g}", x is None))
    return [values[c] for c in bundle["dense_columns"]], groups


def differential(features: IntakeFeatures, top_n: int = 10) -> ModelOutcome:
    import numpy as np

    t = time.perf_counter()
    bundle, ref, version = _require("M-01")
    case = _case(features, VITAL_RANGES["M-01"])
    dense, groups = _m01_dense(case, bundle, ref)
    scaler = bundle["scaler"]
    scaled = (np.asarray(dense, dtype=np.float64) - scaler.mean_) / scaler.scale_

    pdx_vocab, med_vocab = bundle["pdx_vocab"], bundle["med_vocab"]
    pdx_ix = {c: i for i, c in enumerate(pdx_vocab)}
    pdx = np.zeros(len(pdx_vocab))
    for c in case.prior_ccsr:
        if c in pdx_ix:
            pdx[pdx_ix[c]] = 1.0
    matched, unmatched_meds = _match_meds(case.meds, med_vocab)
    med_ix = {c: i for i, c in enumerate(med_vocab)}
    med = np.zeros(len(med_vocab))
    for m in matched:
        med[med_ix[m]] = 1.0
    x = np.concatenate([scaled, pdx, med])

    # Every label's logistic model at once: W @ x + b, then its own calibrator.
    live = [j for j, m in enumerate(bundle["models"]) if m is not None]
    W = np.vstack([bundle["models"][j].coef_[0] for j in live])
    b = np.array([bundle["models"][j].intercept_[0] for j in live])
    logits = W @ x + b
    raw = 1.0 / (1.0 + np.exp(-logits))
    probs = np.empty(len(live))
    for k, j in enumerate(live):
        method = bundle["cal_method"][j]
        cal = bundle["calibrators"][j]
        if method == "isotonic":
            probs[k] = cal.predict(np.array([raw[k]]))[0]
        elif method == "platt":
            probs[k] = cal.predict_proba(np.array([[raw[k]]]))[0, 1]
        else:
            probs[k] = raw[k]

    order = np.argsort(-probs)[:top_n]
    n_dense = len(dense)
    col_group: dict[int, str] = {}
    for i, c in enumerate(bundle["dense_columns"]):
        col_group[i] = c[:-5] if c.endswith("_miss") else c
    group_meta = {g: (label, display, imputed) for g, label, display, imputed in groups}

    items = []
    for k in order:
        j = live[k]
        code = bundle["labels"][j]
        method = bundle["cal_method"][j]
        coef = W[k]
        contrib: dict[str, float] = {}
        for i in range(n_dense):
            g = col_group[i]
            if g in group_meta:
                contrib[g] = contrib.get(g, 0.0) + coef[i] * x[i]
        for c in case.prior_ccsr:
            if c in pdx_ix:
                contrib[f"pdx_{c}"] = coef[n_dense + pdx_ix[c]]
        for m in matched:
            contrib[f"med_{m}"] = coef[n_dense + len(pdx_vocab) + med_ix[m]]
        reconstructed = b[k] + float(coef @ x)
        ranked = sorted(contrib.items(), key=lambda kv: abs(kv[1]), reverse=True)[:4]
        tops = []
        for g, c in ranked:
            if g.startswith("pdx_"):
                label, display, imputed = f"Prior: {ccsr_name(g[4:])}", g[4:], False
            elif g.startswith("med_"):
                label, display, imputed = f"Medication: {g[4:]}", "on list", False
            else:
                label, display, imputed = group_meta[g]
            tops.append(ExplanationContributor(
                feature=g, human_label=label, patient_value=None, value_display=display,
                direction="increases" if c >= 0 else "decreases", contribution=round(float(c), 4),
                from_missing=imputed,
            ))
        up = [c.human_label.lower() for c in tops if c.direction == "increases"][:2]
        text = ("Relative to an average admission, the log-odds are raised mainly by " + " and ".join(up) + ".") \
            if up else "No recorded input raises this condition above an average admission."
        caveats = [
            "Contributions are to the log-odds before this label's calibrator, relative to the "
            "training average; they rank the drivers but do not add up to the displayed probability.",
        ]
        if method == "raw":
            caveats.append("This condition had too few validation cases to calibrate; its probability is uncalibrated.")
        if bundle["status"][j] == "unreliable":
            caveats.append("Marked unreliable in evaluation (too few positive cases for a stable estimate).")
        items.append(DifferentialItem(
            ccsr=code,
            probability=round(float(probs[k]), 4),
            family=ccsr_family(code),
            calibrated=method in ("isotonic", "platt"),
            from_unconfirmed_extraction=False,
            explanation=Explanation(
                method="exact-linear",
                basis=f"Tower A logistic model for {ccsr_name(code)} ({code}).",
                top_contributors=tops,
                caveats=caveats,
                rationale=ExplanationRationale(text=text, generated=True, grounded_on="top_contributors"),
                reconstruction_ok=bool(abs(reconstructed - logits[k]) < 1e-6),
            ),
        ))

    unmatched_ccsr = sorted(c for c in case.prior_ccsr if c not in pdx_ix)
    result = DifferentialResult(
        items=items,
        top_n=top_n,
        fusion_status="tower_a_only",
        towers_used=["A"],
        tower_contributions={"A": 1.0, "B": None, "C": None},
        unscored_ccsr_count=len(bundle["labels"]) - len(live),
        unmatched_ccsr=unmatched_ccsr,
        unmatched_meds=sorted(unmatched_meds),
    )
    return _outcome("M-01", version, result, None, t,
                    reason="Tower A only — the note (B) and sequence (C) towers are not served yet.")


# --- coverage ---------------------------------------------------------------


def coverage(features: IntakeFeatures) -> tuple[FeatureCoverage, list[str]]:
    """Feature coverage and the warnings the UI surfaces.

    M-01 imputes a missing dense value with the train-split median, exactly as
    training did, so calibration stays "full". It is "reduced" only when the
    medians are unavailable and a stand-in would be needed — in which case the
    differential is refused rather than served on a stand-in.
    """
    bundle, ref, _version = _require("M-01")
    case = _case(features, VITAL_RANGES["M-01"])
    v = features.vitals
    has_vitals = any(x is not None for x in (v.bmi, v.weight_kg, v.height_cm, v.bp_sys, v.bp_dia))
    n_labs = len(features.labs)
    n_prior = len(features.prior_history.prior_ccsr)
    has_notes = features.notes is not None and any(
        getattr(features.notes, f) for f in features.notes.model_fields
    )
    minimum_signal = has_vitals or n_labs > 0 or n_prior > 0
    medians_ok = bool(ref.get("dense_medians")) and bool(ref.get("lab_medians"))

    fc = FeatureCoverage(
        has_vitals=has_vitals,
        has_labs=n_labs > 0,
        has_prior_history=n_prior > 0,
        has_notes=bool(has_notes),
        n_labs_present=n_labs,
        n_prior_ccsr=n_prior,
        minimum_signal_met=minimum_signal,
        calibration_validity="full" if medians_ok else "reduced",
    )

    warnings_out: list[str] = []
    if not minimum_signal:
        warnings_out.append(
            "minimum signal not met: no vitals, labs or prior history — outputs are a "
            "population baseline, not a patient-specific estimate"
        )
    if n_prior == 0:
        warnings_out.append("cold-start: no prior history on record")
    if 0 < n_labs < 6:
        warnings_out.append(f"labs coverage low ({n_labs} of the intake panel)")
    unknown_labs = [i for i in features.labs if i not in set(bundle["lab_vocab"])]
    if unknown_labs:
        warnings_out.append(f"{len(unknown_labs)} lab(s) outside the model's panel were not used by M-01")
    _, unmatched = _match_meds(case.meds, bundle["med_vocab"])
    if unmatched:
        warnings_out.append(f"{len(unmatched)} medication name(s) not in the model's vocabulary were not used")
    if not has_notes:
        warnings_out.append("no admission note supplied — Tower B is not served, so notes are not read yet")
    return fc, warnings_out
