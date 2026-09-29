/**
 * HTTP client for the ESAP backend.
 *
 * One place that knows about the base URL, the bearer token and the §5 error
 * envelope, so no screen has to. Every failure arrives as an `ApiError` with
 * the server's own `code` and `message` — the UI shows what the server said
 * rather than a generic "something went wrong", because "That patient is
 * outside your assigned scope" and "Session expired" call for different
 * actions from the clinician.
 */

import type { ApiErrorBody } from "@/mock/clinical-types";

/** Overridable with VITE_API_BASE for a non-default backend host. */
export const API_BASE =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE ??
    "http://localhost:8000").replace(/\/$/, "");

const TOKEN_KEY = "esap.token";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Offline / server-down, as distinct from a server that answered with an error. */
export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super("Could not reach the ESAP API.");
    this.name = "NetworkError";
  }
}

/**
 * Called when a non-anonymous request is rejected with 401 (token expired,
 * revoked, or the account/tenant suspended). The session store registers a
 * handler here to tear down the signed-in state. Kept as a settable ref rather
 * than a direct import so this module has no dependency on the store.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

let token: string | null = null;

export function setToken(next: string | null): void {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing or blocked storage: the session still works for this
    // tab, it just will not survive a reload.
  }
}

export function getToken(): string | null {
  if (token) return token;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

type Options = {
  method?: string;
  body?: unknown;
  /** Skip the Authorization header — used by login / signup / invite lookup. */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, anonymous = false, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const bearer = anonymous ? null : getToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (response.status === 401 && !anonymous) {
    // The bearer was rejected mid-session (expired, revoked, suspended). Drop it
    // and let the app fall back to the signed-out view, rather than leaving a
    // stale "signed in" shell whose every next call also 401s.
    setToken(null);
    onUnauthorized?.();
  }

  if (!response.ok) {
    const envelope = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      envelope?.code ?? "ERROR",
      envelope?.message ?? response.statusText,
      envelope?.detail,
      envelope?.request_id,
    );
  }
  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, options: Omit<Options, "method" | "body"> = {}) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Is the API reachable and seeded? Used by the boot handshake. */
export async function probe(): Promise<boolean> {
  try {
    const ready = await fetch(`${API_BASE}/readyz`);
    return ready.ok;
  } catch {
    return false;
  }
}
