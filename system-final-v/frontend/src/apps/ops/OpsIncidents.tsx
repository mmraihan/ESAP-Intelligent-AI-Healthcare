/**
 * 11.5.8 — Incidents. Cross-tenant health feed.
 *
 * The compute reality from CLAUDE.md shows up here: one shared GPU also serves
 * the extraction LLM, so inference latency and extraction throughput contend.
 * That is an operational fact, not a bug, and the console names it rather than
 * hiding it behind a generic "degraded" light.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INCIDENTS, TENANTS } from "@/mock/db";
import type { BreachClock, Incident } from "@/mock/types";
import { ago, dateTimeLabel } from "@/lib/format";
import { Badge, Banner, Button, Card, Field, PageHeader, SegmentedControl, Select, StatTile, TextArea, TextInput } from "@/components/ui/primitives";
import { Drawer, Modal, Toast } from "@/components/ui/overlays";
import { SeverityTag } from "@/components/ui/domain";
import { LinePanel, PanelGrid } from "@/components/ui/charts";
import { ActivityIcon, AlertIcon, CheckIcon, ClockIcon, PlusIcon, ServerIcon, ShieldIcon } from "@/components/ui/icons";
import { actAndRefresh, isLive } from "@/api/actions";
import { api } from "@/api/client";

const CLOCKS: { key: BreachClock; label: string; rule: string }[] = [
  { key: "controller", label: "Tell the affected hospital", rule: "Within 24 h of becoming aware (ESAP to the controller)" },
  { key: "regulator", label: "Notify SDAIA", rule: "Within 72 h (Saudi PDPL; the hospital files, ESAP supports)" },
  { key: "data_subjects", label: "Tell the people affected", rule: "Without undue delay, when the breach is likely to harm them" },
];

/** "18 h 20 min left" / "overdue by 3 h" against the real clock. */
function countdown(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const ms = new Date(due).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = h > 0 ? `${h} h ${m} min` : `${m} min`;
  return ms >= 0 ? { text: `${span} left`, overdue: false } : { text: `overdue by ${span}`, overdue: true };
}

type Templates = Record<BreachClock, { subject: string; body: string }>;

/** The breach clocks for one incident: each deadline, and whether its notice went out. */
function BreachClocks({ incident }: { incident: Incident }) {
  const b = incident.breach;
  if (!b) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {CLOCKS.map((c) => {
        const sent = b.notifications[c.key];
        const left = countdown(b.deadlines[c.key]);
        return (
          <div key={c.key} className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span className="cell-stack">
              <strong>{c.label}</strong>
              <span className="muted" style={{ fontSize: 12.5 }}>{c.rule}</span>
            </span>
            {sent ? (
              <Badge tone={sent.late ? "warning" : "good"} icon={<CheckIcon size={11} />}>
                Sent {dateTimeLabel(sent.sentAt)}{sent.late ? " (late)" : ""}
              </Badge>
            ) : left ? (
              <Badge tone={left.overdue ? "critical" : "warning"} icon={<ClockIcon size={11} />}>
                <span className="tnum">{left.text}</span>
              </Badge>
            ) : (
              <Badge tone="neutral">No fixed deadline</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Serving = { assessments: number; p50_ms: number; p95_ms: number; by_day: { day: string; count: number; p95_ms: number }[] };

export function OpsIncidents() {
  const nav = useNavigate();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [selected, setSelected] = useState<Incident | null>(null);
  // Measured from the assessments this platform has actually run.
  const [serving, setServing] = useState<Serving | null>(null);
  useEffect(() => {
    if (!isLive()) return;
    api.get<Serving>("/api/v1/ops/serving").then(setServing).catch(() => undefined);
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState("");
  const [declaring, setDeclaring] = useState(false);
  const blank = { title: "", component: "", severity: "warning", tenant: "", detail: "", breach: false, categories: "", affected: "" };
  const [draft, setDraft] = useState(blank);
  const draftValid = draft.title.trim().length >= 5 && draft.component.trim().length >= 2 && draft.detail.trim().length >= 5;

  function declare() {
    setDeclaring(false);
    void actAndRefresh(
      () => api.post("/api/v1/ops/incidents", {
        title: draft.title.trim(), component: draft.component.trim(), severity: draft.severity,
        detail: draft.detail.trim(), tenant_name: draft.tenant || null,
        breach: draft.breach,
        data_categories: draft.categories.split(",").map((x) => x.trim()).filter(Boolean),
        affected_estimate: draft.affected.trim() ? Number(draft.affected) : null,
      }),
      () => (draft.breach ? "Breach incident opened — the 24 h and 72 h clocks are running" : "Incident opened and logged"),
    ).then(setToast);
    setDraft(blank);
  }

  const rows = useMemo(
    () => (filter === "open" ? INCIDENTS.filter((i) => i.state !== "resolved") : INCIDENTS),
    [filter],
  );

  const critical = INCIDENTS.filter((i) => i.severity === "critical" && i.state !== "resolved").length;
  const open = INCIDENTS.filter((i) => i.state !== "resolved").length;

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Incidents"
        lede="Cross-tenant health. The ones that matter most are the silent failures — a stalled feed or a stale refresh does not page anyone, and is worse than an outage because clinicians keep trusting the screen."
        actions={
          <>
          <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => setDeclaring(true)}>Declare incident</Button>
          <SegmentedControl
            size="sm"
            ariaLabel="Filter"
            value={filter}
            onChange={setFilter}
            options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]}
          />
          </>
        }
      />

      <div className="grid grid-4">
        <StatTile label="Open" value={open} tone={open > 2 ? "warning" : "neutral"} icon={<AlertIcon size={15} />} />
        <StatTile label="Critical" value={critical} tone={critical > 0 ? "critical" : "good"} />
        <StatTile label="Inference p95" value={serving ? serving.p95_ms : "—"} unit={serving ? "ms" : undefined} tone={serving && serving.p95_ms > 900 ? "warning" : "good"} icon={<ActivityIcon size={15} />} hint={serving ? `Across ${serving.assessments} assessments · target under 900 ms` : "Loading…"} />
        <StatTile label="Tenants affected" value={new Set(INCIDENTS.filter((i) => i.state !== "resolved" && i.tenantName).map((i) => i.tenantName)).size} icon={<ServerIcon size={15} />} />
      </div>

      {critical > 0 && (
        <Banner tone="critical" title={`${critical} critical incident${critical > 1 ? "s" : ""} open`}>
          {INCIDENTS.filter((i) => i.severity === "critical" && i.state !== "resolved").map((i) => i.title).join(" · ")}
        </Banner>
      )}

      <Card
        title="Serving latency"
        subtitle="Measured from every assessment this platform has run"
        footnote="The time for an assessment is its slowest model, since the five run side by side. GPU contention with the extraction service and queue depth need a telemetry feed, which is not connected on this server."
      >
        {serving && serving.by_day.length > 0 ? (
          <PanelGrid>
            <LinePanel
              title="Assessment p95 by day (ms)"
              labels={serving.by_day.map((d) => d.day)}
              values={serving.by_day.map((d) => d.p95_ms)}
              format={(v) => `${v} ms`}
              reference={{ value: 900, label: "SLO 900 ms", tone: "warning" }}
            />
            <LinePanel
              title="Assessments per day"
              labels={serving.by_day.map((d) => d.day)}
              values={serving.by_day.map((d) => d.count)}
              format={(v) => String(v)}
              color="var(--vital)"
            />
          </PanelGrid>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{serving ? "No assessments have run yet." : "Loading…"}</p>
        )}
      </Card>

      <div className="stack" style={{ gap: 12 }}>
        {rows.length === 0 ? (
          <Card title="Nothing open"><p className="muted" style={{ margin: 0 }}>The fleet is healthy.</p></Card>
        ) : (
          rows.map((i) => (
            <Card
              key={i.id}
              title={i.title}
              subtitle={i.tenantName ? `${i.tenantName} · ${i.component}` : `Platform-wide · ${i.component}`}
              actions={
                <div className="row" style={{ gap: 8 }}>
                  {i.breach && <Badge tone="critical" icon={<ShieldIcon size={11} />}>Personal-data breach</Badge>}
                  <SeverityTag severity={i.severity} />
                  <Badge tone={i.state === "resolved" ? "good" : i.state === "mitigating" ? "warning" : "critical"}>{i.state}</Badge>
                </div>
              }
              footnote={`Opened ${ago(i.openedAt)} · ${dateTimeLabel(i.openedAt)}`}
            >
              <p className="prose" style={{ margin: 0 }}>{i.detail}</p>
              {i.breach && <BreachClocks incident={i} />}
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => setSelected(i)}>Open</Button>
                {i.tenantName && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const t = TENANTS.find((x) => x.name === i.tenantName);
                      if (t) nav(`/ops/tenants/${t.id}`);
                    }}
                  >
                    Go to tenant
                  </Button>
                )}
                {i.state !== "resolved" && (
                  <Button size="sm" variant="ghost" icon={<CheckIcon size={13} />} onClick={() => void actAndRefresh(() => api.post(`/api/v1/ops/incidents/${i.id}/state`, { state: "resolved", note: "Resolved from the incident list" }), () => `${i.title} marked resolved`).then(setToast)}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Card title="The failure modes that do not page anyone" subtitle="Worth checking even when the board is green">
        <ul className="caveat-list">
          <li><AlertIcon size={13} /> <strong>A stalled ADT feed.</strong> No error appears anywhere; encounters simply stop being created, and staff assume the ward is quiet.</li>
          <li><AlertIcon size={13} /> <strong>A stale ETL refresh.</strong> Assessments keep running against an older cohort snapshot. Nothing on a clinical screen says so.</li>
          <li><AlertIcon size={13} /> <strong>Calibration drift.</strong> Every number still renders; they just mean slightly less than they claim, and only the ECE trend shows it.</li>
          <li><AlertIcon size={13} /> <strong>A silently degraded model.</strong> Caught only by the stratified monitor — the pooled metric can stay flat while one stratum falls apart.</li>
        </ul>
      </Card>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        subtitle={selected?.component}
        width={540}
        footer={
          selected && selected.state !== "resolved" ? (
            <>
              <Button onClick={() => { const inc = selected; setSelected(null); if (inc) void actAndRefresh(() => api.post(`/api/v1/ops/incidents/${inc.id}/state`, { state: "mitigating", note: "Mitigation in progress" }), () => "Incident set to mitigating").then(setToast); }}>Mitigating</Button>
              <Button variant="primary" onClick={() => { const inc = selected; setSelected(null); if (inc) void actAndRefresh(() => api.post(`/api/v1/ops/incidents/${inc.id}/state`, { state: "resolved", note: "Resolved from the incident detail" }), () => "Incident resolved").then(setToast); }}>Resolve</Button>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="stack" style={{ gap: 18 }}>
            <Card title="Detail">
              <p className="prose" style={{ margin: 0 }}>{selected.detail}</p>
              <dl className="kv">
                <dt>Component</dt><dd className="mono">{selected.component}</dd>
                <dt>Tenant</dt><dd>{selected.tenantName ?? "Platform-wide"}</dd>
                <dt>Severity</dt><dd><SeverityTag severity={selected.severity} /></dd>
                <dt>Opened</dt><dd>{dateTimeLabel(selected.openedAt)}</dd>
              </dl>
            </Card>
            <BreachPanel incident={selected} onDone={(m) => { setToast(m); setSelected(null); }} />
            <Card title="Add an update" subtitle="Visible to the affected tenant if this incident is customer-facing">
              <Field label="Update" hint="Written for the hospital's IT lead, not for us. Say what is affected and what they should do.">
                <TextArea
                  rows={4}
                  placeholder="The listener has been restarted and messages are flowing again. Admissions between 14:10 and 09:05 did not create encounters automatically and will need to be entered manually — a list has been sent to your informatics contact."
                  value={updateText}
                  onChange={(e) => setUpdateText(e.currentTarget.value)}
                />
              </Field>
              <Button
                variant="primary"
                disabled={updateText.trim().length < 5}
                onClick={() => {
                  const inc = selected;
                  const note = updateText.trim();
                  if (!inc) return;
                  setUpdateText("");
                  void actAndRefresh(() => api.post(`/api/v1/ops/incidents/${inc.id}/update`, { state: inc.state, note }), () => "Update published to the affected tenant").then(setToast);
                }}
              >
                Publish update
              </Button>
            </Card>
          </div>
        )}
      </Drawer>

      <Modal
        open={declaring}
        onClose={() => setDeclaring(false)}
        title="Declare an incident"
        subtitle="Opened incidents appear on the fleet dashboard and in the platform audit log"
        footer={
          <>
            <Button onClick={() => setDeclaring(false)}>Cancel</Button>
            <Button variant="primary" disabled={!draftValid} onClick={declare}>Open incident</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Title" required>
            <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="ADT feed stalled at St. Yves" maxLength={200} />
          </Field>
          <Field label="Component" required hint="The service or feed at fault, as the runbook names it.">
            <TextInput className="mono" value={draft.component} onChange={(e) => setDraft({ ...draft, component: e.target.value })} placeholder="adt-listener" maxLength={80} />
          </Field>
          <Field label="Severity" required>
            <Select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })}>
              <option value="info">Info</option>
              <option value="notice">Notice</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </Field>
          <Field label="Affected tenant" hint="Leave as platform-wide if more than one hospital is affected.">
            <Select value={draft.tenant} onChange={(e) => setDraft({ ...draft, tenant: e.target.value })}>
              <option value="">Platform-wide</option>
              {TENANTS.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="What is happening" required>
            <TextArea rows={4} value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="No HL7 messages received since 14:10. New admissions are not creating encounters." />
          </Field>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={draft.breach} onChange={(e) => setDraft({ ...draft, breach: e.target.checked })} />
            <span>Personal data may have been exposed (a breach). Starts the 24 h and 72 h clocks now.</span>
          </label>
          {draft.breach && (
            <div className="grid grid-2">
              <Field label="Types of personal data" hint="Comma-separated, e.g. names, MRNs, lab results">
                <TextInput value={draft.categories} onChange={(e) => setDraft({ ...draft, categories: e.target.value })} />
              </Field>
              <Field label="People affected (estimate)">
                <TextInput type="number" min={0} className="tnum" value={draft.affected} onChange={(e) => setDraft({ ...draft, affected: e.target.value })} />
              </Field>
            </div>
          )}
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

/**
 * Breach handling for one incident (QA issue 7): flag it, watch the clocks,
 * record each notice as it goes out, and start from a filled-in template.
 */
function BreachPanel({ incident, onDone }: { incident: Incident; onDone: (message: string) => void }) {
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [aware, setAware] = useState("");
  const [note, setNote] = useState("");
  const [record, setRecord] = useState<{ kind: BreachClock; recipient: string; reference: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(null);
    if (!incident.breach || !isLive()) return;
    api.get<Incident & { templates?: Templates }>(`/api/v1/ops/incidents/${incident.id}`)
      .then((r) => setTemplates(r.templates ?? null))
      .catch(() => undefined);
  }, [incident.id, incident.breach]);

  function flag(on: boolean) {
    void actAndRefresh(
      () => api.post(`/api/v1/ops/incidents/${incident.id}/breach`, {
        breach: on, aware_at: aware ? new Date(aware).toISOString() : null,
        data_categories: incident.breach?.dataCategories ?? [], affected_estimate: incident.breach?.affectedEstimate ?? null,
        note: note.trim() || (on ? "Flagged as a personal-data breach" : "Not a personal-data breach after review"),
      }),
      () => (on ? "Flagged as a breach — the clocks run from the time ESAP became aware" : "Breach flag removed"),
    ).then(onDone);
  }

  function saveNotice() {
    if (!record) return;
    const r = record;
    setRecord(null);
    void actAndRefresh(
      () => api.post(`/api/v1/ops/incidents/${incident.id}/notifications`, {
        kind: r.kind, recipient: r.recipient.trim(), reference: r.reference.trim() || null,
      }),
      () => "Notice recorded",
    ).then(onDone);
  }

  async function copy(key: BreachClock) {
    const tpl = templates?.[key];
    if (!tpl) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${tpl.subject}\n\n${tpl.body}`);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  }

  if (!incident.breach) {
    return (
      <Card title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={16} /> Personal-data breach</span>}
        subtitle="Flag this incident if personal data may have been exposed">
        <Field label="When ESAP became aware" hint="Leave blank for now. The 24 h and 72 h clocks run from this time.">
          <TextInput type="datetime-local" value={aware} onChange={(e) => setAware(e.target.value)} />
        </Field>
        <Field label="Why"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Export sent to the wrong hospital" /></Field>
        <Button variant="danger" icon={<ShieldIcon size={14} />} onClick={() => flag(true)}>Flag as a breach</Button>
      </Card>
    );
  }

  const b = incident.breach;
  return (
    <Card title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={16} /> Personal-data breach</span>}
      subtitle={`Aware since ${dateTimeLabel(b.awareAt)}${b.affectedEstimate !== null ? ` · about ${b.affectedEstimate} people` : ""}`}
      footnote="Deadlines follow the Saudi PDPL implementing regulation and the processing contract. A notice is recorded here when it is sent; nothing is sent automatically.">
      {b.dataCategories.length > 0 && <p className="muted" style={{ margin: 0 }}>Data involved: {b.dataCategories.join(", ")}</p>}
      <BreachClocks incident={incident} />
      <div className="stack" style={{ gap: 10 }}>
        {CLOCKS.map((c) => (
          <div key={c.key} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" disabled={!templates} onClick={() => void copy(c.key)}>
              {copied === c.key ? "Copied" : `Copy the ${c.key === "controller" ? "hospital" : c.key === "regulator" ? "SDAIA" : "patient"} notice`}
            </Button>
            {!b.notifications[c.key] && (
              <Button size="sm" variant="ghost" onClick={() => setRecord({ kind: c.key, recipient: "", reference: "" })}>
                Record as sent
              </Button>
            )}
          </div>
        ))}
      </div>
      {record && (
        <div className="stack" style={{ gap: 10 }}>
          <Field label="Sent to" required hint="The hospital's DPO, the SDAIA portal, or how patients were told">
            <TextInput value={record.recipient} onChange={(e) => setRecord({ ...record, recipient: e.target.value })} />
          </Field>
          <Field label="Reference" hint="Ticket or SDAIA reference number, if any">
            <TextInput value={record.reference} onChange={(e) => setRecord({ ...record, reference: e.target.value })} />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={() => setRecord(null)}>Cancel</Button>
            <Button variant="primary" disabled={record.recipient.trim().length < 2} onClick={saveNotice}>Save</Button>
          </div>
        </div>
      )}
      <Field label="If this turns out not to be a breach"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why, for the record" /></Field>
      <Button size="sm" variant="ghost" disabled={note.trim().length < 5} onClick={() => flag(false)}>Remove the breach flag</Button>
    </Card>
  );
}
