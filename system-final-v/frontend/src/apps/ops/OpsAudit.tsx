/**
 * 11.5.7 — Platform audit log.
 *
 * Every super-admin action, unfiltered and cross-tenant. The distinction from
 * the tenant-level log is that this one records what ESAP did to customers,
 * which is the log an auditor will actually want during a SOC 2 assessment.
 */
import { useMemo, useState } from "react";
import { PLATFORM_AUDIT, TENANTS } from "@/mock/db";
import type { AuditEvent } from "@/mock/types";
import { ago, dateTimeLabel } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, PageHeader, SegmentedControl, Select, StatTile } from "@/components/ui/primitives";
import { Drawer, Toast } from "@/components/ui/overlays";
import { OutcomeTag, SeverityTag } from "@/components/ui/domain";
import { AlertIcon, DownloadIcon, ShieldIcon, UnlockIcon } from "@/components/ui/icons";
import { requestExport } from "@/api/actions";

export function OpsAudit() {
  const [tenant, setTenant] = useState("all");
  const [severity, setSeverity] = useState<"all" | "notice" | "warning" | "critical">("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      PLATFORM_AUDIT.filter(
        (e) => (tenant === "all" || e.tenantId === tenant) && (severity === "all" || e.severity === severity),
      ),
    [tenant, severity],
  );

  const critical = PLATFORM_AUDIT.filter((e) => e.severity === "critical").length;
  const bg = PLATFORM_AUDIT.filter((e) => e.action.includes("break_glass")).length;
  const crossTenant = PLATFORM_AUDIT.filter((e) => e.action === "audit.cross_tenant_read").length;

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
    { key: "actor", header: "Actor", sortBy: (e) => e.actor, render: (e) => <strong>{e.actor}</strong> },
    { key: "action", header: "Action", sortBy: (e) => e.action, render: (e) => <span className="mono" style={{ fontSize: 12.5 }}>{e.action}</span> },
    {
      key: "tenant", header: "Tenant", sortBy: (e) => e.tenantId,
      render: (e) => <span className="muted">{TENANTS.find((t) => t.id === e.tenantId)?.name ?? e.tenantId}</span>,
    },
    { key: "outcome", header: "Outcome", render: (e) => <OutcomeTag outcome={e.outcome} /> },
    { key: "severity", header: "Severity", sortBy: (e) => e.severity, render: (e) => <SeverityTag severity={e.severity} /> },
    { key: "ip", header: "Source", secondary: true, render: (e) => <span className="muted mono" style={{ fontSize: 11.5 }}>{e.ip}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Platform audit log"
        lede="Every action ESAP staff have taken across the fleet. This is the log an external auditor reads — the one that records what the vendor did to its customers."
        actions={<Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("platform_audit").then(setToast)}>Export</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Events (90 days)" value={PLATFORM_AUDIT.length} icon={<ShieldIcon size={15} />} />
        <StatTile label="Critical severity" value={critical} tone={critical > 0 ? "warning" : "good"} icon={<AlertIcon size={15} />} hint="Tenant suspensions and break-glass approvals" />
        <StatTile label="Break-glass actions" value={bg} tone={bg > 0 ? "warning" : "neutral"} icon={<UnlockIcon size={15} />} />
        <StatTile label="Cross-tenant reads" value={crossTenant} hint="Reading one tenant's audit log from this console" />
      </div>

      <Banner tone="accent" title="This log cannot be edited or pruned by anyone here">
        Append-only, hash-chained daily, retained for six years. There is no delete path from this
        console, from the database console, or from a support escalation. A vendor that can quietly
        edit its own audit log does not have an audit log.
      </Banner>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(e) => e.id}
        searchable
        searchPlaceholder="Search actor, action or tenant"
        searchFields={(e) => `${e.actor} ${e.action} ${e.target} ${e.reason ?? ""}`}
        onRowClick={setSelected}
        pageSize={16}
        dense
        caption="Platform-wide audit log"
        empty={{ title: "No matching events", message: "Nothing matches these filters." }}
        toolbar={
          <>
            <Select value={tenant} onChange={(e) => setTenant(e.target.value)} aria-label="Filter by tenant">
              <option value="all">All tenants</option>
              {TENANTS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <SegmentedControl
              size="sm"
              ariaLabel="Severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: "all", label: "All" },
                { value: "notice", label: "Notice" },
                { value: "warning", label: "Warning" },
                { value: "critical", label: "Critical" },
              ]}
            />
          </>
        }
      />

      <Card title="What a customer sees of this log" subtitle="Transparency, both directions">
        <p className="prose" style={{ margin: 0 }}>
          Every entry here that touches a specific tenant is mirrored into that tenant&rsquo;s own audit
          log, visible to their privacy officer, with the same reason text. A hospital can see what ESAP
          did in their environment without asking us, and without taking our word for it. Entries that
          touch no tenant — a global feature-flag change, a plan-catalog edit — stay here.
        </p>
      </Card>

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
              <Card title="Stated justification">
                <p className="audit-row-reason" style={{ margin: 0 }}>{selected.reason}</p>
              </Card>
            )}
            <Card title="Event">
              <dl className="kv">
                <dt>Action</dt><dd className="mono">{selected.action}</dd>
                <dt>Target</dt><dd className="mono">{selected.target}</dd>
                <dt>Tenant</dt><dd>{TENANTS.find((t) => t.id === selected.tenantId)?.name}</dd>
                <dt>Outcome</dt><dd><OutcomeTag outcome={selected.outcome} /></dd>
                <dt>Severity</dt><dd><SeverityTag severity={selected.severity} /></dd>
                <dt>Actor</dt><dd>{selected.actor}</dd>
                <dt>Source</dt><dd className="mono">{selected.ip}</dd>
                <dt>Timestamp</dt><dd className="mono">{selected.at}</dd>
              </dl>
            </Card>
            <Card title="Mirrored to the tenant">
              <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                This entry is visible to the privacy officer at{" "}
                {TENANTS.find((t) => t.id === selected.tenantId)?.name}, with the same reason text.
              </p>
            </Card>
          </div>
        )}
      </Drawer>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
