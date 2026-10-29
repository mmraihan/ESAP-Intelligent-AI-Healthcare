/**
 * Self-serve billing through Polar.
 *
 * The browser never talks to Polar's API: the server opens the checkout (it
 * holds the token) and hands back a hosted checkout URL, and the plan only
 * changes when Polar's signed webhook reaches the server. So "paid" on screen
 * always means the server has heard it from Polar, not that a redirect landed.
 */
import { api } from "./client";

export type PaidTier = "pro" | "pilot" | "essential" | "professional";

export type BillingStatus = {
  plan: string | null;
  owner: "user" | "tenant";
  configured: boolean;
  subscription: {
    id: string;
    tier: string;
    status: string;
    seats?: number | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
};

/** Open a Polar checkout and send the browser to it. */
export async function startCheckout(tier: PaidTier, beds?: number): Promise<void> {
  const r = await api.post<{ url: string }>("/api/v1/billing/checkout", { tier, ...(beds ? { beds } : {}) });
  window.location.assign(r.url);
}

/** Polar's customer portal: card, invoices, cancel. */
export async function openBillingPortal(): Promise<void> {
  const r = await api.post<{ url: string }>("/api/v1/billing/portal");
  window.location.assign(r.url);
}

export const billingStatus = () => api.get<BillingStatus>("/api/v1/billing/status");

export const checkoutStatus = (id: string) =>
  api.get<{ id: string; status: string; tier: string | null }>(`/api/v1/billing/checkout/${encodeURIComponent(id)}`);
