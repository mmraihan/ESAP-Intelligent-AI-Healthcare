/**
 * 11.4.12 — Org Settings. Tenant profile, branding, deployment mode.
 *
 * Deployment mode and isolation tier are displayed, not editable: they are
 * contractual and changing one is a migration, not a setting. Showing them
 * read-only is more honest than hiding them.
 */
import { useEffect, useState } from "react";
import { useSession, tenantFor } from "@/lib/session";
import { dateLabel, num, ago } from "@/lib/format";
import { ISOLATION_LABEL, MODE_LABEL, ModeTag, StatusPill } from "@/components/ui/domain";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, TextInput, Toggle } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { BuildingIcon, GlobeIcon, LockIcon, PaletteIcon, ServerIcon, ShieldIcon } from "@/components/ui/icons";
import { useSettings } from "@/hooks/useSettings";

const BRAND_PRESETS = ["#2a6fbf", "#0e8a92", "#4a3aa7", "#1baf7a", "#c05a2e"];

type OrgSettings = {
  displayName: string | null;
  primaryContact: string | null;
  timezone: string;
  brandingHex: string;
  assessmentRetention: string;
  showNameInTopbar: boolean;
  patientPortalEnabled: boolean;
  benchmarkingOptIn: boolean;
  allowEsapBreakGlass: boolean;
};

export function AdminOrg() {
  const { tenantId } = useSession();
  const tenant = tenantFor(tenantId);
  const { settings, save, loaded } = useSettings<OrgSettings>("org", {
    displayName: null, primaryContact: null, timezone: "America/New_York", brandingHex: tenant.brandingHex ?? "#2a6fbf",
    assessmentRetention: "6y", showNameInTopbar: true, patientPortalEnabled: true, benchmarkingOptIn: true,
    allowEsapBreakGlass: false,
  });
  const [profile, setProfile] = useState({ name: tenant.name, contact: tenant.contact, timezone: "America/New_York" });
  const [toast, setToast] = useState<string | null>(null);

  // Once the stored profile arrives, the form shows it rather than the seed defaults.
  useEffect(() => {
    if (!loaded) return;
    setProfile({
      name: settings.displayName ?? tenant.name,
      contact: settings.primaryContact ?? tenant.contact,
      timezone: settings.timezone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function saveProfile() {
    void save(
      { displayName: profile.name.trim() || null, primaryContact: profile.contact.trim() || null, timezone: profile.timezone },
      "Profile saved",
    ).then(setToast);
  }

  function toggle(key: keyof OrgSettings, value: boolean, label: string) {
    void save({ [key]: value }, `${label}: ${value ? "on" : "off"}`).then(setToast);
  }

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Org settings"
        lede="Your tenant profile, how it is deployed, and the handful of visual choices you control."
        meta={
          <>
            <ModeTag mode={tenant.mode} />
            <StatusPill status={tenant.status} />
            <Badge tone="neutral">{tenant.region}</Badge>
          </>
        }
      />

      <div className="grid grid-4">
        <StatTile label="Facilities" value={tenant.facilities} icon={<BuildingIcon size={15} />} />
        <StatTile label="Licensed beds" value={num(tenant.beds)} />
        <StatTile label="Live since" value={dateLabel(tenant.goLive)} hint={ago(tenant.goLive)} />
        <StatTile label="Last data refresh" value={ago(tenant.lastEtlRefresh)} icon={<ServerIcon size={15} />} />
      </div>

      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Tenant profile" subtitle="How your organisation appears throughout the product">
            <Field label="Organisation name" required>
              <TextInput value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.currentTarget.value })} />
            </Field>
            <Field label="Tenant slug" hint="Used in your console URL and in audit records, so it is fixed. Changing it goes through your account team.">
              <TextInput value={tenant.slug} readOnly disabled />
            </Field>
            <Field label="Primary contact" required>
              <TextInput value={profile.contact} onChange={(e) => setProfile({ ...profile, contact: e.currentTarget.value })} />
            </Field>
            <Field label="Time zone" hint="Determines when a 'day' starts for reporting, and the cycle boundary on your invoice.">
              <Select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.currentTarget.value })}>
                {["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin"].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Button variant="primary" disabled={!profile.name.trim() || !profile.contact.trim()} onClick={saveProfile}>Save profile</Button>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><PaletteIcon size={16} /> Branding</span>} subtitle="Light touch by design">
            <Field label="Accent colour" hint="Applied to interactive elements only. It is never applied to the risk ramp, the categorical condition hues, or any status colour — those carry meaning and are not yours to change.">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {BRAND_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch-chip${settings.brandingHex === c ? " is-selected" : ""}`}
                    style={{ background: c, width: 44, height: 32, cursor: "pointer", outline: settings.brandingHex === c ? "2px solid var(--text-primary)" : "none", outlineOffset: 2 }}
                    onClick={() => void save({ brandingHex: c }, `Accent colour set to ${c}`).then(setToast)}
                    aria-label={`Accent ${c}`}
                    aria-pressed={settings.brandingHex === c}
                  />
                ))}
              </div>
            </Field>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
              <strong>Logo:</strong> shown in the top bar beside the ESAP mark, never replacing it. Send an SVG
              or PNG (at least 64px tall) to your account team; it is checked for contrast before it goes live.
            </p>
            <Toggle
              checked={settings.showNameInTopbar}
              onChange={(v) => toggle("showNameInTopbar", v, "Hospital name in the top bar")}
              label="Show the hospital name in the top bar" hint="Helps staff who work across more than one organisation know which tenant they are in."
            />
            <Banner tone="accent" icon={<LockIcon size={16} />} title="What branding never touches">
              The risk ramp, the CCSR family palette, the four status colours and the calibration badge
              are fixed. They encode meaning that has been validated for colour-vision deficiency, and a
              tenant recolouring them would break that.
            </Banner>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Card
            title={<span className="row" style={{ gap: 7 }}><ServerIcon size={16} /> Deployment</span>}
            subtitle="Contractual — displayed, not editable"
            footnote="Changing a deployment mode or isolation tier is a migration with downtime, not a setting. It goes through your account team."
          >
            <dl className="kv">
              <dt>Mode</dt><dd>{MODE_LABEL[tenant.mode]}</dd>
              <dt>Isolation</dt><dd>{ISOLATION_LABEL[tenant.isolation]}</dd>
              <dt>Region</dt><dd>{tenant.region}</dd>
              <dt>Data residency</dt><dd>{tenant.region === "eu-central" ? "European Union" : tenant.region === "on-site" ? "Your own data centre" : "United States"}</dd>
              <dt>Encryption at rest</dt><dd>AES-256, tenant-scoped keys</dd>
              <dt>Encryption in transit</dt><dd>TLS 1.3, mutual TLS on integration endpoints</dd>
            </dl>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><ShieldIcon size={16} /> Privacy & retention</span>}>
            <Field label="Assessment retention" hint="How long a completed assessment and its explanation are kept. Shorter is not automatically safer — you need them for an accounting of disclosures.">
              <Select
                value={settings.assessmentRetention}
                onChange={(e) => { const v = e.currentTarget.value; void save({ assessmentRetention: v }, `Assessment retention set to ${v.replace("y", " years")}`).then(setToast); }}
              >
                <option value="2y">2 years</option>
                <option value="6y">6 years (matches the HIPAA documentation requirement)</option>
                <option value="10y">10 years</option>
              </Select>
            </Field>
            <Toggle
              checked={settings.patientPortalEnabled}
              onChange={(v) => toggle("patientPortalEnabled", v, "Patient access to released results")}
              label="Allow patients to see released results" hint="Turning this off removes the patient portal entirely for your tenant. Right-of-access requests then have to be served manually."
            />
            <Toggle
              checked={settings.benchmarkingOptIn}
              onChange={(v) => toggle("benchmarkingOptIn", v, "Aggregate benchmarking")}
              label="Allow de-identified data in aggregate benchmarking" hint="Contributes counts, never records, to the cross-hospital benchmark. No patient-level data leaves your tenant either way."
            />
            <Toggle
              checked={settings.allowEsapBreakGlass}
              onChange={(v) => toggle("allowEsapBreakGlass", v, "ESAP support break-glass")}
              label="Allow ESAP support to request break-glass access" hint="Off means nobody at ESAP can be granted access to a chart here under any circumstances — including to investigate a fault you have reported."
            />
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><GlobeIcon size={16} /> Interop identity</span>}>
            <dl className="kv">
              <dt>ESAP org ID</dt><dd className="mono">esap:org:st-yves</dd>
              <dt>QHIN</dt><dd>Connected via CommonHealth QHIN</dd>
              <dt>Directory listing</dt><dd>Published — other organisations can find you</dd>
              <dt>OID</dt><dd className="mono">2.16.840.1.113883.3.9921</dd>
            </dl>
          </Card>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
