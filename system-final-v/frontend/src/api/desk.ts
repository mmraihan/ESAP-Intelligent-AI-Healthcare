/**
 * Waitlist, support tickets, announcements and the platform directory.
 *
 * None of this is in the boot snapshot — it is platform-desk data, fetched by
 * the screens that show it. Off the live API these screens say so rather than
 * render an empty list that reads as "nobody has signed up".
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./client";
import { isLive } from "./actions";

// --- types -------------------------------------------------------------------

export type WaitlistStatus = "new" | "contacted" | "qualified" | "converted" | "declined";
export const WAITLIST_STATUSES: WaitlistStatus[] = ["new", "contacted", "qualified", "converted", "declined"];

export type WaitlistNote = { at: string; by: string; text: string; status: WaitlistStatus };
export type WaitlistEntry = {
  id: string; name: string; email: string; organization: string | null; orgType: string;
  jobTitle: string | null; phone: string | null; country: string | null; beds: number | null;
  message: string | null; status: WaitlistStatus; owner?: string | null; notes: WaitlistNote[];
  contactedAt?: string; createdAt: string; updatedAt: string;
};

export type TicketStatus = "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_user", "resolved", "closed"];
export const TICKET_CATEGORIES = [
  { value: "sign_in", label: "Sign-in or account" },
  { value: "bug", label: "Something is broken" },
  { value: "data_or_results", label: "Data or results look wrong" },
  { value: "integration", label: "EHR / integration" },
  { value: "billing", label: "Billing" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" },
] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type TicketMessage = { id: string; at: string; author: string; fromStaff: boolean; body: string; statusChange?: TicketStatus };
export type Ticket = {
  id: string; subject: string; category: string; priority: (typeof TICKET_PRIORITIES)[number];
  status: TicketStatus; requesterName: string; requesterEmail: string; requesterRole: string;
  tenantId: string; tenantName: string | null; assignee?: string | null;
  awaiting: "support" | "user"; messages: TicketMessage[]; createdAt: string; updatedAt: string;
};

export type AnnouncementLevel = "info" | "maintenance" | "incident";
export type Announcement = {
  id: string; title: string; body: string; audience: "all" | "clinician" | "admin" | "patient" | "ops";
  level: AnnouncementLevel; published: boolean; expiresAt?: string | null; createdAt: string;
  updatedAt?: string; createdBy: string; active?: boolean;
};

export type PlatformUser = {
  id: string; name: string; email: string; role: string; roleLabel: string;
  tenantId: string; tenantName: string; status: string; lastActive: string | null; createdAt: string | null;
};

// --- labels ------------------------------------------------------------------

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function categoryLabel(c: string): string {
  return TICKET_CATEGORIES.find((x) => x.value === c)?.label ?? statusLabel(c);
}

/**
 * "5 min ago" against the real clock. The shared `ago()` measures from the
 * demo's fixed NOW, which is right for seeded records but reads "in 28 d" for
 * a waitlist entry or ticket written today.
 */
export function since(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 36) return `${Math.round(m / 60)} h ago`;
  if (m < 60 * 24 * 60) return `${Math.round(m / 1440)} d ago`;
  return `${Math.round(m / 43200)} mo ago`;
}

// --- fetching ----------------------------------------------------------------

/**
 * GET `path` while the app is on the live API. `data` stays null offline;
 * `offline` tells the screen to say why.
 */
export function useLive<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const live = isLive();

  useEffect(() => {
    if (!live || !path) return;
    const ctrl = new AbortController();
    setLoading(true);
    api.get<T>(path, ctrl.signal)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof ApiError ? e.message : "Could not reach the server.");
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [path, live, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload, offline: !live };
}

/** The public form's call — no session, so it is anonymous. */
export function joinWaitlist(body: Record<string, unknown>) {
  return api.post<{ ok: boolean; position: number | null }>("/api/v1/public/waitlist", body, { anonymous: true });
}
