/**
 * The full permissions matrix (§4.6), rendered from the enforcement rules.
 *
 * Same data as the admin console's Roles & Scopes screen, shown here with all
 * sixteen roles at once. It reads from `MATRIX` directly, so it is a view of
 * the enforcement logic rather than documentation that can fall out of date.
 */
import { Fragment, useState } from "react";
import {
  ALL_PERMISSIONS, GRADE_LABEL, GRADE_SYMBOL, MATRIX, ROLES, grade,
  type Grade, type Permission, type RoleCode,
} from "@/lib/rbac";
import { Badge, Banner, Card, PageHeader, SegmentedControl } from "@/components/ui/primitives";
import { GradeCell, GradeLegend, RoleBadge } from "@/components/ui/domain";
import { KeyIcon, LockIcon, ScaleIcon } from "@/components/ui/icons";

const ALL_ROLES = Object.keys(ROLES) as RoleCode[];

export function PermissionsMatrixPage() {
  const [surface, setSurface] = useState<"all" | "clinician" | "admin" | "ops" | "patient">("all");
  const roles = surface === "all" ? ALL_ROLES : ALL_ROLES.filter((r) => ROLES[r].surface === surface);
  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));

  const gradeCount = (g: Grade) =>
    ALL_ROLES.reduce(
      (a, r) => a + ALL_PERMISSIONS.filter((p) => grade(r, p.key as Permission) === g).length,
      0,
    );

  return (
    <>
      <PageHeader
        eyebrow={<span className="row" style={{ gap: 7 }}><KeyIcon size={13} /> RBAC</span>}
        title="The permissions matrix"
        lede="All sixteen roles against every capability. This table is generated from the same rules the application enforces with — if a cell says no, the application genuinely says no."
        meta={
          <>
            <Badge tone="neutral">{ALL_ROLES.length} roles</Badge>
            <Badge tone="neutral">{ALL_PERMISSIONS.length} capabilities</Badge>
            <Badge tone="accent">{gradeCount("scoped")} scoped grants</Badge>
            <Badge tone="warning">{gradeCount("breakglass")} break-glass only</Badge>
          </>
        }
      />

      <Banner tone="accent" icon={<ScaleIcon size={16} />} title="Graded, not binary">
        Most capabilities are scoped rather than granted outright. Collapsing this to yes/no is how
        products end up with a physician who can read the whole hospital — the grade <em>is</em> the
        access control.
      </Banner>

      <SegmentedControl
        ariaLabel="Surface"
        value={surface}
        onChange={setSurface}
        options={[
          { value: "all", label: "All roles" },
          { value: "clinician", label: "Clinical" },
          { value: "admin", label: "Administrative" },
          { value: "ops", label: "Platform" },
          { value: "patient", label: "Patient" },
        ]}
      />

      <Card title="Legend" subtitle="Five grades of access">
        <GradeLegend />
        <div className="scroll-x">
          <table className="data-table is-dense">
            <thead><tr><th>Grade</th><th>Symbol</th><th>What it means in the interface</th></tr></thead>
            <tbody>
              <tr><td><strong>Full</strong></td><td><span className="grade grade-full">{GRADE_SYMBOL.full}</span></td><td className="muted">The control is available without qualification.</td></tr>
              <tr><td><strong>Scoped</strong></td><td><span className="grade grade-scoped">{GRADE_SYMBOL.scoped}</span></td><td className="muted">The control is available, with its constraint stated on it — &ldquo;your assigned patients&rdquo;, &ldquo;this unit&rdquo;, &ldquo;your own record&rdquo;.</td></tr>
              <tr><td><strong>Co-sign</strong></td><td><span className="grade grade-cosign">{GRADE_SYMBOL.cosign}</span></td><td className="muted">The action completes immediately but is not final until a second named person signs it.</td></tr>
              <tr><td><strong>Break-glass</strong></td><td><span className="grade grade-breakglass">{GRADE_SYMBOL.breakglass}</span></td><td className="muted">Not standing access. Reachable only through a time-boxed, justified, second-approved elevation.</td></tr>
              <tr><td><strong>None</strong></td><td><span className="grade grade-none">{GRADE_SYMBOL.none}</span></td><td className="muted">The control does not render at all, and the endpoint refuses it independently.</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="The matrix" subtitle={`${roles.length} roles × ${ALL_PERMISSIONS.length} capabilities`} padded={false}>
        <div className="scroll-x">
          <table className="data-table matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: 230 }}>Capability</th>
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
                      {roles.map((r) => <td key={r}><GradeCell role={r} permission={p.key as Permission} /></td>)}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Role catalog" subtitle="What each role is for, and how far it reaches" padded={false}>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr><th>Role</th><th>Scope</th><th>HL7 mapping</th><th>Grants</th><th>What it is for</th></tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const granted = ALL_PERMISSIONS.filter((p) => grade(r, p.key as Permission) !== "none").length;
                return (
                  <tr key={r}>
                    <td><RoleBadge role={r} /></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{ROLES[r].scopeLabel}</td>
                    <td className="mono muted" style={{ fontSize: 11.5 }}>{ROLES[r].hl7}</td>
                    <td className="tnum">{granted} / {ALL_PERMISSIONS.length}</td>
                    <td className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: "48ch" }}>{ROLES[r].blurb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={<span className="row" style={{ gap: 7 }}><LockIcon size={16} /> What no role can do</span>} subtitle="Enforced below the permission layer, so no grant can reach it">
        <ul className="caveat-list">
          <li><LockIcon size={13} /> Feed an audit covariate into a model. They are stored beside the feature matrix, never inside it.</li>
          <li><LockIcon size={13} /> Use anything recorded after t₀ in an estimate. The cut is applied at the data layer.</li>
          <li><LockIcon size={13} /> See another tenant&rsquo;s data. Cross-tenant reach exists only as a platform break-glass, and a tenant can disable even that.</li>
          <li><LockIcon size={13} /> Delete or edit an audit entry. There is no delete path for anyone, at any tier.</li>
          <li><LockIcon size={13} /> Silence the leakage alarm, or hide a degraded-model label, or suppress a calibration badge.</li>
        </ul>
        <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
          These are not the absence of a permission — they are enforced a layer below the permission
          system, so no misconfiguration of the matrix above can reach them.
        </p>
      </Card>

      <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
        Grade definitions: {(Object.keys(GRADE_LABEL) as Grade[]).map((g) => `${GRADE_SYMBOL[g]} ${GRADE_LABEL[g]}`).join(" · ")}
      </p>

      <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
        Source: <span className="mono">src/lib/rbac.ts</span> — {Object.keys(MATRIX).length} roles defined.
      </p>
    </>
  );
}
