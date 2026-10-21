/**
 * Help & support — every signed-in person's line to platform staff.
 *
 * Open a ticket, follow the conversation, close it when it is fixed. The same
 * page sits in every surface's shell; the ops console has the other side of
 * it at /ops/support. Platform notices (a known outage) show in the shell's
 * announcement bar above this page.
 */
import { useState } from "react";
import { api } from "@/api/client";
import { act } from "@/api/actions";
import {
  TICKET_CATEGORIES, TICKET_PRIORITIES, categoryLabel, since, statusLabel, useLive,
  type Ticket,
} from "@/api/desk";
import {
  Banner, Button, Card, Field, LoadingRows, PageHeader, Select, TextArea, TextInput,
} from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { Modal, Toast } from "@/components/ui/overlays";
import { MailIcon, PlusIcon } from "@/components/ui/icons";
import { TicketDrawer, TicketStatusBadge } from "@/components/support/TicketThread";

const BLANK = { subject: "", category: "bug", priority: "normal", message: "" };

export function SupportPage() {
  const tickets = useLive<{ tickets: Ticket[] }>("/api/v1/support/tickets");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = tickets.data?.tickets ?? [];
  const open = rows.find((t) => t.id === openId) ?? null;
  const valid = draft.subject.trim().length >= 4 && draft.message.trim().length >= 5;

  async function submit() {
    setComposing(false);
    const msg = await act(
      () => api.post<Ticket>("/api/v1/support/tickets", {
        subject: draft.subject.trim(), category: draft.category,
        priority: draft.priority, message: draft.message.trim(),
      }),
      (t) => { setOpenId(t.id); return `Ticket ${t.id} opened. Support will reply here.`; },
    );
    setDraft(BLANK);
    setToast(msg);
    tickets.reload();
  }

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Help & support"
        lede="Something not working, or a question about the product? Open a ticket and ESAP's technical team will reply here."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => setComposing(true)} disabled={tickets.offline}>New ticket</Button>}
      />

      {tickets.offline && <Banner tone="info">Support needs the live server. Start the backend to open or read tickets.</Banner>}
      {tickets.error && <Banner tone="critical">{tickets.error}</Banner>}

      <Card title="Your tickets" subtitle="Newest activity first." padded={false}>
        <div style={{ padding: 16 }}>
          {tickets.loading && !tickets.data ? <LoadingRows /> : (
            <DataTable
              rows={rows}
              getRowId={(t) => t.id}
              onRowClick={(t) => setOpenId(t.id)}
              empty={{
                title: "No tickets yet",
                message: "When you open a ticket it appears here with every reply.",
                icon: <MailIcon size={20} />,
              }}
              columns={[
                { key: "subject", header: "Subject", render: (t) => <strong>{t.subject}</strong>, sortBy: (t) => t.subject.toLowerCase() },
                { key: "category", header: "Topic", secondary: true, render: (t) => categoryLabel(t.category) },
                { key: "status", header: "Status", render: (t) => <TicketStatusBadge status={t.status} />, sortBy: (t) => t.status },
                {
                  key: "next", header: "Next step", secondary: true,
                  render: (t) => t.status === "closed" || t.status === "resolved" ? <span className="muted">—</span>
                    : t.awaiting === "user" ? <strong>Your reply</strong> : <span className="muted">Support</span>,
                },
                { key: "updated", header: "Updated", render: (t) => <span className="tnum">{since(t.updatedAt)}</span>, sortBy: (t) => t.updatedAt },
              ]}
            />
          )}
        </div>
      </Card>

      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="New support ticket"
        subtitle="Describe what happened and what you expected. Do not include patient names or record numbers."
        footer={
          <>
            <Button onClick={() => setComposing(false)}>Cancel</Button>
            <Button variant="primary" disabled={!valid} onClick={() => void submit()}>Open ticket</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Subject" required>
            <TextInput value={draft.subject} maxLength={160} onChange={(e) => setDraft({ ...draft, subject: e.currentTarget.value })} />
          </Field>
          <div className="grid grid-2">
            <Field label="Topic">
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.currentTarget.value })}>
                {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="How urgent?" hint="Urgent = you cannot work at all.">
              <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.currentTarget.value })}>
                {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{statusLabel(p)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="What happened?" required>
            <TextArea rows={6} value={draft.message} maxLength={5000} onChange={(e) => setDraft({ ...draft, message: e.currentTarget.value })} />
          </Field>
        </div>
      </Modal>

      {open && (
        <TicketDrawer
          ticket={open}
          staff={false}
          onClose={() => setOpenId(null)}
          onChanged={(m) => { setToast(m); tickets.reload(); }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
