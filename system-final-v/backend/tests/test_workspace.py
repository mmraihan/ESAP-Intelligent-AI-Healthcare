"""Endpoints added to close the gaps listed in the user manual's "not yet" table.

Handoff, the assessment chat, full vitals, forgot-password, the request queue,
the discharge packet and grant-bound elevation. Each test is one control that
used to either do nothing or claim a success the server never recorded.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from app import db
from app.seed import DEMO_PASSWORD


def _login(client, email: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _charge(client) -> dict:
    return _login(client, "ines.vasquez@styves.example")


def _case_manager(client) -> dict:
    return _login(client, "noor.haddad@styves.example")


def _visible(client, headers) -> list[dict]:
    return client.get("/api/v1/encounters", headers=headers).json()["encounters"]


def _assessed(client, headers) -> dict:
    return next(e for e in _visible(client, headers)
                if e["state"] not in {"intake_in_progress", "awaiting_assessment"})


# --- handoff ------------------------------------------------------------------


def test_charge_nurse_handoff_is_stored_and_read_back(client):
    headers = _charge(client)
    enc = next(e for e in _visible(client, headers) if e["state"] != "closed")
    r = client.post("/api/v1/handoffs", headers=headers, json={
        "unit_id": enc["unitId"], "notes": {enc["id"]: "Family visiting at 18:00."},
        "checked": [enc["id"]]})
    assert r.status_code == 201, r.text
    doc = r.json()
    row = next(p for p in doc["patients"] if p["encounterId"] == enc["id"])
    assert row["note"] == "Family visiting at 18:00." and row["planConfirmed"]
    # Blank notes print as the explicit sentence, never as an empty cell.
    assert all(p["note"] for p in doc["patients"])

    listed = client.get(f"/api/v1/handoffs?unit_id={enc['unitId']}", headers=headers).json()["handoffs"]
    assert listed[0]["id"] == doc["id"]
    ev = db.connect().execute(
        "SELECT 1 FROM audit_events WHERE action='handoff.send' AND actor=?",
        ("ines.vasquez@styves.example",)).fetchone()
    assert ev is not None


def test_handoff_refuses_a_patient_outside_the_unit(client):
    headers = _charge(client)
    enc = next(e for e in _visible(client, headers) if e["state"] != "closed")
    r = client.post("/api/v1/handoffs", headers=headers, json={
        "unit_id": enc["unitId"], "notes": {"enc_not_real": "x"}})
    assert r.status_code == 403


def test_handoff_needs_roster_access(client, auth):
    assert client.post("/api/v1/handoffs", headers=auth("pharmacist"),
                       json={"unit_id": "u_any"}).status_code == 403
    assert client.get("/api/v1/handoffs", headers=auth("patient")).status_code == 403


# --- ask ----------------------------------------------------------------------


def test_ask_answers_from_the_stored_assessment(client, auth):
    headers = auth("physician")
    enc = _assessed(client, headers)
    latest = client.get(f"/api/v1/encounters/{enc['id']}/assessments", headers=headers).json()["assessments"][0]
    r = client.post(f"/api/v1/encounters/{enc['id']}/ask", headers=headers,
                    json={"question": "Why is the ICU estimate where it is?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["grounded"] and body["assessment_id"] == latest["id"]
    icu = latest["response"]["icu"]
    # The number quoted is the number the model returned, and the drivers named
    # are the model's own top contributors.
    assert f"{icu['result']['probability'] * 100:.0f}%" in body["answer"]
    top = icu["explanation"]["top_contributors"][0]["human_label"]
    assert top in body["answer"]
    assert body["sources"] == ["ICU admission · M-03"]


def test_ask_length_of_stay_quotes_the_interval(client, auth):
    headers = auth("physician")
    enc = _assessed(client, headers)
    body = client.post(f"/api/v1/encounters/{enc['id']}/ask", headers=headers,
                       json={"question": "How long will they stay?"}).json()
    assert "days at the" in body["answer"] and "Length of stay · M-05" in body["sources"]


def test_ask_is_refused_to_patients_and_roles_without_chat(client, auth):
    physician = auth("physician")
    enc = _assessed(client, physician)
    assert client.post(f"/api/v1/encounters/{enc['id']}/ask", headers=auth("patient"),
                       json={"question": "What is my risk?"}).status_code == 403
    assert client.post(f"/api/v1/encounters/{enc['id']}/ask", headers=auth("staff_nurse"),
                       json={"question": "icu?"}).status_code == 403


# --- vitals -------------------------------------------------------------------


def test_every_vital_and_lab_on_the_fast_entry_screen_is_stored(client, auth):
    headers = auth("staff_nurse")
    enc = next(e for e in _visible(client, headers) if e["state"] != "closed")
    r = client.post(f"/api/v1/encounters/{enc['id']}/vitals", headers=headers, json={
        "bp_sys": 118, "heart_rate": 96, "resp_rate": 22, "temp_c": 38.1, "spo2": 93,
        "labs": {"50912": 1.4, "50813": 2.1}, "at_t0": False})
    assert r.status_code == 201, r.text
    v = r.json()["values"]
    assert v["heart_rate"] == 96 and v["spo2"] == 93 and v["labs"] == {"50912": 1.4, "50813": 2.1}
    assert r.json()["usableForScoring"] is False


def test_vitals_refuse_an_unknown_lab(client, auth):
    headers = auth("staff_nurse")
    enc = next(e for e in _visible(client, headers) if e["state"] != "closed")
    r = client.post(f"/api/v1/encounters/{enc['id']}/vitals", headers=headers,
                    json={"labs": {"99999999": 1.0}})
    assert r.status_code == 422


# --- forgot password + request queue ------------------------------------------


def test_forgot_password_does_not_enumerate_and_reaches_the_admin(client, auth):
    known = client.post("/api/v1/auth/password/forgot", json={"email": "lucas.beaulieu@styves.example"})
    unknown = client.post("/api/v1/auth/password/forgot", json={"email": f"nobody.{uuid.uuid4().hex[:6]}@x.example"})
    assert known.status_code == unknown.status_code == 202
    assert known.json() == unknown.json()

    admin = auth("tenant_owner")
    queue = client.get("/api/v1/requests?kind=password_reset_request", headers=admin).json()["requests"]
    req = next(q for q in queue if q["ref"] == "lucas.beaulieu@styves.example")
    r = client.post(f"/api/v1/requests/{req['id']}/status", headers=admin,
                    json={"status": "closed", "note": "Reset link issued."})
    assert r.status_code == 200 and r.json()["status"] == "closed"
    assert r.json()["history"][-1]["note"] == "Reset link issued."


def test_request_queue_is_not_worked_by_the_requester(client, auth):
    patient = auth("patient")
    req = client.post("/api/v1/requests", headers=patient,
                      json={"kind": "care_team_message", "detail": "Question"}).json()
    assert client.post(f"/api/v1/requests/{req['id']}/status", headers=patient,
                       json={"status": "closed"}).status_code == 403


# --- discharge packet -----------------------------------------------------------


def test_discharge_packet_export_is_scoped_and_logged(client):
    headers = _case_manager(client)
    caseload = [e for e in _visible(client, headers) if e["state"] != "closed"]
    ids = [e["id"] for e in caseload[:2]]
    r = client.post("/api/v1/exports", headers=headers, json={
        "kind": "discharge_packet", "reason": "Discharge planning huddle", "scope": {"encounter_ids": ids}})
    assert r.status_code == 201, r.text
    assert {row["encounterId"] for row in r.json()["data"]} == set(ids)
    assert r.json()["export"]["containsPhi"] is True

    r = client.post("/api/v1/exports", headers=headers, json={
        "kind": "discharge_packet", "reason": "x", "scope": {"encounter_ids": ["enc_not_mine"]}})
    assert r.status_code == 403


# --- break-glass bound to an approved grant -------------------------------------


def test_elevation_cannot_use_a_pending_grant(client, auth):
    headers = auth("super_admin")
    grant = client.post("/api/v1/ops/break-glass", headers=headers, json={
        "tenant_id": "t_yves", "patient_ref": "MRN-400411", "ticket": "ESC-7",
        "reason": "Investigating a reported wrong-patient banner for one named patient."}).json()
    r = client.post("/api/v1/auth/elevate", headers=headers, json={
        "reason": "Starting work under the grant above.", "ticket": "ESC-7", "grant_id": grant["id"]})
    assert r.status_code == 409


def test_elevation_under_an_approved_grant_takes_the_grants_terms(client, auth):
    headers = auth("super_admin")
    grant = client.post("/api/v1/ops/break-glass", headers=headers, json={
        "tenant_id": "t_yves", "patient_ref": "MRN-400412", "ticket": "ESC-8", "ttl_minutes": 15,
        "reason": "Stored assessment for one patient disagrees with the site's ADT feed."}).json()
    # A second operator approves. There is one platform demo login, so the
    # approval is written the way `approve` writes it.
    db.patch_doc("break_glass", grant["id"], {"status": "active", "approver": "second@esap.health"},
                 {"status": "active"})
    r = client.post("/api/v1/auth/elevate", headers=headers, json={
        "reason": "Different words typed into the form.", "ticket": "OTHER", "ttl_minutes": 240,
        "grant_id": grant["id"]})
    assert r.status_code == 200, r.text
    e = r.json()["elevation"]
    assert e["ticket"] == "ESC-8" and e["grantId"] == grant["id"] and e["patientRef"] == "MRN-400412"
    # The form asked for 240 minutes; the grant allows 15, and the grant wins.
    parse = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731
    assert parse(e["expiresAt"]) <= parse(grant["expiresAt"])
    client.delete("/api/v1/auth/elevate", headers=headers)


def test_the_seeded_active_grant_can_be_started_after_a_reset(client, auth):
    """The walk-through in ESAP-START-HERE: Start on R. Moravec's active grant."""
    from app.seed import load

    load()
    headers = auth("super_admin")
    seeded = next(g for g in db.docs("SELECT doc FROM break_glass") if g["status"] == "active")
    r = client.post("/api/v1/auth/elevate", headers=headers, json={
        "reason": seeded["reason"], "ticket": seeded["ticket"], "grant_id": seeded["id"]})
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/encounters", headers=headers).status_code == 200
    client.delete("/api/v1/auth/elevate", headers=headers)


# --- what the patient sent reaches the care team ------------------------------


def _linked_encounter() -> str:
    links = db.document("portal_links") or {}
    pid = next(iter(links))
    return db.connect().execute("SELECT id FROM encounters WHERE patient_id=?", (pid,)).fetchone()["id"]


def test_a_previsit_summary_reaches_the_care_team_and_the_patient_sees_who_read_it(client, auth):
    patient = auth("patient")
    sent = client.post("/api/v1/patient/previsit", headers=patient, json={
        "visit_with": "My care team", "questions": ["Can I drive?"],
        "changes_since_last": "Short of breath on the stairs."}).json()

    enc_id = _linked_encounter()
    resident = auth("resident")  # whole-hospital scope
    r = client.get(f"/api/v1/encounters/{enc_id}/patient-submissions", headers=resident)
    assert r.status_code == 200, r.text
    assert r.json()["portal_linked"] is True
    got = next(s for s in r.json()["submissions"] if s["id"] == sent["id"])
    assert got["changesSinceLast"] == "Short of breath on the stairs." and not got.get("seenAt")

    seen = client.post(f"/api/v1/encounters/{enc_id}/patient-submissions/{sent['id']}/seen", headers=resident)
    assert seen.status_code == 200 and seen.json()["seenBy"]
    # The first reader is kept.
    again = client.post(f"/api/v1/encounters/{enc_id}/patient-submissions/{sent['id']}/seen", headers=auth("physician"))
    assert again.status_code in {200, 403}
    mine = client.get("/api/v1/patient/submissions", headers=patient).json()["submissions"]
    assert next(s for s in mine if s["id"] == sent["id"])["seenBy"] == seen.json()["seenBy"]


def test_patient_submissions_are_scoped_and_never_scored(client, auth):
    enc_id = _linked_encounter()
    assert client.get(f"/api/v1/encounters/{enc_id}/patient-submissions",
                      headers=auth("patient")).status_code == 403
    assert client.get(f"/api/v1/encounters/{enc_id}/patient-submissions",
                      headers=auth("billing_admin")).status_code == 403
    # Nothing a patient sends creates an assessment.
    before = db.connect().execute("SELECT count(*) FROM assessments WHERE encounter_id=?", (enc_id,)).fetchone()[0]
    client.post("/api/v1/patient/intake", headers=auth("patient"), json={"describe": "Chest tightness"})
    after = db.connect().execute("SELECT count(*) FROM assessments WHERE encounter_id=?", (enc_id,)).fetchone()[0]
    assert before == after


def test_an_auditor_cannot_mark_a_patient_message_seen(client):
    auditor = _login(client, "leila.aziz@styves.example")
    sent = client.post("/api/v1/patient/previsit", headers=_login(client, "delia.salib@example.com"),
                       json={"visit_with": "My care team", "questions": ["x"]}).json()
    r = client.post(f"/api/v1/encounters/{_linked_encounter()}/patient-submissions/{sent['id']}/seen",
                    headers=auditor)
    assert r.status_code == 403


# --- the portal's care team comes from the encounters -------------------------


def test_care_team_is_the_people_on_the_patients_encounters(client, auth):
    team = client.get("/api/v1/patient/care-team", headers=auth("patient")).json()["care_team"]
    links = db.document("portal_links") or {}
    encs = [e for e in db.docs("SELECT doc FROM encounters") if e["patient"]["id"] in links]
    names = {m["name"] for m in team}
    for e in encs:
        assert e["attending"] in names and e["nurse"] in names
        assert f"{e['unitName']} team" in names
    assert sum(m["primary"] for m in team) == 1
    # Hospital staff appear only because an encounter names them.
    staff_on_list = [m for m in team if m["source"] == "external"]
    directory = {u["name"].split(",")[0].replace("Dr. ", "").lower() for u in db.docs("SELECT doc FROM users")}
    assert all(m["name"].split(",")[0].replace("Dr. ", "").lower() not in directory for m in staff_on_list)


def test_whoever_is_on_the_unit_team_can_read_what_the_patient_sends(client, auth):
    """The point of deriving it: the team the patient sees is the team that can read them."""
    enc_id = _linked_encounter()
    enc = db.one_doc("SELECT doc FROM encounters WHERE id=?", (enc_id,))
    member = next(u for u in db.docs("SELECT doc FROM users")
                  if enc["unitId"] in (u.get("unitIds") or []) and u["status"] == "active"
                  and u["roles"][0] in {"physician", "staff_nurse", "np_pa"})
    team = client.get("/api/v1/patient/care-team", headers=auth("patient")).json()["care_team"]
    assert f"{enc['unitName']} team" in {m["name"] for m in team}
    r = client.get(f"/api/v1/encounters/{enc_id}/patient-submissions", headers=_login(client, member["email"]))
    assert r.status_code == 200, r.text
