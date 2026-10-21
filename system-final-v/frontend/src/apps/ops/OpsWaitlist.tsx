/**
 * Early-access waitlist — the sales queue behind the public /waitlist form.
 *
 * Earliest first, because that order is the promise the public page makes.
 * Sales works a lead from the drawer: email or call, move the status, take
 * ownership, and log what was said so the next person picks up the thread.
 */
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { act, saveData } from "@/api/actions";
import {
  WAITLIST_STATUSES, statusLabel, since, useLive, type WaitlistEntry, type WaitlistStatus,
} from "@/api/desk";
import { dateTimeLabel } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  Badge, Banner, Button, Card, EmptyState, Field, LoadingRows, PageHeader, SegmentedControl, Select,
  StatTile, TextArea, TextInput,
} from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { ConfirmDestructive, Drawer, Toast } from "@/components/ui/overlays";
import { ClipboardIcon, DownloadIcon, LinkIcon, MailIcon, TrashIcon, UsersIcon } from "@/components/ui/icons";

type Payload = { entries: WaitlistEntry[]; counts: Record<WaitlistStatus, number>; total: number };

const TONE: Record<WaitlistStatus, "neutral" | "accent" | "good" | "warning"> = {
  new: "accent", contacted: "neutral", qualified: "good", converted: "good", declined: "neutral",
};

const ORG_TYPE: Record<string, string> = {
  hospital: "Hospital", health_system: "Health system", clinic: "Clinic", individual: "Individual", other: "Other",
};

export function OpsWaitlist() {
  const { data, error, loading, reload, offline } = useLive<Payload>("/api/v1/ops/waitlist");
  const [filter, setFilter] = useState<"all" | WaitlistStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const entries = data?.entries ?? [];
  // Queue position is the place in the whole list, not in the filtered view.
  const position = useMemo(() => new Map(entries.map((e, i) => [e.id, i + 1])), [entries]);
  const rows = filter === "all" ? entries : entries.filter((e) => e.status === filter);
  const open = entries.find((e) => e.id === openId) ?? null;
  const counts = data?.counts;

  function exportCsv() {
    void act(
      () => api.post<{ rows: Record<string, unknown>[] }>("/api/v1/ops/waitlist/export"),
      (r) => {
        const name = saveData(`esap-waitlist-${new Date().toISOString().slice(0, 10)}`, r.rows);
        return `Exported ${r.rows.length} entries${name ? ` as ${name}` : ""} — logged to the platform audit.`;
      },
    ).then(setToast);
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth & support"
        title="Waitlist"
        lede="Everyone who asked for early access on the public site, in the order they joined. Contact details only — nothing here is patient data."
        actions={
          <>
            <a className="btn" href="/waitlist" target="_blank" rel="noreferrer"><LinkIcon size={15} /> Public form</a>
            <Button icon={<DownloadIcon size={15} />} onClick={exportCsv} disabled={offline || entries.length === 0}>Export CSV</Button>
          </>
        }
      />

      {offline && <Banner tone="info">The waitlist lives on the server. Connect to the live API to see and work it.</Banner>}
      {error && <Banner tone="critical">{error}</Banner>}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile label="On the list" value={data?.total ?? "—"} icon={<UsersIcon size={16} />} />
        <StatTile label="New — not yet contacted" value={counts?.new ?? "—"} />
        <StatTile label="Contacted / qualified" value={counts ? counts.contacted + counts.qualified : "—"} />
        <StatTile label="Converted" value={counts?.converted ?? "—"} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 16 }}>
          {loading && !data ? <LoadingRows /> : (
            <DataTable
              rows={rows}
              getRowId={(e) => e.id}
              searchable
              searchPlaceholder="Search name, email, organization, owner"
              searchFields={(e) => `${e.name} ${e.email} ${e.organization ?? ""} ${e.owner ?? ""} ${e.country ?? ""}`}
              onRowClick={(e) => setOpenId(e.id)}
              toolbar={
                <SegmentedControl
                  size="sm"
                  ariaLabel="Filter by status"
                  value={filter}
                  onChange={setFilter}
                  options={[{ value: "all", label: "All" }, ...WAITLIST_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]}
                />
              }
              empty={{
                title: offline ? "Not connected" : "No one here yet",
                message: offline ? "Start the backend to load the waitlist." : "Sign-ups from /waitlist appear here as they arrive.",
                icon: <ClipboardIcon size={20} />,
              }}
              columns={[
                { key: "pos", header: "#", width: "56px", render: (e) => <span className="tnum muted">{position.get(e.id)}</span>, sortBy: (e) => position.get(e.id) ?? 0 },
                {
                  key: "name", header: "Name", sortBy: (e) => e.name.toLowerCase(),
                  render: (e) => (
                    <span className="stack" style={{ gap: 2 }}>
                      <strong>{e.name}</strong>
                      <span className="muted" style={{ fontSize: 12.5 }}>{e.email}</span>
                    </span>
                  ),
                },
                {
                  key: "org", header: "Organization", sortBy: (e) => (e.organization ?? "").toLowerCase(),
                  render: (e) => (
                    <span className="stack" style={{ gap: 2 }}>
                      <span>{e.organization ?? "—"}</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        {ORG_TYPE[e.orgType] ?? e.orgType}{e.beds ? ` · ${e.beds} beds` : ""}
                      </span>
                    </span>
                  ),
                },
                { key: "country", header: "Country", secondary: true, render: (e) => e.country ?? "—", sortBy: (e) => e.country ?? "" },
                { key: "status", header: "Status", sortBy: (e) => e.status, render: (e) => <Badge tone={TONE[e.status]}>{statusLabel(e.status)}</Badge> },
                { key: "owner", header: "Owner", secondary: true, render: (e) => e.owner ?? <span className="muted">Unassigned</span>, sortBy: (e) => e.owner ?? "" },
                { key: "joined", header: "Joined", sortBy: (e) => e.createdAt, render: (e) => <span className="tnum" title={dateTimeLabel(e.createdAt)}>{since(e.createdAt)}</span> },
              ]}
            />
          )}
        </div>
      </Card>

      {open && (
        <LeadDrawer
          entry={open}
          position={position.get(open.id) ?? 0}
          onClose={() => setOpenId(null)}
          onSaved={(msg) => { setToast(msg); reload(); }}
          onDeleted={(msg) => { setToast(msg); setOpenId(null); reload(); }}
        />
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function LeadDrawer({ entry, position, onClose, onSaved, onDeleted }: {
  entry: WaitlistEntry; position: number; onClose: () => void;
  onSaved: (msg: string) => void; onDeleted: (msg: string) => void;
}) {
  const { name: me } = useSession();
  const [status, setStatus] = useState<WaitlistStatus>(entry.status);
  const [owner, setOwner] = useState(entry.owner ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = status !== entry.status || owner !== (entry.owner ?? "") || note.trim().length > 0;

  async function save() {
    setBusy(true);
    const msg = await act(
      () => api.patch(`/api/v1/ops/waitlist/${entry.id}`, {
        status: status !== entry.status ? status : undefined,
        owner: owner !== (entry.owner ?? "") ? owner : undefined,
        note: note.trim() || undefined,
      }),
      () => `Saved ${entry.name}.`,
    );
    setBusy(false);
    setNote("");
    onSaved(msg);
  }

  async function remove() {
    setConfirmDelete(false);
    onDeleted(await act(() => api.del(`/api/v1/ops/waitlist/${entry.id}`), () => `Removed ${entry.email} from the waitlist.`));
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={entry.name}
      subtitle={`#${position} on the list · joined ${dateTimeLabel(entry.createdAt)}`}
      footer={
        <>
          <Button variant="ghost" icon={<TrashIcon size={15} />} onClick={() => setConfirmDelete(true)}>Remove</Button>
          <span style={{ flex: 1 }} />
          <Button variant="primary" onClick={() => void save()} disabled={!dirty || busy}>{busy ? "Saving…" : "Save"}</Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <a className="btn btn-primary" href={`mailto:${entry.email}?subject=${encodeURIComponent("ESAP early access")}`}>
            <MailIcon size={15} /> Email {entry.email}
          </a>
          {entry.phone && <a className="btn" href={`tel:${entry.phone.replace(/[^\d+]/g, "")}`}>Call {entry.phone}</a>}
        </div>

        <dl className="kv">
          <dt>Organization</dt><dd>{entry.organization ?? "—"} ({ORG_TYPE[entry.orgType] ?? entry.orgType})</dd>
          <dt>Job title</dt><dd>{entry.jobTitle ?? "—"}</dd>
          <dt>Country</dt><dd>{entry.country ?? "—"}</dd>
          <dt>Beds</dt><dd className="tnum">{entry.beds ?? "—"}</dd>
          {entry.contactedAt && (<><dt>First contacted</dt><dd>{dateTimeLabel(entry.contactedAt)}</dd></>)}
        </dl>

        {entry.message && (
          <div>
            <p className="field-label" style={{ marginBottom: 6 }}>Their message</p>
            <blockquote className="wl-quote">{entry.message}</blockquote>
          </div>
        )}

        <div className="grid grid-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.currentTarget.value as WaitlistStatus)}>
              {WAITLIST_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Owner" hint={owner ? undefined : "Who in sales has this lead"}>
            <div className="row" style={{ gap: 6 }}>
              <TextInput value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="Unassigned" />
              {!owner && <Button size="sm" onClick={() => setOwner(me)}>Me</Button>}
            </div>
          </Field>
        </div>

        <Field label="Log a contact" hint="What was said, what happens next. Saved with your name and the time.">
          <TextArea rows={3} value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={2000} />
        </Field>

        <div className="stack" style={{ gap: 8 }}>
          <p className="field-label">Contact log</p>
          {entry.notes.length === 0 ? (
            <EmptyState title="No contact yet" message="Log the first call or email above." />
          ) : (
            <ol className="wl-log">
              {[...entry.notes].reverse().map((n, i) => (
                <li key={i}>
                  <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
                    <strong>{n.by}</strong>
                    <span className="muted tnum" style={{ fontSize: 12.5 }}>{dateTimeLabel(n.at)}</span>
                  </div>
                  <p>{n.text}</p>
                  <Badge tone={TONE[n.status]}>{statusLabel(n.status)}</Badge>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <ConfirmDestructive
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title="Remove from the waitlist"
        body={`This erases ${entry.name}'s details and contact log. Use it when someone asks to be removed.`}
        confirmWord={entry.email}
        actionLabel="Remove permanently"
        consequences={["Their place in the queue is lost", "The removal is written to the platform audit log"]}
      />
    </Drawer>
  );
}
