/**
 * Session state.
 *
 * Backed by the API when it is reachable: `signIn` posts credentials, stores
 * the bearer token and re-hydrates the store with the server's view of the
 * data for that role. The role is then the token's claim, not a client
 * setting — a "physician" in this store is a physician because the server said
 * so, and asking for a nurse's roster still gets a 403.
 *
 * The role switcher survives as an offline-only affordance. It is labelled as
 * a demo control on screen, and §11.1 is explicit that production ships three
 * separate bundles so a guest-reachable client never contains admin or ops
 * code at all. When the API is live, switching role means signing in as that
 * role — which is what `signInAs` does.
 */

import { create } from "zustand";
import { DEMO_IDENTITY, ACTIVE_TENANT, TENANTS, SOURCE } from "@/mock/db";
import { ROLES, type RoleCode } from "./rbac";
import { ApiError, api, setToken, setUnauthorizedHandler } from "@/api/client";
import { hydrateFromApi, hydratePublic, type SessionPayload } from "@/api/bootstrap";

/** The shared demo password. Synthetic accounts, stated rather than hidden. */
export const DEMO_PASSWORD = "esap-demo";

/** The pending MFA challenge token between the password step and the TOTP step. */
let mfaChallenge: string | null = null;

export type SessionState = {
  authenticated: boolean;
  role: RoleCode;
  name: string;
  email: string;
  title: string;
  tenantId: string;
  /** Break-glass elevation, if one is currently active (§4.8). */
  elevation: { reason: string; ticket: string; expiresAt: number } | null;
  /** Tenant policy flag — teaching hospitals turn this on (§4.6 footnote). */
  requireResidentCosign: boolean;
  /** Set while a sign-in is in flight, so the form can disable itself. */
  pending: boolean;
  /** Last sign-in failure, in the server's own words. */
  error: string | null;
  /** Set when a password step returned an MFA challenge: the form then asks for a code. */
  mfaPending: boolean;

  signIn: (role: RoleCode) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Complete an MFA-challenged sign-in with a TOTP code. */
  verifyMfa: (code: string) => Promise<void>;
  /** Abandon an in-progress MFA challenge (back to the password form). */
  cancelMfa: () => void;
  signOut: () => void;
  switchTenant: (tenantId: string) => void;
  /** `grantId`: start the elevation under an approved `/ops/break-glass` grant, which then sets its terms. */
  elevate: (reason: string, ticket: string, ttlMinutes: number, grantId?: string) => Promise<void>;
  dropElevation: () => void;
  adoptSession: (payload: SessionPayload) => void;
  /** Take a session the server just issued (signup, invite acceptance) and load its data. */
  startSession: (payload: SessionPayload) => Promise<void>;
};

function identity(role: RoleCode) {
  const id = DEMO_IDENTITY[role];
  return id
    ? { name: id.name, email: id.email, title: id.title }
    : { name: "Unknown user", email: "", title: ROLES[role]?.label ?? role };
}

const live = () => SOURCE.current.kind === "api";

export const useSession = create<SessionState>((set, get) => ({
  authenticated: false,
  role: "physician",
  ...identity("physician"),
  tenantId: ACTIVE_TENANT.id,
  elevation: null,
  requireResidentCosign: true,
  pending: false,
  error: null,
  mfaPending: false,

  adoptSession: (payload) => {
    setToken(payload.token);
    set({
      authenticated: true,
      role: payload.user.role as RoleCode,
      name: payload.user.name,
      email: payload.user.email,
      title: payload.user.title,
      tenantId: payload.user.tenantId,
      requireResidentCosign: payload.policy?.requireResidentCosign ?? true,
      pending: false,
      error: null,
      elevation: payload.elevation
        ? {
            reason: payload.elevation.reason,
            ticket: payload.elevation.ticket,
            expiresAt: new Date(payload.elevation.expiresAt).getTime(),
          }
        : null,
    });
  },

  startSession: async (payload) => {
    get().adoptSession(payload);
    await hydrateFromApi();
  },

  signInWithPassword: async (email, password) => {
    set({ pending: true, error: null, mfaPending: false });
    try {
      const payload = await api.post<SessionPayload | { mfa_required: true; mfa_token: string }>(
        "/api/v1/auth/login",
        { email, password },
        { anonymous: true },
      );
      if ("mfa_required" in payload && payload.mfa_required) {
        // Password accepted; a second factor is required. Hold the challenge and
        // let the form ask for a code.
        mfaChallenge = payload.mfa_token;
        set({ pending: false, mfaPending: true, error: null });
        return;
      }
      get().adoptSession(payload as SessionPayload);
      await hydrateFromApi();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not reach the ESAP API.";
      set({ pending: false, error: message });
      throw error;
    }
  },

  verifyMfa: async (code) => {
    if (!mfaChallenge) {
      set({ error: "This sign-in step has expired. Enter your password again.", mfaPending: false });
      return;
    }
    set({ pending: true, error: null });
    try {
      const payload = await api.post<SessionPayload>(
        "/api/v1/auth/mfa/verify",
        { mfa_token: mfaChallenge, code },
        { anonymous: true },
      );
      mfaChallenge = null;
      get().adoptSession(payload);
      set({ mfaPending: false });
      await hydrateFromApi();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not reach the ESAP API.";
      set({ pending: false, error: message });
      throw error;
    }
  },

  cancelMfa: () => {
    mfaChallenge = null;
    set({ mfaPending: false, error: null, pending: false });
  },

  /**
   * Demo sign-in for a role.
   *
   * Always tries the API first. It must not test `live()` here: before the
   * first successful hydrate the data source is still the bundled fixture, so
   * a `live()` gate would mean the role picker never authenticates at all —
   * and every action afterwards would report "not reachable" on a backend
   * that was running the whole time. Falling back is the failure path, not
   * the default.
   */
  signIn: async (role) => {
    // Always a real sign-in as that role's demo account. There is no local,
    // server-less session: without the API there is nothing true to show.
    const id = DEMO_IDENTITY[role];
    if (!id?.email) {
      const message = "There is no demo account for this role on this server.";
      set({ error: message });
      throw new Error(message);
    }
    await get().signInWithPassword(id.email, DEMO_PASSWORD);
  },

  signOut: () => {
    if (live()) void api.post("/api/v1/auth/logout").catch(() => undefined);
    setToken(null);
    set({ authenticated: false, elevation: null, error: null });
    // Drop the signed-in data and go back to what a visitor may see.
    void hydratePublic().catch(() => undefined);
  },

  switchTenant: (tenantId) => set({ tenantId }),

  elevate: async (reason, ticket, ttlMinutes, grantId) => {
    if (live()) {
      const { elevation } = await api.post<{
        elevation: { reason: string; ticket: string; expiresAt: string };
      }>("/api/v1/auth/elevate", { reason, ticket, ttl_minutes: ttlMinutes, grant_id: grantId ?? null });
      set({
        elevation: {
          reason: elevation.reason,
          ticket: elevation.ticket,
          expiresAt: new Date(elevation.expiresAt).getTime(),
        },
      });
      await hydrateFromApi();
      return;
    }
    set({ elevation: { reason, ticket, expiresAt: Date.now() + ttlMinutes * 60_000 } });
  },

  dropElevation: () => {
    if (live()) void api.del("/api/v1/auth/elevate").catch(() => undefined);
    set({ elevation: null });
  },
}));

// A 401 on any authenticated request tears the session down here, so a revoked
// or expired token drops the user to the signed-out view instead of leaving a
// stale shell. Guarded on `authenticated` so the boot-time check of a stale
// stored token (which 401s by design) stays silent.
setUnauthorizedHandler(() => {
  if (!useSession.getState().authenticated) return;
  useSession.setState({
    authenticated: false,
    elevation: null,
    error: "Your session has ended. Please sign in again.",
  });
  void hydratePublic().catch(() => undefined);
});

export function homeFor(role: RoleCode): string {
  return ROLES[role].home;
}

export function tenantFor(tenantId: string) {
  return TENANTS.find((t) => t.id === tenantId) ?? ACTIVE_TENANT;
}
