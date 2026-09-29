"""Reference catalogs and the model registry — `/schema/*` and `/models`."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from .. import catalogs, db, predictors
from ..deps import Actor, current_actor
from ..errors import ApiError

router = APIRouter(tags=["catalog"])


@router.get("/schema/labs")
def schema_labs(_: Actor = Depends(current_actor), panel: str | None = Query(None)):
    labs = catalogs.LABS
    if panel:
        labs = [lab for lab in labs if (lab.get("panel") or "").lower() == panel.lower()]
    return {"labs": labs, "count": len(labs)}


@router.get("/schema/ccsr")
def schema_ccsr(_: Actor = Depends(current_actor), family: str | None = Query(None)):
    rows = catalogs.CCSR
    if family:
        rows = [c for c in rows if c["family"].lower() == family.lower()]
    families = sorted({c["family"] for c in catalogs.CCSR})
    return {"ccsr": rows, "families": families, "count": len(rows)}


@router.get("/schema/vocab/meds")
def schema_meds(_: Actor = Depends(current_actor), q: str | None = Query(None, max_length=60)):
    names = catalogs.MEDS
    if q:
        needle = q.strip().lower()
        names = [n for n in names if needle in n]
    return {"meds": [{"name": n} for n in names], "count": len(names)}


@router.get("/schema/enums")
def schema_enums(_: Actor = Depends(current_actor)):
    return {
        "admission_type": catalogs.ADMISSION_TYPES,
        "admission_location": catalogs.ADMISSION_LOCATIONS,
    }


def _registry() -> list[dict]:
    """The registry the governance screens read.

    `status` is the *serving* status, so in stub mode every row says "stub" —
    the model cards keep their governance metrics (those describe the trained
    artifact and are still true), but nothing here claims a stub is live.
    """
    cards = db.document("models") or []
    serving_stub = predictors.mode() != "real"
    served: dict[str, str] = {}
    ready, env = False, {"sklearn": None, "matched": None}
    if not serving_stub:
        backend = predictors.backend()
        ready, problems = backend.ready()
        served = backend.served_versions()
        try:
            import sklearn

            env = {"sklearn": sklearn.__version__, "matched": not any("sklearn" in p for p in problems)}
        except ImportError:
            env = {"sklearn": None, "matched": False}
    rows: list[dict] = []
    for card in cards:
        ref = card.get("headline", [{}])[0]
        if serving_stub:
            status = "stub"
        else:
            status = card["status"] if ready else "not_ready"
        rows.append({
            "model_id": card["id"],
            "name": card["name"],
            "status": status,
            "served_by": "stub" if serving_stub else "tower_a",
            "fusion_status": "tower_a_only",
            "towers_used": ["A"],
            "model_version": served.get(card["id"], card["version"]),
            "trained": card["trainedOn"],
            "ref_metric": {"name": ref.get("label"), "value": ref.get("value")},
            "calibration": card["calibrationMethod"],
            "ece": card["ece"],
            "strata": card["strata"],
            "leakage_alarm": card["leakageAlarm"],
            "negative_control": card["negativeControl"],
            "last_evaluated": card["lastEvaluated"],
            "cohort_n": card["cohortN"],
            "loaded": (not serving_stub) and ready,
            "reason": predictors.backend().STUB_REASON if serving_stub else (None if ready else "artifacts not ready — see /readyz"),
            "env": env,
        })

    # The towers that are honestly not built. The UI says "Tower A only"
    # everywhere; this is the registry saying the same thing.
    rows += [
        {"model_id": "M-01-towerB", "name": "Clinical-text tower", "status": "stub",
         "reason": "poc_only_pending_leakage_negcontrol", "enabled": False, "loaded": False},
        {"model_id": "M-01-towerC", "name": "Coded-sequence tower", "status": "stub",
         "reason": "not_trained_at_full_scale", "enabled": False, "loaded": False},
        {"model_id": "M-01-fusion", "name": "A+B+C fusion", "status": "stub",
         "reason": "towers_not_ready", "enabled": False, "loaded": False},
    ]
    return rows


@router.get("/models")
def models(_: Actor = Depends(current_actor)):
    return _registry()


@router.get("/models/cards")
def model_cards(_: Actor = Depends(current_actor)):
    """The full model cards (§18) — stratified metrics, ECE, negative control."""
    return {"models": db.document("models") or [], "drift": db.document("drift") or []}


@router.get("/models/{model_id}")
def model_detail(model_id: str, _: Actor = Depends(current_actor)):
    wanted = model_id.upper()
    for row in _registry():
        if row["model_id"].upper() == wanted:
            card = next((c for c in (db.document("models") or []) if c["id"].upper() == wanted), None)
            return {"registry": row, "card": card}
    raise ApiError(404, f"No model '{model_id}' in the registry.")


@router.get("/public/evidence")
def public_evidence():
    """What the public website shows before anyone signs in: the model cards
    (read from the training runs' metrics files) and the plan catalogue.

    Public on purpose — it is the evidence a hospital reads before buying — and
    it carries no patient data, no tenant data and no usage figures.
    """
    from .. import settings_store

    return {"models": db.document("models") or [], "plans": settings_store.plans()}


@router.get("/public/demo-accounts")
def public_demo_accounts():
    """The accounts the sign-in page's demo picker offers, one per role.

    Only served when ESAP_DEMO_PICKER is on (the default for this demo build);
    a real deployment switches it off and the picker disappears. The password
    is not included — it is the stated demo password, typed by the picker.
    """
    import os

    if os.environ.get("ESAP_DEMO_PICKER", "true").strip().lower() not in {"1", "true", "yes", "on"}:
        return {"enabled": False, "accounts": {}}
    identities = db.document("demo_identity") or {}
    return {"enabled": True, "accounts": {r: v for r, v in identities.items() if r != "guest"}}
