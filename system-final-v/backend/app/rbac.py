"""Server-side permission checks against the §4.6 matrix.

The matrix is read from the seed (`documents.rbac`), which the frontend exports
from `src/lib/rbac.ts`. One matrix, two enforcers: the UI grades what it renders,
the server grades what it answers. A UI that forgets to hide a control still
gets a 403.

Access is graded, not boolean, so the server distinguishes:
  full       standing access at the role's scope
  scoped     own-record / assigned-roster / unit only  -> caller must scope the query
  cosign     allowed, but the write needs a second approver
  breakglass not standing — only inside a live elevation (§4.8)
"""

from __future__ import annotations

from typing import Literal

from . import db
from .errors import ApiError

Grade = Literal["full", "scoped", "cosign", "breakglass", "none"]


def matrix() -> dict:
    return (db.document("rbac") or {}).get("matrix", {})


def roles() -> dict:
    return (db.document("rbac") or {}).get("roles", {})


def grade(role: str, perm: str) -> Grade:
    return matrix().get(role, {}).get(perm, "none")


def can(role: str, perm: str) -> bool:
    return grade(role, perm) != "none"


def may_elevate(role: str) -> bool:
    """Can this role request a break-glass elevation at all?

    True when the role either holds `break_glass:invoke` outright (clinicians,
    who break glass into another unit's patient) or has any capability graded
    `breakglass` (platform staff, whose `patient:read` is reachable only that
    way). Checking only the named permission would lock super_admin out of the
    very mechanism §4.8 designs for it.
    """
    grades = matrix().get(role, {})
    return grades.get("break_glass:invoke", "none") != "none" or "breakglass" in grades.values()


def require_elevatable(actor) -> None:
    if not may_elevate(actor.role):
        raise ApiError(403, f"Role '{actor.role}' cannot request a break-glass elevation.")


def require_any(actor, perms: tuple[str, ...]) -> str:
    """Authorize `actor` for ANY of `perms`, returning the first one they hold.

    For pages that several governance roles legitimately read through different
    capabilities (e.g. usage/outcomes: the Hospital Admin via tenant:manage, a QI
    auditor via audit:view, Billing via billing:view). Raises the contract's 403
    naming the alternatives if the caller holds none.
    """
    for p in perms:
        if can(actor.role, p):
            g = grade(actor.role, p)
            if not (g == "breakglass" and not actor.elevation):
                return p
    raise ApiError(403, f"This needs one of: {', '.join(perms)}.",
                   detail={"permission_any": list(perms)})


def require(actor, perm: str) -> Grade:
    """Authorize `actor` for `perm`, or raise the contract's 403.

    A `breakglass` grade is only satisfied by a live elevation on the session —
    that is the whole point of §4.8: platform staff hold no standing PHI access.
    """
    g = grade(actor.role, perm)
    if g == "none":
        raise ApiError(403, f"Role '{actor.role}' has no '{perm}' capability.", detail={"permission": perm})
    if g == "breakglass" and not actor.elevation:
        raise ApiError(
            403,
            f"'{perm}' is break-glass only. Request a time-boxed elevation with a reason and a ticket.",
            detail={"permission": perm, "grade": g, "requires": "elevation"},
        )
    return g
