"""Endpoints behind buttons that used to only show a confirmation.

Each test is one control in the UI: it must reach the server, be refused for
the wrong caller, and leave something the next screen can read back.
"""

from __future__ import annotations

import uuid

from app import db
from app.seed import DEMO_PASSWORD


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _fresh(client, auth, role="physician"):
    email = f"wire.{uuid.uuid4().hex[:8]}@styves.example"
    inv = client.post("/api/v1/admin/invites", headers=auth("tenant_owner"),
                      json={"email": email, "role": role, "local_title": "Night Hospitalist"}).json()
    s = client.post("/api/v1/auth/invite/accept",
                    json={"token": inv["acceptToken"], "name": "Wire Test", "password": "correct-horse-1"}).json()
    return s["user"]["id"], email, s["token"]


# --- service requests -------------------------------------------------------


def test_patient_request_is_stored_and_listed(client, auth):
    headers = auth("patient")
    r = client.post("/api/v1/requests", headers=headers, json={
        "kind": "care_team_message", "detail": "When is the ward round?", "ref": "Dr. Amara Okonkwo"})
    assert r.status_code == 201
    mine = client.get("/api/v1/requests", headers=headers).json()["requests"]
    assert r.json()["id"] in {x["id"] for x in mine}


def test_request_kinds_are_role_checked(client, auth):
    # A clinician cannot file a patient's request, and a hospital cannot open a platform review.
    assert client.post("/api/v1/requests", headers=auth("physician"),
                       json={"kind": "record_correction", "detail": "x"}).status_code == 403
    assert client.post("/api/v1/requests", headers=auth("tenant_owner"),
                       json={"kind": "subprocessor_review", "detail": "x"}).status_code == 403
    assert client.post("/api/v1/requests", headers=auth("super_admin"),
                       json={"kind": "subprocessor_review", "detail": "Transcription vendor", "ref": "Acme"}).status_code == 201
    assert client.post("/api/v1/requests", headers=auth("tenant_owner"),
                       json={"kind": "account_team_contact", "detail": "Add 40 beds"}).status_code == 201


def test_urgent_flag_is_audited_as_a_warning(client, auth):
    client.post("/api/v1/requests", headers=auth("patient"),
                json={"kind": "result_urgent_flag", "detail": "This is not me", "ref": "rr1"})
    row = db.connect().execute(
        "SELECT severity FROM audit_events WHERE action='request.urgent' ORDER BY at DESC LIMIT 1").fetchone()
    assert row["severity"] == "warning"


# --- account ------------------------------------------------------------------


def test_password_change_needs_the_current_one_and_ends_other_sessions(client, auth):
    _, email, token = _fresh(client, auth)
    other = client.post("/api/v1/auth/login", json={"email": email, "password": "correct-horse-1"}).json()["token"]

    bad = client.post("/api/v1/auth/password", headers=_h(token),
                      json={"current_password": "wrong", "new_password": "a-new-password"})
    assert bad.status_code == 403

    ok = client.post("/api/v1/auth/password", headers=_h(token),
                     json={"current_password": "correct-horse-1", "new_password": "a-new-password"})
    assert ok.status_code == 200
    assert client.get("/api/v1/auth/session", headers=_h(other)).status_code == 401
    assert client.get("/api/v1/auth/session", headers=_h(token)).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "a-new-password"}).status_code == 200


def test_signup_records_the_licence_number(client):
    email = f"solo.{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/v1/auth/signup", json={
        "name": "Solo Doc", "email": email, "password": "correct-horse-1", "role": "physician",
        "licence_number": "GMC-1234567"})
    assert r.status_code == 201
    user = db.one_doc("SELECT doc FROM users WHERE email=?", (email,))
    assert user["licenceNumber"] == "GMC-1234567" and user["attestedAt"]


def test_invite_carries_the_local_title(client, auth):
    user_id, _, _ = _fresh(client, auth)
    assert db.one_doc("SELECT doc FROM users WHERE id=?", (user_id,))["localTitle"] == "Night Hospitalist"


# --- admin console ---------------------------------------------------------------


def test_role_change_can_set_scope(client, auth):
    user_id, _, _ = _fresh(client, auth)
    r = client.post(f"/api/v1/admin/users/{user_id}/roles", headers=auth("tenant_owner"),
                    json={"roles": ["np_pa"], "scope": "Unit: MICU", "reason": "Moved to the MICU team."})
    assert r.status_code == 200 and r.json()["scope"] == "Unit: MICU"


def test_break_glass_delegate_needs_full_user_management(client, auth):
    user_id, _, _ = _fresh(client, auth)
    it_admin = client.post("/api/v1/auth/login", json={"email": "kofi.mensah@styves.example",
                                                       "password": DEMO_PASSWORD}).json()["token"]
    body = {"break_glass_delegate": True, "reason": "Covering the ED at night."}
    assert client.patch(f"/api/v1/admin/users/{user_id}/access", headers=_h(it_admin), json=body).status_code == 403
    ok = client.patch(f"/api/v1/admin/users/{user_id}/access", headers=auth("tenant_owner"), json=body)
    assert ok.status_code == 200 and ok.json()["breakGlassDelegate"] is True
    sso = client.patch(f"/api/v1/admin/users/{user_id}/access", headers=_h(it_admin),
                       json={"sso": False, "reason": "Local account for the pilot."})
    assert sso.status_code == 200 and sso.json()["sso"] is False


def test_outbound_record_request_lands_in_the_queue(client, auth):
    r = client.post("/api/v1/admin/interop", headers=auth("physician"), json={
        "mrn": "MRN-400001", "patient_display": "Test Patient, 50F", "counterparty": "Northgate Health System"})
    assert r.status_code == 201 and r.json()["state"] == "requested"
    queue = client.get("/api/v1/admin/interop", headers=auth("physician")).json()["transfers"]
    assert r.json()["id"] in {t["id"] for t in queue}


def test_transfer_approval_records_the_reason(client, auth):
    pending = [t for t in client.get("/api/v1/admin/interop", headers=auth("tenant_owner")).json()["transfers"]
               if t["state"] in {"requested", "mpi_review", "consent_pending"}]
    target = pending[0]
    r = client.post(f"/api/v1/admin/interop/{target['id']}/approve", headers=auth("tenant_owner"),
                    json={"reason": "Photo ID checked at the bedside.", "accept_scope": "coded"})
    assert r.status_code == 200 and r.json()["acceptScope"] == "coded"
    assert r.json()["decisionReason"] == "Photo ID checked at the bedside."


def test_audit_drill_down_filters_on_the_server(client, auth):
    email = "amara.okonkwo@styves.example"
    client.get("/api/v1/encounters", headers=auth("physician"))
    events = client.get(f"/api/v1/admin/audit?actor={email}", headers=auth("privacy_officer")).json()["events"]
    assert events and all(e["actor"] == email for e in events)


def test_audit_report_honours_its_filters(client, auth):
    r = client.post("/api/v1/exports", headers=auth("privacy_officer"), json={
        "kind": "audit_log", "scope": {"filter": "bg", "detail": "summary"}})
    assert r.status_code == 201
    summary = r.json()["data"]["summary"]
    assert all(action.startswith("break_glass.") for action in summary)


def test_settings_toggles_persist(client, auth):
    headers = auth("tenant_owner")
    client.put("/api/v1/settings/integrations", headers=headers, json={"patch": {"policy": {"verifyTls": False}}})
    client.put("/api/v1/settings/org", headers=headers, json={"patch": {"benchmarkingOptIn": False}})
    assert client.get("/api/v1/settings/integrations", headers=headers).json()["settings"]["policy"]["verifyTls"] is False
    assert client.get("/api/v1/settings/org", headers=headers).json()["settings"]["benchmarkingOptIn"] is False
    client.put("/api/v1/settings/integrations", headers=headers, json={"patch": {"policy": {"verifyTls": True}}})
    client.put("/api/v1/settings/org", headers=headers, json={"patch": {"benchmarkingOptIn": True}})


def test_resident_cosign_follows_the_tenant_policy(client, auth):
    owner = auth("tenant_owner")
    resident = auth("resident")
    target = next(e for e in client.get("/api/v1/encounters", headers=resident).json()["encounters"]
                  if e["state"] in {"assessed", "acknowledged", "awaiting_cosign"})
    client.put("/api/v1/settings/org", headers=owner, json={"patch": {"requireResidentCosign": False}})
    try:
        r = client.post(f"/api/v1/encounters/{target['id']}/acknowledge", headers=resident, json={})
        assert r.json()["requires_cosign"] is False
    finally:
        client.put("/api/v1/settings/org", headers=owner, json={"patch": {"requireResidentCosign": True}})


# --- platform --------------------------------------------------------------------


def test_plan_edits_show_wherever_plans_are_listed(client, auth):
    ops = auth("super_admin")
    r = client.post("/api/v1/ops/plans", headers=ops, json={
        "tier": "research", "patch": {"name": "Research", "priceLabel": "$4,000", "unit": "per month"},
        "reason": "New plan for academic partners."})
    assert r.status_code == 200
    plans = client.get("/api/v1/ops/plans", headers=ops).json()["plans"]
    assert any(p["tier"] == "research" and p["priceLabel"] == "$4,000" for p in plans)
    billing = client.get("/api/v1/admin/billing", headers=auth("billing_admin")).json()["plans"]
    assert any(p["tier"] == "research" for p in billing)


# --- clinical ---------------------------------------------------------------------


def test_intake_draft_is_kept_on_the_encounter(client, auth):
    headers = auth("physician")
    enc = client.get("/api/v1/encounters", headers=headers).json()["encounters"][0]
    r = client.put(f"/api/v1/encounters/{enc['id']}/draft", headers=headers, json={"draft": {"age": "68"}})
    assert r.status_code == 200
    assert client.get(f"/api/v1/encounters/{enc['id']}", headers=headers).json()["intakeDraft"] == {"age": "68"}
    # Pharmacists read charts but do not write them.
    assert client.put(f"/api/v1/encounters/{enc['id']}/draft", headers=auth("pharmacist"),
                      json={"draft": {}}).status_code == 403


# --- patient portal ----------------------------------------------------------------


def test_patient_intake_keeps_every_answer(client, auth):
    r = client.post("/api/v1/patient/intake", headers=auth("patient"), json={
        "describe": "Short of breath", "since": "days", "getting_worse": True, "missed_doses": True,
        "concerns": ["Short of breath"], "medications": "Furosemide", "questions": ["Can I go home?"]})
    assert r.status_code == 201
    doc = r.json()
    assert doc["missedDoses"] is True and doc["medications"] == "Furosemide" and doc["questions"] == ["Can I go home?"]


def test_family_access_keeps_level_and_can_be_removed(client, auth):
    headers = auth("patient")
    r = client.post("/api/v1/patient/family", headers=headers, json={
        "name": "Marek Salib", "email": "marek@example.com", "relationship": "Son or daughter",
        "scope": ["Full record"], "level": "view_all"})
    assert r.status_code == 201 and r.json()["level"] == "view_all"
    assert client.delete(f"/api/v1/patient/sharing/{r.json()['id']}", headers=headers).status_code == 200
    family = client.get("/api/v1/patient/family", headers=headers).json()["family"]
    assert next(f for f in family if f["id"] == r.json()["id"])["status"] == "revoked"


def test_patient_access_log_is_their_own(client, auth):
    headers = auth("patient")
    client.get("/api/v1/patient/results", headers=headers)
    events = client.get("/api/v1/patient/access-log", headers=headers).json()["events"]
    assert events
    assert client.get("/api/v1/patient/access-log", headers=auth("physician")).status_code == 403


# --- evidence ------------------------------------------------------------------


def test_public_evidence_serves_real_metrics_without_a_session(client):
    r = client.get("/api/v1/public/evidence")
    assert r.status_code == 200
    cards = {c["id"]: c for c in r.json()["models"]}
    assert set(cards) == {"M-01", "M-02", "M-03", "M-04", "M-05"}
    # Every card names the evaluation it came from; none carries seed placeholders.
    assert all(c["evidenceSource"].startswith("ml-pipeline/models/") for c in cards.values())
    assert "plans" in r.json()


def test_seeded_patients_are_scored_by_the_assessor(client, auth):
    enc = next(e for e in client.get("/api/v1/encounters", headers=auth("physician")).json()["encounters"]
               if e["state"] == "assessed")
    history = client.get(f"/api/v1/encounters/{enc['id']}/assessments", headers=auth("physician")).json()["assessments"]
    assert history, "an assessed seeded patient must have a stored assessment"
    latest = history[0]["response"]
    assert latest["mortality"]["result"]["probability"] == enc["risks"]["mortality"]


def test_fairness_and_drift_are_empty_until_measured(client, auth):
    boot = client.get("/api/v1/bootstrap", headers=auth("privacy_officer")).json()
    assert boot["subgroup_fairness"] == [] and boot["drift"] == []


def test_patient_record_export_carries_what_the_pdf_prints(client, auth):
    r = client.post("/api/v1/exports", headers=auth("patient"), json={
        "kind": "patient_record", "reason": "Patient right of access request"})
    assert r.status_code == 201
    data = r.json()["data"]
    assert data["patient"]["name"] and data["patient"]["email"] == "delia.salib@example.com"
    assert {"records", "results", "consents", "careTeam", "encounters"} <= set(data)
    # Stays are the patient-safe subset: never a score, a differential or an audit covariate.
    for e in data["encounters"]:
        assert not {"risks", "topDifferential", "patient"} & set(e)
