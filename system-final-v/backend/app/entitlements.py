"""Plan entitlements — what a tenant's plan actually unlocks, enforced server-side.

The plan catalogue (`settings_store.plans()`) carries human-readable feature and
limit strings for the pricing page. This module is the machine-readable half: the
capabilities each tier grants, consulted by the clinical and interop routes so a
plan is a real gate and not just marketing copy.

Metering/quotas (assessments-per-month, seat counts) are deliberately NOT here —
those belong to billing, which is out of scope. This covers *feature* access:
which models a plan may run, and how far its record-transfer reaches.
"""

from __future__ import annotations

from . import db

ALL_MODELS = {"M-01", "M-02", "M-03", "M-04", "M-05"}

#: interop levels, least to most reach.
INTEROP_NONE = "none"      # no cross-organisation record transfer
INTEROP_ESAP = "esap"      # ESAP-to-ESAP fast path only
INTEROP_TEFCA = "tefca"    # TEFCA / external EHR transfer as well

#: tier -> capabilities. Unknown tiers fall back to ESSENTIAL (a safe hospital
#: default), never to "everything".
_TIERS: dict[str, dict] = {
    "free":         {"models": {"M-02", "M-03", "M-05"}, "interop": INTEROP_NONE, "admin_console": False, "sso": False},
    "pro":          {"models": ALL_MODELS,                "interop": INTEROP_NONE, "admin_console": False, "sso": False},
    "pilot":        {"models": ALL_MODELS,                "interop": INTEROP_ESAP, "admin_console": True,  "sso": False},
    "essential":    {"models": ALL_MODELS,                "interop": INTEROP_ESAP, "admin_console": True,  "sso": True},
    "professional": {"models": ALL_MODELS,                "interop": INTEROP_TEFCA, "admin_console": True, "sso": True},
    "enterprise":   {"models": ALL_MODELS,                "interop": INTEROP_TEFCA, "admin_console": True, "sso": True},
}
_DEFAULT = _TIERS["essential"]


def _tenant_plan(tenant_id: str) -> str:
    row = db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,))
    return (row or {}).get("plan", "essential")


def for_tenant(tenant_id: str) -> dict:
    """The capability set for a tenant's current plan."""
    return _TIERS.get(_tenant_plan(tenant_id), _DEFAULT)


def models_allowed(tenant_id: str) -> set[str]:
    return set(for_tenant(tenant_id)["models"])


def interop_level(tenant_id: str) -> str:
    return for_tenant(tenant_id)["interop"]
