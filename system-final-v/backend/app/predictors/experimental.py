"""Experimental models — off unless ESAP_EXPERIMENTAL_MODELS=1 with MODEL_MODE=real.

Three trained bundles that the five-model contract in `real.py` does not serve:

* M-04 at discharge — needs post-t0 fields, so it reads `DischargeFields`, which
  sits beside `IntakeFeatures` and is never handed to an intake model.
* M-01 Tower B (admission-note sections, frozen Clinical-Longformer + per-label
  logistic heads). Its full-scale run has an UNRESOLVED leakage alarm.
* M-01 Tower C (prior-admission code timeline). The export carries no
  calibrators, so its scores are raw sigmoids and are never badged calibrated.

No fusion model exists, so B and C are shown *beside* Tower A and never change
its ranking: `fusion_status` stays "tower_a_only".

Each tower reports its own status. A tower that cannot run says why instead of
failing the assessment, and none of this affects `/readyz`.
"""

from __future__ import annotations

import hashlib
import pickle
import threading
import time
import warnings
from dataclasses import dataclass

from ..catalogs import ccsr_family
from ..config import settings
from ..schemas.clinical import (
    DifferentialItem,
    DischargeFields,
    IntakeFeatures,
    ModelOutcome,
    NoteSections,
    ReadmissionResult,
    TowerOutput,
)
from . import real

TOWER_B_BUNDLE = "M01_TowerB_sections_full.pkl"
TOWER_C_BUNDLE = "M01_TowerC_full.pt"
DISCHARGE_BUNDLE = "M04_Readmit_discharge_full.pkl"

# metrics_readmit_discharge.json, precision_at_alert_budget.top_10pct.threshold.
# The test-split risk distribution was never exported for this bundle, so there
# is no population percentile to report: it is None, not an estimate.
DISCHARGE_TOP_DECILE = 0.381

# feature_config.py (M-04): the Van Walraven 2010 LACE mapping used in training.
LACE_L_BREAKS = [(0, 0), (1, 1), (2, 2), (3, 3), (6, 4), (13, 5)]
LACE_L_MAX = 7
LACE_C_BREAKS = [(0, 0), (1, 1), (2, 2)]
LACE_C_MAX = 5
LACE_E_CAP = 4
LACE_ACUTE_TYPES = {"EW EMER.", "URGENT", "DIRECT EMER."}
LACE_A_POINTS = 3

# feature_config.py (M-01): what the note text and sequence model were built with.
NOTE_SECTION_ORDER = (
    "chief_complaint", "hpi", "pmh", "meds_on_admission", "allergies",
    "social_hx", "family_hx", "physical_exam", "review_of_systems",
)
NOTE_MAX_TOKENS = 1024
SEQ_MAX_LEN = 64
SEQ_GAP_EDGES_DAYS = (7, 30, 90, 365, 730, 1825)
SEQ_EMBED_DIM = 128
SEQ_N_LAYERS = 2
SEQ_N_HEADS = 4
SEQ_FFN_DIM = 256
SEQ_DROPOUT = 0.1

TOWER_B_CAVEATS = [
    "Experimental: not validated for clinical use. The full-scale run has an unresolved leakage "
    "alarm (note-bearing test Recall@20 0.657 against a 0.600 threshold).",
    "Reads only the admission-note sections entered at intake. Test Recall@20 0.550.",
]
TOWER_C_CAVEATS = [
    "Experimental: not validated for clinical use. Test Recall@20 0.563.",
    "The export has no calibrators, so these are uncalibrated scores: read the order, "
    "not the absolute values.",
]

_LOCK = threading.RLock()
_cache: dict[str, object] = {}


def enabled() -> bool:
    s = settings()
    return s.experimental_models and s.model_mode == "real"


def reset() -> None:
    """Forget the loaded artifacts (tests; after replacing the export folder)."""
    with _LOCK:
        _cache.clear()


def _version(trained_at: object, raw: bytes) -> str:
    return f"{str(trained_at or 'unknown')[:10]}+sha256.{hashlib.sha256(raw).hexdigest()[:12]}"


def _read(name: str) -> bytes:
    root = real.settings().exports_dir
    if root is None:
        raise real.ArtifactsUnavailable("ESAP_EXPORTS_DIR is not set")
    path = root / name
    if not path.is_file():
        raise real.ArtifactsUnavailable(f"{name} not found in {root}")
    return path.read_bytes()


# --- M-04 at discharge ------------------------------------------------------


def _points(value: float, breaks: list[tuple[int, int]], maximum: int) -> int:
    return next((points for limit, points in breaks if value <= limit), maximum)


def lace_score(case: real.Case, d: DischargeFields) -> int:
    length = _points(d.los_hours / 24.0, LACE_L_BREAKS, LACE_L_MAX)
    acuity = LACE_A_POINTS if case.adm_type in LACE_ACUTE_TYPES else 0
    comorbidity = _points(case.charlson, LACE_C_BREAKS, LACE_C_MAX)
    return length + acuity + comorbidity + min(d.n_ed_visits_180d, LACE_E_CAP)


def _discharge_row(case: real.Case, names: list[str], ref: dict, meds: list[str], d: DischargeFields) -> list[float]:
    row = real._tree_row(case, names, ref, meds)
    ix = {n: i for i, n in enumerate(names)}
    row[ix["los_hours"]] = d.los_hours
    row[ix["n_ed_visits_180d"]] = float(d.n_ed_visits_180d)
    row[ix["lace_score"]] = float(lace_score(case, d))
    column = f"dischloc_adm_{d.discharge_location.strip().upper()}"
    row[ix.get(column, ix["dischloc_adm_OTHER"])] = 1.0
    return row


def _discharge_bundle() -> tuple[dict, str]:
    with _LOCK:
        if DISCHARGE_BUNDLE not in _cache:
            raw = _read(DISCHARGE_BUNDLE)
            bundle = pickle.loads(raw)  # noqa: S301 - our own DUA-restricted artifact
            _cache[DISCHARGE_BUNDLE] = (bundle, _version(bundle.get("trained_at"), raw))
        return _cache[DISCHARGE_BUNDLE]  # type: ignore[return-value]


def readmission_discharge(features: IntakeFeatures, discharge: DischargeFields | None) -> ModelOutcome:
    if discharge is None:
        raise real.ArtifactsUnavailable("frame=discharge needs the discharge fields")
    t = time.perf_counter()
    _, ref, _ = real._require("M-04")  # the same train-split lab bounds as the intake frame
    bundle, version = _discharge_bundle()
    names = bundle["feature_names"]
    meds = real._med_vocab(names)
    case = real._case(features, real.VITAL_RANGES["default"])
    occl = real._occlusions(case, set(names))
    rows = [_discharge_row(case, names, ref, meds, discharge)]
    rows += [_discharge_row(o.case, names, ref, meds, discharge) for o in occl]
    probs = real._tree_predict(bundle, rows)
    p = float(probs[0])

    extra = [
        "Experimental discharge-frame model.",
        "Length of stay, discharge destination and ED visits also feed this estimate but are "
        "not taken out one at a time here.",
    ]
    if f"dischloc_adm_{discharge.discharge_location.strip().upper()}" not in names:
        extra.append(f"Discharge location '{discharge.discharge_location}' is not in the training "
                     "vocabulary and was scored as OTHER.")
    explanation = real._occlusion_explanation(
        case, p, occl, probs[1:],
        basis="Gradient-boosted trees with stay length, discharge destination and LACE; isotonic-calibrated.",
        unit="calibrated probability", missing=real._missing_vitals(case), extra_caveats=extra,
    )
    result = ReadmissionResult(
        probability=round(p, 4),
        population_percentile=None,
        calibrated=True,
        threshold=round(float(bundle["threshold"]), 4),
        flag=None,
        operating_point="precision@top-decile (alert budget)",
        frame="discharge",
        alert_budget="precision@top-decile",
        top_decile_flag=p >= DISCHARGE_TOP_DECILE,
        lace_score=lace_score(case, discharge),
    )
    return real._outcome("M-04", version, result, explanation, t,
                         reason="Experimental discharge frame. Test AUROC 0.704.")


# --- shared tower plumbing --------------------------------------------------


def _items(labels: list[str], indices: list[int], probs, calibrated: list[bool], top_n: int) -> list[DifferentialItem]:
    import numpy as np

    order = np.argsort(-probs)[:top_n]
    return [
        DifferentialItem(
            ccsr=labels[indices[k]],
            probability=round(float(probs[k]), 4),
            family=ccsr_family(labels[indices[k]]),
            calibrated=calibrated[k],
        )
        for k in order
    ]


def _guarded(tower: str, caveats: list[str], fn) -> TowerOutput:
    t = time.perf_counter()
    try:
        out = fn()
    except (ImportError, OSError, real.ArtifactsUnavailable) as exc:
        out = TowerOutput(tower=tower, status="not_ready", model_version="unknown",
                          reason=f"{type(exc).__name__}: {exc}")
    except Exception as exc:  # noqa: BLE001 - an experimental tower must not sink the assessment
        out = TowerOutput(tower=tower, status="error", model_version="unknown",
                          reason=f"{type(exc).__name__}: {exc}")
    out.caveats = [*caveats, *out.caveats]
    out.latency_ms = round((time.perf_counter() - t) * 1000, 3)
    return out


# --- Tower B: admission-note sections ---------------------------------------


@dataclass
class _TowerB:
    bundle: dict
    version: str
    library_drift: str | None


def _tower_b() -> _TowerB:
    with _LOCK:
        if TOWER_B_BUNDLE not in _cache:
            raw = _read(TOWER_B_BUNDLE)
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                bundle = pickle.loads(raw)  # noqa: S301 - our own DUA-restricted artifact
            drift = next((str(w.message) for w in caught if "InconsistentVersion" in w.category.__name__), None)
            _cache[TOWER_B_BUNDLE] = _TowerB(bundle, _version(bundle.get("trained_at"), raw), drift)
        return _cache[TOWER_B_BUNDLE]  # type: ignore[return-value]


def note_text(notes: NoteSections | None) -> str:
    """The sections in training order, tagged exactly as data_io.fetch_note_sections did."""
    if notes is None:
        return ""
    parts = []
    for section in NOTE_SECTION_ORDER:
        value = (getattr(notes, section) or "").strip()
        if value:
            parts.append(f"[{section.replace('_', ' ').upper()}] {value}")
    return "\n".join(parts)


def _embedder():
    """Clinical-Longformer from the local cache. Never downloads at serving time."""
    with _LOCK:
        if "embedder" not in _cache:
            from transformers import AutoModel, AutoTokenizer

            name = _tower_b().bundle["embeddings_model"]
            tokenizer = AutoTokenizer.from_pretrained(name, local_files_only=True)
            model = AutoModel.from_pretrained(name, local_files_only=True).eval()
            _cache["embedder"] = (tokenizer, model)
        return _cache["embedder"]


def embed_note(text: str):
    """Mean-pooled last hidden state over real tokens, as embed_notes.py computed it."""
    import torch

    tokenizer, model = _embedder()
    encoded = tokenizer([text], return_tensors="pt", truncation=True, max_length=NOTE_MAX_TOKENS, padding=True)
    with _LOCK, torch.no_grad():
        hidden = model(**encoded).last_hidden_state
    mask = encoded["attention_mask"].unsqueeze(-1).to(hidden.dtype)
    return ((hidden * mask).sum(1) / mask.sum(1).clamp(min=1))[0].float().numpy()


def tower_b_from_embedding(embedding, top_n: int) -> TowerOutput:
    """Score one 768-d note embedding through the per-label heads and calibrators."""
    import numpy as np

    loaded = _tower_b()
    bundle = loaded.bundle
    scaler = bundle["scaler"]
    x = (np.asarray(embedding, dtype=np.float64) - scaler.mean_) / scaler.scale_
    live = [j for j, m in enumerate(bundle["models"]) if m is not None]
    weights = np.vstack([bundle["models"][j].coef_[0] for j in live])
    intercepts = np.array([bundle["models"][j].intercept_[0] for j in live])
    raw = 1.0 / (1.0 + np.exp(-(weights @ x + intercepts)))

    probs = np.empty(len(live))
    calibrated: list[bool] = []
    for k, j in enumerate(live):
        method = bundle["cal_method"][j]
        calibrator = bundle["calibrators"][j]
        if method == "isotonic":
            probs[k] = calibrator.predict(np.array([raw[k]]))[0]
        elif method == "platt":
            probs[k] = calibrator.predict_proba(np.array([[raw[k]]]))[0, 1]
        else:
            probs[k] = raw[k]
        calibrated.append(method in ("isotonic", "platt"))

    caveats = []
    if loaded.library_drift:
        caveats.append("This bundle was pickled under scikit-learn 1.9.1 and is running under 1.9.0.")
    return TowerOutput(
        tower="B", status="live", model_version=loaded.version,
        items=_items(bundle["labels"], live, probs, calibrated, top_n),
        caveats=caveats,
    )


def tower_b(features: IntakeFeatures, top_n: int) -> TowerOutput:
    def run() -> TowerOutput:
        text = note_text(features.notes)
        if not text:
            return TowerOutput(tower="B", status="no_input", model_version=_tower_b().version,
                               reason="No admission note sections were entered.")
        return tower_b_from_embedding(embed_note(text), top_n)

    return _guarded("B", TOWER_B_CAVEATS, run)


# --- Tower C: prior-admission code timeline ---------------------------------


def _seq_net(n_codes: int, n_gap_buckets: int, n_labels: int):
    """The train_tower_c.py architecture; state-dict names must match it exactly."""
    import torch
    import torch.nn as nn

    class Net(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.code_emb = nn.Embedding(n_codes + 1, SEQ_EMBED_DIM, padding_idx=0)
            self.gap_emb = nn.Embedding(n_gap_buckets + 1, SEQ_EMBED_DIM, padding_idx=0)
            self.pos_emb = nn.Embedding(SEQ_MAX_LEN, SEQ_EMBED_DIM)
            layer = nn.TransformerEncoderLayer(
                d_model=SEQ_EMBED_DIM, nhead=SEQ_N_HEADS, dim_feedforward=SEQ_FFN_DIM,
                dropout=SEQ_DROPOUT, batch_first=True,
            )
            self.encoder = nn.TransformerEncoder(layer, num_layers=SEQ_N_LAYERS)
            self.head = nn.Linear(SEQ_EMBED_DIM, n_labels)

        def forward(self, codes, gaps, mask):
            pos = torch.arange(codes.shape[1]).unsqueeze(0)
            hidden = self.encoder(self.code_emb(codes) + self.gap_emb(gaps) + self.pos_emb(pos),
                                  src_key_padding_mask=mask)
            valid = (~mask).unsqueeze(-1).to(hidden.dtype)
            return self.head((hidden * valid).sum(1) / valid.sum(1).clamp(min=1))

    return Net()


def _tower_c() -> tuple[object, dict, str]:
    import io

    import torch

    with _LOCK:
        if TOWER_C_BUNDLE not in _cache:
            raw = _read(TOWER_C_BUNDLE)
            checkpoint = torch.load(io.BytesIO(raw), map_location="cpu", weights_only=True)
            net = _seq_net(len(checkpoint["code_vocab"]), len(SEQ_GAP_EDGES_DAYS) + 1, checkpoint["K"])
            net.load_state_dict(checkpoint["state_dict"], strict=True)
            net.eval()
            _cache[TOWER_C_BUNDLE] = (net, checkpoint, _version(checkpoint.get("trained_at"), raw))
        return _cache[TOWER_C_BUNDLE]  # type: ignore[return-value]


def gap_bucket(gap_days: float) -> int:
    """1-based right-closed bucket; 0 is reserved for padding (train_tower_c.bucketize_gap)."""
    bucket = 1
    for edge in SEQ_GAP_EDGES_DAYS:
        if gap_days <= edge:
            return bucket
        bucket += 1
    return bucket


def tower_c(features: IntakeFeatures, top_n: int) -> TowerOutput:
    def run() -> TowerOutput:
        import numpy as np
        import torch

        net, checkpoint, version = _tower_c()
        vocab = {code: i + 1 for i, code in enumerate(checkpoint["code_vocab"])}
        events = features.coded_sequence
        # Training guaranteed gap_days > 0: a later or same-time event would be a leak.
        usable = [e for e in events if e.gap_days > 0]
        # Oldest first, then the most recent SEQ_MAX_LEN in-vocabulary events.
        ordered = sorted((e for e in usable if e.ccsr in vocab), key=lambda e: -e.gap_days)[-SEQ_MAX_LEN:]
        if not ordered:
            return TowerOutput(tower="C", status="no_input", model_version=version,
                               reason="No usable prior-admission code timeline was entered.")

        codes = np.zeros((1, SEQ_MAX_LEN), dtype=np.int64)
        gaps = np.zeros((1, SEQ_MAX_LEN), dtype=np.int64)
        mask = np.ones((1, SEQ_MAX_LEN), dtype=bool)
        for position, event in enumerate(ordered):
            codes[0, position] = vocab[event.ccsr]
            gaps[0, position] = gap_bucket(event.gap_days)
            mask[0, position] = False
        with _LOCK, torch.no_grad():
            probs = torch.sigmoid(net(torch.from_numpy(codes), torch.from_numpy(gaps), torch.from_numpy(mask)))[0].numpy()

        caveats = []
        if len(usable) < len(events):
            caveats.append(f"{len(events) - len(usable)} event(s) with a non-positive gap were ignored.")
        out_of_vocab = sum(1 for e in usable if e.ccsr not in vocab)
        if out_of_vocab:
            caveats.append(f"{out_of_vocab} event(s) use a code outside the model's vocabulary and were ignored.")
        indices = list(range(len(checkpoint["labels"])))
        return TowerOutput(
            tower="C", status="live", model_version=version,
            items=_items(checkpoint["labels"], indices, probs, [False] * len(indices), top_n),
            caveats=caveats,
        )

    return _guarded("C", TOWER_C_CAVEATS, run)


def towers(features: IntakeFeatures, top_n: int) -> dict[str, TowerOutput]:
    return {"B": tower_b(features, top_n), "C": tower_c(features, top_n)}
