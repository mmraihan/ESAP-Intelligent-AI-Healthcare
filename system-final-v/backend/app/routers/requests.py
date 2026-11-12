"""Service requests — `POST /api/v1/requests`, `GET /api/v1/requests`.

The product has a family of buttons that ask a person to do something rather
than change data directly: a patient messaging their care team, asking for a
record from another hospital or a correction to their own, flagging a result
as urgent; a billing admin asking for their account team; platform staff
opening a subprocessor review. Each used to show a confirmation while sending
nothing.

They land here as one kind of record, because what matters about them is the
same: who asked, what for, when, and that it is on the audit trail. Every kind
declares who may raise it, so a patient cannot open a platform review and a
clinician cannot file a request as a patient.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac
from ..care_team import has_care_team
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["requests"])


@dataclass(frozen=True)
class Kind:
    label: str
    #: "patient" = the signed-in patient only; otherwise a permission any-of.
    who: str | tuple[str, ...]
    platform: bool = False
    urgent: bool = False


KINDS: dict[str, Kind] = {
    # Patient portal
    "care_team_message": Kind("Message to a care team member", "patient"),
    "liaison_contact": Kind("Patient liaison contact request", "patient"),
    "result_question": Kind("Question about a released result", "patient"),
    "result_explain_request": Kind("Request for a nurse to explain a result", "patient"),
    "result_urgent_flag": Kind("Result flagged urgent by the patient", "patient", urgent=True),
    "record_request": Kind("Request for a record from another hospital", "patient"),
    "record_correction": Kind("Request to correct the record", "patient"),
    "account_closure": Kind("Account closure request", "patient"),
    # Hospital admin console
    "account_team_contact": Kind("Account team contact request", ("billing:view", "tenant:manage")),
    # Platform ops console
    "subprocessor_review": Kind("Subprocessor review", ("tenant:create",), platform=True),
}


class ServiceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    detail: str = Field(min_length=1, max_length=2000)
    #: What it is about: a care-team member, a record, a result. Free text.
    ref: str | None = Field(None, max_length=160)


def _authorize(actor: Actor, kind: Kind) -> None:
    if kind.who == "patient":
        if actor.role != "patient":
            raise ApiError(403, "Only the patient can raise this request on their own record.")
        return
    if kind.platform and not actor.is_platform:
        raise ApiError(403, "This request is raised from the platform operations console.")
    if not any(rbac.can(actor.role, p) for p in kind.who):
        raise ApiError(403, f"Raising this request needs one of: {', '.join(kind.who)}.")


def _target_tenant(actor: Actor) -> str:
    """Where a patient's message/request should land.

    A self-registered patient who has been taken on by a hospital (an accepted
    connection request) has their messages routed to that hospital, so its
    clinicians and admin see them. Otherwise the request stays in the actor's
    own tenant."""
    if actor.role != "patient":
        return actor.tenant_id
    accepted = [
        r for r in db.docs(
            "SELECT doc FROM service_requests WHERE requester=? AND kind='connection_request'"
            " AND status='accepted'", (actor.email,))
    ]
    if accepted:
        accepted.sort(key=lambda r: r.get("requestedAt", ""), reverse=True)
        return accepted[0].get("tenantId", actor.tenant_id)
    return actor.tenant_id


def _open_support_ticket(actor: Actor, label: str, detail: str, ref: str | None, now: str) -> str:
    """File a patient's request in the ESAP support queue, which platform staff work."""
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (actor.tenant_id,)) or {}
    ticket = {
        "id": f"tk_{uuid.uuid4().hex[:10]}",
        "subject": label[:160],
        "category": "data_or_results",
        "priority": "normal",
        "status": "open",
        "requesterName": display_name(actor),
        "requesterEmail": actor.email,
        "requesterRole": actor.role,
        "tenantId": actor.tenant_id,
        "tenantName": tenant.get("name"),
        "assignee": None,
        "awaiting": "support",
        "messages": [{"id": f"m_{uuid.uuid4().hex[:8]}", "at": now, "author": display_name(actor),
                      "fromStaff": False,
                      "body": (f"{detail}\n\nAbout: {ref}" if ref else detail)[:5000]}],
        "createdAt": now,
        "updatedAt": now,
        "source": "patient_request_no_care_team",
    }
    db.connect().execute(
        "INSERT INTO support_tickets (id, tenant_id, requester, status, priority, created_at, updated_at, doc)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (ticket["id"], actor.tenant_id, actor.email, "open", "normal", now, now, json.dumps(ticket)),
    )
    return ticket["id"]


@router.post("/requests", status_code=201)
def create_request(body: ServiceRequest, request: Request, actor: Actor = Depends(current_actor)):
    kind = KINDS.get(body.kind)
    if kind is None:
        raise ApiError(422, f"Unknown request kind '{body.kind}'. Known: {sorted(KINDS)}")
    _authorize(actor, kind)

    target_tenant = _target_tenant(actor)
    # A patient with no hospital behind them has no care team to read this. It
    # goes to ESAP support instead, and the response says so (QA issue 23).
    to_support = kind.who == "patient" and not has_care_team(actor.user_id, actor.email)
    doc = {
        "id": f"rq_{uuid.uuid4().hex[:10]}",
        "kind": body.kind,
        "label": kind.label,
        "detail": body.detail,
        "ref": body.ref,
        "status": "open",
        "urgent": kind.urgent,
        "requestedAt": iso(utcnow()),
        "requestedBy": display_name(actor),
        "requestedByEmail": actor.email,
        "tenantId": target_tenant,
        "routedTo": "esap_support" if to_support else ("platform" if kind.platform else "care_team"),
    }
    conn = db.connect()
    if to_support:
        doc["supportTicketId"] = _open_support_ticket(actor, kind.label, body.detail, body.ref, doc["requestedAt"])
    conn.execute(
        "INSERT INTO service_requests (id, tenant_id, requester, kind, status, created_at, doc)"
        " VALUES (?,?,?,?,?,?,?)",
        (doc["id"], target_tenant, actor.email, body.kind, "open", doc["requestedAt"], json.dumps(doc)),
    )
    conn.commit()
    audit.record(
        actor, "request.urgent" if kind.urgent else "request.create",
        f"{kind.label}{f' · {body.ref}' if body.ref else ''}",
        tenant_id=target_tenant, platform=kind.platform,
        ip=request.client.host if request.client else "unknown",
    )
    return doc


@router.get("/requests")
def list_requests(
    actor: Actor = Depends(current_actor),
    kind: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """What this caller may see: a patient their own; staff their tenant's."""
    if actor.role == "patient":
        sql, params = "SELECT doc FROM service_requests WHERE requester=?", [actor.email]
    elif actor.is_platform:
        sql, params = "SELECT doc FROM service_requests WHERE 1=1", []
    elif rbac.can(actor.role, "tenant:manage") or rbac.can(actor.role, "audit:view"):
        sql, params = "SELECT doc FROM service_requests WHERE tenant_id=?", [actor.tenant_id]
    else:
        sql, params = "SELECT doc FROM service_requests WHERE requester=?", [actor.email]
    if kind:
        sql += " AND kind=?"
        params.append(kind)
    sql += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    return {"requests": db.docs(sql, params)}


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    note: str | None = Field(None, max_length=500)


@router.post("/requests/{request_id}/status")
def set_status(request_id: str, body: StatusChange, request: Request,
               actor: Actor = Depends(current_actor)):
    """Work a request: open -> in_progress -> closed.

    Whoever may read a tenant's queue may work it; platform staff work the
    platform kinds. The requester cannot close their own request, so "handled"
    always means someone other than the person who asked looked at it.
    """
    if body.status not in {"open", "in_progress", "closed"}:
        raise ApiError(422, "status must be open, in_progress or closed.")
    row = db.one_doc("SELECT doc FROM service_requests WHERE id=?", (request_id,))
    if row is None:
        raise ApiError(404, "No such request.")
    kind = KINDS.get(row["kind"])
    if kind is not None and kind.platform:
        allowed = actor.is_platform
    else:
        allowed = row.get("tenantId") == actor.tenant_id and (
            rbac.can(actor.role, "tenant:manage") or rbac.can(actor.role, "audit:view"))
    if not allowed:
        raise ApiError(403, "This request is not in a queue you work.")

    history = [*row.get("history", []), {"at": iso(utcnow()), "by": display_name(actor),
                                          "status": body.status, "note": body.note}]
    doc = db.patch_doc("service_requests", request_id,
                       {"status": body.status, "history": history}, {"status": body.status})
    audit.record(actor, "request.status", f"{row['label']} → {body.status}",
                 tenant_id=row.get("tenantId"), platform=bool(kind and kind.platform),
                 ip=request.client.host if request.client else "unknown")
    return doc
