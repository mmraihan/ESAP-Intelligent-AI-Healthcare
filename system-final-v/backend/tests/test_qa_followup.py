"""Follow-up to the QA report: wider red-flag wording and admin-only /admin paths."""

from __future__ import annotations

import pytest

from app import red_flags
from app.main import app

API = "/api/v1"


@pytest.mark.parametrize("text,label", [
    ("I have breathing trouble", "Trouble breathing"),
    ("breathing problems since this morning", "Trouble breathing"),
    ("I am having a hard time breathing", "Trouble breathing"),
    ("breathing is difficult", "Trouble breathing"),
    ("my breathing is very bad", "Trouble breathing"),
    ("I can't get my breath", "Trouble breathing"),
    ("I can't get enough air", "Trouble breathing"),
    ("I'm wheezing and can't stop", "Trouble breathing"),
    ("breathing difficulties", "Trouble breathing"),
    ("pain across my chest", "Chest pain"),
    ("my chest is hurting", "Chest pain"),
    ("tightness across my chest", "Chest pain"),
    ("pressure on my chest", "Chest pain"),
    ("sharp pains in my chest", "Chest pain"),
    ("I can't move my right arm", "Possible stroke signs"),
    ("my left arm went numb suddenly", "Possible stroke signs"),
    ("half of my face is numb", "Possible stroke signs"),
    ("I suddenly can't see", "Possible stroke signs"),
    ("the worst headache of my life", "Possible stroke signs"),
    ("words won't come out", "Possible stroke signs"),
    ("كتمة في صدري", "Chest pain"),
    ("صدري يوجعني", "Chest pain"),
    ("ضيق بالتنفس", "Trouble breathing"),
    ("وجهي مايل", "Possible stroke signs"),
    ("ما اقدر اتكلم", "Possible stroke signs"),
    ("ما اقدر احرك يدي", "Possible stroke signs"),
])
def test_everyday_wording_raises_the_flag(text, label):
    assert label in red_flags.screen(text)


@pytest.mark.parametrize("text", [
    "no breathing problems", "no trouble breathing", "I don't have any chest pain",
    "no pressure on my chest", "my knee hurts", "my breathing is fine", "I have a mild headache",
])
def test_negated_or_unrelated_wording_stays_quiet(text):
    assert red_flags.screen(text) == []


def _admin_paths() -> list[tuple[str, str]]:
    out = []
    for path, operations in app.openapi()["paths"].items():
        if path.startswith(f"{API}/admin"):
            for method in operations:
                out.append((method.upper(), path.replace("{", "").replace("}", "")))
    return sorted(out)


@pytest.mark.parametrize("role", ["patient", "physician", "resident", "staff_nurse", "pharmacist"])
def test_every_admin_path_refuses_non_admins(client, auth, role):
    headers = auth(role)
    assert _admin_paths()
    for method, path in _admin_paths():
        status = client.request(method, path, headers=headers, json={}).status_code
        assert status == 403, f"{role} got {status} on {method} {path}"


def test_clinicians_keep_their_own_transfer_and_unit_routes(client, auth):
    headers = auth("physician")
    assert client.get(f"{API}/transfers", headers=headers).status_code == 200
    assert client.get(f"{API}/units", headers=headers).status_code == 200


def test_patients_cannot_use_the_clinician_routes(client, auth):
    headers = auth("patient")
    assert client.get(f"{API}/transfers", headers=headers).status_code == 403
    assert client.get(f"{API}/units", headers=headers).status_code == 403


def test_admins_keep_the_console(client, auth):
    assert client.get(f"{API}/admin/interop", headers=auth("tenant_owner")).status_code == 200
    assert client.get(f"{API}/admin/users", headers=auth("tenant_owner")).status_code == 200


def test_demo_access_is_untouched(client):
    r = client.get(f"{API}/public/demo-accounts")
    assert r.status_code == 200 and r.json()["enabled"] is True
