"""Editable configuration, per scope.

Every settings screen — org profile, integrations, model display policy,
global flags, plan catalogue — reads and writes one document here instead of
getting its own table. The screens differ in what they hold, not in how they
behave: read the current document, merge a change into it, record who changed
it and when.

Defaults live in this module rather than in the database, so a fresh
deployment starts in a known state and a new setting does not need a
migration. A stored document is merged *over* the default, which means adding
a key here reaches existing tenants immediately.
"""

from __future__ import annotations

import json

from . import db
from .security import iso, utcnow

#: Scope -> whether it is platform-wide (True) or per-tenant (False).
PLATFORM_SCOPES = {"global_flags", "plan_catalog", "subprocessors"}

DEFAULTS: dict[str, dict] = {
    "org": {
        "displayName": None,          # falls back to the tenant's own name
        "brandingHex": "#2a6fbf",
        "requireResidentCosign": True,
        "timezone": "America/New_York",
        "dateFormat": "D MMM YYYY",
        "supportEmail": None,
        "primaryContact": None,
        "assessmentRetention": "6y",
        "showNameInTopbar": True,
        "patientPortalEnabled": True,
        "benchmarkingOptIn": True,
        "allowEsapBreakGlass": False,
        "breakGlassSecondApprover": True,
        "allowScopeDelegation": False,
        "nursesSeeRiskSummaries": True,
    },
    # Keys match the integration cards in AdminIntegrations.tsx. No endpoint is
    # configured out of the box, so a connection test reports not_configured
    # rather than a green tick it cannot justify.
    "integrations": {
        "sso": {"enabled": False, "endpoint": None, "status": "not_configured",
                # OIDC relying-party config. issuer/clientId point at the hospital
                # IdP; allowedDomain maps an email domain to this tenant on the
                # login page; defaultRole is the JIT-provisioned role for a
                # first-time SSO user (a clinical role only).
                "issuer": None, "clientId": None, "allowedDomain": None, "defaultRole": "physician"},
        "scim": {"enabled": False, "endpoint": None, "status": "not_configured"},
        "smart": {"enabled": False, "endpoint": None, "status": "not_configured"},
        "adt": {"enabled": False, "endpoint": None, "status": "not_configured"},
        "fhir": {"enabled": False, "endpoint": None, "status": "not_configured"},
        "webhook": {"enabled": False, "endpoint": None, "status": "not_configured"},
        # Connection policy shown under the cards.
        "policy": {"requireSso": True, "t0FromAdmit": True, "alertOnSilence": True, "verifyTls": True},
    },
    "model_display": {
        # Which models a clinician sees. Per §17, this is a display policy and
        # never a safety gate: calibration, the Why panel and the degraded
        # label are present whatever is toggled here.
        "enabled": {"M-01": True, "M-02": True, "M-03": True, "M-04": True, "M-05": True},
        "unitOverrides": {"u_micu": ["M-03"]},
        "suppressedCategories": [
            {"ccsr": "MBD002", "name": "Depressive disorders",
             "why": "Behavioural health flagged at intake without consent was raised by the ethics committee."},
            {"ccsr": "MBD012", "name": "Substance-related disorders",
             "why": "Site policy: never surfaced from a model, only from a clinician-entered problem list."},
        ],
        "differentialTopN": 20,
        "readmissionAlertThreshold": 0.28,
        "showFamilySwatch": True,
        "showUnscoredCount": True,
        "flagUnconfirmed": True,
    },
    "roles": {
        # Local job titles mapped onto the fixed role codes (§11.4.5). The
        # mapping is cosmetic: it renames what staff see, never what they may do.
        "titleMap": {},
    },
    "global_flags": {
        "TOWER_B_ENABLED": False,
        "TOWER_C_ENABLED": False,
        "PREFILL_ENABLED": False,
        "CHAT_ENABLED": True,
        "SCREENING_MODE": False,
    },
    # The register every tenant's privacy officer is shown. Edited through a
    # subprocessor review, never silently.
    "subprocessors": {"entries": [
        {"name": "Amazon Web Services", "purpose": "Hosting and storage", "region": "US, EU", "phi": True, "since": "2024-11-01"},
        {"name": "Cloudflare", "purpose": "Edge TLS termination and DDoS protection", "region": "Global", "phi": False, "since": "2024-11-01"},
        {"name": "Datadog", "purpose": "Infrastructure telemetry", "region": "US", "phi": False, "since": "2025-02-14"},
        {"name": "Twilio SendGrid", "purpose": "Transactional email (invites, alerts)", "region": "US", "phi": False, "since": "2024-11-01"},
        {"name": "Stripe", "purpose": "Payment processing (self-serve tier only)", "region": "US", "phi": False, "since": "2025-01-20"},
    ]},
    "plan_catalog": {"overrides": {}},
    "patient_prefs": {
        "language": "en",
        "theme": "system",
        "textSize": "normal",
        "detailLevel": "simple",
        "reduceMotion": False,
        "readAloud": False,
        "notifications": {
            "results": True, "appointments": False, "sharing": True,
            "access": True, "marketing": False, "familyViews": True,
        },
    },
}


def _merge(base: dict, over: dict) -> dict:
    """Deep-merge `over` onto a copy of `base` (dicts recurse, others replace)."""
    out = dict(base)
    for key, value in over.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def known(scope: str) -> bool:
    return scope in DEFAULTS


def read(scope: str, tenant_id: str) -> dict:
    key = "_platform" if scope in PLATFORM_SCOPES else tenant_id
    row = db.connect().execute(
        "SELECT doc, updated_at, updated_by FROM settings WHERE scope=? AND tenant_id=?",
        (scope, key),
    ).fetchone()
    stored = json.loads(row["doc"]) if row else {}
    return {
        "scope": scope,
        "settings": _merge(DEFAULTS.get(scope, {}), stored),
        "updated_at": row["updated_at"] if row else None,
        "updated_by": row["updated_by"] if row else None,
    }


def write(scope: str, tenant_id: str, patch: dict, actor_email: str) -> dict:
    """Merge `patch` into the stored document and stamp it.

    A patch, not a replace: a settings screen sends the field it changed, so
    two people editing different tabs of the same scope do not overwrite each
    other's work.
    """
    key = "_platform" if scope in PLATFORM_SCOPES else tenant_id
    conn = db.connect()
    row = conn.execute(
        "SELECT doc FROM settings WHERE scope=? AND tenant_id=?", (scope, key)
    ).fetchone()
    merged = _merge(json.loads(row["doc"]) if row else {}, patch)
    now = iso(utcnow())
    conn.execute(
        "INSERT INTO settings(scope, tenant_id, doc, updated_at, updated_by) VALUES(?,?,?,?,?)"
        " ON CONFLICT(scope, tenant_id) DO UPDATE SET"
        " doc=excluded.doc, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        (scope, key, json.dumps(merged), now, actor_email),
    )
    conn.commit()
    return read(scope, tenant_id)


def plans() -> list[dict]:
    """The plan catalogue as it stands: the seeded plans with every edit made
    from the ops console applied, plus any plan created there. Every screen that
    lists plans reads this, so an edit is visible wherever plans appear."""
    base = [dict(p) for p in (db.document("plans") or [])]
    overrides = read("plan_catalog", "_platform")["settings"].get("overrides", {})
    by_tier = {p["tier"]: p for p in base}
    for tier, patch in overrides.items():
        if tier in by_tier:
            by_tier[tier].update(patch)
        else:
            base.append({"tier": tier, "name": tier, "priceLabel": "", "unit": "",
                         "forWho": "", "features": [], "limits": [], **patch})
    return base
