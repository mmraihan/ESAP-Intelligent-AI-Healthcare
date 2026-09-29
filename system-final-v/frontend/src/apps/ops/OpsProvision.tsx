/**
 * 11.5.2 — Provisioning wizard (§5.6).
 *
 * Standing up a new hospital. The order matters: isolation tier and residency
 * are chosen before anything is created, because both are migrations rather
 * than settings once data exists. The wizard says so at the point of choice.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLANS } from "@/mock/db";
import { ISOLATION_LABEL, MODE_LABEL } from "@/components/ui/domain";
import type { DeploymentMode, IsolationTier, PlanTier } from "@/mock/types";
import {
  Badge, Banner, Button, Card, Field, PageHeader, Select, TextInput, Toggle, cx,
} from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { AlertIcon, CheckIcon, LockIcon, ServerIcon } from "@/components/ui/icons";
import { api, ApiError } from "@/api/client";
import { hydrateFromApi } from "@/api/bootstrap";

type StepKey = "org" | "deployment" | "plan" | "admin" | "integrations" | "review";

const STEPS: { key: StepKey; title: string; hint: string }[] = [
  { key: "org", title: "Organisation", hint: "Name, slug, contact" },
  { key: "deployment", title: "Deployment", hint: "Mode, isolation, residency" },
  { key: "plan", title: "Plan", hint: "Tier, beds, allowance" },
  { key: "admin", title: "First administrator", hint: "Who gets the keys" },
  { key: "integrations", title: "Integrations", hint: "SSO, ADT, FHIR" },
  { key: "review", title: "Review & create", hint: "Nothing exists until this step" },
];

export function OpsProvision() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", contact: "",
    mode: "saas" as DeploymentMode,
    isolation: "schema_per_tenant" as IsolationTier,
    region: "us-east",
    plan: "professional" as PlanTier,
    beds: "250",
    allowance: "10000",
    adminName: "", adminEmail: "",
    sso: true, adt: true, fhir: true, tefca: false,
  });

  const key = STEPS[step].key;
  const complete = (i: number) => i < step;
  const canAdvance =
    key === "org" ? Boolean(form.name && form.slug && form.contact)
    : key === "admin" ? Boolean(form.adminName && form.adminEmail)
    : true;

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Provision a tenant"
        lede="Standing up a new hospital. Nothing is created until the final step — everything before it is a form."
      />

      <div className="wizard">
        <ul className="wizard-steps">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className={cx("wizard-step", i === step && "is-active", complete(i) && "is-done")}
                onClick={() => setStep(i)}
              >
                <span className="wizard-step-num">{complete(i) ? <CheckIcon size={12} /> : i + 1}</span>
                <span className="wizard-step-text">
                  <strong>{s.title}</strong>
                  <span>{s.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="stack" style={{ gap: 18 }}>
          {key === "org" && (
            <Card title="Organisation" subtitle="How this hospital is identified everywhere in the platform">
              <Field label="Legal organisation name" required>
                <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} placeholder="Calder Regional Medical Center" />
              </Field>
              <Field label="Tenant slug" required hint="Becomes their console subdomain and appears in every audit record. It cannot be changed after data exists.">
                <TextInput value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="calder-regional" className="mono" />
              </Field>
              <Field label="Primary contact email" required hint="The person who will receive the first administrator invite.">
                <TextInput type="email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="cmio@calder.example" />
              </Field>
            </Card>
          )}

          {key === "deployment" && (
            <>
              <Banner tone="warning" icon={<AlertIcon size={16} />} title="These two choices are migrations, not settings">
                Isolation tier and data residency are fixed once the tenant holds data. Changing either
                later means a scheduled migration with downtime. Choose them against the contract, not
                against convenience.
              </Banner>
              <Card title="Deployment" subtitle="Where and how this tenant runs">
                <Field label="Mode" required>
                  <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as DeploymentMode })}>
                    {(Object.keys(MODE_LABEL) as DeploymentMode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                  </Select>
                </Field>
                <Field label="Isolation tier" required hint="Shared row-level security is a policy boundary; the higher tiers are physical ones. Anything with a negotiated BAA usually wants database-per-tenant or above.">
                  <Select value={form.isolation} onChange={(e) => setForm({ ...form, isolation: e.target.value as IsolationTier })}>
                    {(Object.keys(ISOLATION_LABEL) as IsolationTier[]).map((i) => <option key={i} value={i}>{ISOLATION_LABEL[i]}</option>)}
                  </Select>
                </Field>
                <Field label="Region / data residency" required>
                  <Select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                    <option value="us-east">US East</option>
                    <option value="us-west">US West</option>
                    <option value="eu-central">EU Central (GDPR)</option>
                    <option value="on-site">On-site (customer data centre)</option>
                  </Select>
                </Field>
                {form.region === "eu-central" && (
                  <Banner tone="accent" title="EU residency enables the GDPR surface">
                    Data-subject access, erasure and portability workflows are switched on, and the
                    subprocessor register is exposed to their privacy officer.
                  </Banner>
                )}
              </Card>
            </>
          )}

          {key === "plan" && (
            <Card title="Plan" subtitle="What they are contracted for">
              <Field label="Tier" required>
                <Select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as PlanTier })}>
                  {PLANS.filter((p) => !["free", "pro"].includes(p.tier)).map((p) => (
                    <option key={p.tier} value={p.tier}>{p.name} — {p.priceLabel} {p.unit}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Licensed beds" required hint="The primary metered unit on hospital plans.">
                <TextInput type="number" className="tnum" value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} />
              </Field>
              <Field label="Included assessments per cycle" hint="Set this from their expected admission volume with headroom. An unexpected overage invoice is the fastest way to have a clinical tool switched off.">
                <TextInput type="number" className="tnum" value={form.allowance} onChange={(e) => setForm({ ...form, allowance: e.target.value })} />
              </Field>
              {PLANS.find((p) => p.tier === form.plan) && (
                <div className="plan-limits">
                  {PLANS.find((p) => p.tier === form.plan)!.limits.map((l) => (
                    <div key={l.label}><span>{l.label}</span><strong>{l.value}</strong></div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {key === "admin" && (
            <Card title="First administrator" subtitle="The only account ESAP creates directly">
              <Field label="Name" required><TextInput value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="Dr. Elin Bergström" /></Field>
              <Field label="Email" required><TextInput type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="cmio@calder.example" /></Field>
              <Banner tone="accent" icon={<LockIcon size={16} />} title="This account can grant clinical roles">
                The first administrator holds the ability to grant clinical roles in this tenant. They
                set their credential, or sign in through the hospital&rsquo;s SSO, when they accept.
              </Banner>
              <p className="muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.6 }}>
                Every other account in this tenant is created by them, not by you. ESAP does not
                provision clinicians into a customer&rsquo;s hospital.
              </p>
            </Card>
          )}

          {key === "integrations" && (
            <Card title="Integrations to enable" subtitle="They configure the endpoints themselves afterwards">
              <Toggle checked={form.sso} onChange={(v) => setForm({ ...form, sso: v })} label="Single sign-on (OIDC / SAML)" hint="Strongly recommended. Local passwords in a hospital become shared passwords." />
              <Toggle checked={form.adt} onChange={(v) => setForm({ ...form, adt: v })} label="HL7v2 ADT feed" hint="Creates encounters automatically on admission and sets t₀ from the admit timestamp." />
              <Toggle checked={form.fhir} onChange={(v) => setForm({ ...form, fhir: v })} label="FHIR R4 read access" hint="Pulls problem lists, medications and labs. Without it, intake is entirely manual." />
              <Toggle checked={form.tefca} onChange={(v) => setForm({ ...form, tefca: v })} label="TEFCA / QHIN connectivity" hint="Cross-organisation record retrieval. Professional tier and above." />
            </Card>
          )}

          {key === "review" && (
            <>
              <Card title="Review" subtitle="Nothing has been created yet">
                <dl className="kv">
                  <dt>Organisation</dt><dd>{form.name || <span className="muted">not set</span>}</dd>
                  <dt>Slug</dt><dd className="mono">{form.slug || "—"}</dd>
                  <dt>Mode</dt><dd>{MODE_LABEL[form.mode]}</dd>
                  <dt>Isolation</dt><dd>{ISOLATION_LABEL[form.isolation]}</dd>
                  <dt>Region</dt><dd>{form.region}</dd>
                  <dt>Plan</dt><dd>{PLANS.find((p) => p.tier === form.plan)?.name}</dd>
                  <dt>Beds</dt><dd className="tnum">{form.beds}</dd>
                  <dt>Assessment allowance</dt><dd className="tnum">{form.allowance} per cycle</dd>
                  <dt>First admin</dt><dd>{form.adminName || <span className="muted">not set</span>} · {form.adminEmail || "—"}</dd>
                  <dt>Integrations</dt>
                  <dd className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {form.sso && <Badge tone="neutral">SSO</Badge>}
                    {form.adt && <Badge tone="neutral">ADT</Badge>}
                    {form.fhir && <Badge tone="neutral">FHIR</Badge>}
                    {form.tefca && <Badge tone="neutral">TEFCA</Badge>}
                  </dd>
                </dl>
              </Card>

              <Card title={<span className="row" style={{ gap: 7 }}><ServerIcon size={16} /> What happens on create</span>}>
                <ol className="run-steps">
                  <li>The isolation boundary is provisioned — schema, database or VPC depending on the tier.</li>
                  <li>Tenant-scoped encryption keys are generated. ESAP staff never hold them in plaintext.</li>
                  <li>The plan and its limits are written to the control plane.</li>
                  <li>An invite goes to the first administrator.</li>
                  <li>The tenant is created in <strong>pending</strong> state and does not accept clinical traffic until they complete onboarding.</li>
                  <li>The whole operation is written to the platform audit log under your name.</li>
                </ol>
              </Card>
            </>
          )}

          <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
            <Button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
            {key === "review" ? (
              <Button
                variant="primary"
                disabled={!form.name || !form.adminEmail}
                onClick={async () => {
                  setToast("Provisioning…");
                  try {
                    const res = await api.post<{ name: string; adminInvite?: { acceptPath?: string } }>(
                      "/api/v1/ops/tenants",
                      {
                        name: form.name, slug: form.slug, mode: form.mode,
                        plan: form.plan, region: form.region, isolation: form.isolation,
                        beds: Number(form.beds) || 0, seats: 25, contact: form.contact,
                        admin_email: form.adminEmail, admin_name: form.adminName,
                      },
                    );
                    // NB: do NOT hydrateFromApi() here — it bumps the data
                    // version and remounts this screen, which would wipe the
                    // invite link we are about to show. The fleet is refreshed
                    // when the user navigates to it below.
                    const path = res.adminInvite?.acceptPath;
                    setInviteLink(path ? `${window.location.origin}${path}` : null);
                    setToast(`${form.name} provisioned.` +
                      (path ? " Send the admin invite link below to the first administrator." : ""));
                  } catch (err) {
                    setToast(err instanceof ApiError ? err.message : "Could not provision the tenant.");
                  }
                }}
              >
                Create tenant
              </Button>
            ) : (
              <Button variant="primary" disabled={!canAdvance} onClick={() => setStep(step + 1)}>Continue</Button>
            )}
          </div>

          {inviteLink && (
            <Card title="First administrator invite" subtitle="Send this link to the hospital's admin. They set a password and can then invite the rest of the staff.">
              <p className="mono" style={{ wordBreak: "break-all", fontSize: 12.5, background: "var(--surface-2)", padding: "8px 10px", borderRadius: 8 }}>
                {inviteLink}
              </p>
              <div className="row" style={{ gap: 10 }}>
                <Button size="sm" onClick={() => { void navigator.clipboard?.writeText(inviteLink).catch(() => undefined); setToast("Invite link copied."); }}>
                  Copy link
                </Button>
                <Button size="sm" variant="primary" onClick={() => nav(new URL(inviteLink).pathname)}>
                  Open invite
                </Button>
                <Button size="sm" onClick={() => { void hydrateFromApi().catch(() => undefined).then(() => nav("/ops/fleet")); }}>Go to fleet</Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
