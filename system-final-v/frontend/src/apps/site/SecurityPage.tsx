/**
 * Security & compliance (§15).
 *
 * Written for the person who will actually run the security review, not for a
 * marketing page. The regulatory-posture section is the load-bearing one: the
 * four criteria that keep this non-device CDS are stated, along with what would
 * break each of them.
 */
import { Badge, Banner, Card } from "@/components/ui/primitives";
import { SiteLayout } from "./SiteLayout";
import { GradeLegend } from "@/components/ui/domain";
import {
  AlertIcon, CheckIcon, GlobeIcon, KeyIcon, LockIcon, ScaleIcon, ServerIcon, ShieldIcon, XIcon,
} from "@/components/ui/icons";

const CDS_CRITERIA = [
  {
    n: 1,
    criterion: "Not intended to acquire, process or analyse a medical image or a signal from an in-vitro diagnostic device",
    how: "ESAP consumes structured admission data and free text. It does not read images, waveforms or device signals.",
  },
  {
    n: 2,
    criterion: "Intended to display, analyse or print medical information",
    how: "Every output is derived from the patient's own record plus published population statistics — both are medical information in the ordinary sense.",
  },
  {
    n: 3,
    criterion: "Intended to support or provide recommendations to a healthcare professional",
    how: "The product is addressed to clinicians. The patient surface shows only what a named clinician has read and released, never a raw score.",
  },
  {
    n: 4,
    criterion: "Intended to enable the professional to independently review the basis",
    how: "This is the one that shapes the whole interface. Every estimate carries its computed drivers, its calibration state, its limitations and the model basis page behind it. Nothing is a black box the clinician must simply accept.",
  },
];

const BREAKS_IT = [
  "Presenting an estimate as a directive — “start antibiotics” rather than “these conditions are more likely”.",
  "Ranking a worklist by a model score by default, so the software chooses who is seen first.",
  "Hiding the drivers, or replacing computed drivers with a language model's narration of them.",
  "Removing the calibration state, so a clinician cannot tell a validated number from an unvalidated one.",
  "A time-critical alert that leaves no practical room for independent review.",
];

const CONTROLS = [
  { area: "Encryption", detail: "AES-256 at rest with tenant-scoped keys; TLS 1.3 in transit; mutual TLS on integration endpoints." },
  { area: "Isolation", detail: "Four tiers, from shared schema with row-level security up to a dedicated single-tenant VPC. Chosen at provisioning, because changing it later is a migration." },
  { area: "Residency", detail: "US, EU, or your own data centre. EU residency switches on the full GDPR data-subject surface." },
  { area: "Access", detail: "SSO with OIDC or SAML, SCIM provisioning, single-use expiring invites for every account." },
  { area: "Audit", detail: "Append-only, hash-chained daily, six-year retention, covering reads as well as writes. No delete path exists for anyone, including us." },
  { area: "Vendor access", detail: "Zero standing access to PHI. Break-glass requires a named patient, a written reason, a ticket, a second approver and a maximum 60-minute expiry — and you can disable it entirely." },
  { area: "Backups", detail: "Per-tenant at the higher isolation tiers; restore tested quarterly; encrypted with the same tenant-scoped keys." },
  { area: "Sub-processors", detail: "Published register with 30 days' notice before any addition with PHI access, and a customer objection right." },
];

export function SecurityPage() {
  return (
    <SiteLayout>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <span className="hero-eyebrow"><ShieldIcon size={14} /> Security & compliance</span>
        <h1>Written for the person who has to sign this off.</h1>
        <p className="hero-lede">
          The regulatory posture, the technical controls, and the specific things that would break
          either. No certifications are claimed here that are not held.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Badge tone="good" icon={<CheckIcon size={11} />}>HIPAA / HITECH program</Badge>
          <Badge tone="good" icon={<CheckIcon size={11} />}>BAA executed as standard</Badge>
          <Badge tone="warning" icon={<AlertIcon size={11} />}>SOC 2 Type II — in progress</Badge>
          <Badge tone="warning" icon={<AlertIcon size={11} />}>HITRUST — planned</Badge>
          <Badge tone="good" icon={<CheckIcon size={11} />}>GDPR, EU residency available</Badge>
        </div>
      </section>

      <Banner tone="accent" icon={<ScaleIcon size={18} />} title="Regulatory posture: non-device clinical decision support">
        ESAP is designed to sit inside the FDA&rsquo;s non-device CDS criteria rather than to seek
        clearance as a device. That is a design constraint, not a legal opinion — it shapes what the
        interface is allowed to do, and the four criteria below are why the product looks the way it
        does.
      </Banner>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>The four criteria, and how we meet each one</h2>
        {CDS_CRITERIA.map((c) => (
          <Card key={c.n} title={`Criterion ${c.n}`} subtitle={c.criterion}>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{c.how}</p>
          </Card>
        ))}

        <Card title="What would break criterion 4" subtitle="The one that constrains the interface most">
          <ul className="caveat-list">
            {BREAKS_IT.map((b) => <li key={b}><XIcon size={14} /> {b}</li>)}
          </ul>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            These are not hypothetical. Each one is a change someone has asked us for, and each one is
            refused for the same reason.
          </p>
        </Card>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>Technical controls</h2>
        <Card padded={false}>
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th style={{ width: "20%" }}>Area</th><th>Control</th></tr></thead>
              <tbody>
                {CONTROLS.map((c) => (
                  <tr key={c.area}>
                    <td><strong>{c.area}</strong></td>
                    <td className="muted" style={{ lineHeight: 1.6 }}>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={<span className="row" style={{ gap: 8 }}><KeyIcon size={18} /> Access is graded, not binary</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            Sixteen roles, each scoped to what it genuinely needs. A physician reads their assigned
            patients; a charge nurse reads their unit; a privacy officer reads the audit log and
            cannot open a chart at all.
          </p>
          <GradeLegend />
        </Card>

        <Card title={<span className="row" style={{ gap: 8 }}><LockIcon size={18} /> What we never do with your data</span>}>
          <ul className="caveat-list">
            <li><XIcon size={14} /> Train models on your patient data without a separate, explicit agreement.</li>
            <li><XIcon size={14} /> Move patient-level data out of your tenant for benchmarking. Aggregate counts only, and only if you opt in.</li>
            <li><XIcon size={14} /> Feed race, insurance or marital status into any model.</li>
            <li><XIcon size={14} /> Delete anything on suspension. Suspension and deletion are separate actions.</li>
            <li><XIcon size={14} /> Hold your encryption keys in plaintext.</li>
          </ul>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={<span className="row" style={{ gap: 8 }}><ServerIcon size={18} /> The research / production firewall</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            Model development happens against a de-identified research schema that is physically
            separate from the production tenant data. The serving layer reads production and writes
            nothing back into the research schema. This boundary is a compliance control, not an
            engineering convenience — it is what lets us say that improving the model does not require
            anyone to look at your patients.
          </p>
        </Card>

        <Card title={<span className="row" style={{ gap: 8 }}><GlobeIcon size={18} /> Incident response</span>}>
          <div className="plan-limits" style={{ borderTop: "none", paddingTop: 0 }}>
            <div><span>Initial assessment</span><strong>Within 1 hour</strong></div>
            <div><span>Customer notification</span><strong>Within 24 hours of confirmation</strong></div>
            <div><span>HIPAA breach notification</span><strong>Within 60 days, as required</strong></div>
            <div><span>GDPR supervisory notification</span><strong>Within 72 hours</strong></div>
            <div><span>Post-incident report</span><strong>Within 10 business days</strong></div>
          </div>
        </Card>
      </section>

      <section>
        <Card title="Documents available under NDA">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {[
              "Security whitepaper", "Penetration test summary", "Sub-processor register",
              "Model cards (all five)", "Fairness and calibration report", "Business continuity plan",
              "Standard BAA", "Data processing agreement",
            ].map((d) => <Badge key={d} tone="neutral">{d}</Badge>)}
          </div>
        </Card>
      </section>
    </SiteLayout>
  );
}
