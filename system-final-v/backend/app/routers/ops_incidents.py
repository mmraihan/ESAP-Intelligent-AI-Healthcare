"""Operations console, part two: incident handling, the plan catalogue, and
the refusal side of break-glass.

Split from `ops.py` to keep that file about the fleet and this one about what
operators do to it hour by hour.
"""

from __future__ import annotations

import uuid

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
    db.insert_doc("incidents", doc, {
        "tenant_name": body.tenant_name, "severity": body.severity, "state": "open",
    })
    audit.record(actor, "incident.update", f"opened: {body.title}",
                 platform=True, ip=_ip(request))
    return doc


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
