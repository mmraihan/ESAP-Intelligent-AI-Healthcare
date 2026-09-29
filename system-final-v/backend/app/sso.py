"""Single sign-on (OIDC) — the relying-party side (§10.8).

A hospital IdP (Okta, Entra, Ping, ...) authenticates the user and returns an
id_token; ESAP maps it to a tenant by email domain and either finds the account
or provisions one just-in-time on the tenant's configured default clinical role.

Two verifiers share one interface so the flow is testable without a live IdP:

* **Production**: verify the IdP's id_token (RS256 via the issuer's JWKS). That
  verifier is a drop-in — implement ``_verify_oidc`` with your JWT library — and
  nothing else in the flow changes.
* **Dev issuer**: a compact HMAC-signed assertion this module can also mint, so
  the whole login round-trip runs end-to-end in a test or a demo with no external
  dependency. Enabled only when ``ESAP_SSO_DEV=true``.

An SSO account never carries a usable password: the credential row stores an
unguessable hash, so the only way in is back through the IdP.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
import uuid

from . import db, rbac, settings_store
from .config import settings
from .security import expiry, hash_password, iso, utcnow

_CLINICAL_ROLES = {"physician", "resident", "np_pa", "charge_nurse", "staff_nurse",
                   "case_manager", "pharmacist"}


def dev_enabled() -> bool:
    return os.environ.get("ESAP_SSO_DEV", "false").lower() in {"1", "true", "yes"}


# --- tenant discovery --------------------------------------------------------

def config_for_domain(email: str) -> tuple[str, dict] | None:
    """Find the tenant whose SSO config claims this email's domain, if any."""
    domain = (email or "").split("@")[-1].strip().lower()
    if not domain:
        return None
    for t in (db.docs("SELECT doc FROM tenants") or []):
        sso = settings_store.read("integrations", t["id"])["settings"].get("sso", {})
        if sso.get("enabled") and (sso.get("allowedDomain") or "").strip().lower() == domain:
            return t["id"], sso
    return None


def available_for(email: str) -> dict:
    """What the login page needs: whether SSO is offered for this email domain."""
    found = config_for_domain(email)
    if not found:
        return {"enabled": False}
    tenant_id, sso = found
    return {"enabled": True, "tenant": tenant_id,
            "issuer": sso.get("issuer"), "dev": dev_enabled()}


# --- dev issuer (test/demo only) --------------------------------------------

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def mint_dev_assertion(email: str, name: str, tenant_id: str) -> str:
    """A signed stand-in for an IdP id_token. Dev/test only."""
    claims = {"email": email.strip().lower(), "name": name, "tenant": tenant_id,
              "iss": "esap-dev-idp", "exp": int(time.time()) + 300}
    body = _b64(json.dumps(claims, separators=(",", ":")).encode())
    sig = hmac.new(settings().secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def _verify_dev_assertion(token: str) -> dict | None:
    try:
        body, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    want = hmac.new(settings().secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, sig):
        return None
    try:
        claims = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if claims.get("exp", 0) < int(time.time()):
        return None
    return claims


def _verify_oidc(id_token: str) -> dict | None:  # pragma: no cover - needs a real IdP
    """Production hook: verify an RS256 id_token against the issuer's JWKS and
    return its claims. Left unimplemented here (no JWT dependency / no live IdP);
    wire it up per deployment. Returns None so an unverifiable token is refused."""
    return None


def verify_assertion(token: str) -> dict | None:
    """Verify an IdP assertion and return {email, name, tenant} or None."""
    claims = None
    if dev_enabled():
        claims = _verify_dev_assertion(token)
    if claims is None:
        claims = _verify_oidc(token)
    if not claims or not claims.get("email"):
        return None
    return claims


# --- JIT provisioning --------------------------------------------------------

def resolve_or_provision(email: str, name: str, tenant_id: str, sso: dict) -> dict:
    """Return the credentials row for an SSO user, provisioning one on first sign-in.

    The account lands on the tenant's configured default clinical role. Only a
    clinical role can be self-provisioned this way; admin/platform roles are
    granted by invitation, never by an SSO claim.
    """
    email = email.strip().lower()
    row = db.connect().execute(
        "SELECT user_id, email, role, tenant_id FROM credentials WHERE email=?", (email,)).fetchone()
    if row is not None:
        return dict(row)

    role = (sso.get("defaultRole") or "physician")
    if role not in _CLINICAL_ROLES:
        role = "physician"
    user_id = f"sso_{uuid.uuid4().hex[:12]}"
    conn = db.connect()
    conn.execute(
        "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
        # No usable password: an unguessable hash, so the only way in is the IdP.
        (user_id, email, hash_password(uuid.uuid4().hex + uuid.uuid4().hex), role, tenant_id),
    )
    doc = {
        "id": user_id, "tenantId": tenant_id, "name": name or email, "email": email,
        "roles": [role], "scope": "Provisioned by SSO", "unitIds": [], "status": "active",
        "mfa": "sso", "sso": True, "lastActive": iso(utcnow()), "createdAt": iso(utcnow()),
        "localTitle": rbac.roles().get(role, {}).get("label", role),
    }
    db.insert_doc("users", doc, {"tenant_id": tenant_id, "email": email,
                                 "name": doc["name"], "role": role, "status": "active"})
    conn.commit()
    return {"user_id": user_id, "email": email, "role": role, "tenant_id": tenant_id}
