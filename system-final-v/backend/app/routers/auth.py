"""Sign-in, sign-up, invite acceptance, session and break-glass elevation (§10, §4.8)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, npi, rbac, settings_store, sso
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import (
    expiry, hash_password, iso, new_token, new_totp_secret, totp_uri, utcnow,
    verify_or_burn, verify_totp,
)
from ..config import settings

router = APIRouter(tags=["auth"])

#: How long an MFA challenge (the bridge between the password step and the TOTP
#: step at login) stays valid.
_MFA_CHALLENGE_TTL_S = 300


def _sign_mfa_challenge(user_id: str) -> str:
    """A short-lived signed token asserting the user passed the password step.

    Self-contained (HMAC over user_id + expiry with the app secret) so it needs
    no storage; it only bridges the password and the second factor at login.
    """
    exp = int(time.time()) + _MFA_CHALLENGE_TTL_S
    body = f"{user_id}.{exp}"
    sig = hmac.new(settings().secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def _open_mfa_challenge(token: str) -> str | None:
    """Return the user_id if the challenge is valid and unexpired, else None."""
    try:
        user_id, exp_s, sig = token.rsplit(".", 2)
    except ValueError:
        return None
    body = f"{user_id}.{exp_s}"
    want = hmac.new(settings().secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, sig):
        return None
    try:
        if int(exp_s) < int(time.time()):
            return None
    except ValueError:
        return None
    return user_id


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(Strict):
    email: str
    password: str


class SignupRequest(Strict):
    name: str = Field(min_length=1, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=200)
    role: str = "physician"
    #: Recorded for a later audit; not verified automatically.
    licence_number: str | None = Field(None, max_length=60)


class AcceptInviteRequest(Strict):
    token: str
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class PasswordChangeRequest(Strict):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class ElevateRequest(Strict):
    reason: str = Field(min_length=10, max_length=500)
    ticket: str = Field(min_length=2, max_length=64)
    ttl_minutes: int = Field(30, ge=5, le=240)
    #: An approved `/ops/break-glass` grant to start this elevation under. The
    #: elevation then inherits the grant's patient, ticket and expiry.
    grant_id: str | None = Field(None, max_length=40)


class ForgotPasswordRequest(Strict):
    email: str = Field(min_length=3, max_length=200)


def _identity(role: str) -> dict:
    return (db.document("demo_identity") or {}).get(role, {})


def _session_payload(actor_row: dict, token: str, expires: str) -> dict:
    role = actor_row["role"]
    meta = rbac.roles().get(role, {})
    ident = _identity(role)
    return {
        "token": token,
        "expires_at": expires,
        "user": {
            "id": actor_row["user_id"],
            "email": actor_row["email"],
            "name": actor_row.get("name") or ident.get("name") or actor_row["email"],
            "title": actor_row.get("title") or ident.get("title") or meta.get("label", role),
            "role": role,
            "tenantId": actor_row["tenant_id"],
            "surface": meta.get("surface", "clinician"),
            "home": meta.get("home", "/"),
        },
        "permissions": rbac.matrix().get(role, {}),
        # The tenant rules a screen needs to label its controls truthfully.
        "policy": {
            "requireResidentCosign": bool(
                settings_store.read("org", actor_row["tenant_id"])["settings"].get("requireResidentCosign", True)),
        },
    }


def _mint(user_id: str, email: str, role: str, tenant_id: str, name: str | None = None) -> dict:
    token = new_token()
    exp = expiry(settings().session_ttl_hours)
    conn = db.connect()
    conn.execute(
        "INSERT INTO sessions (token, user_id, role, tenant_id, issued_at, expires_at, elevation)"
        " VALUES (?,?,?,?,?,?,NULL)",
        (token, user_id, role, tenant_id, iso(utcnow()), iso(exp)),
    )
    conn.commit()
    return _session_payload(
        {"user_id": user_id, "email": email, "role": role, "tenant_id": tenant_id, "name": name},
        token, iso(exp),
    )


@router.post("/auth/login")
def login(body: LoginRequest, request: Request):
    row = db.connect().execute(
        "SELECT user_id, email, password_hash, role, tenant_id, mfa_enabled FROM credentials WHERE email = ?",
        (body.email.strip().lower(),),
    ).fetchone()

    # Same message and same work either way: a "no such account" that is
    # distinguishable from "wrong password" enumerates staff email addresses.
    if not verify_or_burn(body.password, row["password_hash"] if row else None):
        audit.record(
            Actor("anonymous", body.email, "guest", "t_yves", ""),
            "login.failed", body.email, outcome="error",
            ip=request.client.host if request.client else "unknown",
        )
        raise ApiError(401, "Email or password is incorrect.")

    # Checked only after the password, so a suspension is not disclosed to
    # someone who does not know the password.
    user = db.connect().execute("SELECT name, status FROM users WHERE email=?", (row["email"],)).fetchone()
    tenant = db.connect().execute("SELECT status FROM tenants WHERE id=?", (row["tenant_id"],)).fetchone()
    if (user and user["status"] == "suspended") or (tenant and tenant["status"] == "suspended"):
        audit.record(
            Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], ""),
            "login.failed", row["email"], outcome="denied",
            ip=request.client.host if request.client else "unknown",
        )
        raise ApiError(403, "This account is suspended. Contact your administrator.")

    # Second factor: if this account has MFA enrolled, the password alone does not
    # issue a session. Hand back a short-lived challenge; POST /auth/mfa/verify
    # with a valid TOTP code completes the sign-in.
    if row["mfa_enabled"]:
        audit.record(
            Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], ""),
            "login.mfa_challenge", row["email"],
            ip=request.client.host if request.client else "unknown",
        )
        return {"mfa_required": True, "mfa_token": _sign_mfa_challenge(row["user_id"])}

    payload = _mint(row["user_id"], row["email"], row["role"], row["tenant_id"],
                    user["name"] if user else None)
    audit.record(
        Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], payload["token"]),
        "login.success", row["email"],
        ip=request.client.host if request.client else "unknown",
    )
    return payload


class MfaVerifyRequest(Strict):
    mfa_token: str = Field(min_length=8, max_length=400)
    code: str = Field(min_length=6, max_length=10)


class MfaActivateRequest(Strict):
    code: str = Field(min_length=6, max_length=10)


@router.post("/auth/mfa/verify")
def mfa_verify(body: MfaVerifyRequest, request: Request):
    """Complete a login that returned ``mfa_required``: check the TOTP code
    against the challenged account and issue the session."""
    user_id = _open_mfa_challenge(body.mfa_token)
    if user_id is None:
        raise ApiError(401, "This sign-in step has expired. Enter your password again.")
    row = db.connect().execute(
        "SELECT user_id, email, password_hash, role, tenant_id, mfa_secret, mfa_enabled"
        " FROM credentials WHERE user_id=?", (user_id,)).fetchone()
    if row is None or not row["mfa_enabled"]:
        raise ApiError(401, "This sign-in step is no longer valid.")
    if not verify_totp(row["mfa_secret"] or "", body.code):
        audit.record(
            Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], ""),
            "login.mfa_failed", row["email"], outcome="error",
            ip=request.client.host if request.client else "unknown",
        )
        raise ApiError(401, "That verification code is not correct.")
    user = db.connect().execute("SELECT name FROM users WHERE email=?", (row["email"],)).fetchone()
    payload = _mint(row["user_id"], row["email"], row["role"], row["tenant_id"],
                    user["name"] if user else None)
    audit.record(
        Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], payload["token"]),
        "login.success", row["email"], reason="mfa",
        ip=request.client.host if request.client else "unknown",
    )
    return payload


class SsoCallbackRequest(Strict):
    assertion: str = Field(min_length=8, max_length=8000)


class SsoDevLoginRequest(Strict):
    email: str = Field(min_length=3, max_length=200)
    name: str | None = Field(None, max_length=120)


def _complete_sso(email: str, name: str, tenant_id: str, sso_cfg: dict, request: Request) -> dict:
    """Shared tail of every SSO sign-in: resolve/provision, refuse suspended
    accounts, then mint a session — the same session any other login yields."""
    row = sso.resolve_or_provision(email, name, tenant_id, sso_cfg)
    user = db.connect().execute("SELECT name, status FROM users WHERE email=?", (row["email"],)).fetchone()
    tenant = db.connect().execute("SELECT status FROM tenants WHERE id=?", (row["tenant_id"],)).fetchone()
    if (user and user["status"] == "suspended") or (tenant and tenant["status"] == "suspended"):
        raise ApiError(403, "This account is suspended. Contact your administrator.")
    payload = _mint(row["user_id"], row["email"], row["role"], row["tenant_id"],
                    user["name"] if user else name)
    audit.record(
        Actor(row["user_id"], row["email"], row["role"], row["tenant_id"], payload["token"]),
        "login.success", row["email"], reason="sso",
        ip=request.client.host if request.client else "unknown",
    )
    return payload


@router.get("/auth/sso/discover")
def sso_discover(email: str):
    """Public: does this email's domain sign in through a hospital IdP? Drives the
    login page's decision to show 'Continue with SSO' for a real tenant."""
    return sso.available_for(email)


@router.post("/auth/sso/callback")
def sso_callback(body: SsoCallbackRequest, request: Request):
    """Complete an SSO sign-in from a verified IdP assertion (id_token)."""
    claims = sso.verify_assertion(body.assertion)
    if not claims:
        raise ApiError(401, "That single sign-on response could not be verified.")
    found = sso.config_for_domain(claims["email"])
    if not found:
        raise ApiError(403, "Single sign-on is not configured for this email domain.")
    tenant_id, sso_cfg = found
    return _complete_sso(claims["email"], claims.get("name") or "", tenant_id, sso_cfg, request)


@router.post("/auth/sso/dev-login")
def sso_dev_login(body: SsoDevLoginRequest, request: Request):
    """Dev/demo only (ESAP_SSO_DEV=true): simulate a completed IdP round-trip for
    an email whose domain is SSO-enabled, so the flow is exercisable without a
    live IdP. Disabled in any real deployment."""
    if not sso.dev_enabled():
        raise ApiError(404, "Not found.")
    found = sso.config_for_domain(body.email)
    if not found:
        raise ApiError(403, "Single sign-on is not configured for this email domain.")
    tenant_id, sso_cfg = found
    assertion = sso.mint_dev_assertion(body.email, body.name or body.email, tenant_id)
    claims = sso.verify_assertion(assertion)
    return _complete_sso(claims["email"], claims.get("name") or "", tenant_id, sso_cfg, request)


@router.get("/auth/mfa/status")
def mfa_status(actor: Actor = Depends(current_actor)):
    row = db.connect().execute("SELECT mfa_enabled FROM credentials WHERE user_id=?",
                               (actor.user_id,)).fetchone()
    return {"enabled": bool(row and row["mfa_enabled"])}


@router.post("/auth/mfa/enroll")
def mfa_enroll(actor: Actor = Depends(current_actor)):
    """Begin MFA enrolment: mint a secret and return the otpauth URI to add to an
    authenticator app. Not active until confirmed with a code at /auth/mfa/activate."""
    secret = new_totp_secret()
    conn = db.connect()
    conn.execute("UPDATE credentials SET mfa_secret=?, mfa_enabled=0 WHERE user_id=?",
                 (secret, actor.user_id))
    conn.commit()
    return {"secret": secret, "otpauth_uri": totp_uri(secret, actor.email), "activated": False}


@router.post("/auth/mfa/activate")
def mfa_activate(body: MfaActivateRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Confirm enrolment: a valid code proves the authenticator is set up, and
    turns the second factor on for every future sign-in."""
    row = db.connect().execute("SELECT mfa_secret FROM credentials WHERE user_id=?",
                               (actor.user_id,)).fetchone()
    if row is None or not row["mfa_secret"]:
        raise ApiError(409, "Start enrolment first (POST /auth/mfa/enroll).")
    if not verify_totp(row["mfa_secret"], body.code):
        raise ApiError(400, "That code is not correct. Check your authenticator and try again.")
    conn = db.connect()
    conn.execute("UPDATE credentials SET mfa_enabled=1 WHERE user_id=?", (actor.user_id,))
    conn.commit()
    audit.record(actor, "user.mfa_enabled", actor.email,
                 ip=request.client.host if request.client else "unknown")
    return {"activated": True}


@router.post("/auth/mfa/disable")
def mfa_disable(body: MfaActivateRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Turn MFA off. Requires a current code, so a walk-up session cannot remove
    someone's second factor."""
    row = db.connect().execute("SELECT mfa_secret, mfa_enabled FROM credentials WHERE user_id=?",
                               (actor.user_id,)).fetchone()
    if not row or not row["mfa_enabled"]:
        return {"activated": False}
    if not verify_totp(row["mfa_secret"] or "", body.code):
        raise ApiError(400, "That code is not correct.")
    conn = db.connect()
    conn.execute("UPDATE credentials SET mfa_enabled=0, mfa_secret=NULL WHERE user_id=?", (actor.user_id,))
    conn.commit()
    audit.record(actor, "user.mfa_disabled", actor.email,
                 ip=request.client.host if request.client else "unknown")
    return {"activated": False}


@router.post("/auth/signup", status_code=201)
def signup(body: SignupRequest):
    """Self-serve individual seat (§17) — never a hospital tenant.

    A self-serve account lands in the individual tenant on a clinical role. A
    signup form cannot mint an admin or platform role; those arrive by invite.
    """
    email = body.email.strip().lower()
    if db.connect().execute("SELECT 1 FROM credentials WHERE email=?", (email,)).fetchone():
        raise ApiError(409, "An account with that email already exists.")

    allowed = {"physician", "resident", "np_pa", "charge_nurse", "staff_nurse",
               "case_manager", "pharmacist", "patient"}
    if body.role not in allowed:
        raise ApiError(403, f"'{body.role}' cannot be self-assigned; it is granted by invitation.")

    # NPI verification (§10.7): a clinician self-serve account that supplies a
    # 10-digit NPI must pass the CMS check-digit test (and the NPPES registry when
    # online verification is enabled). A non-NPI licence string passes through as
    # an unverified registration number rather than being rejected.
    licence = (body.licence_number or "").strip()
    npi_result = None
    if body.role != "patient" and npi.is_npi_shaped(licence):
        npi_result = npi.verify(licence)
        if not npi_result["checksumValid"]:
            raise ApiError(422, "That NPI is not valid — check the 10-digit number and try again.")

    user_id = f"self_{uuid.uuid4().hex[:12]}"
    conn = db.connect()
    conn.execute(
        "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
        (user_id, email, hash_password(body.password), body.role, "t_solo"),
    )
    doc = {
        "id": user_id, "tenantId": "t_solo", "name": body.name, "email": email,
        "roles": [body.role], "scope": "Individual / self-serve", "unitIds": [],
        "status": "active", "mfa": "none", "sso": False,
        "lastActive": iso(utcnow()), "createdAt": iso(utcnow()),
        "localTitle": rbac.roles().get(body.role, {}).get("label", body.role),
        "licenceNumber": licence or None,
        "npi": (npi_result or {}).get("npi"),
        "npiChecksumValid": (npi_result or {}).get("checksumValid"),
        "npiVerified": bool((npi_result or {}).get("verified")),
        "attestedAt": iso(utcnow()) if body.role != "patient" else None,
    }
    db.insert_doc("users", doc, {"tenant_id": "t_solo", "email": email,
                                 "name": body.name, "role": body.role, "status": "active"})
    conn.commit()
    return _mint(user_id, email, body.role, "t_solo", body.name)


class CaregiverAcceptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


@router.get("/auth/caregiver-invite/{token}")
def caregiver_invite(token: str):
    """What a carer sees before accepting: who invited them and how much access."""
    inv = db.document(f"caregiver_invite:{token}")
    if not inv or inv.get("status") != "pending":
        raise ApiError(404, "That caregiver invitation is not recognised or has been used.")
    return {"patientName": inv["patientName"], "relationship": inv["relationship"],
            "level": inv["level"], "email": inv["email"]}


@router.post("/auth/caregiver-accept", status_code=201)
def caregiver_accept(body: CaregiverAcceptRequest):
    """A carer sets up their own sign-in from a patient's family-access invite.

    Creates (or reuses) the carer's account and links it to the patient. Access
    lives in `caregiver_links` and is read back by `/patient/for-caregiver`; the
    carer never sees a raw score, the same §13.6 gate as the patient.
    """
    inv = db.document(f"caregiver_invite:{body.token}")
    if not inv or inv.get("status") != "pending":
        raise ApiError(404, "That caregiver invitation is not recognised or has been used.")
    email = inv["email"]
    tenant_id = inv.get("tenantId") or "t_solo"

    row = db.one_doc("SELECT doc FROM users WHERE email=?", (email,))
    if row is None:
        user_id = f"cg_{uuid.uuid4().hex[:12]}"
        conn = db.connect()
        conn.execute(
            "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
            (user_id, email, hash_password(body.password), "patient", tenant_id),
        )
        doc = {
            "id": user_id, "tenantId": tenant_id, "name": body.name, "email": email,
            "roles": ["patient"], "scope": "Caregiver", "unitIds": [], "status": "active",
            "mfa": "none", "sso": False, "isCaregiver": True,
            "lastActive": iso(utcnow()), "createdAt": iso(utcnow()), "localTitle": "Caregiver",
        }
        db.insert_doc("users", doc, {"tenant_id": tenant_id, "email": email,
                                     "name": body.name, "role": "patient", "status": "active"})
        conn.commit()
    else:
        user_id = row["id"]

    links = db.document("caregiver_links") or {}
    entries = links.get(email, [])
    if not any(e.get("patientId") == inv["patientId"] for e in entries):
        entries.append({
            "patientId": inv["patientId"], "patientName": inv["patientName"],
            "relationship": inv["relationship"], "level": inv["level"],
            "consentId": inv.get("consentId"), "status": "active",
        })
    links[email] = entries
    db.put_document("caregiver_links", links)
    db.put_document(f"caregiver_invite:{body.token}", {**inv, "status": "accepted"})
    return _mint(user_id, email, "patient", tenant_id, body.name)


def _invite_by_token(token: str) -> dict:
    """Resolve an invite link — by its secret token only, never by invite id.

    Invite ids are short and sequential (`i1`) and appear in the admin console,
    so accepting one by id would let anyone claim a pending seat in a hospital.
    A pending invite past its expiry is marked expired here, on first sight,
    so every screen agrees it can no longer be used.
    """
    invite = db.one_doc("SELECT doc FROM invites WHERE token=?", (token,))
    if invite is None:
        raise ApiError(404, "That invitation link is not recognised.")
    expires = invite.get("expiresAt")
    lapsed = bool(expires) and datetime.fromisoformat(expires.replace("Z", "+00:00")) <= utcnow()
    if invite["status"] == "pending" and lapsed:
        invite = db.patch_doc("invites", invite["id"], {"status": "expired"}, {"status": "expired"})
    return invite


@router.get("/auth/invite/{token}")
def inspect_invite(token: str):
    """Public: what the invite acceptance screen shows before anyone signs up."""
    invite = _invite_by_token(token)
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (invite["tenantId"],))
    valid = invite["status"] == "pending"
    return {
        "invite": invite,
        "tenant": tenant,
        "valid": valid,
        "reason": None if valid else f"This invitation is {invite['status']}.",
        "role": rbac.roles().get(invite["role"], {}),
    }


@router.post("/auth/invite/accept")
def accept_invite(body: AcceptInviteRequest):
    invite = _invite_by_token(body.token)
    if invite["status"] != "pending":
        raise ApiError(409, f"This invitation is {invite['status']} and can no longer be accepted.")

    email = invite["email"].strip().lower()
    if db.connect().execute("SELECT 1 FROM credentials WHERE email=?", (email,)).fetchone():
        raise ApiError(409, "An account with that email already exists. Sign in instead.")

    user_id = f"inv_{uuid.uuid4().hex[:12]}"
    conn = db.connect()
    conn.execute(
        "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
        (user_id, email, hash_password(body.password), invite["role"], invite["tenantId"]),
    )
    doc = {
        "id": user_id, "tenantId": invite["tenantId"], "name": body.name, "email": email,
        "roles": [invite["role"]], "scope": invite["scope"],
        "unitIds": invite.get("unitIds") or [], "status": "active",
        "mfa": "totp", "sso": True, "lastActive": iso(utcnow()), "createdAt": iso(utcnow()),
        "localTitle": invite.get("localTitle") or rbac.roles().get(invite["role"], {}).get("label", invite["role"]),
    }
    db.insert_doc("users", doc, {"tenant_id": invite["tenantId"], "email": email,
                                 "name": body.name, "role": invite["role"], "status": "active"})
    db.patch_doc("invites", invite["id"], {"status": "active"}, {"status": "active"})
    conn.commit()
    return _mint(user_id, email, invite["role"], invite["tenantId"], body.name)


@router.get("/auth/session")
def session(actor: Actor = Depends(current_actor)):
    user = db.connect().execute("SELECT name FROM users WHERE email=?", (actor.email,)).fetchone()
    row = db.connect().execute("SELECT expires_at FROM sessions WHERE token=?", (actor.token,)).fetchone()
    payload = _session_payload(
        {"user_id": actor.user_id, "email": actor.email, "role": actor.role,
         "tenant_id": actor.tenant_id, "name": user["name"] if user else None},
        actor.token, row["expires_at"],
    )
    payload["elevation"] = actor.elevation
    return payload


@router.post("/auth/password")
def change_password(body: PasswordChangeRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Change your own password. Every other session of yours is signed out."""
    row = db.connect().execute("SELECT password_hash FROM credentials WHERE user_id=?",
                               (actor.user_id,)).fetchone()
    if not verify_or_burn(body.current_password, row["password_hash"] if row else None):
        raise ApiError(403, "Your current password is not correct.")
    if body.new_password == body.current_password:
        raise ApiError(422, "Choose a password you have not used here before.")
    conn = db.connect()
    conn.execute("UPDATE credentials SET password_hash=? WHERE user_id=?",
                 (hash_password(body.new_password), actor.user_id))
    conn.execute("DELETE FROM sessions WHERE user_id=? AND token != ?", (actor.user_id, actor.token))
    conn.commit()
    audit.record(actor, "user.password_change", actor.email,
                 ip=request.client.host if request.client else "unknown")
    return {"changed": True, "other_sessions_ended": True}


@router.post("/auth/password/forgot", status_code=202)
def forgot_password(body: ForgotPasswordRequest, request: Request):
    """Ask the hospital admin for a password reset.

    There is no email service, so the request goes to the admin's request
    queue, where **Send reset** on the roster issues the link. The answer is
    the same whether or not the address has an account: a different reply
    for a known address would enumerate staff emails.
    """
    email = body.email.strip().lower()
    row = db.connect().execute(
        "SELECT user_id, role, tenant_id FROM credentials WHERE email=?", (email,)).fetchone()
    if row is not None:
        conn = db.connect()
        open_already = conn.execute(
            "SELECT 1 FROM service_requests WHERE requester=? AND kind='password_reset_request'"
            " AND status='open'", (email,)).fetchone()
        if not open_already:
            doc = {
                "id": f"rq_{uuid.uuid4().hex[:10]}", "kind": "password_reset_request",
                "label": "Password reset request", "detail": "Asked from the sign-in page.",
                "ref": email, "status": "open", "urgent": False, "requestedAt": iso(utcnow()),
                "requestedBy": email, "requestedByEmail": email, "tenantId": row["tenant_id"],
            }
            conn.execute(
                "INSERT INTO service_requests (id, tenant_id, requester, kind, status, created_at, doc)"
                " VALUES (?,?,?,?,?,?,?)",
                (doc["id"], row["tenant_id"], email, doc["kind"], "open", doc["requestedAt"], json.dumps(doc)),
            )
            conn.commit()
            audit.record(Actor(row["user_id"], email, row["role"], row["tenant_id"], ""),
                         "user.password_reset_request", email, tenant_id=row["tenant_id"],
                         ip=request.client.host if request.client else "unknown")
    return {"message": "If that address has an account, your administrator has been asked to "
                       "send you a reset link."}


@router.post("/auth/logout", status_code=204)
def logout(actor: Actor = Depends(current_actor)):
    conn = db.connect()
    conn.execute("DELETE FROM sessions WHERE token=?", (actor.token,))
    conn.commit()


@router.post("/auth/elevate")
def elevate(body: ElevateRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Break-glass elevation: time-boxed, reasoned, ticketed and audited (§4.8).

    The reason and ticket are mandatory at the schema level, and the grant is
    written to the audit log before it is usable — an elevation nobody can
    review afterwards is not a control.
    """
    rbac.require_elevatable(actor)

    grant = {
        "reason": body.reason,
        "ticket": body.ticket,
        "grantedAt": iso(utcnow()),
        "expiresAt": iso(expiry(body.ttl_minutes / 60)),
    }
    if body.grant_id:
        approved = db.one_doc("SELECT doc FROM break_glass WHERE id=?", (body.grant_id,))
        if approved is None:
            raise ApiError(404, "No such break-glass grant.")
        # Live grants record the requester's email; seeded ones their name.
        if approved["requestedBy"] not in {actor.email, display_name(actor)}:
            raise ApiError(403, "That grant was requested by someone else.")
        if approved["status"] != "active":
            raise ApiError(409, f"That grant is {approved['status'].replace('_', ' ')}, not active.")
        grant_expiry = datetime.fromisoformat(approved["expiresAt"].replace("Z", "+00:00"))
        if grant_expiry <= utcnow():
            raise ApiError(409, "That grant has expired. Request access again.")
        # The approved grant, not the form, sets the terms: its reason, its
        # ticket, its patient, and an expiry no later than its own.
        grant.update({"reason": approved["reason"], "ticket": approved["ticket"],
                      "grantId": approved["id"], "patientRef": approved["patientRef"],
                      "tenantId": approved["tenantId"],
                      "expiresAt": iso(min(expiry(body.ttl_minutes / 60), grant_expiry))})
    conn = db.connect()
    conn.execute("UPDATE sessions SET elevation=? WHERE token=?", (json.dumps(grant), actor.token))
    conn.commit()

    audit.record(
        actor, "break_glass.invoke",
        f"session:{actor.user_id}" + (f" · grant:{grant['grantId']}" if body.grant_id else ""),
        reason=grant["reason"], ip=request.client.host if request.client else "unknown",
        platform=actor.is_platform,
    )
    return {"elevation": grant}


@router.delete("/auth/elevate", status_code=204)
def drop_elevation(actor: Actor = Depends(current_actor)):
    conn = db.connect()
    conn.execute("UPDATE sessions SET elevation=NULL WHERE token=?", (actor.token,))
    conn.commit()


@router.get("/auth/roles")
def roles(_: Actor = Depends(current_actor)):
    """Role catalog + permission matrix — what /design/permissions renders.

    Authenticated: it carries the demo identity directory (names and email
    addresses), and the public sign-in page has no reason to hand that to an
    unauthenticated caller. The invite-acceptance screen gets the one role it
    needs from `GET /auth/invite/{token}`, which is public by necessity.
    """
    payload = db.document("rbac") or {}
    return {
        "roles": payload.get("roles", {}),
        "matrix": payload.get("matrix", {}),
        "permissions": payload.get("permissions", []),
        "demo_identities": db.document("demo_identity") or {},
    }
