/**
 * Support queue — every ticket from every tenant, for platform staff.
 *
 * Sorted by who has the next move: tickets waiting on support come first,
 * urgent before normal, oldest wait first. Replying assigns the ticket to you.
 */
import { useMemo, useState } from "react";
import {
  TICKET_STATUSES, categoryLabel, statusLabel, since, useLive, type Ticket, type TicketStatus,
} from "@/api/desk";
import { dateTimeLabel } from "@/lib/format";
import { Badge, Banner, Card, LoadingRows, PageHeader, SegmentedControl, StatTile } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { Toast } from "@/components/ui/overlays";
import { AlertIcon, ClockIcon, MailIcon } from "@/components/ui/icons";
import { TicketDrawer, TicketStatusBadge } from "@/components/support/TicketThread";

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const DONE: TicketStatus[] = ["resolved", "closed"];

export function OpsSupport() {
  const { data, error, loading, reload, offline } = useLive<{ tickets: Ticket[] }>("/api/v1/support/tickets");
  const [filter, setFilter] = useState<"active" | "all" | TicketStatus>("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const all = data?.tickets ?? [];
  const rows = useMemo(() => {
    const shown = filter === "all" ? all
      : filter === "active" ? all.filter((t) => !DONE.includes(t.status))
      : all.filter((t) => t.status === filter);
    return [...shown].sort((a, b) =>
      (a.awaiting === "support" ? 0 : 1) - (b.awaiting === "support" ? 0 : 1)
      || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || a.updatedAt.localeCompare(b.updatedAt));
  }, [all, filter]);
  const open = all.find((t) => t.id === openId) ?? null;

  const active = all.filter((t) => !DONE.includes(t.status));
  const waiting = active.filter((t) => t.awaiting === "support");
  const urgent = active.filter((t) => t.priority === "urgent" || t.priority === "high");

  return (
    <>
      <PageHeader
        eyebrow="Growth & support"
        title="Support tickets"
        lede="Technical support from every tenant and every role. Requesters see only their own tickets; you see them all. Tickets are about the product — if one contains patient information, tell the requester and do not copy it anywhere."
      />

      {offline && <Banner tone="info">Tickets live on the server. Connect to the live API to work the queue.</Banner>}
      {error && <Banner tone="critical">{error}</Banner>}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile label="Open tickets" value={data ? active.length : "—"} icon={<MailIcon size={16} />} />
        <StatTile label="Waiting on support" value={data ? waiting.length : "—"} icon={<ClockIcon size={16} />} />
        <StatTile label="High or urgent" value={data ? urgent.length : "—"} icon={<AlertIcon size={16} />} />
        <StatTile label="All time" value={data ? all.length : "—"} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 16 }}>
          {loading && !data ? <LoadingRows /> : (
            <DataTable
              rows={rows}
              getRowId={(t) => t.id}
              searchable
              searchPlaceholder="Search subject, person, tenant, ticket id"
              searchFields={(t) => `${t.subject} ${t.requesterName} ${t.requesterEmail} ${t.tenantName ?? ""} ${t.id}`}
              onRowClick={(t) => setOpenId(t.id)}
              toolbar={
                <SegmentedControl
                  size="sm"
                  ariaLabel="Filter tickets"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "active", label: "Active" },
                    ...TICKET_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
                    { value: "all", label: "All" },
                  ]}
                />
              }
              empty={{ title: "Nothing in the queue", message: "New tickets from any signed-in user appear here.", icon: <MailIcon size={20} /> }}
              columns={[
                {
                  key: "subject", header: "Ticket", sortBy: (t) => t.subject.toLowerCase(),
                  render: (t) => (
                    <span className="stack" style={{ gap: 2 }}>
                      <strong>{t.subject}</strong>
                      <span className="muted" style={{ fontSize: 12.5 }}>{t.id} · {categoryLabel(t.category)}</span>
                    </span>
                  ),
                },
                {
                  key: "from", header: "From", sortBy: (t) => t.requesterName,
                  render: (t) => (
                    <span className="stack" style={{ gap: 2 }}>
                      <span>{t.requesterName}</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>{t.tenantName ?? t.tenantId}</span>
                    </span>
                  ),
                },
                {
                  key: "priority", header: "Priority", sortBy: (t) => PRIORITY_RANK[t.priority],
                  render: (t) => <Badge tone={t.priority === "urgent" || t.priority === "high" ? "warning" : "neutral"}>{statusLabel(t.priority)}</Badge>,
                },
                { key: "status", header: "Status", sortBy: (t) => t.status, render: (t) => <TicketStatusBadge status={t.status} /> },
                {
                  key: "next", header: "Next move", secondary: true,
                  render: (t) => DONE.includes(t.status) ? <span className="muted">—</span>
                    : t.awaiting === "support" ? <strong>Support</strong> : <span className="muted">Requester</span>,
                },
                { key: "assignee", header: "Assignee", secondary: true, render: (t) => t.assignee ?? <span className="muted">Unassigned</span> },
                { key: "updated", header: "Updated", sortBy: (t) => t.updatedAt, render: (t) => <span className="tnum" title={dateTimeLabel(t.updatedAt)}>{since(t.updatedAt)}</span> },
              ]}
            />
          )}
        </div>
      </Card>

      {open && (
        <TicketDrawer ticket={open} staff onClose={() => setOpenId(null)} onChanged={(m) => { setToast(m); reload(); }} />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
