/**
 * Route smoke test.
 *
 * Renders every route in the product with every role that can reach it, and
 * fails on any thrown error or console error. It is deliberately shallow — it
 * proves the screens mount and render against the mock data, which is the
 * failure mode that matters while there is no backend to integration-test.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { useSession } from "./lib/session";
import type { RoleCode } from "./lib/rbac";
import { applyDataset } from "./mock/db";
import { loadFixture } from "./test/fixture";
import seed from "./mock/seed.json";

type Case = { path: string; role: RoleCode };

const CASES: Case[] = [
  // Public & auth
  { path: "/", role: "physician" },
  { path: "/product", role: "guest" },
  { path: "/pricing", role: "guest" },
  { path: "/security", role: "guest" },
  { path: "/evidence", role: "guest" },
  { path: "/login", role: "guest" },
  { path: "/signup", role: "guest" },
  { path: "/invite/inv_demo_token", role: "guest" },
  { path: "/welcome", role: "patient" },

  // Clinician — doctor
  { path: "/doctor/worklist", role: "physician" },
  { path: "/doctor/worklist", role: "resident" },
  { path: "/doctor/worklist", role: "np_pa" },
  { path: "/doctor/discharge", role: "case_manager" },
  { path: "/doctor/encounters/new", role: "physician" },
  { path: "/doctor/encounters/enc_1000/intake", role: "physician" },
  { path: "/doctor/encounters/enc_1000/results", role: "physician" },
  { path: "/doctor/encounters/enc_1000/results", role: "resident" },
  { path: "/doctor/encounters/enc_1000/results", role: "pharmacist" },
  { path: "/doctor/encounters/enc_1005/results", role: "physician" },
  { path: "/doctor/encounters/enc_1000/timeline", role: "physician" },
  { path: "/doctor/encounters/enc_1000/history", role: "physician" },

  // Clinician — nurse
  { path: "/nurse/roster", role: "charge_nurse" },
  { path: "/nurse/my-patients", role: "staff_nurse" },
  { path: "/nurse/triage", role: "staff_nurse" },
  { path: "/nurse/handoff", role: "charge_nurse" },
  { path: "/nurse/encounters/new", role: "staff_nurse" },
  { path: "/nurse/encounters/enc_1000/intake", role: "staff_nurse" },
  { path: "/nurse/encounters/enc_1000/vitals", role: "staff_nurse" },
  { path: "/nurse/encounters/enc_1000/results", role: "charge_nurse" },

  // Shared clinical
  { path: "/models", role: "physician" },
  { path: "/help", role: "physician" },

  // Admin console
  { path: "/admin/home", role: "tenant_owner" },
  { path: "/admin/roster", role: "tenant_owner" },
  { path: "/admin/roster", role: "it_admin" },
  { path: "/admin/invites", role: "tenant_owner" },
  { path: "/admin/facilities", role: "tenant_owner" },
  { path: "/admin/roles", role: "tenant_owner" },
  { path: "/admin/integrations", role: "it_admin" },
  { path: "/admin/models", role: "tenant_owner" },
  { path: "/admin/usage", role: "auditor" },
  { path: "/admin/fairness", role: "privacy_officer" },
  { path: "/admin/interop", role: "tenant_owner" },
  { path: "/admin/audit", role: "privacy_officer" },
  { path: "/admin/billing", role: "billing_admin" },
  { path: "/admin/org", role: "tenant_owner" },

  // Ops console
  { path: "/ops/fleet", role: "super_admin" },
  { path: "/ops/provision", role: "super_admin" },
  { path: "/ops/tenants/t_yves", role: "super_admin" },
  { path: "/ops/tenants/t_brakewell", role: "super_admin" },
  { path: "/ops/rollout", role: "super_admin" },
  { path: "/ops/config", role: "super_admin" },
  { path: "/ops/break-glass", role: "super_admin" },
  { path: "/ops/audit", role: "super_admin" },
  { path: "/ops/incidents", role: "super_admin" },
  { path: "/ops/plans", role: "super_admin" },

  // Patient portal
  { path: "/patient/home", role: "patient" },
  { path: "/patient/home", role: "guest" },
  { path: "/patient/intake", role: "patient" },
  { path: "/patient/previsit", role: "patient" },
  { path: "/patient/results", role: "patient" },
  { path: "/patient/records", role: "patient" },
  { path: "/patient/sharing", role: "patient" },
  { path: "/patient/care-team", role: "patient" },
  { path: "/patient/family", role: "patient" },
  { path: "/patient/settings", role: "patient" },

  // Design system
  { path: "/design", role: "physician" },
  { path: "/design/permissions", role: "tenant_owner" },
  { path: "/design/coverage", role: "super_admin" },

  // Unrouted
  { path: "/no/such/screen", role: "physician" },
];

afterEach(cleanup);

async function renderRoute(path: string, role: RoleCode) {
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));

  useSession.setState({ authenticated: true, role });

  expect(() =>
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <I18nProvider>
            <App />
          </I18nProvider>
        </MemoryRouter>
      </ThemeProvider>,
    ),
  ).not.toThrow();

  // Screens behind sign-in are lazy chunks. Wait for the real screen, not
  // the loading placeholder, or this would pass without rendering it.
  await waitFor(() => expect(document.querySelector(".route-loading")).toBeNull());

  spy.mockRestore();
  expect(errors, `console.error during ${path}`).toEqual([]);
}

describe("every route renders", () => {
  for (const { path, role } of CASES) {
    it(`${path} as ${role}`, () => renderRoute(path, role));
  }
});

/**
 * The same routes for a brand-new account: a self-serve patient with no
 * records, a hospital with no invoices, a seat with no units. Screens must show
 * an empty state, never index into a list the fixture happened to fill.
 */
describe("every route renders with no data", () => {
  beforeAll(() => {
    applyDataset({
      ...seed,
      facilities: [], users: [], invites: [], encounters: [], audit_events: [], platform_audit: [],
      break_glass: [], transfers: [], incidents: [], invoices: [], released_results: [], consents: [],
      care_team: [], records: [], adoption_series: [], subgroup_fairness: [], drift: [], rollouts: [],
    } as typeof seed);
  });
  afterAll(() => loadFixture("restored after the empty-data run"));

  for (const { path, role } of CASES) {
    it(`${path} as ${role}`, () => renderRoute(path, role));
  }
});
