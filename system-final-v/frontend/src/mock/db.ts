/**
 * The demo dataset, as a hydratable store.
 *
 * This used to generate the data in the browser. It now *holds* it: the
 * generator was retired and `seed.json` is the source of truth, shared with
 * the backend's SQLite seeder (`npm run seed:dump` syncs the two copies). One
 * dataset, two consumers that cannot drift apart.
 *
 * The exported bindings are the same names, same shapes, same order as before,
 * so no screen had to change. They are filled by `hydrate()` at boot:
 *
 *   1. from the API, when the backend is reachable — the live system, with
 *      writes (acknowledge, invite, consent revoke) actually persisting;
 *   2. from the bundled `seed.json` otherwise — which keeps the build's
 *      "runs offline, no network calls" promise intact for a demo on a plane.
 *
 * `SOURCE.kind` says which one happened, and the shell surfaces it, because a
 * demo that silently falls back to fixtures looks identical to a working
 * system right up until someone asks why their edit did not save.
 *
 * Two rules this file still keeps, because they are product guarantees:
 *  1. Nothing here is real PHI. Names, MRNs and dates are synthetic.
 *  2. Audit covariates (race, insurance, marital status) exist on the patient
 *     record because the fairness panel reports on them — no screen feeds them
 *     into a prediction, and no clinical surface displays them.
 */

import type {
  AuditEvent,
  BreakGlassGrant,
  CareTeamMember,
  ConsentGrant,
  DirectoryUser,
  DriftPoint,
  Encounter,
  Facility,
  Incident,
  Invite,
  Invoice,
  ModelCard,
  PlanDefinition,
  RecordDocument,
  ReleasedResult,
  RolloutStage,
  Tenant,
  TransferRequest,
  Unit,
} from "./types";
import type { RoleCode } from "@/lib/rbac";

// --- where the data came from ----------------------------------------------

export type DataSource =
  | { kind: "api"; base: string }
  | { kind: "offline"; reason: string }
  /** Tests only: the fixture loaded by `src/test/fixture.ts`. Never in the app. */
  | { kind: "fixture"; reason: string };

export const SOURCE: { current: DataSource } = {
  current: { kind: "offline", reason: "not connected yet" },
};

// --- change notification ----------------------------------------------------
// The collections below are filled in place so that a module which captured a
// reference at import time keeps seeing the data. That is deliberate, but it
// means React sees no new object and will not re-render on its own. Screens
// subscribe to this counter instead; `applyDataset` bumps it once per load.

let version = 0;
const listeners = new Set<() => void>();

export function subscribeToData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dataVersion(): number {
  return version;
}

// --- the collections every screen imports ----------------------------------
// Mutable module state, filled in place by `hydrate()`. The arrays keep their
// identity across hydration so a module that captured a reference at import
// time still sees the data.

/** Fixed "now" so relative timestamps are stable across demo sessions. */
export let NOW = new Date();

/** False only when a signed-in patient's own hospital turned the portal off
 *  (Settings → Org → "Allow patients to see released results"). Every other
 *  role always reads true. */
export let PATIENT_PORTAL_ENABLED = true;

export const TENANTS: Tenant[] = [];
export const FACILITIES: Facility[] = [];
export const ALL_UNITS: Unit[] = [];
export const USERS: DirectoryUser[] = [];
export const INVITES: Invite[] = [];
export const ENCOUNTERS: Encounter[] = [];
export const MODELS: ModelCard[] = [];
export const ROLLOUTS: RolloutStage[] = [];
export const DRIFT: DriftPoint[] = [];
export const AUDIT_EVENTS: AuditEvent[] = [];
export const PLATFORM_AUDIT: AuditEvent[] = [];
export const BREAK_GLASS: BreakGlassGrant[] = [];
export const TRANSFERS: TransferRequest[] = [];
export const INCIDENTS: Incident[] = [];
export const INVOICES: Invoice[] = [];
export const PLANS: PlanDefinition[] = [];
export const RELEASED_RESULTS: ReleasedResult[] = [];
export const CONSENTS: ConsentGrant[] = [];
export const CARE_TEAM: CareTeamMember[] = [];
export const RECORDS: RecordDocument[] = [];

export const ADOPTION_SERIES: {
  week: string;
  assessments: number;
  acknowledgedPct: number;
  activeClinicians: number;
}[] = [];

export const SUBGROUP_FAIRNESS: {
  subgroup: string;
  n: number;
  auroc: number;
  ece: number;
  flagRate: number;
}[] = [];

/** The tenant every tenant-scoped console renders by default. */
export const ACTIVE_TENANT = {} as Tenant;

/** The identities the demo role-switcher can sign in as. */
export const DEMO_IDENTITY = {} as Record<RoleCode, { name: string; email: string; title: string }>;

export function encounterById(id: string): Encounter | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

// --- hydration --------------------------------------------------------------

function fill<T>(target: T[], rows: readonly T[] | undefined): void {
  target.length = 0;
  if (rows) target.push(...rows);
}

function assign<T extends object>(target: T, source: T | undefined): void {
  for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
  if (source) Object.assign(target, source);
}

/** The shape of a full dataset, as `/api/v1/bootstrap` returns it. Type only — no data is bundled. */
export type Seed = typeof import("./seed.json");

/** Load one dataset — from the API payload or the bundled seed — into the store. */
export function applyDataset(data: Seed): void {
  NOW = new Date(data.now);
  PATIENT_PORTAL_ENABLED = (data as { patient_portal_enabled?: boolean }).patient_portal_enabled ?? true;

  fill(TENANTS, data.tenants as Tenant[]);
  fill(FACILITIES, data.facilities as Facility[]);
  fill(ALL_UNITS, (data.facilities as Facility[]).flatMap((f) => f.units));
  fill(USERS, data.users as DirectoryUser[]);
  fill(INVITES, data.invites as Invite[]);
  fill(ENCOUNTERS, data.encounters as Encounter[]);
  fill(MODELS, data.models as ModelCard[]);
  fill(ROLLOUTS, data.rollouts as RolloutStage[]);
  fill(DRIFT, data.drift as DriftPoint[]);
  fill(AUDIT_EVENTS, data.audit_events as AuditEvent[]);
  fill(PLATFORM_AUDIT, data.platform_audit as AuditEvent[]);
  fill(BREAK_GLASS, data.break_glass as BreakGlassGrant[]);
  fill(TRANSFERS, data.transfers as TransferRequest[]);
  fill(INCIDENTS, data.incidents as Incident[]);
  fill(INVOICES, data.invoices as Invoice[]);
  fill(PLANS, data.plans as PlanDefinition[]);
  fill(RELEASED_RESULTS, data.released_results as ReleasedResult[]);
  fill(CONSENTS, data.consents as ConsentGrant[]);
  fill(CARE_TEAM, data.care_team as CareTeamMember[]);
  fill(RECORDS, data.records as RecordDocument[]);
  fill(ADOPTION_SERIES, data.adoption_series);
  fill(SUBGROUP_FAIRNESS, data.subgroup_fairness);

  const active =
    (data.tenants as Tenant[]).find((t) => t.id === data.active_tenant_id) ??
    (data.tenants as Tenant[])[0];
  assign(ACTIVE_TENANT, active);
  assign(
    DEMO_IDENTITY,
    data.demo_identity as Record<RoleCode, { name: string; email: string; title: string }>,
  );

  version += 1;
  for (const listener of listeners) listener();
}

/**
 * What a visitor who has not signed in can see: the model evidence and plans
 * for the public site, and the demo picker's accounts. From the public API
 * endpoints — the app ships no data of its own.
 */
export function applyPublic(data: {
  models: ModelCard[];
  plans: PlanDefinition[];
  demoAccounts: Record<string, { name: string; email: string; title: string }>;
}): void {
  for (const list of [TENANTS, FACILITIES, ALL_UNITS, USERS, INVITES, ENCOUNTERS, ROLLOUTS, DRIFT,
    AUDIT_EVENTS, PLATFORM_AUDIT, BREAK_GLASS, TRANSFERS, INCIDENTS, INVOICES, RELEASED_RESULTS,
    CONSENTS, CARE_TEAM, RECORDS, ADOPTION_SERIES, SUBGROUP_FAIRNESS] as unknown[][]) {
    list.length = 0;
  }
  fill(MODELS, data.models);
  fill(PLANS, data.plans);
  assign(ACTIVE_TENANT, undefined);
  assign(DEMO_IDENTITY, data.demoAccounts as Record<RoleCode, { name: string; email: string; title: string }>);
  version += 1;
  for (const listener of listeners) listener();
}

/** Signal a change of data source (for example, the API became unreachable). */
export function notifyDataChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}
