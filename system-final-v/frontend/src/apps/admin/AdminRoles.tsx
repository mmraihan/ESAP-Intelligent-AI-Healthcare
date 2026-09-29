/**
 * 11.4.5 — Roles & Scopes.
 *
 * The live permission matrix plus the HL7 mapping a hospital's own job titles
 * resolve through. The matrix is rendered from the same `MATRIX` the app
 * enforces with, so this screen cannot drift from the real behaviour — if it
 * says a role cannot do something, the app genuinely will not let them.
 */
import { Fragment, useState } from "react";
import {
  ADMIN_ROLES, ALL_PERMISSIONS, CLINICAL_ROLES, ROLES, type Permission, type RoleCode,
} from "@/lib/rbac";
import { USERS } from "@/mock/db";
import { useSession } from "@/lib/session";
import { Badge, Banner, Button, Card, Field, PageHeader, SegmentedControl, Select, TextInput, Toggle } from "@/components/ui/primitives";
import { GradeCell, GradeLegend, RoleBadge } from "@/components/ui/domain";
import { Modal, Toast } from "@/components/ui/overlays";
import { KeyIcon, LinkIcon, PlusIcon } from "@/components/ui/icons";
import { useSettings } from "@/hooks/useSettings";

type RolePolicy = {
  requireResidentCosign: boolean;
  breakGlassSecondApprover: boolean;
  allowScopeDelegation: boolean;
  nursesSeeRiskSummaries: boolean;
};

type TitleMapping = { role: RoleCode; scope: string };

/** Local job titles in use here and the role each holds, counted from the staff directory. */
function titleMap() {
  const rows = new Map<string, { local: string; role: RoleCode; hl7: string; count: number }>();
  for (const u of USERS) {
    const role = u.roles[0];
    const key = `${u.localTitle}|${role}`;
    const row = rows.get(key) ?? { local: u.localTitle, role, hl7: ROLES[role]?.hl7 ?? "—", count: 0 };
    row.count += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((x, y) => y.count - x.count);
}

export function AdminRoles() {
  const { role: sessionRole } = useSession();
  // Same tenant_owner-only boundary as an invite or a roster role change: this
  // mapping is a standing rule that will hand a role to anyone matching a
  // title, so it must not be a side door to granting clinical access (§4.6).
  const canGrantRoles = sessionRole === "tenant_owner";
  const mappableRoles = canGrantRoles ? [...CLINICAL_ROLES, ...ADMIN_ROLES] : ADMIN_ROLES;
  const [set, setSet] = useState<"clinical" | "admin">("clinical");
  const [mapOpen, setMapOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mapping, setMapping] = useState<{ title: string; role: RoleCode; scope: string }>({
    title: "", role: mappableRoles[0] ?? "resident", scope: "Facility: Main Campus",
  });
  const { settings: policy, save: savePolicy } = useSettings<RolePolicy>("org", {
    requireResidentCosign: true, breakGlassSecondApprover: true, allowScopeDelegation: false, nursesSeeRiskSummaries: true,
  });
  const { settings: roleSettings, save: saveRoles } = useSettings<{ titleMap: Record<string, TitleMapping> }>("roles", { titleMap: {} });
  const customTitles = Object.entries(roleSettings.titleMap);

  function saveMapping() {
    const title = mapping.title.trim();
    setMapOpen(false);
    if (!title) return;
    void saveRoles({ titleMap: { [title]: { role: mapping.role, scope: mapping.scope } } },
      `"${title}" now maps to ${ROLES[mapping.role].label}`).then(setToast);
    setMapping({ ...mapping, title: "" });
  }

  const roles = set === "clinical" ? CLINICAL_ROLES : ADMIN_ROLES;
  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Roles & scopes"
        lede="What each role can reach, and how your job titles map onto them. This table is rendered from the same rules the application enforces with — it cannot drift from the real behaviour."
        actions={<Button icon={<LinkIcon size={15} />} onClick={() => setMapOpen(true)}>Map a job title</Button>}
      />

      <Banner tone="accent" icon={<KeyIcon size={16} />} title="Access is graded, not on/off">
        Most capabilities are scoped rather than granted outright — a physician can read a patient, but
        only one assigned to them. The symbols below carry that distinction, and the UI shows the
        constraint on the control rather than hiding the capability.
      </Banner>

      <Card
        title="The permissions matrix"
        subtitle="§4.6"
        actions={
          <SegmentedControl
            size="sm"
            ariaLabel="Role set"
            value={set}
            onChange={setSet}
            options={[{ value: "clinical", label: "Clinical roles" }, { value: "admin", label: "Administrative" }]}
          />
        }
        footnote="Rendered from the enforcement rules, not transcribed alongside them."
        padded={false}
      >
        <div style={{ padding: "0 18px 12px" }}><GradeLegend /></div>
        <div className="scroll-x">
          <table className="data-table matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Capability</th>
                {roles.map((r) => <th key={r} className="rot">{ROLES[r].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="matrix-group-row">
                    <td colSpan={roles.length + 1}>{g}</td>
                  </tr>
                  {ALL_PERMISSIONS.filter((p) => p.group === g).map((p) => (
                    <tr key={p.key}>
                      <td>
                        <div className="cell-stack">
                          <span>{p.label}</span>
                          <span className="muted mono">{p.key}</span>
                        </div>
                      </td>
                      {roles.map((r) => (
                        <td key={r}><GradeCell role={r} permission={p.key as Permission} /></td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="split">
        <Card
          title="Local job titles"
          subtitle="How your titles resolve to an ESAP role"
          footnote="Required groundwork for a SMART-on-FHIR launch: the EHR sends a PractitionerRole code, and this table is what turns it into an ESAP role without a human in the loop."
          padded={false}
        >
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th>Your title</th><th>ESAP role</th><th className="col-secondary">HL7 PractitionerRole</th><th style={{ textAlign: "right" }}>People</th></tr></thead>
              <tbody>
                {titleMap().map((t) => (
                  <tr key={t.local}>
                    <td><strong>{t.local}</strong></td>
                    <td><RoleBadge role={t.role} /></td>
                    <td className="col-secondary mono muted">{t.hl7}</td>
                    <td style={{ textAlign: "right" }} className="tnum">{t.count}</td>
                  </tr>
                ))}
                {customTitles.map(([title, m]) => (
                  <tr key={`custom-${title}`}>
                    <td><strong>{title}</strong> <Badge tone="accent">mapped here</Badge></td>
                    <td><RoleBadge role={m.role} /></td>
                    <td className="col-secondary mono muted">{ROLES[m.role].hl7}</td>
                    <td style={{ textAlign: "right" }} className="muted">{m.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Tenant policy" subtitle="Rules that change how roles behave here">
            <Toggle
              checked={policy.requireResidentCosign}
              onChange={(v) => void savePolicy({ requireResidentCosign: v }, v ? "Resident co-sign required" : "Resident co-sign no longer required").then(setToast)}
              label="Require attending co-sign on resident acknowledgements"
              hint="Teaching hospitals turn this on. A resident's review is recorded immediately and routes to the named attending to close. Community hospitals without a residency programme leave it off."
            />
            <Toggle
              checked={policy.breakGlassSecondApprover}
              onChange={(v) => void savePolicy({ breakGlassSecondApprover: v }, v ? "Break-glass needs a second approver" : "Break-glass is now self-service").then(setToast)}
              label="Break-glass requires a second approver"
              hint="An emergency access request must be approved by another clinician before it grants. Turning this off makes break-glass self-service, which some emergency departments require."
            />
            <Toggle
              checked={policy.allowScopeDelegation}
              onChange={(v) => void savePolicy({ allowScopeDelegation: v }, v ? "Scope delegation allowed" : "Scope delegation turned off").then(setToast)}
              label="Allow delegation of clinical scope"
              hint="Lets a physician hand their patient roster to a covering peer for a defined window, without an administrator involved."
            />
            <Toggle
              checked={policy.nursesSeeRiskSummaries}
              onChange={(v) => void savePolicy({ nursesSeeRiskSummaries: v }, v ? "Nurses can see risk summaries" : "Nurses restricted to intake surfaces").then(setToast)}
              label="Nurses may see risk summaries"
              hint="Off restricts nursing roles to the intake surfaces only. Most sites leave it on — a charge nurse who cannot see the roster cannot use it to allocate staff."
            />
          </Card>

          <Card title="Roles in use here" subtitle="Accounts by role">
            <ul className="bar-rows is-dense">
              {[...CLINICAL_ROLES, ...ADMIN_ROLES].map((r) => {
                const n = USERS.filter((u) => u.roles.includes(r)).length;
                if (n === 0) return null;
                return (
                  <li key={r}>
                    <div className="bar-row-head">
                      <span className="bar-row-label">{ROLES[r].label}</span>
                      <span className="bar-row-value tnum">{n}</span>
                    </div>
                    <div className="meter">
                      <div className="meter-fill" style={{ width: `${(n / 22) * 100}%`, background: "var(--seq-400)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="What no role can do" subtitle="Enforced below the permission layer">
            <ul className="caveat-list">
              <li><KeyIcon size={13} /> Feed race, insurance or marital status into a model. These are stored beside the features, never inside them.</li>
              <li><KeyIcon size={13} /> See data from another tenant. Cross-tenant reach exists only as a time-boxed platform break-glass, and it is not grantable from here.</li>
              <li><KeyIcon size={13} /> Use anything recorded after t₀ in an estimate. The cut is applied at the data layer, not by a permission.</li>
              <li><KeyIcon size={13} /> Silence the leakage alarm. It can be explained and resolved, never dismissed.</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Map a job title"
        subtitle="Resolve one of your titles to an ESAP role so new starters provision automatically"
        footer={
          <>
            <Button onClick={() => setMapOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!mapping.title.trim()} onClick={saveMapping}>Save mapping</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Your job title" required hint="Exactly as it appears in your HR system or identity provider.">
            <TextInput placeholder="Senior Clinical Fellow" value={mapping.title} onChange={(e) => setMapping({ ...mapping, title: e.currentTarget.value })} />
          </Field>
          <Field label="ESAP role" required>
            <Select value={mapping.role} onChange={(e) => setMapping({ ...mapping, role: e.currentTarget.value as RoleCode })}>
              {mappableRoles.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </Select>
          </Field>
          {!canGrantRoles && (
            <Banner tone="info" title="Clinical roles are not offered here">
              Your role provisions and reconfigures accounts. A mapping that can open a chart is set by the
              Hospital Admin.
            </Banner>
          )}
          <Field label="Default scope">
            <Select value={mapping.scope} onChange={(e) => setMapping({ ...mapping, scope: e.currentTarget.value })}>
              <option value="Facility: Main Campus">Facility: Main Campus</option>
              <option value="Roster: assigned patients only">Roster: assigned patients only</option>
            </Select>
          </Field>
          <Banner tone="warning" title="This grants access automatically">
            Once mapped, anyone arriving from your identity provider with this title is provisioned into
            that role without further review. Map conservatively — a title that sometimes means a
            different level of authority should stay manual.
          </Banner>
          <div className="row" style={{ gap: 8 }}>
            <Badge tone="neutral" icon={<PlusIcon size={11} />}>SCIM will honour this mapping</Badge>
          </div>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
