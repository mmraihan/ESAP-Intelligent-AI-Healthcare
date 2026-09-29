/**
 * 11.4.7 — Model & Display Settings.
 *
 * What a hospital may configure about the models: which run, where they appear,
 * which CCSR categories are suppressed, and what the clinician is told. What it
 * may NOT configure is also spelled out, because the boundary is the product:
 * a tenant cannot turn off a calibration badge or a degraded label.
 */
import { useEffect, useState } from "react";
import { MODELS, ALL_UNITS } from "@/mock/db";
import type { ModelId } from "@/mock/types";
import { Badge, Banner, Button, Card, Field, PageHeader, Select, Toggle } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { CalibratedBadge, FusionPill } from "@/components/ui/domain";
import { AlertIcon, FlaskIcon, LockIcon, PlusIcon, XIcon } from "@/components/ui/icons";
import { isLive } from "@/api/actions";
import { api } from "@/api/client";
import { useSettings } from "@/hooks/useSettings";

type Suppressed = { ccsr: string; name: string; why: string };

type ModelDisplay = {
  enabled: Record<ModelId, boolean>;
  unitOverrides: Record<string, ModelId[]>;
  suppressedCategories: Suppressed[];
  differentialTopN: number;
  readmissionAlertThreshold: number;
  showFamilySwatch: boolean;
  showUnscoredCount: boolean;
  flagUnconfirmed: boolean;
};

const DEFAULTS: ModelDisplay = {
  enabled: { "M-01": true, "M-02": true, "M-03": true, "M-04": true, "M-05": true },
  unitOverrides: { u_micu: ["M-03"] },
  suppressedCategories: [],
  differentialTopN: 20,
  readmissionAlertThreshold: 0.28,
  showFamilySwatch: true,
  showUnscoredCount: true,
  flagUnconfirmed: true,
};

type CcsrEntry = { ccsr: string; description: string; family: string };

export function AdminModels() {
  const { settings, save } = useSettings<ModelDisplay>("model_display", DEFAULTS);
  const [addSuppress, setAddSuppress] = useState(false);
  const [catalog, setCatalog] = useState<CcsrEntry[]>([]);
  const [pick, setPick] = useState({ ccsr: "", why: "" });
  const [toast, setToast] = useState<string | null>(null);

  const enabled = settings.enabled;
  const unitOverride = settings.unitOverrides;
  const suppressed = settings.suppressedCategories;

  // The condition picker is the server's CCSR catalogue, not a typed guess.
  useEffect(() => {
    if (!addSuppress || catalog.length || !isLive()) return;
    api.get<{ ccsr: CcsrEntry[] }>("/api/v1/schema/ccsr").then((r) => setCatalog(r.ccsr)).catch(() => undefined);
  }, [addSuppress, catalog.length]);

  const choosable = catalog.filter((c) => !suppressed.some((s) => s.ccsr === c.ccsr));

  function suppress() {
    const entry = catalog.find((c) => c.ccsr === pick.ccsr);
    setAddSuppress(false);
    if (!entry) return;
    const next = [...suppressed, { ccsr: entry.ccsr, name: entry.description, why: pick.why.trim() }];
    setPick({ ccsr: "", why: "" });
    void save({ suppressedCategories: next }, `${entry.description} suppressed`).then(setToast);
  }

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Model & display settings"
        lede="What runs here, where it appears, and what your clinicians are shown. Anything that would hide a model's limitations is deliberately not configurable."
      />

      <Banner tone="accent" icon={<LockIcon size={16} />} title="Three things you cannot turn off">
        The calibration badge, the degraded-model label, and the &ldquo;decision support, not
        diagnosis&rdquo; line. They are not preferences — they are what keeps this product
        non-device clinical decision support, and a tenant switch for them would defeat the purpose.
      </Banner>

      <Card title="Which models run in this tenant" subtitle="Turning one off removes it from every clinical screen here">
        {MODELS.map((m) => (
          <div key={m.id} className="flag-row">
            <div className="flag-meta">
              <strong>
                {m.id} — {m.name}{" "}
                {m.status === "degraded" && <Badge tone="warning" icon={<AlertIcon size={11} />}>degraded</Badge>}
              </strong>
              <span>{m.outcome} · version {m.version} · {m.headline[0].label} {m.headline[0].value}</span>
              {m.status === "degraded" && (
                <span className="flag-key">
                  Weakest stratum: {m.strata[1].label} — {m.strata[1].metric} {m.strata[1].value.toFixed(3)}
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <FusionPill status={m.fusion} />
              <CalibratedBadge calibrated={m.ece < 0.05} />
              <Toggle
                checked={enabled[m.id] ?? true}
                onChange={(v) => void save({ enabled: { [m.id]: v } }, `${m.id} ${v ? "enabled" : "disabled"} for this tenant`).then(setToast)}
                label={<span className="visually-hidden">Enable {m.id}</span>}
              />
            </div>
          </div>
        ))}
      </Card>

      <div className="split">
        <Card
          title="Per-unit overrides"
          subtitle="Suppress a model where it is not meaningful"
          footnote="A suppressed model is shown to clinicians as suppressed by hospital policy, with the reason. It is never silently missing — a clinician who expects a number and finds a gap will assume a fault."
        >
          {ALL_UNITS.map((u) => (
            <div key={u.id} className="flag-row">
              <div className="flag-meta">
                <strong>{u.name}</strong>
                <span>{u.serviceLine} · {u.beds} beds</span>
              </div>
              <Select
                value={unitOverride[u.id]?.[0] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void save({ unitOverrides: { [u.id]: v ? [v] : [] } },
                    v ? `${v} suppressed on ${u.name}` : `All models restored on ${u.name}`).then(setToast);
                }}
                aria-label={`Suppress a model on ${u.name}`}
              >
                <option value="">All models shown</option>
                {MODELS.map((m) => <option key={m.id} value={m.id}>Suppress {m.id}</option>)}
              </Select>
            </div>
          ))}
          <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
            The common case is suppressing M-03 in the ICU — an ICU-admission estimate for a patient
            already in the ICU is noise, and noise costs attention.
          </p>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Differential display" subtitle="M-01 presentation">
            <Field label="Conditions shown" hint="How many CCSR categories appear on the results card. The model always scores all ~502; this controls what is displayed.">
              <Select
                value={String(settings.differentialTopN)}
                onChange={(e) => { const n = Number(e.target.value); void save({ differentialTopN: n }, `Differential shows the top ${n}`).then(setToast); }}
              >
                {["5", "10", "20", "30"].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </Select>
            </Field>
            <Toggle
              checked={settings.showFamilySwatch}
              onChange={(v) => void save({ showFamilySwatch: v }, `Family swatch ${v ? "shown" : "hidden"}`).then(setToast)}
              label="Show the CCSR family swatch" hint="A small colour dot beside each condition, always paired with the family name in text."
            />
            <Toggle
              checked={settings.showUnscoredCount}
              onChange={(v) => void save({ showUnscoredCount: v }, `Unscored-category count ${v ? "shown" : "hidden"}`).then(setToast)}
              label="Show unscored-category count" hint="Tells the clinician how many categories could not be scored for this patient rather than implying they were all considered."
            />
            <Toggle
              checked={settings.flagUnconfirmed}
              onChange={(v) => void save({ flagUnconfirmed: v }, `Unconfirmed-extraction flag ${v ? "on" : "off"}`).then(setToast)}
              label="Flag conditions from unconfirmed extraction" hint="Marks anything derived from free text that a clinician has not confirmed."
            />
          </Card>

          <Card
            title="Suppressed categories"
            subtitle={`${suppressed.length} CCSR categories never surfaced here`}
            actions={<Button size="sm" icon={<PlusIcon size={13} />} onClick={() => setAddSuppress(true)}>Add</Button>}
            footnote="Suppression is a site policy decision and usually comes from an ethics or clinical governance committee. The reason is stored with it so a future administrator knows why."
          >
            {suppressed.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing is suppressed. All scored categories are eligible to appear.</p>
            ) : (
              suppressed.map((s) => (
                <div key={s.ccsr} className="flag-row">
                  <div className="flag-meta">
                    <strong>{s.name}</strong>
                    <span>{s.why}</span>
                    <span className="flag-key">{s.ccsr}</span>
                  </div>
                  <Button size="sm" variant="ghost" icon={<XIcon size={13} />} onClick={() => void save({ suppressedCategories: suppressed.filter((x) => x.ccsr !== s.ccsr) }, `${s.name} is no longer suppressed`).then(setToast)}>
                    Remove
                  </Button>
                </div>
              ))
            )}
          </Card>

          <Card title="Alert thresholds" subtitle="Where a flag appears on a result">
            <Field label="M-04 readmission flag" hint="Above this, the result carries an 'above alert threshold' marker. Set it from your care-management capacity, not from the model.">
              <Select
                value={String(settings.readmissionAlertThreshold)}
                onChange={(e) => { const v = Number(e.target.value); void save({ readmissionAlertThreshold: v }, `M-04 alert threshold set to ${v}`).then(setToast); }}
              >
                <option value="0.2">Top 20% — more flags, more noise</option>
                <option value="0.28">Top decile (0.28) — matches current capacity</option>
                <option value="0.4">Top 5% — fewest flags</option>
              </Select>
            </Field>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
              An alert budget is a staffing decision. Flagging more patients than your care-management
              team can act on trains people to ignore the flag, which is worse than not flagging at all.
            </p>
          </Card>
        </div>
      </div>

      <Card title={<span className="row" style={{ gap: 7 }}><FlaskIcon size={16} /> Model version pinning</span>} subtitle="Enterprise plans only">
        <p className="prose" style={{ margin: 0 }}>
          Your plan allows pinning a specific model version so a platform-side rollout does not change
          behaviour mid-study. Pinning is requested through your account team and appears in the ops
          console&rsquo;s rollout view. A pinned tenant is excluded from canary traffic entirely — it
          does not get a share of it.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {MODELS.map((m) => <Badge key={m.id} tone="neutral">{m.id} pinned to {m.version}</Badge>)}
        </div>
      </Card>

      <Modal
        open={addSuppress}
        onClose={() => setAddSuppress(false)}
        title="Suppress a condition category"
        subtitle="It will never appear on a differential in this tenant"
        footer={
          <>
            <Button onClick={() => setAddSuppress(false)}>Cancel</Button>
            <Button variant="primary" disabled={!pick.ccsr || pick.why.trim().length < 5} onClick={suppress}>Suppress</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Field label="Condition category" required hint={catalog.length ? `${choosable.length} categories from the server's CCSR catalogue` : "Loading the CCSR catalogue…"}>
            <Select value={pick.ccsr} onChange={(e) => setPick({ ...pick, ccsr: e.currentTarget.value })}>
              <option value="">Choose a category</option>
              {choosable.map((c) => <option key={c.ccsr} value={c.ccsr}>{c.ccsr} — {c.description} ({c.family})</option>)}
            </Select>
          </Field>
          <Field label="Reason" required hint="Recorded with the suppression. A future administrator needs to know why this was done.">
            <textarea className="input" rows={3} placeholder="Raised by the clinical ethics committee on…" value={pick.why} onChange={(e) => setPick({ ...pick, why: e.target.value })} />
          </Field>
          <Banner tone="warning" title="Suppression does not change the model">
            The category is still scored and still influences the ranking of everything else. It is
            removed from the display only. If you need it excluded from the model itself, that is a
            platform-side change and goes through your account team.
          </Banner>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
