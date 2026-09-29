/**
 * The write layer every screen shares.
 *
 * Each screen used to hold an action's outcome in local state and show a
 * toast. `act()` keeps that shape — call it, get a message for the toast —
 * but the message now describes what the *server* did, including when it
 * refused. A control that cannot reach the API says so instead of claiming
 * success, because a confirmation for a change that was never saved is worse
 * than an error.
 *
 * Every function here returns a string to show the user. None of them throw.
 */

import { ApiError, NetworkError, api } from "./client";
import { SOURCE } from "@/mock/db";
import { hydrateFromApi } from "./bootstrap";

export const OFFLINE_NOTICE =
  "Not saved — the API is not reachable, so this demo is running on the bundled dataset.";

export function isLive(): boolean {
  return SOURCE.current.kind === "api";
}

/**
 * Run a write and turn its outcome into a sentence.
 *
 * `onDone` reports success in the caller's own words. Failure is always the
 * server's own words: "That patient is outside your assigned scope" and
 * "Session expired" call for different actions, and a generic failure message
 * would hide which one happened.
 */
export async function act<T>(
  run: () => Promise<T>,
  onDone: (result: T) => string,
): Promise<string> {
  if (!isLive()) return OFFLINE_NOTICE;
  try {
    return onDone(await run());
  } catch (error) {
    if (error instanceof ApiError) return error.message;
    if (error instanceof NetworkError) return OFFLINE_NOTICE;
    return "Something went wrong. Nothing was saved.";
  }
}

/**
 * Run a write, then pull the store back from the server.
 *
 * For changes the screen renders from the boot snapshot — a new unit, a
 * revoked invitation, a suspended account. Without the re-hydrate the write
 * lands but the table still shows the old row, which reads as a failure.
 */
export async function actAndRefresh<T>(
  run: () => Promise<T>,
  onDone: (result: T) => string,
): Promise<string> {
  return act(async () => {
    const result = await run();
    await hydrateFromApi();
    return result;
  }, onDone);
}

// --- encounter lifecycle ----------------------------------------------------

/**
 * Close (discharge) an encounter. When the encounter is awaiting an attending
 * co-sign, the server treats closing it as that co-sign and says so.
 */
export function closeEncounter(id: string, note?: string, dischargeLocation?: string) {
  return actAndRefresh(
    () =>
      api.post<{ cosigned: boolean }>(`/api/v1/encounters/${id}/close`, {
        note: note ?? null,
        discharge_location: dischargeLocation ?? null,
      }),
    (r) => (r.cosigned ? "Encounter co-signed and discharged." : "Encounter discharged and closed."),
  );
}

// --- patient <-> hospital connection (§13.2) --------------------------------

export type Hospital = { id: string; name: string; slug: string };
export type ConnectionRequest = {
  id: string; patientName: string; patientEmail: string; age: number; sex: string;
  reason: string | null; status: string; requestedAt: string; tenantId: string;
};

export function listHospitals() {
  return api.get<{ hospitals: Hospital[] }>("/api/v1/patient/hospitals");
}

/** A message/question/request the patient has raised, with how it is being handled. */
export type PatientRequest = {
  id: string; kind: string; label: string; detail: string; ref: string | null;
  status: string; urgent: boolean; requestedAt: string;
};
export function myRequests() {
  return api.get<{ requests: PatientRequest[] }>("/api/v1/requests");
}
export function myConnectRequests() {
  return api.get<{ requests: ConnectionRequest[] }>("/api/v1/patient/connect");
}
export function requestConnect(hospitalId: string, age: number, sex: string, reason: string) {
  return actAndRefresh(
    () => api.post("/api/v1/patient/connect", { hospital_id: hospitalId, age, sex, reason: reason || null }),
    () => "Request sent. A clinician at that hospital will accept it.",
  );
}
export function listConnectionRequests() {
  return api.get<{ requests: ConnectionRequest[] }>("/api/v1/connection-requests");
}
export function acceptConnectionRequest(id: string) {
  return actAndRefresh(
    () => api.post(`/api/v1/connection-requests/${id}/accept`),
    () => "Patient accepted and admitted — complete their intake to run the assessment.",
  );
}

// --- exports ----------------------------------------------------------------

export type ExportKind =
  | "audit_log" | "platform_audit" | "roster" | "fairness_report" | "usage_report"
  | "invoice" | "billing_statement" | "encounter_summary" | "handoff" | "patient_record"
  | "discharge_packet";

type ExportResult = {
  export: { id: string; kind: string; label: string; rowCount: number; containsPhi: boolean; requestedAt: string };
  data: unknown;
};

/**
 * Ask the server for an export, then hand the user the file.
 *
 * The server logs the export before it returns the payload, so by the time
 * this has a file to save the record already exists. An export carrying
 * patient data is refused without a written reason.
 */
export function requestExport(kind: ExportKind, reason?: string, scope: object = {}) {
  return act(
    () => api.post<ExportResult>("/api/v1/exports", { kind, reason: reason ?? null, scope }),
    (r) => {
      const stamp = r.export.requestedAt.slice(0, 10);
      const saved = saveData(`esap-${r.export.kind.replace(/_/g, "-")}-${stamp}`, r.data);
      return `${r.export.label} exported (${r.export.rowCount} rows)` +
        (saved ? ` as ${saved}` : "") +
        (r.export.containsPhi ? " — written to the audit log as export.phi" : " — logged");
    },
  );
}

/**
 * Ask another hospital for this patient's record (§7.3/§7.5 outbound transfer).
 *
 * `transfer:initiate` is granted to physicians, NP/PAs and case managers, but
 * the only screen that reaches `POST /admin/interop` used to be the Hospital
 * Admin console — unreachable from the clinician surface these roles are on.
 * This is the clinician-side entry point to the same endpoint, scoped to the
 * patient already open. It lands in the admin's Interop & transfer queue for
 * identity confirmation, same as a request raised from that console.
 */
export function requestRecordTransfer(
  mrn: string, patientDisplay: string, counterparty: string, consentBasis: string, note: string,
) {
  return act(
    () => api.post("/api/v1/admin/interop", {
      mrn, patient_display: patientDisplay, counterparty,
      consent_basis: consentBasis || "treatment", note: note || null,
    }),
    () => `Record requested from ${counterparty} — it will appear in Interop & transfer once they respond.`,
  );
}

// --- files ------------------------------------------------------------------

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? ""
    : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows of objects as CSV; the header is the union of their keys, in first-seen order. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const keys: string[] = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  return [keys.map(csvCell).join(","), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\r\n");
}

/** Save text as a file in the browser. Returns false where there is no DOM to do it with. */
export function saveFile(filename: string, text: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save an export payload: a table of records as CSV, anything else as JSON.
 * Returns the filename, or null if the browser could not save it.
 */
export function saveData(basename: string, data: unknown): string | null {
  const tabular = Array.isArray(data) && data.length > 0 && data.every((r) => r && typeof r === "object" && !Array.isArray(r));
  const name = `${basename}.${tabular ? "csv" : "json"}`;
  const ok = tabular
    ? saveFile(name, toCsv(data as Record<string, unknown>[]), "text/csv;charset=utf-8")
    : saveFile(name, JSON.stringify(data ?? null, null, 2), "application/json");
  return ok ? name : null;
}

// --- settings ---------------------------------------------------------------

export type SettingsScope =
  | "org" | "integrations" | "model_display" | "roles"
  | "global_flags" | "subprocessors" | "plan_catalog" | "patient_prefs";

export function readSettings<T = Record<string, unknown>>(scope: SettingsScope) {
  return api.get<{ scope: string; settings: T; updated_at: string | null }>(
    `/api/v1/settings/${scope}`,
  );
}

export function saveSettings(scope: SettingsScope, patch: object, reason?: string) {
  return act(
    () => api.put(`/api/v1/settings/${scope}`, { patch, reason: reason ?? null }),
    () => "Saved.",
  );
}
