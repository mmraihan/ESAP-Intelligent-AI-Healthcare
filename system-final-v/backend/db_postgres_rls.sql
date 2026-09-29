-- ESAP — Postgres Row-Level Security policies for pooled multi-tenancy (§6.1 / §15.2.3)
--
-- Apply this AFTER creating the schema on Postgres (DATABASE_URL set, DEPLOYMENT_MODE=pool).
-- It turns the app-layer `WHERE tenant_id = ?` isolation into database-enforced
-- isolation: even a query that forgets the WHERE clause, or a compromised app row,
-- cannot read or write another hospital's data.
--
-- The app sets the active tenant once per request, on the same connection, before
-- any tenant query runs:
--
--     SET LOCAL app.tenant_id = '<tenant_id>';   -- inside the request's transaction
--
-- and the platform (super-admin) path, which is legitimately cross-tenant, runs as
-- a role that BYPASSES RLS (see the bypass note at the foot of this file) and writes
-- an audit row for every cross-tenant read (§9.4.8).
--
-- current_setting('app.tenant_id', true) returns NULL when unset, so a connection
-- that never set a tenant sees NOTHING rather than everything — fail-closed.

-- A helper keeps every policy identical and readable.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant_id', true) $$;

DO $$
DECLARE
  t text;
  -- Every table that carries a tenant_id column (see app/db.py schema).
  tenant_tables text[] := ARRAY[
    'facilities','users','credentials','sessions','invites','encounters','assessments',
    'audit_events','break_glass','transfers','invoices','settings','exports','tasks',
    'observations','service_requests','handoffs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    -- FORCE so the table owner is subject to RLS too; only a BYPASSRLS role is exempt.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    $f$, t);
  END LOOP;
END $$;

-- Platform / super-admin access is legitimately cross-tenant (fleet console,
-- break-glass). Run it under a dedicated role that bypasses RLS, and only ever
-- behind the audited break-glass path — never the default application role:
--
--   CREATE ROLE esap_app        LOGIN PASSWORD '...';               -- the app; RLS applies
--   CREATE ROLE esap_platform   LOGIN PASSWORD '...' BYPASSRLS;     -- audited cross-tenant only
--   GRANT esap_app TO ...; GRANT esap_platform TO ...;
--
-- The `tenants` table itself is intentionally NOT under per-row RLS: it is the
-- directory the control plane reads to route a request to its tenant, and it holds
-- no patient data. Tables without a tenant_id (consents, records, care_team,
-- released_results, incidents, documents) are scoped by their parent row's tenant
-- in the app today; give them a tenant_id column and add them to the array above
-- to bring them under RLS as well.
