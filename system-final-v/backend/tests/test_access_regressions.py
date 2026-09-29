"""Regressions for access holes found in review.

Each test pins one hole shut. They create their own throwaway accounts where
they suspend, demote or otherwise damage one, so the shared session database
stays usable for every other test.
"""

from __future__ import annotations

import collections
import uuid

from app import db
from app.routers.clinical import scope_encounters
from app.deps import Actor
from app.seed import DEMO_PASSWORD

CASE_TEXT = {
    "headline": "Your care team reviewed your admission assessment",
    "plain_language": "The team compared your details with many past hospital stays.",
}


def _login(client, email, password=DEMO_PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _fresh_user(client, auth, role="staff_nurse"):
    """Invite and accept a new account; return (user_id, email, token)."""
    email = f"reg.{uuid.uuid4().hex[:8]}@styves.example"
    invite = client.post("/api/v1/admin/invites", headers=auth("tenant_owner"),
                         json={"email": email, "role": role}).json()
    session = client.post("/api/v1/auth/invite/accept", json={
        "token": invite["acceptToken"], "name": "Reg Test", "password": "correct-horse-1"}).json()
    return session["user"]["id"], email, session["token"]


# --- invites ------------------------------------------------------------------


def test_invite_cannot_be_claimed_by_its_guessable_id(client):
    for guess in ("i1", "inv_i1"):
        assert client.get(f"/api/v1/auth/invite/{guess}").status_code == 404
        r = client.post("/api/v1/auth/invite/accept",
                        json={"token": guess, "name": "Mallory", "password": "hunter2hunter2"})
        assert r.status_code == 404


def test_invite_tokens_are_not_derived_from_the_id(client, auth):
    invite = client.post("/api/v1/admin/invites", headers=auth("tenant_owner"),
                         json={"email": f"x.{uuid.uuid4().hex[:6]}@styves.example",
                               "role": "physician"}).json()
    assert invite["id"] not in invite["acceptToken"]
    assert len(invite["acceptToken"]) >= 30


def test_expired_invite_cannot_be_accepted(client, auth):
    invite = client.post("/api/v1/admin/invites", headers=auth("tenant_owner"),
                         json={"email": f"late.{uuid.uuid4().hex[:6]}@styves.example",
                               "role": "physician"}).json()
    db.patch_doc("invites", invite["id"], {"expiresAt": "2020-01-01T00:00:00Z"})

    inspected = client.get(f"/api/v1/auth/invite/{invite['acceptToken']}").json()
    assert inspected["valid"] is False
    r = client.post("/api/v1/auth/invite/accept", json={
        "token": invite["acceptToken"], "name": "Late", "password": "correct-horse-1"})
    assert r.status_code == 409


# --- sign-in and revocation -------------------------------------------------


def test_suspended_user_cannot_sign_back_in(client, auth):
    user_id, email, token = _fresh_user(client, auth)
    r = client.post(f"/api/v1/admin/users/{user_id}/status", headers=auth("tenant_owner"),
                    json={"status": "suspended", "reason": "Regression: account compromise."})
    assert r.status_code == 200

    assert client.get("/api/v1/auth/session", headers=_headers(token)).status_code == 401
    assert _login(client, email, "correct-horse-1").status_code == 403


def test_demo_login_shares_its_directory_id(client, auth):
    """Revocation deletes sessions by user id; a mismatched id would survive it."""
    users = client.get("/api/v1/admin/users", headers=auth("tenant_owner")).json()["users"]
    target = next(u for u in users if u["email"] == "amara.okonkwo@styves.example")
    row = db.connect().execute("SELECT user_id FROM credentials WHERE email=?",
                               (target["email"],)).fetchone()
    assert row["user_id"] == target["id"]


def test_role_change_ends_live_sessions(client, auth):
    user_id, _, token = _fresh_user(client, auth, role="physician")
    assert client.get("/api/v1/encounters", headers=_headers(token)).status_code == 200

    r = client.post(f"/api/v1/admin/users/{user_id}/roles", headers=auth("tenant_owner"),
                    json={"roles": ["billing_admin"], "reason": "Regression: moved to billing."})
    assert r.status_code == 200
    assert client.get("/api/v1/encounters", headers=_headers(token)).status_code == 401


def test_scoped_user_management_cannot_mint_a_governance_role(client, auth):
    user_id, _, _ = _fresh_user(client, auth)
    it_admin = _login(client, "kofi.mensah@styves.example").json()["token"]
    r = client.post(f"/api/v1/admin/users/{user_id}/roles", headers=_headers(it_admin),
                    json={"roles": ["tenant_owner"], "reason": "Regression: escalation attempt."})
    assert r.status_code == 403


# --- tenant walls -----------------------------------------------------------


def _solo(client, role="physician"):
    """A self-serve account — lands in t_solo, outside the demo hospital."""
    r = client.post("/api/v1/auth/signup", json={
        "name": "Solo User", "email": f"solo.{uuid.uuid4().hex[:8]}@example.com",
        "password": "correct-horse-1", "role": role})
    assert r.status_code == 201
    return _headers(r.json()["token"])


def test_transfers_stay_inside_their_tenant(client, auth):
    assert client.get("/api/v1/admin/interop", headers=auth("physician")).json()["transfers"]

    outsider = _solo(client)
    assert client.get("/api/v1/bootstrap", headers=outsider).json()["transfers"] == []
    assert client.get("/api/v1/admin/interop", headers=outsider).json()["transfers"] == []


def test_transfer_cannot_be_decided_from_another_tenant(client):
    # A self-serve case manager holds transfer:approve, but in t_solo.
    outsider = _solo(client, role="case_manager")
    before = db.one_doc("SELECT doc FROM transfers WHERE id='tr1'")["state"]

    assert client.post("/api/v1/admin/interop/tr1/approve", headers=outsider).status_code == 404
    r = client.post("/api/v1/admin/interop/tr1/reject", headers=outsider,
                    json={"reason": "Regression: not our patient."})
    assert r.status_code == 404
    assert db.one_doc("SELECT doc FROM transfers WHERE id='tr1'")["state"] == before


def test_hospital_sees_only_its_own_and_platform_incidents(client, auth):
    incidents = client.get("/api/v1/bootstrap", headers=auth("tenant_owner")).json()["incidents"]
    assert incidents
    assert {i["tenantName"] for i in incidents} <= {None, "St. Yves Medical Center"}


# --- clinical actions -------------------------------------------------------


def test_only_assessing_roles_can_acknowledge(client, auth):
    target = next(e for e in client.get("/api/v1/encounters", headers=auth("physician")).json()["encounters"]
                  if e["state"] in {"assessed", "acknowledged", "awaiting_cosign"})
    auditor = _headers(_login(client, "leila.aziz@styves.example").json()["token"])
    for headers in (auth("pharmacist"), auditor):
        r = client.post(f"/api/v1/encounters/{target['id']}/acknowledge", headers=headers, json={})
        assert r.status_code == 403


def test_release_never_lands_in_another_patients_portal(client, auth):
    before = client.get("/api/v1/patient/results", headers=auth("patient")).json()["released"]
    linked = {r["encounterId"] for r in before}

    target = next(e for e in client.get("/api/v1/encounters", headers=auth("physician")).json()["encounters"]
                  if e["state"] in {"assessed", "acknowledged", "awaiting_cosign"}
                  and e["id"] not in linked)
    r = client.post(f"/api/v1/encounters/{target['id']}/release", headers=auth("physician"),
                    json=CASE_TEXT)
    assert r.status_code in (200, 201)

    after = client.get("/api/v1/patient/results", headers=auth("patient")).json()["released"]
    assert target["id"] not in {x["encounterId"] for x in after}


def test_attending_sees_their_own_patients(client, auth):
    """Directory says "Amara Okonkwo, MD"; charts say "Dr. Amara Okonkwo"."""
    ids = {e["id"] for e in client.get("/api/v1/encounters", headers=auth("physician")).json()["encounters"]}
    assert {"enc_1000", "enc_1010", "enc_1020", "enc_1030"} <= ids


def test_task_outside_scope_cannot_be_ticked(client, auth):
    nurse = auth("staff_nurse")
    visible = {e["id"] for e in client.get("/api/v1/encounters", headers=nurse).json()["encounters"]}
    tenant_wide = client.get("/api/v1/encounters", headers=auth("resident")).json()["encounters"]
    outside = next(e["id"] for e in tenant_wide if e["id"] not in visible)

    task = client.post("/api/v1/tasks", headers=auth("resident"),
                       json={"encounter_id": outside, "label": "Regression task"}).json()
    r = client.post(f"/api/v1/tasks/{task['id']}/done", headers=nurse)
    assert r.status_code == 403


def test_scope_filter_fails_closed_without_standing_access():
    rows = [{"id": "e1", "unitId": "u_4w", "nurse": "x", "attending": "y"}]
    nobody = Actor("u", "nobody@example.com", "billing_admin", "t_yves", "tok")
    assert scope_encounters(nobody, rows, "none") == []
    platform = Actor("p", "ops@example.com", "super_admin", "t_yves", "tok")
    assert scope_encounters(platform, rows, "breakglass") == []


# --- data -------------------------------------------------------------------


def test_every_directory_email_is_unique():
    seed = db.seed_file()
    counts = collections.Counter(u["email"] for u in seed["users"])
    assert [e for e, n in counts.items() if n > 1] == []
