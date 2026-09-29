/**
 * 11.4.3 — Invites. Pending / expired / revoked.
 *
 * An invite is a credential in transit, so the states that matter are the
 * failure states: expired invites cannot be reused, and a revoked one must stop
 * working immediately even if the email is still in someone's inbox.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ALL_UNITS, INVITES } from "@/mock/db";
import type { Invite } from "@/mock/types";
import { ROLES } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { ago } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Banner, Button, Card, Field, PageHeader, Select, StatTile, Tabs, TextArea, TextInput } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { RoleBadge, ScopeChip, StatusPill } from "@/components/ui/domain";
import { AlertIcon, MailIcon, RefreshIcon, SendIcon, XIcon } from "@/components/ui/icons";
import { actAndRefresh } from "@/api/actions";
import { api, ApiError, NetworkError } from "@/api/client";
import { hydrateFromApi } from "@/api/bootstrap";

/**
 * Acceptance links from this session's sends. This deployment has no email
 * service, so the link is shown to the admin to pass on. Kept outside the
 * component because a save refreshes the store and remounts the screen.
 */
let recentLinks: { email: string; url: string }[] = [];

type Tab = "pending" | "expired" | "revoked" | "all";

export function AdminInvites() {
  const { role: sessionRole } = useSession();
  // Only the Hospital Admin grants a role that can open a chart — the same
  // boundary the roster's "Change role" drawer enforces (§11.4.2). Every
  // other admin role provisions and reconfigures accounts, but stops there.
  const canGrantRoles = sessionRole === "tenant_owner";
  const invitableRoles = Object.values(ROLES).filter(
    (r) => r.code !== "super_admin" && r.code !== "guest" && r.code !== "patient" &&
      (canGrantRoles || r.surface !== "clinician"),
  );
  const [tab, setTab] = useState<Tab>("pending");
  // `?compose=1` opens the composer directly — the roster's Invite button links here.
  const [params] = useSearchParams();
  const [compose, setCompose] = useState(params.get("compose") === "1");
  const [draft, setDraft] = useState<{ emails: string; role: string; scope: string; title: string; unitIds: string[] }>(
    { emails: "", role: invitableRoles[0]?.code ?? "physician", scope: "Facility: Main Campus", title: "", unitIds: [] });
  const [toast, setToast] = useState<string | null>(null);
  const [links, setLinks] = useState(recentLinks);

  const rows = useMemo(() => (tab === "all" ? INVITES : INVITES.filter((i) => i.status === tab)), [tab]);
  const count = (s: string) => INVITES.filter((i) => i.status === s).length;

  const columns: Column<Invite>[] = [
    {
      key: "email", header: "Invitee", width: "26%", sortBy: (i) => i.email,
      render: (i) => (
        <div className="cell-stack">
          <strong>{i.email}</strong>
          <span className="muted">invited by {i.sentBy}</span>
        </div>
      ),
    },
    { key: "role", header: "Role", sortBy: (i) => i.role, render: (i) => <RoleBadge role={i.role} /> },
    { key: "scope", header: "Scope", render: (i) => <ScopeChip scope={i.scope} /> },
    { key: "sent", header: "Sent", secondary: true, sortBy: (i) => i.sentAt, render: (i) => <span className="muted">{ago(i.sentAt)}</span> },
    {
      key: "expires", header: "Expires", sortBy: (i) => i.expiresAt,
      render: (i) => (
        <span className={i.status === "expired" ? "pill pill-warning" : "muted"}>
          {i.status === "expired" ? "expired" : ago(i.expiresAt)}
        </span>
      ),
    },
    { key: "reminders", header: "Reminders", align: "right", secondary: true, render: (i) => <span className="tnum">{i.remindersSent}</span> },
    { key: "status", header: "Status", sortBy: (i) => i.status, render: (i) => <StatusPill status={i.status} /> },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
          {i.status === "pending" && (
            <>
              <Button size="sm" icon={<RefreshIcon size={13} />} onClick={(e) => { e.stopPropagation(); void actAndRefresh(() => api.post(`/api/v1/admin/invites/${i.id}/remind`), () => `Reminder sent to ${i.email}`).then(setToast); }}>Remind</Button>
              <Button size="sm" variant="ghost" icon={<XIcon size={13} />} onClick={(e) => { e.stopPropagation(); void actAndRefresh(() => api.del(`/api/v1/admin/invites/${i.id}`), () => `Invite to ${i.email} revoked`).then(setToast); }}>Revoke</Button>
            </>
          )}
          {i.status === "expired" && (
            <Button size="sm" icon={<SendIcon size={13} />} onClick={(e) => { e.stopPropagation(); void actAndRefresh(() => api.post("/api/v1/admin/invites", { email: i.email, role: i.role, scope: i.scope }), () => `New invite issued to ${i.email}`).then(setToast); }}>Reissue</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Invites"
        lede="Outstanding invitations to join this tenant. An invite is a credential in transit — expired ones cannot be reused, and revoking one kills the link immediately."
        actions={<Button variant="primary" icon={<MailIcon size={15} />} onClick={() => setCompose(true)}>New invite</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Pending" value={count("pending")} icon={<MailIcon size={15} />} hint="Sent and not yet accepted" />
        <StatTile label="Expired" value={count("expired")} tone={count("expired") > 0 ? "warning" : "neutral"} hint="Past the 7-day window" />
        <StatTile label="Revoked" value={count("revoked")} hint="Cancelled before acceptance" />
        <StatTile label="Accepted" value={count("active")} hint="Now on the roster" />
      </div>

      {links.length > 0 && (
        <Banner tone="accent" icon={<MailIcon size={16} />} title="Acceptance links">
          No email service is connected here, so pass each link to the person yourself. Each works
          once and expires in 7 days.
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
            {links.map((l) => (
              <li key={l.url}>
                {l.email}: <a className="mono" href={l.url}>{l.url}</a>
              </li>
            ))}
          </ul>
        </Banner>
      )}

      {count("expired") > 0 && (
        <Banner tone="warning" title="Expired invites cannot be reused">
          The link in the original email no longer works. Reissuing sends a fresh token — it does not
          reactivate the old one, which is why a leaked invite email goes stale rather than staying
          exploitable.
        </Banner>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Pending", count: count("pending") },
          { value: "expired", label: "Expired", count: count("expired") },
          { value: "revoked", label: "Revoked", count: count("revoked") },
          { value: "all", label: "All", count: INVITES.length },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(i) => i.id}
        searchable
        searchPlaceholder="Search by email"
        searchFields={(i) => `${i.email} ${i.sentBy} ${i.scope}`}
        caption="Outstanding invitations"
        empty={{
          title: tab === "pending" ? "No pending invites" : `No ${tab} invites`,
          message: "Nothing in this state right now.",
          icon: <MailIcon size={20} />,
          action: <Button variant="primary" onClick={() => setCompose(true)}>Invite someone</Button>,
        }}
      />

      <Card title="How an invite becomes an account" subtitle="§10.5">
        <ol className="run-steps">
          <li>You choose an email, a role and a scope. The role determines everything that follows.</li>
          <li>A single-use, 7-day token is sent. It is not a password and cannot be reused after acceptance.</li>
          <li>The invitee verifies their email, sets a credential or is redirected to your identity provider.</li>
          <li>The account appears on the roster, and the grant is written to the audit log with your name on it.</li>
        </ol>
      </Card>

      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title="Invite someone"
        subtitle="One invite, or paste several addresses to send a batch"
        footer={
          <>
            <Button onClick={() => setCompose(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              // One address per line: the field invites a batch, so the send
              // has to honour that rather than mailing only the first.
              const addresses = draft.emails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
              const { role, scope, title, unitIds } = draft;
              setCompose(false);
              setDraft({ emails: "", role: invitableRoles[0]?.code ?? "physician", scope: "Facility: Main Campus", title: "", unitIds: [] });
              if (!addresses.length) { setToast("Enter at least one email address."); return; }
              // NB: record the acceptance links into the module-level `recentLinks`
              // BEFORE re-hydrating. hydrateFromApi() bumps the data version and
              // remounts this screen; a remount re-reads `recentLinks`, so setting
              // it first is what makes the "Acceptance links" banner survive.
              void (async () => {
                try {
                  const sent = await Promise.all(addresses.map((email) =>
                    api.post<{ email: string; acceptToken: string }>(
                      "/api/v1/admin/invites", { email, role, scope, unit_ids: unitIds, local_title: title.trim() || null })));
                  recentLinks = [
                    ...sent.map((s) => ({ email: s.email, url: `${window.location.origin}/invite/${s.acceptToken}` })),
                    ...recentLinks,
                  ].slice(0, 10);
                  setLinks(recentLinks);
                  setToast(sent.length === 1 ? `Invite sent to ${addresses[0]}` : `${sent.length} invites sent`);
                  await hydrateFromApi().catch(() => undefined);
                } catch (err) {
                  setToast(err instanceof ApiError ? err.message
                    : err instanceof NetworkError ? "Not saved — the API is not reachable."
                    : "Something went wrong. Nothing was saved.");
                }
              })();
            }}>Send invite</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Email address" required hint="Paste several, one per line, to send a batch — you will see a preview table first.">
            <TextArea rows={2} placeholder="name@hospital.example" value={draft.emails} onChange={(e) => setDraft({ ...draft, emails: e.currentTarget.value })} />
          </Field>
          <Field label="Role" required hint="This is the single most consequential field on the form. It decides whether this person can open a chart.">
            <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.currentTarget.value })}>
              {invitableRoles.map((r) => <option key={r.code} value={r.code}>{r.label} — {r.scopeLabel}</option>)}
            </Select>
          </Field>
          {!canGrantRoles && (
            <Banner tone="info" title="Clinical roles are not offered here">
              Your role provisions and reconfigures accounts. A role that can open a chart — physician, nurse,
              case manager, pharmacist — is granted by the Hospital Admin.
            </Banner>
          )}
          <Field
            label="Assigned units"
            hint="What this person's worklist shows. Without a unit they only see patients they are personally the attending or nurse for — a nurse-admitted patient stays invisible to the unit's doctors until they share a unit."
          >
            {ALL_UNITS.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>No units yet. Add a facility and unit under Facilities &amp; units first.</p>
            ) : (
              <div className="stack" style={{ gap: 6 }}>
                {ALL_UNITS.map((u) => {
                  const checked = draft.unitIds.includes(u.id);
                  return (
                    <label key={u.id} className="row" style={{ gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setDraft({
                          ...draft,
                          unitIds: checked ? draft.unitIds.filter((x) => x !== u.id) : [...draft.unitIds, u.id],
                        })}
                      />
                      <span>{u.name}</span>
                      <span className="muted" style={{ fontSize: 12.5 }}>{u.serviceLine}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>
          <Field label="Local job title" hint="Shown on the roster and mapped to the HL7 role code.">
            <TextInput placeholder="Attending Hospitalist" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })} />
          </Field>
          <Banner tone="accent" icon={<AlertIcon size={16} />} title="Expires in 7 days">
            Single-use token. If it is not accepted in time it expires and must be reissued.
          </Banner>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
