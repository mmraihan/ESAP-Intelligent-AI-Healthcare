/**
 * One support ticket as a conversation — shared by the requester's Support
 * page and the ops console's queue. `staff` adds the controls only platform
 * staff have: the full status set and the "waiting on user" hand-back.
 */
import { useState, type ReactNode } from "react";
import { api } from "@/api/client";
import { act } from "@/api/actions";
import {
  TICKET_STATUSES, categoryLabel, statusLabel, type Ticket, type TicketStatus,
} from "@/api/desk";
import { dateTimeLabel } from "@/lib/format";
import { Badge, Button, Select, TextArea, cx } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlays";
import { SendIcon } from "@/components/ui/icons";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === "open" ? "accent" : status === "resolved" || status === "closed" ? "good" : "neutral";
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
}

export function TicketDrawer({ ticket, staff, onClose, onChanged }: {
  ticket: Ticket; staff: boolean; onClose: () => void; onChanged: (message: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = ticket.status === "closed";

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    const msg = await act(work, () => done);
    setBusy(false);
    onChanged(msg);
  }

  const send = () => run(
    () => api.post(`/api/v1/support/tickets/${ticket.id}/messages`, { body: reply.trim() }),
    staff ? "Reply sent to the requester." : "Message sent to support.",
  ).then(() => setReply(""));

  const setStatus = (status: TicketStatus) => run(
    () => api.post(`/api/v1/support/tickets/${ticket.id}/status`, { status }),
    `Ticket marked ${statusLabel(status).toLowerCase()}.`,
  );

  let footer: ReactNode;
  if (closed) {
    footer = staff
      ? <Button onClick={() => void setStatus("open")} disabled={busy}>Reopen</Button>
      : <span className="muted" style={{ fontSize: 13 }}>This ticket is closed. Open a new one if the problem comes back.</span>;
  } else {
    footer = (
      <>
        {staff ? (
          <Select aria-label="Status" value={ticket.status} disabled={busy}
            onChange={(e) => void setStatus(e.currentTarget.value as TicketStatus)}>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
        ) : (
          <Button variant="ghost" onClick={() => void setStatus("closed")} disabled={busy}>Close ticket</Button>
        )}
        <span style={{ flex: 1 }} />
        <Button variant="primary" icon={<SendIcon size={15} />} disabled={busy || reply.trim().length === 0} onClick={() => void send()}>
          {busy ? "Sending…" : "Send"}
        </Button>
      </>
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={ticket.subject}
      subtitle={`${ticket.id} · ${categoryLabel(ticket.category)} · ${ticket.priority} priority`}
      footer={footer}
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <TicketStatusBadge status={ticket.status} />
          {staff && <Badge>{ticket.requesterName} · {ticket.tenantName ?? ticket.tenantId}</Badge>}
          {ticket.assignee && <Badge>Handled by {ticket.assignee}</Badge>}
        </div>

        <ol className="ticket-thread" aria-label="Conversation">
          {ticket.messages.map((m) => (
            <li key={m.id} className={cx("ticket-msg", m.fromStaff && "is-staff")}>
              <div className="ticket-msg-head">
                <strong>{m.fromStaff ? `${m.author} · ESAP support` : m.author}</strong>
                <span className="tnum">{dateTimeLabel(m.at)}</span>
              </div>
              <p>{m.body}</p>
              {m.statusChange && <span className="muted" style={{ fontSize: 12 }}>Status → {statusLabel(m.statusChange)}</span>}
            </li>
          ))}
        </ol>

        {!closed && (
          <TextArea
            rows={4}
            aria-label={staff ? "Reply to the requester" : "Add a message"}
            placeholder={staff ? "Reply to the requester…" : "Add details or answer support… Please do not include patient information."}
            value={reply}
            maxLength={5000}
            onChange={(e) => setReply(e.currentTarget.value)}
          />
        )}
      </div>
    </Drawer>
  );
}
