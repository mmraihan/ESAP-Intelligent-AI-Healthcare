/**
 * Announcements — platform notices shown at the top of every signed-in shell.
 *
 * For things everyone needs to know before they file a ticket: a maintenance
 * window, a release, a known problem. Targeted by surface, unpublishable, and
 * optionally self-expiring so a stale "down for maintenance" never lingers.
 */
import { useState } from "react";
import { api } from "@/api/client";
import { act } from "@/api/actions";
import { statusLabel, useLive, type Announcement, type AnnouncementLevel } from "@/api/desk";
import { dateTimeLabel } from "@/lib/format";
import {
  Badge, Banner, Button, Card, EmptyState, Field, LoadingRows, PageHeader, Select, TextArea, TextInput, Toggle,
} from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { BellIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "clinician", label: "Clinicians" },
  { value: "admin", label: "Hospital admins" },
  { value: "patient", label: "Patients" },
  { value: "ops", label: "Platform staff" },
];
const LEVELS: { value: AnnouncementLevel; label: string }[] = [
  { value: "info", label: "Information" },
  { value: "maintenance", label: "Planned maintenance" },
  { value: "incident", label: "Known problem" },
];
const BLANK = { title: "", body: "", audience: "all", level: "info" as AnnouncementLevel, expires: "" };

export function OpsAnnouncements() {
  const { data, error, loading, reload, offline } = useLive<{ announcements: Announcement[] }>("/api/v1/ops/announcements");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [toast, setToast] = useState<string | null>(null);
  const valid = draft.title.trim().length >= 3 && draft.body.trim().length >= 3;
  const rows = data?.announcements ?? [];

  async function run(work: () => Promise<unknown>, done: string) {
    setToast(await act(work, () => done));
    reload();
  }

  function publish() {
    setComposing(false);
    void run(() => api.post("/api/v1/ops/announcements", {
      title: draft.title.trim(), body: draft.body.trim(), audience: draft.audience, level: draft.level,
      expires_at: draft.expires ? new Date(draft.expires).toISOString() : null,
    }), "Announcement published — it shows in every matching shell on the next page load.");
    setDraft(BLANK);
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth & support"
        title="Announcements"
        lede="Notices shown above every screen for the audience you pick. Use them for maintenance windows, releases and known problems."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => setComposing(true)} disabled={offline}>New announcement</Button>}
      />

      {offline && <Banner tone="info">Announcements live on the server. Connect to the live API to manage them.</Banner>}
      {error && <Banner tone="critical">{error}</Banner>}

      {loading && !data ? <LoadingRows /> : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<BellIcon size={20} />} title="No announcements" message="Nothing is being shown to users right now." />
        </Card>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {rows.map((a) => (
            <Card
              key={a.id}
              title={a.title}
              subtitle={`${AUDIENCES.find((x) => x.value === a.audience)?.label ?? a.audience} · by ${a.createdBy} · ${dateTimeLabel(a.createdAt)}${a.expiresAt ? ` · expires ${dateTimeLabel(a.expiresAt)}` : ""}`}
              actions={
                <div className="row" style={{ gap: 10, alignItems: "center" }}>
                  <Badge tone={a.level === "info" ? "neutral" : "warning"}>{LEVELS.find((l) => l.value === a.level)?.label ?? statusLabel(a.level)}</Badge>
                  <Badge tone={a.active ? "good" : "neutral"}>{a.active ? "Showing" : a.published ? "Expired" : "Hidden"}</Badge>
                  <Toggle
                    checked={a.published}
                    onChange={(v) => void run(() => api.patch(`/api/v1/ops/announcements/${a.id}`, { published: v }), v ? "Published." : "Hidden from users.")}
                    label="Published"
                  />
                  <Button size="sm" variant="ghost" icon={<TrashIcon size={14} />} aria-label={`Delete ${a.title}`}
                    onClick={() => void run(() => api.del(`/api/v1/ops/announcements/${a.id}`), "Announcement deleted.")} />
                </div>
              }
            >
              <p style={{ margin: 0, maxWidth: "70ch" }}>{a.body}</p>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={composing}
        onClose={() => setComposing(false)}
        title="New announcement"
        subtitle="Shown at the top of every screen for the chosen audience until you hide it or it expires."
        footer={
          <>
            <Button onClick={() => setComposing(false)}>Cancel</Button>
            <Button variant="primary" disabled={!valid} onClick={publish}>Publish</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Title" required>
            <TextInput value={draft.title} maxLength={140} placeholder="Scheduled maintenance Sunday 02:00–02:30 UTC"
              onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} />
          </Field>
          <Field label="Message" required>
            <TextArea rows={4} value={draft.body} maxLength={2000}
              onChange={(e) => setDraft({ ...draft, body: e.currentTarget.value })} />
          </Field>
          <div className="grid grid-2">
            <Field label="Audience">
              <Select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.currentTarget.value })}>
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            </Field>
            <Field label="Kind">
              <Select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.currentTarget.value as AnnouncementLevel })}>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Expires" hint="Optional. Leave empty to show it until you hide it.">
            <TextInput type="datetime-local" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.currentTarget.value })} />
          </Field>
        </div>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
