"""The non-negotiable guardrails, as executable checks.

Each test here corresponds to a rule that invalidates the work if broken
(CLAUDE.md §6, API_CONTRACT §3.1, PRODUCT_BLUEPRINT §4.6 / §13.6). They are
deliberately blunt: if one of these fails, the right response is to stop, not
to adjust the assertion.
"""

from __future__ import annotations

import copy


# --- guardrail 4: audit covariates are never model inputs -------------------


def test_audit_covariates_cannot_be_smuggled_into_features(client, auth, case):
    """race/insurance/marital_status inside `features` must be a 422.

    They live on a sibling object precisely so the schema can refuse this.
    """
    bad = copy.deepcopy(case)
    bad["features"]["race"] = "White"
    r = client.post("/api/v1/assess", headers=auth("physician"), json=bad)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_audit_covariates_do_not_change_any_prediction(client, auth, case):
    """Two cases differing only in covariates must score identically."""
    a = copy.deepcopy(case)
    a["audit_covariates"] = {"race": "White", "insurance": "Private", "marital_status": "Married"}
    b = copy.deepcopy(case)
    b["audit_covariates"] = {"race": "Black/African American", "insurance": "Medicaid",
                             "marital_status": "Single"}
    ra = client.post("/api/v1/assess", headers=auth("physician"), json=a).json()
    rb = client.post("/api/v1/assess", headers=auth("physician"), json=b).json()
    for model in ("mortality", "icu", "readmission", "los", "differential"):
        assert ra[model]["result"] == rb[model]["result"], f"{model} moved with an audit covariate"


def test_covariates_absent_from_clinical_responses(client, auth, case):
    body = client.post("/api/v1/assess", headers=auth("physician"), json=case).text.lower()
    for leaked in ("medicare", "widowed", '"race"'):
        assert leaked not in body


# --- API_CONTRACT §3.1: calibration hard-suppress ---------------------------


def test_reduced_calibration_suppresses_every_differential_badge(client, auth):
    """An imputed dense feature forces calibrated=False on every M-01 row."""
    sparse = {"features": {"demographics": {"admission_age": 61, "is_female": 1}}}
    r = client.post("/api/v1/assess", headers=auth("physician"), json=sparse).json()
    assert r["feature_coverage"]["calibration_validity"] == "reduced"
    items = r["differential"]["result"]["items"]
    assert items and all(i["calibrated"] is False for i in items)
    assert any("calibration_validity=reduced" in w for w in r["warnings"])


def test_reduced_calibration_does_not_suppress_risk_models(client, auth):
    """M-02..M-05 keep native missingness; §3.1 is M-01-specific."""
    sparse = {"features": {"demographics": {"admission_age": 61, "is_female": 1}}}
    r = client.post("/api/v1/assess", headers=auth("physician"), json=sparse).json()
    assert r["mortality"]["result"]["calibrated"] is True
    assert r["icu"]["result"]["calibrated"] is True


def test_los_never_badges_a_flat_calibrated_interval(client, auth, case):
    los = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()["los"]["result"]
    assert los["tail_coverage_reduced"] is True
    assert los["low_signal"] is True
    assert los["interval_low"] <= los["point_days"] <= los["interval_high"]
    # Asymmetric: the upper margin is what covers the long-stay tail.
    assert (los["interval_high"] - los["point_days"]) > (los["point_days"] - los["interval_low"])


# --- guardrail 1: everything is cut at t0 -----------------------------------


def test_discharge_frame_is_refused_on_an_intake_case(client, auth, case):
    """Post-t0 fields cannot be guessed — that would be the time-travel bug."""
    r = client.post("/api/v1/assess?frame=discharge", headers=auth("physician"), json=case)
    assert r.status_code == 400
    assert "discharge" in r.json()["error"]["message"].lower()


# --- §13.6: a patient never sees a raw score --------------------------------


def test_patient_results_contain_no_probability(client, auth):
    r = client.get("/api/v1/patient/results", headers=auth("patient"))
    assert r.status_code == 200
    payload = r.json()
    assert payload["raw_scores_withheld"] is True
    for released in payload["released"]:
        assert released["rawScoreWithheld"] is True
        blob = str(released).lower()
        for banned in ("probability", "auroc", "percentile", "interval_high"):
            assert banned not in blob


def test_patient_cannot_read_the_worklist(client, auth):
    r = client.get("/api/v1/encounters", headers=auth("patient"))
    # A patient has no roster: either the capability is absent, or the scope is
    # their own record. It must never be the ward list.
    if r.status_code == 200:
        assert r.json()["count"] == 0
    else:
        assert r.status_code == 403


# --- §4.6 / §4.8: graded access and break-glass -----------------------------


def test_platform_staff_have_no_standing_patient_access(client, auth):
    """super_admin's patient:read is break-glass, not full."""
    r = client.get("/api/v1/encounters", headers=auth("super_admin"))
    assert r.status_code == 403
    assert r.json()["error"]["detail"]["requires"] == "elevation"


def test_break_glass_requires_a_reason_and_a_ticket(client, auth):
    r = client.post("/api/v1/auth/elevate", headers=auth("super_admin"),
                    json={"reason": "short", "ticket": ""})
    assert r.status_code == 422


def test_elevation_unlocks_then_is_audited(client, auth):
    headers = auth("super_admin")
    r = client.post("/api/v1/auth/elevate", headers=headers, json={
        "reason": "Support escalation ESC-0001: clinician reports a wrong-patient banner.",
        "ticket": "ESC-0001", "ttl_minutes": 15,
    })
    assert r.status_code == 200
    assert client.get("/api/v1/encounters", headers=headers).status_code == 200

    audit = client.get("/api/v1/ops/audit", headers=headers).json()["events"]
    invoked = [e for e in audit if e["action"] == "break_glass.invoke"]
    assert invoked and all(e.get("reason") for e in invoked)

    client.delete("/api/v1/auth/elevate", headers=headers)
    assert client.get("/api/v1/encounters", headers=headers).status_code == 403


def test_break_glass_cannot_be_self_approved(client, auth):
    headers = auth("super_admin")
    grant = client.post("/api/v1/ops/break-glass", headers=headers, json={
        "tenant_id": "t_yves", "patient_ref": "MRN-400411",
        "reason": "Investigating a reported wrong-patient banner for one named patient.",
        "ticket": "ESC-9001", "ttl_minutes": 15,
    }).json()
    assert grant["status"] == "pending_approval"
    r = client.post(f"/api/v1/ops/break-glass/{grant['id']}/approve", headers=headers)
    assert r.status_code == 403


def test_tenant_admin_cannot_reach_another_tenant(client, auth):
    r = client.get("/api/v1/admin/users?tenant_id=t_northgate", headers=auth("tenant_owner"))
    assert r.status_code == 403


def test_tenant_admin_cannot_grant_a_platform_role(client, auth):
    users = client.get("/api/v1/admin/users", headers=auth("tenant_owner")).json()["users"]
    target = users[0]["id"]
    r = client.post(f"/api/v1/admin/users/{target}/roles", headers=auth("tenant_owner"),
                    json={"roles": ["super_admin"], "reason": "attempted escalation"})
    assert r.status_code == 403


def test_signup_cannot_self_assign_an_admin_role(client):
    r = client.post("/api/v1/auth/signup", json={
        "name": "Escalation Test", "email": "escalate@example.com",
        "password": "correct-horse-battery", "role": "tenant_owner",
    })
    assert r.status_code == 403


def test_fairness_needs_the_audit_capability(client, auth):
    assert client.get("/api/v1/admin/fairness", headers=auth("physician")).status_code == 403
    r = client.get("/api/v1/admin/fairness", headers=auth("privacy_officer"))
    assert r.status_code == 200
    assert r.json()["covariates_are_model_inputs"] is False


# --- §4: unconfirmed extraction never becomes a silent prediction -----------


def test_assess_from_text_is_blocked_until_confirmed(client, auth):
    r = client.post("/api/v1/assess/from-text", headers=auth("physician"),
                    json={"text": "78f sob and swollen ankles, diabetic", "confirmed": False})
    assert r.status_code == 200
    assert r.json()["assessment"] is None
    assert r.json()["blocked_reason"]


def test_unconfirmed_history_taints_the_differential(client, auth, case):
    tainted = copy.deepcopy(case)
    tainted["provenance"] = {"source": "chat", "field_confidence": {},
                             "needs_confirmation": ["prior_history.prior_ccsr[0]"]}
    r = client.post("/api/v1/assess", headers=auth("physician"), json=tainted).json()
    items = r["differential"]["result"]["items"]
    assert all(i["from_unconfirmed_extraction"] for i in items)


# --- the bootstrap payload is the whole client's view, so it is a boundary ---


def test_patient_bootstrap_carries_only_their_own_record(client, auth):
    """A patient's scoped capabilities mean "mine", not "the hospital's".

    patient:read, billing:view and transfer:initiate all sit at `scoped` grade
    for a patient. Treated as plain capability checks they would hand over the
    staff directory, the hospital's invoices and other patients' transfers.
    """
    payload = client.get("/api/v1/bootstrap", headers=auth("patient")).json()
    for staff_only in ("users", "invites", "facilities", "transfers", "invoices",
                       "audit_events", "platform_audit", "break_glass", "encounters",
                       "subgroup_fairness"):
        assert payload[staff_only] == [], f"patient bootstrap leaked {staff_only}"
    # What they should have: their own record.
    assert payload["released_results"] and payload["consents"] and payload["care_team"]


def test_platform_bootstrap_has_no_patients_without_elevation(client, auth):
    payload = client.get("/api/v1/bootstrap", headers=auth("super_admin")).json()
    assert payload["encounters"] == []


def test_clinician_bootstrap_has_no_portal_or_fairness_data(client, auth):
    payload = client.get("/api/v1/bootstrap", headers=auth("physician")).json()
    for forbidden in ("released_results", "consents", "care_team", "records",
                      "subgroup_fairness", "platform_audit", "invoices"):
        assert payload[forbidden] == [], f"clinician bootstrap leaked {forbidden}"
