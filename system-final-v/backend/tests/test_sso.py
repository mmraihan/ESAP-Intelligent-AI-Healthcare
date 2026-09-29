"""OIDC single sign-on (§10.8): discovery by email domain, IdP-assertion callback,
and just-in-time provisioning. Exercised through the dev issuer so no live IdP is
needed; the production RS256/JWKS path is a drop-in for `sso._verify_oidc`."""

from __future__ import annotations

import os

import pytest

from app import db, sso

DOMAIN = "ssotest.example"


@pytest.fixture(autouse=True)
def _dev_sso(monkeypatch):
    monkeypatch.setenv("ESAP_SSO_DEV", "true")
    yield


def _enable_sso(client, auth):
    """Turn on SSO for St. Yves against a test domain, default role physician."""
    r = client.put("/api/v1/settings/integrations", headers=auth("tenant_owner"),
                   json={"patch": {"sso": {"enabled": True, "allowedDomain": DOMAIN,
                                           "defaultRole": "physician", "issuer": "https://idp.example"}},
                         "reason": "test"})
    assert r.status_code == 200, r.text


def test_discovery_reports_sso_for_a_configured_domain(client, auth):
    _enable_sso(client, auth)
    off = client.get("/api/v1/auth/sso/discover", params={"email": "nobody@random.example"}).json()
    assert off["enabled"] is False
    on = client.get("/api/v1/auth/sso/discover", params={"email": f"newdoc@{DOMAIN}"}).json()
    assert on["enabled"] is True and on["tenant"] == "t_yves"


def test_dev_login_provisions_and_signs_in(client, auth):
    _enable_sso(client, auth)
    email = f"jit.doc@{DOMAIN}"
    r = client.post("/api/v1/auth/sso/dev-login", json={"email": email, "name": "JIT Doctor"})
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["user"]["email"] == email
    assert payload["user"]["role"] == "physician"
    assert payload["user"]["tenantId"] == "t_yves"
    # The account was provisioned and marked SSO, with no usable password.
    doc = db.one_doc("SELECT doc FROM users WHERE email=?", (email,))
    assert doc["sso"] is True


def test_callback_rejects_a_forged_assertion(client, auth):
    _enable_sso(client, auth)
    r = client.post("/api/v1/auth/sso/callback", json={"assertion": "forged.deadbeef"})
    assert r.status_code == 401


def test_dev_login_refused_for_unconfigured_domain(client):
    r = client.post("/api/v1/auth/sso/dev-login", json={"email": "x@unconfigured.example"})
    assert r.status_code == 403


def test_dev_login_is_404_when_dev_mode_off(client, auth, monkeypatch):
    _enable_sso(client, auth)
    monkeypatch.setenv("ESAP_SSO_DEV", "false")
    r = client.post("/api/v1/auth/sso/dev-login", json={"email": f"x@{DOMAIN}"})
    assert r.status_code == 404
