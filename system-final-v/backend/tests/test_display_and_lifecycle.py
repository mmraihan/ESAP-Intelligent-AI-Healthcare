"""Per-tenant model-display enforcement (§18.2) and the encounter close/co-sign
lifecycle (§4.6/§8.4) — the two gaps closed after the blueprint review."""

from __future__ import annotations


def _set_model_display(client, auth, patch):
    r = client.put("/api/v1/settings/model_display", headers=auth("tenant_owner"),
                   json={"patch": patch, "reason": "test"})
    assert r.status_code == 200, r.text


# --- model display policy ----------------------------------------------------

def test_differential_capped_to_policy_top_n(client, auth, case):
    """differentialTopN caps the list even when the caller asks for more."""
    try:
        _set_model_display(client, auth, {"differentialTopN": 3})
        r = client.post("/api/v1/assess?top_n=25", headers=auth("physician"), json=case).json()
        items = r["differential"]["result"]["items"]
        assert len(items) <= 3
        assert r["differential"]["result"]["top_n"] <= 3
    finally:
        _set_model_display(client, auth, {"differentialTopN": 20})


def test_disabled_model_is_suppressed_not_scored(client, auth, case):
    """Turning a model off for the tenant withholds its gauge from /assess."""
    try:
        _set_model_display(client, auth, {"enabled": {"M-02": False}})
        r = client.post("/api/v1/assess", headers=auth("physician"), json=case).json()
        assert r["mortality"]["status"] == "suppressed"
        assert r["mortality"]["result"] is None
        # A model left on is unaffected.
        assert r["icu"]["status"] != "suppressed"
    finally:
        _set_model_display(client, auth, {"enabled": {"M-02": True}})


def test_suppressed_ccsr_category_never_reaches_the_differential(client, auth, case):
    """A CCSR code on the tenant's suppression list is filtered out of M-01,
    and the drop is folded into the unscored tally rather than hidden."""
    r0 = client.post("/api/v1/assess?top_n=50", headers=auth("physician"), json=case).json()
    items0 = r0["differential"]["result"]["items"]
    assert items0, "need at least one scored item to exercise suppression"
    victim = items0[0]["ccsr"]
    unscored0 = r0["differential"]["result"]["unscored_ccsr_count"]
    try:
        _set_model_display(client, auth, {"suppressedCategories": [{"ccsr": victim, "name": "x", "why": "test"}]})
        r1 = client.post("/api/v1/assess?top_n=50", headers=auth("physician"), json=case).json()
        codes = [i["ccsr"] for i in r1["differential"]["result"]["items"]]
        assert victim not in codes
        # Dropping a scored row must not shrink the unscored tally (a dropped row
        # is never silently read as "ruled out").
        assert r1["differential"]["result"]["unscored_ccsr_count"] >= unscored0
    finally:
        # Restore the seed defaults (the two ethics-committee codes).
        _set_model_display(client, auth, {"suppressedCategories": [
            {"ccsr": "MBD002", "name": "Depressive disorders", "why": "ethics committee"},
            {"ccsr": "MBD012", "name": "Substance-related disorders", "why": "site policy"},
        ]})


# --- encounter close / discharge --------------------------------------------

def _an_encounter(client, auth):
    r = client.get("/api/v1/encounters", headers=auth("physician")).json()
    rows = [e for e in r["encounters"] if e["state"] != "closed"]
    assert rows, "seed should have at least one open encounter in scope"
    return rows[0]["id"]


def test_close_encounter_transitions_and_rejects_double_close(client, auth, case):
    eid = _an_encounter(client, auth)
    scored = {**case, "encounter_id": eid}
    client.post("/api/v1/assess", headers=auth("physician"), json=scored)  # -> assessed

    r = client.post(f"/api/v1/encounters/{eid}/close", headers=auth("physician"),
                    json={"note": "home, stable", "discharge_location": "Home"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["encounter"]["state"] == "closed"
    assert body["encounter"]["dischargeLocation"] == "Home"

    again = client.post(f"/api/v1/encounters/{eid}/close", headers=auth("physician"), json={})
    assert again.status_code == 409


def test_resident_cannot_close_an_encounter_awaiting_cosign(client, auth, case):
    """When a resident's acknowledgement is awaiting an attending co-sign, the
    resident cannot supply that co-sign by closing the encounter."""
    eid = _an_encounter(client, auth)
    scored = {**case, "encounter_id": eid}
    client.post("/api/v1/assess", headers=auth("resident"), json=scored)
    ack = client.post(f"/api/v1/encounters/{eid}/acknowledge", headers=auth("resident"), json={})
    # Only meaningful if this tenant requires resident co-sign (seed default: yes).
    if ack.json().get("requires_cosign"):
        r = client.post(f"/api/v1/encounters/{eid}/close", headers=auth("resident"), json={})
        assert r.status_code == 403
        # The attending can close it, which records the co-sign.
        r2 = client.post(f"/api/v1/encounters/{eid}/close", headers=auth("physician"), json={})
        assert r2.status_code == 200, r2.text
        assert r2.json()["cosigned"] is True
