"""Editable configuration — `/api/v1/settings/{scope}`.

One pair of routes serves every settings screen. Each scope declares the
permission it needs, so the route does not have to enumerate screens, and a
new settings tab is a default plus a permission rather than a new endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, rbac, settings_store
from ..deps import Actor, current_actor, tenant_scope
from ..errors import ApiError

router = APIRouter(tags=["settings"])

#: scope -> (permission(s) to read, permission to write). A read side can be a
#: tuple of alternatives — model_display is read by clinicians (patient:read)
#: showing what they've been shown, and by whoever configured it (tenant:manage,
#: held by tenant_owner/it_admin, neither of whom holds patient:read) reading
#: back what they just set. `patient:read` alone left the admin screen unable
#: to read its own settings, silently falling back to defaults (§11.4.7).
SCOPE_PERMISSIONS: dict[str, tuple[str | tuple[str, ...], str]] = {
    "org": ("tenant:manage", "tenant:manage"),
    "integrations": ("tenant:manage", "tenant:manage"),
    "model_display": (("patient:read", "tenant:manage"), "tenant:manage"),
    "roles": ("user:manage", "user:manage"),
    "global_flags": ("model:admin", "model:admin"),
    "subprocessors": ("tenant:manage", "tenant:create"),
    "plan_catalog": ("billing:view", "tenant:create"),
    "patient_prefs": ("patient:read", "patient:read"),
}


class SettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patch: dict = Field(default_factory=dict)
    #: Required when changing a platform-wide flag — it affects every hospital.
    reason: str | None = Field(None, max_length=400)


def _check(scope: str, actor: Actor, write: bool) -> None:
    if not settings_store.known(scope):
        raise ApiError(404, f"No settings scope '{scope}'. "
                            f"Known: {sorted(settings_store.DEFAULTS)}")
    read_perm, write_perm = SCOPE_PERMISSIONS[scope]
    if write:
        rbac.require(actor, write_perm)
    elif isinstance(read_perm, tuple):
        rbac.require_any(actor, read_perm)
    else:
        rbac.require(actor, read_perm)
    if scope in settings_store.PLATFORM_SCOPES and not actor.is_platform and write:
        raise ApiError(403, "Platform-wide settings are changed from the operations console only.")


@router.get("/settings/{scope}")
def read_settings(
    scope: str,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    _check(scope, actor, write=False)
    if scope == "patient_prefs" and actor.role != "patient":
        raise ApiError(403, "Patient preferences belong to the patient's own account.")
    key = actor.user_id if scope == "patient_prefs" else tenant_id
    return settings_store.read(scope, key)


@router.put("/settings/{scope}")
def write_settings(
    scope: str,
    body: SettingsPatch,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Merge a change into a settings scope.

    A platform-wide flag needs a written reason: it changes behaviour for every
    hospital at once, and "who turned this on and why" is the first question
    asked when one of them notices.
    """
    _check(scope, actor, write=True)
    if scope == "patient_prefs" and actor.role != "patient":
        raise ApiError(403, "Patient preferences belong to the patient's own account.")
    if scope in settings_store.PLATFORM_SCOPES and not (body.reason or "").strip():
        raise ApiError(400, "A platform-wide change requires a written reason.")
    if scope == "roles" and actor.role not in ("tenant_owner", "super_admin"):
        # "roles" holds the job-title → ESAP-role auto-provisioning map (§11.4.5).
        # `user:manage` alone (the scope's write permission, held by IT Admin at
        # scoped grade) must not let a mapping silently hand out a role that can
        # open a chart the moment SSO/SCIM provisioning starts consuming it —
        # same tenant_owner-only boundary as an invite or a roster role change.
        for mapping in (body.patch.get("titleMap") or {}).values():
            if rbac.roles().get(mapping.get("role"), {}).get("surface") == "clinician":
                raise ApiError(403, "Mapping a job title to a clinical role is reserved to the Hospital Admin.")

    key = actor.user_id if scope == "patient_prefs" else tenant_id
    result = settings_store.write(scope, key, body.patch, actor.email)

    if scope != "patient_prefs":
        audit.record(
            actor,
            "global_flag.change" if scope in settings_store.PLATFORM_SCOPES else "tenant.config_change",
            f"settings:{scope}", reason=body.reason, tenant_id=tenant_id,
            ip=request.client.host if request.client else "unknown",
            platform=scope in settings_store.PLATFORM_SCOPES,
        )
    return result
