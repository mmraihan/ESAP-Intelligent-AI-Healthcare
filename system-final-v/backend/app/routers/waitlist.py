"""Early-access waitlist — the public form on `/waitlist` and the sales queue
behind it in the ops console.

A waitlist entry is a lead, not an account: it carries contact details a
person chose to give us, never patient data, and signing up grants nothing.
The public endpoint is the only unauthenticated write in the API, so it is
kept narrow — fixed fields, a honeypot, a per-address rate limit, and the same
answer whether or not the email was already on the list.
"""

from __future__ import annotations

import sqlite3
import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db
from ..config import settings
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["waitlist"])

STATUSES = ("new", "contacted", "qualified", "converted", "declined")
ORG_TYPES = ("hospital", "clinic", "health_system", "individual", "other")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WaitlistRequest(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    organization: str | None = Field(None, max_length=160)
    org_type: str = "hospital"
    job_title: str | None = Field(None, max_length=120)
    phone: str | None = Field(None, max_length=40)
    country: str | None = Field(None, max_length=80)
    beds: int | None = Field(None, ge=0, le=100_000)
    message: str | None = Field(None, max_length=2000)
    contact_consent: bool
    #: Honeypot. Hidden from people, filled in by form-spamming bots.
    website: str | None = Field(None, max_length=200)


class WaitlistUpdate(Strict):
    status: str | None = None
    owner: str | None = Field(None, max_length=120)
    note: str | None = Field(None, min_length=1, max_length=2000)


# Per-address limit on the public form. In-process, so it resets on restart and
# is per-worker; enough to stop a script hammering one instance, not a WAF.
_WINDOW_S = 600
_MAX_PER_WINDOW = 5
_hits: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    """The visitor's address, looking past our own reverse proxies.

    Behind a proxy every request arrives from the proxy, so keying the limit on
    the socket address would give the whole site one shared quota. The
    right-most X-Forwarded-For entry that is not one of our proxies is the
    first address we did not write ourselves; anything left of it is
    client-supplied and could be forged to dodge the limit.
    """
    peer = request.client.host if request.client else "unknown"
    trusted = settings().trusted_proxies
    if peer not in trusted:
        return peer
    hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    for hop in reversed(hops):
        if hop not in trusted:
            return hop
    return peer


def _rate_limit(ip: str) -> None:
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > _WINDOW_S:
        q.popleft()
    if len(q) >= _MAX_PER_WINDOW:
        raise ApiError(429, "Too many sign-ups from this address. Try again in a few minutes.")
    q.append(now)


def _position(created_at: str) -> int:
    row = db.connect().execute("SELECT COUNT(*) AS n FROM waitlist WHERE created_at <= ?", (created_at,)).fetchone()
    return int(row["n"])


def _existing(email: str) -> int | None:
    """The queue position of `email` if it is already on the list."""
    row = db.connect().execute("SELECT created_at FROM waitlist WHERE email=?", (email,)).fetchone()
    return _position(row["created_at"]) if row else None


def _platform(actor: Actor) -> None:
    if not actor.is_platform:
        raise ApiError(403, "The waitlist is worked from the platform ops console.")


@router.post("/public/waitlist", status_code=201)
def join(body: WaitlistRequest, request: Request):
    # Validate before counting against the limit, so a person correcting a
    # missed checkbox does not lock themselves out.
    if not body.contact_consent:
        raise ApiError(422, "Please agree to be contacted so our team can reach you.")
    if body.org_type not in ORG_TYPES:
        raise ApiError(422, f"org_type must be one of: {', '.join(ORG_TYPES)}.")
    if body.org_type != "individual" and not (body.organization or "").strip():
        raise ApiError(422, "Tell us which hospital or clinic you are joining for.")

    ip = _client_ip(request)
    if body.website:
        # A bot. It still spends the quota — stopping scripts is what the limit
        # is for — then gets an answer as if it worked, and nothing is stored.
        _rate_limit(ip)
        return {"ok": True, "position": None}
    email = body.email.strip().lower()
    existing = _existing(email)
    if existing is not None:
        # Same answer as a fresh sign-up: re-submitting is not an error to the
        # person, and a different reply would confirm who is on the list.
        return {"ok": True, "position": existing}
    _rate_limit(ip)

    now = iso(utcnow())
    doc = {
        "id": f"wl_{uuid.uuid4().hex[:10]}",
        "name": body.name.strip(),
        "email": email,
        "organization": (body.organization or "").strip() or None,
        "orgType": body.org_type,
        "jobTitle": (body.job_title or "").strip() or None,
        "phone": (body.phone or "").strip() or None,
        "country": (body.country or "").strip() or None,
        "beds": body.beds,
        "message": (body.message or "").strip() or None,
        "contactConsent": True,
        "status": "new",
        "owner": None,
        "notes": [],
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        db.insert_doc("waitlist", doc, {"email": email, "name": doc["name"],
                                        "organization": doc["organization"], "status": "new",
                                        "created_at": now})
    except sqlite3.IntegrityError:
        # A second submit of the same email raced this one past the check
        # above. The other one won; answer exactly as for any repeat.
        db.connect().rollback()
        existing = _existing(email)
        if existing is None:
            raise
        return {"ok": True, "position": existing}
    audit.record(Actor("anonymous", email, "guest", "t_platform", ""), "waitlist.join",
                 doc["organization"] or doc["name"], tenant_id="t_platform", platform=True, ip=ip)
    return {"ok": True, "position": _position(now)}


@router.get("/ops/waitlist")
def list_waitlist(actor: Actor = Depends(current_actor), status: str | None = Query(None)):
    """Everyone on the list, earliest first — that order is the queue."""
    _platform(actor)
    sql, params = "SELECT doc FROM waitlist", []
    if status:
        sql += " WHERE status=?"
        params.append(status)
    rows = db.docs(sql + " ORDER BY created_at ASC", params)
    counts = {s: 0 for s in STATUSES}
    for r in db.docs("SELECT doc FROM waitlist"):
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return {"entries": rows, "counts": counts, "total": sum(counts.values())}


@router.patch("/ops/waitlist/{entry_id}")
def update_entry(entry_id: str, body: WaitlistUpdate, request: Request,
                 actor: Actor = Depends(current_actor)):
    """Move a lead along, assign an owner, or log a contact attempt."""
    _platform(actor)
    row = db.one_doc("SELECT doc FROM waitlist WHERE id=?", (entry_id,))
    if row is None:
        raise ApiError(404, "No such waitlist entry.")
    if body.status is not None and body.status not in STATUSES:
        raise ApiError(422, f"status must be one of: {', '.join(STATUSES)}.")

    now = iso(utcnow())
    changes: dict = {"updatedAt": now}
    scalars: dict = {}
    if body.status is not None and body.status != row["status"]:
        changes["status"] = body.status
        scalars["status"] = body.status
        if body.status == "contacted" and not row.get("contactedAt"):
            changes["contactedAt"] = now
    if body.owner is not None:
        changes["owner"] = body.owner.strip() or None
    if body.note:
        changes["notes"] = [*row.get("notes", []), {"at": now, "by": display_name(actor),
                                                    "text": body.note.strip(),
                                                    "status": changes.get("status", row["status"])}]
    # patch_doc drops keys set to None, which is how an owner is cleared.
    doc = db.patch_doc("waitlist", entry_id, changes, scalars)
    audit.record(actor, "waitlist.update",
                 f"{row['email']}{' → ' + body.status if body.status else ''}",
                 platform=True, ip=request.client.host if request.client else "unknown")
    return doc


@router.delete("/ops/waitlist/{entry_id}", status_code=204)
def delete_entry(entry_id: str, request: Request, actor: Actor = Depends(current_actor)):
    """Erase a lead — for a person who asks to be removed."""
    _platform(actor)
    row = db.one_doc("SELECT doc FROM waitlist WHERE id=?", (entry_id,))
    if row is None:
        raise ApiError(404, "No such waitlist entry.")
    conn = db.connect()
    conn.execute("DELETE FROM waitlist WHERE id=?", (entry_id,))
    conn.commit()
    audit.record(actor, "waitlist.delete", row["email"], platform=True,
                 ip=request.client.host if request.client else "unknown")


@router.post("/ops/waitlist/export")
def export_waitlist(request: Request, actor: Actor = Depends(current_actor)):
    """The list as rows for a CSV, logged before it is handed over."""
    _platform(actor)
    rows = db.docs("SELECT doc FROM waitlist ORDER BY created_at ASC")
    audit.record(actor, "waitlist.export", f"{len(rows)} entries", platform=True,
                 ip=request.client.host if request.client else "unknown")
    return {"rows": [
        {"position": i + 1, "name": r["name"], "email": r["email"], "phone": r.get("phone"),
         "organization": r.get("organization"), "orgType": r.get("orgType"),
         "jobTitle": r.get("jobTitle"), "country": r.get("country"), "beds": r.get("beds"),
         "status": r["status"], "owner": r.get("owner"), "joined": r["createdAt"],
         "message": r.get("message")}
        for i, r in enumerate(rows)
    ]}
