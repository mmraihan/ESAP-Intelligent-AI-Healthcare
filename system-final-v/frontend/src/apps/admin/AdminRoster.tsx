/**
 * 11.4.2 — Roster.
 *
 * Users, roles and scopes. Two things this screen enforces visibly: an IT admin
 * can provision people but cannot grant clinical roles (§4.6), and deactivating
 * someone is a two-step confirm because it removes a clinician's access mid-shift.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_UNITS, USERS } from "@/mock/db";
import type { DirectoryUser } from "@/mock/types";
import { ROLES, type RoleCode } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { ago, dateLabel, initials } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, TextInput, Toggle } from "@/components/ui/primitives";
import { ConfirmDestructive, Drawer, Modal, Toast } from "@/components/ui/overlays";
import { RoleBadge, ScopeChip, StatusPill } from "@/components/ui/domain";
import { DownloadIcon, KeyIcon, LockIcon, MailIcon, UploadIcon, UsersIcon } from "@/components/ui/icons";
import { actAndRefresh, requestExport } from "@/api/actions";
import { api } from "@/api/client";

type BulkRow = { email: string; role: string; scope: string; problem: string | null };

/** Parse `email, role, unit` rows. A row that would fail on the server is marked here, before anything sends. */
function parseCsv(text: string, canGrantRoles: boolean): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim()))
    .filter((cells) => cells[0] && !/^email$/i.test(cells[0]))
    .map(([email, roleCode = "", unit = ""]) => {
      const scope = unit ? (unit.includes(":") ? unit : `Unit: ${unit}`) : "Facility: Main Campus";
      let problem: string | null = null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problem = "Not an email address";
      else if (!(roleCode in ROLES) || ["super_admin", "guest", "patient"].includes(roleCode)) problem = `Unknown or ungrantable role "${roleCode}"`;
      // §4.6: same tenant_owner-only boundary as a single invite or a role
      // change — a CSV column is not a loophole around who may open a chart.
      else if (!canGrantRoles && ROLES[roleCode as RoleCode].surface === "clinician") problem = "Clinical role — reserved to the Hospital Admin";
      return { email, role: roleCode, scope, problem };
    });
}

export function AdminRoster() {
  const { role } = useSession();
  const nav = useNavigate();
  const [edit, setEdit] = useState<{ role: RoleCode; scope: string; unitIds: string[] } | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [deactivating, setDeactivating] = useState<DirectoryUser | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** §4.6: IT admins provision, they do not grant clinical roles. */
  const canGrantRoles = role === "tenant_owner";

  function open(u: DirectoryUser) {
    setSelected(u);
    setEdit({ role: u.roles[0], scope: u.scope, unitIds: u.unitIds ?? [] });
  }

  function toggleUnit(id: string) {
    if (!edit) return;
    const has = edit.unitIds.includes(id);
    setEdit({ ...edit, unitIds: has ? edit.unitIds.filter((x) => x !== id) : [...edit.unitIds, id] });
  }

  function saveRole() {
    if (!selected || !edit) return;
    const who = selected;
    const next = edit;
    void actAndRefresh(
      // Omit scope so the server derives the label from the unit assignment.
      () => api.post(`/api/v1/admin/users/${who.id}/roles`, {
        roles: [next.role], unit_ids: next.unitIds, reason: "Changed from the admin roster",
      }),
      () => `${who.name} is now ${ROLES[next.role].label} · ${next.unitIds.length || "no"} unit${next.unitIds.length === 1 ? "" : "s"} — their sessions were ended`,
    ).then(setToast);
  }

  const unitsChanged = Boolean(
    selected && edit &&
    [...edit.unitIds].sort().join(",") !== [...(selected.unitIds ?? [])].sort().join(","),
  );

  function setAccess(field: "sso" | "break_glass_delegate", value: boolean) {
    if (!selected) return;
    const who = selected;
    void actAndRefresh(
      () => api.patch(`/api/v1/admin/users/${who.id}/access`, { [field]: value, reason: "Changed from the admin roster" }),
      () => field === "sso"
        ? `Single sign-on ${value ? "required" : "no longer required"} for ${who.name}`
        : `${who.name} ${value ? "can now" : "can no longer"} approve break-glass requests`,
    ).then(setToast);
  }

  async function readCsv(file: File | undefined) {
    setBulkError(null);
    setBulkRows([]);
    if (!file) return;
    const rowsFound = parseCsv(await file.text(), canGrantRoles);
    if (!rowsFound.length) setBulkError("No rows found. The file needs one person per line: email, role, unit.");
    setBulkRows(rowsFound);
  }

  function sendBulk() {
    const ok = bulkRows.filter((r) => !r.problem);
    setBulkOpen(false);
    setBulkRows([]);
    void actAndRefresh(
      () => Promise.all(ok.map((r) => api.post("/api/v1/admin/invites", { email: r.email, role: r.role, scope: r.scope }))),
      (sent) => `${sent.length} invite${sent.length === 1 ? "" : "s"} sent`,
    ).then(setToast);
  }

  const rows = useMemo(
    () =>
      USERS.filter(
        (u) =>
          (roleFilter === "all" || u.roles.includes(roleFilter as RoleCode)) &&
          (statusFilter === "all" || u.status === statusFilter),
      ),
    [roleFilter, statusFilter],
  );

  const columns: Column<DirectoryUser>[] = [
    {
      key: "name", header: "Name", width: "26%", sortBy: (u) => u.name,
      render: (u) => (
        <div className="row" style={{ gap: 10 }}>
          <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
          <div className="cell-stack">
            <strong>{u.name}</strong>
            <span className="muted">{u.email}</span>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", sortBy: (u) => u.roles[0], render: (u) => <RoleBadge role={u.roles[0]} /> },
    { key: "title", header: "Local title", secondary: true, sortBy: (u) => u.localTitle, render: (u) => <span className="muted">{u.localTitle}</span> },
    { key: "scope", header: "Scope", render: (u) => <ScopeChip scope={u.scope} /> },
    {
      key: "auth", header: "Sign-in", secondary: true,
      render: (u) => (
        <div className="row" style={{ gap: 5, flexWrap: "wrap" }}>
          {u.sso ? <Badge tone="neutral" icon={<KeyIcon size={11} />}>SSO</Badge> : <Badge tone="neutral">Password</Badge>}
        </div>
      ),
    },
    { key: "active", header: "Last active", secondary: true, sortBy: (u) => u.lastActive, render: (u) => <span className="muted">{ago(u.lastActive)}</span> },
    { key: "status", header: "Status", sortBy: (u) => u.status, render: (u) => <StatusPill status={u.status} /> },
  ];

  const byRole = (r: RoleCode) => USERS.filter((u) => u.roles.includes(r)).length;

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Roster"
        lede="Everyone with access to ESAP in this tenant, what role they hold, and how far that role reaches."
        actions={
          <>
            <Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("roster", "Roster export requested from the admin console").then(setToast)}>Export</Button>
            <Button icon={<UploadIcon size={15} />} onClick={() => setBulkOpen(true)}>Bulk import</Button>
            <Button variant="primary" icon={<MailIcon size={15} />} onClick={() => nav("/admin/invites?compose=1")}>Invite</Button>
          </>
        }
      />

      {!canGrantRoles && (
        <Banner tone="accent" icon={<LockIcon size={16} />} title="You can provision accounts, but not grant clinical roles">
          Your IT Admin role covers creating, suspending and reconfiguring accounts. Granting a clinical
          role — anything that can open a chart — is reserved to the Hospital Admin. This split is the
          point of having two administrative tiers rather than one with a flag.
        </Banner>
      )}

      <div className="grid grid-4">
        <StatTile label="Total accounts" value={USERS.length} icon={<UsersIcon size={15} />} />
        <StatTile label="Clinical roles" value={byRole("physician") + byRole("resident") + byRole("np_pa") + byRole("staff_nurse") + byRole("charge_nurse")} hint="Can open a chart" />
        <StatTile label="Administrative" value={byRole("tenant_owner") + byRole("it_admin") + byRole("privacy_officer") + byRole("billing_admin")} hint="No clinical surface at all" />
        <StatTile
          label="Signing in with SSO"
          value={USERS.filter((u) => u.sso).length}
          icon={<KeyIcon size={15} />}
          hint="The rest use a local password"
        />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(u) => u.id}
        searchable
        searchPlaceholder="Search name, email or title"
        searchFields={(u) => `${u.name} ${u.email} ${u.localTitle} ${u.scope}`}
        onRowClick={open}
        pageSize={14}
        caption="Staff roster with roles and scopes"
        empty={{ title: "Nobody matches", message: "No account matches these filters." }}
        toolbar={
          <>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
              <option value="all">All roles</option>
              {Object.values(ROLES)
                .filter((r) => r.code !== "super_admin" && r.code !== "guest" && r.code !== "patient")
                .map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </>
        }
      />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected?.email}
        width={520}
        footer={
          selected && (
            <>
              <Button onClick={() => void actAndRefresh(() => api.post(`/api/v1/admin/users/${selected.id}/password-reset`), () => `Password reset started for ${selected.email} — existing sessions ended`).then(setToast)}>Send reset</Button>
              <Button variant="danger" disabled={selected.status === "suspended"} onClick={() => setDeactivating(selected)}>
                Deactivate
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="stack" style={{ gap: 18 }}>
            <Card title="Role & scope">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <RoleBadge role={selected.roles[0]} showScope />
                <ScopeChip scope={selected.scope} />
              </div>
              <dl className="kv">
                <dt>Local title</dt><dd>{selected.localTitle}</dd>
                <dt>HL7 mapping</dt><dd className="mono">{ROLES[selected.roles[0]].hl7}</dd>
                <dt>Created</dt><dd>{dateLabel(selected.createdAt)}</dd>
                <dt>Last active</dt><dd>{ago(selected.lastActive)}</dd>
              </dl>
              <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                {ROLES[selected.roles[0]].blurb}
              </p>
            </Card>

            <Card title="Change role" subtitle={canGrantRoles ? "Takes effect at the user's next request" : "Reserved to the Hospital Admin"}>
              <Field label="Role" hint="Changing a role changes what this person can open. It is written to the audit log with your name.">
                <Select value={edit?.role ?? selected.roles[0]} disabled={!canGrantRoles} onChange={(e) => setEdit({ scope: edit?.scope ?? selected.scope, unitIds: edit?.unitIds ?? selected.unitIds ?? [], role: e.currentTarget.value as RoleCode })}>
                  {Object.values(ROLES)
                    .filter((r) => r.code !== "super_admin" && r.code !== "guest")
                    .map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </Select>
              </Field>
              <Field
                label="Assigned units"
                hint="This is what the worklist reads. A clinician with no unit only sees patients they are personally the attending or nurse for — so a nurse-admitted patient stays invisible to the unit's doctors until they share a unit."
              >
                {ALL_UNITS.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>No units yet. Add a facility and unit under Facilities &amp; units first.</p>
                ) : (
                  <div className="stack" style={{ gap: 6 }}>
                    {ALL_UNITS.map((u) => {
                      const checked = (edit?.unitIds ?? []).includes(u.id);
                      return (
                        <label key={u.id} className="row" style={{ gap: 8, cursor: canGrantRoles ? "pointer" : "default", opacity: canGrantRoles ? 1 : 0.6 }}>
                          <input type="checkbox" checked={checked} disabled={!canGrantRoles} onChange={() => toggleUnit(u.id)} />
                          <span>{u.name}</span>
                          <span className="muted" style={{ fontSize: 12.5 }}>{u.serviceLine}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </Field>
              {canGrantRoles && (
                <Button
                  variant="primary"
                  disabled={!edit || (edit.role === selected.roles[0] && edit.scope === selected.scope && !unitsChanged)}
                  onClick={saveRole}
                >
                  Save role &amp; units
                </Button>
              )}
            </Card>

            <Card title="Security">
              <Toggle checked={selected.sso} onChange={(v) => setAccess("sso", v)} label="Single sign-on" hint="Signs in through the hospital identity provider rather than a local password." />
              <Toggle
                checked={Boolean((selected as DirectoryUser & { breakGlassDelegate?: boolean }).breakGlassDelegate)}
                onChange={(v) => setAccess("break_glass_delegate", v)}
                label="Break-glass delegate"
                hint="Allows this person to approve another clinician's emergency access request."
                disabled={!canGrantRoles}
              />
            </Card>
          </div>
        )}
      </Drawer>

      <ConfirmDestructive
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => { if (deactivating) void actAndRefresh(() => api.post(`/api/v1/admin/users/${deactivating.id}/status`, { status: "suspended", reason: "Deactivated from the admin roster" }), () => `${deactivating.name} deactivated`).then(setToast); }}
        title="Deactivate this account"
        confirmWord={deactivating?.name.split(",")[0] ?? ""}
        actionLabel="Deactivate"
        body={<>You are about to remove <strong>{deactivating?.name}</strong>&rsquo;s access to ESAP.</>}
        consequences={[
          "Any active session is terminated at the next request, which may be mid-shift.",
          "Assessments they have already acknowledged remain in the record with their name on them.",
          "Patients assigned to them stay assigned — reassign them separately or the roster will show an inactive owner.",
        ]}
      />

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk import"
        subtitle="Upload a CSV of email, role and scope. Nothing is sent until you review the parsed table."
        footer={
          <>
            <Button onClick={() => { setBulkOpen(false); setBulkRows([]); }}>Cancel</Button>
            <Button variant="primary" disabled={!bulkRows.some((r) => !r.problem)} onClick={sendBulk}>
              Send {bulkRows.filter((r) => !r.problem).length} invite{bulkRows.filter((r) => !r.problem).length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="CSV file" hint="Columns: email, role, unit, local_title. Role must be one of the codes in Roles & scopes.">
            <TextInput type="file" accept=".csv,text/csv" onChange={(e) => void readCsv(e.currentTarget.files?.[0])} />
          </Field>
          {bulkError && <Banner tone="warning" title="Nothing to import">{bulkError}</Banner>}
          {bulkRows.length > 0 && (
            <div className="scroll-x">
              <table className="data-table">
                <thead><tr><th>Email</th><th>Role</th><th>Scope</th><th>Check</th></tr></thead>
                <tbody>
                  {bulkRows.map((r, i) => (
                    <tr key={`${r.email}-${i}`}>
                      <td className="mono">{r.email}</td>
                      <td>{r.role in ROLES ? ROLES[r.role as RoleCode].label : r.role || "—"}</td>
                      <td className="muted">{r.scope}</td>
                      <td>{r.problem ? <Badge tone="critical">{r.problem}</Badge> : <Badge tone="good">Ready</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Banner tone="warning" title="Bulk mode always previews first">
            A parsed table is shown before anything sends. Nobody fires 200 invitation emails blind, and
            an import with a bad role column would otherwise grant chart access to the wrong people.
          </Banner>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
