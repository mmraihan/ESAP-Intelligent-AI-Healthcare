"""Admin console, part two: facilities and units, invitation reminders,
password resets, integration tests and the refusal side of interop.

Split from `admin.py` to keep that file about people and governance and this
one about the estate. Same `/admin` prefix, same tenant wall.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac, settings_store
from ..deps import Actor, current_actor, end_sessions, tenant_scope
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(prefix="/admin", tags=["admin"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FacilityRequest(Strict):
    name: str = Field(min_length=2, max_length=160)
    type: str = "hospital"
    beds: int = Field(0, ge=0, le=10_000)


class UnitRequest(Strict):
    name: str = Field(min_length=1, max_length=120)
    service_line: str = Field(min_length=1, max_length=80)
    beds: int = Field(0, ge=0, le=2_000)
    occupied: int = Field(0, ge=0, le=2_000)


class RejectRequest(Strict):
    reason: str = Field(min_length=5, max_length=400)


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# --- facilities and units ---------------------------------------------------


@router.post("/facilities", status_code=201)
def create_facility(
    body: FacilityRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "tenant:manage")
    if body.type not in {"hospital", "clinic", "ed"}:
        raise ApiError(422, "type must be hospital, clinic or ed.")
    doc = {
        "id": f"f_{uuid.uuid4().hex[:8]}", "tenantId": tenant_id, "name": body.name,
        "type": body.type, "beds": body.beds, "units": [],
    }
    db.insert_doc("facilities", doc, {"tenant_id": tenant_id, "name": body.name})
    audit.record(actor, "facility.create", body.name, tenant_id=tenant_id, ip=_ip(request))
    return doc


@router.patch("/facilities/{facility_id}")
def update_facility(
    facility_id: str,
    body: FacilityRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "tenant:manage")
    if db.one_doc("SELECT doc FROM facilities WHERE id=? AND tenant_id=?",
                  (facility_id, tenant_id)) is None:
        raise ApiError(404, "No such facility in this tenant.")
    doc = db.patch_doc("facilities", facility_id,
                       {"name": body.name, "type": body.type, "beds": body.beds},
                       {"name": body.name})
    audit.record(actor, "facility.update", body.name, tenant_id=tenant_id, ip=_ip(request))
    return doc


@router.post("/facilities/{facility_id}/units", status_code=201)
def create_unit(
    facility_id: str,
    body: UnitRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "tenant:manage")
    facility = db.one_doc("SELECT doc FROM facilities WHERE id=? AND tenant_id=?",
                          (facility_id, tenant_id))
    if facility is None:
        raise ApiError(404, "No such facility in this tenant.")
    if body.occupied > body.beds:
        raise ApiError(422, "A unit cannot have more occupied beds than beds.")

    unit = {"id": f"u_{uuid.uuid4().hex[:8]}", "name": body.name,
            "serviceLine": body.service_line, "beds": body.beds, "occupied": body.occupied}
    db.patch_doc("facilities", facility_id, {"units": [*facility.get("units", []), unit]})
    audit.record(actor, "unit.create", f"{facility['name']} - {body.name}",
                 tenant_id=tenant_id, ip=_ip(request))
    return unit


@router.delete("/facilities/{facility_id}/units/{unit_id}")
def delete_unit(
    facility_id: str,
    unit_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Remove a unit.

    Refused while active encounters are still assigned to it. A unit that
    vanishes from under an occupied bed leaves those patients off every
    roster, which is a worse outcome than a stale row on a settings screen.
    """
    rbac.require(actor, "tenant:manage")
    facility = db.one_doc("SELECT doc FROM facilities WHERE id=? AND tenant_id=?",
                          (facility_id, tenant_id))
    if facility is None:
        raise ApiError(404, "No such facility in this tenant.")

    occupants = db.connect().execute(
        "SELECT count(*) c FROM encounters WHERE unit_id=? AND tenant_id=? AND state != 'closed'",
        (unit_id, tenant_id),
    ).fetchone()["c"]
    if occupants:
        raise ApiError(409, f"{occupants} active encounter(s) are still on this unit. "
                            "Move or discharge them first.")

    units = [u for u in facility.get("units", []) if u["id"] != unit_id]
    if len(units) == len(facility.get("units", [])):
        raise ApiError(404, "No such unit on this facility.")
    db.patch_doc("facilities", facility_id, {"units": units})
    audit.record(actor, "unit.delete", f"{facility['name']} - {unit_id}",
                 tenant_id=tenant_id, ip=_ip(request))
    return {"deleted": unit_id, "units": units}


# --- people -----------------------------------------------------------------


@router.post("/invites/{invite_id}/remind")
def remind_invite(
    invite_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "user:manage")
    invite = db.one_doc("SELECT doc FROM invites WHERE id=? AND tenant_id=?",
                        (invite_id, tenant_id))
    if invite is None:
        raise ApiError(404, "No such invitation.")
    if invite["status"] != "pending":
        raise ApiError(409, f"This invitation is {invite['status']}; "
                            "there is nothing to remind about.")

    doc = db.patch_doc("invites", invite_id,
                       {"remindersSent": int(invite.get("remindersSent", 0)) + 1})
    audit.record(actor, "invite.send", f"reminder: {invite['email']}",
                 tenant_id=tenant_id, ip=_ip(request))
    return doc


@router.post("/users/{user_id}/password-reset")
def reset_password(
    user_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Start a password reset.

    Live sessions are ended. If the reset was triggered because an account may
    be compromised, leaving the current session signed in defeats the point.
    """
    rbac.require(actor, "user:manage")
    user = db.one_doc("SELECT doc FROM users WHERE id=? AND tenant_id=?", (user_id, tenant_id))
    if user is None:
        raise ApiError(404, "No such user in this tenant.")

    end_sessions(user["email"])
    audit.record(actor, "user.password_reset", user["email"], tenant_id=tenant_id, ip=_ip(request))
    return {"user": user, "sessions_ended": True,
            "note": "A reset link would be emailed here. Existing sessions have been ended."}


# --- integrations -----------------------------------------------------------


@router.post("/integrations/{key}/test")
def test_integration(
    key: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Run a connection test against one integration.

    This deployment has no live EHR to dial, so a configured endpoint reports
    `unverified` rather than a green tick. A connection test that always
    passes is worse than no test at all: it is exactly the check people trust
    when the feed has in fact stopped.
    """
    rbac.require(actor, "tenant:manage")
    current = settings_store.read("integrations", tenant_id)["settings"]
    if key not in current:
        raise ApiError(404, f"No integration '{key}'. Known: {sorted(current)}")

    configured = bool(current[key].get("endpoint")) and bool(current[key].get("enabled"))
    status = "unverified" if configured else "not_configured"
    detail = ("Endpoint is configured, but this deployment has no live EHR to dial. "
              "Reported as unverified, not healthy."
              if configured else "No endpoint configured.")
    tested_at = iso(utcnow())
    settings_store.write("integrations", tenant_id,
                         {key: {"status": status, "lastTestedAt": tested_at}}, actor.email)
    audit.record(actor, "integration.test", key, tenant_id=tenant_id, ip=_ip(request))
    return {"integration": key, "status": status, "detail": detail, "tested_at": tested_at}


# --- interop: the refusal side ---------------------------------------------


@router.post("/interop/{transfer_id}/reject")
def reject_transfer(
    transfer_id: str,
    body: RejectRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Reject an inbound transfer. The reason is mandatory and recorded.

    Rejecting is as consequential as approving — it is a decision that a
    record does not belong to this patient — so it carries the same trail.
    """
    rbac.require(actor, "transfer:approve")
    transfer = db.one_doc("SELECT doc FROM transfers WHERE id=? AND tenant_id=?", (transfer_id, tenant_id))
    if transfer is None:
        raise ApiError(404, "No such transfer.")
    if transfer["state"] in {"delivered", "rejected", "expired"}:
        raise ApiError(409, f"A transfer in state '{transfer['state']}' cannot be rejected.")

    doc = db.patch_doc("transfers", transfer_id,
                       {"state": "rejected", "note": body.reason}, {"state": "rejected"})
    audit.record(actor, "transfer.reject", f"{transfer_id} - {transfer['mrn']}",
                 reason=body.reason, tenant_id=tenant_id, ip=_ip(request))
    return doc
