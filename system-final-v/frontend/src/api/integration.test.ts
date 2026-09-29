// @vitest-environment node
//
// Node, not jsdom: this talks to the real server, and a browser-like origin
// would make it a CORS test rather than a contract test.

/**
 * Integration: the boot + sign-in path against a real backend.
 *
 * Skipped automatically when the API is not running, so `npm test` stays
 * offline-clean. Start the backend and it runs:
 *
 *   cd ../backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000
 *
 * This is the seam the unit tests cannot cover: the store hydrates from a
 * *server* payload rather than the bundled fixture, and the two have to be
 * interchangeable. If the backend ever reshapes a collection, this fails here
 * instead of as an undefined property inside a screen.
 */

import { describe, expect, it, vi } from "vitest";
import { API_BASE, api, getToken, setToken } from "./client";
import { hydrateFromApi } from "./bootstrap";
import { ENCOUNTERS, INVITES, MODELS, SOURCE, TENANTS, USERS, dataVersion } from "@/mock/db";
import { boot, hydratePublic } from "./bootstrap";
import type { AssessResponse } from "@/mock/clinical-types";
import { SAMPLE_PROFILES, toFeatures } from "@/apps/clinician/intakeForm";

const DEMO_PASSWORD = "esap-demo";

/**
 * Probed at module scope, not in `beforeAll`: vitest decides describe vs
 * describe.skip while *collecting*, which happens before any hook runs. A
 * probe in beforeAll always reads false and silently skips the whole suite.
 */
const reachable = await fetch(`${API_BASE}/readyz`)
  .then((r) => r.ok)
  .catch(() => false);

if (!reachable) {
  console.info(`[esap] API not reachable at ${API_BASE} — skipping integration tests.`);
}

const online = () => (reachable ? describe : describe.skip);

async function signIn(email: string): Promise<void> {
  const session = await api.post<{ token: string }>(
    "/api/v1/auth/login",
    { email, password: DEMO_PASSWORD },
    { anonymous: true },
  );
  setToken(session.token);
}

online()("live API", () => {
  it("hydrates the store from the server for a clinician", async () => {
    await signIn("amara.okonkwo@styves.example");
    await hydrateFromApi();

    expect(SOURCE.current.kind).toBe("api");
    expect(TENANTS.length).toBeGreaterThan(0);
    expect(MODELS.length).toBe(5);
    expect(USERS.length).toBeGreaterThan(0);
    // Every encounter must carry the fields the worklist renders.
    for (const encounter of ENCOUNTERS) {
      expect(encounter).toMatchObject({
        id: expect.any(String),
        unitName: expect.any(String),
        state: expect.any(String),
        calibrationValidity: expect.stringMatching(/^(full|reduced)$/),
      });
      expect(encounter.patient.mrn).toBeTruthy();
    }
  });

  it("runs an assessment and returns all five models", async () => {
    await signIn("amara.okonkwo@styves.example");
    const result = await api.post<AssessResponse>("/api/v1/assess", {
      features: {
        demographics: { admission_age: 74, is_female: 1 },
        admission_context: { via_ed: 1, admission_type: "EW EMER." },
        vitals: { bp_sys: 104, bp_dia: 62 },
        labs: { "50912": 1.6, "51301": 13.0 },
        prior_history: { prior_ccsr: ["CIR019"], n_prior_admissions: 2 },
      },
    });

    expect(result.differential.model_id).toBe("M-01");
    expect(result.los.result?.interval_low).toBeLessThanOrEqual(result.los.result!.interval_high);
    expect(result.disclaimer).toMatch(/^Decision support only/);
    // Stub mode is declared, never dressed up as live.
    expect(result.mortality.status).toBe("stub");
  });

  it("accepts every sample patient the intake form can load", async () => {
    await signIn("amara.okonkwo@styves.example");
    for (const sample of SAMPLE_PROFILES) {
      const result = await api.post<AssessResponse>("/api/v1/assess", {
        features: toFeatures(sample.values),
      });
      expect(result.differential.model_id, sample.id).toBe("M-01");
      expect(result.mortality.status, sample.id).toBe("stub");
    }
  });

  it("refuses an audit covariate inside the feature block", async () => {
    await signIn("amara.okonkwo@styves.example");
    await expect(
      api.post("/api/v1/assess", {
        features: { demographics: { admission_age: 50, is_female: 0 }, race: "White" },
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("gives a patient their own record and none of the hospital's", async () => {
    await signIn("delia.salib@example.com");
    await hydrateFromApi();
    expect(ENCOUNTERS).toHaveLength(0);
    expect(USERS).toHaveLength(0);
  });

  it("a rejected token drops to the public view, from the API, with no patient data", async () => {
    setToken("not-a-real-token");
    const result = await boot();
    expect(result).toMatchObject({ source: "api", authenticated: false });
    expect(getToken()).toBeNull();
    expect(MODELS).toHaveLength(5);
    expect(ENCOUNTERS).toHaveLength(0);
  });
});

online()("the flow a user actually takes", () => {
  it("signs in from the demo role picker and goes live", async () => {
    // The bug this covers: `signIn` used to check whether the data source was
    // already live before trying the API. Before the first hydrate it never
    // is, so the role picker authenticated nobody and every action afterwards
    // reported "not reachable" against a backend that was running fine.
    setToken(null);
    await hydratePublic();
    expect(ENCOUNTERS).toHaveLength(0);

    const { useSession } = await import("@/lib/session");
    useSession.getState().signIn("physician");

    await vi.waitFor(() => {
      expect(useSession.getState().authenticated).toBe(true);
      expect(SOURCE.current.kind).toBe("api");
    }, { timeout: 5000 });

    expect(getToken()).toBeTruthy();
    expect(ENCOUNTERS.length).toBeGreaterThan(0);
  });

  it("runs a write and sees the store refresh", async () => {
    const { useSession } = await import("@/lib/session");
    const { actAndRefresh, isLive } = await import("./actions");

    // signIn is fire-and-forget, so wait for the role the token actually
    // carries rather than for "is it live" — which is already true here.
    useSession.getState().signIn("tenant_owner");
    await vi.waitFor(() => {
      expect(useSession.getState().role).toBe("tenant_owner");
      expect(isLive()).toBe(true);
    }, { timeout: 5000 });

    const before = dataVersion();
    const email = `wired.probe.${Date.now()}@styves.example`;
    const message = await actAndRefresh(
      () => api.post("/api/v1/admin/invites", {
        email, role: "physician", scope: "Facility: Main Campus",
      }),
      () => "Invite sent",
    );

    expect(message).toBe("Invite sent");
    // The store reloaded, and the counter moved — which is what makes the
    // table under the button re-render.
    expect(dataVersion()).toBeGreaterThan(before);
    expect(INVITES.some((i) => i.email === email)).toBe(true);
  });

  it("reports a refusal in the server's own words", async () => {
    const { useSession } = await import("@/lib/session");
    const { act, isLive } = await import("./actions");

    useSession.getState().signIn("staff_nurse");
    await vi.waitFor(() => {
      expect(useSession.getState().role).toBe("staff_nurse");
      expect(isLive()).toBe(true);
    }, { timeout: 5000 });

    const message = await act(
      () => api.post("/api/v1/exports", { kind: "roster", reason: "probe" }),
      () => "Exported",
    );
    expect(message).not.toBe("Exported");
    expect(message.toLowerCase()).toContain("export");
  });
});
