"""Polar billing: checkout guards, webhook signatures, and what each event unlocks."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from types import SimpleNamespace

import pytest

from app import db
from app.routers import billing

SECRET = "whsec_dGVzdC1zZWNyZXQtbm90LXJlYWw="
SANDBOX = billing.PRODUCTS["sandbox"]
_REAL_POLAR = billing._polar


@pytest.fixture(autouse=True)
def polar(monkeypatch):
    """A configured sandbox, with the Polar API replaced by a recorder."""
    cfg = SimpleNamespace(polar_env="sandbox", polar_access_token="polar_oat_test",
                          polar_webhook_secret=SECRET,
                          billing_success_url="https://care.esap.ai/billing/success?checkout_id={CHECKOUT_ID}",
                          billing_return_url="https://care.esap.ai/pricing")
    monkeypatch.setattr(billing, "settings", lambda: cfg)
    calls: list[tuple[str, str, dict | None]] = []

    def fake(method, path, body=None):
        calls.append((method, path, body))
        return {"id": "chk_1", "url": "https://sandbox.polar.sh/checkout/chk_1", "client_secret": "cs",
                "customer_portal_url": "https://sandbox.polar.sh/portal"}

    monkeypatch.setattr(billing, "_polar", fake)
    return SimpleNamespace(cfg=cfg, calls=calls)


def _send(client, event: dict, *, secret: str = SECRET, msg_id: str | None = None, stamp: int | None = None):
    body = json.dumps(event).encode()
    msg_id = msg_id or f"msg_{uuid.uuid4().hex}"
    stamp = stamp or int(time.time())
    sig = base64.b64encode(hmac.new(secret.encode(), f"{msg_id}.{stamp}.".encode() + body,
                                    hashlib.sha256).digest()).decode()
    return client.post("/api/v1/polar/webhook", content=body, headers={
        "webhook-id": msg_id, "webhook-timestamp": str(stamp), "webhook-signature": f"v1,{sig}",
        "content-type": "application/json"})


def _signup(client) -> tuple[str, dict]:
    email = f"solo-{uuid.uuid4().hex[:8]}@clinic.example"
    r = client.post("/api/v1/auth/signup", json={"name": "Dr. Solo", "email": email,
                                                 "password": "a-long-enough-password", "role": "physician"})
    assert r.status_code == 201, r.text
    return r.json()["user"]["id"], {"Authorization": f"Bearer {r.json()['token']}"}


def _sub(sub_id: str, owner_kind: str, owner_id: str, tier: str, status: str = "active", **over) -> dict:
    data = {"id": sub_id, "status": status, "product_id": SANDBOX[tier], "amount": 3900,
            "current_period_end": "2026-11-28T00:00:00Z", "cancel_at_period_end": False,
            "metadata": {"esap_owner_kind": owner_kind, "esap_owner_id": owner_id, "esap_tier": tier},
            "customer": {"external_id": f"{owner_kind}:{owner_id}"}}
    data.update(over)
    return data


def _user_plan(user_id: str) -> str | None:
    return (db.one_doc("SELECT doc FROM users WHERE id=?", (user_id,)) or {}).get("plan")


def _tenant(tenant_id: str) -> dict:
    return db.one_doc("SELECT doc FROM tenants WHERE id=?", (tenant_id,)) or {}


# --- checkout -------------------------------------------------------------------


def test_signup_starts_on_free_and_buys_pro(client, polar):
    user_id, headers = _signup(client)
    assert _user_plan(user_id) == "free"
    r = client.post("/api/v1/billing/checkout", json={"tier": "pro"}, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["url"].startswith("https://sandbox.polar.sh/")
    _, path, body = polar.calls[-1]
    assert path == "/v1/checkouts/"
    assert body["products"] == [SANDBOX["pro"]]
    assert body["external_customer_id"] == f"user:{user_id}"
    assert body["metadata"]["esap_owner_id"] == user_id
    assert "seats" not in body


def test_hospital_plan_passes_beds_as_seats(client, auth, polar):
    r = client.post("/api/v1/billing/checkout", json={"tier": "professional", "beds": 220},
                    headers=auth("billing_admin"))
    assert r.status_code == 201, r.text
    body = polar.calls[-1][2]
    assert body["products"] == [SANDBOX["professional"]] and body["seats"] == 220
    assert body["external_customer_id"] == "tenant:t_yves"


def test_checkout_refuses_the_wrong_buyer(client, auth):
    _, solo = _signup(client)
    assert client.post("/api/v1/billing/checkout", json={"tier": "essential"}, headers=solo).status_code == 403
    assert client.post("/api/v1/billing/checkout", json={"tier": "pro"}, headers=auth("physician")).status_code == 403
    assert client.post("/api/v1/billing/checkout", json={"tier": "pilot"}, headers=auth("physician")).status_code == 403
    assert client.post("/api/v1/billing/checkout", json={"tier": "enterprise"}, headers=auth("tenant_owner")).status_code == 422
    assert client.post("/api/v1/billing/checkout", json={"tier": "free"}, headers=solo).status_code == 422


def test_checkout_without_a_token_is_unavailable(client, polar, monkeypatch):
    monkeypatch.setattr(billing, "_polar", _REAL_POLAR)
    polar.cfg.polar_access_token = None
    _, headers = _signup(client)
    assert client.post("/api/v1/billing/checkout", json={"tier": "pro"}, headers=headers).status_code == 503


# --- webhook signature ----------------------------------------------------------


def test_webhook_rejects_bad_or_stale_signatures(client):
    event = {"type": "subscription.active", "data": _sub("sub_x", "user", "nobody", "pro")}
    assert _send(client, event, secret="whsec_wrong").status_code == 403
    assert _send(client, event, stamp=int(time.time()) - 3600).status_code == 403
    r = client.post("/api/v1/polar/webhook", content=json.dumps(event).encode())
    assert r.status_code == 403


def test_signature_accepts_standard_webhooks_key_form():
    body, msg_id, stamp = b'{"a":1}', "msg_1", str(int(time.time()))
    key = base64.b64decode(SECRET[len("whsec_"):])
    sig = base64.b64encode(hmac.new(key, f"{msg_id}.{stamp}.".encode() + body, hashlib.sha256).digest()).decode()
    headers = {"webhook-id": msg_id, "webhook-timestamp": stamp, "webhook-signature": f"v1,{sig}"}
    assert billing.verify_signature(body, headers, SECRET)


# --- what events do -------------------------------------------------------------


def test_individual_pro_lifecycle(client):
    user_id, _ = _signup(client)
    sub = f"sub_{uuid.uuid4().hex[:8]}"
    assert _send(client, {"type": "subscription.created", "data": _sub(sub, "user", user_id, "pro", "incomplete")}).status_code == 200
    assert _user_plan(user_id) == "free"
    assert _send(client, {"type": "subscription.active", "data": _sub(sub, "user", user_id, "pro")}).status_code == 200
    assert _user_plan(user_id) == "pro"

    # Cancelled at period end: still Pro until Polar revokes.
    _send(client, {"type": "subscription.canceled", "data": _sub(sub, "user", user_id, "pro", cancel_at_period_end=True)})
    assert _user_plan(user_id) == "pro"
    _send(client, {"type": "subscription.past_due", "data": _sub(sub, "user", user_id, "pro", "past_due")})
    assert _user_plan(user_id) == "pro"
    _send(client, {"type": "subscription.revoked", "data": _sub(sub, "user", user_id, "pro", "canceled")})
    assert _user_plan(user_id) == "free"


def test_pro_unlocks_models_for_that_user_only(client, case):
    from app import entitlements

    paid, _ = _signup(client)
    free, _ = _signup(client)
    _send(client, {"type": "subscription.active", "data": _sub(f"sub_{uuid.uuid4().hex[:8]}", "user", paid, "pro")})
    assert "M-01" in entitlements.models_allowed("t_solo", paid)
    assert "M-01" not in entitlements.models_allowed("t_solo", free)


def test_duplicate_delivery_is_applied_once(client):
    user_id, _ = _signup(client)
    event = {"type": "subscription.active", "data": _sub(f"sub_{uuid.uuid4().hex[:8]}", "user", user_id, "pro")}
    first = _send(client, event, msg_id="msg_dup_test")
    again = _send(client, event, msg_id="msg_dup_test")
    assert first.json() == {"ok": True} and again.json().get("duplicate") is True


def test_hospital_bed_plan_sets_plan_and_beds_then_revoke_suspends(client):
    tenant_id = "t_rivermead"
    sub = f"sub_{uuid.uuid4().hex[:8]}"
    _send(client, {"type": "subscription.updated", "data": _sub(sub, "tenant", tenant_id, "essential", seats=150)})
    t = _tenant(tenant_id)
    assert t["plan"] == "essential" and t["beds"] == 150

    _send(client, {"type": "subscription.revoked", "data": _sub(sub, "tenant", tenant_id, "essential", "canceled")})
    t = _tenant(tenant_id)
    assert t["status"] == "suspended" and t["billingSuspended"] is True

    # Paying again lifts a suspension billing imposed.
    _send(client, {"type": "subscription.active", "data": _sub(f"sub_{uuid.uuid4().hex[:8]}", "tenant", tenant_id, "essential", seats=150)})
    t = _tenant(tenant_id)
    assert t["status"] == "active" and "billingSuspended" not in t


def test_pilot_order_grants_pilot_records_invoice_and_refund_reverses(client):
    tenant_id = "t_calder"
    order = {"id": f"ord_{uuid.uuid4().hex[:8]}", "product_id": SANDBOX["pilot"], "total_amount": 1_800_000,
             "refunded_amount": 0, "created_at": "2026-10-28T10:00:00Z", "subscription_id": None,
             "metadata": {"esap_owner_kind": "tenant", "esap_owner_id": tenant_id, "esap_tier": "pilot"}}
    _send(client, {"type": "order.paid", "data": order})
    t = _tenant(tenant_id)
    assert t["plan"] == "pilot" and t["pilotEndsAt"]
    inv = db.one_doc("SELECT doc FROM invoices WHERE id=?", (order["id"],))
    assert inv["amountUsd"] == 18000 and inv["status"] == "paid" and inv["period"] == "October 2026"

    _send(client, {"type": "order.refunded", "data": {**order, "refunded_amount": 1_800_000}})
    assert db.one_doc("SELECT doc FROM invoices WHERE id=?", (order["id"],))["status"] == "refunded"
    assert _tenant(tenant_id)["status"] == "suspended"


def test_status_reports_the_callers_plan(client):
    user_id, headers = _signup(client)
    _send(client, {"type": "subscription.active", "data": _sub(f"sub_{uuid.uuid4().hex[:8]}", "user", user_id, "pro")})
    r = client.get("/api/v1/billing/status", headers=headers).json()
    assert r["plan"] == "pro" and r["owner"] == "user" and r["subscription"]["status"] == "active"


def test_reserved_email_domains_are_not_sent_to_polar():
    assert billing._deliverable("dr.lee@hospital.org")
    for email in ("mira.novak@styves.example", "a@example.com", "b@x.test", "", None):
        assert not billing._deliverable(email)
