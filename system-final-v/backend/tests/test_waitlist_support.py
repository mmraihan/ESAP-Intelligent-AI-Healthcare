"""Waitlist, support tickets, announcements and the platform user directory."""

from __future__ import annotations

import uuid

from app.routers import waitlist as waitlist_router


def _lead(**over):
    body = {"name": "Dr. Test Lead", "email": f"lead-{uuid.uuid4().hex[:8]}@clinic.example",
            "organization": "Test Clinic", "org_type": "clinic", "contact_consent": True}
    body.update(over)
    return body


def _reset_limit():
    waitlist_router._hits.clear()


def test_public_waitlist_join_needs_no_session(client, auth):
    _reset_limit()
    lead = _lead()
    r = client.post("/api/v1/public/waitlist", json=lead)
    assert r.status_code == 201, r.text
    assert r.json()["position"] >= 1

    # Re-joining is not an error and keeps the original place in the queue.
    again = client.post("/api/v1/public/waitlist", json=lead)
    assert again.status_code == 201
    assert again.json()["position"] == r.json()["position"]

    rows = client.get("/api/v1/ops/waitlist", headers=auth("super_admin")).json()["entries"]
    assert sum(1 for e in rows if e["email"] == lead["email"]) == 1


def test_waitlist_requires_consent_and_ignores_bots(client, auth):
    _reset_limit()
    assert client.post("/api/v1/public/waitlist", json=_lead(contact_consent=False)).status_code == 422
    bot = _lead(website="http://spam.example")
    assert client.post("/api/v1/public/waitlist", json=bot).status_code == 201
    rows = client.get("/api/v1/ops/waitlist", headers=auth("super_admin")).json()["entries"]
    assert not any(e["email"] == bot["email"] for e in rows)


def test_waitlist_is_rate_limited(client):
    _reset_limit()
    codes = [client.post("/api/v1/public/waitlist", json=_lead()).status_code for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429
    _reset_limit()


def test_waitlist_rejections_and_repeats_do_not_spend_the_limit(client):
    _reset_limit()
    lead = _lead()
    for _ in range(6):
        assert client.post("/api/v1/public/waitlist", json=_lead(contact_consent=False)).status_code == 422
        assert client.post("/api/v1/public/waitlist", json=_lead(organization=None)).status_code == 422
        assert client.post("/api/v1/public/waitlist", json=lead).status_code == 201
    assert client.post("/api/v1/public/waitlist", json=_lead()).status_code == 201
    _reset_limit()


def test_waitlist_organization_optional_only_for_individuals(client):
    _reset_limit()
    assert client.post("/api/v1/public/waitlist", json=_lead(organization="  ")).status_code == 422
    assert client.post("/api/v1/public/waitlist",
                       json=_lead(organization=None, org_type="individual")).status_code == 201
    _reset_limit()


def test_waitlist_limit_is_per_visitor_behind_a_trusted_proxy(client, monkeypatch):
    from types import SimpleNamespace
    # TestClient connects from "testclient"; make that our proxy.
    monkeypatch.setattr(waitlist_router, "settings",
                        lambda: SimpleNamespace(trusted_proxies=frozenset({"testclient"})))
    _reset_limit()
    for i in range(6):
        r = client.post("/api/v1/public/waitlist", json=_lead(),
                        headers={"X-Forwarded-For": f"203.0.113.{i}"})
        assert r.status_code == 201
    # A forged left-most hop does not buy a fresh quota: the proxy's own entry wins.
    codes = [client.post("/api/v1/public/waitlist", json=_lead(),
                         headers={"X-Forwarded-For": f"10.9.9.{i}, 198.51.100.7"}).status_code
             for i in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429
    _reset_limit()


def test_waitlist_duplicate_race_answers_like_a_repeat(client, monkeypatch):
    _reset_limit()
    lead = _lead()
    first = client.post("/api/v1/public/waitlist", json=lead).json()["position"]
    # Simulate the race: the duplicate check misses, the insert hits the UNIQUE email.
    real, calls = waitlist_router._existing, []
    monkeypatch.setattr(waitlist_router, "_existing",
                        lambda email: None if not calls.append(email) and len(calls) == 1 else real(email))
    r = client.post("/api/v1/public/waitlist", json=lead)
    assert r.status_code == 201 and r.json()["position"] == first
    _reset_limit()


def test_waitlist_queue_is_platform_only(client, auth):
    for role in ("tenant_owner", "physician", "patient"):
        assert client.get("/api/v1/ops/waitlist", headers=auth(role)).status_code == 403
    assert client.get("/api/v1/ops/waitlist").status_code == 401


def test_sales_works_a_lead(client, auth):
    _reset_limit()
    lead = _lead()
    client.post("/api/v1/public/waitlist", json=lead)
    h = auth("super_admin")
    entry = next(e for e in client.get("/api/v1/ops/waitlist", headers=h).json()["entries"]
                 if e["email"] == lead["email"])
    r = client.patch(f"/api/v1/ops/waitlist/{entry['id']}", headers=h,
                     json={"status": "contacted", "owner": "Sales — Rana", "note": "Called, demo booked"})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["status"] == "contacted" and doc["owner"] == "Sales — Rana"
    assert doc["notes"][-1]["text"] == "Called, demo booked" and doc["contactedAt"]
    assert client.patch(f"/api/v1/ops/waitlist/{entry['id']}", headers=h,
                        json={"status": "bogus"}).status_code == 422

    export = client.post("/api/v1/ops/waitlist/export", headers=h).json()["rows"]
    assert any(row["email"] == lead["email"] for row in export)

    assert client.delete(f"/api/v1/ops/waitlist/{entry['id']}", headers=h).status_code == 204
    assert client.delete(f"/api/v1/ops/waitlist/{entry['id']}", headers=h).status_code == 404


def test_support_ticket_conversation(client, auth):
    user, staff = auth("physician"), auth("super_admin")
    r = client.post("/api/v1/support/tickets", headers=user, json={
        "subject": "Results page will not load", "category": "bug", "priority": "high",
        "message": "Spinner forever on the results page since this morning."})
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    # Staff see it; another user does not (404, not 403).
    assert any(t["id"] == tid for t in client.get("/api/v1/support/tickets", headers=staff).json()["tickets"])
    assert client.get(f"/api/v1/support/tickets/{tid}", headers=auth("patient")).status_code == 404
    assert not any(t["id"] == tid for t in
                   client.get("/api/v1/support/tickets", headers=auth("patient")).json()["tickets"])

    reply = client.post(f"/api/v1/support/tickets/{tid}/messages", headers=staff,
                        json={"body": "Looking into it — can you try a hard refresh?"}).json()
    assert reply["status"] == "in_progress" and reply["awaiting"] == "user"
    assert reply["messages"][-1]["fromStaff"] is True

    back = client.post(f"/api/v1/support/tickets/{tid}/messages", headers=user,
                       json={"body": "Works now, thanks."}).json()
    assert back["awaiting"] == "support" and back["messages"][-1]["fromStaff"] is False

    # A requester may close but not set staff states.
    assert client.post(f"/api/v1/support/tickets/{tid}/status", headers=user,
                       json={"status": "resolved"}).status_code == 403
    assert client.post(f"/api/v1/support/tickets/{tid}/status", headers=user,
                       json={"status": "closed"}).json()["status"] == "closed"
    assert client.post(f"/api/v1/support/tickets/{tid}/messages", headers=user,
                       json={"body": "one more"}).status_code == 409


def test_requester_reopens_only_a_resolved_ticket(client, auth):
    user, staff = auth("physician"), auth("super_admin")
    tid = client.post("/api/v1/support/tickets", headers=user, json={
        "subject": "Export button greyed out", "message": "Cannot export the PDF today."}).json()["id"]
    status = lambda who, s: client.post(f"/api/v1/support/tickets/{tid}/status",  # noqa: E731
                                        headers=who, json={"status": s})

    # Still with support: nothing to reopen.
    assert status(user, "open").status_code == 409
    assert status(staff, "resolved").json()["status"] == "resolved"
    assert status(user, "open").json()["status"] == "open"

    # Closed is final for the requester, and closing twice is refused.
    assert status(user, "closed").json()["status"] == "closed"
    assert status(user, "closed").status_code == 409
    assert status(user, "open").status_code == 409
    # Staff can still reopen a closed ticket.
    assert status(staff, "open").json()["status"] == "open"


def test_announcements_reach_their_audience(client, auth):
    staff = auth("super_admin")
    r = client.post("/api/v1/ops/announcements", headers=staff, json={
        "title": "Maintenance Sunday 02:00", "body": "Sign-in unavailable for 20 minutes.",
        "audience": "clinician", "level": "maintenance"})
    assert r.status_code == 201, r.text
    aid = r.json()["id"]

    seen = lambda role: any(a["id"] == aid for a in  # noqa: E731
                            client.get("/api/v1/announcements", headers=auth(role)).json()["announcements"])
    assert seen("physician") and not seen("patient")

    client.patch(f"/api/v1/ops/announcements/{aid}", headers=staff, json={"published": False})
    assert not seen("physician")
    client.patch(f"/api/v1/ops/announcements/{aid}", headers=staff,
                 json={"published": True, "expires_at": "2000-01-01T00:00:00Z"})
    assert not seen("physician")

    assert client.post("/api/v1/ops/announcements", headers=auth("tenant_owner"),
                       json={"title": "x" * 5, "body": "y" * 5}).status_code == 403
    assert client.delete(f"/api/v1/ops/announcements/{aid}", headers=staff).status_code == 204


def test_announcement_expiry_is_validated_and_edits_restamp(client, auth):
    staff = auth("super_admin")
    base = {"title": "Release 2.4", "body": "New results layout."}
    for bad in ("tomorrow", "2099-01-01T00:00:00", "9999"):
        r = client.post("/api/v1/ops/announcements", headers=staff, json={**base, "expires_at": bad})
        assert r.status_code == 422, bad

    # Offsets are normalised to UTC, the form `_active` compares against.
    r = client.post("/api/v1/ops/announcements", headers=staff,
                    json={**base, "expires_at": "2099-01-01T05:00:00+05:00"})
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["expiresAt"] == "2099-01-01T00:00:00Z"
    assert created["updatedAt"] == created["createdAt"]

    edited = client.patch(f"/api/v1/ops/announcements/{created['id']}", headers=staff,
                          json={"body": "New results layout, now with export."}).json()
    assert edited["updatedAt"] >= created["updatedAt"] and edited["createdAt"] == created["createdAt"]
    assert client.patch(f"/api/v1/ops/announcements/{created['id']}", headers=staff,
                        json={"expires_at": "soon"}).status_code == 422
    client.delete(f"/api/v1/ops/announcements/{created['id']}", headers=staff)


def test_platform_directory_and_super_admin_creation(client, auth):
    staff = auth("super_admin")
    body = client.get("/api/v1/ops/users", headers=staff).json()
    emails = {u["email"] for u in body["users"]}
    assert "rmoravec@esap.health" in emails and "amara.okonkwo@styves.example" in emails
    assert client.get("/api/v1/ops/users", headers=auth("tenant_owner")).status_code == 403

    email = f"ops-{uuid.uuid4().hex[:6]}@esap.health"
    r = client.post("/api/v1/ops/super-admins", headers=staff, json={
        "name": "New Operator", "email": email, "password": "a-long-password-1",
        "reason": "Second on-call operator for the pilot"})
    assert r.status_code == 201, r.text
    assert client.post("/api/v1/ops/super-admins", headers=auth("tenant_owner"), json={
        "name": "X", "email": "x@esap.health", "password": "a-long-password-1",
        "reason": "should not be allowed"}).status_code == 403

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "a-long-password-1"})
    assert login.status_code == 200 and login.json()["user"]["role"] == "super_admin"
    assert login.json()["user"]["name"] == "New Operator"
    # Not on any hospital's roster.
    roster = client.get("/api/v1/admin/users", headers=auth("tenant_owner")).json()
    assert email not in str(roster)
