"""Patient portal, part two: symptom intake, pre-visit preparation and family
access.

Split from `patient.py`, which serves what the portal reads. This file is what
the patient writes.
"""

from __future__ import annotations

import json
import secrets
import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, settings_store
from ..deps import Actor, current_actor
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(prefix="/patient", tags=["patient"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SymptomIntake(Strict):
    """What the patient says, in their own words.

    Deliberately free text plus a few structured scales. It is not parsed into
    clinical codes here: mapping a patient's phrase to a diagnosis code is the
    extraction problem, and doing it badly would put an unreviewed diagnosis
    into a clinician's differential.
    """

    describe: str = Field(min_length=1, max_length=4000)
    since: str | None = Field(None, max_length=120)
    severity: int | None = Field(None, ge=0, le=10)
    getting_worse: bool | None = None
    missed_doses: bool | None = None
    concerns: list[str] = Field(default_factory=list, max_length=20)
    medications: str | None = Field(None, max_length=2000)
    questions: list[str] = Field(default_factory=list, max_length=20)


class PreVisitNote(Strict):
    visit_with: str = Field(min_length=1, max_length=160)
    questions: list[str] = Field(default_factory=list, max_length=20)
    changes_since_last: str | None = Field(None, max_length=2000)
    medications_changed: bool = False


class ConnectRequest(Strict):
    """A self-registered patient asking to be taken on by a hospital. Age and sex
    are collected here so the encounter a clinician creates on acceptance has real
    demographics rather than placeholders."""
    hospital_id: str = Field(min_length=2, max_length=40)
    age: int = Field(ge=0, le=120)
    sex: str = Field(pattern="^[FM]$")
    reason: str | None = Field(None, max_length=500)


class FamilyAccessRequest(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    relationship: str = Field(min_length=2, max_length=60)
    scope: list[str] = Field(min_length=1, max_length=20)
    level: str = Field("view_summaries", pattern="^(view_summaries|view_all|act_on_behalf)$")
    notify_on_view: bool = True
    expires_at: str | None = None


def _me(actor: Actor) -> str:
    if actor.role != "patient":
        raise ApiError(403, "The patient portal serves the patient's own record only.")
    org = settings_store.read("org", actor.tenant_id)["settings"]
    if org.get("patientPortalEnabled", True) is False:
        raise ApiError(403, "The patient portal is turned off for this hospital. Contact them directly.")
    return actor.user_id


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _store(patient_id: str, kind: str, doc: dict) -> None:
    key = f"patient_submissions:{patient_id}"
    existing = db.document(key) or []
    db.put_document(key, [{**doc, "kind": kind}, *existing][:100])


@router.post("/intake", status_code=201)
def submit_symptoms(body: SymptomIntake, request: Request,
                    actor: Actor = Depends(current_actor)):
    """Send how you are feeling to the care team.

    This reaches the team as the patient's own words. It is never scored and
    never becomes a prior condition: a symptom a patient describes is a reason
    to look, not a diagnosis on their record.
    """
    patient_id = _me(actor)
    doc = {
        "id": f"sym_{uuid.uuid4().hex[:10]}", "submittedAt": iso(utcnow()),
        "describe": body.describe, "since": body.since, "severity": body.severity,
        "gettingWorse": body.getting_worse, "missedDoses": body.missed_doses, "concerns": body.concerns,
        "medications": body.medications, "questions": body.questions,
        "scored": False,
        "note": "Shared with your care team as written. It is not used to produce a score.",
    }
    _store(patient_id, "symptoms", doc)
    audit.record(actor, "patient.submit", f"symptom intake:{doc['id']}", ip=_ip(request))
    return doc


@router.post("/previsit", status_code=201)
def submit_previsit(body: PreVisitNote, request: Request,
                    actor: Actor = Depends(current_actor)):
    """Prepare information ahead of an appointment."""
    patient_id = _me(actor)
    doc = {
        "id": f"pre_{uuid.uuid4().hex[:10]}", "submittedAt": iso(utcnow()),
        "visitWith": body.visit_with, "questions": body.questions,
        "changesSinceLast": body.changes_since_last,
        "medicationsChanged": body.medications_changed,
    }
    _store(patient_id, "previsit", doc)
    audit.record(actor, "patient.submit", f"pre-visit:{doc['id']}", ip=_ip(request))
    return doc


@router.get("/submissions")
def list_submissions(actor: Actor = Depends(current_actor)):
    """Everything this patient has sent, newest first."""
    patient_id = _me(actor)
    return {"submissions": db.document(f"patient_submissions:{patient_id}") or []}


@router.post("/family", status_code=201)
def grant_family_access(body: FamilyAccessRequest, request: Request,
                        actor: Actor = Depends(current_actor)):
    """Give a relative or carer their own access.

    Their own sign-in, not a shared password: a shared password makes the
    audit log unable to say who actually looked. It is recorded as a consent
    like any other, so it appears on Share & consent and can be withdrawn
    from there.
    """
    patient_id = _me(actor)
    # A single-use acceptance token so the carer can set up THEIR OWN sign-in
    # (the docstring's promise): the credential is the link, never a shared
    # password, so the audit log can say which person actually looked.
    token = f"cg_{secrets.token_urlsafe(24)}"
    pu = db.one_doc("SELECT doc FROM users WHERE id=?", (patient_id,))
    patient_name = (pu or {}).get("name") or "your family member"
    email = body.email.strip().lower()
    doc = {
        "id": f"c_{uuid.uuid4().hex[:10]}", "grantee": f"{body.name} ({body.relationship})",
        "granteeType": "caregiver", "purpose": "Caregiver access", "scope": body.scope,
        "grantedAt": iso(utcnow()), "expiresAt": body.expires_at, "status": "active",
        "inviteEmail": email, "relationship": body.relationship,
        "level": body.level, "notifyOnView": body.notify_on_view, "proxyName": body.name,
    }
    db.insert_doc("consents", doc, {"patient_id": patient_id, "status": "active"})
    db.put_document(f"caregiver_invite:{token}", {
        "token": token, "consentId": doc["id"], "patientId": patient_id,
        "patientName": patient_name, "tenantId": actor.tenant_id, "email": email,
        "name": body.name, "relationship": body.relationship, "level": body.level,
        "status": "pending", "createdAt": iso(utcnow()),
    })
    audit.record(actor, "consent.grant", doc["grantee"], ip=_ip(request))
    return {**doc, "acceptToken": token, "acceptPath": f"/caregiver/accept/{token}"}


@router.get("/for-caregiver")
def for_caregiver(actor: Actor = Depends(current_actor)):
    """The people this signed-in account is a carer for, with what they may see.

    A carer's own record is empty; this is where their access actually lives. The
    consent `level` decides how much: summaries only, or summaries plus the full
    record. Never a raw score — the same §13.6 gate as the patient's own view.
    """
    links = (db.document("caregiver_links") or {}).get(actor.email, [])
    out = []
    for link in links:
        if link.get("status") == "revoked":
            continue
        pid = link["patientId"]
        released = db.docs(
            "SELECT doc FROM released_results WHERE patient_id=? ORDER BY released_at DESC", (pid,))
        records = []
        if link.get("level") in ("view_all", "act_on_behalf"):
            records = db.docs(
                "SELECT doc FROM records WHERE patient_id=? ORDER BY date DESC", (pid,))
        out.append({
            "patientName": link.get("patientName"), "relationship": link.get("relationship"),
            "level": link.get("level"), "released": released, "records": records,
            "raw_scores_withheld": True,
        })
    return {"caring_for": out}


@router.get("/family")
def list_family(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    rows = db.docs("SELECT doc FROM consents WHERE patient_id=?", (patient_id,))
    return {"family": [c for c in rows if c.get("granteeType") == "caregiver"]}


# --- connect to a hospital (§13.2) ------------------------------------------
# A self-registered (individual-tier) patient asks a hospital to take them on. A
# clinician there accepts the request, which creates an encounter under them and
# links this portal account to it — after which releases reach the patient and
# the patient's submissions reach the clinician.

@router.get("/hospitals")
def hospitals(actor: Actor = Depends(current_actor)):
    """The hospitals a patient can request to connect with. Names only, no PHI."""
    _me(actor)
    rows = db.docs("SELECT doc FROM tenants")
    return {"hospitals": [{"id": t["id"], "name": t["name"], "slug": t.get("slug")}
                          for t in rows if t.get("id") != "t_solo" and t.get("status") != "suspended"]}


@router.post("/connect", status_code=201)
def connect(body: ConnectRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Request to be taken on by a hospital. Lands in that hospital's connection
    queue for a clinician to accept."""
    patient_id = _me(actor)
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (body.hospital_id,))
    if tenant is None:
        raise ApiError(404, "No such hospital.")
    user = db.connect().execute("SELECT name FROM users WHERE email=?", (actor.email,)).fetchone()
    name = (user["name"] if user else None) or actor.email
    existing = db.connect().execute(
        "SELECT 1 FROM service_requests WHERE requester=? AND kind='connection_request'"
        " AND tenant_id=? AND status='open'", (actor.email, body.hospital_id)).fetchone()
    if existing:
        raise ApiError(409, "You already have a pending request with this hospital.")
    rid = f"cr_{uuid.uuid4().hex[:10]}"
    now = iso(utcnow())
    doc = {
        "id": rid, "kind": "connection_request", "label": "Patient connection request",
        "status": "open", "tenantId": body.hospital_id, "requestedAt": now,
        "requestedBy": name, "requestedByEmail": actor.email,
        "patientUserId": patient_id, "patientName": name, "patientEmail": actor.email,
        "age": body.age, "sex": body.sex, "reason": (body.reason or "").strip() or None,
    }
    conn = db.connect()
    conn.execute(
        "INSERT INTO service_requests (id, tenant_id, requester, kind, status, created_at, doc)"
        " VALUES (?,?,?,?,?,?,?)",
        (rid, body.hospital_id, actor.email, "connection_request", "open", now, json.dumps(doc)))
    conn.commit()
    audit.record(actor, "patient.connect_request", f"{name} -> {tenant['name']}",
                 tenant_id=body.hospital_id, ip=_ip(request))
    return doc


@router.get("/connect")
def my_connect_requests(actor: Actor = Depends(current_actor)):
    """This patient's own connection requests and their status."""
    _me(actor)
    rows = db.docs("SELECT doc FROM service_requests WHERE requester=? AND kind='connection_request'",
                   (actor.email,))
    return {"requests": sorted(rows, key=lambda r: r.get("requestedAt", ""), reverse=True)}
