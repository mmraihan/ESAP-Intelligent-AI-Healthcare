/**
 * 11.5.6 — Break-glass (§4.8).
 *
 * The one path from this console to patient data. Everything about the screen
 * is friction on purpose: a named patient, a free-text reason, a ticket
 * reference, a second approver, a short TTL and a visible countdown. None of
 * those fields are optional, and none of them can be waived from here.
 */
import { useState } from "react";
import { BREAK_GLASS, TENANTS } from "@/mock/db";
import type { BreakGlassGrant } from "@/mock/types";
import { useSession } from "@/lib/session";
import { ago } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, TextArea, TextInput } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { AlertIcon, CheckIcon, ClockIcon, LockIcon, ShieldIcon, UnlockIcon, XIcon } from "@/components/ui/icons";
import { actAndRefresh } from "@/api/actions";
import { ApiError, api } from "@/api/client";

const STATUS_TONE: Record<BreakGlassGrant["status"], string> = {
  active: "pill-critical",
  pending_approval: "pill-warning",
  expired: "pill-neutral",
  revoked: "pill-neutral",
};

export function OpsBreakGlass() {
  const { elevate, elevation, name, email } = useSession();
  const [requesting, setRequesting] = useState(false);
  const [form, setForm] = useState({ tenant: TENANTS[0].id, patient: "", reason: "", ticket: "", ttl: "30" });
  const [toast, setToast] = useState<string | null>(null);

  const valid = form.patient.trim() && form.reason.trim().length > 20 && form.ticket.trim();
  const active = BREAK_GLASS.filter((g) => g.status === "active");
  const pending = BREAK_GLASS.filter((g) => g.status === "pending_approval");
  // Seeded grants name the requester; live ones carry their email.
  const isMine = (g: BreakGlassGrant) => g.requestedBy === email || g.requestedBy === name;
  const awaitingOthers = pending.filter((g) => !isMine(g));

  /** File the request. It lands pending: a second person approves it before anyone can use it. */
  function submitRequest() {
    setRequesting(false);
    void actAndRefresh(
      () => api.post("/api/v1/ops/break-glass", {
        tenant_id: form.tenant, patient_ref: form.patient.trim(), reason: form.reason.trim(),
        ticket: form.ticket.trim(), ttl_minutes: Number(form.ttl),
      }),
      () => "Request filed and logged — it needs a second approver before you can use it",
    ).then(setToast);
    setForm({ ...form, patient: "", reason: "", ticket: "" });
  }

  /** Start work under an approved grant. The grant, not this screen, sets the ticket and the clock. */
  async function startUnder(g: BreakGlassGrant) {
    const left = Math.max(5, Math.floor((new Date(g.expiresAt).getTime() - Date.now()) / 60_000));
    try {
      await elevate(g.reason, g.ticket, left, g.id);
      setToast(`Elevated under ${g.ticket} — the countdown is in the banner above`);
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : "Could not reach the ESAP API.");
    }
  }

  function revoke(g: BreakGlassGrant, mine: boolean) {
    void actAndRefresh(
      () => api.post(`/api/v1/ops/break-glass/${g.id}/revoke`),
      () => (mine && g.status === "pending_approval" ? "Request withdrawn — logged" : "Grant revoked — logged"),
    ).then(setToast);
  }

  const columns: Column<BreakGlassGrant>[] = [
    {
      key: "who", header: "Requested by", sortBy: (g) => g.requestedBy,
      render: (g) => (
        <div className="cell-stack">
          <strong>{g.requestedBy}</strong>
          <span className="muted">{ago(g.requestedAt)}</span>
        </div>
      ),
    },
    {
      key: "tenant", header: "Tenant & patient", width: "22%",
      render: (g) => (
        <div className="cell-stack">
          <span>{g.tenantName}</span>
          <span className="muted mono">{g.patientRef}</span>
        </div>
      ),
    },
    { key: "ticket", header: "Ticket", sortBy: (g) => g.ticket, render: (g) => <span className="mono">{g.ticket}</span> },
    {
      key: "reason", header: "Stated reason", width: "26%",
      render: (g) => <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{g.reason}</span>,
    },
    { key: "ttl", header: "TTL", align: "right", render: (g) => <span className="tnum">{g.ttlMinutes} min</span> },
    { key: "approver", header: "Approver", secondary: true, render: (g) => <span className="muted">{g.approver ?? "—"}</span> },
    {
      key: "actions", header: "", align: "right",
      render: (g) => {
        const mine = isMine(g);
        if (g.status === "active") {
          return (
            <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
              {mine && !elevation && <Button size="sm" variant="danger" icon={<UnlockIcon size={13} />} onClick={() => void startUnder(g)}>Start</Button>}
              <Button size="sm" variant="ghost" icon={<LockIcon size={13} />} onClick={() => revoke(g, mine)}>Revoke</Button>
            </div>
          );
        }
        if (g.status === "pending_approval" && mine) {
          return <Button size="sm" variant="ghost" icon={<XIcon size={13} />} onClick={() => revoke(g, mine)}>Withdraw</Button>;
        }
        return null;
      },
    },
    {
      key: "status", header: "Status", sortBy: (g) => g.status,
      render: (g) => (
        <span className={`pill ${STATUS_TONE[g.status]}`}>
          {g.status === "active" ? <UnlockIcon size={12} /> : g.status === "pending_approval" ? <ClockIcon size={12} /> : <LockIcon size={12} />}
          {g.status.replace(/_/g, " ")}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Break-glass"
        lede="The only route from this console to a patient record. Every field on the request form is required, and the grant expires on a clock you cannot extend."
        actions={<Button variant="danger" icon={<UnlockIcon size={15} />} onClick={() => setRequesting(true)}>Request access</Button>}
      />

      {elevation && (
        <Banner tone="critical" icon={<UnlockIcon size={16} />} title="You currently hold an active elevation">
          Ticket {elevation.ticket}. Every action you take while it is live is attributed to you with
          your stated justification attached. End it as soon as you are done rather than letting it
          run out — the banner at the top of the screen has the control.
        </Banner>
      )}

      <div className="grid grid-4">
        <StatTile label="Active now" value={active.length} tone={active.length > 0 ? "critical" : "good"} icon={<UnlockIcon size={15} />} />
        <StatTile label="Awaiting approval" value={pending.length} tone={pending.length > 0 ? "warning" : "neutral"} icon={<ClockIcon size={15} />} />
        <StatTile label="Used this quarter" value={BREAK_GLASS.length} hint="Every one is reviewed by the compliance team" />
        <StatTile
          label="Median length requested"
          value={(() => { const d = BREAK_GLASS.map((g) => g.ttlMinutes).sort((a, b) => a - b); return d.length ? String(d[Math.floor(d.length / 2)]) : "—"; })()}
          unit={BREAK_GLASS.length ? "min" : undefined}
          hint="Across every grant on record"
        />
      </div>

      <Banner tone="accent" icon={<ShieldIcon size={16} />} title="What a tenant can do about this">
        A hospital can disable break-glass entirely from their own org settings. If they do, nobody at
        ESAP can be granted access to a chart there under any circumstances — including to investigate
        a fault they themselves reported. Several customers choose exactly that, and it is the correct
        default for anyone who can operate without vendor support on live data.
      </Banner>

      <DataTable
        rows={BREAK_GLASS}
        columns={columns}
        getRowId={(g) => g.id}
        searchable
        searchPlaceholder="Search by requester, tenant or ticket"
        searchFields={(g) => `${g.requestedBy} ${g.tenantName} ${g.ticket} ${g.reason}`}
        caption="Break-glass grants"
        empty={{ title: "No grants on record", message: "Nobody has requested emergency access.", icon: <LockIcon size={20} /> }}
      />

      {awaitingOthers.length > 0 && (
        <Card title="Awaiting your approval" subtitle="A second person must approve every request — your own requests are not listed here">
          {awaitingOthers.map((g) => (
            <div key={g.id} className="flag-row">
              <div className="flag-meta">
                <strong>{g.requestedBy} → {g.tenantName}</strong>
                <span>{g.reason}</span>
                <span className="flag-key">{g.patientRef} · {g.ticket} · {g.ttlMinutes} min requested</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Button size="sm" variant="ghost" icon={<XIcon size={13} />} onClick={() => void actAndRefresh(() => api.post(`/api/v1/ops/break-glass/${g.id}/deny`, { reason: "Insufficient justification for patient access" }), () => "Request denied — the refusal is in the audit log").then(setToast)}>Deny</Button>
                <Button size="sm" variant="primary" icon={<CheckIcon size={13} />} onClick={() => void actAndRefresh(() => api.post(`/api/v1/ops/break-glass/${g.id}/approve`), () => `Approved — ${g.requestedBy} has ${g.ttlMinutes} minutes`).then(setToast)}>Approve</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card title="Why each field is required" subtitle="§4.8">
        <div className="scroll-x">
          <table className="data-table is-dense">
            <thead><tr><th>Field</th><th>Why it cannot be optional</th></tr></thead>
            <tbody>
              <tr><td><strong>Named patient</strong></td><td className="muted">Scopes the grant to one record. There is no &ldquo;browse the tenant&rdquo; mode, because that is what a breach looks like.</td></tr>
              <tr><td><strong>Free-text reason</strong></td><td className="muted">The compliance reviewer reads this, not a dropdown code. A dropdown produces &ldquo;support investigation&rdquo; every time and tells nobody anything.</td></tr>
              <tr><td><strong>Ticket reference</strong></td><td className="muted">Ties the access to an external record the customer can also see. An access with no ticket has no corroboration.</td></tr>
              <tr><td><strong>Second approver</strong></td><td className="muted">One compromised account is not enough to reach patient data.</td></tr>
              <tr><td><strong>TTL</strong></td><td className="muted">Access that does not expire is standing access with extra steps. Maximum 60 minutes, and it cannot be extended — a new request is required.</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request break-glass access"
        subtitle="This request is logged whether or not it is approved"
        footer={
          <>
            <Button onClick={() => setRequesting(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!valid}
              onClick={submitRequest}
            >
              Request {form.ttl}-minute access
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Banner tone="critical" icon={<AlertIcon size={16} />} title="You are requesting access to a patient record">
            Requested by {name}. This is recorded permanently, is visible to the hospital&rsquo;s own
            privacy officer, and is reviewed by compliance regardless of outcome.
          </Banner>

          <Field label="Tenant" required>
            <Select value={form.tenant} onChange={(e) => setForm({ ...form, tenant: e.target.value })}>
              {TENANTS.filter((t) => t.mode !== "individual").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>

          <Field label="Patient reference" required hint="An MRN or encounter ID. The grant is scoped to this one record and nothing else.">
            <TextInput className="mono" value={form.patient} onChange={(e) => setForm({ ...form, patient: e.target.value })} placeholder="MRN-400118" />
          </Field>

          <Field
            label="Reason"
            required
            hint="Written for a compliance reviewer who was not there. At least a sentence."
            error={form.reason.length > 0 && form.reason.length <= 20 ? "Too short to be a justification." : undefined}
          >
            <TextArea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Clinician at the site reports a wrong-patient banner on the results pane for this encounter; need to inspect the stored assessment to confirm whether the binding is wrong in our data or in their ADT feed."
            />
          </Field>

          <Field label="Ticket reference" required>
            <TextInput className="mono" value={form.ticket} onChange={(e) => setForm({ ...form, ticket: e.target.value })} placeholder="ESC-2291" />
          </Field>

          <Field label="Duration" required hint="Cannot be extended. If you run out, request again — and that second request is also reviewed.">
            <Select value={form.ttl} onChange={(e) => setForm({ ...form, ttl: e.target.value })}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes (maximum)</option>
            </Select>
          </Field>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Badge tone="warning">Second approver required</Badge>
            <Badge tone="warning">Visible to the tenant&rsquo;s privacy officer</Badge>
            <Badge tone="warning">Reviewed by compliance</Badge>
          </div>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
