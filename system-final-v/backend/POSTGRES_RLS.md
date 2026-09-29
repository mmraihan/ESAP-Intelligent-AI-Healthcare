# Postgres + Row-Level Security (multi-hospital pooled tenancy)

**Status: config seam + policies delivered; activation requires a Postgres server.**

The default build runs on a single SQLite file (`ESAP_DB_PATH`) with tenant
isolation enforced in the application layer (`tenant_scope` + `WHERE tenant_id = ?`,
covered by `tests/test_access_regressions.py`). For a multi-hospital **pool**
deployment (§5), move the store to Postgres and let the **database** enforce
isolation with Row-Level Security, so a missing `WHERE` clause or a compromised
query still cannot cross a tenant boundary.

This is not wired into the SQLite default because it needs a running Postgres
instance to be correct and testable; shipping an unverified port would put the
working build at risk. What is delivered here:

1. **Config seam** — `app/config.py` reads `DATABASE_URL` and `DEPLOYMENT_MODE`
   (`single_tenant` | `pool` | `silo`) and exposes `settings().uses_postgres`.
2. **RLS policies** — `db_postgres_rls.sql`, applied after the schema, enables and
   *forces* RLS on every tenant-scoped table with a fail-closed policy keyed on
   `current_setting('app.tenant_id')`.
3. **This runbook.**

## Activating it

```bash
# 1. Provision Postgres and point the app at it.
export DATABASE_URL="postgresql://esap_app:...@db.internal:5432/esap"
export DEPLOYMENT_MODE=pool

# 2. Create the schema (port app/db.py DDL to Postgres types — TEXT/JSONB), then:
psql "$DATABASE_URL" -f db_postgres_rls.sql

# 3. Two roles: the app (RLS applies) and an audited platform role (BYPASSRLS).
#    See the role block at the foot of db_postgres_rls.sql.
```

## The one line the app must run per request

RLS keys off a per-connection setting. The request that has resolved its actor
sets the tenant on its transaction before any tenant query:

```sql
SET LOCAL app.tenant_id = '<actor.tenant_id>';
```

In FastAPI terms this belongs in `deps.tenant_scope` (or a DB-session dependency)
when `settings().uses_postgres` is true — set it on the checked-out connection at
the start of the request's transaction. `SET LOCAL` scopes it to that transaction,
so a pooled connection never leaks one tenant's setting into the next request.

`current_setting('app.tenant_id', true)` returns NULL when unset, and the policy
compares `tenant_id = NULL` → no rows. A connection that forgets to set the tenant
therefore sees **nothing**, which is the safe direction.

## Platform (super-admin) cross-tenant access

The fleet console and break-glass are legitimately cross-tenant. They run under the
`esap_platform` role (`BYPASSRLS`) and **only** behind the audited break-glass path
(`break_glass.invoke` is written before any cross-tenant read, per §9.4.8). The
default application role is `esap_app`, to which RLS always applies.

## What still needs doing to go live on Postgres

- Port the DDL in `app/db.py` to Postgres types (TEXT stays; consider `JSONB` for the
  `doc` columns; `INTEGER`/`BOOLEAN` where SQLite used `INTEGER`).
- Replace the `sqlite3` driver in `app/db.py` with `psycopg` behind the
  `settings().uses_postgres` switch (placeholders `?` → `%s`, `Row` → dict cursor).
- Set `app.tenant_id` in the request path as above.
- Give `consents`, `records`, `care_team`, `released_results`, `incidents`,
  `documents` a `tenant_id` column and add them to the policy array.
- Run `tests/test_access_regressions.py` against Postgres in CI.
