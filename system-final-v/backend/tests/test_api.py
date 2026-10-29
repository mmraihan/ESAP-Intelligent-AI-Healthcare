"""Contract and behaviour checks across the four surfaces."""

from __future__ import annotations

import copy


def test_health_and_readiness(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["model_mode"] == "stub"


def test_every_v1_route_requires_a_session(client):
    for path in ("/api/v1/encounters", "/api/v1/models", "/api/v1/schema/labs",
                 "/api/v1/admin/users", "/api/v1/ops/fleet", "/api/v1/patient/home"):
        r = client.get(path)
        assert r.status_code == 401, path
        assert r.json()["error"]["code"] == "UNAUTHENTICATED"


def test_login_failure_does_not_distinguish_unknown_from_wrong(client):
    unknown = client.post("/api/v1/auth/login",
                          json={"email": "nobody@example.com", "password": "x"})
    wrong = client.post("/api/v1/auth/login",
                        json={"email": "amara.okonkwo@styves.example", "password": "wrong"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]


def test_logout_revokes_immediately(client, auth):
    headers = auth("physician")
    assert client.get("/api/v1/auth/session", headers=headers).status_code == 200
    client.post("/api/v1/auth/logout", headers=headers)
    assert client.get("/api/v1/auth/session", headers=headers).status_code == 401


# --- request validation (API_CONTRACT §5) -----------------------------------


def test_only_age_and_sex_are_required(client, auth):
    r = client.post("/api/v1/assess", headers=auth("physician"),
                    json={"features": {"demographics": {"admission_age": 55, "is_female": 0}}})
    assert r.status_code == 200


def test_missing_demographics_is_422(client, auth):
    r = client.post("/api/v1/assess", headers=auth("physician"), json={"features": {}})
    assert r.status_code == 422


def test_unknown_field_is_rejected_not_ignored(client, auth, case):
    bad = copy.deepcopy(case)
    bad["features"]["vitals"]["heart_rate"] = 96
    assert client.post("/api/v1/assess", headers=auth("physician"), json=bad).status_code == 422


def test_out_of_range_vital_is_422(client, auth, case):
    bad = copy.deepcopy(case)
    bad["features"]["vitals"]["bp_sys"] = 420
    assert client.post("/api/v1/assess", headers=auth("physician"), json=bad).status_code == 422


def test_unknown_lab_itemid_is_422_never_silently_dropped(client, auth, case):
    bad = copy.deepcopy(case)
    bad["features"]["labs"]["99999999"] = 1.0
    r = client.post("/api/v1/assess", headers=auth("physician"), json=bad)
    assert r.status_code == 422
    assert "itemid" in str(r.json()["error"]["detail"]).lower()


def test_malformed_ccsr_is_422(client, auth, case):
    bad = copy.deepcopy(case)
    bad["features"]["prior_history"]["prior_ccsr"] = ["heart failure"]
    assert client.post("/api/v1/assess", headers=auth("physician"), json=bad).status_code == 422


def test_missing_data_is_never_an_error(client, auth):
    r = client.post("/api/v1/assess", headers=auth("physician"), json={
        "features": {"demographics": {"admission_age": 40, "is_female": 1},
                     "labs": {}, "vitals": {}, "prior_history": {"prior_ccsr": []}}})
    assert r.status_code == 200
    assert r.json()["feature_coverage"]["minimum_signal_met"] is False


def test_bad_frame_is_400_not_422(client, auth, case):
    r = client.post("/api/v1/predict/readmission?frame=xyz", headers=auth("physician"), json=case)
    assert r.status_code == 400


# --- assess response shape --------------------------------------------------


def test_assess_returns_all_five_models(client, auth, case):
    r = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    ids = {r[k]["model_id"] for k in ("differential", "mortality", "icu", "readmission", "los")}
    assert ids == {"M-01", "M-02", "M-03", "M-04", "M-05"}
    assert r["disclaimer"].startswith("Decision support only")
    assert r["schema_version"] == "1.0"


def test_stub_mode_is_declared_not_hidden(client, auth, case):
    r = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    for key in ("differential", "mortality", "icu", "readmission", "los"):
        assert r[key]["status"] == "stub"
        assert "stub" in r[key]["reason"].lower()


def test_assess_is_deterministic(client, auth, case):
    a = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    b = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    assert a["mortality"]["result"] == b["mortality"]["result"]
    assert a["differential"]["result"]["items"] == b["differential"]["result"]["items"]


def test_differential_is_ranked_and_labelled_as_concurrent(client, auth, case):
    d = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()["differential"]["result"]
    probs = [i["probability"] for i in d["items"]]
    assert probs == sorted(probs, reverse=True)
    assert d["label"] == "Likely concurrent conditions"
    assert d["fusion_status"] == "tower_a_only"
    assert d["towers_used"] == ["A"]
    assert d["unscored_ccsr_count"] > 0  # blind spots are reported, not hidden


def test_unmatched_meds_are_reported(client, auth, case):
    bad = copy.deepcopy(case)
    bad["features"]["meds"] = ["furosemide", "notarealdrug"]
    d = client.post("/api/v1/assess", headers=auth("physician"), json=bad).json()["differential"]["result"]
    assert d["unmatched_meds"] == ["notarealdrug"]


def test_explanations_reconstruct_the_score(client, auth, case):
    """The exact-linear self-check: contributions + intercept rebuild the logit."""
    r = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
    for key in ("mortality", "icu", "readmission", "los"):
        expl = r[key]["explanation"]
        assert expl["method"] == "exact-linear"
        assert expl["reconstruction_ok"] is True
        assert expl["top_contributors"]


def test_single_model_endpoints_return_one_outcome(client, auth, case):
    for path, model in (("differential", "M-01"), ("mortality", "M-02"), ("icu", "M-03"),
                        ("readmission", "M-04"), ("los", "M-05")):
        r = client.post(f"/api/v1/predict/{path}", headers=auth("physician"), json=case)
        assert r.status_code == 200
        assert r.json()["model_id"] == model


# --- worklist, acknowledge, release ----------------------------------------


def test_worklist_is_scoped_for_a_scoped_role(client, auth):
    r = client.get("/api/v1/encounters", headers=auth("physician")).json()
    assert r["scope"] == "scoped"
    assert r["count"] <= 34


def test_assess_updates_the_linked_encounter(client, auth, case):
    headers = auth("physician")
    enc_id = client.get("/api/v1/encounters", headers=headers).json()["encounters"][0]["id"]
    before = client.get(f"/api/v1/encounters/{enc_id}", headers=headers).json()

    linked = dict(case, encounter_id=enc_id)
    client.post("/api/v1/assess", headers=headers, json=linked)

    after = client.get(f"/api/v1/encounters/{enc_id}", headers=headers).json()
    assert after["state"] == "assessed"
    assert after["assessmentCount"] == before.get("assessmentCount", 0) + 1
    assert after["risks"]["mortality"] is not None
    history = client.get(f"/api/v1/encounters/{enc_id}/assessments", headers=headers).json()
    assert history["assessments"]


def test_resident_acknowledge_requires_cosign(client, auth):
    """`cosign` in the matrix is an access grade the server acts on, not a hint."""
    headers = auth("resident")
    encounters = client.get("/api/v1/encounters", headers=headers).json()["encounters"]
    target = next(e for e in encounters if e["state"] in {"assessed", "acknowledged", "awaiting_cosign"})
    r = client.post(f"/api/v1/encounters/{target['id']}/acknowledge", headers=headers, json={})
    assert r.status_code == 200
    assert r.json()["requires_cosign"] is True
    assert r.json()["encounter"]["state"] == "awaiting_cosign"


def test_release_withholds_the_raw_score(client, auth):
    headers = auth("physician")
    encounters = client.get("/api/v1/encounters", headers=headers).json()["encounters"]
    target = next(e for e in encounters if e["state"] in {"assessed", "acknowledged", "awaiting_cosign"})
    r = client.post(f"/api/v1/encounters/{target['id']}/release", headers=headers, json={
        "headline": "Your care team reviewed your admission assessment",
        "plain_language": "The team used a tool that compares your details with past stays.",
        "what_this_means": ["Your stay is expected to be a few days."],
        "questions_to_ask": ["What would let me go home sooner?"],
    })
    assert r.status_code == 201 or r.status_code == 200
    assert r.json()["rawScoreWithheld"] is True


def test_encounter_view_is_audited(client, auth):
    headers = auth("physician")
    enc_id = client.get("/api/v1/encounters", headers=headers).json()["encounters"][0]["id"]
    client.get(f"/api/v1/encounters/{enc_id}", headers=headers)
    events = client.get("/api/v1/admin/audit", headers=auth("privacy_officer")).json()["events"]
    assert any(e["action"] == "encounter.view" and enc_id in e["target"] for e in events)


# --- catalogs and registry --------------------------------------------------


def test_catalogs_are_served(client, auth):
    headers = auth("physician")
    assert client.get("/api/v1/schema/labs", headers=headers).json()["count"] > 0
    assert client.get("/api/v1/schema/ccsr", headers=headers).json()["count"] > 0
    assert client.get("/api/v1/schema/vocab/meds", headers=headers).json()["count"] > 0
    enums = client.get("/api/v1/schema/enums", headers=headers).json()
    assert "EW EMER." in enums["admission_type"]


def test_registry_reports_towers_b_and_c_as_stubs(client, auth):
    rows = client.get("/api/v1/models", headers=auth("physician")).json()
    by_id = {r["model_id"]: r for r in rows}
    for tower in ("M-01-towerB", "M-01-towerC", "M-01-fusion"):
        assert by_id[tower]["status"] == "stub"
        assert by_id[tower]["enabled"] is False


def test_registry_does_not_claim_a_stub_is_live(client, auth):
    rows = client.get("/api/v1/models", headers=auth("physician")).json()
    assert all(r["status"] != "live" for r in rows)


# --- ops and admin ----------------------------------------------------------


def test_ops_console_is_platform_only(client, auth):
    assert client.get("/api/v1/ops/fleet", headers=auth("tenant_owner")).status_code == 403
    assert client.get("/api/v1/ops/fleet", headers=auth("super_admin")).status_code == 200


def test_suspending_a_tenant_retains_data(client, auth):
    r = client.post("/api/v1/ops/tenants/t_calder/status", headers=auth("super_admin"), json={
        "status": "suspended", "reason": "Non-payment; contractual retention window applies."})
    assert r.status_code == 200
    assert r.json()["data_retained"] is True


def test_safety_features_are_not_gated_by_plan(client, auth):
    cfg = client.get("/api/v1/ops/config", headers=auth("super_admin")).json()
    assert cfg["safety_features_by_plan"] == {}


def test_invite_lifecycle(client, auth):
    headers = auth("tenant_owner")
    created = client.post("/api/v1/admin/invites", headers=headers, json={
        "email": "new.clinician@styves.example", "role": "physician",
        "scope": "Facility: Main Campus"}).json()
    token = created["acceptToken"]

    inspected = client.get(f"/api/v1/auth/invite/{token}").json()
    assert inspected["valid"] is True

    accepted = client.post("/api/v1/auth/invite/accept", json={
        "token": token, "name": "New Clinician", "password": "correct-horse-battery"})
    assert accepted.status_code == 200
    assert accepted.json()["user"]["role"] == "physician"

    # An accepted invite cannot be replayed into a second account.
    replay = client.post("/api/v1/auth/invite/accept", json={
        "token": token, "name": "Impostor", "password": "correct-horse-battery"})
    assert replay.status_code == 409


def test_billing_needs_the_billing_capability(client, auth):
    assert client.get("/api/v1/admin/billing", headers=auth("staff_nurse")).status_code == 403
    assert client.get("/api/v1/admin/billing", headers=auth("billing_admin")).status_code == 200


# --- patient portal ---------------------------------------------------------


def test_patient_can_revoke_a_share(client, auth):
    headers = auth("patient")
    consents = client.get("/api/v1/patient/sharing", headers=headers).json()["consents"]
    active = next(c for c in consents if c["status"] == "active")
    r = client.delete(f"/api/v1/patient/sharing/{active['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["consent"]["status"] == "revoked"
    assert "not recalled" in r.json()["note"]


def test_clinician_cannot_use_the_patient_portal(client, auth):
    assert client.get("/api/v1/patient/home", headers=auth("physician")).status_code == 403


def test_meta_requires_a_session(client, auth):
    """Every /v1 route requires auth (API_CONTRACT §1), including metadata.

    /meta names the serving mode and the caller's tenant. An unauthenticated
    probe should not learn which tenant a host serves or that it is running
    stub predictors. /healthz and /readyz stay open — those are for load
    balancers and say nothing about the deployment's contents.
    """
    assert client.get("/api/v1/meta").status_code == 401
    r = client.get("/api/v1/meta", headers=auth("physician"))
    assert r.status_code == 200
    assert r.json()["guarantees"]["audit_covariates_are_model_inputs"] is False
    assert r.json()["active_tenant_id"] == "t_yves"


def test_no_v1_route_is_unauthenticated(client):
    """Catch a future route added without the auth dependency.

    Enumerates the live route table rather than a hand-kept list, so the check
    cannot silently stop covering new endpoints.
    """
    from app.main import app

    exempt = {"/healthz", "/readyz", "/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}
    # Public by design: the invite-acceptance screen renders before any account
    # exists, and login/signup are how a session is obtained in the first place.
    exempt |= {"/api/v1/auth/login", "/api/v1/auth/signup",
               "/api/v1/auth/invite/{token}", "/api/v1/auth/invite/accept"}
    # A carer accepting a patient's family-access invite has no account yet, so
    # viewing and accepting the invite are reachable before any session exists.
    exempt |= {"/api/v1/auth/caregiver-invite/{token}", "/api/v1/auth/caregiver-accept"}
    # The second-factor step completes a login that has passed the password step;
    # like login itself it must be reachable without a session (it holds a signed,
    # short-lived MFA challenge instead).
    exempt |= {"/api/v1/auth/mfa/verify"}
    # SSO is a way to obtain a session, like login: discovery, the IdP callback,
    # and the dev-only simulated login are all reachable without a prior session.
    exempt |= {"/api/v1/auth/sso/discover", "/api/v1/auth/sso/callback",
               "/api/v1/auth/sso/dev-login"}
    # Someone who has lost their password has no session to present. It answers
    # identically for known and unknown addresses (test_workspace.py).
    exempt |= {"/api/v1/auth/password/forgot"}
    # The public website's model evidence and plans: no patient, tenant or usage data.
    exempt |= {"/api/v1/public/evidence", "/api/v1/public/demo-accounts"}
    # The early-access form: someone joining the waitlist has no account. It
    # stores contact details only and is rate-limited (test_waitlist_support.py).
    exempt |= {"/api/v1/public/waitlist"}
    # Polar's payment webhook has no session; it is authenticated by its
    # Standard Webhooks signature instead (test_billing.py).
    exempt |= {"/api/v1/polar/webhook"}

    unguarded = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/v1") or path in exempt:
            continue
        for method in sorted(getattr(route, "methods", set()) - {"HEAD", "OPTIONS"}):
            probe = path.replace("{encounter_id}", "enc_1000").replace("{model_id}", "M-01")
            probe = probe.replace("{tenant_id}", "t_yves").replace("{user_id}", "u_x")
            probe = probe.replace("{invite_id}", "i1").replace("{grant_id}", "bg1")
            probe = probe.replace("{consent_id}", "c1").replace("{transfer_id}", "tr1")
            probe = probe.replace("{hadm_id}", "1").replace("{token}", "t")
            response = client.request(method, probe, json={} if method == "POST" else None)
            if response.status_code != 401:
                unguarded.append(f"{method} {path} -> {response.status_code}")
    assert not unguarded, f"reachable without a session: {unguarded}"
