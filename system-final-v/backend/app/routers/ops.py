"""Platform ops console (§11.5): fleet, tenants, incidents, rollout, break-glass,
plans, provisioning, global config, cross-tenant audit.

The governing rule of this whole surface (§4.8): **platform staff hold no
standing access to patient data.** Every route here is metadata — tenants,
incidents, rollout stages, audit headers. Reaching an actual patient record
requires a break-glass elevation, which `rbac.require` enforces because
`super_admin`'s `patient:read` grade is `breakglass`, not `full`.
"""

from __future__ import annotations

import json
import os
import secrets
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, evidence, rbac, settings_store
from ..deps import Actor, current_actor, display_name
from ..errors import ApiError
from ..security import expiry, iso, utcnow

router = APIRouter(prefix="/ops", tags=["ops"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProvisionRequest(Strict):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9-]+$")
    mode: str = "saas"
    plan: str = "pilot"
    region: str = "us-east"
    isolation: str = "shared_rls"
    beds: int = Field(0, ge=0, le=10_000)
    seats: int = Field(25, ge=1, le=100_000)
    contact: str = Field(max_length=200)
    #: Optional: seat the hospital's first admin. Provisioning creates a pending
    #: tenant_owner invite for this address and returns its acceptance token, so
    #: the new hospital has someone who can sign in and invite the rest of the staff.
    admin_email: str | None = Field(None, max_length=200)
    admin_name: str | None = Field(None, max_length=120)


class TenantStatusRequest(Strict):
    status: str
    reason: str = Field(min_length=10, max_length=400)


class RolloutRequest(Strict):
    model_id: str
    version: str
    stage: str
    traffic_pct: int = Field(ge=0, le=100)
    note: str = Field(min_length=5, max_length=400)


class BreakGlassRequest(Strict):
    tenant_id: str
    patient_ref: str = Field(min_length=1, max_length=64)
    reason: str = Field(min_length=10, max_length=500)
    ticket: str = Field(min_length=2, max_length=64)
    ttl_minutes: int = Field(30, ge=5, le=240)


def _platform(actor: Actor) -> None:
    if not actor.is_platform:
        raise ApiError(403, "This console is platform-operations only.")


@router.get("/fleet")
def fleet(actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    tenants = db.docs("SELECT doc FROM tenants ORDER BY name")
    incidents = db.docs("SELECT doc FROM incidents")
    return {
        "tenants": tenants,
        "incidents": incidents,
        "totals": {
            "tenants": len(tenants),
            "beds": sum(t["beds"] for t in tenants),
            "seats_used": sum(t["seatsUsed"] for t in tenants),
            "assessments30d": sum(t["assessments30d"] for t in tenants),
            "open_incidents": sum(1 for i in incidents if i["state"] != "resolved"),
        },
    }


@router.get("/tenants/{tenant_id}")
def tenant_detail(tenant_id: str, actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "tenant:manage")
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,))
    if tenant is None:
        raise ApiError(404, "No such tenant.")
    return {
        "tenant": tenant,
        "incidents": [i for i in db.docs("SELECT doc FROM incidents")
                      if i["tenantName"] == tenant["name"]],
        "audit": db.docs(
            "SELECT doc FROM audit_events WHERE tenant_id=? AND platform=1 ORDER BY at DESC LIMIT 50",
            (tenant_id,),
        ),
        "models": db.document("models") or [],
        "plans": settings_store.plans(),
        "adoption": evidence.adoption_series(tenant_id),
        "drift": db.document("drift") or [],
    }


@router.post("/tenants", status_code=201)
def provision(body: ProvisionRequest, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "tenant:create")
    if db.connect().execute("SELECT 1 FROM tenants WHERE slug=?", (body.slug,)).fetchone():
        raise ApiError(409, f"A tenant with slug '{body.slug}' already exists.")

    tenant_id = f"t_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": tenant_id, "slug": body.slug, "name": body.name, "mode": body.mode,
        "isolation": body.isolation, "region": body.region, "plan": body.plan,
        "status": "pending", "beds": body.beds, "seats": body.seats, "seatsUsed": 0,
        "facilities": 0, "goLive": iso(expiry(24 * 30)), "lastEtlRefresh": iso(utcnow()),
        "openIncidents": 0, "assessments30d": 0, "adoptionPct": 0, "contact": body.contact,
    }
    db.insert_doc("tenants", doc, {
        "slug": body.slug, "name": body.name, "mode": body.mode,
        "plan": body.plan, "status": "pending", "region": body.region,
    })
    audit.record(actor, "tenant.create", f"tenant:{body.slug}", tenant_id=tenant_id,
                 platform=True, ip=request.client.host if request.client else "unknown")

    # Seat the hospital's first admin (§10). A freshly provisioned tenant has no
    # one who can sign in; provisioning creates a pending tenant_owner invite so
    # the named admin can accept it and then invite the rest of the staff.
    admin_invite = None
    if body.admin_email and body.admin_email.strip():
        invite_id = f"i_{uuid.uuid4().hex[:10]}"
        accept_token = f"inv_{secrets.token_urlsafe(24)}"
        inv = {
            "id": invite_id, "tenantId": tenant_id, "email": body.admin_email.strip().lower(),
            "role": "tenant_owner", "scope": "Hospital administrator", "status": "pending",
            "sentAt": iso(utcnow()), "expiresAt": iso(expiry(24 * 14)),
            "sentBy": display_name(actor), "remindersSent": 0,
            "localTitle": (body.admin_name or "").strip() or None,
        }
        db.insert_doc("invites", inv, {
            "tenant_id": tenant_id, "email": inv["email"], "role": "tenant_owner",
            "status": "pending", "token": accept_token,
        })
        audit.record(actor, "invite.send", inv["email"], tenant_id=tenant_id,
                     platform=True, ip=request.client.host if request.client else "unknown")
        admin_invite = {**inv, "acceptToken": accept_token,
                        "acceptPath": f"/invite/{accept_token}"}

    return {**doc, "adminInvite": admin_invite}


@router.post("/tenants/{tenant_id}/status")
def tenant_status(tenant_id: str, body: TenantStatusRequest, request: Request,
                  actor: Actor = Depends(current_actor)):
    """Suspend or reactivate a tenant.

    Suspension disables access; it never deletes data. Retention runs on the
    contractual window, and conflating "cannot sign in" with "record destroyed"
    is how a billing dispute turns into data loss.
    """
    _platform(actor)
    rbac.require(actor, "tenant:create")
    if body.status not in {"active", "suspended", "pending"}:
        raise ApiError(422, "status must be active, suspended or pending.")
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,))
    if tenant is None:
        raise ApiError(404, "No such tenant.")

    doc = db.patch_doc("tenants", tenant_id, {"status": body.status}, {"status": body.status})
    if body.status == "suspended":
        conn = db.connect()
        conn.execute("DELETE FROM sessions WHERE tenant_id=?", (tenant_id,))
        conn.commit()
    audit.record(actor, f"tenant.{body.status}", f"tenant:{tenant['slug']}", reason=body.reason,
                 tenant_id=tenant_id, platform=True,
                 ip=request.client.host if request.client else "unknown")
    return {"tenant": doc, "data_retained": True,
            "note": "Suspension disables access. No data has been deleted."}


@router.get("/incidents")
def incidents(actor: Actor = Depends(current_actor), state: str | None = Query(None)):
    _platform(actor)
    rows = db.docs("SELECT doc FROM incidents")
    if state:
        rows = [i for i in rows if i["state"] == state]
    rows.sort(key=lambda i: i["openedAt"], reverse=True)
    return {"incidents": rows}


@router.get("/rollout")
def rollout(actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "model:admin")
    return {
        "rollouts": db.document("rollouts") or [],
        "models": db.document("models") or [],
        "drift": db.document("drift") or [],
        "tenants": db.docs("SELECT doc FROM tenants ORDER BY name"),
    }


@router.post("/rollout")
def advance_rollout(body: RolloutRequest, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require(actor, "model:admin")
    if body.stage not in {"canary", "partial", "full", "rolled_back"}:
        raise ApiError(422, "stage must be canary, partial, full or rolled_back.")

    stages = list(db.document("rollouts") or [])
    entry = {
        "modelId": body.model_id, "version": body.version, "stage": body.stage,
        "trafficPct": 0 if body.stage == "rolled_back" else body.traffic_pct,
        "tenantsPinned": 0, "startedAt": iso(utcnow()), "note": body.note,
    }
    stages.insert(0, entry)
    db.put_document("rollouts", stages)
    action = "model.rollback" if body.stage == "rolled_back" else "model.rollout_advance"
    audit.record(actor, action, f"{body.model_id}@{body.version}", platform=True,
                 ip=request.client.host if request.client else "unknown")
    return entry


@router.get("/break-glass")
def break_glass_list(actor: Actor = Depends(current_actor)):
    _platform(actor)
    rows = db.docs("SELECT doc FROM break_glass ORDER BY requested_at DESC")
    return {"grants": rows}


@router.post("/break-glass", status_code=201)
def request_break_glass(body: BreakGlassRequest, request: Request,
                        actor: Actor = Depends(current_actor)):
    """Request a time-boxed cross-tenant elevation.

    It lands `pending_approval`, not active: §4.8 wants a second person, so a
    single compromised operator account cannot grant itself patient access.
    """
    _platform(actor)
    rbac.require_elevatable(actor)
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (body.tenant_id,))
    if tenant is None:
        raise ApiError(404, "No such tenant.")

    grant_id = f"bg_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": grant_id, "requestedBy": actor.email, "tenantId": body.tenant_id,
        "tenantName": tenant["name"], "patientRef": body.patient_ref, "reason": body.reason,
        "ticket": body.ticket, "ttlMinutes": body.ttl_minutes, "requestedAt": iso(utcnow()),
        "expiresAt": iso(expiry(body.ttl_minutes / 60)), "status": "pending_approval",
    }
    db.insert_doc("break_glass", doc, {
        "tenant_id": body.tenant_id, "status": "pending_approval", "requested_at": doc["requestedAt"],
    })
    audit.record(actor, "break_glass.invoke", f"{tenant['slug']} · {body.patient_ref}",
                 reason=body.reason, tenant_id=body.tenant_id, platform=True,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.post("/break-glass/{grant_id}/approve")
def approve_break_glass(grant_id: str, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require_elevatable(actor)
    grant = db.one_doc("SELECT doc FROM break_glass WHERE id=?", (grant_id,))
    if grant is None:
        raise ApiError(404, "No such grant.")
    if grant["status"] != "pending_approval":
        raise ApiError(409, f"This grant is already {grant['status']}.")
    if grant["requestedBy"] == actor.email:
        # Two-person rule. Self-approval is not an approval.
        raise ApiError(403, "A break-glass grant must be approved by someone other than the requester.")

    doc = db.patch_doc("break_glass", grant_id,
                       {"status": "active", "approver": actor.email,
                        "expiresAt": iso(expiry(grant["ttlMinutes"] / 60))},
                       {"status": "active"})
    audit.record(actor, "break_glass.approve", f"grant:{grant_id}", reason=grant["reason"],
                 tenant_id=grant["tenantId"], platform=True,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.post("/break-glass/{grant_id}/revoke")
def revoke_break_glass(grant_id: str, request: Request, actor: Actor = Depends(current_actor)):
    _platform(actor)
    rbac.require_elevatable(actor)
    grant = db.one_doc("SELECT doc FROM break_glass WHERE id=?", (grant_id,))
    if grant is None:
        raise ApiError(404, "No such grant.")
    doc = db.patch_doc("break_glass", grant_id, {"status": "revoked"}, {"status": "revoked"})
    audit.record(actor, "break_glass.revoke", f"grant:{grant_id}", tenant_id=grant["tenantId"],
                 platform=True, ip=request.client.host if request.client else "unknown")
    return doc


@router.get("/plans")
def plans(actor: Actor = Depends(current_actor)):
    _platform(actor)
    return {"plans": settings_store.plans(),
            "tenants": db.docs("SELECT doc FROM tenants ORDER BY name")}


@router.get("/config")
def config(actor: Actor = Depends(current_actor)):
    """Global flags.

    `safety_features_by_plan` is empty and stays empty: calibration, the Why
    panel, the degraded label and the stratified evidence are identical on
    every tier. A safety control behind a paywall is not a safety control.
    """
    _platform(actor)
    rbac.require(actor, "model:admin")
    from .. import predictors

    return {
        "tenants": db.docs("SELECT doc FROM tenants ORDER BY name"),
        "flags": {
            "TOWER_B_ENABLED": False,
            "TOWER_C_ENABLED": False,
            "MODEL_MODE": predictors.mode(),
            "PREFILL_ENABLED": False,
        },
        "safety_features_by_plan": {},
        # Deployment facts, from configuration rather than the screen.
        "infrastructure": {"gpu_pool": int(os.environ.get("ESAP_GPU_POOL", "1")),
                           "gpu_shared_with": "the extraction LLM"},
        "note": "Safety features are never gated by plan (§17).",
    }


@router.get("/audit")
def platform_audit(
    actor: Actor = Depends(current_actor),
    tenant_id: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    _platform(actor)
    rbac.require(actor, "audit:cross_tenant")
    sql = "SELECT doc FROM audit_events WHERE platform=1"
    params: list = []
    if tenant_id:
        sql += " AND tenant_id=?"
        params.append(tenant_id)
    sql += " ORDER BY at DESC LIMIT ?"
    params.append(limit)
    return {"events": db.docs(sql, params),
            "tenants": db.docs("SELECT doc FROM tenants ORDER BY name")}


@router.get("/serving")
def serving(actor: Actor = Depends(current_actor), buckets: int = Query(12, ge=1, le=48)):
    """Inference latency, measured from the assessments this platform has run.

    Each assessment records how long every model took; the time for one
    assessment is the slowest of its five (they run side by side). Grouped by
    day so the trend is visible. Nothing here is estimated.
    """
    _platform(actor)
    rows = db.connect().execute("SELECT created_at, response FROM assessments").fetchall()
    per_day: dict[str, list[float]] = {}
    for r in rows:
        resp = json.loads(r["response"])
        lat = max((float((resp.get(k) or {}).get("latency_ms") or 0.0)
                   for k in ("differential", "mortality", "icu", "readmission", "los")), default=0.0)
        per_day.setdefault(str(r["created_at"])[:10], []).append(lat)

    def p(values: list[float], q: float) -> float:
        s = sorted(values)
        return round(s[min(len(s) - 1, int(round(q * (len(s) - 1))))], 1) if s else 0.0

    days = sorted(per_day)[-buckets:]
    every = [v for vs in per_day.values() for v in vs]
    return {
        "assessments": len(every),
        "p50_ms": p(every, 0.5),
        "p95_ms": p(every, 0.95),
        "by_day": [{"day": d, "count": len(per_day[d]), "p95_ms": p(per_day[d], 0.95)} for d in days],
    }
