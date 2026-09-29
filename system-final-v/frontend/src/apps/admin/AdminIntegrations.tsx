/**
 * 11.4.6 — Integrations. SSO, SMART on FHIR, ADT feed, SCIM.
 *
 * The IT admin's home. Each integration shows its live state rather than just
 * its configuration, because "configured" and "working" diverge constantly —
 * the Rivermead ADT stall in the incident feed is exactly that case.
 */
import { useState } from "react";
import { useSession, tenantFor } from "@/lib/session";
import { ago } from "@/lib/format";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, TextInput, Toggle } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { StatusPill } from "@/components/ui/domain";
import {
  ActivityIcon, AlertIcon, CheckIcon, GlobeIcon, KeyIcon, LinkIcon, RefreshIcon, ServerIcon, UsersIcon,
} from "@/components/ui/icons";
import { act } from "@/api/actions";
import { api } from "@/api/client";
import { useSettings } from "@/hooks/useSettings";

type IntegrationKey = "sso" | "scim" | "smart" | "adt" | "fhir" | "webhook";

/** What each integration is. Its state comes from the server's saved configuration and tests. */
const INTEGRATIONS: { key: IntegrationKey; name: string; what: string; detail: string; icon: JSX.Element }[] = [
  { key: "sso", name: "Single sign-on (OIDC / SAML)", what: "Staff sign in with their hospital identity",
    detail: "Signs staff in through your identity provider rather than a local password.", icon: <KeyIcon size={18} /> },
  { key: "scim", name: "SCIM provisioning", what: "Accounts are created and deactivated automatically",
    detail: "Users and groups sync from your directory; the role comes from the job-title mapping.", icon: <UsersIcon size={18} /> },
  { key: "smart", name: "SMART on FHIR launch", what: "ESAP opens inside the EHR with the patient in context",
    detail: "Registered with your EHR vendor; needs the client registration from your EHR team.", icon: <LinkIcon size={18} /> },
  { key: "adt", name: "HL7v2 ADT feed", what: "Admissions trigger an encounter automatically",
    detail: "A01/A02/A03 messages on MLLP. An A01 creates the encounter and sets t₀ from the admit timestamp.", icon: <ActivityIcon size={18} /> },
  { key: "fhir", name: "FHIR R4 read API", what: "ESAP pulls problem lists, medications and labs",
    detail: "Backend services auth, read-only scopes: Patient, Condition, MedicationRequest, Observation.", icon: <ServerIcon size={18} /> },
  { key: "webhook", name: "Outbound webhooks", what: "Assessment events pushed to your systems",
    detail: "Sends assessment.completed and result.acknowledged events to an endpoint you register.", icon: <GlobeIcon size={18} /> },
];

const STATUS_LABEL: Record<string, string> = {
  not_configured: "not configured", unverified: "configured, not verified", ok: "connected", error: "failing",
};

type Connection = {
  enabled: boolean;
  endpoint: string | null;
  status: string;
  lastTestedAt?: string;
  protocol?: string;
  auth?: string;
  port?: string;
  messageTypes?: string;
  clientId?: string;
};

type IntegrationSettings = Record<IntegrationKey, Connection> & {
  policy: { requireSso: boolean; t0FromAdmit: boolean; alertOnSilence: boolean; verifyTls: boolean };
};

const UNCONFIGURED: Connection = { enabled: false, endpoint: null, status: "not_configured" };

const DEFAULTS: IntegrationSettings = {
  sso: UNCONFIGURED, scim: UNCONFIGURED, smart: UNCONFIGURED,
  adt: UNCONFIGURED, fhir: UNCONFIGURED, webhook: UNCONFIGURED,
  policy: { requireSso: true, t0FromAdmit: true, alertOnSilence: true, verifyTls: true },
};

type Draft = { endpoint: string; protocol: string; auth: string; port: string; messageTypes: string; clientId: string };

function draftFrom(c: Connection, key: IntegrationKey): Draft {
  return {
    endpoint: c.endpoint ?? (key === "sso" ? "https://login.microsoftonline.example/styves/v2.0" : key === "adt" ? "adt-in.esap.styves.internal" : ""),
    protocol: c.protocol ?? "oidc",
    auth: c.auth ?? "client_credentials",
    port: c.port ?? "2575",
    messageTypes: c.messageTypes ?? "A01, A02, A03, A08",
    clientId: c.clientId ?? "",
  };
}

export function AdminIntegrations() {
  const { tenantId } = useSession();
  const tenant = tenantFor(tenantId);
  const [configuring, setConfiguring] = useState<IntegrationKey | null>(null);
  const [draft, setDraft] = useState<Draft>(draftFrom(UNCONFIGURED, "sso"));
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { settings, save, reload } = useSettings<IntegrationSettings>("integrations", DEFAULTS);

  const configured = INTEGRATIONS.filter((i) => settings[i.key].enabled).length;
  const notConfigured = INTEGRATIONS.length - configured;
  const lastTest = INTEGRATIONS.map((i) => settings[i.key].lastTestedAt).filter(Boolean).sort().at(-1);

  function openConfig(key: IntegrationKey) {
    setDraft(draftFrom(settings[key], key));
    setConfiguring(key);
  }

  /** Save what was typed in the dialog, not just an "enabled" flag. */
  function saveConfig() {
    const key = configuring;
    setConfiguring(null);
    if (!key) return;
    const patch: Partial<Connection> = { enabled: true, endpoint: draft.endpoint.trim() || null };
    if (key === "sso") Object.assign(patch, { protocol: draft.protocol, clientId: draft.clientId.trim() });
    else if (key === "adt") Object.assign(patch, { port: draft.port.trim(), messageTypes: draft.messageTypes.trim() });
    else Object.assign(patch, { auth: draft.auth });
    const name = INTEGRATIONS.find((i) => i.key === key)?.name ?? key;
    void save({ [key]: patch }, `${name} configuration saved`).then(setToast);
  }

  /** Test every connection, one request each, and report what the server found. */
  async function testAll() {
    setTesting(true);
    const message = await act(
      async () => {
        const results: string[] = [];
        for (const i of INTEGRATIONS) {
          const r = await api.post<{ status: string }>(`/api/v1/admin/integrations/${i.key}/test`);
          results.push(r.status);
        }
        return results;
      },
      (results) => {
        const counts = results.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
        return `Tested ${results.length} connections — ${Object.entries(counts).map(([s, n]) => `${n} ${s.replace("_", " ")}`).join(", ")}`;
      },
    );
    await reload();
    setTesting(false);
    setToast(message);
  }

  function setPolicy(key: keyof IntegrationSettings["policy"], value: boolean, label: string) {
    void save({ policy: { [key]: value } }, `${label}: ${value ? "on" : "off"}`).then(setToast);
  }

  return (
    <>
      <PageHeader
        eyebrow="IT admin"
        title="Integrations"
        lede="How ESAP connects to the rest of your estate. Each row shows what it is actually doing right now, not just whether someone configured it once."
        actions={<Button icon={<RefreshIcon size={15} />} disabled={testing} onClick={() => void testAll()}>{testing ? "Testing…" : "Test all connections"}</Button>}
      />

      <div className="grid grid-4">
        <StatTile label="Configured" value={configured} tone={configured ? "good" : "neutral"} icon={<CheckIcon size={15} />} />
        <StatTile label="Not yet configured" value={notConfigured} tone={notConfigured > 0 ? "warning" : "neutral"} />
        <StatTile label="Last connection test" value={lastTest ? ago(lastTest) : "never"} icon={<ActivityIcon size={15} />} hint="Run Test all connections to check every endpoint" />
        <StatTile label="Last ETL refresh" value={ago(tenant.lastEtlRefresh)} icon={<ServerIcon size={15} />} hint="Nightly cohort refresh from your data warehouse" />
      </div>

      <Banner tone="accent" title="ESAP reads; it does not write to your EHR">
        Every integration on this page is read-only against your systems except the outbound webhook,
        which pushes ESAP&rsquo;s own events. Nothing ESAP produces is written back into a patient record
        unless you explicitly build that yourself on the webhook.
      </Banner>

      <div className="grid grid-2">
        {INTEGRATIONS.map((i) => (
          <Card
            key={i.key}
            title={
              <span className="row" style={{ gap: 9 }}>
                <span className="intake-icon" style={{ width: 30, height: 30 }}>{i.icon}</span>
                {i.name}
              </span>
            }
            subtitle={i.what}
            actions={<StatusPill status={settings[i.key].status === "ok" ? "active" : settings[i.key].status === "error" ? "degraded" : "pending"} />}
            footnote={
              settings[i.key].lastTestedAt
                ? `Last test ${ago(settings[i.key].lastTestedAt!)}: ${STATUS_LABEL[settings[i.key].status] ?? settings[i.key].status}`
                : `${STATUS_LABEL[settings[i.key].status] ?? settings[i.key].status} · never tested`
            }
          >
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{i.detail}</p>
            {settings[i.key].endpoint && (
              <p className="muted mono" style={{ margin: 0, fontSize: 12 }}>Endpoint: {settings[i.key].endpoint}</p>
            )}
            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" onClick={() => openConfig(i.key)}>Configure</Button>
              {settings[i.key].enabled && <Button size="sm" variant="ghost" onClick={() => void act(() => api.post<{ status: string; detail: string }>(`/api/v1/admin/integrations/${i.key}/test`), (r) => `${i.name}: ${r.status} — ${r.detail}`).then(setToast)}>Test</Button>}
            </div>
          </Card>
        ))}
      </div>

      <Card title="What t₀ is derived from" subtitle="The single most important integration detail">
        <p className="prose" style={{ margin: 0 }}>
          t₀ — the cut every model respects — is taken from the <strong>admit timestamp on the A01 ADT
          message</strong>, not from when ESAP happened to receive it. If your interface engine buffers
          messages, a delayed A01 still produces a correct cut; a clock-skewed one does not. The audit
          log records both the admit time and the receipt time so a discrepancy is visible rather than
          silent.
        </p>
      </Card>

      <Modal
        open={configuring !== null}
        onClose={() => setConfiguring(null)}
        title={INTEGRATIONS.find((i) => i.key === configuring)?.name ?? ""}
        subtitle="Changes take effect at the next connection attempt"
        size="md"
        footer={
          <>
            <Button onClick={() => setConfiguring(null)}>Cancel</Button>
            <Button variant="primary" disabled={!draft.endpoint.trim()} onClick={saveConfig}>Save</Button>
          </>
        }
      >
        {configuring === "sso" && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Protocol" required>
              <Select value={draft.protocol} onChange={(e) => setDraft({ ...draft, protocol: e.currentTarget.value })}>
                <option value="oidc">OpenID Connect</option><option value="saml">SAML 2.0</option>
              </Select>
            </Field>
            <Field label="Issuer URL" required><TextInput value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.currentTarget.value })} /></Field>
            <Field label="Client ID" required><TextInput value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.currentTarget.value })} /></Field>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              The client secret is set in the deployment&rsquo;s secret store, never on this page, so it is not
              kept in settings or shown back to anyone.
            </p>
            <Toggle
              checked={settings.policy.requireSso}
              onChange={(v) => setPolicy("requireSso", v, "Require SSO for all clinical roles")}
              label="Require SSO for all clinical roles"
              hint="Local passwords remain available for break-glass administrative accounts only."
            />
          </div>
        )}
        {configuring === "adt" && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Listener host" required><TextInput value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.currentTarget.value })} /></Field>
            <Field label="Port" required><TextInput className="tnum" value={draft.port} onChange={(e) => setDraft({ ...draft, port: e.currentTarget.value })} /></Field>
            <Field label="Message types" hint="A01 creates an encounter, A02 updates the location, A03 closes it.">
              <TextInput value={draft.messageTypes} onChange={(e) => setDraft({ ...draft, messageTypes: e.currentTarget.value })} />
            </Field>
            <Toggle
              checked={settings.policy.t0FromAdmit}
              onChange={(v) => setPolicy("t0FromAdmit", v, "Derive t₀ from the admit timestamp")}
              label="Derive t₀ from the admit timestamp"
              hint="Strongly recommended. Using receipt time instead makes t₀ depend on your interface engine's queue depth."
            />
            <Banner tone="warning" icon={<AlertIcon size={16} />} title="A stalled feed is silent by default">
              Enable the stall alert below so a tunnel renegotiation does not quietly stop creating
              encounters — this is the most common integration failure we see.
            </Banner>
            <Toggle
              checked={settings.policy.alertOnSilence}
              onChange={(v) => setPolicy("alertOnSilence", v, "Stall alert")}
              label="Alert if no message is received for 60 minutes"
            />
          </div>
        )}
        {configuring !== "sso" && configuring !== "adt" && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Endpoint URL" required>
              <TextInput placeholder="https://…" value={draft.endpoint} onChange={(e) => setDraft({ ...draft, endpoint: e.currentTarget.value })} />
            </Field>
            <Field label="Authentication">
              <Select value={draft.auth} onChange={(e) => setDraft({ ...draft, auth: e.currentTarget.value })}>
                <option value="client_credentials">OAuth 2.0 client credentials</option>
                <option value="mtls">Mutual TLS</option>
                <option value="apikey">API key</option>
              </Select>
            </Field>
            <Toggle
              checked={settings.policy.verifyTls}
              onChange={(v) => setPolicy("verifyTls", v, "Verify TLS certificate chain")}
              label="Verify TLS certificate chain"
              hint="Turning this off is only ever appropriate against an internal test endpoint."
            />
            <div className="row" style={{ gap: 8 }}>
              <Badge tone="neutral">Read-only scope</Badge>
              <Badge tone="neutral">Tenant-scoped credentials</Badge>
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
