"""QA report, P2 and P3 fixes (8 Nov 2026 report). One test group per issue."""

from __future__ import annotations

import uuid

import pytest

from app import db
from app.security import iso, utcnow, verify_totp, _totp_at  # noqa: F401
from app.seed import DEMO_PASSWORD


def _signup(client, role="patient"):
    email = f"qa-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/v1/auth/signup", json={"name": "QA Person", "email": email,
                                                 "password": "a-long-password", "role": role})
    assert r.status_code == 201, r.text
    client.cookies.clear()
    return email, {"Authorization": f"Bearer {r.json()['token']}"}


def _code(secret: str) -> str:
    import time
    return _totp_at(secret, int(time.time()) // 30)


# --- Issue 7: breach flag and clocks -----------------------------------------

def test_breach_incident_has_24h_and_72h_deadlines_and_templates(client, auth):
    h = auth("super_admin")
    r = client.post("/api/v1/ops/incidents", headers=h, json={
        "title": "Export sent to wrong hospital", "component": "exports", "severity": "critical",
        "detail": "A patient export was emailed to the wrong DPO.", "breach": True,
        "data_categories": ["names", "lab results"], "affected_estimate": 3})
    assert r.status_code == 201, r.text
    inc = r.json()
    b = inc["breach"]
    assert b["deadlines"]["controller"] > b["awareAt"] and b["deadlines"]["regulator"] > b["deadlines"]["controller"]
    assert b["deadlines"]["data_subjects"] is None
    assert "SDAIA" in inc["templates"]["regulator"]["body"]
    r = client.post(f"/api/v1/ops/incidents/{inc['id']}/notifications", headers=h,
                    json={"kind": "controller", "recipient": "dpo@styves.example"})
    assert r.status_code == 200 and r.json()["breach"]["notifications"]["controller"]["late"] is False


def test_breach_flag_can_be_set_later_and_needs_ops(client, auth):
    h = auth("super_admin")
    inc = client.post("/api/v1/ops/incidents", headers=h, json={
        "title": "Odd access pattern", "component": "audit", "detail": "Looking into it."}).json()
    assert "breach" not in inc
    r = client.post(f"/api/v1/ops/incidents/{inc['id']}/breach", headers=h,
                    json={"breach": True, "aware_at": "2026-11-09T08:00:00Z", "note": "Confirmed exposure"})
    assert r.status_code == 200 and r.json()["breach"]["deadlines"]["controller"].startswith("2026-11-10T08:00")
    assert client.post(f"/api/v1/ops/incidents/{inc['id']}/breach", headers=auth("tenant_owner"),
                       json={"breach": True, "note": "nope nope"}).status_code == 403


# --- Issue 8: lockout, idle timeout, admin MFA --------------------------------

def test_lockout_after_repeated_wrong_passwords_even_for_unknown_address(client):
    for email in ("delia.salib@example.com", "nobody-here@example.com"):
        db.connect().execute("DELETE FROM login_throttle WHERE email=?", (email,))
        db.connect().commit()
        codes = [client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-one"}).status_code
                 for _ in range(5)]
        assert codes[:4] == [401] * 4 and codes[4] == 429
        r = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
        assert r.status_code == 429 and r.json()["error"]["code"] == "ACCOUNT_LOCKED"
        db.connect().execute("DELETE FROM login_throttle WHERE email=?", (email,))
        db.connect().commit()


def test_idle_session_is_signed_out(client, auth):
    h = auth("physician")
    token = h["Authorization"].split()[1]
    db.connect().execute("UPDATE sessions SET last_seen='2026-01-01T00:00:00Z' WHERE token=?", (token,))
    db.connect().commit()
    r = client.get("/api/v1/auth/session", headers=h)
    assert r.status_code == 401 and "without activity" in r.json()["error"]["message"]


def test_non_demo_admin_must_enrol_mfa_before_anything_else(client):
    email = f"admin-{uuid.uuid4().hex[:6]}@styves.example"
    from app.security import hash_password
    uid = f"u_{uuid.uuid4().hex[:8]}"
    conn = db.connect()
    conn.execute("INSERT INTO credentials (user_id, email, password_hash, role, tenant_id) VALUES (?,?,?,?,?)",
                 (uid, email, hash_password("a-long-password"), "it_admin", "t_yves"))
    conn.commit()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "a-long-password"})
    client.cookies.clear()
    body = r.json()
    assert body["mfa_setup_required"] is True
    h = {"Authorization": f"Bearer {body['token']}"}
    blocked = client.get("/api/v1/bootstrap", headers=h)
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "MFA_SETUP_REQUIRED"
    secret = client.post("/api/v1/auth/mfa/enroll", headers=h).json()["secret"]
    assert client.post("/api/v1/auth/mfa/activate", headers=h, json={"code": _code(secret)}).status_code == 200
    assert client.get("/api/v1/bootstrap", headers=h).status_code == 200
    # Required for the role, so it cannot be switched off, and re-enrolling is refused.
    assert client.post("/api/v1/auth/mfa/disable", headers=h, json={"code": _code(secret)}).status_code == 403
    assert client.post("/api/v1/auth/mfa/enroll", headers=h).status_code == 409


def test_demo_admin_accounts_stay_exempt_while_picker_is_on(client, auth):
    r = client.get("/api/v1/auth/session", headers=auth("tenant_owner"))
    assert r.status_code == 200 and r.json()["mfa_setup_required"] is False


# --- Issue 9: processing consent and retention --------------------------------

def test_processing_consent_is_versioned_and_withdrawal_stops_ai_use(client, auth):
    h = auth("patient")
    policy = client.get("/api/v1/consents", headers=h).json()["policy"]
    r = client.post("/api/v1/consents", headers=h, json={"purpose": "research", "version": "1999-01", "decision": "given"})
    assert r.status_code == 409
    r = client.post("/api/v1/consents", headers=h, json={"purpose": "research", "version": policy["version"], "decision": "withdrawn"})
    assert r.status_code == 201 and r.json()["withdrawnAt"]
    d = client.get("/api/v1/consents", headers=h).json()["decisions"]["research"]
    assert d["status"] == "withdrawn" and d["needsReview"] is False
    assert client.post("/api/v1/consents", headers=auth("physician"),
                       json={"purpose": "research", "version": policy["version"], "decision": "given"}).status_code == 403


def test_sharing_revoke_stamps_withdrawal_time(client, auth):
    h = auth("patient")
    c = client.post("/api/v1/patient/sharing", headers=h, json={
        "grantee": "carer@example.com", "grantee_type": "caregiver", "purpose": "Caregiver access",
        "scope": ["Visit summaries"]}).json()
    r = client.delete(f"/api/v1/patient/sharing/{c['id']}", headers=h)
    assert r.json()["consent"]["withdrawnAt"]


def test_retention_purge_deletes_old_assessments_and_writes_a_report(client, auth):
    conn = db.connect()
    conn.execute("INSERT INTO assessments (id, encounter_id, tenant_id, actor_id, created_at, request, response)"
                 " VALUES (?,?,?,?,?,?,?)", ("old_a1", None, "t_yves", "x", "2010-01-01T00:00:00Z", "{}", "{}"))
    conn.commit()
    h = auth("privacy_officer")
    r = client.post("/api/v1/admin/retention/run", headers=h)
    assert r.status_code == 201, r.text
    rule = next(x for x in r.json()["rules"] if x["table"] == "assessments")
    assert rule["deleted"] >= 1
    assert conn.execute("SELECT 1 FROM assessments WHERE id='old_a1'").fetchone() is None
    assert client.get("/api/v1/admin/retention/reports", headers=h).json()["reports"][0]["id"] == r.json()["id"]
    assert client.post("/api/v1/admin/retention/run", headers=auth("physician")).status_code == 403


# --- Issue 13: HttpOnly cookie, client header, API headers ---------------------

def test_signin_sets_httponly_cookie_and_cookie_writes_need_client_header(client):
    r = client.post("/api/v1/auth/login", json={"email": "amara.okonkwo@styves.example", "password": DEMO_PASSWORD})
    cookie = r.headers.get("set-cookie", "")
    assert "esap_session=" in cookie and "httponly" in cookie.lower()
    who = client.get("/api/v1/auth/whoami")
    assert who.json()["authenticated"] is True and who.json()["token"] is None
    assert client.post("/api/v1/auth/logout").status_code == 403
    assert client.post("/api/v1/auth/logout", headers={"X-ESAP-Client": "web"}).status_code == 204
    client.cookies.clear()
    assert client.get("/api/v1/auth/whoami").json() == {"authenticated": False}
    assert r.headers["x-content-type-options"] == "nosniff"


# --- Issue 16: intake assistant ---------------------------------------------

def test_assistant_captures_the_qa_message_in_full(client, auth):
    msg = ("68-year-old man via ED, 3 days of worsening shortness of breath. BP 150/95, HR 102, RR 22, "
           "SpO2 94%, temp 36.9. History of heart failure, hypertension and type 2 diabetes. "
           "Creatinine 1.4, sodium 137, potassium 4.3.")
    r = client.post("/api/v1/chat", headers=auth("physician"), json={"message": msg}).json()
    text = " ".join(r["captured"])
    for want in ("Heart rate 102", "Respiratory rate 22", "SpO2 94", "Temperature 36.9", "potassium",
                 "Symptom: shortness of breath"):
        assert want in text, want
    assert r["not_captured"] == []
    assert r["draft"]["features"]["labs"]["50971"] == 4.3


def test_assistant_lists_values_it_could_not_map(client, auth):
    r = client.post("/api/v1/chat", headers=auth("physician"), json={"message": "70 yo woman, troponin 0.4"}).json()
    assert "troponin 0.4" in r["not_captured"]


# --- Issue 15: draft for a patient not admitted yet ---------------------------

def test_new_intake_draft_saves_and_restores_per_clinician(client, auth):
    h = auth("physician")
    r = client.put("/api/v1/intake-drafts/new", headers=h, json={"draft": {"age": "54"}, "admit": {"name": "Test"}})
    assert r.status_code == 200
    assert client.get("/api/v1/intake-drafts/new", headers=h).json()["saved"]["draft"]["age"] == "54"
    assert client.get("/api/v1/intake-drafts/new", headers=auth("resident")).json()["saved"] is None
    client.delete("/api/v1/intake-drafts/new", headers=h)
    assert client.get("/api/v1/intake-drafts/new", headers=h).json()["saved"] is None


# --- Issue 17: self-service password reset -----------------------------------

def test_patient_gets_a_reset_link_and_can_set_a_new_password(client):
    email, _ = _signup(client)
    r = client.post("/api/v1/auth/password/forgot", json={"email": email})
    assert r.status_code == 202 and "emailed" in r.json()["message"]
    mail = db.docs("SELECT doc FROM mail_outbox WHERE to_addr=? ORDER BY created_at DESC", (email,))[0]
    token = mail["body"].split("token=")[1].split()[0]
    assert client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "brand-new-pass"}).status_code == 200
    assert client.post("/api/v1/auth/password/reset", json={"token": token, "new_password": "again-new-pass"}).status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "brand-new-pass"}).status_code == 200


def test_forgot_answer_is_the_same_for_unknown_addresses(client):
    a = client.post("/api/v1/auth/password/forgot", json={"email": "no-such-person@example.com"}).json()
    b = client.post("/api/v1/auth/password/forgot", json={"email": "delia.salib@example.com"}).json()
    assert a == b


# --- Issue 21: sharing recipient validation ----------------------------------

@pytest.mark.parametrize("grantee,kind", [("not-an-email", "caregiver"), ("x@y", "clinician"),
                                          ("Made Up Hospital", "hospital"), ("1", "app")])
def test_sharing_refuses_an_invalid_recipient(client, auth, grantee, kind):
    r = client.post("/api/v1/patient/sharing", headers=auth("patient"), json={
        "grantee": grantee, "grantee_type": kind, "purpose": "Treatment", "scope": ["Visit summaries"]})
    assert r.status_code == 422


# --- Issue 22: export completeness --------------------------------------------

def test_patient_export_includes_submissions_requests_and_access_history(client, auth):
    h = auth("patient")
    client.post("/api/v1/patient/intake", headers=h, json={"describe": "QA synthetic test: headache"})
    r = client.post("/api/v1/exports", headers=h, json={"kind": "patient_record", "reason": "My own copy"})
    data = r.json()["data"]
    assert data["submissions"] and data["accessHistory"] and "requests" in data
    assert "not FHIR" in data["format"]["note"]


# --- Issue 23: requests with no care team -----------------------------------

def test_solo_patient_request_goes_to_esap_support_and_says_so(client):
    _, h = _signup(client)
    r = client.post("/api/v1/requests", headers=h, json={"kind": "record_correction", "detail": "My allergy is wrong."})
    assert r.status_code == 201 and r.json()["routedTo"] == "esap_support"
    ticket = db.one_doc("SELECT doc FROM support_tickets WHERE id=?", (r.json()["supportTicketId"],))
    assert ticket and "allergy" in ticket["messages"][0]["body"]
    s = client.post("/api/v1/patient/intake", headers=h, json={"describe": "QA synthetic test"}).json()
    assert s["sharedWith"] == "nobody" and "no care team" in s["note"]


# --- Issue 24: real clock -----------------------------------------------------

def test_bootstrap_reports_the_real_time(client, auth):
    now = client.get("/api/v1/bootstrap", headers=auth("physician")).json()["now"]
    assert now[:10] == iso(utcnow())[:10]


# --- Issue 25: admin endpoints closed to patients ----------------------------

def test_patient_cannot_reach_admin_interop(client, auth):
    assert client.get("/api/v1/admin/interop", headers=auth("patient")).status_code == 403


# --- Close my account (results table, no issue number) -----------------------

def test_closing_a_patient_account_really_closes_it(client):
    email, h = _signup(client)
    client.post("/api/v1/patient/sharing", headers=h, json={
        "grantee": "carer@example.com", "grantee_type": "caregiver", "purpose": "Caregiver access",
        "scope": ["Visit summaries"]})
    assert client.post("/api/v1/patient/account/close", headers=h, json={"confirm": "nope"}).status_code == 422
    r = client.post("/api/v1/patient/account/close", headers=h, json={"confirm": "CLOSE"})
    assert r.status_code == 200 and r.json()["closed"] is True
    assert client.get("/api/v1/auth/session", headers=h).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "a-long-password"}).status_code == 401
