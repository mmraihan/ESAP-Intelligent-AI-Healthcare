"""Pre-release QA pass (12 Nov 2026): bugs found reviewing the P2/P3 work.

One test per bug. Each failed before its fix.
"""

from __future__ import annotations

import uuid

from app import db
from app.chat_extract import extract
from app.red_flags import screen
from app.seed import DEMO_PASSWORD

from .test_qa_p2 import _code, _signup


def _login(client, email: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {r.json()['token']}"}


# --- auth ---------------------------------------------------------------------

def test_mfa_codes_cannot_be_brute_forced(client):
    """Wrong second-factor codes count toward the lockout like wrong passwords."""
    email, h = _signup(client)
    secret = client.post("/api/v1/auth/mfa/enroll", headers=h).json()["secret"]
    assert client.post("/api/v1/auth/mfa/activate", headers=h, json={"code": _code(secret)}).status_code == 200

    def challenge():
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "a-long-password"})
        assert r.status_code == 200, r.text
        return r.json()["mfa_token"]

    token = challenge()
    statuses = [client.post("/api/v1/auth/mfa/verify", json={"mfa_token": token, "code": "000000"}).status_code
                for _ in range(6)]
    assert 429 in statuses, statuses
    # Locked: even the right code is refused until the lock lifts.
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": token, "code": _code(secret)})
    assert r.status_code == 429


def test_old_failures_do_not_add_up_to_a_lockout(client):
    """Four typos last month and one today must not lock the account."""
    email = f"qa-{uuid.uuid4().hex[:8]}@example.com"
    conn = db.connect()
    conn.execute("INSERT INTO login_throttle (email, failures, first_at, locked_until) VALUES (?,?,?,NULL)",
                 (email, 4, "2026-10-01T00:00:00Z"))
    conn.commit()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})
    assert r.status_code == 401, r.text


# --- privacy ------------------------------------------------------------------

def test_auditor_cannot_run_the_retention_purge(client):
    h = _login(client, "leila.aziz@styves.example")
    assert client.get("/api/v1/admin/retention/reports", headers=h).status_code == 200
    assert client.post("/api/v1/admin/retention/run", headers=h).status_code == 403


def test_consent_summary_counts_portal_patients(client, auth):
    r = client.get("/api/v1/admin/consents/summary", headers=auth("privacy_officer"))
    assert r.status_code == 200, r.text
    assert r.json()["patients"] >= 1


def test_access_history_matches_the_exact_patient_only(client, auth):
    """`patient:pat_1` must not pull in audit rows about `patient:pat_12`."""
    h = auth("patient")
    me = client.get("/api/v1/auth/session", headers=h).json()["user"]["id"]
    other = me + "x"
    conn = db.connect()
    conn.execute("INSERT INTO audit_events (id, tenant_id, at, actor, action, severity, outcome, platform, doc)"
                 " VALUES (?,?,?,?,?,?,?,0,?)",
                 ("ae_probe_" + uuid.uuid4().hex[:6], "t_yves", "2026-11-12T00:00:00Z", "someone@else",
                  "patient.read", "info", "ok",
                  '{"target": "patient:%s", "action": "patient.read", "actor": "someone@else"}' % other))
    conn.commit()
    rows = client.get("/api/v1/patient/access-log", headers=h).json()
    rows = rows.get("events", rows.get("entries", rows)) if isinstance(rows, dict) else rows
    assert not any(f"patient:{other}" == (e.get("target") or "") for e in rows)


# --- incidents ----------------------------------------------------------------

def test_breach_aware_time_without_zone_is_utc_and_future_is_refused(client, auth):
    h = auth("super_admin")
    inc = client.post("/api/v1/ops/incidents", headers=h, json={
        "title": "Probe", "component": "audit", "detail": "Probe incident."}).json()
    r = client.post(f"/api/v1/ops/incidents/{inc['id']}/breach", headers=h,
                    json={"breach": True, "aware_at": "2026-11-09T08:00:00", "note": "No zone given"})
    assert r.status_code == 200, r.text
    b = r.json()["breach"]
    assert b["awareAt"] == "2026-11-09T08:00:00Z"
    assert b["deadlines"]["controller"] == "2026-11-10T08:00:00Z"
    r = client.post(f"/api/v1/ops/incidents/{inc['id']}/breach", headers=h,
                    json={"breach": True, "aware_at": "2999-01-01T00:00:00Z", "note": "In the future"})
    assert r.status_code == 422


# --- clinical text ------------------------------------------------------------

def test_negated_symptom_lists_do_not_raise_the_emergency_message():
    for text in ["no chest pain or shortness of breath", "I am not short of breath",
                 "never had a stroke", "denies chest pain or shortness of breath"]:
        assert screen(text) == [], text
    # The real thing still fires, including after an unrelated negation. A
    # comma list is not read as negated: "no fever, chest pain" may mean both.
    for text in ["no fever but I have chest pain", "I can't breathe", "my face is drooping",
                 "not sure, my chest hurts", "no idea if it's heartburn or chest pain",
                 "I'm not sure if it's heartburn or chest pain", "no fever, chest pain since morning",
                 "no fever or chills but now chest pain"]:
        assert screen(text), text


def test_age_and_sex_shorthand_is_captured():
    for text, age, female in [("68M, hx of CHF", 68, 0), ("72F with sepsis", 72, 1),
                              ("pt 54 m, BP 120/80", 54, 0)]:
        demo = extract(text)["delta"]["features"]["demographics"]
        assert demo == {"admission_age": age, "is_female": female}, (text, demo)
    # A distance is not an age.
    demo = extract("walked 5 m today")["delta"].get("features", {}).get("demographics", {})
    assert "admission_age" not in demo
