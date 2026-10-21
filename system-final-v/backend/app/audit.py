"""Access-audit writes.

Every read of patient data and every consequential write lands here, in the
same `AuditEvent` shape the admin and ops consoles already render — so the
audit screens show live activity, not only the seeded history.

`reason` is mandatory on break-glass and PHI export (§4.8). The helper refuses
to write those two actions without one rather than recording a blank, because
an audit row that cannot say *why* is the failure the requirement exists to
prevent.
"""

from __future__ import annotations

import json
import uuid

from . import db
from .security import iso, utcnow

REASON_REQUIRED = {"break_glass.invoke", "break_glass.approve", "export.phi"}

SEVERITY = {
    "assess.run": "info",
    "encounter.view": "info",
    "explanation.view": "info",
    "result.acknowledge": "notice",
    "result.release": "notice",
    "export.phi": "warning",
    "export.deidentified": "info",
    "patient.read": "info",
    "patient.submit": "info",
    "request.create": "info",
    "request.urgent": "warning",
    "user.password_change": "notice",
    "user.access_change": "notice",
    "transfer.request": "notice",
    "encounter.draft_save": "info",
    "break_glass.invoke": "critical",
    "break_glass.approve": "critical",
    "user.role_grant": "notice",
    "user.status_change": "notice",
    "invite.send": "info",
    "invite.revoke": "notice",
    "transfer.initiate": "notice",
    "transfer.approve": "notice",
    "consent.revoke": "notice",
    "login.success": "info",
    "login.failed": "warning",
    "tenant.config_change": "notice",
    "global_flag.change": "warning",
    "facility.create": "notice",
    "facility.update": "notice",
    "unit.create": "notice",
    "unit.delete": "notice",
    "user.password_reset": "notice",
    "integration.test": "info",
    "integration.configure": "notice",
    "encounter.create": "notice",
    "vitals.record": "info",
    "escalation.raise": "notice",
    "transfer.reject": "notice",
    "incident.update": "notice",
    "break_glass.deny": "notice",
    "break_glass.revoke": "notice",
    "consent.grant": "notice",
    "model.pin_version": "notice",
    "handoff.send": "notice",
    "user.password_reset_request": "notice",
    "request.status": "info",
    "patient.submission_seen": "info",
    "waitlist.join": "info",
    "waitlist.update": "info",
    "waitlist.delete": "notice",
    "waitlist.export": "notice",
    "support.open": "info",
    "support.reply": "info",
    "support.status": "info",
    "announcement.publish": "notice",
    "announcement.edit": "notice",
    "announcement.delete": "notice",
    "platform.super_admin_create": "critical",
}


def record(
    actor,
    action: str,
    target: str,
    *,
    outcome: str = "success",
    reason: str | None = None,
    tenant_id: str | None = None,
    ip: str = "127.0.0.1",
    platform: bool = False,
) -> dict:
    if action in REASON_REQUIRED and not reason:
        raise ValueError(f"audit action '{action}' requires a reason")

    severity = SEVERITY.get(action, "info")
    event = {
        "id": f"ev_live_{uuid.uuid4().hex[:12]}",
        "tenantId": tenant_id or getattr(actor, "tenant_id", "t_yves"),
        "at": iso(utcnow()),
        "actor": getattr(actor, "email", None) or getattr(actor, "user_id", "system"),
        "actorRole": getattr(actor, "role", "guest"),
        "action": action,
        "target": target,
        "outcome": outcome,
        "severity": severity,
        "ip": ip,
    }
    if reason:
        event["reason"] = reason

    conn = db.connect()
    conn.execute(
        "INSERT INTO audit_events (id, tenant_id, at, actor, action, severity, outcome, platform, doc)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (event["id"], event["tenantId"], event["at"], event["actor"], action,
         severity, outcome, 1 if platform else 0, json.dumps(event)),
    )
    conn.commit()
    return event
