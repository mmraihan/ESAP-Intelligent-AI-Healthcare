/**
 * 11.5.1 — Fleet dashboard. Every tenant at a glance.
 *
 * The defining property of this console: it shows operational state across all
 * tenants and no patient data from any of them. Reaching a chart requires a
 * time-boxed break-glass elevation, which is a different screen on purpose.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INCIDENTS, TENANTS } from "@/mock/db";
import type { Tenant } from "@/mock/types";
import { ago, num, pct } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, PageHeader, SegmentedControl, StatTile, cx } from "@/components/ui/primitives";
import { ISOLATION_LABEL, ModeTag, SeverityTag, StatusPill } from "@/components/ui/domain";
import { Sparkline } from "@/components/ui/charts";
import { ActivityIcon, BuildingIcon, GridIcon, ListIcon, LockIcon, PlusIcon, ServerIcon } from "@/components/ui/icons";

export function OpsFleet() {
  const nav = useNavigate();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<"all" | "attention">("all");

  const rows = useMemo(
    () => (filter === "all" ? TENANTS : TENANTS.filter((t) => t.openIncidents > 0 || t.status !== "active")),
    [filter],
  );

  const totalBeds = TENANTS.reduce((a, t) => a + t.beds, 0);
  const totalAssess = TENANTS.reduce((a, t) => a + t.assessments30d, 0);
  const openIncidents = INCIDENTS.filter((i) => i.state !== "resolved").length;
  const stale = TENANTS.filter((t) => Date.now() - new Date(t.lastEtlRefresh).getTime() > 24 * 3600_000);

  const columns: Column<Tenant>[] = [
    {
      key: "name", header: "Tenant", width: "22%", sortBy: (t) => t.name,
      render: (t) => (
        <div className="cell-stack">
          <strong>{t.name}</strong>
          <span className="muted mono">{t.slug} · {t.region}</span>
        </div>
      ),
    },
    { key: "mode", header: "Deployment", sortBy: (t) => t.mode, render: (t) => <ModeTag mode={t.mode} /> },
    { key: "isolation", header: "Isolation", secondary: true, render: (t) => <span className="muted">{ISOLATION_LABEL[t.isolation]}</span> },
    { key: "beds", header: "Beds", align: "right", sortBy: (t) => t.beds, render: (t) => <span className="tnum">{num(t.beds)}</span> },
    {
      key: "seats", header: "Seats", align: "right", secondary: true, sortBy: (t) => t.seatsUsed,
      render: (t) => <span className="tnum">{num(t.seatsUsed)} / {num(t.seats)}</span>,
    },
    { key: "assess", header: "Assessments (30 d)", align: "right", sortBy: (t) => t.assessments30d, render: (t) => <span className="tnum">{num(t.assessments30d)}</span> },
    { key: "adopt", header: "Adoption", align: "right", sortBy: (t) => t.adoptionPct, render: (t) => <span className="tnum">{pct(t.adoptionPct / 100, 0)}</span> },
    {
      key: "etl", header: "Last refresh", sortBy: (t) => t.lastEtlRefresh,
      render: (t) => {
        const isStale = Date.now() - new Date(t.lastEtlRefresh).getTime() > 24 * 3600_000;
        return <span className={isStale ? "pill pill-warning" : "muted"}>{ago(t.lastEtlRefresh)}</span>;
      },
    },
    {
      key: "status", header: "Status", sortBy: (t) => t.status,
      render: (t) => (
        <div className="row" style={{ gap: 6 }}>
          <StatusPill status={t.status} />
          {t.openIncidents > 0 && <span className="pill pill-warning">{t.openIncidents} open</span>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Fleet"
        lede="Every tenant, their deployment shape and their operational health. Nothing on this console shows patient data — reaching a chart is a separate, audited elevation."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => nav("/ops/provision")}>Provision a tenant</Button>}
      />

      <Banner tone="accent" icon={<LockIcon size={16} />} title="Zero standing access to PHI">
        Your super-admin role can create, suspend and configure tenants. It cannot open a patient
        record anywhere. Support cases that genuinely need one go through break-glass: a stated
        reason, a ticket reference, a second approver and a countdown clock.
      </Banner>

      <div className="grid grid-4">
        <StatTile label="Tenants" value={TENANTS.length} icon={<BuildingIcon size={15} />} hint={`${TENANTS.filter((t) => t.status === "active").length} active`} />
        <StatTile label="Beds under contract" value={num(totalBeds)} icon={<ServerIcon size={15} />} />
        <StatTile label="Assessments (30 d)" value={num(totalAssess)} icon={<ActivityIcon size={15} />} />
        <StatTile
          label="Open incidents"
          value={openIncidents}
          tone={openIncidents > 2 ? "critical" : openIncidents > 0 ? "warning" : "good"}
          hint="Across the whole fleet"
        />
      </div>

      {stale.length > 0 && (
        <Banner
          tone="warning"
          title={`${stale.length} tenant${stale.length > 1 ? "s have" : " has"} a stale data refresh`}
          actions={<Button size="sm" onClick={() => nav("/ops/incidents")}>Incidents</Button>}
        >
          {stale.map((t) => t.name).join(", ")} — no ETL completion in over 24 hours. Stale data does
          not stop assessments running; it means they are running on an older cohort snapshot than
          intended, which is worse than an outage because it is invisible to the clinician.
        </Banner>
      )}

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <SegmentedControl
          size="sm"
          ariaLabel="View"
          value={view}
          onChange={setView}
          options={[{ value: "cards", label: "Cards", icon: <GridIcon size={13} /> }, { value: "table", label: "Table", icon: <ListIcon size={13} /> }]}
        />
        <SegmentedControl
          size="sm"
          ariaLabel="Filter"
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "All tenants" }, { value: "attention", label: "Needs attention" }]}
        />
      </div>

      {view === "cards" ? (
        <div className="tenant-grid">
          {rows.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cx("tenant-card", t.status === "suspended" && "is-suspended", t.status === "pending" && "is-pending")}
              onClick={() => nav(`/ops/tenants/${t.id}`)}
            >
              <div className="tenant-card-head">
                <div>
                  <span className="tenant-name">{t.name}</span>
                  <br />
                  <span className="tenant-slug">{t.slug}</span>
                </div>
                <StatusPill status={t.status} />
              </div>

              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <ModeTag mode={t.mode} />
                <span className="scope-chip">{t.region}</span>
              </div>

              <p className="muted" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45 }}>
                {ISOLATION_LABEL[t.isolation]}
              </p>

              <div className="tenant-stats">
                <div>
                  <span className="tenant-stat-label">Beds</span>
                  <span className="tenant-stat-value tnum">{num(t.beds)}</span>
                </div>
                <div>
                  <span className="tenant-stat-label">Seats</span>
                  <span className="tenant-stat-value tnum">{num(t.seatsUsed)}</span>
                </div>
                <div>
                  <span className="tenant-stat-label">Adoption</span>
                  <span className="tenant-stat-value tnum">{t.adoptionPct}%</span>
                </div>
              </div>

              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Sparkline
                  points={[0.7, 0.75, 0.72, 0.8, 0.84, 0.82, t.adoptionPct / 100]}
                  ariaLabel={`${t.name} adoption trend`}
                  width={92}
                  height={24}
                />
                <span className="muted" style={{ fontSize: 10.5 }}>refresh {ago(t.lastEtlRefresh)}</span>
              </div>

              {t.openIncidents > 0 && (
                <div className="row" style={{ gap: 6 }}>
                  <SeverityTag severity="warning" />
                  <span style={{ fontSize: 11.5 }}>{t.openIncidents} open incident{t.openIncidents > 1 ? "s" : ""}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(t) => t.id}
          searchable
          searchPlaceholder="Search tenant or slug"
          searchFields={(t) => `${t.name} ${t.slug} ${t.region} ${t.mode}`}
          onRowClick={(t) => nav(`/ops/tenants/${t.id}`)}
          caption="Tenant fleet"
          empty={{ title: "No tenants match", message: "Nothing matches this filter." }}
        />
      )}

      <Card title="Isolation tiers in the fleet" subtitle="What each tenant's data boundary actually is">
        <div className="scroll-x">
          <table className="data-table is-dense">
            <thead><tr><th>Tier</th><th>What it means</th><th style={{ textAlign: "right" }}>Tenants</th></tr></thead>
            <tbody>
              {(Object.keys(ISOLATION_LABEL) as (keyof typeof ISOLATION_LABEL)[]).map((k) => (
                <tr key={k}>
                  <td><strong>{ISOLATION_LABEL[k]}</strong></td>
                  <td className="muted">
                    {k === "shared_rls" && "One schema, row-level security on tenant_id. Cheapest; the boundary is a policy, not a wall."}
                    {k === "schema_per_tenant" && "Separate schema per tenant in a shared database. A query cannot cross the boundary without an explicit schema switch."}
                    {k === "db_per_tenant" && "Separate database. Backup, restore and key rotation are per tenant."}
                    {k === "single_tenant_vpc" && "Dedicated infrastructure. Nothing is shared, including the compute the models run on."}
                  </td>
                  <td style={{ textAlign: "right" }} className="tnum">{TENANTS.filter((t) => t.isolation === k).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
