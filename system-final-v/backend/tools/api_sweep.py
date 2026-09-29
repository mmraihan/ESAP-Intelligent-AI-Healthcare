"""Live sweep of every ESAP API route against a running server.

pytest exercises the app in-process. This exercises a *deployment*: real HTTP,
real CORS, real uvicorn, the database that host is actually using. It is the
check for "is the API up and behaving", which an in-process test cannot answer.

Each endpoint is called with an appropriate role and checked for status plus a
payload invariant; each is then called with a role that should NOT reach it and
checked for a refusal. Writes go to throwaway records (a probe invite, a probe
tenant, a probe consent) or are no-ops that re-affirm existing state.

    python tools/api_sweep.py [base_url]        # default http://127.0.0.1:8000

Exits non-zero if anything failed, so it works as a smoke gate after a deploy.
Requires the demo seed (`python -m app.seed --reset`); it signs in as the demo
accounts, which exist only there.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
PW = "esap-demo"

ACCOUNTS = {
    "physician": "amara.okonkwo@styves.example",
    "resident": "tobias.lindqvist@styves.example",
    "staff_nurse": "lucas.beaulieu@styves.example",
    "case_manager": "noor.haddad@styves.example",
    "charge_nurse": "ines.vasquez@styves.example",
    "tenant_owner": "mira.novak@styves.example",
    "privacy_officer": "sanne.devries@styves.example",
    "billing_admin": "hugo.ferreira@styves.example",
    "it_admin": "kofi.mensah@styves.example",
    "super_admin": "rmoravec@esap.health",
    "patient": "delia.salib@example.com",
}

CASE = {
    "features": {
        "demographics": {"admission_age": 74, "is_female": 1},
        "admission_context": {"via_ed": 1, "admission_type": "EW EMER."},
        "vitals": {"bp_sys": 104, "bp_dia": 62, "bmi": 24.0},
        "labs": {"50912": 1.6, "51301": 13.0, "50813": 2.4},
        "prior_history": {"prior_ccsr": ["CIR019"], "n_prior_admissions": 2, "charlson_index": 5},
        "meds": ["furosemide"],
    },
    "audit_covariates": {"race": "Asian", "insurance": "Medicare"},
}

tokens: dict[str, str] = {}
results: list[tuple[str, str, str, str]] = []  # status, method, label, detail


def call(method: str, path: str, *, role=None, body=None, raw_token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    token = raw_token if raw_token is not None else (tokens.get(role) if role else None)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            payload = r.read().decode()
            if not payload:
                return r.status, None
            try:
                return r.status, json.loads(payload)
            except json.JSONDecodeError:
                return r.status, payload  # /docs and /redoc are HTML
    except urllib.error.HTTPError as e:
        payload = e.read().decode()
        try:
            return e.code, json.loads(payload) if payload else None
        except json.JSONDecodeError:
            return e.code, payload
    except urllib.error.URLError as e:
        return 0, str(e)


def record(ok: bool, method: str, label: str, detail: str = "") -> None:
    results.append(("PASS" if ok else "FAIL", method, label, detail))


def check(method, path, *, role=None, body=None, expect=200, label=None, invariant=None,
          raw_token=None):
    label = label or path
    status, payload = call(method, path, role=role, body=body, raw_token=raw_token)
    expected = expect if isinstance(expect, (list, tuple, set)) else [expect]
    if status not in expected:
        msg = ""
        if isinstance(payload, dict) and "error" in payload:
            msg = payload["error"].get("message", "")
        record(False, method, f"{label} [{role or 'anon'}]", f"got {status}, want {expected} {msg}")
        return payload
    if invariant:
        try:
            ok, note = invariant(payload)
        except Exception as exc:  # noqa: BLE001
            ok, note = False, f"invariant raised {type(exc).__name__}: {exc}"
        if not ok:
            record(False, method, f"{label} [{role or 'anon'}]", note)
            return payload
    record(True, method, f"{label} [{role or 'anon'}]", f"{status}")
    return payload


def nonempty(key):
    def f(p):
        v = p.get(key) if isinstance(p, dict) else None
        return bool(v), f"'{key}' empty or missing"
    return f


# --------------------------------------------------------------------------
print(f"ESAP API sweep — {BASE}\n")

# 0. unauthenticated surface
check("GET", "/healthz", expect=200, invariant=lambda p: (p == {"status": "ok"}, "bad body"))
check("GET", "/readyz", expect=200,
      invariant=lambda p: (p["status"] == "ok" and not p["problems"], f"problems={p.get('problems')}"))
check("GET", "/openapi.json", expect=200, invariant=nonempty("paths"))
check("GET", "/docs", expect=200)

# Every /v1 route must reject an anonymous caller (API_CONTRACT §1). The
# exhaustive version of this check, over the live route table, is
# tests/test_api.py::test_no_v1_route_is_unauthenticated.
for path in ("/api/v1/bootstrap", "/api/v1/encounters", "/api/v1/models", "/api/v1/schema/labs",
             "/api/v1/admin/users", "/api/v1/ops/fleet", "/api/v1/patient/home", "/api/v1/meta"):
    check("GET", path, expect=401, label=f"{path} rejects anonymous",
          invariant=lambda p: (p["error"]["code"] == "UNAUTHENTICATED", "wrong error code"))

# 1. auth
for role, email in ACCOUNTS.items():
    status, payload = call("POST", "/api/v1/auth/login", body={"email": email, "password": PW})
    if status == 200 and payload.get("token"):
        tokens[role] = payload["token"]
        record(True, "POST", f"/api/v1/auth/login [{role}]",
               f"200 {payload['user']['name']} -> {payload['user']['home']}")
    else:
        record(False, "POST", f"/api/v1/auth/login [{role}]", f"got {status}")

check("POST", "/api/v1/auth/login", body={"email": ACCOUNTS["physician"], "password": "wrong"},
      expect=401, label="/api/v1/auth/login rejects a bad password")
check("GET", "/api/v1/auth/session", role="physician", invariant=nonempty("user"))
check("GET", "/api/v1/auth/roles", role="physician", invariant=nonempty("matrix"))
check("GET", "/api/v1/auth/roles", expect=401, label="/api/v1/auth/roles rejects anonymous")
check("GET", "/api/v1/meta", role="physician",
      invariant=lambda p: (p["guarantees"]["audit_covariates_are_model_inputs"] is False,
                           "guarantee flag wrong"))

# 2. bootstrap, per role
def boot_inv(expect_nonempty, expect_empty):
    def f(p):
        for k in expect_nonempty:
            if not p.get(k):
                return False, f"expected '{k}' to have rows"
        for k in expect_empty:
            if p.get(k):
                return False, f"LEAK: '{k}' should be empty, has {len(p[k])}"
        return True, ""
    return f

check("GET", "/api/v1/bootstrap", role="physician",
      invariant=boot_inv(["tenants", "encounters", "models"],
                         ["platform_audit", "subgroup_fairness", "consents", "invoices"]))
check("GET", "/api/v1/bootstrap", role="tenant_owner",
      invariant=boot_inv(["users", "invites", "audit_events"], ["platform_audit"]))
check("GET", "/api/v1/bootstrap", role="super_admin",
      invariant=boot_inv(["tenants", "platform_audit", "break_glass"],
                         ["encounters"]))
check("GET", "/api/v1/bootstrap", role="patient",
      invariant=boot_inv(["consents", "care_team", "records"],
                         ["users", "encounters", "invoices", "transfers", "audit_events"]))

# 3. catalogs + registry
check("GET", "/api/v1/schema/labs", role="physician", invariant=nonempty("labs"))
check("GET", "/api/v1/schema/ccsr", role="physician", invariant=nonempty("ccsr"))
check("GET", "/api/v1/schema/vocab/meds", role="physician", invariant=nonempty("meds"))
check("GET", "/api/v1/schema/enums", role="physician", invariant=nonempty("admission_type"))
check("GET", "/api/v1/models", role="physician",
      invariant=lambda p: (all(r["status"] != "live" for r in p), "a stub is reported as live"))
check("GET", "/api/v1/models/cards", role="physician", invariant=nonempty("models"))
check("GET", "/api/v1/models/M-01", role="physician", invariant=nonempty("registry"))
check("GET", "/api/v1/models/M-99", role="physician", expect=404, label="/api/v1/models/{id} 404s")

# 4. clinical
def five_models(p):
    ids = {p[k]["model_id"] for k in ("differential", "mortality", "icu", "readmission", "los")}
    return ids == {"M-01", "M-02", "M-03", "M-04", "M-05"}, f"got {sorted(ids)}"

check("POST", "/api/v1/assess", role="physician", body=CASE, invariant=five_models)
check("POST", "/api/v1/assess", role="physician", body={"features": {}}, expect=422,
      label="/api/v1/assess 422s without demographics")
check("POST", "/api/v1/assess?frame=discharge", role="physician", body=CASE, expect=400,
      label="/api/v1/assess refuses frame=discharge")
bad = json.loads(json.dumps(CASE)); bad["features"]["race"] = "White"
check("POST", "/api/v1/assess", role="physician", body=bad, expect=422,
      label="/api/v1/assess 422s on a covariate in features")
bad = json.loads(json.dumps(CASE)); bad["features"]["labs"]["99999999"] = 1.0
check("POST", "/api/v1/assess", role="physician", body=bad, expect=422,
      label="/api/v1/assess 422s on an unknown lab itemid")

for name in ("differential", "mortality", "icu", "readmission", "los"):
    check("POST", f"/api/v1/predict/{name}", role="physician", body=CASE,
          invariant=lambda p: (p.get("model_id", "").startswith("M-"), "no model_id"))
check("POST", "/api/v1/predict/readmission?frame=xyz", role="physician", body=CASE, expect=400,
      label="/api/v1/predict/readmission 400s on a bad frame")

check("POST", "/api/v1/explain?model_id=M-02", role="physician", body=CASE,
      invariant=lambda p: (p["explanation"]["reconstruction_ok"] is True, "explanation not faithful"))
check("POST", "/api/v1/explain?model_id=M-01", role="physician", body=CASE,
      invariant=nonempty("per_label"))
check("POST", "/api/v1/explain?model_id=M-99", role="physician", body=CASE, expect=400,
      label="/api/v1/explain 400s on a bad model_id")

check("POST", "/api/v1/extract", role="physician", body={"text": "78f sob, diabetic"},
      invariant=lambda p: (p["model_status"] == "stub", "stub not declared"))
check("POST", "/api/v1/assess/from-text", role="physician",
      body={"text": "78f sob", "confirmed": False},
      invariant=lambda p: (p["assessment"] is None and bool(p["blocked_reason"]),
                           "unconfirmed extraction was scored"))
check("GET", "/api/v1/cases/12345/prefill", role="physician", expect=403,
      label="/api/v1/cases/{id}/prefill is gated")

# worklist
wl = check("GET", "/api/v1/encounters", role="physician", invariant=nonempty("encounters"))
enc_id = wl["encounters"][0]["id"] if wl and wl.get("encounters") else None
check("GET", "/api/v1/encounters?state=assessed", role="physician", label="/api/v1/encounters?state=")
check("GET", "/api/v1/encounters?q=zzzznomatch", role="physician",
      label="/api/v1/encounters?q=", invariant=lambda p: (p["count"] == 0, "search did not filter"))
if enc_id:
    check("GET", f"/api/v1/encounters/{enc_id}", role="physician", label="/api/v1/encounters/{id}",
          invariant=nonempty("patient"))
    check("GET", f"/api/v1/encounters/{enc_id}/assessments", role="physician",
          label="/api/v1/encounters/{id}/assessments")
    check("POST", "/api/v1/assess", role="physician", body={**CASE, "encounter_id": enc_id},
          label="/api/v1/assess linked to an encounter", invariant=five_models)
check("GET", "/api/v1/encounters/enc_nope", role="physician", expect=404,
      label="/api/v1/encounters/{id} 404s")

# acknowledge (resident -> co-sign) and release
rwl = check("GET", "/api/v1/encounters?state=assessed", role="resident",
            label="/api/v1/encounters [resident]")
renc = rwl["encounters"][0]["id"] if rwl and rwl.get("encounters") else None
if renc:
    check("POST", f"/api/v1/encounters/{renc}/acknowledge", role="resident", body={"note": "sweep"},
          label="/api/v1/encounters/{id}/acknowledge",
          invariant=lambda p: (p["requires_cosign"] is True
                               and p["encounter"]["state"] == "awaiting_cosign",
                               f"resident ack did not require cosign: {p.get('requires_cosign')}"))
if enc_id:
    check("POST", f"/api/v1/encounters/{enc_id}/release", role="physician", body={
        "headline": "Your care team reviewed your admission assessment",
        "plain_language": "The team compared your details with many past hospital stays.",
        "what_this_means": ["Your stay is expected to be a few days."],
        "questions_to_ask": ["What would let me go home sooner?"],
    }, expect=(200, 201), label="/api/v1/encounters/{id}/release",
       invariant=lambda p: (p["rawScoreWithheld"] is True, "raw score not withheld"))

# 5. admin
check("GET", "/api/v1/admin/org", role="tenant_owner", invariant=nonempty("name"))
check("GET", "/api/v1/admin/facilities", role="tenant_owner", invariant=nonempty("facilities"))
check("GET", "/api/v1/admin/units", role="physician", invariant=nonempty("units"))
check("GET", "/api/v1/admin/users", role="tenant_owner", invariant=nonempty("users"))
check("GET", "/api/v1/admin/users?role=physician", role="tenant_owner", label="/api/v1/admin/users?role=")
check("GET", "/api/v1/admin/invites", role="tenant_owner", invariant=nonempty("invites"))
check("GET", "/api/v1/admin/audit", role="privacy_officer", invariant=nonempty("events"))
check("GET", "/api/v1/admin/audit?severity=critical", role="privacy_officer",
      label="/api/v1/admin/audit?severity=")
check("GET", "/api/v1/admin/fairness", role="privacy_officer",
      invariant=lambda p: (p["covariates_are_model_inputs"] is False, "fairness flag wrong"))
check("GET", "/api/v1/admin/usage", role="tenant_owner", invariant=nonempty("adoption"))
check("GET", "/api/v1/admin/billing", role="billing_admin", invariant=nonempty("invoices"))
check("GET", "/api/v1/admin/interop", role="physician", invariant=nonempty("transfers"))
check("GET", "/api/v1/admin/models", role="tenant_owner", invariant=nonempty("models"))

inv = check("POST", "/api/v1/admin/invites", role="tenant_owner",
            body={"email": "sweep.probe@styves.example", "role": "physician",
                  "scope": "Facility: Main Campus"},
            expect=201, invariant=nonempty("acceptToken"))
if inv:
    tok = inv["acceptToken"]
    check("GET", f"/api/v1/auth/invite/{tok}", label="/api/v1/auth/invite/{token} (public)",
          invariant=lambda p: (p["valid"] is True, "invite not valid"))
    check("DELETE", f"/api/v1/admin/invites/{inv['id']}", role="tenant_owner",
          label="/api/v1/admin/invites/{id} revoke",
          invariant=lambda p: (p["status"] == "revoked", "not revoked"))

users = check("GET", "/api/v1/admin/users", role="tenant_owner", label="/api/v1/admin/users (for writes)")
target = next((u for u in users["users"] if u["roles"][0] == "staff_nurse"), None) if users else None
if target:
    check("POST", f"/api/v1/admin/users/{target['id']}/roles", role="tenant_owner",
          body={"roles": ["staff_nurse"], "reason": "sweep no-op re-grant"},
          label="/api/v1/admin/users/{id}/roles")
    check("POST", f"/api/v1/admin/users/{target['id']}/status", role="tenant_owner",
          body={"status": "active", "reason": "sweep no-op reactivate"},
          label="/api/v1/admin/users/{id}/status")

tr = check("GET", "/api/v1/admin/interop", role="case_manager", label="/api/v1/admin/interop [cm]")
pending = next((t for t in tr["transfers"] if t["state"] in {"requested", "mpi_review", "consent_pending"}),
               None) if tr else None
if pending:
    check("POST", f"/api/v1/admin/interop/{pending['id']}/approve", role="case_manager",
          label="/api/v1/admin/interop/{id}/approve",
          invariant=lambda p: (p["state"] == "approved", "not approved"))

# 6. ops
check("GET", "/api/v1/ops/fleet", role="super_admin", invariant=nonempty("tenants"))
check("GET", "/api/v1/ops/tenants/t_yves", role="super_admin", invariant=nonempty("tenant"))
check("GET", "/api/v1/ops/tenants/t_nope", role="super_admin", expect=404,
      label="/api/v1/ops/tenants/{id} 404s")
check("GET", "/api/v1/ops/incidents", role="super_admin", invariant=nonempty("incidents"))
check("GET", "/api/v1/ops/incidents?state=open", role="super_admin", label="/api/v1/ops/incidents?state=")
check("GET", "/api/v1/ops/rollout", role="super_admin", invariant=nonempty("rollouts"))
check("GET", "/api/v1/ops/plans", role="super_admin", invariant=nonempty("plans"))
check("GET", "/api/v1/ops/config", role="super_admin",
      invariant=lambda p: (p["safety_features_by_plan"] == {}, "a safety feature is plan-gated"))
check("GET", "/api/v1/ops/audit", role="super_admin", invariant=nonempty("events"))
check("GET", "/api/v1/ops/break-glass", role="super_admin", invariant=nonempty("grants"))

check("POST", "/api/v1/ops/rollout", role="super_admin",
      body={"model_id": "M-02", "version": "1.2.0", "stage": "full", "traffic_pct": 100,
            "note": "sweep: re-affirm the current stage"},
      label="/api/v1/ops/rollout advance")

prov = check("POST", "/api/v1/ops/tenants", role="super_admin", expect=(201, 409),
             body={"name": "Sweep Probe Hospital", "slug": "sweep-probe", "mode": "saas",
                   "plan": "pilot", "region": "us-east", "isolation": "shared_rls",
                   "beds": 10, "seats": 5, "contact": "probe@example.com"},
             label="/api/v1/ops/tenants provision")
if prov and prov.get("id"):
    check("POST", f"/api/v1/ops/tenants/{prov['id']}/status", role="super_admin",
          body={"status": "suspended", "reason": "sweep probe teardown; retention window applies"},
          label="/api/v1/ops/tenants/{id}/status",
          invariant=lambda p: (p["data_retained"] is True, "suspension implied deletion"))

bg = check("POST", "/api/v1/ops/break-glass", role="super_admin", expect=201,
           body={"tenant_id": "t_yves", "patient_ref": "MRN-400411",
                 "reason": "Sweep probe: verifying the two-person approval path.",
                 "ticket": "SWEEP-1", "ttl_minutes": 15},
           label="/api/v1/ops/break-glass request",
           invariant=lambda p: (p["status"] == "pending_approval", "granted without approval"))
if bg:
    check("POST", f"/api/v1/ops/break-glass/{bg['id']}/approve", role="super_admin", expect=403,
          label="/api/v1/ops/break-glass/{id}/approve blocks self-approval")
    check("POST", f"/api/v1/ops/break-glass/{bg['id']}/revoke", role="super_admin",
          label="/api/v1/ops/break-glass/{id}/revoke",
          invariant=lambda p: (p["status"] == "revoked", "not revoked"))

# elevation round-trip
check("GET", "/api/v1/encounters", role="super_admin", expect=403,
      label="/api/v1/encounters blocks unelevated platform staff")
check("POST", "/api/v1/auth/elevate", role="super_admin",
      body={"reason": "Sweep probe: verifying the elevation round-trip.", "ticket": "SWEEP-2",
            "ttl_minutes": 5}, invariant=nonempty("elevation"))
check("GET", "/api/v1/encounters", role="super_admin", label="/api/v1/encounters after elevation")
check("DELETE", "/api/v1/auth/elevate", role="super_admin", expect=204,
      label="/api/v1/auth/elevate drop")
check("GET", "/api/v1/encounters", role="super_admin", expect=403,
      label="/api/v1/encounters blocks again after drop")

# 7. patient portal
check("GET", "/api/v1/patient/home", role="patient", invariant=nonempty("care_team"))
check("GET", "/api/v1/patient/results", role="patient",
      invariant=lambda p: (p["raw_scores_withheld"] is True, "raw scores not withheld"))
check("GET", "/api/v1/patient/records", role="patient", invariant=nonempty("records"))
check("GET", "/api/v1/patient/care-team", role="patient", invariant=nonempty("care_team"))
check("GET", "/api/v1/patient/sharing", role="patient", invariant=nonempty("consents"))
check("GET", "/api/v1/patient/settings", role="patient", invariant=nonempty("permissions"))
grant = check("POST", "/api/v1/patient/sharing", role="patient", expect=201,
              body={"grantee": "Sweep Probe Clinic", "grantee_type": "clinician",
                    "purpose": "Treatment", "scope": ["Problem list"], "expires_at": None},
              label="/api/v1/patient/sharing grant")
if grant:
    check("DELETE", f"/api/v1/patient/sharing/{grant['id']}", role="patient",
          label="/api/v1/patient/sharing/{id} revoke",
          invariant=lambda p: (p["consent"]["status"] == "revoked", "not revoked"))

# 8. authorization boundaries — the wrong role must be refused
BOUNDARIES = [
    ("GET", "/api/v1/admin/fairness", "physician", 403),
    ("GET", "/api/v1/admin/billing", "staff_nurse", 403),
    ("GET", "/api/v1/admin/users", "staff_nurse", 403),
    ("GET", "/api/v1/admin/audit", "physician", 403),
    ("GET", "/api/v1/admin/users?tenant_id=t_northgate", "tenant_owner", 403),
    ("GET", "/api/v1/ops/fleet", "tenant_owner", 403),
    ("GET", "/api/v1/ops/audit", "privacy_officer", 403),
    ("GET", "/api/v1/ops/config", "it_admin", 403),
    ("GET", "/api/v1/patient/home", "physician", 403),
    ("GET", "/api/v1/patient/results", "super_admin", 403),
    ("POST", "/api/v1/assess", "patient", 403),
    ("POST", "/api/v1/assess", "staff_nurse", 403),
    ("POST", "/api/v1/auth/elevate", "billing_admin", 403),
]
for method, path, role, want in BOUNDARIES:
    check(method, path, role=role, body=(CASE if method == "POST" and "assess" in path else
          {"reason": "probe reason long enough", "ticket": "X-1"} if method == "POST" else None),
          expect=want, label=f"{path} refuses")

check("GET", "/api/v1/encounters", raw_token="not-a-real-token", expect=401,
      label="/api/v1/encounters rejects a bogus token")

# logout last, so it does not invalidate the sweep
check("POST", "/api/v1/auth/logout", role="it_admin", expect=204, label="/api/v1/auth/logout")
check("GET", "/api/v1/auth/session", role="it_admin", expect=401,
      label="/api/v1/auth/session after logout")

# 9. settings, exports and the rest of the write surface ---------------------

check("GET", "/api/v1/settings/org", role="tenant_owner", invariant=nonempty("settings"))
check("PUT", "/api/v1/settings/org", role="tenant_owner",
      body={"patch": {"brandingHex": "#0e8a92"}}, label="/api/v1/settings/org save")
check("PUT", "/api/v1/settings/model_display", role="tenant_owner",
      body={"patch": {"differentialTopN": 15}}, label="/api/v1/settings/model_display save")
check("GET", "/api/v1/settings/global_flags", role="super_admin")
check("PUT", "/api/v1/settings/global_flags", role="super_admin",
      body={"patch": {"CHAT_ENABLED": True}, "reason": "sweep probe"},
      label="/api/v1/settings/global_flags save")
check("PUT", "/api/v1/settings/global_flags", role="super_admin",
      body={"patch": {"CHAT_ENABLED": True}}, expect=400,
      label="/api/v1/settings/global_flags needs a reason")
check("PUT", "/api/v1/settings/global_flags", role="tenant_owner",
      body={"patch": {"CHAT_ENABLED": False}, "reason": "should be refused"},
      expect=403, label="/api/v1/settings/global_flags refuses a tenant admin")
check("GET", "/api/v1/settings/nonsense", role="tenant_owner", expect=404,
      label="/api/v1/settings/{scope} 404s on an unknown scope")

check("POST", "/api/v1/exports", role="privacy_officer", body={"kind": "fairness_report"},
      expect=201, label="/api/v1/exports fairness (de-identified)")
check("POST", "/api/v1/exports", role="physician", body={"kind": "handoff"}, expect=400,
      label="/api/v1/exports refuses PHI without a reason")
check("POST", "/api/v1/exports", role="physician",
      body={"kind": "handoff", "reason": "Shift handover to the incoming charge nurse"},
      expect=201, label="/api/v1/exports handoff with a reason")
check("POST", "/api/v1/exports", role="staff_nurse",
      body={"kind": "roster", "reason": "probe"}, expect=403,
      label="/api/v1/exports refuses a roster export to a nurse")
check("GET", "/api/v1/exports", role="privacy_officer", invariant=nonempty("exports"))

fac = check("POST", "/api/v1/admin/facilities", role="tenant_owner", expect=201,
            body={"name": "Sweep Probe Wing", "type": "clinic", "beds": 8},
            label="/api/v1/admin/facilities create")
if fac:
    unit = check("POST", "/api/v1/admin/facilities/" + fac["id"] + "/units", role="tenant_owner",
                 expect=201, body={"name": "Probe Unit", "service_line": "Medicine",
                                   "beds": 4, "occupied": 0},
                 label="/api/v1/admin/facilities/{id}/units create")
    check("PATCH", "/api/v1/admin/facilities/" + fac["id"], role="tenant_owner",
          body={"name": "Sweep Probe Wing 2", "type": "clinic", "beds": 9},
          label="/api/v1/admin/facilities/{id} update")
    if unit:
        check("DELETE", "/api/v1/admin/facilities/" + fac["id"] + "/units/" + unit["id"],
              role="tenant_owner", label="/api/v1/admin/facilities/{id}/units/{id} delete")
check("DELETE", "/api/v1/admin/facilities/f_main/units/u_4w", role="tenant_owner", expect=409,
      label="/api/v1/admin/.../units/{id} refuses an occupied unit")

check("POST", "/api/v1/admin/integrations/adt/test", role="tenant_owner",
      invariant=lambda p: (p["status"] != "healthy",
                           "an unconfigured integration reported healthy"),
      label="/api/v1/admin/integrations/{key}/test")
check("POST", "/api/v1/admin/integrations/nope/test", role="tenant_owner", expect=404,
      label="/api/v1/admin/integrations/{key}/test 404s")

invites = check("GET", "/api/v1/admin/invites", role="tenant_owner",
                label="/api/v1/admin/invites (for writes)")
pending = next((i for i in invites["invites"] if i["status"] == "pending"), None) if invites else None
if pending:
    check("POST", "/api/v1/admin/invites/" + pending["id"] + "/remind", role="tenant_owner",
          label="/api/v1/admin/invites/{id}/remind",
          invariant=lambda p: (p["remindersSent"] >= 1, "reminder not counted"))

roster = check("GET", "/api/v1/admin/users", role="tenant_owner",
               label="/api/v1/admin/users (for reset)")
if roster:
    check("POST", "/api/v1/admin/users/" + roster["users"][0]["id"] + "/password-reset",
          role="tenant_owner", label="/api/v1/admin/users/{id}/password-reset",
          invariant=lambda p: (p["sessions_ended"] is True, "sessions not ended"))

units = check("GET", "/api/v1/admin/units", role="physician", label="/api/v1/admin/units (for admit)")
new_enc = check("POST", "/api/v1/encounters", role="physician", expect=201, body={
    "mrn": "MRN-SWEEP" + str(int(time.time()) % 100000), "name": "Sweep Probe",
    "age": 66, "sex": "F", "unit_id": units["units"][0]["id"], "bed": "SW-1",
    "chief_complaint": "Sweep probe admission"}, label="/api/v1/encounters admit")
if new_enc:
    eid = new_enc["id"]
    check("POST", "/api/v1/encounters/" + eid + "/vitals", role="physician", expect=201,
          body={"bp_sys": 118, "bp_dia": 74, "at_t0": True},
          label="/api/v1/encounters/{id}/vitals at t0",
          invariant=lambda p: (p["usableForScoring"] is True, "t0 vitals not usable"))
    check("POST", "/api/v1/encounters/" + eid + "/vitals", role="physician", expect=201,
          body={"bp_sys": 104, "at_t0": False},
          label="/api/v1/encounters/{id}/vitals after t0",
          invariant=lambda p: (p["usableForScoring"] is False,
                               "post-t0 vitals marked usable for scoring"))
    check("GET", "/api/v1/encounters/" + eid + "/vitals", role="physician",
          label="/api/v1/encounters/{id}/vitals list")
    check("POST", "/api/v1/encounters/" + eid + "/escalate", role="physician",
          body={"to": "Attending on call", "reason": "Sweep probe escalation",
                "urgency": "urgent"},
          label="/api/v1/encounters/{id}/escalate")
    task = check("POST", "/api/v1/tasks", role="physician", expect=201,
                 body={"label": "Sweep probe task", "encounter_id": eid},
                 label="/api/v1/tasks create")
    if task:
        check("POST", "/api/v1/tasks/" + task["id"] + "/done", role="physician",
              label="/api/v1/tasks/{id}/done",
              invariant=lambda p: (p["done"] is True and bool(p["doneBy"]),
                                   "task not completed"))
    check("GET", "/api/v1/tasks", role="physician", invariant=nonempty("tasks"))

tr2 = check("GET", "/api/v1/admin/interop", role="case_manager",
            label="/api/v1/admin/interop (for reject)")
rejectable = next((t for t in tr2["transfers"]
                   if t["state"] in {"requested", "mpi_review", "consent_pending"}),
                  None) if tr2 else None
if rejectable:
    check("POST", "/api/v1/admin/interop/" + rejectable["id"] + "/reject", role="case_manager",
          body={"reason": "Identifiers do not match this patient"},
          label="/api/v1/admin/interop/{id}/reject",
          invariant=lambda p: (p["state"] == "rejected", "not rejected"))

inc = check("POST", "/api/v1/ops/incidents", role="super_admin", expect=201,
            body={"title": "Sweep probe incident", "component": "probe",
                  "severity": "warning", "detail": "Synthetic incident from the sweep"},
            label="/api/v1/ops/incidents open")
if inc:
    check("POST", "/api/v1/ops/incidents/" + inc["id"] + "/state", role="super_admin",
          body={"state": "mitigating", "note": "Sweep probe mitigation"},
          label="/api/v1/ops/incidents/{id}/state")
    check("POST", "/api/v1/ops/incidents/" + inc["id"] + "/update", role="super_admin",
          body={"state": "mitigating", "note": "Sweep probe update"},
          label="/api/v1/ops/incidents/{id}/update",
          invariant=lambda p: (len(p["updates"]) >= 2, "update trail not appended"))
    check("POST", "/api/v1/ops/incidents/" + inc["id"] + "/state", role="super_admin",
          body={"state": "resolved", "note": "Sweep probe resolved"},
          label="/api/v1/ops/incidents/{id}/state resolve")

bg2 = check("POST", "/api/v1/ops/break-glass", role="super_admin", expect=201,
            body={"tenant_id": "t_yves", "patient_ref": "MRN-400411",
                  "reason": "Sweep probe: verifying the deny path.", "ticket": "SWEEP-3",
                  "ttl_minutes": 15}, label="/api/v1/ops/break-glass (for deny)")
if bg2:
    check("POST", "/api/v1/ops/break-glass/" + bg2["id"] + "/deny", role="super_admin",
          body={"reason": "Insufficient justification for patient access"},
          label="/api/v1/ops/break-glass/{id}/deny",
          invariant=lambda p: (p["status"] == "revoked" and bool(p["denialReason"]),
                               "denial not recorded"))

check("POST", "/api/v1/ops/plans", role="super_admin",
      body={"tier": "pilot", "patch": {"priceLabel": "$18,500"},
            "reason": "Sweep probe pricing"},
      label="/api/v1/ops/plans update",
      invariant=lambda p: (p["existing_tenants_affected"] is False,
                           "plan edit repriced live tenants"))
check("POST", "/api/v1/ops/plans", role="super_admin",
      body={"tier": "free", "patch": {"calibration": "enterprise only"},
            "reason": "Attempt to gate a safety feature"},
      expect=403, label="/api/v1/ops/plans refuses gating a safety feature")

check("POST", "/api/v1/patient/intake", role="patient", expect=201,
      body={"describe": "Short of breath climbing stairs", "severity": 6,
            "getting_worse": True},
      label="/api/v1/patient/intake",
      invariant=lambda p: (p["scored"] is False, "a patient symptom report was scored"))
check("POST", "/api/v1/patient/previsit", role="patient", expect=201,
      body={"visit_with": "Dr Okonkwo", "questions": ["Can I travel?"]},
      label="/api/v1/patient/previsit")
check("GET", "/api/v1/patient/submissions", role="patient", invariant=nonempty("submissions"))
check("POST", "/api/v1/patient/family", role="patient", expect=201,
      body={"name": "Sweep Carer", "email": "carer@example.com", "relationship": "son",
            "scope": ["Visit summaries"]}, label="/api/v1/patient/family grant")
check("GET", "/api/v1/patient/family", role="patient", invariant=nonempty("family"))
check("GET", "/api/v1/settings/patient_prefs", role="patient")
check("PUT", "/api/v1/settings/patient_prefs", role="patient",
      body={"patch": {"language": "ar"}}, label="/api/v1/settings/patient_prefs save")
check("GET", "/api/v1/settings/patient_prefs", role="physician", expect=403,
      label="/api/v1/settings/patient_prefs refuses a clinician")
check("POST", "/api/v1/exports", role="patient",
      body={"kind": "patient_record", "reason": "Right of access request"}, expect=201,
      label="/api/v1/exports patient right of access")



# 10. gaps the user manual listed as "not yet" -----------------------------

roster = check("GET", "/api/v1/encounters", role="charge_nurse", label="/api/v1/encounters [for handoff]")
on_unit = next((e for e in (roster or {}).get("encounters", []) if e["state"] != "closed"), None)
if on_unit:
    check("POST", "/api/v1/handoffs", role="charge_nurse", expect=201,
          body={"unit_id": on_unit["unitId"], "notes": {on_unit["id"]: "Sweep probe note"}},
          label="/api/v1/handoffs send",
          invariant=lambda p: (any(x["note"] == "Sweep probe note" for x in p["patients"]), "note lost"))
    check("GET", "/api/v1/handoffs?unit_id=" + on_unit["unitId"], role="charge_nurse",
          label="/api/v1/handoffs list", invariant=nonempty("handoffs"))
check("POST", "/api/v1/handoffs", role="patient", body={"unit_id": "u_x"}, expect=403,
      label="/api/v1/handoffs refuses a patient")

worklist = check("GET", "/api/v1/encounters", role="physician", label="/api/v1/encounters [for ask]")
assessed = next((e for e in (worklist or {}).get("encounters", [])
                 if e["state"] not in {"intake_in_progress", "awaiting_assessment"}), None)
if assessed:
    check("POST", "/api/v1/encounters/" + assessed["id"] + "/ask", role="physician",
          body={"question": "Why is the ICU estimate where it is?"}, label="/api/v1/encounters/{id}/ask",
          invariant=lambda p: (p["grounded"] is True and bool(p["sources"]), "answer not grounded"))
    check("POST", "/api/v1/encounters/" + assessed["id"] + "/ask", role="patient",
          body={"question": "What is my risk?"}, expect=403, label="/api/v1/encounters/{id}/ask refuses a patient")

if new_enc:
    check("POST", "/api/v1/encounters/" + new_enc["id"] + "/vitals", role="physician", expect=201,
          body={"heart_rate": 88, "resp_rate": 18, "temp_c": 37.2, "spo2": 97,
                "labs": {"50912": 1.1}, "at_t0": True},
          label="/api/v1/encounters/{id}/vitals full set",
          invariant=lambda p: (p["values"]["spo2"] == 97 and p["values"]["labs"] == {"50912": 1.1},
                               "values dropped"))

check("POST", "/api/v1/auth/password/forgot", body={"email": ACCOUNTS["staff_nurse"]}, expect=202,
      label="/api/v1/auth/password/forgot")
resets = check("GET", "/api/v1/requests?kind=password_reset_request", role="tenant_owner",
               label="/api/v1/requests reset queue", invariant=nonempty("requests"))
reset = next((r for r in (resets or {}).get("requests", []) if r["status"] != "closed"), None)
if reset:
    check("POST", "/api/v1/requests/" + reset["id"] + "/status", role="tenant_owner",
          body={"status": "closed", "note": "Sweep probe"}, label="/api/v1/requests/{id}/status",
          invariant=lambda p: (p["status"] == "closed", "not closed"))
    check("POST", "/api/v1/requests/" + reset["id"] + "/status", role="patient",
          body={"status": "open"}, expect=403, label="/api/v1/requests/{id}/status refuses a patient")

check("POST", "/api/v1/exports", role="case_manager", expect=201,
      body={"kind": "discharge_packet", "reason": "Sweep probe discharge huddle"},
      label="/api/v1/exports discharge packet")

# --------------------------------------------------------------------------
fails = [r for r in results if r[0] == "FAIL"]
for status, method, label, detail in results:
    if status == "FAIL":
        print(f"  FAIL  {method:6} {label}\n          -> {detail}")

print(f"\n{len(results) - len(fails)}/{len(results)} checks passed", end="")
print(f" — {len(fails)} FAILED" if fails else " — all green")
sys.exit(1 if fails else 0)
