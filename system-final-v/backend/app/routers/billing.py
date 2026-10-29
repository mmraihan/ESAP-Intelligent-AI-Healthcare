"""Self-serve billing through Polar — checkout out, webhooks in.

Two kinds of buyer, two kinds of owner:

* an individual clinician (the shared `t_solo` tenant) buys Pro for their own
  seat, so the plan is written onto their user record;
* a hospital's owner or billing admin buys the Pilot (one-time), Essential or
  Professional (per bed, beds passed to Polar as seats), so the plan is written
  onto the tenant.

Enterprise is a sales contract and never goes through here.

Polar is the source of truth for whether something is paid. Checkout only hands
the browser a Polar URL; nothing is unlocked until a signed webhook says so. The
webhook is the one unauthenticated route that changes access, so it verifies
the Standard Webhooks signature before reading a byte of the payload, and it
records every delivery id so a retried event is never applied twice.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import sqlite3
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac
from ..config import settings
from ..deps import Actor, current_actor
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(tags=["billing"])

INDIVIDUAL_TENANT = "t_solo"

_API = {"sandbox": "https://sandbox-api.polar.sh", "production": "https://api.polar.sh"}

#: tier -> Polar product id, per environment. Ids are not secrets.
PRODUCTS = {
    "sandbox": {
        "free": "c969c4c6-0eb0-4dce-8df7-6332d1dcf36b",
        "pro": "e852f2e9-33db-4db7-b327-42840cb26b4a",
        "pilot": "d464b6c6-71c3-4247-b66a-a32ac64987ca",
        "essential": "112c18fd-91b2-43ea-b9c3-dbd43d633895",
        "professional": "cf2506d8-76ae-459c-a1b6-362879482aef",
    },
    "production": {
        "free": "684ebee7-4bd8-4a10-846e-9d2f881d6757",
        "pro": "865e8317-58ee-48b6-a613-6e04ec28585a",
        "pilot": "798ef186-ad66-477c-b2e3-9b673ea8de71",
        "essential": "015f8700-21c0-4d54-acaf-0419994efa9a",
        "professional": "96bc28fe-6e07-44cf-86fe-8175af9039c8",
    },
}

INDIVIDUAL_TIERS = ("pro",)
HOSPITAL_TIERS = ("pilot", "essential", "professional")
PER_BED_TIERS = ("essential", "professional")
PILOT_DAYS = 90

#: Subscription states that keep the plan on. past_due is Polar's dunning
#: window: the card failed and Polar is retrying, so access stays until it
#: gives up and revokes.
_LIVE = ("active", "trialing", "past_due")

#: Roles a self-serve account may hold that can buy Pro. Patients and caregivers
#: are in the individual tenant too but have nothing a clinical plan unlocks.
_NOT_BUYERS = ("patient", "caregiver", "guest")

_SIGNATURE_TOLERANCE_S = 300

_POLAR_ACTOR = Actor("polar", "webhook@polar.sh", "system", INDIVIDUAL_TENANT, "")


def _env() -> str:
    env = settings().polar_env
    return env if env in _API else "sandbox"


def _tier_for_product(product_id: str | None) -> str | None:
    for tier, pid in PRODUCTS[_env()].items():
        if pid == product_id:
            return tier
    return None


# --- Polar API ---------------------------------------------------------------


def _polar(method: str, path: str, body: dict | None = None) -> dict:
    token = settings().polar_access_token
    if not token:
        raise ApiError(503, "Online payments are not configured on this server yet.")
    req = urllib.request.Request(
        f"{_API[_env()]}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json",
                 "Content-Type": "application/json", "User-Agent": "esap-backend/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 - fixed https host
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise ApiError(502, "The payment provider refused the request. Try again, or contact support.",
                       detail={"polar_status": exc.code, "polar_body": detail}) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ApiError(502, "Could not reach the payment provider. Try again in a moment.") from exc


# --- checkout ------------------------------------------------------------------


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tier: str
    #: Per-bed plans only. Defaults to the tenant's licensed beds.
    beds: int | None = Field(None, ge=1, le=100_000)


def _buyer(actor: Actor, tier: str) -> tuple[str, str]:
    """(owner_kind, owner_id) the purchase is for, or a 403/422 saying why not."""
    if tier in INDIVIDUAL_TIERS:
        if actor.tenant_id != INDIVIDUAL_TENANT or actor.role in _NOT_BUYERS:
            raise ApiError(403, "Pro is for individual clinician accounts. Hospital staff are covered by their hospital's plan.")
        return "user", actor.user_id
    if tier in HOSPITAL_TIERS:
        if actor.tenant_id == INDIVIDUAL_TENANT:
            raise ApiError(403, "Hospital plans are bought by the hospital. Join the waitlist and our team will set your hospital up.")
        if rbac.grade(actor.role, "billing:view") != "full":
            raise ApiError(403, "Only your hospital's owner or billing admin can change its plan.")
        return "tenant", actor.tenant_id
    if tier == "free":
        raise ApiError(422, "The Free plan needs no checkout.")
    if tier == "enterprise":
        raise ApiError(422, "Enterprise is arranged with our sales team, not through online checkout.")
    raise ApiError(422, f"Unknown plan '{tier}'.")


#: Reserved domains (RFC 2606/6761). Polar refuses them as customer_email, so
#: demo accounts leave the field empty and the buyer types one at checkout.
_RESERVED_TLDS = (".example", ".test", ".invalid", ".localhost", ".local")
_RESERVED_DOMAINS = ("example.com", "example.net", "example.org")


def _deliverable(email: str | None) -> bool:
    domain = (email or "").rpartition("@")[2].lower()
    return bool(domain) and not domain.endswith(_RESERVED_TLDS) and domain not in _RESERVED_DOMAINS


def _customer_ref(owner_kind: str, owner_id: str) -> str:
    """Polar's external customer id: one Polar customer per ESAP user or tenant."""
    return f"{owner_kind}:{owner_id}"


@router.post("/billing/checkout", status_code=201)
def create_checkout(body: CheckoutRequest, request: Request, actor: Actor = Depends(current_actor)):
    """Open a Polar checkout for a plan and hand back its URL."""
    owner_kind, owner_id = _buyer(actor, body.tier)
    payload: dict = {
        "products": [PRODUCTS[_env()][body.tier]],
        "external_customer_id": _customer_ref(owner_kind, owner_id),
        "success_url": settings().billing_success_url,
        "return_url": settings().billing_return_url,
        # Copied by Polar onto the order and subscription, which is how the
        # webhook knows whose plan to change.
        "metadata": {"esap_owner_kind": owner_kind, "esap_owner_id": owner_id,
                     "esap_tier": body.tier, "esap_user_id": actor.user_id},
    }
    if _deliverable(actor.email):
        payload["customer_email"] = actor.email
    if body.tier in PER_BED_TIERS:
        tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (owner_id,)) or {}
        beds = body.beds or int(tenant.get("beds") or 0)
        if beds < 1:
            raise ApiError(422, "Say how many beds the plan should cover.")
        payload["seats"] = beds
    checkout = _polar("POST", "/v1/checkouts/", payload)
    audit.record(actor, "billing.checkout", f"{body.tier}{' × ' + str(payload['seats']) + ' beds' if 'seats' in payload else ''}",
                 tenant_id=actor.tenant_id, ip=request.client.host if request.client else "unknown")
    return {"id": checkout.get("id"), "url": checkout.get("url"), "client_secret": checkout.get("client_secret")}


@router.get("/billing/status")
def billing_status(actor: Actor = Depends(current_actor)):
    """The caller's plan as billing sees it: what is active, and what Polar last said."""
    if actor.tenant_id == INDIVIDUAL_TENANT:
        owner_kind, owner_id = "user", actor.user_id
        user = db.one_doc("SELECT doc FROM users WHERE id=?", (actor.user_id,)) or {}
        plan = user.get("plan") or "free"
    else:
        owner_kind, owner_id = "tenant", actor.tenant_id
        tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (actor.tenant_id,)) or {}
        plan = tenant.get("plan")
    subs = db.docs("SELECT doc FROM subscriptions WHERE owner_kind=? AND owner_id=? ORDER BY updated_at DESC",
                   (owner_kind, owner_id))
    return {"plan": plan, "owner": owner_kind, "subscription": subs[0] if subs else None,
            "configured": bool(settings().polar_access_token)}


@router.get("/billing/checkout/{checkout_id}")
def checkout_status(checkout_id: str, actor: Actor = Depends(current_actor)):
    """Where a checkout stands, for the success page. Only the buyer may ask."""
    checkout = _polar("GET", f"/v1/checkouts/{checkout_id}")
    meta = checkout.get("metadata") or {}
    if meta.get("esap_user_id") != actor.user_id and meta.get("esap_owner_id") != actor.tenant_id:
        raise ApiError(404, "No such checkout.")
    return {"id": checkout.get("id"), "status": checkout.get("status"), "tier": meta.get("esap_tier")}


@router.post("/billing/portal")
def customer_portal(actor: Actor = Depends(current_actor)):
    """A one-time link to Polar's customer portal: cards, invoices, cancel."""
    if actor.tenant_id == INDIVIDUAL_TENANT:
        ref = _customer_ref("user", actor.user_id)
    else:
        if rbac.grade(actor.role, "billing:view") != "full":
            raise ApiError(403, "Only your hospital's owner or billing admin can manage its payments.")
        ref = _customer_ref("tenant", actor.tenant_id)
    session = _polar("POST", "/v1/customer-sessions/", {"external_customer_id": ref})
    return {"url": session.get("customer_portal_url")}


# --- webhook -------------------------------------------------------------------


def _signing_keys(secret: str) -> list[bytes]:
    """Polar signs with the secret's own bytes; a strict Standard Webhooks
    sender signs with the base64 body after `whsec_`. Accept either."""
    keys = [secret.encode()]
    if secret.startswith("whsec_"):
        try:
            keys.append(base64.b64decode(secret[len("whsec_"):]))
        except ValueError:
            pass
    return keys


def verify_signature(body: bytes, headers, secret: str, now: float | None = None) -> bool:
    msg_id = headers.get("webhook-id") or ""
    stamp = headers.get("webhook-timestamp") or ""
    sigs = headers.get("webhook-signature") or ""
    if not (msg_id and stamp and sigs):
        return False
    try:
        if abs((now if now is not None else time.time()) - int(stamp)) > _SIGNATURE_TOLERANCE_S:
            return False
    except ValueError:
        return False
    signed = f"{msg_id}.{stamp}.".encode() + body
    given = [s.split(",", 1)[1] for s in sigs.split() if s.startswith("v1,")]
    for key in _signing_keys(secret):
        expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
        if any(hmac.compare_digest(expected, g) for g in given):
            return True
    return False


@router.post("/polar/webhook", include_in_schema=False)
async def polar_webhook(request: Request):
    secret = settings().polar_webhook_secret
    if not secret:
        # 503 so Polar retries once the server is configured, rather than
        # marking a real payment as delivered and dropping it.
        return JSONResponse(status_code=503, content={"ok": False})
    body = await request.body()
    if not verify_signature(body, request.headers, secret):
        return JSONResponse(status_code=403, content={"ok": False})

    event = json.loads(body)
    kind = event.get("type", "")
    data = event.get("data") or {}
    msg_id = request.headers["webhook-id"]
    conn = db.connect()
    if conn.execute("SELECT 1 FROM billing_events WHERE id=?", (msg_id,)).fetchone():
        return {"ok": True, "duplicate": True}

    # Apply first, record after: if a handler fails, the delivery is not marked
    # seen and Polar's retry gets another go. The handlers are upserts, so a
    # retry of a half-applied event lands in the same place.
    handler = _HANDLERS.get(kind)
    if handler:
        handler(data, kind)
    try:
        conn.execute("INSERT INTO billing_events (id, type, received_at, doc) VALUES (?,?,?,?)",
                     (msg_id, kind, iso(utcnow()), json.dumps({"type": kind, "objectId": data.get("id")})))
    except sqlite3.IntegrityError:
        pass  # a concurrent retry of the same delivery recorded it first
    conn.commit()
    return {"ok": True}


# --- applying events -----------------------------------------------------------


def _owner(data: dict) -> tuple[str, str] | None:
    """Whose plan an event is about: checkout metadata first, then our record
    of the subscription, then Polar's external customer id."""
    meta = data.get("metadata") or {}
    if meta.get("esap_owner_kind") in ("user", "tenant") and meta.get("esap_owner_id"):
        return meta["esap_owner_kind"], meta["esap_owner_id"]
    sub_id = data.get("subscription_id") or (data.get("id") if "current_period_end" in data else None)
    if sub_id:
        row = db.connect().execute("SELECT owner_kind, owner_id FROM subscriptions WHERE id=?", (sub_id,)).fetchone()
        if row:
            return row["owner_kind"], row["owner_id"]
    ref = (data.get("customer") or {}).get("external_id") or ""
    kind, _, oid = ref.partition(":")
    return (kind, oid) if kind in ("user", "tenant") and oid else None


def _grant(owner_kind: str, owner_id: str, tier: str, extra: dict | None = None) -> None:
    extra = extra or {}
    if owner_kind == "user":
        db.patch_doc("users", owner_id, {"plan": tier, **extra})
        return
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (owner_id,))
    if tenant is None:
        return
    changes: dict = {"plan": tier, **extra}
    scalars: dict = {"plan": tier}
    # Only lift a suspension billing itself imposed; one an operator set stays.
    if tenant.get("billingSuspended"):
        changes.update(status="active", billingSuspended=None)
        scalars["status"] = "active"
    db.patch_doc("tenants", owner_id, changes, scalars)
    audit.record(_POLAR_ACTOR, "billing.plan_active", f"tenant:{tenant.get('slug')} → {tier}",
                 tenant_id=owner_id, platform=True, ip="polar")


def _revoke(owner_kind: str, owner_id: str, keep_sub: str | None = None) -> None:
    """Take a paid plan away — unless another live subscription still pays for it."""
    live = db.connect().execute(
        f"SELECT 1 FROM subscriptions WHERE owner_kind=? AND owner_id=? AND id IS NOT ? "  # noqa: S608
        f"AND status IN ({','.join('?' * len(_LIVE))})",
        (owner_kind, owner_id, keep_sub, *_LIVE)).fetchone()
    if live:
        return
    if owner_kind == "user":
        db.patch_doc("users", owner_id, {"plan": "free"})
        return
    tenant = db.one_doc("SELECT doc FROM tenants WHERE id=?", (owner_id,))
    if tenant is None:
        return
    # Suspension, not deletion: the pricing FAQ promises the data is kept.
    db.patch_doc("tenants", owner_id, {"status": "suspended", "billingSuspended": True}, {"status": "suspended"})
    conn = db.connect()
    conn.execute("DELETE FROM sessions WHERE tenant_id=?", (owner_id,))
    audit.record(_POLAR_ACTOR, "billing.plan_revoked", f"tenant:{tenant.get('slug')}",
                 tenant_id=owner_id, platform=True, ip="polar")


def _on_subscription(data: dict, kind: str) -> None:
    owner = _owner(data)
    tier = _tier_for_product(data.get("product_id")) or (data.get("metadata") or {}).get("esap_tier")
    if owner is None or tier is None:
        return
    owner_kind, owner_id = owner
    status = "revoked" if kind == "subscription.revoked" else data.get("status", "incomplete")
    now = iso(utcnow())
    doc = {
        "id": data["id"], "ownerKind": owner_kind, "ownerId": owner_id, "tier": tier, "status": status,
        "seats": data.get("seats"), "amountUsd": (data.get("amount") or 0) / 100,
        "currentPeriodEnd": data.get("current_period_end"),
        "cancelAtPeriodEnd": bool(data.get("cancel_at_period_end")),
        "endsAt": data.get("ends_at"), "lastEvent": kind, "updatedAt": now,
    }
    tenant_id = owner_id if owner_kind == "tenant" else INDIVIDUAL_TENANT
    db.connect().execute(
        "INSERT INTO subscriptions (id, owner_kind, owner_id, tenant_id, tier, status, updated_at, doc) "
        "VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET tier=excluded.tier, status=excluded.status, "
        "updated_at=excluded.updated_at, doc=excluded.doc",
        (data["id"], owner_kind, owner_id, tenant_id, tier, status, now, json.dumps(doc)))

    if status == "revoked":
        _revoke(owner_kind, owner_id, keep_sub=data["id"])
    elif status in _LIVE:
        extra = {"beds": data["seats"]} if owner_kind == "tenant" and tier in PER_BED_TIERS and data.get("seats") else {}
        _grant(owner_kind, owner_id, tier, extra)


def _invoice_doc(data: dict, tier: str | None, status: str) -> dict:
    created = data.get("created_at") or iso(utcnow())
    when = datetime.fromisoformat(created.replace("Z", "+00:00"))
    total = (data.get("total_amount") or 0) / 100
    seats = data.get("seats")
    return {
        "id": data.get("invoice_number") or data["id"],
        "period": when.strftime("%B %Y"),
        "amountUsd": total,
        "status": status,
        "issuedAt": created,
        "lines": [{"label": (data.get("product") or {}).get("name") or f"ESAP Clinical AI — {tier}",
                   "qty": f"{seats} beds" if seats else "1", "amountUsd": total}],
        "source": "polar",
        "polarOrderId": data["id"],
        "tier": tier,
    }


def _on_order_paid(data: dict, kind: str) -> None:
    owner = _owner(data)
    tier = _tier_for_product(data.get("product_id")) or (data.get("metadata") or {}).get("esap_tier")
    if owner is None:
        return
    owner_kind, owner_id = owner
    if owner_kind == "tenant":
        # Individuals' orders stay in Polar's portal; the invoices table is the
        # hospital's billing screen and the shared individual tenant has none.
        conn = db.connect()
        existing = conn.execute("SELECT id FROM invoices WHERE id=?", (data.get("invoice_number") or data["id"],)).fetchone()
        if existing is None:
            inv = _invoice_doc(data, tier, "paid")
            conn.execute("INSERT INTO invoices (id, tenant_id, status, doc) VALUES (?,?,?,?)",
                         (inv["id"], owner_id, "paid", json.dumps(inv)))
    # The pilot is the one plan sold as a single payment: the order is the grant.
    if tier == "pilot":
        ends = iso(utcnow() + timedelta(days=PILOT_DAYS))
        _grant(owner_kind, owner_id, "pilot", {"pilotEndsAt": ends, "pilotOrderId": data["id"]})


def _on_order_refunded(data: dict, kind: str) -> None:
    owner = _owner(data)
    if owner is None:
        return
    owner_kind, owner_id = owner
    full = (data.get("refunded_amount") or 0) >= (data.get("total_amount") or 0) > 0
    status = "refunded" if full else "partially_refunded"
    inv_id = data.get("invoice_number") or data["id"]
    db.connect().execute("UPDATE invoices SET status=?, doc=json_set(doc, '$.status', ?) WHERE id=?",
                         (status, status, inv_id))
    # A refunded pilot takes the pilot back. Subscription refunds leave access
    # to the subscription events: Polar revokes the subscription if that was
    # the intent, and a refund of last month must not cut off this month.
    if full and _tier_for_product(data.get("product_id")) == "pilot":
        _revoke(owner_kind, owner_id)


_HANDLERS = {
    "subscription.created": _on_subscription,
    "subscription.active": _on_subscription,
    "subscription.updated": _on_subscription,
    "subscription.canceled": _on_subscription,
    "subscription.uncanceled": _on_subscription,
    "subscription.past_due": _on_subscription,
    "subscription.cycled": _on_subscription,
    "subscription.revoked": _on_subscription,
    "order.paid": _on_order_paid,
    "order.refunded": _on_order_refunded,
}
