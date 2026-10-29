"""SQLite storage.

Shape of every entity table: the scalar columns the API actually filters or
sorts on, plus a ``doc`` column holding the full JSON object. Responses return
``doc`` verbatim, so what the client receives is the shape the frontend's
TypeScript already declares — the DB cannot silently reshape a payload, and
adding a filter is a column, not a migration of the contract.

Writes (acknowledge, invite, consent revoke, …) patch ``doc`` and mirror the
changed scalars, so filtering and payload never disagree.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable

from .config import settings

_local = threading.local()

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL,
  mode TEXT, plan TEXT, status TEXT, region TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL,
  name TEXT, role TEXT, status TEXT, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_users_tenant ON users(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email);

CREATE TABLE IF NOT EXISTS credentials (
  user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL, tenant_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL,
  tenant_id TEXT NOT NULL, issued_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  elevation TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT, role TEXT,
  status TEXT, token TEXT, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_invites_tenant ON invites(tenant_id);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, unit_id TEXT, state TEXT,
  mrn TEXT, patient_id TEXT, t0 TEXT, released INTEGER DEFAULT 0, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_enc_tenant ON encounters(tenant_id);
CREATE INDEX IF NOT EXISTS ix_enc_unit ON encounters(unit_id);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY, encounter_id TEXT, tenant_id TEXT, actor_id TEXT,
  created_at TEXT NOT NULL, request TEXT NOT NULL, response TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_assess_enc ON assessments(encounter_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, at TEXT NOT NULL, actor TEXT,
  action TEXT, severity TEXT, outcome TEXT, platform INTEGER DEFAULT 0, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_tenant_at ON audit_events(tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_platform ON audit_events(platform, at DESC);

CREATE TABLE IF NOT EXISTS break_glass (
  id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT, requested_at TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY, tenant_id TEXT, direction TEXT, state TEXT, path TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, tenant_name TEXT, severity TEXT, state TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY, patient_id TEXT, status TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY, patient_id TEXT, kind TEXT, date TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS care_team (
  id TEXT PRIMARY KEY, patient_id TEXT, doc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS released_results (
  id TEXT PRIMARY KEY, patient_id TEXT, encounter_id TEXT, released_at TEXT, doc TEXT NOT NULL
);

-- Configuration people edit from a console: org profile, integration config,
-- model display policy, global flags, plan definitions. Keyed by scope so one
-- table serves every settings screen, tenant-scoped or platform-wide.
CREATE TABLE IF NOT EXISTS settings (
  scope TEXT NOT NULL, tenant_id TEXT NOT NULL, doc TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT,
  PRIMARY KEY (scope, tenant_id)
);

-- Exports are a record, not a file. Anything leaving the system as patient
-- data is written here and to the audit log before the payload is handed over.
CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, kind TEXT NOT NULL,
  requested_by TEXT NOT NULL, requested_at TEXT NOT NULL,
  contains_phi INTEGER NOT NULL DEFAULT 0, reason TEXT, row_count INTEGER,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_exports_tenant ON exports(tenant_id, requested_at DESC);

-- Nurse task list (§12) — per encounter, per shift.
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, encounter_id TEXT,
  label TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
  done_by TEXT, done_at TEXT, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tasks_enc ON tasks(encounter_id);

-- Vitals recorded at intake. `at_t0` records whether the observation belongs
-- to the admission cut: anything taken later is stored but never scored.
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, encounter_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL, recorded_by TEXT, at_t0 INTEGER NOT NULL DEFAULT 1,
  doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_obs_enc ON observations(encounter_id, recorded_at DESC);

-- Requests a person raises for someone else to act on: a patient's message to
-- their care team, a record request, an account-team contact. See routers/requests.py.
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, requester TEXT NOT NULL,
  kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_requests_tenant ON service_requests(tenant_id, created_at DESC);

-- Shift handoffs (§12.4.1): the outgoing charge nurse's account of a unit,
-- read by whoever takes the next shift. A clinical hand-over inside the team,
-- not an export, so it is stored here rather than in `exports`.
CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, unit_id TEXT NOT NULL,
  created_at TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_handoffs_unit ON handoffs(tenant_id, unit_id, created_at DESC);

-- Early-access waitlist from the public site. Leads, not users: nobody here has
-- an account, and nothing here is patient data. Sales works the queue from the
-- ops console (status, owner, contact log in `doc`).
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  organization TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_waitlist_created ON waitlist(created_at);

-- Technical support: one ticket per conversation between a signed-in user and
-- platform staff. The message thread lives in `doc.messages`.
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, requester TEXT NOT NULL,
  status TEXT NOT NULL, priority TEXT NOT NULL, created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_support_requester ON support_tickets(requester, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_support_status ON support_tickets(status, updated_at DESC);

-- Platform-wide announcements shown in every signed-in shell (maintenance
-- windows, releases, outages), targeted by surface.
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY, audience TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, expires_at TEXT, doc TEXT NOT NULL
);

-- Polar subscriptions, one row per Polar subscription id. `owner_kind` says
-- whether it pays for a hospital tenant or for one individual's seat; the plan
-- it grants is written onto that tenant or user, and this row is the history.
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL, owner_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL, tier TEXT NOT NULL, status TEXT NOT NULL,
  updated_at TEXT NOT NULL, doc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_subs_owner ON subscriptions(owner_kind, owner_id, updated_at DESC);

-- Every Polar webhook delivery we accepted, keyed by its `webhook-id`. Polar
-- retries until it sees a 2xx, so the same event can arrive twice; a second
-- delivery of an id already here is acknowledged and not applied again.
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TEXT NOT NULL, doc TEXT NOT NULL
);

-- Reference data with no query surface: models, plans, drift, rollouts,
-- fairness, adoption, rbac, demo identities. One row per collection.
CREATE TABLE IF NOT EXISTS documents (
  key TEXT PRIMARY KEY, doc TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    """One connection per thread; FastAPI's threadpool reuses threads."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        path = settings().db_path
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


# Columns added after a table first shipped. `CREATE TABLE IF NOT EXISTS`
# leaves an existing table alone, so a database seeded by an older build needs
# them added — otherwise the first query that filters on one fails.
_ADDED_COLUMNS = (
    # A transfer belongs to the hospital it was sent to or from. Without it
    # every tenant's transfer queue listed every other tenant's patients.
    ("transfers", "tenant_id", "TEXT"),
    # Multi-factor auth (TOTP). Enrolment stores a secret; a code confirms it and
    # sets mfa_enabled, after which login requires a second factor.
    ("credentials", "mfa_secret", "TEXT"),
    ("credentials", "mfa_enabled", "INTEGER NOT NULL DEFAULT 0"),
)


def _migrate(conn: sqlite3.Connection) -> None:
    for table, column, decl in _ADDED_COLUMNS:
        existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}  # noqa: S608
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")  # noqa: S608
    # Rows written before the column existed were all the demo tenant's. Leaving
    # them NULL would hide them from everyone, which is safe but loses the queue.
    active = conn.execute("SELECT doc FROM documents WHERE key='active_tenant_id'").fetchone()
    if active:
        conn.execute("UPDATE transfers SET tenant_id=? WHERE tenant_id IS NULL", (json.loads(active["doc"]),))
    # Older builds derived the invite token from the id (`inv_i1`), which anyone
    # could type. Rotate those so an existing database is not left guessable.
    for row in conn.execute("SELECT id FROM invites WHERE token = 'inv_' || id").fetchall():
        conn.execute("UPDATE invites SET token=? WHERE id=?",
                     (f"inv_{secrets.token_urlsafe(24)}", row["id"]))


def init_schema() -> None:
    conn = connect()
    conn.executescript(SCHEMA)
    _migrate(conn)
    conn.commit()


def reset_connection() -> None:
    """Drop this thread's handle — used by tests switching DB files."""
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
        _local.conn = None


# --- helpers ---------------------------------------------------------------


def docs(sql: str, params: Iterable[Any] = ()) -> list[dict]:
    """Rows -> their `doc` payloads, in the query's order."""
    return [json.loads(r["doc"]) for r in connect().execute(sql, tuple(params))]


def one_doc(sql: str, params: Iterable[Any] = ()) -> dict | None:
    row = connect().execute(sql, tuple(params)).fetchone()
    return json.loads(row["doc"]) if row else None


def document(key: str, default: Any = None) -> Any:
    row = connect().execute("SELECT doc FROM documents WHERE key=?", (key,)).fetchone()
    return json.loads(row["doc"]) if row else default


def put_document(key: str, value: Any) -> None:
    conn = connect()
    conn.execute(
        "INSERT INTO documents(key, doc) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET doc=excluded.doc",
        (key, json.dumps(value)),
    )
    conn.commit()


def patch_doc(table: str, row_id: str, changes: dict, scalars: dict | None = None) -> dict | None:
    """Merge `changes` into a row's doc and mirror `scalars` onto its columns.

    A key set to None in `changes` is removed from the doc, which is how the
    frontend's optional fields (`acknowledgedBy`, …) are cleared.
    """
    conn = connect()
    row = conn.execute(f"SELECT doc FROM {table} WHERE id=?", (row_id,)).fetchone()  # noqa: S608 - fixed set of callers
    if row is None:
        return None
    doc = json.loads(row["doc"])
    for k, v in changes.items():
        if v is None:
            doc.pop(k, None)
        else:
            doc[k] = v
    sets = ["doc=?"]
    params: list[Any] = [json.dumps(doc)]
    for col, val in (scalars or {}).items():
        sets.append(f"{col}=?")
        params.append(val)
    params.append(row_id)
    conn.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE id=?", params)  # noqa: S608
    conn.commit()
    return doc


def insert_doc(table: str, doc: dict, scalars: dict) -> dict:
    conn = connect()
    cols = ["id", *scalars.keys(), "doc"]
    vals = [doc["id"], *scalars.values(), json.dumps(doc)]
    conn.execute(
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",  # noqa: S608
        vals,
    )
    conn.commit()
    return doc


def is_seeded() -> bool:
    try:
        return connect().execute("SELECT 1 FROM tenants LIMIT 1").fetchone() is not None
    except sqlite3.OperationalError:
        return False


def seed_file() -> dict:
    path: Path = settings().seed_path
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)
