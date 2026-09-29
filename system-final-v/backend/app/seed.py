"""Load seed/seed.json into SQLite.

`seed.json` is the single source of the demo dataset. It was produced once by
the seeded generator the UI shipped with, and the frontend now loads the same
file as its offline fixture — so the API and the mock layer serve one dataset.
`npm run seed:dump` in the frontend copies it here; edit the JSON, not a copy.

    python -m app.seed            # seed if empty
    python -m app.seed --reset    # drop the DB file and reseed

Every account gets the same demo password. These are synthetic identities in a
synthetic tenant; the constant is printed at seed time rather than hidden, so
nobody mistakes it for a secret.
"""

from __future__ import annotations

import argparse
import json
import secrets
import sys

from . import db, evidence
from .config import settings
from .security import expiry, hash_password, iso

DEMO_PASSWORD = "esap-demo"
DEMO_PATIENT_ID = "pat_demo_salib"


def _clear() -> None:
    conn = db.connect()
    for table in (
        "tenants", "facilities", "users", "credentials", "sessions", "invites",
        "encounters", "assessments", "audit_events", "break_glass", "transfers",
        "incidents", "invoices", "consents", "records", "care_team",
        "released_results", "documents", "settings", "exports", "tasks", "observations", "service_requests",
        "handoffs",
    ):
        conn.execute(f"DELETE FROM {table}")  # noqa: S608 - fixed table list
    conn.commit()


def load(seed: dict | None = None) -> None:
    seed = seed or db.seed_file()
    conn = db.connect()
    _clear()

    def put(table: str, rows: list, scalars) -> None:
        for row in rows:
            cols = scalars(row)
            names = ["id", *cols.keys(), "doc"]
            conn.execute(
                f"INSERT OR REPLACE INTO {table} ({', '.join(names)}) "  # noqa: S608
                f"VALUES ({', '.join('?' * len(names))})",
                [row["id"], *cols.values(), json.dumps(row)],
            )

    put("tenants", seed["tenants"], lambda t: {
        "slug": t["slug"], "name": t["name"], "mode": t["mode"],
        "plan": t["plan"], "status": t["status"], "region": t["region"],
    })
    put("facilities", seed["facilities"], lambda f: {"tenant_id": f["tenantId"], "name": f["name"]})
    put("users", seed["users"], lambda u: {
        "tenant_id": u["tenantId"], "email": u["email"], "name": u["name"],
        "role": u["roles"][0], "status": u["status"],
    })
    put("invites", seed["invites"], lambda i: {
        "tenant_id": i["tenantId"], "email": i["email"], "role": i["role"],
        # Random, never derived from the id: an invite link is a credential,
        # and `inv_i1` is one anybody could type.
        "status": i["status"], "token": f"inv_{secrets.token_urlsafe(24)}",
    })
    put("encounters", seed["encounters"], lambda e: {
        "tenant_id": e["tenantId"], "unit_id": e["unitId"], "state": e["state"],
        "mrn": e["patient"]["mrn"], "patient_id": e["patient"]["id"], "t0": e["t0"],
        "released": 1 if e.get("releasedToPatient") else 0,
    })
    # The dataset is a fixed snapshot, so its one "active" grant would already
    # have run out by the time anyone resets the demo. Active means active: it
    # starts its clock at load, so the approved-grant path can be walked.
    for b in seed["break_glass"]:
        if b["status"] == "active":
            b["expiresAt"] = iso(expiry(b["ttlMinutes"] / 60))
    put("break_glass", seed["break_glass"], lambda b: {
        "tenant_id": b["tenantId"], "status": b["status"], "requested_at": b["requestedAt"],
    })
    put("transfers", seed["transfers"], lambda t: {
        "tenant_id": t.get("tenantId", seed["active_tenant_id"]),
        "direction": t["direction"], "state": t["state"], "path": t["path"],
    })
    put("incidents", seed["incidents"], lambda i: {
        "tenant_name": i["tenantName"], "severity": i["severity"], "state": i["state"],
    })
    put("invoices", seed["invoices"], lambda i: {
        "tenant_id": seed["active_tenant_id"], "status": i["status"],
    })

    # Patient-portal collections belong to the one demo patient identity (§13).
    put("consents", seed["consents"], lambda c: {"patient_id": DEMO_PATIENT_ID, "status": c["status"]})
    put("records", seed["records"], lambda r: {
        "patient_id": DEMO_PATIENT_ID, "kind": r["kind"], "date": r["date"],
    })
    put("care_team", seed["care_team"], lambda c: {"patient_id": DEMO_PATIENT_ID})
    put("released_results", seed["released_results"], lambda r: {
        "patient_id": DEMO_PATIENT_ID, "encounter_id": r["encounterId"], "released_at": r["releasedAt"],
    })

    for ev in seed["audit_events"]:
        conn.execute(
            "INSERT OR REPLACE INTO audit_events (id, tenant_id, at, actor, action, severity, outcome, platform, doc)"
            " VALUES (?,?,?,?,?,?,?,0,?)",
            (ev["id"], ev["tenantId"], ev["at"], ev["actor"], ev["action"],
             ev["severity"], ev["outcome"], json.dumps(ev)),
        )
    for ev in seed["platform_audit"]:
        conn.execute(
            "INSERT OR REPLACE INTO audit_events (id, tenant_id, at, actor, action, severity, outcome, platform, doc)"
            " VALUES (?,?,?,?,?,?,?,1,?)",
            (ev["id"], ev["tenantId"], ev["at"], ev["actor"], ev["action"],
             ev["severity"], ev["outcome"], json.dumps(ev)),
        )

    for key in ("models", "plans", "drift", "rollouts", "adoption_series",
                "subgroup_fairness", "rbac", "demo_identity", "now", "active_tenant_id"):
        conn.execute(
            "INSERT OR REPLACE INTO documents(key, doc) VALUES(?,?)",
            (key, json.dumps(seed[key])),
        )

    # Which clinical patients the demo portal account speaks for: the ones whose
    # released results the seed files under it. A release for anyone else goes
    # to that patient's own record, never into this portal.
    by_encounter = {e["id"]: e["patient"]["id"] for e in seed["encounters"]}
    links = {by_encounter[r["encounterId"]]: DEMO_PATIENT_ID
             for r in seed["released_results"] if r["encounterId"] in by_encounter}
    conn.execute("INSERT OR REPLACE INTO documents(key, doc) VALUES(?,?)",
                 ("portal_links", json.dumps(links)))

    _seed_credentials(seed)
    conn.commit()
    # Model evidence comes from the training runs' metrics files, not the seed.
    evidence.refresh()
    _assess_seeded_encounters()


#: Encounters that have been scored at least once. The rest are still in intake.
_ASSESSED_STATES = {"assessed", "acknowledged", "awaiting_cosign", "closed"}


def _intake_for(enc: dict) -> dict:
    """A plausible admission record for one seeded encounter.

    Deterministic per encounter id, and built only from what the encounter
    already says (age, sex, arrival route, whether there is prior history,
    whether there is a note), so the same database always seeds the same
    patients. It is synthetic, like everything in the demo database.
    """
    import hashlib
    import random

    from .catalogs import CCSR, LABS, MEDS

    rnd = random.Random(int(hashlib.md5(enc["id"].encode()).hexdigest(), 16))
    p = enc["patient"]
    labs = {}
    for lab in rnd.sample(LABS, k=min(len(LABS), rnd.randint(3, 7))):
        lo, hi = lab.get("ref_low"), lab.get("ref_high")
        if lo is None or hi is None:
            continue
        span = hi - lo
        labs[lab["itemid"]] = round(rnd.uniform(lo - span * 0.3, hi + span * 0.5), 2)
    history = bool(enc.get("hasPriorHistory"))
    height = rnd.randint(150, 190)
    weight = rnd.randint(50, 110)
    features = {
        "demographics": {"admission_age": int(p["age"]), "is_female": 1 if p["sex"] == "F" else 0},
        "admission_context": {"via_ed": 1 if enc.get("viaEd") else 0,
                              "admission_type": enc.get("admissionType") or "EW EMER.",
                              "admission_location": "EMERGENCY ROOM" if enc.get("viaEd") else "PHYSICIAN REFERRAL"},
        "vitals": {"bp_sys": rnd.randint(95, 175), "bp_dia": rnd.randint(55, 100),
                   "weight_kg": weight, "height_cm": height,
                   "bmi": round(weight / (height / 100) ** 2, 1)},
        "labs": labs,
        "prior_history": {
            "prior_ccsr": [c["ccsr"] for c in rnd.sample(CCSR, k=rnd.randint(1, 3))] if history else [],
            "n_prior_admissions": rnd.randint(1, 5) if history else 0,
            "charlson_index": rnd.randint(1, 7) if history else 0,
        },
        "meds": rnd.sample(MEDS, k=rnd.randint(1, 5)) if history else [],
    }
    if enc.get("hasNotes") and enc.get("chiefComplaint"):
        features["notes"] = {"chief_complaint": enc["chiefComplaint"]}
    return {"features": features, "encounter_id": enc["id"]}


def _assess_seeded_encounters() -> None:
    """Score every seeded encounter that is past intake, through the same
    assessor `/assess` uses, and store the result.

    The seed file carries no risk numbers of its own: every estimate, driver
    and differential a screen shows for a seeded patient was produced by the
    serving models, exactly as for a patient admitted through the UI.
    """
    from . import assembler
    from .schemas.clinical import IntakeRequest

    conn = db.connect()
    for enc in db.docs("SELECT doc FROM encounters"):
        if enc.get("state") not in _ASSESSED_STATES:
            continue
        req = IntakeRequest.model_validate(_intake_for(enc))
        response = assembler.assess(req)
        patch = assembler.worklist_patch(response)
        patch.pop("state", None)  # keep acknowledged / awaiting co-sign / closed as seeded
        patch["assessmentCount"] = max(1, int(enc.get("assessmentCount") or 1))
        at = enc.get("lastAssessedAt") or enc.get("t0")
        conn.execute(
            "INSERT OR REPLACE INTO assessments (id, encounter_id, tenant_id, actor_id, created_at, request, response)"
            " VALUES (?,?,?,?,?,?,?)",
            (response.request_id, enc["id"], enc["tenantId"], "seed", at,
             req.model_dump_json(), response.model_dump_json()),
        )
        db.patch_doc("encounters", enc["id"], patch)
    conn.commit()


def _seed_credentials(seed: dict) -> None:
    """One sign-in per demo role, plus every directory user.

    The role identities in `demo_identity` are what the sign-in screen offers;
    the directory users exist so the admin roster is backed by real accounts
    rather than display-only rows.
    """
    conn = db.connect()
    pw = hash_password(DEMO_PASSWORD)
    tenant = seed["active_tenant_id"]
    seen: set[str] = set()
    # A demo sign-in that is also in the directory takes the directory's id.
    # Suspension, password reset and role changes end sessions by user id, so
    # a login under a different id than its roster row would survive them.
    directory = {(u["email"], u["roles"][0]): u["id"] for u in seed["users"]}

    for role, ident in seed["demo_identity"].items():
        if role == "guest" or ident["email"] in seen:
            continue
        seen.add(ident["email"])
        user_id = DEMO_PATIENT_ID if role == "patient" else directory.get((ident["email"], role), f"demo_{role}")
        conn.execute(
            "INSERT OR REPLACE INTO credentials (user_id, email, password_hash, role, tenant_id)"
            " VALUES (?,?,?,?,?)",
            (user_id, ident["email"], pw, role, tenant),
        )

    for u in seed["users"]:
        if u["email"] in seen or u["status"] != "active":
            continue
        seen.add(u["email"])
        conn.execute(
            "INSERT OR REPLACE INTO credentials (user_id, email, password_hash, role, tenant_id)"
            " VALUES (?,?,?,?,?)",
            (u["id"], u["email"], pw, u["roles"][0], u["tenantId"]),
        )
    conn.commit()


def ensure_seeded() -> None:
    db.init_schema()
    if not db.is_seeded():
        load()
    else:
        # A re-evaluated model shows up on the next start, no reseed needed.
        evidence.refresh()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Seed the ESAP demo database.")
    ap.add_argument("--reset", action="store_true", help="delete the DB file first")
    args = ap.parse_args(argv)

    path = settings().db_path
    if args.reset:
        db.reset_connection()
        for suffix in ("", "-wal", "-shm"):
            p = path.with_name(path.name + suffix)
            p.unlink(missing_ok=True)

    db.init_schema()
    load()
    n = db.connect().execute("SELECT count(*) c FROM encounters").fetchone()["c"]
    print(f"seeded {path} — {n} encounters; demo password for every account: {DEMO_PASSWORD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
