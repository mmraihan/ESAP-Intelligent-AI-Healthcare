"""Technical support tickets and platform announcements.

Support is a conversation between any signed-in person and platform staff: a
ticket with a message thread. A requester sees only their own tickets; platform
staff see every ticket on every tenant. Tickets are for the product, not for
patients — the form says so, because anything typed here is readable by
platform staff who hold no standing patient-data access (§4.8).

Announcements go the other way: platform staff publish a notice (maintenance,
release, outage) and every shell in its audience shows it until it expires.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .. import audit, db, rbac
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["support"])

CATEGORIES = ("sign_in", "bug", "data_or_results", "integration", "billing", "feature_request", "other")
PRIORITIES = ("low", "normal", "high", "urgent")
STATUSES = ("open", "in_progress", "waiting_on_user", "resolved", "closed")
AUDIENCES = ("all", "clinician", "admin", "patient", "ops")
LEVELS = ("info", "maintenance", "incident")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TicketRequest(Strict):
    subject: str = Field(min_length=4, max_length=160)
    category: str = "other"
    priority: str = "normal"
    message: str = Field(min_length=5, max_length=5000)


class MessageRequest(Strict):
    body: str = Field(min_length=1, max_length=5000)


class TicketStatusRequest(Strict):
    status: str
    note: str | None = Field(None, max_length=500)


def _expiry(value: str | None) -> str | None:
    """An expiry as the same UTC ISO string `iso()` writes, so `_active` can
    compare it with `now` as text. Anything else could sort after every real
    timestamp and keep a notice up forever."""
    if value is None or not value.strip():
        return None
    try:
        dt = datetime.fromisoformat(value.strip())
    except ValueError:
        raise ValueError("expires_at must be an ISO 8601 date-time, e.g. 2026-11-01T02:00:00Z.") from None
    if dt.tzinfo is None:
        raise ValueError("expires_at needs a timezone (end it with Z for UTC).")
    return iso(dt)


class AnnouncementRequest(Strict):
    title: str = Field(min_length=3, max_length=140)
    body: str = Field(min_length=3, max_length=2000)
    audience: str = "all"
    level: str = "info"
    published: bool = True
    expires_at: str | None = None

    _expires = field_validator("expires_at")(_expiry)


class AnnouncementPatch(Strict):
    title: str | None = Field(None, min_length=3, max_length=140)
    body: str | None = Field(None, min_length=3, max_length=2000)
    audience: str | None = None
    level: str | None = None
    published: bool | None = None
    expires_at: str | None = None

    _expires = field_validator("expires_at")(_expiry)


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _platform(actor: Actor) -> None:
    if not actor.is_platform:
        raise ApiError(403, "This is managed from the platform ops console.")


def _check(value: str, allowed: tuple[str, ...], name: str) -> None:
    if value not in allowed:
        raise ApiError(422, f"{name} must be one of: {', '.join(allowed)}.")


def _surface(role: str) -> str:
    return rbac.roles().get(role, {}).get("surface", "clinician")


# --- tickets ----------------------------------------------------------------


def _ticket_for(actor: Actor, ticket_id: str) -> dict:
    """The ticket, if this caller may see it. Someone else's ticket is a 404,
    not a 403 — whether a ticket id exists is not the caller's business."""
    row = db.one_doc("SELECT doc FROM support_tickets WHERE id=?", (ticket_id,))
    if row is None or not (actor.is_platform or row["requesterEmail"] == actor.email):
        raise ApiError(404, "No such ticket.")
    return row


def _save(ticket: dict) -> dict:
    conn = db.connect()
    conn.execute(
        "UPDATE support_tickets SET status=?, priority=?, updated_at=?, doc=? WHERE id=?",
        (ticket["status"], ticket["priority"], ticket["updatedAt"], json.dumps(ticket), ticket["id"]),
    )
    conn.commit()
    return ticket


@router.post("/support/tickets", status_code=201)
def open_ticket(body: TicketRequest, request: Request, actor: Actor = Depends(current_actor)):
    _check(body.category, CATEGORIES, "category")
    _check(body.priority, PRIORITIES, "priority")
    now = iso(utcnow())
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (actor.tenant_id,)) or {}
    ticket = {
        "id": f"tk_{uuid.uuid4().hex[:10]}",
        "subject": body.subject.strip(),
        "category": body.category,
        "priority": body.priority,
        "status": "open",
        "requesterName": display_name(actor),
        "requesterEmail": actor.email,
        "requesterRole": actor.role,
        "tenantId": actor.tenant_id,
        "tenantName": tenant.get("name"),
        "assignee": None,
        # Who has the next move: "support" until staff reply, then "user".
        "awaiting": "support",
        "messages": [{"id": f"m_{uuid.uuid4().hex[:8]}", "at": now, "author": display_name(actor),
                      "fromStaff": False, "body": body.message.strip()}],
        "createdAt": now,
        "updatedAt": now,
    }
    conn = db.connect()
    conn.execute(
        "INSERT INTO support_tickets (id, tenant_id, requester, status, priority, created_at, updated_at, doc)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (ticket["id"], actor.tenant_id, actor.email, "open", body.priority, now, now, json.dumps(ticket)),
    )
    conn.commit()
    audit.record(actor, "support.open", f"{ticket['id']} · {ticket['subject']}", platform=True, ip=_ip(request))
    return ticket


@router.get("/support/tickets")
def list_tickets(actor: Actor = Depends(current_actor), status: str | None = Query(None)):
    """Platform staff: every ticket. Everyone else: their own."""
    if actor.is_platform:
        sql, params = "SELECT doc FROM support_tickets WHERE 1=1", []
    else:
        sql, params = "SELECT doc FROM support_tickets WHERE requester=?", [actor.email]
    if status:
        sql += " AND status=?"
        params.append(status)
    return {"tickets": db.docs(sql + " ORDER BY updated_at DESC LIMIT 500", params)}


@router.get("/support/tickets/{ticket_id}")
def get_ticket(ticket_id: str, actor: Actor = Depends(current_actor)):
    return _ticket_for(actor, ticket_id)


@router.post("/support/tickets/{ticket_id}/messages", status_code=201)
def reply(ticket_id: str, body: MessageRequest, request: Request, actor: Actor = Depends(current_actor)):
    ticket = _ticket_for(actor, ticket_id)
    if ticket["status"] == "closed":
        raise ApiError(409, "This ticket is closed. Open a new one if the problem is back.")
    staff = actor.is_platform and ticket["requesterEmail"] != actor.email
    now = iso(utcnow())
    ticket["messages"].append({"id": f"m_{uuid.uuid4().hex[:8]}", "at": now, "author": display_name(actor),
                               "fromStaff": staff, "body": body.body.strip()})
    ticket["updatedAt"] = now
    ticket["awaiting"] = "user" if staff else "support"
    if staff:
        if ticket["status"] == "open":
            ticket["status"] = "in_progress"
        ticket["assignee"] = ticket.get("assignee") or display_name(actor)
    elif ticket["status"] in ("waiting_on_user", "resolved"):
        # The requester answered or says it is not fixed: back in the queue.
        ticket["status"] = "in_progress"
    _save(ticket)
    audit.record(actor, "support.reply", ticket_id, platform=True, ip=_ip(request))
    return ticket


@router.post("/support/tickets/{ticket_id}/status")
def set_ticket_status(ticket_id: str, body: TicketStatusRequest, request: Request,
                      actor: Actor = Depends(current_actor)):
    """Staff move a ticket through any state; a requester may only close their
    own ticket or reopen a resolved one."""
    _check(body.status, STATUSES, "status")
    ticket = _ticket_for(actor, ticket_id)
    if not actor.is_platform:
        if body.status not in ("closed", "open"):
            raise ApiError(403, "You can close your ticket or reopen it; support staff handle the rest.")
        if body.status == "open" and ticket["status"] != "resolved":
            raise ApiError(409, "Only a resolved ticket can be reopened. Open a new one if the problem is back."
                           if ticket["status"] == "closed" else "This ticket is already with support.")
        if body.status == "closed" and ticket["status"] == "closed":
            raise ApiError(409, "This ticket is already closed.")
    ticket["status"] = body.status
    ticket["updatedAt"] = iso(utcnow())
    if body.note:
        ticket["messages"].append({"id": f"m_{uuid.uuid4().hex[:8]}", "at": ticket["updatedAt"],
                                   "author": display_name(actor), "fromStaff": actor.is_platform,
                                   "body": body.note.strip(), "statusChange": body.status})
    _save(ticket)
    audit.record(actor, "support.status", f"{ticket_id} → {body.status}", platform=True, ip=_ip(request))
    return ticket


# --- announcements ----------------------------------------------------------


def _active(doc: dict, now: str) -> bool:
    return bool(doc.get("published")) and (not doc.get("expiresAt") or doc["expiresAt"] > now)


@router.get("/announcements")
def my_announcements(actor: Actor = Depends(current_actor)):
    """What this person's shell should show right now."""
    now = iso(utcnow())
    surface = _surface(actor.role)
    rows = db.docs("SELECT doc FROM announcements WHERE published=1 AND audience IN ('all', ?)"
                   " ORDER BY created_at DESC", (surface,))
    return {"announcements": [r for r in rows if _active(r, now)]}


@router.get("/ops/announcements")
def all_announcements(actor: Actor = Depends(current_actor)):
    _platform(actor)
    now = iso(utcnow())
    rows = db.docs("SELECT doc FROM announcements ORDER BY created_at DESC")
    return {"announcements": [{**r, "active": _active(r, now)} for r in rows]}


@router.post("/ops/announcements", status_code=201)
def publish(body: AnnouncementRequest, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    _check(body.audience, AUDIENCES, "audience")
    _check(body.level, LEVELS, "level")
    now = iso(utcnow())
    doc = {
        "id": f"an_{uuid.uuid4().hex[:10]}",
        "title": body.title.strip(), "body": body.body.strip(),
        "audience": body.audience, "level": body.level, "published": body.published,
        "expiresAt": body.expires_at, "createdAt": now, "updatedAt": now, "createdBy": display_name(actor),
    }
    db.insert_doc("announcements", doc, {"audience": body.audience, "published": int(body.published),
                                         "created_at": now, "expires_at": body.expires_at})
    audit.record(actor, "announcement.publish", doc["title"], platform=True, ip=_ip(request))
    return doc


@router.patch("/ops/announcements/{announcement_id}")
def edit_announcement(announcement_id: str, body: AnnouncementPatch, request: Request,
                      actor: Actor = Depends(current_actor)):
    _platform(actor)
    if db.one_doc("SELECT doc FROM announcements WHERE id=?", (announcement_id,)) is None:
        raise ApiError(404, "No such announcement.")
    if body.audience is not None:
        _check(body.audience, AUDIENCES, "audience")
    if body.level is not None:
        _check(body.level, LEVELS, "level")
    fields = body.model_dump(exclude_unset=True)
    changes = {("expiresAt" if k == "expires_at" else k): v for k, v in fields.items()}
    # A new stamp re-shows the notice to people who dismissed the old wording.
    changes["updatedAt"] = iso(utcnow())
    scalars = {}
    if "audience" in fields:
        scalars["audience"] = fields["audience"]
    if "published" in fields:
        scalars["published"] = int(bool(fields["published"]))
    if "expires_at" in fields:
        scalars["expires_at"] = fields["expires_at"]
    doc = db.patch_doc("announcements", announcement_id, changes, scalars)
    audit.record(actor, "announcement.edit", doc["title"], platform=True, ip=_ip(request))
    return doc


@router.delete("/ops/announcements/{announcement_id}", status_code=204)
def delete_announcement(announcement_id: str, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    row = db.one_doc("SELECT doc FROM announcements WHERE id=?", (announcement_id,))
    if row is None:
        raise ApiError(404, "No such announcement.")
    conn = db.connect()
    conn.execute("DELETE FROM announcements WHERE id=?", (announcement_id,))
    conn.commit()
    audit.record(actor, "announcement.delete", row["title"], platform=True, ip=_ip(request))
