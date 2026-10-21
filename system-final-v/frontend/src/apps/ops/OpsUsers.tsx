/**
 * All users — every account on the platform, across every tenant.
 *
 * Account metadata only (who, which role, which hospital, active or not) —
 * the same columns each hospital admin sees for their own roster. Platform
 * staff can seat another super admin from here; doing so needs a reason and
 * is a critical event on the platform audit log.
 */
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { act } from "@/api/actions";
import { statusLabel, useLive, type PlatformUser } from "@/api/desk";
import { ago } from "@/lib/format";
import {
  Badge, Banner, Button, Card, Field, LoadingRows, PageHeader, Select, StatTile, TextArea, TextInput,
} from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/DataTable";
import { Modal, Toast } from "@/components/ui/overlays";
import { KeyIcon, PlusIcon, ShieldIcon, UserIcon, UsersIcon } from "@/components/ui/icons";

type Payload = { users: PlatformUser[]; total: number; byRole: Record<string, number> };

const CLINICAL = ["physician", "resident", "np_pa", "charge_nurse", "staff_nurse", "case_manager", "pharmacist"];
const BLANK = { name: "", email: "", password: "", reason: "" };

export function OpsUsers() {
  const { data, error, loading, reload, offline } = useLive<Payload>("/api/v1/ops/users");
  const [role, setRole] = useState("all");
  const [tenant, setTenant] = useState("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [toast, setToast] = useState<string | null>(null);

  const users = data?.users ?? [];
  const roleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    users.forEach((u) => seen.set(u.role, u.roleLabel));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);
  const tenantOptions = useMemo(() => [...new Set(users.map((u) => u.tenantName))].sort(), [users]);
  const rows = users.filter((u) => (role === "all" || u.role === role) && (tenant === "all" || u.tenantName === tenant));

  const by = data?.byRole ?? {};
  const clinicians = CLINICAL.reduce((n, r) => n + (by[r] ?? 0), 0);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim());
  const valid = draft.name.trim() && emailOk && draft.password.length >= 12 && draft.reason.trim().length >= 10;

  async function create() {
    setAdding(false);
    setToast(await act(
      () => api.post<{ email: string }>("/api/v1/ops/super-admins", {
        name: draft.name.trim(), email: draft.email.trim(), password: draft.password, reason: draft.reason.trim(),
      }),
      (r) => `Super admin ${r.email} created. Share the password with them over a separate channel.`,
    ));
    setDraft(BLANK);
    reload();
  }

  return (
    <>
      <PageHeader
        eyebrow="Growth & support"
        title="All users"
        lede="Every account on every tenant, including self-serve clinicians, patients and platform staff. Account details only — no patient records."
        actions={<Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => setAdding(true)} disabled={offline}>Add super admin</Button>}
      />

      {offline && <Banner tone="info">The directory lives on the server. Connect to the live API to see every account.</Banner>}
      {error && <Banner tone="critical">{error}</Banner>}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatTile label="Accounts" value={data?.total ?? "—"} icon={<UsersIcon size={16} />} />
        <StatTile label="Clinicians" value={data ? clinicians : "—"} icon={<UserIcon size={16} />} />
        <StatTile label="Patients" value={data ? by.patient ?? 0 : "—"} />
        <StatTile label="Super admins" value={data ? by.super_admin ?? 0 : "—"} icon={<ShieldIcon size={16} />} />
      </div>

      <Card padded={false}>
        <div style={{ padding: 16 }}>
          {loading && !data ? <LoadingRows /> : (
            <DataTable
              rows={rows}
              getRowId={(u) => u.id}
              searchable
              searchPlaceholder="Search name or email"
              searchFields={(u) => `${u.name} ${u.email}`}
              pageSize={20}
              toolbar={
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Select aria-label="Role" value={role} onChange={(e) => setRole(e.currentTarget.value)}>
                    <option value="all">All roles</option>
                    {roleOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </Select>
                  <Select aria-label="Tenant" value={tenant} onChange={(e) => setTenant(e.currentTarget.value)}>
                    <option value="all">All tenants</option>
                    {tenantOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
              }
              empty={{ title: offline ? "Not connected" : "No matching accounts", message: offline ? "Start the backend to load the directory." : "Try a different filter.", icon: <UsersIcon size={20} /> }}
              columns={[
                {
                  key: "name", header: "Name", sortBy: (u) => u.name.toLowerCase(),
                  render: (u) => (
                    <span className="stack" style={{ gap: 2 }}>
                      <strong>{u.name}</strong>
                      <span className="muted" style={{ fontSize: 12.5 }}>{u.email}</span>
                    </span>
                  ),
                },
                {
                  key: "role", header: "Role", sortBy: (u) => u.roleLabel,
                  render: (u) => u.role === "super_admin"
                    ? <Badge tone="accent" icon={<KeyIcon size={12} />}>{u.roleLabel}</Badge>
                    : <Badge>{u.roleLabel}</Badge>,
                },
                { key: "tenant", header: "Tenant", sortBy: (u) => u.tenantName, render: (u) => u.tenantName },
                { key: "status", header: "Status", sortBy: (u) => u.status, render: (u) => <Badge tone={u.status === "active" ? "good" : "neutral"}>{statusLabel(u.status)}</Badge> },
                { key: "active", header: "Last active", secondary: true, sortBy: (u) => u.lastActive ?? "", render: (u) => u.lastActive ? <span className="tnum">{ago(u.lastActive)}</span> : <span className="muted">—</span> },
              ]}
            />
          )}
        </div>
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a super admin"
        subtitle="Super admins run the ops console: every tenant, the waitlist, support and announcements. They get no standing access to patient data."
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" disabled={!valid} onClick={() => void create()}>Create account</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid grid-2">
            <Field label="Full name" required>
              <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
            </Field>
            <Field label="Email" required error={draft.email && !emailOk ? "Not a valid email address" : undefined}>
              <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })} />
            </Field>
          </div>
          <Field label="Temporary password" required hint="At least 12 characters. Send it separately from the email address.">
            <TextInput type="password" autoComplete="new-password" value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.currentTarget.value })} />
          </Field>
          <Field label="Reason" required hint="Recorded on the platform audit log as a critical event.">
            <TextArea rows={2} value={draft.reason} maxLength={400} onChange={(e) => setDraft({ ...draft, reason: e.currentTarget.value })} />
          </Field>
        </div>
      </Modal>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
