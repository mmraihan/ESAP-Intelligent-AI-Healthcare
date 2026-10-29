"""The clinical surface: worklist, intake, assess, explain, acknowledge, release.

`/assess` is the primary endpoint — one IntakeCase in, all five models out,
one response. Per API_CONTRACT §3 it answers 200 for any well-formed request:
a model that fails is carried as `status:"error"` in its own envelope so the
rest of the panel still renders.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Body, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import assembler, audit, db, entitlements, rbac, settings_store
from ..config import settings
from ..deps import Actor, current_actor, display_name, tenant_scope
from ..errors import ApiError
from ..schemas.clinical import (
    AssessResponse,
    ExtractionRequest,
    ExtractionResponse,
    IntakeRequest,
)
from ..security import iso, utcnow

router = APIRouter(tags=["clinical"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AcknowledgeRequest(Strict):
    note: str | None = Field(None, max_length=2000)


class ReleaseRequest(Strict):
    headline: str = Field(min_length=1, max_length=300)
    plain_language: str = Field(min_length=1, max_length=4000)
    what_this_means: list[str] = Field(default_factory=list, max_length=10)
    questions_to_ask: list[str] = Field(default_factory=list, max_length=10)


class CloseRequest(Strict):
    note: str | None = Field(None, max_length=2000)
    discharge_location: str | None = Field(None, max_length=120)


def _encounter_or_404(encounter_id: str, tenant_id: str) -> dict:
    enc = db.one_doc("SELECT doc FROM encounters WHERE id=? AND tenant_id=?", (encounter_id, tenant_id))
    if enc is None:
        raise ApiError(404, "No such encounter in this tenant.")
    return enc


def _unit_of(encounter_id: str | None, tenant_id: str) -> str | None:
    """The encounter's unit, for the display policy's per-unit override only.

    A raw peek at one field — not a permission check, not the scope guard. The
    real `patient:read` gate on this encounter is applied separately (below,
    for the write path; by the caller for a read). This exists only so a unit
    that suppressed a model on its own patients actually gets that respected.
    """
    if not encounter_id:
        return None
    row = db.one_doc("SELECT doc FROM encounters WHERE id=? AND tenant_id=?", (encounter_id, tenant_id))
    return (row or {}).get("unitId")


def _in_scope(actor: Actor, enc: dict, grade: str) -> dict:
    """Guard a single-encounter read against the caller's scope.

    Listing and fetching must agree. Otherwise a scoped role that cannot see a
    patient on the worklist could still open them by guessing an id, and the
    scope filter would be decoration.
    """
    if not scope_encounters(actor, [enc], grade):
        raise ApiError(403, "That patient is outside your assigned scope.")
    return enc


def scope_encounters(actor: Actor, rows: list[dict], grade: str) -> list[dict]:
    """Apply a `scoped` permission grade to a worklist read.

    A scoped role sees its own unit or its own roster, not the whole hospital.
    The filter runs server-side: a UI that forgets to narrow the list must not
    be the only thing standing between a nurse and every patient in the tenant.

    It fails **closed**. If no scope can be established for the caller — no
    directory record, no units, no roster — the answer is an empty list, not
    the whole ward. An unknown scope is the case where the wrong default is
    most dangerous, so it gets the safe one.
    """
    if grade == "none" or (grade == "breakglass" and not actor.elevation):
        return []  # no standing access is no rows, even for a caller that forgot to check
    if grade != "scoped":
        return rows
    if actor.role == "patient":
        return []  # the portal is the patient's surface; the worklist never is
    user = db.one_doc("SELECT doc FROM users WHERE email=?", (actor.email,))
    unit_ids = set((user or {}).get("unitIds") or [])
    name = _person((user or {}).get("name"))
    if not unit_ids and not name:
        return []
    return [
        r for r in rows
        if r.get("unitId") in unit_ids
        or (name and name in {_person(r.get("nurse")), _person(r.get("attending"))})
    ]


def _person(name: str | None) -> str | None:
    """A name without its honorific or credentials, for matching.

    The directory says "Amara Okonkwo, MD"; a chart says "Dr. Amara Okonkwo".
    Compared verbatim they never match, and an attending's own patients drop
    off their worklist.
    """
    if not name:
        return None
    core = name.split(",")[0].strip()
    if core.lower().startswith("dr. "):
        core = core[4:].strip()
    return core.lower() or None


# --- worklist ---------------------------------------------------------------


@router.get("/encounters")
def list_encounters(
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    unit_id: str | None = Query(None),
    state: str | None = Query(None),
    q: str | None = Query(None, max_length=120),
    limit: int = Query(200, ge=1, le=500),
):
    grade = rbac.require(actor, "patient:read")
    sql = "SELECT doc FROM encounters WHERE tenant_id=?"
    params: list = [tenant_id]
    if unit_id:
        sql += " AND unit_id=?"
        params.append(unit_id)
    if state:
        sql += " AND state=?"
        params.append(state)
    sql += " ORDER BY t0 DESC LIMIT ?"
    params.append(limit)

    rows = scope_encounters(actor, db.docs(sql, params), grade)
    if q:
        needle = q.strip().lower()
        rows = [
            r for r in rows
            if needle in r["patient"]["name"].lower()
            or needle in r["patient"]["mrn"].lower()
            or needle in r["chiefComplaint"].lower()
        ]
    return {"encounters": rows, "scope": grade, "count": len(rows)}


@router.get("/encounters/{encounter_id}")
def get_encounter(
    encounter_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    audit.record(
        actor, "encounter.view", f"{enc['patient']['mrn']} · {encounter_id}",
        tenant_id=tenant_id, ip=request.client.host if request.client else "unknown",
    )
    return enc


@router.get("/encounters/{encounter_id}/assessments")
def encounter_assessments(
    encounter_id: str,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Assessment history for the timeline — newest first."""
    grade = rbac.require(actor, "patient:read")
    _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    rows = db.connect().execute(
        "SELECT id, created_at, actor_id, request, response FROM assessments"
        " WHERE encounter_id=? ORDER BY created_at DESC",
        (encounter_id,),
    ).fetchall()
    return {
        "assessments": [
            {"id": r["id"], "created_at": r["created_at"], "actor": r["actor_id"],
             # What the models were given. Features only: the audit covariates
             # recorded beside them are for the fairness audit, not this screen.
             "features": json.loads(r["request"]).get("features", {}),
             "response": json.loads(r["response"])}
            for r in rows
        ]
    }


# --- assess -----------------------------------------------------------------


@router.post("/assess", response_model=AssessResponse)
def assess(
    body: IntakeRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    top_n: int = Query(10, ge=1, le=50),
    frame: str = Query("intake"),
):
    rbac.require(actor, "assess:run")
    if frame not in {"intake", "discharge"}:
        raise ApiError(400, "frame must be 'intake' or 'discharge'.")
    if frame == "discharge":
        # The discharge frame needs post-t0 fields the intake contract does not
        # carry. Guessing them would be the exact time-travel guardrail 1 forbids.
        raise ApiError(
            400,
            "frame=discharge needs los_hours and discharge_location, which an intake case does not carry.",
        )

    response = assembler.assess(body, top_n=top_n, frame=frame)
    # Apply this tenant's Settings → Model display policy at the serving boundary:
    # withhold models turned off here, drop suppressed CCSR categories, cap the
    # differential. A display decision, so it lives here and not in a predictor.
    policy = settings_store.read("model_display", actor.tenant_id)["settings"]
    policy = assembler.merge_unit_override(policy, _unit_of(body.encounter_id, actor.tenant_id))
    response = assembler.apply_display_policy(response, policy)
    # Then the plan boundary: a model the tenant's plan does not include is
    # withheld regardless of the display toggle.
    response = assembler.apply_entitlements(response, entitlements.models_allowed(actor.tenant_id, actor.user_id))

    encounter_id = body.encounter_id
    if encounter_id:
        # Writing the result onto a chart is a chart access, so it needs the
        # same patient:read check and scope as opening that chart.
        enc = _in_scope(actor, _encounter_or_404(encounter_id, actor.tenant_id),
                        rbac.require(actor, "patient:read"))
        patch = assembler.worklist_patch(response)
        patch["assessmentCount"] = int(enc.get("assessmentCount", 0)) + 1
        db.patch_doc("encounters", encounter_id, patch, {"state": "assessed"})

    db.connect().execute(
        "INSERT INTO assessments (id, encounter_id, tenant_id, actor_id, created_at, request, response)"
        " VALUES (?,?,?,?,?,?,?)",
        (response.request_id, encounter_id, actor.tenant_id, actor.email, iso(utcnow()),
         body.model_dump_json(), response.model_dump_json()),
    )
    db.connect().commit()

    audit.record(
        actor, "assess.run", encounter_id or f"ad-hoc:{response.request_id}",
        tenant_id=actor.tenant_id, ip=request.client.host if request.client else "unknown",
    )
    return response


def _single(model_key: str, body: IntakeRequest, actor: Actor, **kw):
    rbac.require(actor, "assess:run")
    full = assembler.assess(body, **kw)
    policy = settings_store.read("model_display", actor.tenant_id)["settings"]
    policy = assembler.merge_unit_override(policy, _unit_of(body.encounter_id, actor.tenant_id))
    full = assembler.apply_display_policy(full, policy)
    full = assembler.apply_entitlements(full, entitlements.models_allowed(actor.tenant_id, actor.user_id))
    return getattr(full, model_key)


@router.post("/predict/differential")
def predict_differential(body: IntakeRequest, actor: Actor = Depends(current_actor),
                         top_n: int = Query(10, ge=1, le=50)):
    return _single("differential", body, actor, top_n=top_n)


@router.post("/predict/mortality")
def predict_mortality(body: IntakeRequest, actor: Actor = Depends(current_actor)):
    return _single("mortality", body, actor)


@router.post("/predict/icu")
def predict_icu(body: IntakeRequest, actor: Actor = Depends(current_actor)):
    return _single("icu", body, actor)


@router.post("/predict/readmission")
def predict_readmission(body: IntakeRequest, actor: Actor = Depends(current_actor),
                        frame: str = Query("intake")):
    if frame not in {"intake", "discharge"}:
        raise ApiError(400, "frame must be 'intake' or 'discharge'.")
    if frame == "discharge":
        raise ApiError(400, "frame=discharge needs los_hours and discharge_location (post-t0 fields).")
    return _single("readmission", body, actor, frame=frame)


@router.post("/predict/los")
def predict_los(body: IntakeRequest, actor: Actor = Depends(current_actor)):
    return _single("los", body, actor)


# --- explain ----------------------------------------------------------------


@router.post("/explain")
def explain(
    body: IntakeRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    model_id: str = Query("M-02"),
):
    """Faithful drivers for one model on one case (EXPLAINABILITY.md).

    Computed from the model that produced the number, never reconstructed from
    the score afterwards. `reconstruction_ok` on the payload is the self-check:
    contributions + intercept must rebuild the logit.
    """
    rbac.require(actor, "explain:view")
    key = {"M-01": "differential", "M-02": "mortality", "M-03": "icu",
           "M-04": "readmission", "M-05": "los"}.get(model_id.upper())
    if key is None:
        raise ApiError(400, "model_id must be one of M-01 … M-05.")

    full = assembler.assess(body)
    outcome = getattr(full, key)
    audit.record(
        actor, "explanation.view", f"{model_id}:{full.request_id}",
        ip=request.client.host if request.client else "unknown",
    )
    if model_id.upper() == "M-01":
        items = (outcome.result or {}).get("items", [])
        return {"model_id": model_id, "per_label": [
            {"ccsr": i["ccsr"], "explanation": i.get("explanation")} for i in items
        ]}
    return {"model_id": model_id, "explanation": outcome.explanation, "outcome": outcome}


# --- acknowledge / release --------------------------------------------------


@router.post("/encounters/{encounter_id}/acknowledge")
def acknowledge(
    encounter_id: str,
    request: Request,
    body: AcknowledgeRequest = Body(default=AcknowledgeRequest()),
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """A clinician records that they have read the assessment.

    Residents acknowledge into `awaiting_cosign` when the tenant requires a
    co-sign: the §4.6 `cosign` grade is an access grade, not a UI hint, so the
    server is what decides the resulting state.
    """
    # Acknowledging is a clinical sign-off, so it takes the capability that
    # produces assessments — the same one the Results screen gates the button
    # on. patient:read alone would let an auditor or pharmacist sign one off.
    rbac.require(actor, "assess:run")
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    if enc["state"] not in {"assessed", "acknowledged", "awaiting_cosign"}:
        raise ApiError(409, f"An encounter in state '{enc['state']}' has no assessment to acknowledge.")

    who = display_name(actor)

    # An attending acting on an encounter a resident submitted for co-sign
    # COMPLETES the co-sign: it keeps the resident's acknowledgement and adds the
    # named co-signer, rather than overwriting who reviewed it. "Attending" here
    # means anyone whose own sign-off does not itself need a co-sign — i.e. any
    # grade other than `cosign` (a resident cannot co-sign another's work).
    if enc["state"] == "awaiting_cosign" and grade != "cosign":
        doc = db.patch_doc(
            "encounters", encounter_id,
            {"state": "acknowledged", "cosignBy": who, "cosignedAt": iso(utcnow())},
            {"state": "acknowledged"},
        )
        audit.record(
            actor, "result.cosign", f"{enc['patient']['mrn']} · {encounter_id}",
            tenant_id=tenant_id, ip=request.client.host if request.client else "unknown",
        )
        return {"encounter": doc, "requires_cosign": False, "cosigned": True}

    # The §4.6 grade says a resident *may* need a co-sign; the tenant's policy
    # (Roles & scopes → "Require attending co-sign") says whether this one does.
    policy = settings_store.read("org", tenant_id)["settings"]
    needs_cosign = grade == "cosign" and bool(policy.get("requireResidentCosign", True))
    state = "awaiting_cosign" if needs_cosign else "acknowledged"

    changes = {"state": state, "acknowledgedBy": who, "acknowledgedAt": iso(utcnow())}
    if needs_cosign:
        changes["cosignBy"] = None  # a named co-signer is assigned, not assumed
    doc = db.patch_doc("encounters", encounter_id, changes, {"state": state})
    audit.record(
        actor, "result.acknowledge", f"{enc['patient']['mrn']} · {encounter_id}",
        tenant_id=tenant_id, ip=request.client.host if request.client else "unknown",
    )
    return {"encounter": doc, "requires_cosign": needs_cosign}


@router.post("/encounters/{encounter_id}/close")
def close_encounter(
    encounter_id: str,
    request: Request,
    body: CloseRequest = Body(default=CloseRequest()),
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Close (discharge) an encounter — the transition the §4.6 co-sign gate protects.

    An encounter can only close once its assessment has been signed off. When a
    resident's acknowledgement is still ``awaiting_cosign``, closing it is the
    attending's co-sign: a caller whose ``patient:read`` grade is ``cosign``
    (i.e. themselves needs a co-sign) cannot close it, and the attending who does
    is recorded as the co-signer.
    """
    rbac.require(actor, "assess:run")
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)

    state = enc["state"]
    if state == "closed":
        raise ApiError(409, "This encounter is already closed.")
    if state not in {"assessed", "acknowledged", "awaiting_cosign"}:
        raise ApiError(409, f"An encounter in state '{state}' cannot be closed — assess and acknowledge it first.")

    changes: dict = {
        "state": "closed",
        "closedBy": display_name(actor),
        "closedAt": iso(utcnow()),
    }
    if body.discharge_location:
        changes["dischargeLocation"] = body.discharge_location
    if body.note:
        changes["closeNote"] = body.note

    if state == "awaiting_cosign":
        # Closing an awaiting_cosign encounter IS the attending co-sign. Someone
        # who themselves needs a co-sign cannot supply it.
        if grade == "cosign":
            raise ApiError(403, "This encounter is awaiting an attending co-sign; a resident cannot close it.")
        changes["cosignBy"] = display_name(actor)
        changes["cosignAt"] = iso(utcnow())

    doc = db.patch_doc("encounters", encounter_id, changes, {"state": "closed"})
    audit.record(
        actor, "encounter.close", f"{enc['patient']['mrn']} · {encounter_id}",
        tenant_id=tenant_id, ip=request.client.host if request.client else "unknown",
    )
    return {"encounter": doc, "cosigned": state == "awaiting_cosign"}


@router.post("/encounters/{encounter_id}/release")
def release_to_patient(
    encounter_id: str,
    body: ReleaseRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Release a plain-language summary to the patient portal (§13.6).

    The raw score never crosses this boundary. What the patient receives is the
    clinician's written summary; `rawScoreWithheld` is hardcoded true here so no
    caller can opt into sending a probability to a patient.
    """
    grade = rbac.require(actor, "patient:write")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    if enc["state"] not in {"assessed", "acknowledged", "awaiting_cosign", "closed"}:
        raise ApiError(409, "Nothing has been assessed on this encounter yet.")

    doc = {
        "id": f"rr_{uuid.uuid4().hex[:10]}",
        "encounterId": encounter_id,
        "releasedAt": iso(utcnow()),
        "releasedBy": display_name(actor),
        "headline": body.headline,
        "plainLanguage": body.plain_language,
        "whatThisMeans": body.what_this_means,
        "questionsToAsk": body.questions_to_ask,
        "rawScoreWithheld": True,
    }
    # Filed under the encounter's own patient. Only a patient linked to a
    # portal account is readable there; everyone else's release waits on their
    # record rather than landing in somebody else's portal.
    patient_id = enc["patient"]["id"]
    patient_id = (db.document("portal_links") or {}).get(patient_id, patient_id)
    db.insert_doc("released_results", doc, {
        "patient_id": patient_id, "encounter_id": encounter_id, "released_at": doc["releasedAt"],
    })
    db.patch_doc("encounters", encounter_id, {"releasedToPatient": True}, {"released": 1})
    audit.record(
        actor, "result.release", f"{enc['patient']['mrn']} · {encounter_id}",
        tenant_id=tenant_id, ip=request.client.host if request.client else "unknown",
    )
    return doc


# --- extraction (§4, stub) --------------------------------------------------


@router.post("/extract", response_model=ExtractionResponse)
def extract(body: ExtractionRequest, actor: Actor = Depends(current_actor)):
    """Narrative -> IntakeCase draft. Stub: it maps nothing and says so.

    The hard rule it already enforces is the one that matters: a draft is never
    auto-submitted, and any prior condition or lab value it ever proposes is
    `needs_confirmation=true` regardless of confidence. Shipping a permissive
    stub now would set the wrong default for the real extractor later.
    """
    rbac.require(actor, "patient:write")
    from ..schemas.clinical import Demographics, IntakeFeatures

    return ExtractionResponse(
        features=IntakeFeatures(demographics=Demographics(admission_age=0, is_female=0)),
        fields=[],
        ask_back=[
            "How old is the patient, and what is their recorded sex?",
            "What brought them in today?",
        ],
        unresolved=[body.text[:200]] if body.text.strip() else [],
        model_status="stub",
    )


@router.post("/assess/from-text")
def assess_from_text(body: ExtractionRequest, actor: Actor = Depends(current_actor)):
    """Extract then assess — blocked until the extraction is confirmed.

    No prediction is returned without a `confirmed:true` echo of the
    load-bearing fields (API_CONTRACT §1). Scoring an unconfirmed extraction is
    how a mis-mapped phrase becomes a diagnosis nobody typed.
    """
    rbac.require(actor, "assess:run")
    extraction = extract(body, actor)
    if not body.confirmed:
        return {
            "extraction": extraction,
            "assessment": None,
            "blocked_reason": "Confirm the extracted fields before an assessment is produced.",
        }
    raise ApiError(
        503,
        "Extraction is a stub in this build; there is nothing confirmed to assess. "
        "Use POST /api/v1/assess with a structured case.",
    )


# --- prefill (gated) --------------------------------------------------------


@router.get("/cases/{hadm_id}/prefill")
def prefill(hadm_id: str, actor: Actor = Depends(current_actor)):
    """Prefill an IntakeCase from `ml.*`. Auth + a non-prod entitlement (§8)."""
    rbac.require(actor, "patient:write")
    if not settings().allow_prefill:
        raise ApiError(403, "Prefill is disabled. It requires a non-production entitlement.")
    raise ApiError(503, "Prefill needs the MIMIC-derived ml.* tables, which this deployment does not mount.")
