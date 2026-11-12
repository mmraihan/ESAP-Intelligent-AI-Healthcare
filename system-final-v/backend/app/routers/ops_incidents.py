"""Operations console, part two: incident handling, the plan catalogue, and
the refusal side of break-glass.

Split from `ops.py` to keep that file about the fleet and this one about what
operators do to it hour by hour.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac, settings_store
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(prefix="/ops", tags=["ops"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IncidentRequest(Strict):
    title: str = Field(min_length=5, max_length=200)
    component: str = Field(min_length=2, max_length=80)
    severity: str = "warning"
    detail: str = Field(min_length=5, max_length=2000)
    tenant_name: str | None = None
    #: Personal data may have been exposed (QA issue 7). Starts the clocks.
    breach: bool = False
    data_categories: list[str] = Field(default_factory=list, max_length=20)
    affected_estimate: int | None = Field(None, ge=0)


class BreachRequest(Strict):
    breach: bool
    #: When ESAP became aware. The deadlines run from here, not from opening.
    aware_at: str | None = None
    data_categories: list[str] = Field(default_factory=list, max_length=20)
    affected_estimate: int | None = Field(None, ge=0)
    note: str = Field(min_length=5, max_length=1000)


class NotificationRequest(Strict):
    kind: str
    #: Who it went to, e.g. the hospital's DPO, or the SDAIA reference number.
    recipient: str = Field(min_length=2, max_length=200)
    reference: str | None = Field(None, max_length=120)
    note: str | None = Field(None, max_length=1000)


# --- personal-data breach clocks (QA issue 7) --------------------------------
# ESAP processes personal data for the hospital (the controller). Two clocks
# start when ESAP becomes aware of a breach:
#   24 h  tell the affected hospital, so it can meet its own deadline;
#   72 h  the hospital notifies SDAIA (Saudi PDPL implementing regulation).
# People affected are told without undue delay when the breach is likely to
# harm them. The hours are config, because contracts may set shorter ones.

BREACH_CLOCKS = {
    "controller": {"hours": 24, "label": "Tell the affected hospital (controller)"},
    "regulator": {"hours": 72, "label": "Notify SDAIA (Saudi Data & AI Authority)"},
    "data_subjects": {"hours": None, "label": "Tell the people affected, without undue delay"},
}


def _deadlines(aware_at: str) -> dict:
    aware = datetime.fromisoformat(aware_at.replace("Z", "+00:00"))
    return {k: (iso(aware + timedelta(hours=v["hours"])) if v["hours"] else None)
            for k, v in BREACH_CLOCKS.items()}


def _breach_block(aware_at: str, categories: list[str], affected: int | None) -> dict:
    return {
        "awareAt": aware_at,
        "dataCategories": categories,
        "affectedEstimate": affected,
        "deadlines": _deadlines(aware_at),
        "notifications": {},
    }


def templates_for(incident: dict) -> dict:
    """Plain-text notices with this incident's facts filled in. A starting point
    for a person to edit and send; nothing here is sent automatically."""
    b = incident.get("breach") or {}
    cats = ", ".join(b.get("dataCategories") or []) or "[types of personal data]"
    count = b.get("affectedEstimate")
    people = f"about {count}" if count is not None else "[number of]"
    tenant = incident.get("tenantName") or "[hospital name]"
    aware = b.get("awareAt") or "[date and time]"
    due_controller = (b.get("deadlines") or {}).get("controller") or "[24 h]"
    controller = "\n".join([
        f"To the Data Protection Officer, {tenant}",
        "",
        f"ESAP became aware of a personal data breach at {aware} (UTC).",
        "",
        f"What happened: {incident['detail']}",
        f"Data involved: {cats}",
        f"People affected: {people}",
        f"Component: {incident['component']}",
        "",
        "What we have done so far: [containment steps]",
        "What we recommend you do: [actions for the hospital]",
        "",
        "Under the Saudi PDPL you, as the controller, must notify SDAIA within 72 hours of becoming aware.",
        f"Our deadline to you is {due_controller}.",
        "",
        "Contact: ESAP incident lead, [name, phone, email]",
        f"ESAP incident reference: {incident['id']}",
    ])
    regulator = "\n".join([
        "To: Saudi Data & AI Authority (SDAIA), National Data Management Office",
        "",
        f"Controller: {tenant}",
        "Processor: ESAP Clinical AI",
        f"Date and time the breach was discovered: {aware} (UTC)",
        f"Description: {incident['detail']}",
        f"Categories of personal data: {cats}",
        f"Approximate number of data subjects: {people}",
        "Likely consequences: [assessment of harm]",
        "Measures taken or proposed: [containment and remediation]",
        "Contact point: [DPO name and contact details]",
        f"Reference: {incident['id']}",
    ])
    subjects = "\n".join([
        f"We are writing to tell you about a problem that affected personal information held by {tenant}.",
        "",
        "What happened: [plain-language summary]",
        f"What information was involved: {cats}",
        "What we are doing: [steps taken]",
        "What you can do: [practical advice]",
        "",
        "If you have questions, contact our Data Protection Officer: [contact details].",
    ])
    return {
        "controller": {"subject": f"Personal data breach notice: {incident['title']}", "body": controller},
        "regulator": {"subject": f"PDPL breach notification: {tenant}", "body": regulator},
        "data_subjects": {"subject": "Important: about your personal information", "body": subjects},
    }


def _with_templates(doc: dict) -> dict:
    return {**doc, "templates": templates_for(doc)} if doc.get("breach") else doc


class IncidentStateRequest(Strict):
    state: str
    note: str = Field(min_length=5, max_length=1000)


class DenyRequest(Strict):
    reason: str = Field(min_length=10, max_length=500)


class PlanRequest(Strict):
    tier: str = Field(min_length=2, max_length=40)
    patch: dict = Field(default_factory=dict)
    reason: str = Field(min_length=5, max_length=400)


def _platform(actor: Actor) -> None:
    if not actor.is_platform:
        raise ApiError(403, "This console is platform-operations only.")


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# --- incidents --------------------------------------------------------------


@router.post("/incidents", status_code=201)
def open_incident(body: IncidentRequest, request: Request,
                  actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    if body.severity not in {"info", "notice", "warning", "critical"}:
        raise ApiError(422, "severity must be info, notice, warning or critical.")

    doc = {
        "id": f"inc_{uuid.uuid4().hex[:8]}", "title": body.title,
        "tenantName": body.tenant_name, "severity": body.severity, "state": "open",
        "openedAt": iso(utcnow()), "component": body.component, "detail": body.detail,
        "updates": [],
    }
    if body.breach:
        doc["breach"] = _breach_block(doc["openedAt"], body.data_categories, body.affected_estimate)
    db.insert_doc("incidents", doc, {
        "tenant_name": body.tenant_name, "severity": body.severity, "state": "open",
    })
    audit.record(actor, "incident.update", f"opened: {body.title}",
                 platform=True, ip=_ip(request))
    if body.breach:
        audit.record(actor, "incident.breach_flag", f"{doc['id']}: breach flagged",
                     platform=True, ip=_ip(request))
    return _with_templates(doc)


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str, actor: Actor = Depends(current_actor)):
    _platform(actor)
    incident = db.one_doc("SELECT doc FROM incidents WHERE id=?", (incident_id,))
    if incident is None:
        raise ApiError(404, "No such incident.")
    return _with_templates(incident)


@router.post("/incidents/{incident_id}/breach")
def flag_breach(incident_id: str, body: BreachRequest, request: Request,
                actor: Actor = Depends(current_actor)):
    """Mark (or unmark) an incident as a personal-data breach. Flagging starts
    the 24 h and 72 h clocks from the time ESAP became aware."""
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    incident = db.one_doc("SELECT doc FROM incidents WHERE id=?", (incident_id,))
    if incident is None:
        raise ApiError(404, "No such incident.")
    if body.breach:
        aware = body.aware_at or (incident.get("breach") or {}).get("awareAt") or iso(utcnow())
        try:
            parsed = datetime.fromisoformat(aware.replace("Z", "+00:00"))
        except ValueError:
            raise ApiError(422, "aware_at must be an ISO date and time.") from None
        # A time with no zone is UTC (what the templates say). Normalising also
        # keeps every stored deadline in one format, so "late" compares right.
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        if parsed > utcnow() + timedelta(minutes=5):
            raise ApiError(422, "aware_at cannot be in the future.")
        aware = iso(parsed)
        block = _breach_block(aware, body.data_categories, body.affected_estimate)
        block["notifications"] = (incident.get("breach") or {}).get("notifications", {})
        changes = {"breach": block}
    else:
        changes = {"breach": None, "breachCleared": {"at": iso(utcnow()), "by": display_name(actor),
                                                      "note": body.note}}
    update = {"at": iso(utcnow()), "by": display_name(actor), "state": incident["state"],
              "note": f"{'Breach flagged' if body.breach else 'Breach flag removed'}: {body.note}"}
    changes["updates"] = [*incident.get("updates", []), update]
    doc = db.patch_doc("incidents", incident_id, changes)
    audit.record(actor, "incident.breach_flag" if body.breach else "incident.breach_unflag",
                 f"{incident_id}: {body.note}", platform=True, ip=_ip(request))
    return _with_templates(doc)


@router.post("/incidents/{incident_id}/notifications")
def record_notification(incident_id: str, body: NotificationRequest, request: Request,
                        actor: Actor = Depends(current_actor)):
    """Record that a breach notice was sent: who to, when, and its reference."""
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    if body.kind not in BREACH_CLOCKS:
        raise ApiError(422, f"kind must be one of: {', '.join(BREACH_CLOCKS)}.")
    incident = db.one_doc("SELECT doc FROM incidents WHERE id=?", (incident_id,))
    if incident is None:
        raise ApiError(404, "No such incident.")
    breach = incident.get("breach")
    if not breach:
        raise ApiError(409, "Flag this incident as a breach first.")
    now = iso(utcnow())
    due = breach["deadlines"].get(body.kind)
    entry = {"sentAt": now, "by": display_name(actor), "recipient": body.recipient,
             "reference": body.reference, "note": body.note,
             "late": bool(due and now > due)}
    breach = {**breach, "notifications": {**breach.get("notifications", {}), body.kind: entry}}
    doc = db.patch_doc("incidents", incident_id, {"breach": breach})
    audit.record(actor, "incident.breach_notice", f"{incident_id}: {body.kind} -> {body.recipient}",
                 platform=True, ip=_ip(request))
    return _with_templates(doc)


@router.post("/incidents/{incident_id}/state")
def set_incident_state(
    incident_id: str,
    body: IncidentStateRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
):
    """Move an incident between open, mitigating and resolved.

    Every transition carries a note and is appended to the incident's own
    update trail rather than overwriting the last one, so the history of what
    was believed at each point survives. A postmortem needs the wrong guesses
    as much as the right conclusion.
    """
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    if body.state not in {"open", "mitigating", "resolved"}:
        raise ApiError(422, "state must be open, mitigating or resolved.")

    incident = db.one_doc("SELECT doc FROM incidents WHERE id=?", (incident_id,))
    if incident is None:
        raise ApiError(404, "No such incident.")

    update = {"at": iso(utcnow()), "by": display_name(actor),
              "state": body.state, "note": body.note}
    doc = db.patch_doc("incidents", incident_id, {
        "state": body.state,
        "updates": [*incident.get("updates", []), update],
        "resolvedAt": iso(utcnow()) if body.state == "resolved" else None,
    }, {"state": body.state})
    audit.record(actor, "incident.update", f"{incident['title']} -> {body.state}",
                 platform=True, ip=_ip(request))
    return doc


@router.post("/incidents/{incident_id}/update")
def publish_incident_update(
    incident_id: str,
    body: IncidentStateRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
):
    """Append an update without changing the incident's state."""
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    incident = db.one_doc("SELECT doc FROM incidents WHERE id=?", (incident_id,))
    if incident is None:
        raise ApiError(404, "No such incident.")

    update = {"at": iso(utcnow()), "by": display_name(actor),
              "state": incident["state"], "note": body.note, "published": True}
    doc = db.patch_doc("incidents", incident_id,
                       {"updates": [*incident.get("updates", []), update]})
    audit.record(actor, "incident.update", f"{incident['title']}: update published",
                 platform=True, ip=_ip(request))
    return doc


# --- break-glass: the refusal side -----------------------------------------


@router.post("/break-glass/{grant_id}/deny")
def deny_break_glass(
    grant_id: str,
    body: DenyRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
):
    """Refuse a pending break-glass request.

    A refusal is recorded as fully as an approval. "Who asked for access to
    this patient and was told no" is exactly as important to a later review as
    who was granted it.
    """
    _platform(actor)
    rbac.require_elevatable(actor)
    grant = db.one_doc("SELECT doc FROM break_glass WHERE id=?", (grant_id,))
    if grant is None:
        raise ApiError(404, "No such grant.")
    if grant["status"] != "pending_approval":
        raise ApiError(409, f"This grant is already {grant['status']}.")

    doc = db.patch_doc("break_glass", grant_id, {
        "status": "revoked", "approver": display_name(actor), "denialReason": body.reason,
    }, {"status": "revoked"})
    audit.record(actor, "break_glass.deny", f"grant:{grant_id}", reason=body.reason,
                 tenant_id=grant["tenantId"], platform=True, ip=_ip(request))
    return doc


# --- plan catalogue ---------------------------------------------------------


@router.post("/plans")
def update_plan(body: PlanRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Edit a commercial plan.

    Existing hospitals are not re-priced by this: the catalogue describes what
    a new contract gets, and the response says so, because a plan edit that
    silently changed live invoices would be discovered at the worst moment.

    A safety feature cannot be moved into a plan here. Calibration, the Why
    panel, the degraded label and the stratified evidence are identical on
    every tier, and the endpoint refuses any patch that tries otherwise.
    """
    _platform(actor)
    rbac.require(actor, "tenant:create")

    forbidden = {"calibration", "explainability", "why_panel", "degraded_label",
                 "fairness", "stratified_evidence", "leakage_alarm"}
    touched = {str(k).lower() for k in body.patch} | {
        str(v).lower() for v in body.patch.values() if isinstance(v, str)}
    if touched & forbidden:
        raise ApiError(
            403,
            "Safety features are never gated by plan. Calibration, the Why panel, the "
            "degraded label and the stratified evidence are identical on every tier.",
        )

    catalog = settings_store.read("plan_catalog", "_platform")["settings"]
    overrides = dict(catalog.get("overrides", {}))
    overrides[body.tier] = {**overrides.get(body.tier, {}), **body.patch}
    result = settings_store.write("plan_catalog", "_platform",
                                  {"overrides": overrides}, actor.email)
    audit.record(actor, "plan.update", f"plan:{body.tier}", reason=body.reason,
                 platform=True, ip=_ip(request))
    return {**result, "existing_tenants_affected": False,
            "note": "The catalogue describes new contracts. Live invoices are unchanged."}
