"""MODEL_MODE=real — the trained bundles behind the predictor contract.

Skipped where the DUA-restricted exports, their serving reference, or the
pinned scientific stack are absent (CI, a fresh clone): those runs exercise
the stub, and these tests need the real artifacts to mean anything.
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

EXPORTS = Path(__file__).resolve().parents[4] / "ml-pipeline" / "model_exports"

pytest.importorskip("sklearn")
if not (EXPORTS / "serving_reference.json").is_file():
    pytest.skip("model exports / serving_reference.json not present", allow_module_level=True)

from app import assembler  # noqa: E402
from app.predictors import real  # noqa: E402
from app.schemas.clinical import IntakeFeatures, IntakeRequest  # noqa: E402


@pytest.fixture(autouse=True)
def exports(monkeypatch):
    monkeypatch.setattr(real, "settings", lambda: SimpleNamespace(exports_dir=EXPORTS))
    real.reset()
    yield
    real.reset()


def case(**over) -> IntakeFeatures:
    base = {
        "demographics": {"admission_age": 55, "is_female": 1},
        "admission_context": {"via_ed": 0, "admission_type": "ELECTIVE", "admission_location": "PHYSICIAN REFERRAL"},
        "vitals": {"bmi": 26.0, "bp_sys": 124, "bp_dia": 78},
        "labs": {"50912": 0.9, "51222": 13.5, "51301": 7.0, "50983": 139},
        "prior_history": {"prior_ccsr": [], "n_prior_admissions": 0, "charlson_index": 0},
        "meds": [],
    }
    for k, v in over.items():
        base[k] = {**base[k], **v} if isinstance(v, dict) else v
    return IntakeFeatures.model_validate(base)


SICK = dict(
    demographics={"admission_age": 84, "is_female": 0},
    admission_context={"via_ed": 1, "admission_type": "EW EMER.", "admission_location": "EMERGENCY ROOM"},
    vitals={"bp_sys": 86, "bp_dia": 50},
    labs={"50912": 3.4, "50813": 5.8, "51301": 22.0, "51222": 8.9, "50983": 129},
    prior_history={"prior_ccsr": ["CIR019", "GEN003", "END002"], "n_prior_admissions": 6, "charlson_index": 8},
    meds=["furosemide", "warfarin", "metoprolol"],
)


def test_ready_and_versions_are_traceable():
    ok, problems = real.ready()
    assert ok, problems
    out = real.mortality(case())
    assert out.status == "live"
    assert "sha256." in out.model_version


def test_library_drift_fails_readiness(monkeypatch):
    monkeypatch.setitem(real.TRAINED_WITH, "sklearn", "0.0.1")
    real.reset()
    ok, problems = real.ready()
    assert not ok and any("sklearn" in p for p in problems)
    with pytest.raises(real.ArtifactsUnavailable):
        real.mortality(case())


@pytest.mark.parametrize("fn", [real.mortality, real.icu])
def test_risk_orders_a_sick_patient_above_a_well_one(fn):
    well, sick = fn(case()), fn(case(**SICK))
    pw, ps = well.result["probability"], sick.result["probability"]
    assert 0 <= pw < ps <= 1
    assert well.result["population_percentile"] < sick.result["population_percentile"]
    assert sick.explanation.method == "marginal-occlusion"
    assert sick.explanation.top_contributors


def test_readmission_intake_frame_only():
    out = real.readmission(case(**SICK))
    assert out.result["frame"] == "intake" and out.result["lace_score"] is None
    with pytest.raises(real.ArtifactsUnavailable):
        real.readmission(case(), "discharge")


def test_los_interval_contains_its_point():
    r = real.los(case(**SICK)).result
    assert 0 <= r["interval_low"] <= r["point_days"] <= r["interval_high"]
    assert r["level"] == pytest.approx(0.95, abs=0.01)


def test_differential_is_exact_linear_and_history_matters():
    out = real.differential(case(**SICK), top_n=10)
    items = out.result["items"]
    assert len(items) == 10
    probs = [i["probability"] for i in items]
    assert probs == sorted(probs, reverse=True)
    assert all(i["explanation"]["reconstruction_ok"] for i in items)
    assert out.result["unscored_ccsr_count"] == 5

    def p_of(code, feats):
        for i in real.differential(feats, top_n=459).result["items"]:
            if i["ccsr"] == code:
                return i["probability"]
        return 0.0

    with_hf = case(prior_history={"prior_ccsr": ["CIR019"], "n_prior_admissions": 1, "charlson_index": 1})
    assert p_of("CIR019", with_hf) > p_of("CIR019", case())


def test_unknown_meds_are_reported_not_guessed():
    out = real.differential(case(meds=["metoprolol", "not-a-drug-xyz"]), top_n=5)
    assert out.result["unmatched_meds"] == ["not-a-drug-xyz"]


def test_missing_values_use_train_medians_so_calibration_stays_full():
    fc, warnings = real.coverage(case(vitals={"bmi": None, "bp_sys": None, "bp_dia": None}, labs={}))
    assert fc.calibration_validity == "full"
    assert any("cold-start" in w for w in warnings)


def test_whole_assessment_through_the_assembler(monkeypatch):
    monkeypatch.setattr(assembler.predictors, "backend", lambda: real)
    resp = assembler.assess(IntakeRequest.model_validate({"features": case(**SICK).model_dump()}))
    for key in ("differential", "mortality", "icu", "readmission", "los"):
        outcome = getattr(resp, key)
        assert outcome.status == "live", (key, outcome.error)
