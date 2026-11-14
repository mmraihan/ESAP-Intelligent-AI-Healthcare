/**
 * Boot handshake: fill the store before the first render.
 *
 * The order matters. A stored token is verified against the server *before*
 * anything is rendered, so a revoked or expired session lands on the sign-in
 * screen rather than briefly painting a worklist the server would refuse.
 *
 * Every failure falls back to the bundled fixture rather than blocking. The
 * build's promise is that it runs offline; losing the backend should cost the
 * live data and the writes, not the demo.
 */

import { NetworkError, api, getToken, setToken } from "./client";
import { SOURCE, applyDataset, applyPublic, notifyDataChanged } from "@/mock/db";
import type { ModelCard, PlanDefinition } from "@/mock/types";
import { API_BASE } from "./client";

export type BootResult = {
  source: "api" | "offline";
  /** A signed-in session was restored from a stored token. */
  authenticated: boolean;
  session: SessionPayload | null;
  /** Why the fixture was used, when it was. */
  reason?: string;
};

export type SessionPayload = {
  /** Null when the session rides on the HttpOnly cookie. */
  token: string | null;
  expires_at: string;
  /** Sign out after this many idle minutes (server-enforced too). */
  idle_timeout_minutes?: number;
  user: {
    id: string;
    email: string;
    name: string;
    title: string;
    role: string;
    tenantId: string;
    surface: string;
    home: string;
  };
  permissions: Record<string, string>;
  policy?: { requireResidentCosign: boolean };
  elevation?: { reason: string; ticket: string; expiresAt: string } | null;
};

/** Pull the signed-in view of the dataset into the store. */
export async function hydrateFromApi(): Promise<void> {
  const data = await api.get<Parameters<typeof applyDataset>[0]>("/api/v1/bootstrap");
  applyDataset(data);
  SOURCE.current = { kind: "api", base: API_BASE };
}

/** What a signed-out visitor sees: the public evidence and the demo accounts. */
export async function hydratePublic(): Promise<void> {
  const [evidence, demo] = await Promise.all([
    api.get<{ models: ModelCard[]; plans: PlanDefinition[] }>("/api/v1/public/evidence"),
    api.get<{ accounts: Record<string, { name: string; email: string; title: string }> }>("/api/v1/public/demo-accounts"),
  ]);
  applyPublic({ models: evidence.models, plans: evidence.plans, demoAccounts: demo.accounts });
  SOURCE.current = { kind: "api", base: API_BASE };
}

function offline(error: unknown): BootResult {
  const reason =
    error instanceof NetworkError
      ? `The ESAP server at ${API_BASE} cannot be reached.`
      : `The ESAP server answered with an error: ${(error as Error).message}`;
  SOURCE.current = { kind: "offline", reason };
  notifyDataChanged();
  return { source: "offline", authenticated: false, session: null, reason };
}

/**
 * Connect to the API. Every screen's data comes from it: a signed-in user gets
 * their bootstrap, a visitor gets the public evidence. If the server cannot be
 * reached the app says so — it has no bundled dataset to fall back on.
 */
export async function boot(): Promise<BootResult> {
  try {
    // The session cookie is invisible to this page, so ask the server. It
    // answers 200 either way, so a visitor's first load logs no failed request.
    const who = await api.get<({ authenticated: true } & SessionPayload) | { authenticated: false }>(
      "/api/v1/auth/whoami");
    if (who.authenticated) {
      const session = who as SessionPayload;
      setToken(session.token);
      await hydrateFromApi();
      return { source: "api", authenticated: true, session };
    }
    if (getToken()) setToken(null);
    await hydratePublic();
    return { source: "api", authenticated: false, session: null };
  } catch (error) {
    return offline(error);
  }
}
