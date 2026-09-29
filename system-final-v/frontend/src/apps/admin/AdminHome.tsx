/**
 * 11.4.1 — Hospital Admin home: status + alerts.
 *
 * The question this screen answers is "is anything wrong in my hospital's
 * deployment today". Adoption is shown but is deliberately not the headline —
 * the headline is whether the thing is working correctly and fairly.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADOPTION_SERIES, AUDIT_EVENTS, DRIFT, INVITES, MODELS, TRANSFERS, USERS } from "@/mock/db";
import { useSession, tenantFor } from "@/lib/session";
import { can } from "@/lib/rbac";
import { ago, num, pct } from "@/lib/format";
import { Banner, Button, Card, PageHeader, StatTile } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { LinePanel, PanelGrid, Sparkline } from "@/components/ui/charts";
import { ModeTag, SeverityTag, StatusPill } from "@/components/ui/domain";
import {
  AlertIcon, ArrowRight, BellIcon, ChartIcon, CheckIcon, GlobeIcon, MailIcon, ScaleIcon, ShieldIcon, UsersIcon,
} from "@/components/ui/icons";

type ServiceRequest = {
  id: string; kind: string; label: string; detail: string; ref: string | null;
  status: "open" | "in_progress" | "closed"; urgent: boolean; requestedAt: string; requestedBy: string;
};

/**
 * Requests people raised for the hospital to act on: patient messages, record
 * requests and corrections, password resets from the sign-in page. With no
 * email service this queue is where they arrive.
 */
function RequestInbox({ onToast }: { onToast: (m: string) => void }) {
  const nav = useNavigate();
  const { role } = useSession();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  useEffect(() => {
    if (!isLive()) { setRequests([]); return; }
    api.get<{ requests: ServiceRequest[] }>("/api/v1/requests?limit=200")
      .then((r) => setRequests(r.requests))
      .catch(() => setRequests([]));
  }, []);
  const open = (requests ?? []).filter((r) => r.status !== "closed");

  async function close(r: ServiceRequest) {
    const message = await act(
      () => api.post<ServiceRequest>(`/api/v1/requests/${r.id}/status`, { status: "closed", note: "Handled from the admin home" }),
      (updated) => {
        setRequests((all) => (all ?? []).map((x) => (x.id === updated.id ? updated : x)));
        return `${r.label} marked handled — logged`;
      },
    );
    onToast(message);
  }

  return (
    <Card
      title={<span className="row" style={{ gap: 7 }}><MailIcon size={16} /> Requests waiting on the hospital</span>}
      subtitle={requests === null ? "Loading…" : `${open.length} open`}
    >
      {open.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing is waiting.</p>
      ) : (
        <ul className="watch-list">
          {open.slice(0, 8).map((r) => (
            <li key={r.id}>
              {r.urgent ? <AlertIcon size={14} /> : <MailIcon size={14} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 12.5 }}>{r.label}</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 11.5 }}>
                  {r.requestedBy} · {ago(r.requestedAt)}{r.ref ? ` · ${r.ref}` : ""}
                </p>
                {r.kind !== "password_reset_request" && <p style={{ margin: "3px 0 0", fontSize: 12 }}>{r.detail}</p>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {r.kind === "password_reset_request" && can(role, "user:manage") && <Button size="sm" onClick={() => nav("/admin/roster")}>Roster</Button>}
                <Button size="sm" variant="ghost" icon={<CheckIcon size={13} />} onClick={() => void close(r)}>Handled</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AdminHome() {
  const nav = useNavigate();
  const { tenantId, role } = useSession();
  const tenant = tenantFor(tenantId);
  const [toast, setToast] = useState<string | null>(null);
  const canSeeTransfers = can(role, "transfer:approve") || can(role, "transfer:initiate");
  const canSeeAudit = can(role, "audit:view");

  const pendingInvites = INVITES.filter((i) => i.status === "pending");
  const expiredInvites = INVITES.filter((i) => i.status === "expired");
  const activeUsers = USERS.filter((u) => u.status === "active");
  const needsAttention = TRANSFERS.filter((t) => t.state === "mpi_review" || t.state === "consent_pending");
  const degraded = MODELS.filter((m) => m.status === "degraded");
  const recentCritical = AUDIT_EVENTS.filter((e) => e.severity === "critical" || e.outcome === "denied").slice(0, 5);

  // Production drift monitoring needs outcome data this server does not have;
  // until then the calibration figure is the evaluation of record's.
  const latestEce = DRIFT.length ? DRIFT[DRIFT.length - 1].ece
    : (() => { const m = MODELS.filter((x) => x.id !== "M-05" && x.ece > 0); return m.length ? m.reduce((a, x) => a + x.ece, 0) / m.length : 0; })();
  const eceRising = DRIFT.length > 5 && latestEce > DRIFT[DRIFT.length - 6].ece;
  const monthNow = ADOPTION_SERIES.slice(-4).reduce((a, w) => a + w.assessments, 0);
  const monthBefore = ADOPTION_SERIES.slice(-8, -4).reduce((a, w) => a + w.assessments, 0);
  const monthChange = monthBefore ? (monthNow - monthBefore) / monthBefore : null;

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title={tenant.name}
        lede="Deployment status, the things that need a decision from you, and whether the models are still behaving."
        meta={
          <>
            <ModeTag mode={tenant.mode} />
            <StatusPill status={tenant.status} />
            <span className="muted" style={{ fontSize: 12 }}>
              {tenant.facilities} facilities · {num(tenant.beds)} beds · live since {ago(tenant.goLive)}
            </span>
          </>
        }
        actions={can(role, "user:manage") && (
          <Button variant="primary" icon={<UsersIcon size={15} />} onClick={() => nav("/admin/invites")}>Invite staff</Button>
        )}
      />

      {degraded.length > 0 && (
        <Banner
          tone="warning"
          title={`${degraded.length} model is serving degraded`}
          actions={<Button size="sm" onClick={() => nav("/admin/models")}>Review</Button>}
        >
          {degraded.map((m) => `${m.id} ${m.name}`).join(", ")} — it is labelled as degraded on every
          clinical screen. You can suppress it for your tenant entirely from Model &amp; display settings.
        </Banner>
      )}

      {eceRising && (
        <Banner
          tone="warning"
          title="Calibration error is trending up"
          actions={<Button size="sm" onClick={() => nav("/admin/usage")}>See the trend</Button>}
        >
          Pooled ECE has moved to {latestEce.toFixed(3)} over the last six weeks. It is still inside the
          0.05 action threshold, but the direction is worth watching — recalibration is an ESAP-side
          action and your account team has been notified automatically.
        </Banner>
      )}

      <div className="grid grid-4">
        <StatTile
          label="Assessments this month"
          value={num(monthNow)}
          icon={<ChartIcon size={15} />}
          delta={monthChange === null ? undefined : { dir: monthChange > 0 ? "up" : monthChange < 0 ? "down" : "flat", label: `${monthChange > 0 ? "+" : ""}${Math.round(monthChange * 100)}% on the 4 weeks before` }}
          hint="The metered unit on your Enterprise plan"
        />
        <StatTile
          label="Active clinicians"
          value={num(activeUsers.length)}
          unit={`/ ${tenant.seats}`}
          icon={<UsersIcon size={15} />}
          hint={`${pct(tenant.adoptionPct / 100, 0)} of licensed seats used in the last 30 days`}
        />
        <StatTile
          label="Needs your decision"
          value={needsAttention.length + expiredInvites.length}
          tone={needsAttention.length > 0 ? "warning" : "neutral"}
          icon={<BellIcon size={15} />}
          hint="Transfer reviews and expired invites"
        />
        <StatTile
          label="Calibration error (ECE)"
          value={latestEce.toFixed(4)}
          tone={latestEce > 0.05 ? "critical" : "good"}
          icon={<ScaleIcon size={15} />}
          hint={DRIFT.length ? "Pooled across the models, from monitoring. Action threshold 0.05." : "From the evaluation of record (no production monitoring yet). Action threshold 0.05."}
        />
      </div>

      <div className="split">
        <Card
          title="Adoption"
          subtitle="Assessments run and clinicians active, by week"
          footnote="Adoption is a useful operational number and a poor safety number. High usage with low acknowledgement rates is a warning sign, not a success."
          actions={<Button size="sm" onClick={() => nav("/admin/usage")}>Full report <ArrowRight size={13} /></Button>}
        >
          <PanelGrid>
            <LinePanel
              title="Assessments per week"
              labels={ADOPTION_SERIES.map((a) => a.week)}
              values={ADOPTION_SERIES.map((a) => a.assessments)}
              format={(v) => num(v)}
            />
            <LinePanel
              title="Acknowledged within 24 h"
              labels={ADOPTION_SERIES.map((a) => a.week)}
              values={ADOPTION_SERIES.map((a) => a.acknowledgedPct)}
              format={(v) => pct(v, 1)}
              domain={[0, 1]}
              reference={{ value: 0.7, label: "target 70%", tone: "good" }}
              color="var(--vital)"
            />
          </PanelGrid>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          {canSeeTransfers && (
          <Card
            title={<span className="row" style={{ gap: 7 }}><GlobeIcon size={16} /> Record transfers</span>}
            subtitle={`${needsAttention.length} awaiting a decision`}
            actions={<Button size="sm" onClick={() => nav("/admin/interop")}>Open queue</Button>}
          >
            {needsAttention.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing is waiting. Inbound requests that match above 0.92 are accepted automatically.</p>
            ) : (
              <ul className="watch-list">
                {needsAttention.map((t) => (
                  <li key={t.id}>
                    <div style={{ flex: 1 }}>
                      <strong>{t.patientDisplay}</strong>
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                        {t.counterparty} · MPI match <span className="tnum">{t.mpiScore.toFixed(2)}</span>
                        {t.mpiScore < 0.92 && " — below the auto-accept bar"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          )}

          {canSeeAudit && (
          <Card
            title={<span className="row" style={{ gap: 7 }}><ShieldIcon size={16} /> Recent security events</span>}
            subtitle="Denied access and break-glass use"
            actions={<Button size="sm" onClick={() => nav("/admin/audit")}>Full log</Button>}
          >
            <ul className="watch-list">
              {recentCritical.map((e) => (
                <li key={e.id}>
                  <SeverityTag severity={e.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong className="mono" style={{ fontSize: 12.5 }}>{e.action}</strong>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 11.5 }}>
                      {e.actor} · {ago(e.at)} · {e.outcome}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          )}

          <RequestInbox onToast={setToast} />

          {can(role, "user:manage") && (
          <Card title="Invites" subtitle={`${pendingInvites.length} pending, ${expiredInvites.length} expired`}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <Sparkline points={[2, 5, 3, 8, 6, 9, 4, pendingInvites.length]} ariaLabel="Invites sent per week" width={140} />
              <Button size="sm" onClick={() => nav("/admin/invites")}>Manage</Button>
            </div>
            {expiredInvites.length > 0 && (
              <p className="inline-warn">
                <AlertIcon size={13} />
                {expiredInvites.length} invite{expiredInvites.length > 1 ? "s have" : " has"} expired without
                being accepted. Expired invites cannot be reused — reissue them.
              </p>
            )}
          </Card>
          )}
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
