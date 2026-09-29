"""Multi-factor auth: enrol -> activate -> password login now challenges -> TOTP
completes it (§10.9). Cleanup drops MFA at the DB level so enabling it on the
shared demo physician cannot leak into other tests."""

from __future__ import annotations

import time

from app import db, security

PHYS = "amara.okonkwo@styves.example"


def _code(secret: str) -> str:
    return security._totp_at(secret, int(time.time()) // 30)


def _clear_mfa():
    conn = db.connect()
    conn.execute("UPDATE credentials SET mfa_enabled=0, mfa_secret=NULL WHERE email=?", (PHYS,))
    conn.commit()


def test_totp_roundtrip_unit():
    s = security.new_totp_secret()
    assert security.verify_totp(s, _code(s)) is True
    assert security.verify_totp(s, "000000") in (True, False)  # just must not raise
    assert security.verify_totp(s, "not-a-code") is False


def test_enroll_activate_then_login_requires_second_factor(client, auth):
    try:
        h = auth("physician")
        enroll = client.post("/api/v1/auth/mfa/enroll", headers=h).json()
        secret = enroll["secret"]
        assert enroll["otpauth_uri"].startswith("otpauth://totp/")
        assert enroll["activated"] is False

        # Wrong code cannot activate.
        assert client.post("/api/v1/auth/mfa/activate", headers=h, json={"code": "000000"}).status_code == 400
        # Correct code activates.
        ok = client.post("/api/v1/auth/mfa/activate", headers=h, json={"code": _code(secret)})
        assert ok.status_code == 200 and ok.json()["activated"] is True

        # Password login now returns a challenge, not a session.
        r = client.post("/api/v1/auth/login", json={"email": PHYS, "password": security_demo_password()})
        body = r.json()
        assert body.get("mfa_required") is True
        assert "token" not in body
        mfa_token = body["mfa_token"]

        # Wrong TOTP is refused.
        bad = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_token, "code": "000000"})
        assert bad.status_code == 401

        # Correct TOTP completes the sign-in.
        good = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_token, "code": _code(secret)})
        assert good.status_code == 200, good.text
        assert "token" in good.json()
    finally:
        _clear_mfa()


def security_demo_password() -> str:
    from app.seed import DEMO_PASSWORD
    return DEMO_PASSWORD


def test_expired_or_forged_challenge_is_rejected(client):
    # A garbage challenge token never yields a session.
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": "forged.123.deadbeef", "code": "123456"})
    assert r.status_code == 401
