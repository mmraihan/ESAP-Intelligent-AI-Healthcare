"""Test fixtures — a throwaway database per session, seeded from seed.json."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TMP = Path(tempfile.mkdtemp(prefix="esap-test-"))
os.environ["ESAP_DB_PATH"] = str(TMP / "test.db")
os.environ["MODEL_MODE"] = "stub"
os.environ["ESAP_SECRET"] = "test-secret-not-a-real-key"

from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEMO_PASSWORD, load  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded():
    db.init_schema()
    load()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def _token(client: TestClient, email: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth(client):
    """auth("physician") -> headers for that demo role."""
    emails = {
        "physician": "amara.okonkwo@styves.example",
        "resident": "tobias.lindqvist@styves.example",
        "staff_nurse": "lucas.beaulieu@styves.example",
        "tenant_owner": "mira.novak@styves.example",
        "privacy_officer": "sanne.devries@styves.example",
        "billing_admin": "hugo.ferreira@styves.example",
        "super_admin": "rmoravec@esap.health",
        "patient": "delia.salib@example.com",
        "pharmacist": "ezra.stein@styves.example",
    }

    def _auth(role: str) -> dict:
        return {"Authorization": f"Bearer {_token(client, emails[role])}"}

    return _auth


@pytest.fixture
def case():
    """A complete, well-formed intake case."""
    return {
        "features": {
            "demographics": {"admission_age": 74, "is_female": 1},
            "admission_context": {"via_ed": 1, "admission_type": "EW EMER."},
            "vitals": {"bp_sys": 104, "bp_dia": 62, "bmi": 24.0},
            "labs": {"50912": 1.6, "51301": 13.0, "50813": 2.4, "51222": 10.2, "50983": 134},
            "prior_history": {"prior_ccsr": ["CIR019"], "n_prior_admissions": 2, "charlson_index": 5},
            "meds": ["furosemide", "metoprolol"],
        },
        "audit_covariates": {"race": "Asian", "insurance": "Medicare", "marital_status": "Widowed"},
    }
