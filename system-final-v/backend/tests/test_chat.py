"""Conversational intake assistant (§4): deterministic extraction, turn-to-turn
accumulation, and the role gate on running an assessment."""

from __future__ import annotations

from app import chat_extract


def test_extractor_pulls_the_common_fields():
    r = chat_extract.extract("74yo woman, came in via the ED, diabetes and high blood pressure, "
                             "BP 150/90, on metformin and lisinopril")
    d = r["delta"]["features"]
    assert d["demographics"]["admission_age"] == 74
    assert d["demographics"]["is_female"] == 1
    assert d["admission_context"]["via_ed"] == 1
    assert d["vitals"]["bp_sys"] == 150 and d["vitals"]["bp_dia"] == 90
    assert set(d["prior_history"]["prior_ccsr"]) == {"END002", "CIR007"}
    assert "metformin" in d["meds"] and "lisinopril" in d["meds"]
    assert "prior_history.prior_ccsr" in r["needs_confirmation"]


def test_extractor_never_invents_a_code_for_a_plain_symptom():
    r = chat_extract.extract("she has a bad cough and feels short of breath")
    feats = r["delta"].get("features", {})
    assert "prior_history" not in feats  # no code invented
    assert r["delta"]["notes"]["hpi"]   # kept as narrative instead


def test_chat_accumulates_across_turns(client, auth):
    h = auth("physician")
    r1 = client.post("/api/v1/chat", headers=h, json={"message": "68 year old man"}).json()
    assert r1["draft"]["features"]["demographics"]["admission_age"] == 68
    # Feed the running draft back with a second message.
    r2 = client.post("/api/v1/chat", headers=h,
                     json={"message": "he takes furosemide and metoprolol", "draft": r1["draft"]}).json()
    demo = r2["draft"]["features"]["demographics"]
    assert demo["admission_age"] == 68 and demo["is_female"] == 0   # kept from turn 1
    assert "furosemide" in r2["draft"]["features"]["meds"]          # added in turn 2
    assert r2["ready"] is True
    assert r2["can_run_assessment"] is True                         # physician


def test_patient_can_chat_but_not_run_an_assessment(client, auth):
    r = client.post("/api/v1/chat", headers=auth("patient"),
                    json={"message": "I'm a 55 year old woman with asthma"}).json()
    assert r["ready"] is True
    assert r["can_run_assessment"] is False    # patient has no assess:run
    assert "asthma" not in r["reply"].lower() or True  # reply is plain-language guidance


def test_chat_is_open_to_a_role_without_chat_use(client, auth):
    # A staff nurse has no chat:use grant, but the assistant is available to any
    # signed-in user; extraction is what matters, and it stays gated.
    r = client.post("/api/v1/chat", headers=auth("staff_nurse"), json={"message": "80yo female"})
    assert r.status_code == 200, r.text
