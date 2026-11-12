"""Regression tests for the code-review findings on the QA P2/P3 changes."""

from __future__ import annotations

import time
import uuid

import pytest

from app import chat_extract, db, red_flags
from app.security import _totp_at, hash_password


# --- red flags: a negation inside the phrase is not an emergency ----------------

@pytest.mark.parametrize("text", ["my breathing is not bad today", "breathing is not difficult",
                                  "breathing has been never worse than mild"])
def test_negated_breathing_is_not_a_red_flag(text):
    assert "Trouble breathing" not in red_flags.screen(text)


@pytest.mark.parametrize("text", ["my breathing is really bad", "breathing is getting worse",
                                  "breathing has been very hard"])
def test_breathing_trouble_still_flags(text):
    assert "Trouble breathing" in red_flags.screen(text)


# --- labs with linking words are captured ---------------------------------------

@pytest.mark.parametrize("text,itemid,value", [
    ("creatinine of 2.1", "50912", 2.1), ("lactate is 4.2", "50813", 4.2),
    ("potassium was 6.1", "50971", 6.1), ("sodium: 135", "50983", 135.0), ("k 5.5", "50971", 5.5),
])
def test_lab_phrasing_is_captured(text, itemid, value):
    r = chat_extract.extract(text)
    assert r["delta"]["features"]["labs"][itemid] == value
    assert r["not_captured"] == []


# --- notes build up over the conversation ---------------------------------------

def test_later_turns_add_to_the_notes_instead_of_replacing_them():
    d = chat_extract.merge({}, chat_extract.extract("chest pain for 2 days, HR 110")["delta"])
    d = chat_extract.merge(d, chat_extract.extract("creatinine 1.2")["delta"])
    assert "chest pain for 2 days" in d["notes"]["hpi"] and "creatinine 1.2" in d["notes"]["hpi"]
    assert d["notes"]["chief_complaint"].startswith("chest pain")
    # Repeating a message does not duplicate it.
    again = chat_extract.merge(d, chat_extract.extract("creatinine 1.2")["delta"])
    assert again["notes"]["hpi"] == d["notes"]["hpi"]


# --- lockout ----------------------------------------------------------------------

def test_wrong_mfa_codes_count_toward_the_lockout(client):
    email = f"mfa-{uuid.uuid4().hex[:6]}@styves.example"
    uid = f"u_{uuid.uuid4().hex[:8]}"
    conn = db.connect()
    conn.execute("INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
                 (uid, email, hash_password("a-long-password"), "it_admin", "t_yves"))
    conn.commit()
    h = {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': 'a-long-password'}).json()['token']}"}
    client.cookies.clear()
    secret = client.post("/api/v1/auth/mfa/enroll", headers=h).json()["secret"]
    assert client.post("/api/v1/auth/mfa/activate", headers=h,
                       json={"code": _totp_at(secret, int(time.time()) // 30)}).status_code == 200

    challenge = client.post("/api/v1/auth/login", json={"email": email, "password": "a-long-password"}).json()
    client.cookies.clear()
    assert challenge["mfa_required"] is True
    codes = [client.post("/api/v1/auth/mfa/verify", json={"mfa_token": challenge["mfa_token"], "code": "000000"}).status_code
             for _ in range(5)]
    assert codes[:4] == [401] * 4 and codes[4] == 429
    # Locked: even the right code is refused now.
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": challenge["mfa_token"],
                                                     "code": _totp_at(secret, int(time.time()) // 30)})
    assert r.status_code == 429
    db.connect().execute("DELETE FROM login_throttle WHERE email=?", (email,))
    db.connect().commit()


def test_old_failures_do_not_add_up_to_a_lockout(client):
    email = f"typo-{uuid.uuid4().hex[:6]}@example.com"
    conn = db.connect()
    conn.execute("INSERT INTO login_throttle (email, failures, first_at, locked_until) VALUES (?,?,?,NULL)",
                 (email, 4, "2026-01-01T00:00:00Z"))
    conn.commit()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-one"})
    assert r.status_code == 401
    assert db.connect().execute("SELECT failures FROM login_throttle WHERE email=?", (email,)).fetchone()["failures"] == 1
    db.connect().execute("DELETE FROM login_throttle WHERE email=?", (email,))
    db.connect().commit()


# --- breach clock: offsets are normalised to UTC ------------------------------------
# A time with no zone is read as UTC (test_release_check.py covers that case).

def test_breach_time_offsets_are_normalised(client, auth):
    h = auth("super_admin")
    inc = client.post("/api/v1/ops/incidents", headers=h, json={
        "title": "Zone test", "component": "audit", "detail": "Checking the clock."}).json()
    url = f"/api/v1/ops/incidents/{inc['id']}/breach"
    r = client.post(url, headers=h, json={"breach": True, "aware_at": "2026-11-12T13:00:00+03:00",
                                           "note": "Riyadh time"})
    assert r.status_code == 200
    assert r.json()["breach"]["awareAt"] == "2026-11-12T10:00:00Z"
    assert r.json()["breach"]["deadlines"]["controller"].startswith("2026-11-13T10:00")


# --- consent check fails closed ------------------------------------------------------

def test_assess_with_unknown_encounter_is_refused_before_scoring(client, auth):
    r = client.post("/api/v1/assess", headers=auth("physician"), json={
        "encounter_id": "enc_does_not_exist",
        "features": {"demographics": {"admission_age": 55, "is_female": 0}}})
    assert r.status_code == 404


# --- privacy admin routes are admins only ----------------------------------------------

@pytest.mark.parametrize("method,path", [("get", "/api/v1/admin/consents/summary"),
                                         ("get", "/api/v1/admin/retention/reports"),
                                         ("post", "/api/v1/admin/retention/run")])
def test_privacy_admin_routes_refuse_clinicians(client, auth, method, path):
    assert getattr(client, method)(path, headers=auth("physician")).status_code == 403
    assert client.get("/api/v1/admin/retention/reports", headers=auth("privacy_officer")).status_code == 200



# --- demo picker: clinical and patient accounts only ---------------------------------

def test_demo_picker_lists_only_clinical_and_patient_accounts(client):
    from app import rbac
    accounts = client.get("/api/v1/public/demo-accounts").json()["accounts"]
    assert "physician" in accounts and "patient" in accounts
    assert all(rbac.roles()[r]["surface"] in {"clinician", "patient"} for r in accounts)
    for blocked in ("tenant_owner", "it_admin", "privacy_officer", "billing_admin", "auditor", "super_admin"):
        assert blocked not in accounts


def test_demo_admins_need_mfa_without_the_dev_exemption(client, monkeypatch):
    from app.routers.auth import mfa_mandatory
    admin = db.document("demo_identity")["it_admin"]["email"]
    doctor = db.document("demo_identity")["physician"]["email"]
    monkeypatch.delenv("ESAP_DEMO_ADMIN_MFA_EXEMPT", raising=False)
    monkeypatch.setenv("ESAP_DEMO_PICKER", "true")
    assert mfa_mandatory(admin, "it_admin") is True
    assert mfa_mandatory(doctor, "physician") is False
    monkeypatch.setenv("ESAP_DEMO_ADMIN_MFA_EXEMPT", "true")
    assert mfa_mandatory(admin, "it_admin") is False
