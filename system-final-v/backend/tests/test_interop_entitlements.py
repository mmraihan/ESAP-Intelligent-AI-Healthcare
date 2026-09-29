"""Plan entitlements (§17) and the MPI + consent gate on cross-hospital transfer (§7)."""

from __future__ import annotations

from app import entitlements


# --- entitlements map --------------------------------------------------------

def test_seeded_tenant_plans_map_to_capabilities():
    # St. Yves is enterprise: every model, TEFCA reach.
    assert entitlements.models_allowed("t_yves") == entitlements.ALL_MODELS
    assert entitlements.interop_level("t_yves") == entitlements.INTEROP_TEFCA
    # The individual/self-serve tenant is "pro": all models, but no cross-org transfer.
    assert entitlements.interop_level("t_solo") == entitlements.INTEROP_NONE
    # An unknown tenant falls back to the safe hospital default, never "everything".
    assert entitlements.interop_level("t_does_not_exist") == entitlements.INTEROP_ESAP


def test_free_tier_excludes_the_differential():
    # The map is the enforcement source; M-01 is a paid capability.
    assert "M-01" not in entitlements._TIERS["free"]["models"]
    assert "M-01" in entitlements._TIERS["pro"]["models"]


# --- transfer: MPI + consent -------------------------------------------------

def test_weak_identifiers_go_to_mpi_review(client, auth):
    r = client.post("/api/v1/admin/interop", headers=auth("physician"),
                    json={"mrn": "5", "patient_display": "John", "counterparty": "Mercy External"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["state"] == "mpi_review"
    assert body["mpiScore"] < 0.92


def test_strong_identifiers_are_ready_to_approve(client, auth):
    r = client.post("/api/v1/admin/interop", headers=auth("physician"),
                    json={"mrn": "MRN-778812", "patient_display": "Jonas de Vries 1961",
                          "counterparty": "Mercy External EHR"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["state"] == "requested"
    assert body["mpiScore"] >= 0.92


def test_transfer_requires_a_consent_basis(client, auth):
    r = client.post("/api/v1/admin/interop", headers=auth("physician"),
                    json={"mrn": "X1", "patient_display": "A B", "counterparty": "Y", "consent_basis": ""})
    assert r.status_code == 422


def test_esap_counterparty_uses_the_fast_path(client, auth):
    r = client.post("/api/v1/admin/interop", headers=auth("physician"),
                    json={"mrn": "MRN-99", "patient_display": "Test Patient 1970",
                          "counterparty": "Northgate General"})
    assert r.status_code == 201, r.text
    assert r.json()["path"] == "esap_fast_path"


def test_approve_is_blocked_without_a_consent_basis(client, auth):
    """A transfer whose consent basis was cleared cannot be approved."""
    r = client.post("/api/v1/admin/interop", headers=auth("physician"),
                    json={"mrn": "MRN-55", "patient_display": "Consent Test 1980",
                          "counterparty": "Mercy External"})
    tid = r.json()["id"]
    # Simulate a record with no consent basis reaching the queue.
    from app import db
    db.patch_doc("transfers", tid, {"consentBasis": ""}, {})
    # tenant_owner holds transfer:approve (physician only has transfer:initiate).
    approve = client.post(f"/api/v1/admin/interop/{tid}/approve", headers=auth("tenant_owner"),
                          json={"reason": "clinically needed for admission"})
    assert approve.status_code == 422
