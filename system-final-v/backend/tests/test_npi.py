"""NPI verification on self-serve clinician signup (§10.7)."""

from __future__ import annotations

from app import db, npi

VALID_NPI = "1234567893"      # canonical CMS check-digit-valid example
INVALID_NPI = "1234567890"    # right shape, wrong check digit


def test_npi_checksum_unit():
    assert npi.luhn_valid(VALID_NPI) is True
    assert npi.luhn_valid(INVALID_NPI) is False
    assert npi.is_npi_shaped("123") is False
    assert npi.is_npi_shaped(VALID_NPI) is True


def _signup(client, email, licence):
    return client.post("/api/v1/auth/signup", json={
        "name": "Dr Test", "email": email, "password": "s3cretpwd!!", "role": "physician",
        "licence_number": licence,
    })


def test_signup_rejects_an_npi_with_a_bad_check_digit(client):
    r = _signup(client, "npi.bad@example.com", INVALID_NPI)
    assert r.status_code == 422, r.text


def test_signup_accepts_a_valid_npi_and_records_it(client):
    r = _signup(client, "npi.good@example.com", VALID_NPI)
    assert r.status_code == 201, r.text
    doc = db.one_doc("SELECT doc FROM users WHERE email=?", ("npi.good@example.com",))
    assert doc["npi"] == VALID_NPI
    assert doc["npiChecksumValid"] is True
    # Offline (registry not queried in tests): checksum-valid but not registry-verified.
    assert doc["npiVerified"] is False


def test_non_npi_licence_string_passes_through_unverified(client):
    r = _signup(client, "licence.only@example.com", "STATE-LIC-4471")
    assert r.status_code == 201, r.text
    doc = db.one_doc("SELECT doc FROM users WHERE email=?", ("licence.only@example.com",))
    assert doc["licenceNumber"] == "STATE-LIC-4471"
    assert doc["npi"] is None
