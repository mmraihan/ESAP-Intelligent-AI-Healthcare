"""Hospital admin console (§11.4): org, facilities, roster, invites, audit,
fairness, usage, billing, interop, models.

Every route is tenant-scoped through `tenant_scope`, and every route names the
permission it needs. The admin console is a tenant wall: a tenant_owner of one
hospital must not be able to read another's roster by editing a query string.
"""

from __future__ import annotations

import secrets
import uuid

from fastapi import APIRouter, Body, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, entitlements, evidence, rbac, settings_store
from ..deps import Actor, current_actor, display_name, end_sessions, tenant_scope
from ..errors import ApiError
from ..security import expiry, iso, utcnow

router = APIRouter(prefix="/admin", tags=["admin"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class InviteRequest(Strict):
    email: str = Field(min_length=3, max_length=200)
    role: str
    scope: str = Field("Facility: Main Campus", max_length=120)
    local_title: str | None = Field(None, max_length=120)
    #: Units this person is assigned to. This is what unit-based worklist scoping
    #: reads (§4.6): a clinician with no unit only ever sees patients they are
    #: personally the attending/nurse for, so a nurse-admitted patient would be
    #: invisible to the unit's physicians. Carried onto the user at acceptance.
    unit_ids: list[str] = Field(default_factory=list, max_length=64)


class RoleChangeRequest(Strict):
    roles: list[str] = Field(min_length=1, max_length=4)
    reason: str = Field(min_length=5, max_length=300)
    #: Optional new scope label ("Unit: MICU", "Facility: Main Campus"...).
    scope: str | None = Field(None, max_length=120)
    #: Structured unit assignment (drives worklist scoping). None = leave as-is.
    unit_ids: list[str] | None = None


class AccessChangeRequest(Strict):
    sso: bool | None = None
    break_glass_delegate: bool | None = None
    reason: str = Field(min_length=5, max_length=300)


class TransferDecision(Strict):
    reason: str | None = Field(None, max_length=500)
    accept_scope: str = Field("all", pattern="^(all|coded|docs)$")


class OutboundTransferRequest(Strict):
    mrn: str = Field(min_length=1, max_length=40)
    patient_display: str = Field(min_length=1, max_length=120)
    counterparty: str = Field(min_length=2, max_length=160)
    consent_basis: str = Field("treatment", max_length=40)
    bundle_items: list[str] = Field(default_factory=lambda: ["Problem list", "Medications"], max_length=12)
    note: str | None = Field(None, max_length=500)


class StatusChangeRequest(Strict):
    status: str
    reason: str = Field(min_length=5, max_length=300)


def _tenant_units(tenant_id: str) -> dict[str, str]:
    """{unit_id: unit_name} for every unit in the tenant's facilities."""
    return {
        u["id"]: u.get("name", u["id"])
        for f in db.docs("SELECT doc FROM facilities WHERE tenant_id=?", (tenant_id,))
        for u in f.get("units", [])
    }


def _scope_label(unit_ids: list[str], units_by_id: dict[str, str]) -> str:
    """A readable scope chip derived from a unit assignment."""
    if not unit_ids:
        return "Roster: assigned patients only"
    if len(unit_ids) == 1:
        return f"Unit: {units_by_id.get(unit_ids[0], unit_ids[0])}"
    return f"Units: {len(unit_ids)} assigned"


def _looks_like_esap(counterparty: str) -> bool:
    """Whether a counterparty is another ESAP tenant (the fast path) rather than
    an external EHR reached over TEFCA. Matched by name against known tenants."""
    name = (counterparty or "").strip().lower()
    if not name:
        return False
    if "esap" in name:
        return True
    for t in (db.docs("SELECT doc FROM tenants") or []):
        slug = (t.get("slug") or "").lower()
        tname = (t.get("name") or "").strip().lower()
        # A distinctive slug (e.g. "northgate") appearing in the counterparty, or
        # the tenant's full name, marks another ESAP tenant on the fast path.
        if (slug and len(slug) >= 4 and slug in name) or (tname and tname in name):
            return True
    return False


def _mpi_score(mrn: str, patient_display: str) -> float:
    """A deterministic identity-match score in [0, 1] from the evidence supplied.

    Not a real probabilistic MPI — it stands in for the counterparty's
    Patient.$match, and is deterministic so the review queue behaves the same
    way every run. More identifying detail (an MRN plus a full name with a
    date-like token) scores higher; a bare name scores low enough to force a
    human identity review before anything is accepted.
    """
    mrn = (mrn or "").strip()
    parts = [p for p in (patient_display or "").replace(",", " ").split() if p]
    score = 0.4
    if mrn:
        score += 0.35
    if len(parts) >= 2:            # a family and given name, not just one token
        score += 0.15
    if any(any(ch.isdigit() for ch in p) for p in parts):  # a DOB-like token
        score += 0.05
    if len(mrn) >= 6:
        score += 0.05
    return min(1.0, score)


@router.get("/org")
def org(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    rbac.require(actor, "tenant:manage")
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,))
    if tenant is None:
        raise ApiError(404, "Tenant not found.")
    return tenant


@router.get("/facilities")
def facilities(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    rbac.require(actor, "tenant:manage")
    rows = db.docs("SELECT doc FROM facilities WHERE tenant_id=? ORDER BY name", (tenant_id,))
    units = [u for f in rows for u in f.get("units", [])]
    return {"facilities": rows, "units": units}


@router.get("/units")
def units(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    """Flat unit list — the clinical rails need this without tenant:manage."""
    rbac.require(actor, "patient:read")
    rows = db.docs("SELECT doc FROM facilities WHERE tenant_id=? ORDER BY name", (tenant_id,))
    return {"units": [u for f in rows for u in f.get("units", [])]}


@router.get("/users")
def users(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    role: str | None = Query(None),
    status: str | None = Query(None),
    q: str | None = Query(None, max_length=120),
):
    rbac.require(actor, "user:manage")
    sql = "SELECT doc FROM users WHERE tenant_id=?"
    params: list = [tenant_id]
    if role:
        sql += " AND role=?"
        params.append(role)
    if status:
        sql += " AND status=?"
        params.append(status)
    sql += " ORDER BY name"
    rows = db.docs(sql, params)
    if q:
        needle = q.strip().lower()
        rows = [r for r in rows if needle in r["name"].lower() or needle in r["email"].lower()]
    return {"users": rows, "count": len(rows)}


@router.post("/users/{user_id}/roles")
def change_roles(
    user_id: str,
    body: RoleChangeRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Grant or revoke roles. A reason is mandatory and audited (§11.4.5)."""
    grade = rbac.require(actor, "user:manage")
    user = db.one_doc("SELECT doc FROM users WHERE id=? AND tenant_id=?", (user_id, tenant_id))
    if user is None:
        raise ApiError(404, "No such user in this tenant.")

    unknown = [r for r in body.roles if r not in rbac.roles()]
    if unknown:
        raise ApiError(422, f"Unknown role(s): {unknown}")
    if "super_admin" in body.roles:
        # Platform staff are not provisioned from a tenant console — that would
        # let a tenant admin mint cross-tenant reach for themselves.
        raise ApiError(403, "super_admin is a platform role and cannot be granted from a tenant console.")
    governance = {"tenant_owner", "privacy_officer"}
    # Both directions: scoped management may neither alter a governance holder
    # nor create one — otherwise an IT admin could promote themselves.
    if grade == "scoped" and (user["roles"][0] in governance or governance & set(body.roles)):
        raise ApiError(403, "Scoped user management cannot grant or alter a governance role.")

    changes: dict = {"roles": body.roles}
    if body.unit_ids is not None:
        units_by_id = _tenant_units(tenant_id)
        bad = [u for u in body.unit_ids if u not in units_by_id]
        if bad:
            raise ApiError(422, f"Unknown unit(s) for this tenant: {bad}")
        changes["unitIds"] = body.unit_ids
        # Keep the human-readable scope label in step with the real assignment,
        # unless the caller set one explicitly.
        if not body.scope:
            changes["scope"] = _scope_label(body.unit_ids, units_by_id)
    if body.scope:
        changes["scope"] = body.scope
    doc = db.patch_doc("users", user_id, changes, {"role": body.roles[0]})
    db.connect().execute("UPDATE credentials SET role=? WHERE email=?", (body.roles[0], user["email"]))
    db.connect().commit()
    end_sessions(user["email"])
    audit.record(actor, "user.role_grant", user["email"], reason=body.reason, tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.post("/users/{user_id}/status")
def change_status(
    user_id: str,
    body: StatusChangeRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "user:manage")
    if body.status not in {"active", "suspended"}:
        raise ApiError(422, "status must be 'active' or 'suspended'.")
    user = db.one_doc("SELECT doc FROM users WHERE id=? AND tenant_id=?", (user_id, tenant_id))
    if user is None:
        raise ApiError(404, "No such user in this tenant.")

    doc = db.patch_doc("users", user_id, {"status": body.status}, {"status": body.status})
    if body.status == "suspended":
        # Suspension has to end live sessions, not just block the next sign-in.
        end_sessions(user["email"])
    audit.record(actor, "user.status_change", user["email"], reason=body.reason, tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.patch("/users/{user_id}/access")
def change_access(
    user_id: str,
    body: AccessChangeRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Sign-in method and break-glass delegation for one account.

    Making someone a break-glass delegate lets them approve another person's
    emergency access to a chart, so it takes full user management, the same
    line the UI draws with "reserved to the Hospital Admin".
    """
    grade = rbac.require(actor, "user:manage")
    user = db.one_doc("SELECT doc FROM users WHERE id=? AND tenant_id=?", (user_id, tenant_id))
    if user is None:
        raise ApiError(404, "No such user in this tenant.")
    changes: dict = {}
    if body.sso is not None:
        changes["sso"] = body.sso
    if body.break_glass_delegate is not None:
        if grade != "full":
            raise ApiError(403, "Only full user management can make someone a break-glass delegate.")
        changes["breakGlassDelegate"] = body.break_glass_delegate
    if not changes:
        raise ApiError(422, "Nothing to change.")
    doc = db.patch_doc("users", user_id, changes)
    audit.record(actor, "user.access_change", user["email"], reason=body.reason, tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.get("/invites")
def invites(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    rbac.require(actor, "user:manage")
    return {"invites": db.docs("SELECT doc FROM invites WHERE tenant_id=?", (tenant_id,))}


@router.post("/invites", status_code=201)
def send_invite(
    body: InviteRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "user:manage")
    if body.role not in rbac.roles():
        raise ApiError(422, f"Unknown role '{body.role}'.")
    if body.role == "super_admin":
        raise ApiError(403, "super_admin is a platform role and cannot be invited from a tenant console.")
    # Two administrative tiers exist so that granting chart access is a
    # distinct, narrower act than day-to-day provisioning. `user:manage` (held
    # at scoped grade by IT Admin and others) covers creating and reconfiguring
    # accounts — it must not, by itself, extend to handing out a role that can
    # open a chart. Mirrors the tenant_owner-only check the roster's
    # "Change role" drawer already enforces client-side.
    if rbac.roles().get(body.role, {}).get("surface") == "clinician" and actor.role not in ("tenant_owner", "super_admin"):
        raise ApiError(403, "Granting a clinical role is reserved to the Hospital Admin.")

    units_by_id = _tenant_units(tenant_id)
    bad_units = [u for u in body.unit_ids if u not in units_by_id]
    if bad_units:
        raise ApiError(422, f"Unknown unit(s) for this tenant: {bad_units}")
    scope = body.scope
    # If units were chosen but no explicit label, describe the assignment.
    if body.unit_ids and (not scope or scope == "Facility: Main Campus"):
        scope = _scope_label(body.unit_ids, units_by_id)

    invite_id = f"i_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": invite_id, "tenantId": tenant_id, "email": body.email.strip().lower(),
        "role": body.role, "scope": scope, "status": "pending",
        "unitIds": body.unit_ids,
        "sentAt": iso(utcnow()), "expiresAt": iso(expiry(24 * 7)),
        "sentBy": display_name(actor), "remindersSent": 0,
        "localTitle": (body.local_title or "").strip() or None,
    }
    # The link is the credential, so it is random and never derived from the
    # id — the id is shown in this console and is short enough to guess.
    accept_token = f"inv_{secrets.token_urlsafe(24)}"
    db.insert_doc("invites", doc, {
        "tenant_id": tenant_id, "email": doc["email"], "role": body.role,
        "status": "pending", "token": accept_token,
    })
    audit.record(actor, "invite.send", doc["email"], tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return {**doc, "acceptToken": accept_token}


@router.delete("/invites/{invite_id}")
def revoke_invite(
    invite_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    rbac.require(actor, "user:manage")
    invite = db.one_doc("SELECT doc FROM invites WHERE id=? AND tenant_id=?", (invite_id, tenant_id))
    if invite is None:
        raise ApiError(404, "No such invitation.")
    doc = db.patch_doc("invites", invite_id, {"status": "revoked"}, {"status": "revoked"})
    audit.record(actor, "invite.revoke", invite["email"], tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.get("/audit")
def audit_log(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    severity: str | None = Query(None),
    action: str | None = Query(None),
    outcome: str | None = Query(None),
    actor_email: str | None = Query(None, alias="actor", max_length=200),
    target: str | None = Query(None, max_length=200),
    limit: int = Query(200, ge=1, le=1000),
):
    rbac.require(actor, "audit:view")
    sql = "SELECT doc FROM audit_events WHERE tenant_id=? AND platform=0"
    params: list = [tenant_id]
    for col, val in (("severity", severity), ("action", action), ("outcome", outcome),
                     ("actor", actor_email)):
        if val:
            sql += f" AND {col}=?"
            params.append(val)
    if target:
        sql += " AND json_extract(doc, '$.target') = ?"
        params.append(target)
    sql += " ORDER BY at DESC LIMIT ?"
    params.append(limit)
    return {"events": db.docs(sql, params)}


@router.get("/fairness")
def fairness(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    """Subgroup performance by audit covariate (§11.4.9).

    This is the one place race, insurance and marital status are reported, and
    it is a *reporting* surface: the same covariates are structurally excluded
    from every model input (guardrail 4). The response says so, because a
    fairness table without that statement invites the opposite reading.
    """
    rbac.require(actor, "fairness:audit_view")
    return {
        "subgroups": db.document("subgroup_fairness") or [],
        "models": db.document("models") or [],
        "covariates_are_model_inputs": False,
        "note": (
            "Race, insurance and marital status are captured for this audit only. They are "
            "structurally excluded from every model's feature builder and never appear on a "
            "clinical surface."
        ),
    }


@router.get("/usage")
def usage(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    # Usage/outcomes is read by several governance roles through different
    # capabilities: the Hospital Admin (tenant:manage), a QI auditor (audit:view),
    # the Privacy Officer (fairness:audit_view) and Billing (billing:view).
    rbac.require_any(actor, ("tenant:manage", "audit:view", "fairness:audit_view", "billing:view"))
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,))
    live = db.connect().execute(
        "SELECT count(*) c FROM assessments WHERE tenant_id=?", (tenant_id,)
    ).fetchone()["c"]
    return {
        "adoption": evidence.adoption_series(tenant_id),
        "drift": db.document("drift") or [],
        "models": db.document("models") or [],
        "tenant": tenant,
        "assessments_recorded_here": live,
    }


@router.get("/billing")
def billing(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    rbac.require(actor, "billing:view")
    return {
        "invoices": db.docs("SELECT doc FROM invoices WHERE tenant_id=? ORDER BY id DESC", (tenant_id,)),
        "plans": settings_store.plans(),
        "tenant": db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,)),
    }


@router.get("/interop")
def interop(actor: Actor = Depends(current_actor), tenant_id: str = Depends(tenant_scope)):
    # Whoever may start a transfer or decide one needs to see the queue.
    if not rbac.can(actor.role, "transfer:initiate"):
        rbac.require(actor, "transfer:approve")
    transfers = db.docs("SELECT doc FROM transfers WHERE tenant_id=?", (tenant_id,))
    transfers.sort(key=lambda t: t["requestedAt"], reverse=True)
    return {"transfers": transfers}


@router.post("/interop", status_code=201)
def request_record(
    body: OutboundTransferRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Ask another organisation for a patient's record (outbound request).

    It starts in `requested`: nothing is received until the counterparty
    answers and a named person here confirms the identity match.
    """
    rbac.require(actor, "transfer:initiate")

    # Plan boundary (§17): record transfer at all needs a plan that includes it,
    # and reaching a non-ESAP counterparty needs the TEFCA tier.
    level = entitlements.interop_level(tenant_id)
    if level == entitlements.INTEROP_NONE:
        raise ApiError(403, "Cross-organisation record transfer is not included in your plan.")
    path = "esap_fast_path" if _looks_like_esap(body.counterparty) else "tefca"
    if path == "tefca" and level != entitlements.INTEROP_TEFCA:
        raise ApiError(
            403,
            "Your plan can transfer records ESAP-to-ESAP only. Reaching an external EHR over "
            "TEFCA needs the Professional plan or higher.",
        )

    # A consent basis is mandatory before a record ever moves (§7.5). The schema
    # defaults it to "treatment"; an explicitly blank one is refused here.
    if not (body.consent_basis or "").strip():
        raise ApiError(422, "A consent basis is required to request a record transfer.")

    # Deterministic MPI match score from the identifiers supplied (§7.3). A real
    # deployment scores against the counterparty's $match response; here the
    # score reflects how much identity evidence the request carries. Below the
    # 0.92 auto-match bar the transfer lands in mpi_review for a human to confirm.
    score = _mpi_score(body.mrn, body.patient_display)
    state = "requested" if score >= 0.92 else "mpi_review"

    doc = {
        "id": f"tr_{uuid.uuid4().hex[:8]}", "direction": "outbound", "path": path,
        "counterparty": body.counterparty, "patientDisplay": body.patient_display, "mrn": body.mrn,
        "requestedAt": iso(utcnow()), "state": state, "mpiScore": round(score, 3),
        "consentBasis": body.consent_basis, "requestedBy": display_name(actor),
        "bundleItems": body.bundle_items, "note": body.note or "",
    }
    db.insert_doc("transfers", doc, {"tenant_id": tenant_id, "direction": "outbound",
                                     "state": state, "path": path})
    audit.record(actor, "transfer.request", f"{body.mrn} to {body.counterparty}", tenant_id=tenant_id,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.post("/interop/{transfer_id}/approve")
def approve_transfer(
    transfer_id: str,
    request: Request,
    body: TransferDecision = Body(default=TransferDecision()),
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Approve an inbound transfer.

    Below the 0.92 MPI bar the match is not certain enough to auto-accept, so
    approving it is a human act that gets recorded against a named clinician
    (§7.3) — merging the wrong patient's record is the harm this guards.
    """
    rbac.require(actor, "transfer:approve")
    tr = db.one_doc("SELECT doc FROM transfers WHERE id=? AND tenant_id=?", (transfer_id, tenant_id))
    if tr is None:
        raise ApiError(404, "No such transfer.")
    if tr["state"] not in {"requested", "mpi_review", "consent_pending"}:
        raise ApiError(409, f"A transfer in state '{tr['state']}' cannot be approved.")

    # Consent gate (§7.5): a record never moves without a recorded basis.
    if not (tr.get("consentBasis") or "").strip():
        raise ApiError(422, "This transfer has no recorded consent basis and cannot be approved.")

    doc = db.patch_doc("transfers", transfer_id,
                       {"state": "approved", "acceptScope": body.accept_scope,
                        "decisionReason": body.reason, "decidedBy": display_name(actor)},
                       {"state": "approved"})
    audit.record(actor, "transfer.approve", f"{transfer_id} · {tr['mrn']}", reason=body.reason,
                 tenant_id=tenant_id, ip=request.client.host if request.client else "unknown")
    return doc


@router.get("/models")
def admin_models(actor: Actor = Depends(current_actor), _t: str = Depends(tenant_scope)):
    rbac.require(actor, "tenant:manage")
    return {
        "models": db.document("models") or [],
        "drift": db.document("drift") or [],
        "rollouts": db.document("rollouts") or [],
    }
