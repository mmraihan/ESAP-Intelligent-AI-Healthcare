"""Operations console, part three: every account on the platform, and the
super-admin accounts that run it.

The directory listing is account metadata only — name, email, role, tenant,
status. It is the same information each hospital admin already sees for their
own tenant, gathered across tenants for platform staff. No patient data.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import hash_password, iso, utcnow

router = APIRouter(prefix="/ops", tags=["ops"])

#: The `users.tenant_id` of platform staff. Not a hospital, so no hospital
#: roster (which filters on its own tenant id) ever lists them.
PLATFORM_TENANT = "t_platform"


class SuperAdminRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=12, max_length=200)
    reason: str = Field(min_length=10, max_length=400)


def _platform(actor: Actor) -> None:
    if not actor.is_platform:
        raise ApiError(403, "This console is platform-operations only.")


@router.get("/users")
def all_users(actor: Actor = Depends(current_actor)):
    """Every account on every tenant, plus sign-ins with no directory row
    (the seeded platform staff)."""
    _platform(actor)
    tenants = {t["id"]: t["name"] for t in db.docs("SELECT doc FROM tenants")}
    tenants[PLATFORM_TENANT] = "ESAP platform"
    labels = {code: r.get("label", code) for code, r in rbac.roles().items()}

    out: list[dict] = []
    seen: set[str] = set()
    for u in db.docs("SELECT doc FROM users ORDER BY name"):
        seen.add(u["email"])
        role = (u.get("roles") or ["guest"])[0]
        out.append({
            "id": u["id"], "name": u.get("name") or u["email"], "email": u["email"],
            "role": role, "roleLabel": labels.get(role, role),
            "tenantId": u.get("tenantId"), "tenantName": tenants.get(u.get("tenantId"), u.get("tenantId")),
            "status": u.get("status", "active"), "lastActive": u.get("lastActive"),
            "createdAt": u.get("createdAt"),
        })
    identities = db.document("demo_identity") or {}
    for c in db.connect().execute("SELECT user_id, email, role, tenant_id FROM credentials").fetchall():
        if c["email"] in seen:
            continue
        seen.add(c["email"])
        ident = identities.get(c["role"], {}) if identities.get(c["role"], {}).get("email") == c["email"] else {}
        out.append({
            "id": c["user_id"], "name": ident.get("name") or c["email"], "email": c["email"],
            "role": c["role"], "roleLabel": labels.get(c["role"], c["role"]),
            "tenantId": c["tenant_id"],
            "tenantName": "ESAP platform" if c["role"] == "super_admin" else tenants.get(c["tenant_id"], c["tenant_id"]),
            "status": "active", "lastActive": None, "createdAt": None,
        })
    by_role: dict[str, int] = {}
    for u in out:
        by_role[u["role"]] = by_role.get(u["role"], 0) + 1
    return {"users": out, "total": len(out), "byRole": by_role}


@router.post("/super-admins", status_code=201)
def create_super_admin(body: SuperAdminRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Seat another platform operator. Platform staff only, with a reason,
    and recorded as a critical platform audit event."""
    _platform(actor)
    email = body.email.strip().lower()
    if db.connect().execute("SELECT 1 FROM credentials WHERE email=?", (email,)).fetchone():
        raise ApiError(409, "An account with that email already exists.")
    user_id = f"plat_{uuid.uuid4().hex[:12]}"
    # The session's tenant is the one the ops console opens on; the directory
    # row sits in the platform tenant so no hospital roster lists it.
    home_tenant = db.document("active_tenant_id") or actor.tenant_id
    now = iso(utcnow())
    conn = db.connect()
    conn.execute(
        "INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
        (user_id, email, hash_password(body.password), "super_admin", home_tenant),
    )
    doc = {
        "id": user_id, "tenantId": PLATFORM_TENANT, "name": body.name.strip(), "email": email,
        "roles": ["super_admin"], "scope": "Platform", "unitIds": [], "status": "active",
        "mfa": "none", "sso": False, "lastActive": None, "createdAt": now,
        "localTitle": "ESAP Platform Operations", "createdBy": display_name(actor),
    }
    db.insert_doc("users", doc, {"tenant_id": PLATFORM_TENANT, "email": email, "name": doc["name"],
                                 "role": "super_admin", "status": "active"})
    audit.record(actor, "platform.super_admin_create", email, reason=body.reason, platform=True,
                 ip=request.client.host if request.client else "unknown")
    return {"id": user_id, "email": email, "name": doc["name"], "role": "super_admin"}
