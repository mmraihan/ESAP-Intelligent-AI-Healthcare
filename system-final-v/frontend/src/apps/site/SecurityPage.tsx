/**
 * Security & compliance (§15).
 *
 * Written for the person who will run the security review. The page has one
 * rule: a control is listed as built only if it exists in this codebase today.
 * Everything else sits under "Planned", so nobody signs off on a promise.
 *
 * English and Arabic (QA issue 14): every string is an English key for t().
 */
import { Badge, Banner, Card } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { SiteLayout } from "./SiteLayout";
import { SecurityArt } from "./SiteArt";
import { GradeLegend } from "@/components/ui/domain";
import {
  AlertIcon, CheckIcon, ClockIcon, KeyIcon, LockIcon, ScaleIcon, ServerIcon, ShieldIcon, XIcon,
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
    how: "Every output is derived from the patient's admission record and population statistics.",
  },
  {
    n: 3,
    criterion: "Intended to support or provide recommendations to a healthcare professional",
    how: "The product is addressed to clinicians. The patient surface shows only what a named clinician has read and released, never a raw score.",
  },
  {
    n: 4,
    criterion: "Intended to enable the professional to independently review the basis",
    how: "This is the one that shapes the whole interface. Every estimate carries its computed drivers, its calibration state and its limitations.",
  },
];

const BREAKS_IT = [
  "Presenting an estimate as a directive — “start antibiotics” rather than “these conditions are more likely”.",
  "Ranking a worklist by a model score by default, so the software chooses who is seen first.",
  "Hiding the drivers, or replacing computed drivers with a language model's narration of them.",
  "Removing the calibration state, so a clinician cannot tell a validated number from an unvalidated one.",
  "A time-critical alert that leaves no practical room for independent review.",
];

/** Only what exists in this build. Add a row when the control ships, not before. */
const BUILT = [
  { area: "Passwords", detail: "Stored as salted PBKDF2-HMAC-SHA256 hashes, never in plain text. Patients and individual clinicians reset their own password with an emailed link that works once, for 60 minutes." },
  { area: "Sign-in protection", detail: "Five wrong passwords lock sign-in for that address for 15 minutes, with the same message whether or not the account exists. Failed sign-ins are written to the audit log." },
  { area: "Sessions", detail: "Issued and checked on the server. A session ends after 30 minutes without activity and after 12 hours in any case. The browser keeps it in an HttpOnly cookie, not in local storage." },
  { area: "Invitations", detail: "Hospital accounts are created through invitations that can be used once and expire." },
  { area: "Role-based access", detail: "Permissions are enforced on the server for each role. A clinician with a limited scope sees their own unit or assigned patients, and a request outside that scope is refused." },
  { area: "Organisation separation", detail: "Every request is filtered to the caller's organisation by the application." },
  { area: "Audit log", detail: "Reads of patient records and consequential changes are recorded with who, what and when. The application has no screen or API that edits an entry; entries are removed only by the retention purge after six years." },
  { area: "Consent and retention", detail: "Patients choose, per purpose, how their information is used, and each choice records the policy version. A daily purge deletes data past its retention period and writes a report of what it removed." },
  { area: "Breach handling", detail: "Operations staff can flag an incident as a personal-data breach. The console then tracks the 24-hour and 72-hour notification deadlines and drafts the notices." },
  { area: "Vendor access", detail: "ESAP staff have no standing access to patient records. Emergency access needs a named patient, a written reason, a ticket and a second approver, and it expires automatically." },
  { area: "Patient portal", detail: "Patients see only plain-language summaries a clinician has released, never a raw score." },
  { area: "Audit covariates", detail: "Race, insurance and marital status are kept out of every model input." },
  { area: "Transport", detail: "The hosted demo is served over HTTPS. The API sends security headers that block framing and content-type sniffing." },
];

const PLANNED = [
  { area: "Encryption", items: ["Encryption at rest, with keys per organisation", "Mutual TLS on integration endpoints"] },
  { area: "Isolation and hosting", items: ["Database-enforced row-level security", "Dedicated single-tenant deployments", "Hosting inside Saudi Arabia", "EU data residency"] },
  { area: "Sign-in", items: ["Hospital single sign-on (OIDC or SAML) and SCIM provisioning", "Multi-factor sign-in"] },
  { area: "Audit and recovery", items: ["Tamper-evident, append-only audit storage", "Automated backups with tested restores"] },
  { area: "Assurance", items: ["Independent penetration test", "Published sub-processor register"] },
  { area: "Compliance programmes", items: ["Saudi PDPL programme and a named Data Protection Officer", "SFDA determination of whether each model is a medical device", "HIPAA programme and Business Associate Agreement", "GDPR data-subject process", "SOC 2 Type II", "HITRUST"] },
];

export function SecurityPage() {
  return (
    <SiteLayout>
      <section className="hero hero-split" style={{ paddingBottom: 0 }}>
        <div className="hero-copy">
        <span className="hero-eyebrow"><ShieldIcon size={14} /> {t("Security & compliance")}</span>
        <h1>{t("What is built today, and what is not.")}</h1>
        <p className="hero-lede">
          {t("For the person who has to sign this off. Controls are listed as built only if they exist in the product now. Everything else is under Planned, and no certification, audit or compliance programme is claimed.")}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Badge tone="good" icon={<CheckIcon size={11} />}>{t("{n} controls built", { n: BUILT.length })}</Badge>
          <Badge tone="warning" icon={<AlertIcon size={11} />}>{t("No certifications held")}</Badge>
          <Badge tone="warning" icon={<AlertIcon size={11} />}>{t("Demo: synthetic data only")}</Badge>
        </div>
        </div>
        <SecurityArt />
      </section>

      <Banner tone="warning" icon={<AlertIcon size={18} />} title={t("This is a demonstration, not a production service for patient data")}>
        {t("The hosted demo holds synthetic data, serves placeholder models and is not hosted in Saudi Arabia. Text typed into the assistant may be processed by a language-model service. Please do not enter real patient information.")}
      </Banner>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>{t("Built today")}</h2>
        <Card padded={false}>
          <div className="scroll-x">
            <table className="data-table">
              <thead><tr><th style={{ width: "24%" }}>{t("Area")}</th><th>{t("Control")}</th></tr></thead>
              <tbody>
                {BUILT.map((c) => (
                  <tr key={c.area}>
                    <td><strong>{t(c.area)}</strong></td>
                    <td className="muted" style={{ lineHeight: 1.6 }}>{t(c.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>{t("Planned")}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
          {t("None of these are in place yet. Do not rely on any of them when assessing this build.")}
        </p>
        <div className="grid grid-2">
          {PLANNED.map((g) => (
            <Card key={g.area} title={<span className="row" style={{ gap: 8 }}><ClockIcon size={18} /> {t(g.area)}</span>}>
              <ul className="caveat-list">
                {g.items.map((item) => <li key={item}><ClockIcon size={14} /> {t(item)}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <Banner tone="accent" icon={<ScaleIcon size={18} />} title={t("Regulatory position: designed as decision support, not reviewed by a regulator")}>
        {t("The interface is designed around the US FDA’s non-device clinical decision support criteria. That is a design constraint, not a legal opinion or a clearance. No regulator has reviewed ESAP, and the Saudi SFDA determination has not been made.")}
      </Banner>

      <section className="stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>{t("The four design criteria")}</h2>
        {CDS_CRITERIA.map((c) => (
          <Card key={c.n} title={t("Criterion {n}", { n: c.n })} subtitle={t(c.criterion)}>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{t(c.how)}</p>
          </Card>
        ))}

        <Card title={t("What would break criterion 4")} subtitle={t("The one that constrains the interface most")}>
          <ul className="caveat-list">
            {BREAKS_IT.map((b) => <li key={b}><XIcon size={14} /> {t(b)}</li>)}
          </ul>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={<span className="row" style={{ gap: 8 }}><KeyIcon size={18} /> {t("Access is graded, not binary")}</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            {t("Each role is scoped to what it needs. A physician reads their assigned patients; a charge nurse reads their unit; a privacy officer reads the audit log and cannot open a chart.")}
          </p>
          <GradeLegend />
        </Card>

        <Card title={<span className="row" style={{ gap: 8 }}><LockIcon size={18} /> {t("Models and patient data")}</span>}>
          <ul className="caveat-list">
            <li><XIcon size={14} /> {t("This application has no path that sends patient data into model training.")}</li>
            <li><XIcon size={14} /> {t("Race, insurance and marital status are never fed into a model.")}</li>
          </ul>
        </Card>
      </section>

      <section>
        <Card title={<span className="row" style={{ gap: 8 }}><ServerIcon size={18} /> {t("Research and serving are separate")}</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            {t("Models are developed offline on the de-identified MIMIC-IV research dataset. The serving application loads exported model files and has no connection to the research database.")}
          </p>
        </Card>
      </section>
    </SiteLayout>
  );
}
