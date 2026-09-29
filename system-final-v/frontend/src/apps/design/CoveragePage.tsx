/**
 * Blueprint coverage.
 *
 * A map from every screen the blueprint specifies to the route that implements
 * it, plus an honest list of what is deliberately not built in a frontend-only
 * demo. Useful in a client walkthrough: it answers "did you do all of it" with
 * a list rather than an assurance.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Banner, Card, PageHeader, SearchInput, SegmentedControl, StatTile, cx } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, ListIcon, ServerIcon } from "@/components/ui/icons";

type Item = { section: string; name: string; route?: string; group: string; note?: string };

const ITEMS: Item[] = [
  // Public & auth
  { section: "16", name: "Positioning & landing page", route: "/product", group: "Public & auth" },
  { section: "16.12", name: "Public evidence page", route: "/evidence", group: "Public & auth" },
  { section: "15", name: "Security & compliance", route: "/security", group: "Public & auth" },
  { section: "17", name: "Pricing & packaging", route: "/pricing", group: "Public & auth" },
  { section: "10.8", name: "Sign in — SSO, password", route: "/login", group: "Public & auth" },
  { section: "10.7", name: "Individual signup + capacity attestation", route: "/signup", group: "Public & auth" },
  { section: "10.5", name: "Invite acceptance", route: "/invite/demo", group: "Public & auth" },

  // Clinician
  { section: "12.3.1", name: "D1 Worklist", route: "/doctor/worklist", group: "Clinician workspace" },
  { section: "12.3.1a", name: "D1a Discharge planning", route: "/doctor/discharge", group: "Clinician workspace" },
  { section: "12.3.2", name: "D2 Intake (review & edit)", route: "/doctor/encounters/enc_1000/intake", group: "Clinician workspace" },
  { section: "12.3.3", name: "D3 Results", route: "/doctor/encounters/enc_1000/results", group: "Clinician workspace" },
  { section: "12.3.3", name: "D4 Why panel (drawer on D3)", route: "/doctor/encounters/enc_1000/results", group: "Clinician workspace" },
  { section: "12.3.5", name: "D5 Next-best-test (reserved panel)", route: "/doctor/encounters/enc_1000/results", group: "Clinician workspace", note: "Renders empty by design — designed, not validated." },
  { section: "12.3.6", name: "D6 Chat over the assessment", route: "/doctor/encounters/enc_1000/results", group: "Clinician workspace" },
  { section: "12.3.8", name: "D7 Patient timeline", route: "/doctor/encounters/enc_1000/timeline", group: "Clinician workspace" },
  { section: "12.3.4", name: "D8 Results history", route: "/doctor/encounters/enc_1000/history", group: "Clinician workspace" },
  { section: "12.3.7", name: "Resident co-sign state", route: "/doctor/encounters/enc_1000/results", group: "Clinician workspace", note: "Switch to the Resident role to see it." },
  { section: "12.4.1", name: "N1 Unit risk roster", route: "/nurse/roster", group: "Nurse workspace" },
  { section: "12.4.6", name: "N2 Handoff summary", route: "/nurse/handoff", group: "Nurse workspace" },
  { section: "12.4.2", name: "N3 My patients", route: "/nurse/my-patients", group: "Nurse workspace" },
  { section: "12.4.3", name: "N4 Intake capture", route: "/nurse/encounters/new", group: "Nurse workspace" },
  { section: "12.4.4", name: "N5 Vitals & labs fast entry", route: "/nurse/encounters/enc_1000/vitals", group: "Nurse workspace" },
  { section: "12.4.5", name: "N6 Triage", route: "/nurse/triage", group: "Nurse workspace" },
  { section: "12.4.1", name: "N7 Read-only results", route: "/nurse/encounters/enc_1000/results", group: "Nurse workspace" },
  { section: "18", name: "Models & basis", route: "/models", group: "Clinician workspace" },
  { section: "12.8", name: "How to read a result", route: "/help", group: "Clinician workspace" },

  // Admin console
  { section: "11.4.1", name: "Home / status dashboard", route: "/admin/home", group: "Hospital admin console" },
  { section: "11.4.2", name: "Roster", route: "/admin/roster", group: "Hospital admin console" },
  { section: "11.4.3", name: "Invites", route: "/admin/invites", group: "Hospital admin console" },
  { section: "11.4.4", name: "Facilities & units", route: "/admin/facilities", group: "Hospital admin console" },
  { section: "11.4.5", name: "Roles & scopes", route: "/admin/roles", group: "Hospital admin console" },
  { section: "11.4.6", name: "Integrations", route: "/admin/integrations", group: "Hospital admin console" },
  { section: "11.4.7", name: "Model & display settings", route: "/admin/models", group: "Hospital admin console" },
  { section: "11.4.8", name: "Usage & outcomes", route: "/admin/usage", group: "Hospital admin console" },
  { section: "15.9", name: "Fairness audit", route: "/admin/fairness", group: "Hospital admin console" },
  { section: "11.4.9", name: "Interop & record transfer", route: "/admin/interop", group: "Hospital admin console" },
  { section: "11.4.10", name: "Audit log", route: "/admin/audit", group: "Hospital admin console" },
  { section: "11.4.11", name: "Billing", route: "/admin/billing", group: "Hospital admin console" },
  { section: "11.4.12", name: "Org settings", route: "/admin/org", group: "Hospital admin console" },

  // Ops console
  { section: "11.5.1", name: "Fleet dashboard", route: "/ops/fleet", group: "Platform ops console" },
  { section: "11.5.2", name: "Provisioning wizard", route: "/ops/provision", group: "Platform ops console" },
  { section: "11.5.3", name: "Tenant detail", route: "/ops/tenants/t_yves", group: "Platform ops console" },
  { section: "11.5.4", name: "Model rollout console", route: "/ops/rollout", group: "Platform ops console" },
  { section: "11.5.5", name: "Global config", route: "/ops/config", group: "Platform ops console" },
  { section: "11.5.6", name: "Break-glass", route: "/ops/break-glass", group: "Platform ops console" },
  { section: "11.5.7", name: "Platform audit log", route: "/ops/audit", group: "Platform ops console" },
  { section: "11.5.8", name: "Incidents", route: "/ops/incidents", group: "Platform ops console" },
  { section: "11.5.9", name: "Plan catalog", route: "/ops/plans", group: "Platform ops console" },

  // Patient
  { section: "13 P0", name: "Welcome, language & reading level", route: "/welcome", group: "Patient portal" },
  { section: "13 P1", name: "Sign up / log in", route: "/signup", group: "Patient portal" },
  { section: "13 P2", name: "Home / My Health", route: "/patient/home", group: "Patient portal" },
  { section: "13 P3", name: "Guided self-intake", route: "/patient/intake", group: "Patient portal" },
  { section: "13 P4", name: "Pre-visit summary", route: "/patient/previsit", group: "Patient portal" },
  { section: "13 P5", name: "My results + release gate", route: "/patient/results", group: "Patient portal" },
  { section: "13 P6", name: "My records (right of access)", route: "/patient/records", group: "Patient portal" },
  { section: "13 P7", name: "Share & consent centre", route: "/patient/sharing", group: "Patient portal" },
  { section: "13 P8", name: "Care team", route: "/patient/care-team", group: "Patient portal" },
  { section: "13 P9", name: "Family & caregiver access", route: "/patient/family", group: "Patient portal" },
  { section: "13 P10", name: "Settings & accessibility", route: "/patient/settings", group: "Patient portal" },

  // Cross-cutting
  { section: "14", name: "Design system", route: "/design", group: "Cross-cutting" },
  { section: "4.6", name: "Permissions matrix", route: "/design/permissions", group: "Cross-cutting" },
  { section: "14.3", name: "Light / dark / system theming", route: "/design", group: "Cross-cutting" },
  { section: "4.8", name: "Break-glass elevation banner", route: "/ops/break-glass", group: "Cross-cutting" },
  { section: "5", name: "Deployment & tenancy display", route: "/admin/org", group: "Cross-cutting" },
  { section: "7", name: "Interop paths & MPI review", route: "/admin/interop", group: "Cross-cutting" },
];

const NOT_BUILT = [
  { what: "Every API call in §8 and §9", why: "This build is frontend-only, as scoped. All data comes from src/mock/db.ts, and the shapes match API_CONTRACT.md so wiring the real backend is a data-layer swap rather than a rewrite." },
  { what: "Three separate deployables (§11.1)", why: "Production ships the clinical app, the admin console and the ops console as three bundles on three hostnames. Here they share one bundle so a single link demonstrates everything; the route groups map 1:1 onto the split." },
  { what: "Real authentication, SSO and SCIM", why: "The screens and flows are built; the identity provider integration is backend work." },
  { what: "Next-best-test computation (§18.5)", why: "The panel is reserved and renders empty on purpose. A suggested test that is not computed from the model would read as clinical advice the software cannot support." },
  { what: "Tower B / Tower C fusion", why: "The UI represents the fusion state honestly as 'Tower A only' everywhere, which is the current truth." },
];

export function CoveragePage() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");

  const groups = useMemo(() => Array.from(new Set(ITEMS.map((i) => i.group))), []);
  const rows = useMemo(
    () =>
      ITEMS.filter(
        (i) =>
          (group === "all" || i.group === group) &&
          (!q.trim() || `${i.name} ${i.section} ${i.group}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [q, group],
  );

  return (
    <>
      <PageHeader
        eyebrow={<span className="row" style={{ gap: 7 }}><ListIcon size={13} /> Coverage</span>}
        title="Blueprint coverage"
        lede="Every screen PRODUCT_BLUEPRINT.md specifies, and the route that implements it. Plus an honest list of what a frontend-only build cannot cover."
      />

      <div className="grid grid-4">
        <StatTile label="Screens implemented" value={ITEMS.length} tone="good" icon={<CheckIcon size={15} />} />
        <StatTile label="Surfaces" value={groups.length} />
        <StatTile label="Blueprint sections touched" value={new Set(ITEMS.map((i) => i.section.split(" ")[0].split(".")[0])).size} />
        <StatTile label="Known gaps" value={NOT_BUILT.length} tone="warning" icon={<AlertIcon size={15} />} />
      </div>

      <Banner tone="accent" title="How to use this in a walkthrough">
        Search for a section number from the blueprint and click straight through to the screen that
        implements it. The left rail also prints the section reference next to every nav item.
      </Banner>

      <Card title="Screen map" padded={false}>
        <div style={{ padding: "16px 18px 0" }} className="table-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Search a screen or a section number" />
          <SegmentedControl
            size="sm"
            ariaLabel="Surface"
            value={group}
            onChange={setGroup}
            options={[{ value: "all", label: "All" }, ...groups.slice(0, 3).map((g) => ({ value: g, label: g.split(" ")[0] }))]}
          />
        </div>
        <div style={{ padding: "12px 18px 18px" }}>
          {groups
            .filter((g) => group === "all" || g === group)
            .map((g) => {
              const items = rows.filter((i) => i.group === g);
              if (items.length === 0) return null;
              return (
                <section key={g} style={{ marginBottom: 20 }}>
                  <h3 className="section-title" style={{ fontSize: 14, marginBottom: 6 }}>
                    {g} <span className="muted tnum" style={{ fontWeight: 400 }}>({items.length})</span>
                  </h3>
                  {items.map((i) => (
                    <div key={`${i.section}-${i.name}`} className="coverage-row">
                      <span className="coverage-section">§{i.section}</span>
                      <span className="coverage-name">
                        {i.route ? <Link to={i.route} className="enc-link">{i.name}</Link> : i.name}
                        {i.note && <span className="muted" style={{ display: "block", fontSize: 11.5, lineHeight: 1.45 }}>{i.note}</span>}
                      </span>
                      <Badge tone="good" icon={<CheckIcon size={11} />}>built</Badge>
                    </div>
                  ))}
                </section>
              );
            })}
        </div>
      </Card>

      <Card
        title={<span className="row" style={{ gap: 7 }}><ServerIcon size={16} /> What this build does not cover</span>}
        subtitle="Stated rather than implied"
      >
        {NOT_BUILT.map((n) => (
          <div key={n.what} className="flag-row">
            <div className="flag-meta">
              <strong>{n.what}</strong>
              <span>{n.why}</span>
            </div>
            <Badge tone="warning" icon={<AlertIcon size={11} />}>out of scope</Badge>
          </div>
        ))}
      </Card>

      <Card title="Where the data comes from">
        <p className="prose" style={{ margin: 0 }}>
          Every figure in this application is synthetic and generated from a fixed seed, so a demo
          shows the same numbers every time. No MIMIC-IV data, no real patient information and no
          production credential appears anywhere in this build. The clinical response shapes are
          transcribed from <span className={cx("mono")}>API_CONTRACT.md</span>, so replacing the mock
          layer with real endpoints is a change to one module rather than to the screens.
        </p>
      </Card>
    </>
  );
}
