/**
 * 11.4.10 — Audit log. The Compliance / Privacy Officer's home screen.
 *
 * HIPAA §164.312(b) wants an access log; what a privacy officer actually needs
 * is a log they can investigate with. So: filters that match how an
 * investigation starts (who, what, which patient), break-glass surfaced rather
 * than buried, and every export itself written to the log.
 */
import { useMemo, useState } from "react";
import { AUDIT_EVENTS } from "@/mock/db";
import type { AuditEvent } from "@/mock/types";
import { ago, dateTimeLabel } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, Field, PageHeader, SegmentedControl, Select, StatTile, TextInput } from "@/components/ui/primitives";
import { Drawer, Toast } from "@/components/ui/overlays";
import { OutcomeTag, RoleBadge, ScopeChip, SeverityTag } from "@/components/ui/domain";
import { AlertIcon, DownloadIcon, LockIcon, ShieldIcon, UnlockIcon } from "@/components/ui/icons";
import { act, requestExport } from "@/api/actions";
import { api } from "@/api/client";

export function AdminAudit() {
  const [severity, setSeverity] = useState("all");
  const [action, setAction] = useState("all");
  const [outcome, setOutcome] = useState<"all" | "success" | "denied" | "error">("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // A drill-down fetched from the server, not filtered from the boot snapshot
  // (which holds only the latest 200 events).
  const [drill, setDrill] = useState<{ label: string; events: AuditEvent[] } | null>(null);
  const [report, setReport] = useState({ from: "", to: "", filter: "all", value: "", detail: "full" });
  const needsValue = report.filter === "patient" || report.filter === "actor";

  function generateReport() {
    const reason = report.filter === "patient"
      ? `Accounting of disclosures for ${report.value.trim()}`
      : "Audit report built from the admin console";
    void requestExport("audit_log", reason, {
      from: report.from || null, to: report.to || null, filter: report.filter,
      value: report.value.trim() || null, detail: report.detail,
    }).then(setToast);
  }

  async function drillDown(by: "actor" | "target", value: string) {
    const message = await act(
      () => api.get<{ events: AuditEvent[] }>(`/api/v1/admin/audit?${by}=${encodeURIComponent(value)}&limit=1000`),
      (r) => {
        setDrill({ label: by === "actor" ? `by ${value}` : `on ${value}`, events: r.events });
        setSelected(null);
        return `${r.events.length} event${r.events.length === 1 ? "" : "s"} ${by === "actor" ? "by" : "on"} ${value}`;
      },
    );
    setToast(message);
  }

  const actions = useMemo(() => Array.from(new Set(AUDIT_EVENTS.map((e) => e.action))).sort(), []);

  const rows = useMemo(
    () =>
      (drill ? drill.events : AUDIT_EVENTS).filter(
        (e) =>
          (severity === "all" || e.severity === severity) &&
          (action === "all" || e.action === action) &&
          (outcome === "all" || e.outcome === outcome),
      ),
    [severity, action, outcome, drill],
  );

  const denied = AUDIT_EVENTS.filter((e) => e.outcome === "denied").length;
  const breakGlass = AUDIT_EVENTS.filter((e) => e.action === "break_glass.invoke").length;
  const exports = AUDIT_EVENTS.filter((e) => e.action === "export.phi").length;

  const columns: Column<AuditEvent>[] = [
    {
      key: "when", header: "When", width: "13%", sortBy: (e) => e.at,
      render: (e) => (
        <div className="cell-stack">
          <span>{ago(e.at)}</span>
          <span className="muted mono">{dateTimeLabel(e.at)}</span>
        </div>
      ),
    },
    {
      key: "actor", header: "Actor", width: "18%", sortBy: (e) => e.actor,
      render: (e) => (
        <div className="cell-stack">
          <strong>{e.actor}</strong>
          <RoleBadge role={e.actorRole} />
        </div>
      ),
    },
    { key: "action", header: "Action", sortBy: (e) => e.action, render: (e) => <span className="mono" style={{ fontSize: 12.5 }}>{e.action}</span> },
    { key: "target", header: "Target", render: (e) => <span className="muted mono" style={{ fontSize: 12 }}>{e.target}</span> },
    { key: "scope", header: "Scope", secondary: true, render: (e) => (e.scope ? <ScopeChip scope={e.scope} /> : <span className="muted">—</span>) },
    { key: "outcome", header: "Outcome", sortBy: (e) => e.outcome, render: (e) => <OutcomeTag outcome={e.outcome} /> },
    { key: "severity", header: "Severity", sortBy: (e) => e.severity, render: (e) => <SeverityTag severity={e.severity} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Compliance & privacy"
        title="Audit log"
        lede="Every access, every action, every denial. This log is append-only and covers your tenant — including what ESAP's own staff did here, if they were ever granted emergency access."
        actions={<Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("audit_log").then(setToast)}>Export</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Events (30 days)" value={AUDIT_EVENTS.length} icon={<ShieldIcon size={15} />} />
        <StatTile label="Access denied" value={denied} tone={denied > 5 ? "warning" : "neutral"} icon={<LockIcon size={15} />} hint="Someone tried to open something outside their scope" />
        <StatTile label="Break-glass invocations" value={breakGlass} tone={breakGlass > 0 ? "warning" : "neutral"} icon={<UnlockIcon size={15} />} hint="Each one requires review" />
        <StatTile label="PHI exports" value={exports} hint="Every export names who, what and why" />
      </div>

      <Banner tone="accent" title="Where to start an investigation">
        Denials and break-glass first — a denial means someone reached for something they should not
        have, and a break-glass means someone got it anyway under an emergency justification. Both need
        a human to read the reason field, which is why the reason is required at the point of use.
      </Banner>

      {drill && (
        <Banner tone="accent" title={`Showing every event ${drill.label} (${drill.events.length})`}>
          Loaded from the server&rsquo;s full log, not just the recent page.{" "}
          <Button size="sm" variant="ghost" onClick={() => setDrill(null)}>Back to the recent log</Button>
        </Banner>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(e) => e.id}
        searchable
        searchPlaceholder="Search actor, action or target"
        searchFields={(e) => `${e.actor} ${e.action} ${e.target} ${e.reason ?? ""}`}
        onRowClick={setSelected}
        pageSize={16}
        dense
        caption="Tenant audit log"
        empty={{ title: "No matching events", message: "Nothing in the log matches these filters." }}
        toolbar={
          <>
            <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
              <option value="all">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Filter by severity">
              <option value="all">All severities</option>
              {["info", "notice", "warning", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <SegmentedControl
              size="sm"
              ariaLabel="Outcome"
              value={outcome}
              onChange={setOutcome}
              options={[
                { value: "all", label: "All" },
                { value: "success", label: "Success" },
                { value: "denied", label: "Denied" },
                { value: "error", label: "Error" },
              ]}
            />
          </>
        }
      />

      <div className="split">
        <Card title="Retention & integrity" subtitle="§15.8">
          <dl className="kv">
            <dt>Retention</dt><dd>6 years, matching the HIPAA documentation requirement</dd>
            <dt>Mutability</dt><dd>Append-only. There is no delete path, including for administrators.</dd>
            <dt>Integrity</dt><dd>Each day&rsquo;s entries are hash-chained; a gap or an edit is detectable</dd>
            <dt>Coverage</dt><dd>Reads as well as writes — a chart opened and closed is an event</dd>
            <dt>Export format</dt><dd>CSV and JSON, both including the reason field</dd>
          </dl>
        </Card>

        <Card title="Build a report" subtitle="For a DSAR, an incident, or a board pack">
          <Field label="Date range">
            <div className="row" style={{ gap: 8 }}>
              <TextInput type="date" aria-label="From" value={report.from} onChange={(e) => setReport({ ...report, from: e.currentTarget.value })} />
              <TextInput type="date" aria-label="To" value={report.to} onChange={(e) => setReport({ ...report, to: e.currentTarget.value })} />
            </div>
          </Field>
          <Field label="Scope">
            <Select value={report.filter} onChange={(e) => setReport({ ...report, filter: e.currentTarget.value, value: "" })}>
              <option value="all">Whole tenant</option>
              <option value="patient">A single patient (accounting of disclosures)</option>
              <option value="actor">A single user</option>
              <option value="bg">Break-glass only</option>
            </Select>
          </Field>
          {needsValue && (
            <Field label={report.filter === "patient" ? "Patient MRN" : "User email"} required>
              <TextInput
                className="mono"
                placeholder={report.filter === "patient" ? "MRN-400000" : "name@styves.example"}
                value={report.value}
                onChange={(e) => setReport({ ...report, value: e.currentTarget.value })}
              />
            </Field>
          )}
          <Field label="Include" hint="An accounting of disclosures for a patient must include the reason field to be complete.">
            <Select value={report.detail} onChange={(e) => setReport({ ...report, detail: e.currentTarget.value })}>
              <option value="full">Full detail with reasons</option><option value="summary">Summary counts only</option>
            </Select>
          </Field>
          <Button variant="primary" disabled={needsValue && !report.value.trim()} onClick={generateReport}>Generate report</Button>
        </Card>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.action ?? ""}
        subtitle={selected ? dateTimeLabel(selected.at) : ""}
        width={520}
      >
        {selected && (
          <div className="stack" style={{ gap: 18 }}>
            {selected.reason && (
              <Card title={<span className="row" style={{ gap: 7 }}><AlertIcon size={16} /> Stated justification</span>} subtitle="Required at the point of use">
                <p className="audit-row-reason" style={{ margin: 0 }}>{selected.reason}</p>
                <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                  This text was typed by the actor before the action was permitted. It is not
                  editable afterwards, by them or by you.
                </p>
              </Card>
            )}

            <Card title="Event">
              <dl className="kv">
                <dt>Action</dt><dd className="mono">{selected.action}</dd>
                <dt>Target</dt><dd className="mono">{selected.target}</dd>
                <dt>Outcome</dt><dd><OutcomeTag outcome={selected.outcome} /></dd>
                <dt>Severity</dt><dd><SeverityTag severity={selected.severity} /></dd>
                <dt>Timestamp</dt><dd className="mono">{selected.at}</dd>
              </dl>
            </Card>

            <Card title="Actor">
              <dl className="kv">
                <dt>Name</dt><dd>{selected.actor}</dd>
                <dt>Role</dt><dd><RoleBadge role={selected.actorRole} showScope /></dd>
                <dt>Scope at the time</dt><dd>{selected.scope ?? "—"}</dd>
                <dt>Source address</dt><dd className="mono">{selected.ip}</dd>
              </dl>
            </Card>

            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" onClick={() => void drillDown("actor", selected.actor)}>All events by this actor</Button>
              <Button size="sm" onClick={() => void drillDown("target", selected.target)}>All events on this target</Button>
            </div>
          </div>
        )}
      </Drawer>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
