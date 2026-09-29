"""Clinical workspace, part two: admitting a patient, recording vitals,
escalating, and the nurse task list.

Split from `clinical.py`, which is about assessing an encounter that already
exists. This file is about the encounter arriving and the work around it.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac
from ..deps import Actor, current_actor, display_name, tenant_scope
from ..catalogs import known_lab_itemids
from ..errors import ApiError
from ..security import iso, utcnow
from .clinical import _encounter_or_404, _in_scope, scope_encounters

router = APIRouter(tags=["clinical"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NewEncounterRequest(Strict):
    mrn: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=120)
    sex: str
    unit_id: str
    bed: str = Field("", max_length=24)
    admission_type: str = Field("EW EMER.", max_length=60)
    via_ed: bool = True
    chief_complaint: str = Field("", max_length=400)
    #: Captured for the fairness audit only — never reaches a feature builder.
    race: str | None = None
    insurance: str | None = None
    marital_status: str | None = None


class VitalsRequest(Strict):
    bp_sys: float | None = Field(None, ge=40, le=300)
    bp_dia: float | None = Field(None, ge=20, le=200)
    weight_kg: float | None = Field(None, ge=20, le=300)
    height_cm: float | None = Field(None, ge=120, le=230)
    bmi: float | None = Field(None, ge=8, le=100)
    heart_rate: float | None = Field(None, ge=20, le=250)
    resp_rate: float | None = Field(None, ge=4, le=70)
    temp_c: float | None = Field(None, ge=30, le=44)
    spo2: float | None = Field(None, ge=50, le=100)
    #: MIMIC lab itemid -> value. Checked against the lab catalog below.
    labs: dict[str, float] = Field(default_factory=dict, max_length=40)
    #: False when the reading was taken after admission. Stored, never scored.
    at_t0: bool = True
    note: str | None = Field(None, max_length=500)


class EscalationRequest(Strict):
    to: str = Field(min_length=2, max_length=120)
    reason: str = Field(min_length=5, max_length=500)
    urgency: str = "routine"


class DraftRequest(Strict):
    #: The intake form exactly as it stands. Stored, never scored.
    draft: dict


class TaskRequest(Strict):
    label: str = Field(min_length=1, max_length=200)
    encounter_id: str | None = None


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# --- admitting --------------------------------------------------------------


@router.post("/encounters", status_code=201)
def create_encounter(
    body: NewEncounterRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Admit a patient.

    `t0` is stamped server-side from the clock, not accepted from the client.
    Every feature the models read is cut at this instant, so letting a caller
    choose it would let them move the cut — which is the time-travel failure
    the whole system is built to prevent.

    Race, insurance and marital status are accepted here because the fairness
    audit needs them, and are stored on the patient record as audit covariates.
    They are structurally unreachable from any feature builder.
    """
    rbac.require(actor, "patient:write")
    if body.sex not in {"F", "M"}:
        raise ApiError(422, "sex must be 'F' or 'M'.")

    units = [u for f in db.docs("SELECT doc FROM facilities WHERE tenant_id=?", (tenant_id,))
             for u in f.get("units", [])]
    unit = next((u for u in units if u["id"] == body.unit_id), None)
    if unit is None:
        raise ApiError(422, f"No unit '{body.unit_id}' in this tenant.")

    if db.connect().execute(
        "SELECT 1 FROM encounters WHERE mrn=? AND tenant_id=? AND state != 'closed'",
        (body.mrn, tenant_id),
    ).fetchone():
        raise ApiError(409, f"{body.mrn} already has an open encounter. "
                            "Open it rather than admitting a second one.")

    now = iso(utcnow())
    encounter_id = f"enc_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": encounter_id, "tenantId": tenant_id,
        "patient": {
            "id": f"pat_{uuid.uuid4().hex[:10]}", "mrn": body.mrn, "name": body.name,
            "age": body.age, "sex": body.sex,
            "auditCovariates": {
                "race": body.race or "Other/Declined",
                "insurance": body.insurance or "Self-pay",
                "maritalStatus": body.marital_status or "Single",
            },
        },
        "unitId": unit["id"], "unitName": unit["name"], "bed": body.bed or "—",
        "admittedAt": now, "t0": now,
        "admissionType": body.admission_type, "viaEd": body.via_ed,
        "chiefComplaint": body.chief_complaint,
        "attending": display_name(actor) if actor.role in {"physician", "resident", "np_pa"} else "Unassigned",
        "nurse": display_name(actor) if actor.role in {"charge_nurse", "staff_nurse"} else "Unassigned",
        "state": "intake_in_progress",
        "risks": {"mortality": None, "icu": None, "readmission": None,
                  "losLow": None, "losHigh": None},
        "topDifferential": [], "calibrated": False, "calibrationValidity": "full",
        "signalCompleteness": 0.0, "hasNotes": False, "hasPriorHistory": False,
        "assessmentCount": 0, "releasedToPatient": False,
    }
    db.insert_doc("encounters", doc, {
        "tenant_id": tenant_id, "unit_id": unit["id"], "state": "intake_in_progress",
        "mrn": body.mrn, "patient_id": doc["patient"]["id"], "t0": now, "released": 0,
    })
    audit.record(actor, "encounter.create", f"{body.mrn} - {encounter_id}",
                 tenant_id=tenant_id, ip=_ip(request))
    return doc


# --- intake draft -----------------------------------------------------------


@router.put("/encounters/{encounter_id}/draft")
def save_draft(
    encounter_id: str,
    body: DraftRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Keep an unfinished intake on the encounter so it survives a reload or a
    handover. A draft is never sent to a model; only Run assessment does that."""
    grade = rbac.require(actor, "patient:write")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    if len(json.dumps(body.draft)) > 50_000:
        raise ApiError(413, "That draft is too large to save.")
    saved = {"intakeDraft": body.draft, "draftSavedAt": iso(utcnow()), "draftSavedBy": display_name(actor)}
    db.patch_doc("encounters", encounter_id, saved)
    audit.record(actor, "encounter.draft_save", f"{enc['patient']['mrn']} - {encounter_id}",
                 tenant_id=tenant_id, ip=_ip(request))
    return saved


# --- vitals -----------------------------------------------------------------


@router.post("/encounters/{encounter_id}/vitals", status_code=201)
def record_vitals(
    encounter_id: str,
    body: VitalsRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Record a set of observations against an encounter.

    `at_t0=false` marks a reading taken after admission. It is stored and
    shown on the timeline, but it never reaches a model: a post-admission
    observation in an intake feature is precisely the leakage guardrail 1
    forbids. The response says which way it was filed so the screen can too.
    """
    grade = rbac.require(actor, "patient:write")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)

    values = body.model_dump(exclude={"at_t0", "note", "labs"})
    if all(v is None for v in values.values()) and not body.labs:
        raise ApiError(422, "No values supplied.")
    unknown = sorted(set(body.labs) - known_lab_itemids())
    if unknown:
        raise ApiError(422, "Unknown lab itemid.", detail={"itemids": unknown})
    values["labs"] = body.labs

    obs_id = f"obs_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": obs_id, "encounterId": encounter_id, "recordedAt": iso(utcnow()),
        "recordedBy": display_name(actor), "atT0": body.at_t0,
        "values": values, "note": body.note,
        "usableForScoring": body.at_t0,
    }
    db.connect().execute(
        "INSERT INTO observations (id, tenant_id, encounter_id, recorded_at, recorded_by, at_t0, doc)"
        " VALUES (?,?,?,?,?,?,?)",
        (obs_id, tenant_id, encounter_id, doc["recordedAt"], actor.email,
         1 if body.at_t0 else 0, json.dumps(doc)),
    )
    db.connect().commit()
    audit.record(actor, "vitals.record", f"{enc['patient']['mrn']} - {encounter_id}",
                 tenant_id=tenant_id, ip=_ip(request))
    return doc


@router.get("/encounters/{encounter_id}/vitals")
def list_vitals(
    encounter_id: str,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    grade = rbac.require(actor, "patient:read")
    _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    return {"observations": db.docs(
        "SELECT doc FROM observations WHERE encounter_id=? ORDER BY recorded_at DESC",
        (encounter_id,))}


# --- escalation -------------------------------------------------------------


@router.post("/encounters/{encounter_id}/escalate")
def escalate(
    encounter_id: str,
    body: EscalationRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Raise a patient to the attending on call.

    This is a clinical communication, not a system state: it records that a
    named person was asked to look, with a reason and a time. Nothing about
    the assessment changes.
    """
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    if body.urgency not in {"routine", "urgent", "immediate"}:
        raise ApiError(422, "urgency must be routine, urgent or immediate.")

    escalation = {
        "at": iso(utcnow()), "by": display_name(actor), "to": body.to,
        "reason": body.reason, "urgency": body.urgency,
    }
    history = [*enc.get("escalations", []), escalation]
    doc = db.patch_doc("encounters", encounter_id, {"escalations": history})
    audit.record(actor, "escalation.raise",
                 f"{enc['patient']['mrn']} - {encounter_id} -> {body.to}",
                 reason=body.reason, tenant_id=tenant_id, ip=_ip(request))
    return {"encounter": doc, "escalation": escalation}


# --- tasks ------------------------------------------------------------------


@router.get("/tasks")
def list_tasks(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    encounter_id: str | None = Query(None),
):
    """The nurse task list, narrowed to encounters this caller may see."""
    grade = rbac.require(actor, "patient:read")
    sql = "SELECT doc FROM tasks WHERE tenant_id=?"
    params: list = [tenant_id]
    if encounter_id:
        sql += " AND encounter_id=?"
        params.append(encounter_id)
    tasks = db.docs(sql, params)

    visible = {e["id"] for e in scope_encounters(
        actor, db.docs("SELECT doc FROM encounters WHERE tenant_id=?", (tenant_id,)), grade)}
    return {"tasks": [t for t in tasks
                      if not t.get("encounterId") or t["encounterId"] in visible]}


@router.post("/tasks", status_code=201)
def create_task(
    body: TaskRequest,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    grade = rbac.require(actor, "patient:read")
    if body.encounter_id:
        _in_scope(actor, _encounter_or_404(body.encounter_id, tenant_id), grade)

    doc = {"id": f"task_{uuid.uuid4().hex[:10]}", "encounterId": body.encounter_id,
           "label": body.label, "done": False, "doneBy": None, "doneAt": None}
    db.insert_doc("tasks", doc, {
        "tenant_id": tenant_id, "encounter_id": body.encounter_id,
        "label": body.label, "done": 0,
    })
    return doc


@router.post("/tasks/{task_id}/done")
def complete_task(
    task_id: str,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    done: bool = Query(True),
):
    """Tick or untick a task. Who ticked it and when is kept either way."""
    grade = rbac.require(actor, "patient:read")
    task = db.one_doc("SELECT doc FROM tasks WHERE id=? AND tenant_id=?", (task_id, tenant_id))
    if task is None:
        raise ApiError(404, "No such task.")
    if task.get("encounterId"):
        # Same scope as listing: a task you cannot see is not one you can tick.
        _in_scope(actor, _encounter_or_404(task["encounterId"], tenant_id), grade)

    doc = db.patch_doc("tasks", task_id, {
        "done": done,
        "doneBy": display_name(actor) if done else None,
        "doneAt": iso(utcnow()) if done else None,
    }, {"done": 1 if done else 0})
    return doc


# --- patient connection requests (§13.2) ------------------------------------
# A self-registered patient asks to be taken on by this hospital (POST
# /patient/connect). A clinician here accepts, which creates an encounter under
# them and links the patient's portal account to it, so releases reach the
# patient and the patient's submissions reach this encounter's "From the patient".


@router.get("/connection-requests")
def connection_requests(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Open patient connection requests for this hospital."""
    rbac.require(actor, "patient:write")
    rows = db.docs(
        "SELECT doc FROM service_requests WHERE tenant_id=? AND kind='connection_request'"
        " AND status='open'", (tenant_id,))
    return {"requests": sorted(rows, key=lambda r: r.get("requestedAt", ""), reverse=True)}


@router.post("/connection-requests/{request_id}/accept", status_code=201)
def accept_connection_request(
    request_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Take the patient on: create an encounter under this clinician and link the
    patient's portal account to it. The clinician completes intake afterwards."""
    rbac.require(actor, "patient:write")
    row = db.connect().execute(
        "SELECT doc, status FROM service_requests WHERE id=? AND tenant_id=?"
        " AND kind='connection_request'", (request_id, tenant_id)).fetchone()
    if row is None:
        raise ApiError(404, "No such connection request in this hospital.")
    req = json.loads(row["doc"])
    if row["status"] != "open":
        raise ApiError(409, f"This request is already {row['status']}.")

    units = [u for f in db.docs("SELECT doc FROM facilities WHERE tenant_id=?", (tenant_id,))
             for u in f.get("units", [])]
    if not units:
        raise ApiError(409, "Set up a facility and unit first (Admin -> Facilities), then accept.")
    unit = units[0]

    now = iso(utcnow())
    encounter_id = f"enc_{uuid.uuid4().hex[:10]}"
    enc_patient_id = f"pat_{uuid.uuid4().hex[:10]}"
    mrn = f"MRN-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "id": encounter_id, "tenantId": tenant_id,
        "patient": {
            "id": enc_patient_id, "mrn": mrn, "name": req.get("patientName") or req.get("patientEmail"),
            "age": req.get("age"), "sex": req.get("sex"),
            "auditCovariates": {"race": "Other/Declined", "insurance": "Self-pay", "maritalStatus": "Single"},
        },
        "unitId": unit["id"], "unitName": unit["name"], "bed": "-",
        "admittedAt": now, "t0": now, "admissionType": "ELECTIVE", "viaEd": 0,
        "chiefComplaint": req.get("reason") or "Patient-requested connection",
        "attending": display_name(actor) if actor.role in {"physician", "resident", "np_pa"} else "Unassigned",
        "nurse": display_name(actor) if actor.role in {"charge_nurse", "staff_nurse"} else "Unassigned",
        "state": "intake_in_progress",
        "risks": {"mortality": None, "icu": None, "readmission": None, "losLow": None, "losHigh": None},
        "topDifferential": [], "calibrated": False, "calibrationValidity": "full",
        "signalCompleteness": 0.0, "hasNotes": False, "hasPriorHistory": False,
        "assessmentCount": 0, "releasedToPatient": False,
        "connectedFrom": req.get("patientEmail"),
    }
    db.insert_doc("encounters", doc, {
        "tenant_id": tenant_id, "unit_id": unit["id"], "state": "intake_in_progress",
        "mrn": mrn, "patient_id": enc_patient_id, "t0": now, "released": 0})

    # Link the encounter's patient to the requesting portal account so releases
    # and submissions flow between them.
    links = db.document("portal_links") or {}
    links[enc_patient_id] = req.get("patientUserId")
    db.put_document("portal_links", links)

    # Close the request.
    conn = db.connect()
    conn.execute("UPDATE service_requests SET status='accepted' WHERE id=?", (request_id,))
    req["status"] = "accepted"; req["acceptedBy"] = display_name(actor); req["encounterId"] = encounter_id
    conn.execute("UPDATE service_requests SET doc=? WHERE id=?", (json.dumps(req), request_id))
    conn.commit()

    audit.record(actor, "patient.connect_accept",
                 f"{doc['patient']['name']} -> {encounter_id}", tenant_id=tenant_id, ip=_ip(request))
    return {"encounter": doc, "linked": True}
