"""Exports — `POST /api/v1/exports`, `GET /api/v1/exports`.

Every "Download", "Export" and "Generate report" button in the product lands
here. One endpoint rather than a dozen, because what matters about an export
is not which screen it came from:

* **Whether it carries patient data decides the permission.** PHI exports need
  `export:phi` and a written reason; de-identified ones need
  `export:deidentified` and do not. The *kind* determines which, so a caller
  cannot downgrade an export by asking nicely.
* **The record is written before the payload is returned.** An export that
  failed to log is an export that did not happen — so the audit row is not a
  side effect of a successful download, it is a precondition for one.
* **The export itself appears in the audit log**, which is why the admin audit
  screen can say "this export is now the newest entry in the log".

The payload is assembled from the caller's own scope, so an export cannot
widen access: exporting the roster returns the roster that caller can already
read.
"""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, evidence, rbac
from ..deps import Actor, current_actor, display_name, tenant_scope
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["exports"])


class ExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    #: Required for any export carrying patient data. Blank is refused.
    reason: str | None = Field(None, max_length=500)
    #: Optional narrowing, e.g. {"encounter_id": "...", "invoice_id": "..."}.
    scope: dict = Field(default_factory=dict)


#: kind -> (contains_phi, permissions accepted, human label)
#:
#: Permissions are any-of, not all-of. A fairness report is de-identified and
#: the privacy officer owns that screen, but the matrix gives
#: `export:deidentified` to the auditor alone — requiring it literally would
#: lock the owner out of exporting their own report. The capability that gates
#: the screen is accepted alongside it.
KINDS: dict[str, tuple[bool, tuple[str, ...], str]] = {
    "audit_log": (False, ("audit:view",), "Audit log"),
    "platform_audit": (False, ("audit:cross_tenant",), "Platform audit log"),
    "roster": (True, ("export:phi", "user:manage"), "User roster"),
    "fairness_report": (False, ("export:deidentified", "fairness:audit_view"), "Fairness report"),
    "usage_report": (False, ("audit:view", "tenant:manage", "fairness:audit_view", "billing:view"), "Usage and outcomes report"),
    "invoice": (False, ("billing:view",), "Invoice"),
    "billing_statement": (False, ("billing:view",), "Billing statement"),
    "encounter_summary": (True, ("export:phi",), "Encounter summary"),
    "handoff": (True, ("export:phi",), "Shift handoff"),
    "discharge_packet": (True, ("export:phi",), "Discharge packet"),
    "patient_record": (True, ("export:phi",), "Full patient record"),
}


def _payload(kind: str, actor: Actor, tenant_id: str, scope: dict) -> tuple[list | dict, int]:
    """Assemble an export from what this caller may already read."""
    if kind == "audit_log":
        # The report builder's filters: a date range, and one of whole tenant,
        # a single patient (by MRN — an accounting of disclosures), a single
        # user (by email) or break-glass only.
        sql = "SELECT doc FROM audit_events WHERE tenant_id=? AND platform=0"
        params: list = [tenant_id]
        if scope.get("from"):
            sql += " AND at >= ?"
            params.append(str(scope["from"]))
        if scope.get("to"):
            sql += " AND at < ?"
            params.append(f"{scope['to']}T23:59:59.999Z")
        focus, value = scope.get("filter", "all"), str(scope.get("value") or "").strip()
        if focus == "bg":
            sql += " AND action LIKE 'break_glass.%'"
        elif focus == "actor" and value:
            sql += " AND actor=?"
            params.append(value)
        elif focus == "patient" and value:
            sql += " AND json_extract(doc, '$.target') LIKE ?"
            params.append(f"%{value}%")
        rows = db.docs(sql + " ORDER BY at DESC LIMIT 5000", params)
        if scope.get("detail") == "summary":
            counts: dict[str, int] = {}
            for r in rows:
                counts[r["action"]] = counts.get(r["action"], 0) + 1
            return {"summary": counts, "events": len(rows)}, len(rows)
        return rows, len(rows)
    if kind == "platform_audit":
        rows = db.docs("SELECT doc FROM audit_events WHERE platform=1 ORDER BY at DESC LIMIT 1000")
        return rows, len(rows)
    if kind == "roster":
        rows = db.docs("SELECT doc FROM users WHERE tenant_id=? ORDER BY name", (tenant_id,))
        return rows, len(rows)
    if kind == "fairness_report":
        rows = db.document("subgroup_fairness") or []
        return {"subgroups": rows, "deidentified": True}, len(rows)
    if kind == "usage_report":
        return {"adoption": evidence.adoption_series(tenant_id),
                "drift": db.document("drift") or [],
                "models": db.document("models") or []}, 1
    if kind in {"invoice", "billing_statement"}:
        invoice_id = scope.get("invoice_id")
        rows = db.docs("SELECT doc FROM invoices WHERE tenant_id=?", (tenant_id,))
        if invoice_id:
            rows = [r for r in rows if r["id"] == invoice_id]
            if not rows:
                raise ApiError(404, "No such invoice.")
        return rows, len(rows)
    if kind in {"encounter_summary", "handoff"}:
        from .clinical import scope_encounters

        rows = db.docs("SELECT doc FROM encounters WHERE tenant_id=?", (tenant_id,))
        rows = scope_encounters(actor, rows, rbac.grade(actor.role, "patient:read"))
        encounter_id = scope.get("encounter_id")
        if encounter_id:
            rows = [r for r in rows if r["id"] == encounter_id]
            if not rows:
                raise ApiError(403, "That encounter is outside your assigned scope.")
        return rows, len(rows)
    if kind == "discharge_packet":
        from .clinical import scope_encounters

        rows = db.docs("SELECT doc FROM encounters WHERE tenant_id=? AND state != 'closed'", (tenant_id,))
        rows = scope_encounters(actor, rows, rbac.grade(actor.role, "patient:read"))
        wanted = scope.get("encounter_ids")
        if wanted is not None:
            visible = {r["id"] for r in rows}
            if set(wanted) - visible:
                raise ApiError(403, "The packet names a patient outside your assigned scope.")
            rows = [r for r in rows if r["id"] in set(wanted)]
        # What discharge planning works from: the stay interval and the intake
        # readmission estimate, with the patient's own notes left to the team.
        packet = [{
            "encounterId": r["id"], "name": r["patient"]["name"], "mrn": r["patient"]["mrn"],
            "unit": r.get("unitName"), "bed": r.get("bed"), "admittedAt": r.get("admittedAt"),
            "attending": r.get("attending"), "losLowDays": r["risks"].get("losLow"),
            "losHighDays": r["risks"].get("losHigh"), "readmissionIntake": r["risks"].get("readmission"),
            "hasPriorHistory": r.get("hasPriorHistory"),
        } for r in rows]
        return packet, len(packet)
    if kind == "patient_record":
        if actor.role != "patient":
            raise ApiError(403, "A full patient record export is the patient's own right of access.")
        return {
            "records": db.docs("SELECT doc FROM records WHERE patient_id=?", (actor.user_id,)),
            "results": db.docs("SELECT doc FROM released_results WHERE patient_id=?", (actor.user_id,)),
            "consents": db.docs("SELECT doc FROM consents WHERE patient_id=?", (actor.user_id,)),
        }, 1
    raise ApiError(422, f"Unknown export kind '{kind}'.")


@router.post("/exports", status_code=201)
def create_export(
    body: ExportRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    if body.kind not in KINDS:
        raise ApiError(422, f"Unknown export kind '{body.kind}'. Known: {sorted(KINDS)}")
    contains_phi, permissions, label = KINDS[body.kind]
    granted = next((p for p in permissions if rbac.can(actor.role, p)), None)
    if granted is None:
        raise ApiError(403, f"Exporting the {label.lower()} needs one of: {', '.join(permissions)}.",
                       detail={"permissions": list(permissions)})
    rbac.require(actor, granted)

    if contains_phi and not (body.reason or "").strip():
        raise ApiError(
            400,
            "An export containing patient data requires a written reason. "
            "It is recorded in the audit log beside your name.",
        )

    payload, rows = _payload(body.kind, actor, tenant_id, body.scope)

    export_id = f"exp_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": export_id, "kind": body.kind, "label": label, "tenantId": tenant_id,
        "requestedBy": display_name(actor), "requestedByEmail": actor.email,
        "requestedAt": iso(utcnow()), "containsPhi": contains_phi,
        "reason": body.reason, "rowCount": rows, "scope": body.scope,
    }
    conn = db.connect()
    conn.execute(
        "INSERT INTO exports (id, tenant_id, kind, requested_by, requested_at,"
        " contains_phi, reason, row_count, doc) VALUES (?,?,?,?,?,?,?,?,?)",
        (export_id, tenant_id, body.kind, actor.email, doc["requestedAt"],
         1 if contains_phi else 0, body.reason, rows, json.dumps(doc)),
    )
    conn.commit()

    # Logged before the payload is handed over, never after.
    audit.record(
        actor,
        "export.phi" if contains_phi else "export.deidentified",
        f"{label} ({rows} rows)",
        reason=body.reason, tenant_id=tenant_id,
        ip=request.client.host if request.client else "unknown",
        platform=body.kind == "platform_audit",
    )
    return {"export": doc, "data": payload}


@router.get("/exports")
def list_exports(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    limit: int = Query(50, ge=1, le=500),
):
    """Export history — what left, when, who asked and why."""
    rbac.require(actor, "audit:view")
    return {"exports": db.docs(
        "SELECT doc FROM exports WHERE tenant_id=? ORDER BY requested_at DESC LIMIT ?",
        (tenant_id, limit),
    )}
