"""`GET /api/v1/bootstrap` — everything the signed-in client may see, in one call.

The frontend hydrates its store once at boot rather than issuing twenty
requests across forty screens. Two reasons this is a single endpoint and not a
convenience wrapper:

* **Atomicity.** The consoles cross-reference collections (an audit row names a
  user, an encounter names a unit). Twenty independent responses can interleave
  with a write and show a roster that disagrees with the audit log.
* **One authorization decision.** Each collection is filtered by the same
  `rbac` grades the individual routes use, and a collection the caller may not
  read comes back empty rather than absent — the client renders an empty
  console instead of crashing on a missing key.

It is shaped exactly like `seed.json`, so the offline fixture and the live API
are interchangeable to the store.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..care_team import for_patient as care_team_for
from .. import db, evidence, rbac, settings_store
from ..deps import Actor, current_actor
from .clinical import scope_encounters

router = APIRouter(tags=["bootstrap"])


def _if(allowed: bool, rows: list) -> list:
    return rows if allowed else []


@router.get("/bootstrap")
def bootstrap(actor: Actor = Depends(current_actor)):
    tenant_id = actor.tenant_id
    is_platform = actor.is_platform

    may_read_patients = rbac.can(actor.role, "patient:read")
    patient_grade = rbac.grade(actor.role, "patient:read")
    may_manage_users = rbac.can(actor.role, "user:manage")
    may_audit = rbac.can(actor.role, "audit:view")
    may_cross_tenant = rbac.can(actor.role, "audit:cross_tenant")
    may_bill = rbac.can(actor.role, "billing:view")
    may_fairness = rbac.can(actor.role, "fairness:audit_view")
    may_transfer = rbac.can(actor.role, "transfer:initiate") or rbac.can(actor.role, "transfer:approve")
    may_tenant = rbac.can(actor.role, "tenant:manage")

    # Patient-record collections belong to the signed-in patient only. A
    # clinician's bootstrap carries no portal data at all.
    is_patient = actor.role == "patient"
    patient_id = actor.user_id if is_patient else None

    # Org settings → "Allow patients to see released results" was saved but
    # never enforced anywhere — the direct REST endpoints in patient.py now
    # check it via `_me()`, but the frontend actually hydrates through this
    # single bootstrap call, which had its own inline patient-data path that
    # never consulted it either. Covers the direct case: an account whose own
    # tenant_id is the hospital that turned the portal off.
    portal_enabled = not is_patient or settings_store.read(
        "org", tenant_id)["settings"].get("patientPortalEnabled", True) is not False
    patient_id = patient_id if portal_enabled else None

    # A patient holds several capabilities at `scoped` grade — patient:read,
    # billing:view, transfer:initiate — which mean "my record, my bill, my
    # transfer". Read as a plain capability check they would hand over the
    # staff directory, the hospital's invoices and other patients' transfers,
    # so every tenant-directory collection below is staff-only.
    staff = not is_patient

    # A break-glass grade carries no standing access, so platform staff get an
    # empty worklist until they have actually elevated (§4.8).
    reachable = may_read_patients and (patient_grade != "breakglass" or bool(actor.elevation))
    encounters: list = []
    if reachable:
        rows = db.docs("SELECT doc FROM encounters WHERE tenant_id=? ORDER BY t0 DESC", (tenant_id,))
        encounters = scope_encounters(actor, rows, patient_grade)

    tenants = db.docs("SELECT doc FROM tenants ORDER BY name") if is_platform else \
        db.docs("SELECT doc FROM tenants WHERE id=?", (tenant_id,))

    # Platform staff see every incident. A hospital sees the platform-wide ones
    # and its own — another hospital's outage is that hospital's business.
    incidents: list = []
    if is_platform:
        incidents = db.docs("SELECT doc FROM incidents")
    elif may_tenant:
        own_name = tenants[0]["name"] if tenants else None
        incidents = [i for i in db.docs("SELECT doc FROM incidents")
                     if i.get("tenantName") in (None, own_name)]

    return {
        "generated_by": "backend/app/routers/bootstrap.py",
        "seed_note": "Synthetic demo data. No PHI, no MIMIC-IV records.",
        "now": db.document("now"),
        "active_tenant_id": tenant_id,
        "source": {"kind": "api", "role": actor.role, "elevated": bool(actor.elevation)},
        "patient_portal_enabled": portal_enabled,

        "tenants": tenants,
        "facilities": _if(staff, db.docs(
            "SELECT doc FROM facilities WHERE tenant_id=? ORDER BY name", (tenant_id,))),
        "users": _if(staff and (may_manage_users or may_read_patients),
                     db.docs("SELECT doc FROM users WHERE tenant_id=? ORDER BY name", (tenant_id,))),
        "invites": _if(staff and may_manage_users, db.docs("SELECT doc FROM invites WHERE tenant_id=?", (tenant_id,))),
        "encounters": encounters,

        # Model governance is readable by anyone signed in: the blueprint puts
        # evidence in front of clinicians rather than behind an admin role.
        "models": db.document("models") or [],
        "rollouts": db.document("rollouts") or [],
        "drift": db.document("drift") or [],
        "plans": settings_store.plans(),

        "audit_events": _if(staff and may_audit, db.docs(
            "SELECT doc FROM audit_events WHERE tenant_id=? AND platform=0 ORDER BY at DESC LIMIT 200",
            (tenant_id,))),
        "platform_audit": _if(may_cross_tenant, db.docs(
            "SELECT doc FROM audit_events WHERE platform=1 ORDER BY at DESC LIMIT 200")),
        "break_glass": _if(is_platform, db.docs(
            "SELECT doc FROM break_glass ORDER BY requested_at DESC")),
        "transfers": _if(staff and may_transfer, db.docs(
            "SELECT doc FROM transfers WHERE tenant_id=?", (tenant_id,))),
        "incidents": incidents,
        "invoices": _if(staff and may_bill, db.docs("SELECT doc FROM invoices WHERE tenant_id=?", (tenant_id,))),

        "released_results": _if(bool(patient_id), db.docs(
            "SELECT doc FROM released_results WHERE patient_id=? ORDER BY released_at DESC",
            (patient_id,))),
        "consents": _if(bool(patient_id), db.docs(
            "SELECT doc FROM consents WHERE patient_id=?", (patient_id,))),
        # Derived from the patient's encounters, not a separate list (care_team.py).
        "care_team": _if(bool(patient_id), care_team_for(patient_id) if patient_id else []),
        "records": _if(bool(patient_id), db.docs(
            "SELECT doc FROM records WHERE patient_id=? ORDER BY date DESC", (patient_id,))),

        "adoption_series": _if(may_tenant or may_audit, evidence.adoption_series(tenant_id)),
        # The one place audit covariates are reported, and only for the roles
        # §4.6 grants the fairness capability to.
        "subgroup_fairness": _if(may_fairness, db.document("subgroup_fairness") or []),

        "demo_identity": db.document("demo_identity") or {},
        "rbac": db.document("rbac") or {},
    }
