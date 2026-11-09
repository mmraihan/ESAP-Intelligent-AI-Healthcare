"""Experimental bundles: discharge readmission, Towers B and C, and the full export.

Skipped wherever the DUA-restricted exports or torch are absent.
"""

from __future__ import annotations

import pickle
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[3]
EXPORTS = ROOT.parent / "ml-pipeline" / "model_exports"
EMBEDDINGS = ROOT / "ml-pipeline" / "models" / "m01_differential" / "embeddings_sections.npz"

pytest.importorskip("sklearn.metrics")
torch = pytest.importorskip("torch")
if not (EXPORTS / "serving_reference.json").is_file():
    pytest.skip("model exports not present", allow_module_level=True)

import numpy as np  # noqa: E402

from app import assembler  # noqa: E402
from app.predictors import experimental, real  # noqa: E402
from app.schemas.clinical import (  # noqa: E402
    AssessResponse,
    DischargeFields,
    IntakeFeatures,
    IntakeRequest,
    ModelOutcome,
    TowerOutput,
)

ALL_PICKLES = sorted(p.name for p in EXPORTS.glob("*.pkl"))
DAMAGED = {"M01_TowerC_negcontrol_shuffle.pt"}
ALL_CHECKPOINTS = sorted(p.name for p in EXPORTS.glob("*.pt") if p.name not in DAMAGED)


@pytest.fixture(autouse=True)
def exports(monkeypatch):
    conf = SimpleNamespace(exports_dir=EXPORTS, experimental_models=True, model_mode="real")
    monkeypatch.setattr(real, "settings", lambda: conf)
    monkeypatch.setattr(experimental, "settings", lambda: conf)
    real.reset()
    experimental.reset()
    yield
    real.reset()
    experimental.reset()


def case(**over) -> IntakeFeatures:
    base = {
        "demographics": {"admission_age": 72, "is_female": 0},
        "admission_context": {"via_ed": 1, "admission_type": "EW EMER.", "admission_location": "EMERGENCY ROOM"},
        "vitals": {"bmi": 27.0, "bp_sys": 118, "bp_dia": 70},
        "labs": {"50912": 1.8, "51222": 10.5, "51301": 11.0},
        "prior_history": {"prior_ccsr": ["CIR019", "END002"], "n_prior_admissions": 3, "charlson_index": 4},
        "meds": ["furosemide"],
    }
    base.update(over)
    return IntakeFeatures.model_validate(base)


HOME = DischargeFields(los_hours=72, discharge_location="HOME", n_ed_visits_180d=1)
SEQUENCE = [
    {"prior_hadm": "a", "ccsr": "CIR019", "gap_days": 400},
    {"prior_hadm": "b", "ccsr": "END002", "gap_days": 40},
    {"prior_hadm": "b", "ccsr": "GEN003", "gap_days": 40},
]


# --- every bundle in the export ---------------------------------------------


@pytest.mark.parametrize("name", ALL_PICKLES)
def test_every_pickle_loads(name):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        bundle = pickle.loads((EXPORTS / name).read_bytes())
    assert bundle


@pytest.mark.parametrize("name", ALL_CHECKPOINTS)
def test_every_checkpoint_rebuilds_and_predicts(name):
    checkpoint = torch.load(EXPORTS / name, map_location="cpu", weights_only=True)
    net = experimental._seq_net(len(checkpoint["code_vocab"]), 7, checkpoint["K"])
    net.load_state_dict(checkpoint["state_dict"], strict=True)
    net.eval()
    codes = torch.zeros((1, 64), dtype=torch.long)
    codes[0, 0] = 1
    gaps = torch.zeros((1, 64), dtype=torch.long)
    gaps[0, 0] = 1
    mask = torch.ones((1, 64), dtype=torch.bool)
    mask[0, 0] = False
    with torch.no_grad():
        probs = torch.sigmoid(net(codes, gaps, mask))
    assert probs.shape == (1, checkpoint["K"]) and torch.isfinite(probs).all()


@pytest.mark.parametrize("name", sorted(DAMAGED))
def test_known_damaged_checkpoint_is_still_damaged(name):
    """If this fails, a good copy has been restored: move the file out of DAMAGED."""
    assert not zipfile.is_zipfile(EXPORTS / name)


@pytest.mark.parametrize("name", ["M01_TowerB_poc.pkl", "M01_TowerB_negcontrol_fullnote_4096.pkl"])
def test_small_tower_b_bundles_score(name, monkeypatch):
    monkeypatch.setattr(experimental, "TOWER_B_BUNDLE", name)
    out = experimental.tower_b_from_embedding(np.zeros(768), 5)
    assert out.status == "live" and len(out.items) == 5


# --- discharge frame --------------------------------------------------------


def lace_case(**kw):
    defaults = dict(age=70.0, is_female=0, via_ed=1, vitals={}, labs={}, prior_ccsr=(), n_prior=0,
                    charlson=0, meds=(), adm_type="ELECTIVE", adm_loc="OTHER")
    return real.Case(**{**defaults, **kw})


@pytest.mark.parametrize(
    ("hours", "adm_type", "charlson", "ed", "expected"),
    [
        (0, "ELECTIVE", 0, 0, 0),
        (24, "ELECTIVE", 0, 0, 1),
        (25, "ELECTIVE", 0, 0, 2),     # 1.04 days is in the <=2 band
        (6 * 24, "ELECTIVE", 0, 0, 4),
        (14 * 24, "EW EMER.", 3, 9, 7 + 3 + 5 + 4),
    ],
)
def test_lace_matches_training_bands(hours, adm_type, charlson, ed, expected):
    d = DischargeFields(los_hours=hours, discharge_location="HOME", n_ed_visits_180d=ed)
    assert experimental.lace_score(lace_case(adm_type=adm_type, charlson=charlson), d) == expected


def test_discharge_scores_and_uses_each_field():
    base = experimental.readmission_discharge(case(), HOME)
    assert base.status == "live" and base.result["frame"] == "discharge"
    assert base.result["population_percentile"] is None
    assert 0 <= base.result["probability"] <= 1
    assert base.result["lace_score"] == 3 + 3 + 5 + 1

    longer = experimental.readmission_discharge(
        case(), DischargeFields(los_hours=24 * 30, discharge_location="SKILLED NURSING FACILITY", n_ed_visits_180d=4))
    assert longer.result["probability"] != base.result["probability"]
    assert longer.result["lace_score"] == 7 + 3 + 5 + 4


def test_discharge_row_sets_exactly_one_destination():
    bundle, _ = experimental._discharge_bundle()
    names = bundle["feature_names"]
    built = real._case(case(), real.VITAL_RANGES["default"])
    _, ref, _ = real._require("M-04")
    for location, expected in [("hospice", "dischloc_adm_HOSPICE"), ("MOON BASE", "dischloc_adm_OTHER")]:
        d = DischargeFields(los_hours=48, discharge_location=location)
        row = experimental._discharge_row(built, names, ref, real._med_vocab(names), d)
        hot = [n for n, v in zip(names, row) if n.startswith("dischloc_adm_") and v == 1.0]
        assert hot == [expected]


def test_unknown_discharge_location_is_disclosed():
    out = experimental.readmission_discharge(case(), DischargeFields(los_hours=48, discharge_location="MOON BASE"))
    assert any("scored as OTHER" in c for c in out.explanation.caveats)


# --- Tower C ----------------------------------------------------------------


@pytest.mark.parametrize(("days", "bucket"), [(1, 1), (7, 1), (8, 2), (30, 2), (1825, 6), (1826, 7)])
def test_gap_buckets_match_training(days, bucket):
    assert experimental.gap_bucket(days) == bucket


def test_tower_c_is_live_and_never_claims_calibration():
    out = experimental.tower_c(case(coded_sequence=SEQUENCE), 10)
    assert out.status == "live" and len(out.items) == 10
    assert all(not i.calibrated for i in out.items)
    assert [i.probability for i in out.items] == sorted((i.probability for i in out.items), reverse=True)


def test_tower_c_responds_to_the_timeline():
    first = experimental.tower_c(case(coded_sequence=SEQUENCE), 459)
    other = experimental.tower_c(case(coded_sequence=[{"ccsr": "NEO030", "gap_days": 3000}]), 459)
    a = {i.ccsr: i.probability for i in first.items}
    b = {i.ccsr: i.probability for i in other.items}
    assert a != b


def test_tower_c_order_of_input_does_not_matter():
    a = experimental.tower_c(case(coded_sequence=SEQUENCE), 459)
    distinct_gaps = [SEQUENCE[1], SEQUENCE[0]]  # newest first; training order is oldest first
    b = experimental.tower_c(case(coded_sequence=[SEQUENCE[0], SEQUENCE[1]]), 459)
    c = experimental.tower_c(case(coded_sequence=distinct_gaps), 459)
    assert a.status == "live"
    assert [i.probability for i in b.items] == [i.probability for i in c.items]


def test_tower_c_without_a_timeline_is_no_input():
    out = experimental.tower_c(case(), 10)
    assert out.status == "no_input" and out.items == []


def test_tower_c_ignores_and_discloses_non_positive_gaps():
    out = experimental.tower_c(case(coded_sequence=[*SEQUENCE, {"ccsr": "CIR019", "gap_days": 0}]), 5)
    assert out.status == "live" and any("non-positive gap" in c for c in out.caveats)


# --- Tower B ----------------------------------------------------------------


def test_note_text_matches_the_training_format():
    features = case(notes={"physical_exam": "clear lungs", "chief_complaint": " chest pain ", "hpi": ""})
    assert experimental.note_text(features.notes) == "[CHIEF COMPLAINT] chest pain\n[PHYSICAL EXAM] clear lungs"


def test_tower_b_without_a_note_is_no_input():
    assert experimental.tower_b(case(), 10).status == "no_input"


@pytest.mark.skipif(not EMBEDDINGS.is_file(), reason="cached note embeddings not present")
def test_tower_b_head_scores_a_recorded_embedding():
    with np.load(EMBEDDINGS) as data:
        with_note = np.where(data["has_note"])[0]
        first, second = data["emb"][with_note[0]], data["emb"][with_note[1]]
    a = experimental.tower_b_from_embedding(first, 20)
    b = experimental.tower_b_from_embedding(second, 20)
    assert a.status == "live" and len(a.items) == 20
    assert all(0 <= i.probability <= 1 for i in a.items)
    assert [i.probability for i in a.items] != [i.probability for i in b.items]
    assert any("1.9.1" in c for c in a.caveats)


def test_blocked_embedder_reports_not_ready_with_reason(monkeypatch):
    def blocked(_):
        raise ImportError("DLL load failed: blocked by policy")

    monkeypatch.setattr(experimental, "embed_note", blocked)
    out = experimental.tower_b(case(notes={"hpi": "dyspnea"}), 10)
    assert out.status == "not_ready" and "blocked by policy" in out.reason
    assert any("leakage alarm" in c for c in out.caveats)


# --- assembly and display policy --------------------------------------------


def fake_towers(_features, _top_n):
    item = {"ccsr": "CIR019", "probability": 0.5, "family": "Circulatory", "calibrated": False}
    other = {**item, "ccsr": "END002"}
    return {
        name: TowerOutput.model_validate({"tower": name, "status": "live", "model_version": "v", "items": [item, other]})
        for name in ("B", "C")
    }


def assess_with_towers(monkeypatch, provenance=None):
    monkeypatch.setattr(experimental, "towers", fake_towers)
    monkeypatch.setattr(real, "differential", lambda f, n: ModelOutcome(
        model_id="M-01", status="live", model_version="v", latency_ms=0,
        result={"items": [], "top_n": n, "unscored_ccsr_count": 0}))
    from app import predictors

    monkeypatch.setattr(predictors, "backend", lambda: real)
    return assembler.assess(IntakeRequest(features=case(), provenance=provenance or {}))


def test_towers_stay_beside_tower_a(monkeypatch):
    response: AssessResponse = assess_with_towers(monkeypatch)
    assert set(response.differential.result["experimental_towers"]) == {"B", "C"}
    assert response.differential.result["items"] == []
    assert "not combined" in response.differential.reason
    assert not any("not served" in w for w in response.warnings)


def test_flag_off_attaches_nothing(monkeypatch):
    off = SimpleNamespace(exports_dir=EXPORTS, experimental_models=False, model_mode="real")
    monkeypatch.setattr(experimental, "settings", lambda: off)
    assert not experimental.enabled()
    response = assess_with_towers(monkeypatch)
    assert "experimental_towers" not in response.differential.result


def test_site_suppressed_category_is_hidden_in_every_tower(monkeypatch):
    response = assess_with_towers(monkeypatch)
    policy = {"suppressedCategories": [{"ccsr": "CIR019"}], "differentialTopN": 1}
    filtered = assembler.apply_display_policy(response, policy)
    for tower in filtered.differential.result["experimental_towers"].values():
        assert [i["ccsr"] for i in tower["items"]] == ["END002"]


def test_turning_m01_off_withholds_the_towers(monkeypatch):
    response = assess_with_towers(monkeypatch)
    filtered = assembler.apply_display_policy(response, {"enabled": {"M-01": False}})
    assert filtered.differential.result is None


def test_unconfirmed_timeline_taints_tower_c_only(monkeypatch):
    response = assess_with_towers(monkeypatch, {"needs_confirmation": ["coded_sequence[0]"]})
    towers = response.differential.result["experimental_towers"]
    assert all(i["from_unconfirmed_extraction"] for i in towers["C"]["items"])
    assert not any(i["from_unconfirmed_extraction"] for i in towers["B"]["items"])


def test_intake_models_are_unchanged_by_discharge_fields(monkeypatch):
    from app import predictors

    monkeypatch.setattr(predictors, "backend", lambda: real)
    monkeypatch.setattr(experimental, "towers", fake_towers)
    features = case()
    intake = real.readmission(features, "intake")
    response = assembler.assess(IntakeRequest(features=features, discharge=HOME), frame="intake")
    assert response.readmission.result["probability"] == intake.result["probability"]
