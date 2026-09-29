/**
 * 11.5.5 — Global config. Feature flags, taxonomy version, subprocessors.
 *
 * Platform-wide switches. Two categories are visually separated because they
 * behave differently: flags that can be flipped, and facts that are contractual
 * (the subprocessor register, the CCSR taxonomy version) where the screen's job
 * is disclosure rather than control.
 */
import { useEffect, useState } from "react";
import { TENANTS } from "@/mock/db";
import { dateLabel } from "@/lib/format";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, StatTile, Tabs, TextArea, TextInput, Toggle } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { AlertIcon, GlobeIcon, LockIcon, ServerIcon, ShieldIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { useSettings } from "@/hooks/useSettings";

type Review = { id: string; detail: string; ref: string | null; requestedAt: string; requestedBy: string; status: string };

type FlagKey =
  | "towerB" | "nextBestTest" | "patientPortal" | "tefca" | "chatExtraction"
  | "autoRollback" | "selfServeSignup" | "benchmarking";

const FLAGS: { key: FlagKey; name: string; what: string; risk: "low" | "medium" | "high"; default: boolean }[] = [
  { key: "towerB", name: "Tower B note embeddings", what: "Adds the note-embedding tower to M-01 fusion. Increases GPU contention with the extraction LLM.", risk: "high", default: false },
  { key: "nextBestTest", name: "Next-best-test (value of information)", what: "Computes which single missing input would most reduce uncertainty. Designed but not validated — the panel renders empty until it is.", risk: "high", default: false },
  { key: "patientPortal", name: "Patient portal", what: "Enables the patient-facing surface for tenants who opt in. Patients only ever see clinician-released content.", risk: "medium", default: true },
  { key: "tefca", name: "TEFCA / QHIN connectivity", what: "Cross-organisation record retrieval through a QHIN. Professional tier and above.", risk: "medium", default: true },
  { key: "chatExtraction", name: "Conversational intake extraction", what: "Lets clinicians dictate an admission and have fields proposed. Every extracted field arrives unconfirmed.", risk: "medium", default: true },
  { key: "autoRollback", name: "Automatic canary rollback", what: "Pulls a canary version without human involvement when stratified ECE crosses 0.05.", risk: "low", default: true },
  { key: "selfServeSignup", name: "Individual self-serve signup", what: "Public signup for the solo-clinician tier, including the capacity attestation.", risk: "low", default: true },
  { key: "benchmarking", name: "Cross-tenant benchmarking", what: "Aggregates counts — never records — so a hospital can compare adoption against the fleet.", risk: "medium", default: true },
];

type Subprocessor = { name: string; purpose: string; region: string; phi: boolean; since: string };

export function OpsConfig() {
  const [tab, setTab] = useState<"flags" | "taxonomy" | "subprocessors">("flags");
  const { settings: flags, save: saveFlags } = useSettings<Record<string, boolean>>(
    "global_flags", Object.fromEntries(FLAGS.map((f) => [f.key, f.default])),
  );
  // The published register, from the server's settings.
  const { settings: register } = useSettings<{ entries: Subprocessor[] }>("subprocessors", { entries: [] });
  const SUBPROCESSORS = register.entries;
  const [gpu, setGpu] = useState<{ gpu_pool: number; gpu_shared_with: string } | null>(null);
  useEffect(() => {
    if (!isLive()) return;
    api.get<{ infrastructure?: { gpu_pool: number; gpu_shared_with: string } }>("/api/v1/ops/config")
      .then((r) => setGpu(r.infrastructure ?? null)).catch(() => undefined);
  }, []);
  const [confirming, setConfirming] = useState<{ flag: (typeof FLAGS)[number]; next: boolean } | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagConfirmWord, setFlagConfirmWord] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [review, setReview] = useState<{ vendor: string; purpose: string; phi: boolean } | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  function loadReviews() {
    if (!isLive()) return;
    api.get<{ requests: Review[] }>("/api/v1/requests?kind=subprocessor_review")
      .then((r) => setReviews(r.requests)).catch(() => undefined);
  }
  useEffect(loadReviews, []);

  function setFlag(f: (typeof FLAGS)[number], v: boolean, reason: string) {
    void saveFlags({ [f.key]: v }, `${f.name} ${v ? "enabled" : "disabled"} platform-wide`, reason).then(setToast);
  }

  function startReview() {
    const r = review;
    setReview(null);
    if (!r) return;
    void act(
      () => api.post("/api/v1/requests", {
        kind: "subprocessor_review",
        ref: r.vendor.trim(),
        detail: `${r.purpose.trim()}${r.phi ? " — will process PHI (BAA required)" : " — no PHI"}`,
      }),
      () => `Review opened for ${r.vendor.trim()} — customers are notified before it goes live`,
    ).then((m) => { setToast(m); loadReviews(); });
  }

  const activeTenants = TENANTS.filter((t) => t.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Platform operations"
        title="Global config"
        lede="Platform-wide switches and disclosures. A flag here changes behaviour for every tenant at once, which is why the high-risk ones need a typed confirmation."
        meta={<Badge tone="warning">Affects {activeTenants} active tenants</Badge>}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "flags", label: "Feature flags", count: FLAGS.length },
          { value: "taxonomy", label: "Taxonomy & versions" },
          { value: "subprocessors", label: "Subprocessors", count: SUBPROCESSORS.length },
        ]}
      />

      {tab === "flags" && (
        <>
          <Banner tone="warning" icon={<AlertIcon size={16} />} title="These apply to every tenant simultaneously">
            There is no gradual rollout on this screen — that is what the model rollout console is for.
            A flag flipped here is on everywhere at the next request.
          </Banner>

          <Card title="Feature flags">
            {FLAGS.map((f) => (
              <div key={f.key} className="flag-row">
                <div className="flag-meta">
                  <strong>
                    {f.name}{" "}
                    {f.risk === "high" && <Badge tone="critical">high risk</Badge>}
                    {f.risk === "medium" && <Badge tone="warning">medium risk</Badge>}
                  </strong>
                  <span>{f.what}</span>
                  <span className="flag-key">{f.key}</span>
                </div>
                <Toggle
                  checked={flags[f.key]}
                  onChange={(v) => { setFlagReason(""); setFlagConfirmWord(""); setConfirming({ flag: f, next: v }); }}
                  label={<span className="visually-hidden">{f.name}</span>}
                />
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === "taxonomy" && (
        <div className="split">
          <Card
            title="Clinical taxonomy"
            subtitle="Changing a taxonomy version is a retraining event, not a config change"
            footnote="A CCSR version bump remaps condition categories. Estimates produced before and after are not directly comparable, and the results history screen shows which taxonomy each run used."
          >
            <Field label="CCSR version" hint="The condition taxonomy M-01 scores against.">
              <Select defaultValue="2025.1" disabled>
                <option value="2025.1">CCSR v2025.1 (502 categories)</option>
                <option value="2024.1">CCSR v2024.1 (498 categories)</option>
              </Select>
            </Field>
            <Field label="ICD-10-CM edition" hint="Source coding system the CCSR mapping is built from.">
              <Select defaultValue="fy2026" disabled>
                <option value="fy2026">FY2026</option>
                <option value="fy2025">FY2025</option>
              </Select>
            </Field>
            <Banner tone="accent" icon={<LockIcon size={16} />} title="Read-only from this console">
              A taxonomy change requires retraining, revalidation and a fairness re-audit before it can
              be deployed. It goes through the model pipeline, not through a dropdown.
            </Banner>
          </Card>

          <div className="stack" style={{ gap: 16 }}>
            <Card title="Platform versions">
              <dl className="kv">
                <dt>API schema</dt><dd className="mono">v1.4.0</dd>
                <dt>Serving runtime</dt><dd className="mono">2026.09.2</dd>
                <dt>Explanation method</dt><dd>exact-linear (M-01), marginal-occlusion (M-02 – M-05)</dd>
                <dt>Calibration</dt><dd>Per-label isotonic; conformal for M-05</dd>
                <dt>Feature cut</dt><dd>t₀ = admittime, enforced at the data layer</dd>
              </dl>
            </Card>

            <Card title={<span className="row" style={{ gap: 7 }}><ServerIcon size={16} /> Compute</span>}>
              <div className="grid grid-2">
                <StatTile label="GPU pool" value={gpu ? String(gpu.gpu_pool) : "—"} unit={gpu ? "shared" : undefined} hint={gpu ? `Also serves ${gpu.gpu_shared_with}` : "Loading…"} />
                <StatTile label="Free VRAM" value="~4" unit="GB" tone="warning" hint="Feature matrices stay sparse by necessity" />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                Capacity is the binding constraint on enabling Tower B. Turning it on without adding a
                device trades differential quality for assessment latency across the whole fleet.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === "subprocessors" && (
        <>
          <Banner tone="accent" icon={<GlobeIcon size={16} />} title="This register is contractual">
            Customers are entitled to notice before a new subprocessor with PHI access is added. Adding
            one starts that notice period; it is not a switch that takes effect immediately.
          </Banner>

          <Card title="Subprocessor register" subtitle="Published to every tenant's privacy officer" padded={false}>
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr><th>Subprocessor</th><th>Purpose</th><th>Region</th><th>PHI access</th><th>Since</th></tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.name}>
                      <td><strong>{s.name}</strong></td>
                      <td className="muted">{s.purpose}</td>
                      <td>{s.region}</td>
                      <td>
                        <span className={s.phi ? "pill pill-warning" : "pill pill-good"}>
                          {s.phi ? <ShieldIcon size={12} /> : <LockIcon size={12} />}
                          {s.phi ? "Yes — under BAA" : "No"}
                        </span>
                      </td>
                      <td className="muted">{dateLabel(s.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Adding a subprocessor" subtitle="What the process requires">
            <ol className="run-steps">
              <li>Security review and, where PHI is involved, an executed business associate agreement.</li>
              <li>Data protection impact assessment for any EU-resident tenant.</li>
              <li>30 days&rsquo; notice to every customer before the subprocessor goes live.</li>
              <li>Customers with an objection right may exercise it during that window.</li>
              <li>The register updates publicly, and the change is written to the platform audit log.</li>
            </ol>
            <Button onClick={() => setReview({ vendor: "", purpose: "", phi: false })}>Start a subprocessor review</Button>
            {reviews.length > 0 && (
              <ul className="watch-list">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <div style={{ flex: 1 }}>
                      <strong>{r.ref ?? "Subprocessor"}</strong>
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: 11.5 }}>{r.detail} · opened by {r.requestedBy} · {dateLabel(r.requestedAt)}</p>
                    </div>
                    <Badge tone="warning">{r.status === "open" ? "in review" : r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`${confirming?.next ? "Enable" : "Disable"} a flag platform-wide`}
        subtitle="This applies to every tenant at their next request — a written reason is not optional for a platform-wide change."
        footer={
          <>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              variant={confirming?.flag.risk === "high" && confirming.next ? "danger" : "primary"}
              disabled={!flagReason.trim() || (confirming?.flag.risk === "high" && confirming.next && flagConfirmWord.trim() !== confirming.flag.key)}
              onClick={() => {
                if (confirming) setFlag(confirming.flag, confirming.next, flagReason.trim());
                setConfirming(null);
              }}
            >
              {confirming?.next ? "Enable everywhere" : "Disable everywhere"}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <p style={{ margin: 0 }}>
            You are {confirming?.next ? "enabling" : "disabling"} <strong>{confirming?.flag.name}</strong> for every
            tenant at once. {activeTenants} active tenants are affected at their next request.
          </p>
          {confirming?.flag.risk === "high" && confirming.next && (
            <ul className="consequence-list">
              <li>
                {confirming.flag.key === "towerB"
                  ? "Tower B shares the single GPU with the extraction LLM. Expect assessment latency to rise fleet-wide."
                  : "This capability is designed but not clinically validated. It must not present as a recommendation until it is."}
              </li>
              <li>The change and your identity go to the platform audit log immediately.</li>
            </ul>
          )}
          <Field label="Reason" required hint="Written for whoever asks 'who turned this on and why' — the audit log shows exactly this text.">
            <TextArea rows={2} value={flagReason} onChange={(e) => setFlagReason(e.currentTarget.value)} />
          </Field>
          {confirming?.flag.risk === "high" && confirming.next && (
            <Field label={`Type "${confirming.flag.key}" to confirm`} required>
              <TextInput value={flagConfirmWord} onChange={(e) => setFlagConfirmWord(e.currentTarget.value)} />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={review !== null}
        onClose={() => setReview(null)}
        title="Start a subprocessor review"
        subtitle="Opens the review. Nothing goes live until it completes and customers have had notice."
        footer={
          <>
            <Button onClick={() => setReview(null)}>Cancel</Button>
            <Button variant="primary" disabled={!review || review.vendor.trim().length < 2 || !review.purpose.trim()} onClick={startReview}>Open review</Button>
          </>
        }
      >
        {review && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Vendor" required><TextInput placeholder="Acme Transcription Ltd" value={review.vendor} onChange={(e) => setReview({ ...review, vendor: e.currentTarget.value })} /></Field>
            <Field label="What it would do" required>
              <TextArea rows={3} value={review.purpose} onChange={(e) => setReview({ ...review, purpose: e.currentTarget.value })} />
            </Field>
            <Toggle checked={review.phi} onChange={(v) => setReview({ ...review, phi: v })} label="It would process patient data" hint="Requires an executed business associate agreement before anything else." />
          </div>
        )}
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
