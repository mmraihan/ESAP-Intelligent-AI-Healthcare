"""Processing consent and the retention purge (QA issue 9).

Consent: a patient records a decision per purpose against a numbered policy
version. A new version needs a new decision, so a patient is never held to
wording they did not see. Withdrawing keeps the row and stamps the time; the
history of what was agreed, and when it stopped, is itself a record the
patient and the privacy officer can read.

Care itself is not on the list: treating a patient does not rest on consent
in the portal, and offering a switch that could not really stop it would be
misleading. The purposes here are the optional ones.

Retention: `run_purge` deletes what has outlived its retention period and
writes a report row saying exactly what went, by rule, with the cutoff used.
It runs on a schedule (main.py) and on demand from the admin console.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac, settings_store
from ..deps import Actor, current_actor
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["privacy"])

POLICY_VERSION = "2026-11"

PURPOSES: list[dict] = [
    {
        "id": "ai_decision_support",
        "label": "Let the AI decision-support tool use my information",
        "detail": "Your clinicians can run the AI tool on what is known about you when you are admitted. "
                  "It helps them; it never makes a decision on its own. If you say no, your care is the same "
                  "and your clinicians simply do not use the tool for you.",
        "default": True,
    },
    {
        "id": "quality_improvement",
        "label": "Use my information, with my name removed, to check the AI is fair and accurate",
        "detail": "Results are counted across many patients to see whether the tool works equally well for "
                  "everyone. Nobody looking at the counts can tell who you are.",
        "default": True,
    },
    {
        "id": "research",
        "label": "Use my information, with my name removed, for approved research",
        "detail": "Only research an ethics committee has approved. Off unless you turn it on.",
        "default": False,
    },
]
_PURPOSE_IDS = {p["id"] for p in PURPOSES}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConsentDecision(Strict):
    purpose: str
    version: str = Field(min_length=4, max_length=20)
    decision: str


def _patient(actor: Actor) -> str:
    if actor.role != "patient":
        raise ApiError(403, "Consent decisions are made by the patient on their own record.")
    return actor.user_id


def current_decisions(patient_id: str) -> dict[str, dict]:
    """The latest decision per purpose for this patient (any version)."""
    rows = db.docs("SELECT doc FROM processing_consents WHERE patient_id=? ORDER BY json_extract(doc,'$.decidedAt')",
                   (patient_id,))
    latest: dict[str, dict] = {}
    for r in rows:
        latest[r["purpose"]] = r
    return latest


def withdrawn(portal_id: str, purpose: str) -> bool:
    """True when this patient's latest decision for the purpose is a withdrawal."""
    d = current_decisions(portal_id).get(purpose)
    return bool(d and d["status"] == "withdrawn")


def portal_id_for_clinical_patient(clinical_id: str) -> str | None:
    links = db.document("portal_links") or {}
    return links.get(clinical_id)


@router.get("/consents")
def my_consents(actor: Actor = Depends(current_actor)):
    """The current policy, this patient's decision per purpose, and the full
    history (every decision ever made, including withdrawals)."""
    patient_id = _patient(actor)
    history = db.docs("SELECT doc FROM processing_consents WHERE patient_id=?"
                      " ORDER BY json_extract(doc,'$.decidedAt') DESC", (patient_id,))
    latest = current_decisions(patient_id)
    return {
        "policy": {"version": POLICY_VERSION, "purposes": PURPOSES},
        "decisions": {
            p["id"]: {
                "status": latest[p["id"]]["status"] if p["id"] in latest else None,
                "version": latest[p["id"]]["version"] if p["id"] in latest else None,
                "decidedAt": latest[p["id"]]["decidedAt"] if p["id"] in latest else None,
                # A decision made on an older policy needs to be made again.
                "needsReview": p["id"] not in latest or latest[p["id"]]["version"] != POLICY_VERSION,
            }
            for p in PURPOSES
        },
        "history": history,
    }


@router.post("/consents", status_code=201)
def decide(body: ConsentDecision, request: Request, actor: Actor = Depends(current_actor)):
    patient_id = _patient(actor)
    if body.purpose not in _PURPOSE_IDS:
        raise ApiError(422, f"purpose must be one of: {', '.join(sorted(_PURPOSE_IDS))}.")
    if body.decision not in {"given", "withdrawn"}:
        raise ApiError(422, "decision must be given or withdrawn.")
    if body.version != POLICY_VERSION:
        raise ApiError(409, f"The policy has changed to version {POLICY_VERSION}. Read it again before deciding.")
    now = iso(utcnow())
    doc = {
        "id": f"pc_{uuid.uuid4().hex[:10]}", "patientId": patient_id, "purpose": body.purpose,
        "version": body.version, "status": body.decision, "decidedAt": now,
        "givenAt": now if body.decision == "given" else None,
        "withdrawnAt": now if body.decision == "withdrawn" else None,
        "channel": "patient_portal",
    }
    conn = db.connect()
    conn.execute(
        "INSERT INTO processing_consents (id, patient_id, purpose, version, status, given_at, withdrawn_at, doc)"
        " VALUES (?,?,?,?,?,?,?,?)",
        (doc["id"], patient_id, body.purpose, body.version, body.decision, doc["givenAt"],
         doc["withdrawnAt"], json.dumps(doc)),
    )
    conn.commit()
    audit.record(actor, "consent.processing_" + ("give" if body.decision == "given" else "withdraw"),
                 f"{body.purpose} v{body.version}", ip=request.client.host if request.client else "unknown")
    return doc


@router.get("/admin/consents/summary")
def consent_summary(actor: Actor = Depends(current_actor)):
    """Counts per purpose for the privacy officer. No names: counts only."""
    rbac.require_any(actor, ("audit:view", "tenant:manage"))
    # Portal patients have a sign-in but no staff-directory (users) row.
    patients = {r["user_id"] for r in db.connect().execute(
        "SELECT user_id FROM credentials WHERE tenant_id=? AND role='patient'", (actor.tenant_id,))}
    out = {p["id"]: {"given": 0, "withdrawn": 0, "undecided": 0} for p in PURPOSES}
    for pid in patients:
        latest = current_decisions(pid)
        for p in PURPOSES:
            d = latest.get(p["id"])
            out[p["id"]]["undecided" if d is None else d["status"]] += 1
    return {"policyVersion": POLICY_VERSION, "patients": len(patients), "byPurpose": out}


# --- retention purge ---------------------------------------------------------

_DURATION = re.compile(r"^(\d+)([dmy])$")


def _days(spec: str, default: int) -> int:
    m = _DURATION.match((spec or "").strip().lower())
    if not m:
        return default
    n, unit = int(m.group(1)), m.group(2)
    return n * {"d": 1, "m": 30, "y": 365}[unit]


#: Fixed platform rules: (name, table, timestamp column, days, extra WHERE).
PLATFORM_RULES = (
    ("Expired sign-in sessions", "sessions", "expires_at", 0, ""),
    ("Used or expired password-reset links", "password_resets", "expires_at", 7, ""),
    ("Sent-mail log", "mail_outbox", "created_at", 90, ""),
    ("Old failed-sign-in counters", "login_throttle", "first_at", 1, " AND locked_until IS NULL"),
    # The access-audit trail is kept for six years, then purged.
    ("Audit events older than six years", "audit_events", "at", 6 * 365, ""),
)


def _delete_before(table: str, column: str, cutoff: str, extra: str = "", params: tuple = ()) -> int:
    conn = db.connect()
    cur = conn.execute(f"DELETE FROM {table} WHERE {column} < ?{extra}", (cutoff, *params))  # noqa: S608
    return cur.rowcount or 0


def run_purge(tenant_id: str | None, by: str, trigger: str) -> dict:
    """Apply retention. `tenant_id=None` runs the platform rules and every
    tenant's; otherwise only that tenant's rules. Writes one report per call."""
    now = utcnow()
    rules: list[dict] = []
    if tenant_id is None:
        for name, table, col, days, extra in PLATFORM_RULES:
            cutoff = iso(now - timedelta(days=days))
            rules.append({"rule": name, "table": table, "cutoff": cutoff,
                          "deleted": _delete_before(table, col, cutoff, extra)})
        tenants = [t["id"] for t in db.docs("SELECT doc FROM tenants")]
    else:
        tenants = [tenant_id]
    for tid in tenants:
        spec = settings_store.read("org", tid)["settings"].get("assessmentRetention", "6y")
        cutoff = iso(now - timedelta(days=_days(spec, 6 * 365)))
        rules.append({"rule": f"Assessments older than {spec}", "table": "assessments", "tenantId": tid,
                      "cutoff": cutoff,
                      "deleted": _delete_before("assessments", "created_at", cutoff, " AND tenant_id=?", (tid,))})
    db.connect().commit()
    report = {"id": f"rr_{uuid.uuid4().hex[:10]}", "tenantId": tenant_id, "runAt": iso(now), "by": by,
              "trigger": trigger, "rules": rules, "totalDeleted": sum(r["deleted"] for r in rules)}
    conn = db.connect()
    conn.execute("INSERT INTO retention_reports (id, tenant_id, run_at, doc) VALUES (?,?,?,?)",
                 (report["id"], tenant_id, report["runAt"], json.dumps(report)))
    conn.commit()
    return report


def _retention_admin(actor: Actor) -> None:
    rbac.require_any(actor, ("audit:view", "tenant:manage"))


@router.post("/admin/retention/run", status_code=201)
def run_tenant_purge(request: Request, actor: Actor = Depends(current_actor)):
    _retention_admin(actor)
    # The purge deletes records. An auditor's access is read-only by design:
    # they may read the reports, not cause what the reports record.
    if actor.role == "auditor":
        raise ApiError(403, "Auditors can read retention reports but cannot run a purge.")
    report = run_purge(actor.tenant_id, actor.email, "manual")
    audit.record(actor, "retention.purge", f"{report['id']}: {report['totalDeleted']} deleted",
                 ip=request.client.host if request.client else "unknown")
    return report


@router.get("/admin/retention/reports")
def tenant_reports(actor: Actor = Depends(current_actor)):
    """Purge reports covering this tenant: its own runs and the platform runs."""
    _retention_admin(actor)
    rows = db.docs("SELECT doc FROM retention_reports WHERE tenant_id=? OR tenant_id IS NULL"
                   " ORDER BY run_at DESC LIMIT 50", (actor.tenant_id,))
    for r in rows:
        # A platform run covers every tenant; show this tenant only its own lines.
        r["rules"] = [x for x in r["rules"] if x.get("tenantId") in (None, actor.tenant_id)]
        r["totalDeleted"] = sum(x["deleted"] for x in r["rules"])
    return {"reports": rows}


@router.post("/ops/retention/run", status_code=201)
def run_platform_purge(request: Request, actor: Actor = Depends(current_actor)):
    if not actor.is_platform:
        raise ApiError(403, "This console is platform-operations only.")
    report = run_purge(None, actor.email, "manual")
    audit.record(actor, "retention.purge", f"{report['id']}: {report['totalDeleted']} deleted",
                 platform=True, ip=request.client.host if request.client else "unknown")
    return report
