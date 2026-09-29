/**
 * 11.5.3 — Tenant detail. Drill-in from the fleet dashboard.
 *
 * Everything operational about one hospital and nothing clinical. Suspension is
 * here because it is the sharpest lever on this console; it is deliberately
 * wrapped in a two-step confirm that spells out that it does not delete data.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { INCIDENTS, MODELS, PLANS, PLATFORM_AUDIT, TENANTS } from "@/mock/db";
import { ago, dateLabel, num, pct, usd } from "@/lib/format";
import { ISOLATION_LABEL, MODE_LABEL, ModeTag, SeverityTag, StatusPill } from "@/components/ui/domain";
import { Badge, Banner, Button, Card, PageHeader, StatTile, Tabs } from "@/components/ui/primitives";
import { ConfirmDestructive, Toast } from "@/components/ui/overlays";
import { LinePanel, PanelGrid } from "@/components/ui/charts";
import { DRIFT } from "@/mock/db";
import { AlertIcon, ArrowRight, LockIcon, ServerIcon, UnlockIcon } from "@/components/ui/icons";
import { actAndRefresh, isLive } from "@/api/actions";
import { api } from "@/api/client";

type AdoptionPoint = { week: string; assessments: number; activeClinicians: number; acknowledgedPct: number };

export function OpsTenantDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "health" | "models" | "activity">("overview");
  const [suspending, setSuspending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const tenant = TENANTS.find((t) => t.id === id);

  // The bootstrap-time `ADOPTION_SERIES` is the signed-in operator's own tenant,
  // computed once at sign-in — reusing it here would show every tenant this
  // drill-down is opened for the platform account's home hospital's numbers
  // under someone else's name. This screen needs the tenant being *viewed*,
  // which only a live, tenant-scoped fetch can give it.
  const [adoption, setAdoption] = useState<AdoptionPoint[] | null>(null);
  useEffect(() => {
    setAdoption(null);
    if (!id || !isLive()) return;
    api.get<{ adoption: AdoptionPoint[] }>(`/api/v1/ops/tenants/${id}`)
      .then((r) => setAdoption(r.adoption)).catch(() => setAdoption([]));
  }, [id]);

  if (!tenant) return <Navigate to="/ops/fleet" replace />;

  const plan = PLANS.find((p) => p.tier === tenant.plan);
  const incidents = INCIDENTS.filter((i) => i.tenantName === tenant.name);
  const activity = PLATFORM_AUDIT.filter((e) => e.tenantId === tenant.id);
  const stale = Date.now() - new Date(tenant.lastEtlRefresh).getTime() > 24 * 3600_000;

  return (
    <>
      <PageHeader
        eyebrow={<button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/ops/fleet")}>← Fleet</button>}
        title={tenant.name}
        lede={`${MODE_LABEL[tenant.mode]} · ${ISOLATION_LABEL[tenant.isolation]} · ${tenant.region}`}
        meta={
          <>
            <StatusPill status={tenant.status} />
            <ModeTag mode={tenant.mode} />
            <span className="tenant-slug">{tenant.slug}</span>
            <span className="muted" style={{ fontSize: 12 }}>live since {dateLabel(tenant.goLive)}</span>
          </>
        }
        actions={
          <>
            <Button icon={<UnlockIcon size={15} />} onClick={() => nav("/ops/break-glass")}>Request access</Button>
            {tenant.status === "active" ? (
              <Button variant="danger" icon={<LockIcon size={15} />} onClick={() => setSuspending(true)}>Suspend</Button>
            ) : tenant.status === "suspended" ? (
              <Button variant="primary" onClick={() => void actAndRefresh(() => api.post(`/api/v1/ops/tenants/${tenant.id}/status`, { status: "active", reason: "Reinstated from the tenant detail console" }), () => `${tenant.name} reinstated`).then(setToast)}>Reinstate</Button>
            ) : null}
          </>
        }
      />

      {tenant.status === "suspended" && (
        <Banner tone="critical" title="This tenant is suspended">
          Access is disabled for every user here. Data is retained under the 90-day contractual window
          and <strong>no deletion has been performed</strong> — suspension and deletion are separate
          actions on purpose, so a billing dispute never costs a hospital its records.
        </Banner>
      )}

      {stale && (
        <Banner tone="warning" icon={<AlertIcon size={16} />} title="Data refresh is stale">
          The last ETL completion was {ago(tenant.lastEtlRefresh)}. Assessments are still running, on
          an older cohort snapshot than intended — an invisible failure mode, which is why it is
          surfaced here rather than only in a log.
        </Banner>
      )}

      <div className="grid grid-4">
        <StatTile label="Beds" value={num(tenant.beds)} hint={`${tenant.facilities} facilities`} />
        <StatTile label="Seats in use" value={`${num(tenant.seatsUsed)}`} unit={`/ ${num(tenant.seats)}`} hint={`${pct(tenant.seatsUsed / Math.max(1, tenant.seats), 0)} utilised`} />
        <StatTile label="Assessments (30 d)" value={num(tenant.assessments30d)} />
        <StatTile label="Open incidents" value={tenant.openIncidents} tone={tenant.openIncidents > 0 ? "warning" : "good"} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "health", label: "Health" },
          { value: "models", label: "Model pinning" },
          { value: "activity", label: "Platform activity", count: activity.length },
        ]}
      />

      {tab === "overview" && (
        <div className="split">
          <Card title="Deployment" subtitle="Contractual configuration">
            <dl className="kv">
              <dt>Mode</dt><dd>{MODE_LABEL[tenant.mode]}</dd>
              <dt>Isolation</dt><dd>{ISOLATION_LABEL[tenant.isolation]}</dd>
              <dt>Region</dt><dd>{tenant.region}</dd>
              <dt>Go-live</dt><dd>{dateLabel(tenant.goLive)}</dd>
              <dt>Primary contact</dt><dd>{tenant.contact}</dd>
              <dt>Last ETL refresh</dt><dd>{ago(tenant.lastEtlRefresh)}</dd>
            </dl>
          </Card>

          <Card title={plan?.name ?? tenant.plan} subtitle={plan?.forWho}>
            <p className="plan-price">{plan?.priceLabel} <span className="plan-unit">{plan?.unit}</span></p>
            <div className="plan-limits">
              {plan?.limits.map((l) => <div key={l.label}><span>{l.label}</span><strong>{l.value}</strong></div>)}
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Estimated monthly value: <strong className="tnum">{usd(tenant.beds * 48 + 12000)}</strong>
            </p>
          </Card>
        </div>
      )}

      {tab === "health" && (
        <>
          <Card title="Operational trends" subtitle="This tenant only">
            <PanelGrid>
              <LinePanel title="Assessments per week" labels={(adoption ?? []).map((a) => a.week)} values={(adoption ?? []).map((a) => a.assessments)} format={(v) => num(v)} />
              <LinePanel title="Calibration error (ECE)" labels={DRIFT.slice(-12).map((d) => d.week)} values={DRIFT.slice(-12).map((d) => d.ece)} format={(v) => v.toFixed(3)} reference={{ value: 0.05, label: "action threshold", tone: "warning" }} color="var(--vital)" />
              <LinePanel title="Input drift (PSI)" labels={DRIFT.slice(-12).map((d) => d.week)} values={DRIFT.slice(-12).map((d) => d.psi)} format={(v) => v.toFixed(3)} reference={{ value: 0.2, label: "investigate", tone: "warning" }} />
            </PanelGrid>
          </Card>

          <Card title="Incidents" subtitle={`${incidents.length} recorded for this tenant`}>
            {incidents.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No incidents recorded against this tenant.</p>
            ) : (
              incidents.map((i) => (
                <div key={i.id} className="flag-row">
                  <div className="flag-meta">
                    <strong>{i.title}</strong>
                    <span>{i.detail}</span>
                    <span className="flag-key">{i.component} · opened {ago(i.openedAt)}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <SeverityTag severity={i.severity} />
                    <Badge tone={i.state === "resolved" ? "good" : i.state === "mitigating" ? "warning" : "critical"}>{i.state}</Badge>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {tab === "models" && (
        <Card
          title="Model version pinning"
          subtitle="Which version this tenant receives"
          footnote="A pinned tenant is excluded from canary traffic entirely rather than given a share of it — a hospital running a formal evaluation must not have the model change underneath them."
        >
          {MODELS.map((m) => (
            <div key={m.id} className="flag-row">
              <div className="flag-meta">
                <strong>{m.id} — {m.name}</strong>
                <span>Currently serving {m.version}. Platform default is {m.version}.</span>
                <span className="flag-key">{m.status} · ECE {m.ece.toFixed(3)}</span>
              </div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="muted tnum" style={{ fontSize: 12 }}>{m.headline[0]?.label} {m.headline[0]?.value}</span>
                <Badge tone="neutral">pinned</Badge>
                <Button size="sm" onClick={() => nav("/ops/rollout")}>Rollout <ArrowRight size={12} /></Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === "activity" && (
        <Card title="Platform actions on this tenant" subtitle="What ESAP staff have done here" padded={false}>
          <div className="scroll-x">
            <table className="data-table is-dense">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Severity</th><th>Reason</th></tr></thead>
              <tbody>
                {activity.map((e) => (
                  <tr key={e.id}>
                    <td className="muted">{ago(e.at)}</td>
                    <td>{e.actor}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{e.action}</td>
                    <td><SeverityTag severity={e.severity} /></td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={<span className="row" style={{ gap: 7 }}><ServerIcon size={16} /> What this console cannot reach</span>}>
        <p className="prose" style={{ margin: 0 }}>
          No patient record, no assessment result, no clinician&rsquo;s note. Everything on this page is
          operational metadata. If a support case genuinely requires looking at one patient&rsquo;s data,
          that is a break-glass request with a named patient, a ticket, a second approver and a clock —
          and this tenant can disable that capability entirely from their own org settings.
        </p>
      </Card>

      <ConfirmDestructive
        open={suspending}
        onClose={() => setSuspending(false)}
        onConfirm={() => void actAndRefresh(() => api.post(`/api/v1/ops/tenants/${tenant.id}/status`, { status: "suspended", reason: "Suspended from the tenant detail console" }), () => `${tenant.name} suspended — access disabled, no data deleted`).then(setToast)}
        title="Suspend this tenant"
        confirmWord={tenant.slug}
        actionLabel="Suspend tenant"
        body={<>You are disabling access for every user at <strong>{tenant.name}</strong>.</>}
        consequences={[
          "Every clinician here loses access at their next request, which may be mid-shift.",
          "Running assessments complete; no new ones start.",
          "Data is retained under the 90-day contractual window. This action does NOT delete anything.",
          "The suspension, and your identity, are written to the platform audit log immediately.",
        ]}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
