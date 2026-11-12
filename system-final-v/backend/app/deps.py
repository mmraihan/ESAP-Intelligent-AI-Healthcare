"""Request-scoped dependencies: who is calling, and what they may see.

Every `/api/v1` route depends on `current_actor`, which is what API_CONTRACT's
"an authenticated actor_id is attached to every request and written to the
access-audit log" means in code.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, Request

from . import db
from .config import settings
from .errors import ApiError
from .security import utcnow

#: The shared tenant for self-serve accounts. Its members are unrelated private
#: practices, so nothing is shared between them just because the tenant is.
SOLO_TENANT_ID = "t_solo"


@dataclass
class Actor:
    user_id: str
    email: str
    role: str
    tenant_id: str
    token: str
    elevation: dict | None = None
    #: The demo all-access account (ESAP_DEMO_ALL_ACCESS): every permission at
    #: `full`, every console reachable, no elevation needed.
    all_access: bool = False
    #: Authenticated by the HttpOnly cookie rather than a Bearer header.
    via_cookie: bool = False

    @property
    def is_platform(self) -> bool:
        return self.role == "super_admin"


def display_name(actor: Actor) -> str:
    """The name a clinician should see attributed to an action.

    Directory record first, then the demo identity for that role, and only then
    the email. "Acknowledged by tobias.lindqvist@styves.example" on a chart is
    an address, not an attribution — a co-signing attending needs to recognise
    who reviewed it.
    """
    user = db.one_doc("SELECT doc FROM users WHERE email=?", (actor.email,))
    if user and user.get("name"):
        return user["name"]
    identity = (db.document("demo_identity") or {}).get(actor.role) or {}
    return identity.get("name") or actor.email


def is_superuser(email: str) -> bool:
    """True only for the configured all-access account, and only when enabled."""
    cfg = settings()
    return cfg.demo_all_access and email.strip().lower() == cfg.superuser_email


def end_sessions(email: str) -> None:
    """Sign a person out everywhere.

    Keyed on the sign-in's email, not a directory id: a session carries the
    credential's user id, and revocation that misses because two tables named
    the same person differently is revocation that silently did not happen.
    Suspension, password reset and every role change go through here — a
    session caches its role, so a revoked role would otherwise keep working
    until the token expired.
    """
    conn = db.connect()
    conn.execute(
        "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM credentials WHERE email=?)",
        (email,),
    )
    conn.commit()


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


#: Header the web client sends on every request. A cookie-authenticated write
#: without it is refused: a cross-site form cannot set a custom header, and one
#: set by script forces a CORS preflight that only allowed origins pass.
CLIENT_HEADER = "x-esap-client"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

#: What an admin who has not enrolled MFA yet may still call (QA issue 8).
_MFA_SETUP_PATHS = {
    "/api/v1/auth/session", "/api/v1/auth/whoami", "/api/v1/auth/logout",
    "/api/v1/auth/mfa/status", "/api/v1/auth/mfa/enroll", "/api/v1/auth/mfa/activate",
}


def session_token(request: Request) -> tuple[str | None, bool]:
    """The session token and whether it came from the HttpOnly cookie."""
    bearer = _bearer(request)
    if bearer:
        return bearer, False
    cookie = request.cookies.get(settings().cookie_name)
    return (cookie, True) if cookie else (None, False)


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def current_actor(request: Request) -> Actor:
    token, from_cookie = session_token(request)
    if not token:
        raise ApiError(401, "No session. Sign in first.")
    if from_cookie and request.method not in _SAFE_METHODS and not request.headers.get(CLIENT_HEADER):
        raise ApiError(403, "This request is missing the ESAP client header.")

    row = db.connect().execute(
        "SELECT s.token, s.user_id, s.role, s.tenant_id, s.expires_at, s.elevation, s.last_seen,"
        " s.mfa_setup, s.issued_at, c.email"
        " FROM sessions s LEFT JOIN credentials c ON c.user_id = s.user_id"
        " WHERE s.token = ?",
        (token,),
    ).fetchone()
    if row is None:
        raise ApiError(401, "Session not recognised.")

    now = utcnow()
    if _parse(row["expires_at"]) <= now:
        db.connect().execute("DELETE FROM sessions WHERE token=?", (token,))
        db.connect().commit()
        raise ApiError(401, "Session expired. Sign in again.")

    # Idle timeout (QA issue 8): a session unused for this long is ended, so an
    # unattended workstation does not stay signed in for the whole shift.
    idle = settings().idle_timeout_minutes
    last = _parse(row["last_seen"] or row["issued_at"])
    if idle > 0 and (now - last).total_seconds() > idle * 60:
        db.connect().execute("DELETE FROM sessions WHERE token=?", (token,))
        db.connect().commit()
        raise ApiError(401, f"You were signed out after {idle} minutes without activity. Sign in again.")
    if (now - last).total_seconds() > 30:
        db.connect().execute("UPDATE sessions SET last_seen=? WHERE token=?",
                             (now.isoformat().replace("+00:00", "Z"), token))
        db.connect().commit()

    if row["mfa_setup"] and request.url.path not in _MFA_SETUP_PATHS:
        raise ApiError(403, "Set up two-factor sign-in before using this console. "
                            "Administrator accounts must have it.", code="MFA_SETUP_REQUIRED")

    elevation = json.loads(row["elevation"]) if row["elevation"] else None
    if elevation and datetime.fromisoformat(elevation["expiresAt"].replace("Z", "+00:00")) <= utcnow():
        # A lapsed elevation is dropped rather than carried: §4.8 access is
        # time-boxed, so an expired grant must stop authorizing immediately.
        elevation = None
        db.connect().execute("UPDATE sessions SET elevation=NULL WHERE token=?", (token,))
        db.connect().commit()

    actor = Actor(
        user_id=row["user_id"],
        email=row["email"] or "",
        role=row["role"],
        tenant_id=row["tenant_id"],
        token=token,
        elevation=elevation,
        all_access=is_superuser(row["email"] or ""),
        via_cookie=from_cookie,
    )
    request.state.actor = actor
    return actor


def staff_only(actor: Actor = Depends(current_actor)) -> Actor:
    """For clinical-side routes: patients and carers never reach them, whatever
    their permission grades say."""
    if actor.role in {"patient", "guest"}:
        raise ApiError(403, "This is for hospital staff.")
    return actor


#: The roles whose home is the hospital admin or platform console.
ADMIN_ROLES = {"tenant_owner", "it_admin", "privacy_officer", "billing_admin", "auditor", "super_admin"}


def admin_only(actor: Actor = Depends(current_actor)) -> Actor:
    """For every /admin route (QA issue 25). A clinician who needs part of this
    data has a route of their own, such as /transfers."""
    if actor.role not in ADMIN_ROLES and not actor.all_access:
        raise ApiError(403, "The hospital admin console is for administrators.")
    return actor


def tenant_scope(request: Request, actor: Actor = Depends(current_actor)) -> str:
    """The tenant a tenant-scoped read is allowed to target.

    Platform staff may pass `?tenant_id=` to look across tenants; everyone else
    is pinned to their own, and asking for another one is a 403 rather than an
    empty list — a silent empty result reads as "no data", which is a different
    and misleading answer.
    """
    requested = request.query_params.get("tenant_id")
    if requested and requested != actor.tenant_id:
        if not actor.is_platform:
            raise ApiError(403, "Cross-tenant access requires platform scope.")
        return requested
    return actor.tenant_id
