"""System email: every flow sends from no-reply@ with the right Reply-To.

Sign-up confirmation, staff and caregiver invitations, password reset, and
payment success / failure. SMTP is not configured under test, so each message
lands in mail_outbox with status outbox_only, which is what these read back.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from types import SimpleNamespace

import pytest

from app import db, mailer
from app.config import settings
from app.routers import billing

SECRET = "whsec_dGVzdC1zZWNyZXQtbm90LXJlYWw="
SANDBOX = billing.PRODUCTS["sandbox"]


def _addr(tag: str) -> str:
    # Not a reserved domain, so the mailer treats it as deliverable.
    return f"{tag}-{uuid.uuid4().hex[:8]}@qa-mail.esap.ai"


def _outbox(to: str) -> list[dict]:
    return db.docs("SELECT doc FROM mail_outbox WHERE to_addr=? ORDER BY created_at", (to,))


def _signup(client, email: str, role: str = "physician") -> dict:
    r = client.post("/api/v1/auth/signup", json={"name": "Dr. Mail", "email": email,
                                                 "password": "a-long-enough-password", "role": role})
    assert r.status_code == 201, r.text
    client.cookies.clear()
    return r.json()


def test_defaults_are_the_care_addresses():
    cfg = settings()
    assert "no-reply@esap.ai" in cfg.mail_from
    assert cfg.support_email == "care@esap.ai" and cfg.billing_email == "billing@esap.ai"


def test_signup_sends_a_confirmation_from_no_reply(client):
    email = _addr("signup")
    _signup(client, email)
    [mail] = _outbox(email)
    assert mail["subject"].startswith("Your ESAP Clinical AI account is ready")
    assert "[link withheld]" in mail["body"] and mail["lang"] == "en"
    assert "no-reply@esap.ai" in mail["from"] and mail["replyTo"] == "care@esap.ai"
    assert "care@esap.ai" in mail["body"] and "/login" in mail["body"]


def test_password_reset_replies_go_to_support(client):
    email = _addr("reset")
    _signup(client, email, role="patient")
    assert client.post("/api/v1/auth/password/forgot", json={"email": email}).status_code == 202
    mail = [m for m in _outbox(email) if m["subject"] == "Reset your ESAP password"][0]
    assert mail["replyTo"] == "care@esap.ai" and "[link withheld]" in mail["body"]


def test_staff_invite_and_reminder_are_emailed(client, auth):
    email = _addr("invite")
    invite = client.post("/api/v1/admin/invites", headers=auth("tenant_owner"),
                         json={"email": email, "role": "staff_nurse"})
    assert invite.status_code == 201, invite.text
    [mail] = _outbox(email)
    assert "St. Yves" in mail["subject"] and mail["replyTo"] == "care@esap.ai"
    # The accept link is the credential: withheld from the stored copy.
    assert invite.json()["acceptToken"] not in mail["body"] and "[link withheld]" in mail["body"]

    r = client.post(f"/api/v1/admin/invites/{invite.json()['id']}/remind", headers=auth("tenant_owner"))
    assert r.status_code == 200, r.text
    assert _outbox(email)[-1]["subject"].startswith("Reminder: ")


def test_caregiver_invite_is_emailed(client, auth):
    email = _addr("carer")
    r = client.post("/api/v1/patient/family", headers=auth("patient"), json={
        "name": "Marek Salib", "email": email, "relationship": "Son or daughter",
        "scope": ["Full record"], "level": "view_summaries"})
    assert r.status_code == 201, r.text
    [mail] = _outbox(email)
    assert "has given you access" in mail["subject"]
    assert r.json()["acceptToken"] not in mail["body"] and "[link withheld]" in mail["body"]


def test_reserved_addresses_are_never_sent(client):
    email = f"demo-{uuid.uuid4().hex[:8]}@clinic.example"
    _signup(client, email)
    [mail] = _outbox(email)
    assert mail["status"] == "undeliverable"
    assert not mailer.deliverable("x@example.com") and mailer.deliverable("x@hospital.org")


# --- payments ---------------------------------------------------------------


@pytest.fixture
def polar(monkeypatch):
    cfg = SimpleNamespace(polar_env="sandbox", polar_access_token="polar_oat_test",
                          polar_webhook_secret=SECRET, billing_email="billing@esap.ai",
                          billing_success_url="https://care.esap.ai/billing/success",
                          billing_return_url="https://care.esap.ai/pricing")
    monkeypatch.setattr(billing, "settings", lambda: cfg)
    return cfg


def _send(client, event: dict):
    body = json.dumps(event).encode()
    msg_id, stamp = f"msg_{uuid.uuid4().hex}", int(time.time())
    sig = base64.b64encode(hmac.new(SECRET.encode(), f"{msg_id}.{stamp}.".encode() + body,
                                    hashlib.sha256).digest()).decode()
    r = client.post("/api/v1/polar/webhook", content=body, headers={
        "webhook-id": msg_id, "webhook-timestamp": str(stamp), "webhook-signature": f"v1,{sig}",
        "content-type": "application/json"})
    assert r.status_code == 200, r.text


def test_payment_success_email_carries_the_invoice(client, polar):
    email = _addr("paid")
    user_id = _signup(client, email)["user"]["id"]
    order = {"id": f"ord_{uuid.uuid4().hex[:8]}", "invoice_number": f"ESAP-{uuid.uuid4().hex[:4]}",
             "product_id": SANDBOX["pro"], "total_amount": 3900, "created_at": "2026-11-17T09:00:00Z",
             "product": {"name": "ESAP Clinical AI Pro"},
             "metadata": {"esap_owner_kind": "user", "esap_owner_id": user_id,
                          "esap_tier": "pro", "esap_user_id": user_id}}
    _send(client, {"type": "order.paid", "data": order})
    mail = _outbox(email)[-1]
    assert mail["subject"] == f"Payment received — invoice {order['invoice_number']}"
    assert mail["replyTo"] == "billing@esap.ai" and "US$39.00" in mail["body"]
    assert "billing@esap.ai" in mail["body"]


def test_payment_failure_is_emailed_once(client, polar):
    email = _addr("pastdue")
    user_id = _signup(client, email)["user"]["id"]
    sub = {"id": f"sub_{uuid.uuid4().hex[:8]}", "status": "active", "product_id": SANDBOX["pro"],
           "amount": 3900, "current_period_end": "2026-12-17T00:00:00Z",
           "metadata": {"esap_owner_kind": "user", "esap_owner_id": user_id, "esap_tier": "pro",
                        "esap_user_id": user_id}}
    _send(client, {"type": "subscription.active", "data": sub})
    _send(client, {"type": "subscription.past_due", "data": {**sub, "status": "past_due"}})
    _send(client, {"type": "subscription.updated", "data": {**sub, "status": "past_due"}})
    failed = [m for m in _outbox(email) if m["subject"] == "Your ESAP payment didn't go through"]
    assert len(failed) == 1 and failed[0]["replyTo"] == "billing@esap.ai"


# --- email confirmation ------------------------------------------------------------


@pytest.fixture
def captured(monkeypatch):
    """Every email body as sent, before the stored copy withholds links."""
    sent: list[dict] = []
    real = mailer.send

    def capture(to, subject, body, secret=None, **kw):
        sent.append({"to": to, "subject": subject, "body": body, **kw})
        return real(to, subject, body, secret=secret, **kw)

    monkeypatch.setattr(mailer, "send", capture)
    return sent


def _link_token(body: str, marker: str) -> str:
    return body.split(marker)[1].split()[0]


def test_signup_link_confirms_the_address(client, captured):
    email = _addr("verify")
    session = _signup(client, email)
    headers = {"Authorization": f"Bearer {session['token']}"}
    assert client.get("/api/v1/auth/email/status", headers=headers).json()["verified"] is False

    token = _link_token([m for m in captured if m["to"] == email][0]["body"], "verify-email?token=")
    r = client.post("/api/v1/auth/email/verify", json={"token": token})
    assert r.status_code == 200 and r.json() == {"verified": True, "email": email, "already": False}
    assert client.get("/api/v1/auth/email/status", headers=headers).json()["verified"] is True
    # Opening the link again is harmless.
    assert client.post("/api/v1/auth/email/verify", json={"token": token}).json()["already"] is True
    assert client.post("/api/v1/auth/email/resend", headers=headers).json() == {"sent": False, "verified": True}


def test_bad_and_expired_links_are_refused(client, captured):
    assert client.post("/api/v1/auth/email/verify", json={"token": "x" * 32}).status_code == 400
    email = _addr("expired")
    _signup(client, email)
    token = _link_token([m for m in captured if m["to"] == email][0]["body"], "verify-email?token=")
    from app.routers.auth import _verify_key
    rec = db.document(_verify_key(token))
    db.put_document(_verify_key(token), {**rec, "expiresAt": "2020-01-01T00:00:00Z"})
    r = client.post("/api/v1/auth/email/verify", json={"token": token})
    assert r.status_code == 400 and "expired" in r.text


def test_resend_is_rate_limited_then_sends(client, captured):
    email = _addr("resend")
    session = _signup(client, email)
    headers = {"Authorization": f"Bearer {session['token']}"}
    assert client.post("/api/v1/auth/email/resend", headers=headers).status_code == 429
    db.patch_doc("users", session["user"]["id"], {"emailVerifySentAt": "2020-01-01T00:00:00Z"})
    r = client.post("/api/v1/auth/email/resend", headers=headers)
    assert r.status_code == 202 and r.json()["sent"] is True
    assert _outbox(email)[-1]["subject"] == "Confirm your email for ESAP Clinical AI"


def test_seeded_accounts_need_no_confirmation(client, auth):
    h = auth("physician")
    assert client.get("/api/v1/auth/email/status", headers=h).json()["verified"] is None
    assert client.post("/api/v1/auth/email/resend", headers=h).status_code == 409


# --- Arabic --------------------------------------------------------------------------


def test_arabic_signup_and_reset_are_in_arabic(client):
    email = _addr("ar")
    r = client.post("/api/v1/auth/signup", json={"name": "ليلى", "email": email, "password": "a-long-enough-password",
                                                 "role": "patient", "lang": "ar"})
    assert r.status_code == 201, r.text
    client.cookies.clear()
    [mail] = _outbox(email)
    assert mail["lang"] == "ar" and "أكّد" in mail["subject"] and "care@esap.ai" in mail["body"]
    # No language on the request: the one saved on the account is used.
    client.post("/api/v1/auth/password/forgot", json={"email": email})
    reset = _outbox(email)[-1]
    assert reset["subject"] == "إعادة تعيين كلمة مرور ESAP" and "لا يستقبل الردود" in reset["body"]
    # The page language wins when given.
    client.post("/api/v1/auth/password/forgot", json={"email": email, "lang": "en"})
    assert _outbox(email)[-1]["subject"] == "Reset your ESAP password"


def test_bad_language_is_rejected(client):
    r = client.post("/api/v1/auth/signup", json={"name": "X", "email": _addr("lang"), "password": "a-long-enough-password",
                                                 "role": "patient", "lang": "fr"})
    assert r.status_code == 422


def test_caregiver_invite_in_arabic_names_the_demo_patient(client, auth):
    email = _addr("carer-ar")
    r = client.post("/api/v1/patient/family", headers=auth("patient"), json={
        "name": "مروان", "email": email, "relationship": "ابن", "scope": ["Full record"], "lang": "ar"})
    assert r.status_code == 201, r.text
    [mail] = _outbox(email)
    assert mail["lang"] == "ar" and mail["subject"].startswith("منحك Delia Salib")
    # The accept page shows the same name.
    page = client.get(f"/api/v1/auth/caregiver-invite/{r.json()['acceptToken']}").json()
    assert page["patientName"] == "Delia Salib"


# --- receipts switch, link default -------------------------------------------------


def test_receipts_can_be_left_to_polar(client, polar, monkeypatch):
    from app import notify
    real = notify.settings()
    monkeypatch.setattr(notify, "settings", lambda: SimpleNamespace(**{**vars(real), "send_payment_receipts": False}))
    email = _addr("noreceipt")
    user_id = _signup(client, email)["user"]["id"]
    order = {"id": f"ord_{uuid.uuid4().hex[:8]}", "product_id": SANDBOX["pro"], "total_amount": 3900,
             "created_at": "2026-11-17T09:00:00Z",
             "metadata": {"esap_owner_kind": "user", "esap_owner_id": user_id, "esap_tier": "pro", "esap_user_id": user_id}}
    _send(client, {"type": "order.paid", "data": order})
    assert not [m for m in _outbox(email) if m["subject"].startswith("Payment received")]


def test_public_url_defaults_to_the_live_site_once_mail_is_real(monkeypatch):
    from app.config import Settings
    monkeypatch.delenv("ESAP_PUBLIC_URL", raising=False)
    monkeypatch.setenv("ESAP_SMTP_HOST", "smtp.example.net")
    assert Settings().public_url == "https://care.esap.ai"
    monkeypatch.delenv("ESAP_SMTP_HOST")
    assert Settings().public_url.startswith("http://localhost")


# --- SMTP delivery -------------------------------------------------------------------


class _FakeSMTP:
    instances: list = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.calls, self.sent = host, port, [], []
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user))

    def send_message(self, msg):
        self.sent.append(msg)


@pytest.mark.parametrize("port,ssl_wrapped", [(587, False), (465, True)])
def test_smtp_sends_from_no_reply_with_reply_to(monkeypatch, port, ssl_wrapped):
    import smtplib
    cfg = SimpleNamespace(**{**vars(settings()), "smtp_host": "smtp.qa.local", "smtp_port": port,
                             "smtp_user": "no-reply@esap.ai", "smtp_password": "x"})
    monkeypatch.setattr(mailer, "settings", lambda: cfg)
    _FakeSMTP.instances = []
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSMTP)
    doc = mailer.send(_addr("smtp"), "Hello", "Body", reply_to="billing@esap.ai")
    assert doc["status"] == "sent"
    [conn] = _FakeSMTP.instances
    assert ("starttls" in conn.calls) is (not ssl_wrapped) and ("login", "no-reply@esap.ai") in conn.calls
    [msg] = conn.sent
    assert "no-reply@esap.ai" in msg["From"] and msg["Reply-To"] == "billing@esap.ai"
    assert msg["Message-ID"].endswith("@esap.ai>") and msg["Date"]


def test_smtp_failure_is_recorded_not_raised(monkeypatch):
    import smtplib
    cfg = SimpleNamespace(**{**vars(settings()), "smtp_host": "smtp.qa.local", "smtp_port": 587})

    def boom(*a, **k):
        raise smtplib.SMTPConnectError(421, "down")

    monkeypatch.setattr(mailer, "settings", lambda: cfg)
    monkeypatch.setattr(smtplib, "SMTP", boom)
    doc = mailer.send(_addr("down"), "Hello", "Body")
    assert doc["status"] == "failed" and doc["error"] == "SMTPConnectError"
