"""Regressions for the pilot-blocking QA findings (issues 4, 5, 6, 19, 20)."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest

from app import db, red_flags, seed

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"
QA_MESSAGE = ("QA synthetic test: I am 55 and have chest pain and my left arm hurts. "
              "Am I having a heart attack? What is my risk score?")


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _solo(client, role: str = "physician", name: str = "Solo Doctor") -> dict:
    r = client.post("/api/v1/auth/signup", json={
        "name": name, "email": f"solo.{uuid.uuid4().hex[:8]}@example.com",
        "password": "correct-horse-1", "role": role,
    })
    assert r.status_code == 201, r.text
    return _h(r.json()["token"])


def _admit(client, headers: dict, mrn: str):
    return client.post("/api/v1/encounters", headers=headers, json={
        "mrn": mrn, "name": "Synthetic Patient", "age": 68, "sex": "M", "unit_id": "u_solo",
    })


# --- Issue 19: red flags ----------------------------------------------------


@pytest.mark.parametrize("text,label", [
    ("I have chest pain", "Chest pain"),
    ("my chest hurts", "Chest pain"),
    ("I’m having a heart attack", "Chest pain"),
    ("I can't breathe properly", "Trouble breathing"),
    ("I've been short of breath for three days", "Trouble breathing"),
    ("my face is drooping", "Possible stroke signs"),
    ("sudden weakness in my leg", "Possible stroke signs"),
    ("my speech is slurred", "Possible stroke signs"),
    ("أشعر بألم في الصدر", "Chest pain"),
    ("عندي ضيق في التنفس", "Trouble breathing"),
    ("أخشى أن تكون جلطة", "Possible stroke signs"),
])
def test_red_flags_are_detected(text, label):
    assert label in red_flags.screen(text)


@pytest.mark.parametrize("text", [
    "I have a cough and feel tired",
    "my left arm hurts",            # an associated symptom never triggers alone
    "I have no chest pain",
    "without any shortness of breath",
    "ليس لدي ألم في الصدر",
])
def test_ordinary_messages_do_not_alarm(text):
    assert red_flags.screen(text) == []


def test_a_negation_does_not_hide_a_second_symptom():
    assert red_flags.screen("no chest pain but I can't breathe") == ["Trouble breathing"]


def test_the_qa_message_gets_the_emergency_reply_and_its_symptoms_are_captured(client, auth):
    r = client.post("/api/v1/chat", headers=auth("patient"), json={"message": QA_MESSAGE}).json()
    assert r["emergency"] is True
    assert "997" in r["reply"] and red_flags.EMERGENCY_MESSAGE in r["reply"]
    assert "could you tell me" not in r["reply"].lower()
    assert {"Age 55", "Chest pain", "Arm pain"} <= set(r["captured"])
    assert "chest pain" in r["draft"]["notes"]["hpi"]
    assert r["can_run_assessment"] is False


def test_the_emergency_reply_follows_the_patients_language(client, auth):
    h = auth("patient")
    typed = client.post("/api/v1/chat", headers=h, json={"message": "أشعر بألم في الصدر"}).json()
    assert typed["reply"].startswith(red_flags.EMERGENCY_MESSAGE_AR)
    chosen = client.post("/api/v1/chat", headers=h, json={"message": "chest pain", "lang": "ar"}).json()
    assert chosen["reply"].startswith(red_flags.EMERGENCY_MESSAGE_AR)


def test_a_later_red_flag_keeps_the_earlier_history(client, auth):
    h = auth("patient")
    first = client.post("/api/v1/chat", headers=h, json={"message": "I feel tired"}).json()
    second = client.post("/api/v1/chat", headers=h,
                         json={"message": "now I have chest pain", "draft": first["draft"]}).json()
    assert "I feel tired" in second["draft"]["notes"]["hpi"]
    assert "now I have chest pain" in second["draft"]["notes"]["hpi"]


def test_clinician_chat_is_not_screened(client, auth):
    r = client.post("/api/v1/chat", headers=auth("physician"), json={"message": "68M with chest pain"}).json()
    assert r["emergency"] is False
    assert "997" not in r["reply"]


def test_chat_and_form_use_the_same_emergency_wording():
    form = (FRONTEND / "apps/patient/PatientIntake.tsx").read_text(encoding="utf-8").replace("**", "")
    assert red_flags.EMERGENCY_MESSAGE in form
    arabic = (FRONTEND / "i18n/ar.ts").read_text(encoding="utf-8").replace("**", "")
    assert red_flags.EMERGENCY_MESSAGE_AR in arabic


def test_a_red_flag_typed_only_as_free_text_reaches_the_form(client, auth):
    h = auth("patient")
    assert client.post("/api/v1/patient/intake", headers=h,
                       json={"describe": "my chest hurts"}).json()["emergency"] is True
    assert client.post("/api/v1/patient/intake", headers=h,
                       json={"describe": "a mild cough"}).json()["emergency"] is False


# --- Issue 20: no pre-set answers -------------------------------------------


def test_skipped_answers_stay_unanswered(client, auth):
    doc = client.post("/api/v1/patient/intake", headers=auth("patient"),
                      json={"describe": "Bothering me: Cough"}).json()
    assert doc["since"] is None and doc["gettingWorse"] is None and doc["hadBefore"] is None


def test_had_before_only_accepts_the_form_values(client, auth):
    r = client.post("/api/v1/patient/intake", headers=auth("patient"),
                    json={"describe": "Cough", "had_before": "maybe"})
    assert r.status_code == 422


# --- Issue 4: placeholder models --------------------------------------------


def test_a_stub_never_reports_calibrated_true(client, auth, case):
    r = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    assert '"calibrated": true' not in json.dumps(r)
    assert all(r[k]["status"] == "stub" for k in ("mortality", "icu", "readmission", "los", "differential"))


def test_results_saved_before_the_fix_are_corrected():
    conn = db.connect()
    row = conn.execute("SELECT id, encounter_id, response FROM assessments LIMIT 1").fetchone()
    stale = row["response"].replace('"calibrated":false', '"calibrated":true')
    assert stale != row["response"]
    conn.execute("UPDATE assessments SET response=? WHERE id=?", (stale, row["id"]))
    conn.execute("DELETE FROM assessments WHERE encounter_id=? AND id<>?", (row["encounter_id"], row["id"]))
    db.patch_doc("encounters", row["encounter_id"], {"calibrated": True})
    conn.commit()

    seed.retire_stub_calibration()

    fixed = conn.execute("SELECT response FROM assessments WHERE id=?", (row["id"],)).fetchone()["response"]
    assert '"calibrated":true' not in fixed
    assert db.one_doc("SELECT doc FROM encounters WHERE id=?", (row["encounter_id"],))["calibrated"] is False


def test_an_encounter_with_no_assessment_is_not_marked_calibrated():
    assessed = {r["encounter_id"] for r in db.connect().execute("SELECT encounter_id FROM assessments").fetchall()}
    never = [e for e in db.docs("SELECT doc FROM encounters") if e["id"] not in assessed]
    assert never and all(e["calibrated"] is False for e in never)


def test_bootstrap_says_when_models_are_placeholders(client, auth):
    assert client.get("/api/v1/bootstrap", headers=auth("physician")).json()["model_mode"] == "stub"


# --- Issue 5: solo clinicians can admit -------------------------------------


def test_a_solo_clinician_has_a_default_unit_and_can_admit(client):
    h = _solo(client)
    units = [u for f in client.get("/api/v1/bootstrap", headers=h).json()["facilities"] for u in f["units"]]
    assert [u["id"] for u in units] == ["u_solo"]
    assert _admit(client, h, "SOLO-1").status_code == 201
    assert [e["patient"]["mrn"] for e in client.get("/api/v1/bootstrap", headers=h).json()["encounters"]] == ["SOLO-1"]


def test_ensure_solo_unit_is_idempotent():
    seed.ensure_solo_unit()
    seed.ensure_solo_unit()
    assert len(db.docs("SELECT doc FROM facilities WHERE tenant_id='t_solo'")) == 1


def test_solo_practices_cannot_see_each_others_patients(client):
    # Identical names on purpose: the older scope rule matched on name.
    a, b = _solo(client, name="Same Name"), _solo(client, name="Same Name")
    mrn = f"PRIV-{uuid.uuid4().hex[:6]}"
    enc = _admit(client, a, mrn).json()
    assert client.get("/api/v1/bootstrap", headers=b).json()["encounters"] == []
    assert client.get(f"/api/v1/encounters/{enc['id']}", headers=b).status_code in {403, 404}
    # The same MRN at another practice is a different patient, not a conflict.
    assert _admit(client, b, mrn).status_code == 201
    assert _admit(client, a, mrn).status_code == 409


def test_a_solo_resident_is_scoped_too(client):
    other = _solo(client)
    _admit(client, other, f"RES-{uuid.uuid4().hex[:6]}")
    assert client.get("/api/v1/bootstrap", headers=_solo(client, role="resident")).json()["encounters"] == []


# --- Issue 6: directory minimisation ----------------------------------------


@pytest.mark.parametrize("role", ["physician", "staff_nurse", "pharmacist"])
def test_non_admins_get_only_their_own_directory_row(client, auth, role):
    data = client.get("/api/v1/bootstrap", headers=auth(role)).json()
    assert len(data["users"]) == 1
    assert list(data["demo_identity"]) == [role]


def test_a_solo_clinician_cannot_list_other_signups(client):
    _solo(client, name="Someone Else")
    assert len(client.get("/api/v1/bootstrap", headers=_solo(client)).json()["users"]) == 1


def test_admins_keep_the_directory(client, auth):
    assert len(client.get("/api/v1/bootstrap", headers=auth("tenant_owner")).json()["users"]) > 1


def test_the_demo_role_page_keeps_every_clinical_and_patient_account(client):
    # Directory minimisation must not empty the picker. Hospital admin roles
    # are left out; the super admin is listed as private (own password).
    accounts = client.get("/api/v1/public/demo-accounts").json()["accounts"]
    assert {"physician", "resident", "charge_nurse", "staff_nurse", "case_manager", "patient", "super_admin"} <= set(accounts)
    assert "tenant_owner" not in accounts and accounts["super_admin"]["private"] is True
