/**
 * The design system, rendered live (§14).
 *
 * Everything on this page is the real component reading the real token, so it
 * cannot drift from the product. Switch the theme in the top bar and every
 * swatch here follows — which is the point: there is one token set, and light,
 * dark and system all fall out of it.
 */
import { useState } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { BarRows, LinePanel, PanelGrid, ReliabilityPlot, RiskGauge, Sparkline } from "@/components/ui/charts";
import {
  Badge, Banner, Button, Card, Chip, EmptyState, ErrorBanner, Field, LoadingRows, Meter, PageHeader,
  SegmentedControl, Select, Tabs, TextArea, TextInput, Toggle,
} from "@/components/ui/primitives";
import { ConfirmDestructive, Drawer, Modal, Toast } from "@/components/ui/overlays";
import {
  AssistiveLine, CalibratedBadge, FusionPill, GradeLegend, ModeTag, OutcomeTag, RoleBadge,
  ScopeChip, SeverityTag, StatusPill, TransferStateTag,
} from "@/components/ui/domain";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { AlertIcon, CheckIcon, InfoIcon, PaletteIcon, ScaleIcon, XIcon } from "@/components/ui/icons";

const SURFACES = [
  { token: "--plane", name: "Page plane" },
  { token: "--surface-1", name: "Card" },
  { token: "--surface-2", name: "Nested surface" },
  { token: "--surface-sunken", name: "Sunken / well" },
];

const INK = [
  { token: "--text-primary", name: "Primary" },
  { token: "--text-secondary", name: "Secondary" },
  { token: "--text-muted", name: "Muted (non-essential only)" },
];

const ACCENT = [
  { token: "--accent", name: "Accent" },
  { token: "--accent-strong", name: "Accent strong" },
  { token: "--accent-weak", name: "Accent weak" },
  { token: "--vital", name: "Vital (chrome only)" },
];

const STATUS = [
  { token: "--status-good", name: "Good" },
  { token: "--status-warning", name: "Warning" },
  { token: "--status-serious", name: "Serious" },
  { token: "--status-critical", name: "Critical" },
];

const SEQ = ["--seq-track", "--seq-100", "--seq-250", "--seq-400", "--seq-500", "--seq-600", "--seq-700"];
const CAT = ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6", "--cat-7", "--cat-8", "--cat-other"];

const TYPE = [
  { token: "--text-3xs", size: 11, weight: 600, use: "Footnotes, provenance lines" },
  { token: "--text-2xs", size: 12, weight: 600, use: "Badges, chip labels" },
  { token: "--text-xs", size: 13, weight: 500, use: "Secondary body, helper text" },
  { token: "--text-sm", size: 14, weight: 650, use: "Condition rows, card sub-headings" },
  { token: "--text-base", size: 15, weight: 400, use: "Body default" },
  { token: "--text-md", size: 16, weight: 700, use: "Card titles" },
  { token: "--text-lg", size: 18, weight: 700, use: "Pane headers" },
  { token: "--text-xl", size: 22, weight: 700, use: "Page titles" },
  { token: "--text-gauge", size: 26, weight: 700, use: "The gauge number — never below 24px" },
];

export function DesignSystemPage() {
  const { mode, resolved } = useTheme();
  const [tab, setTab] = useState<"color" | "type" | "components" | "charts" | "rules">("color");
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState("a");

  return (
    <>
      <PageHeader
        eyebrow={<span className="row" style={{ gap: 7 }}><PaletteIcon size={13} /> Design system</span>}
        title="One token set, three themes"
        lede="Every swatch and component below is the real thing reading the real token. Switch the theme and watch the whole page follow — light, dark and system all fall out of one definition."
        meta={
          <>
            <Badge tone="accent">mode: {mode}</Badge>
            <Badge tone="neutral">rendering: {resolved}</Badge>
            <ThemeToggle />
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "color", label: "Colour" },
          { value: "type", label: "Typography" },
          { value: "components", label: "Components" },
          { value: "charts", label: "Charts" },
          { value: "rules", label: "The rules" },
        ]}
      />

      {tab === "color" && (
        <>
          <Card title="Surfaces" subtitle="A four-step depth stack. There is deliberately no fifth.">
            <div className="swatch-grid">
              {SURFACES.map((s) => (
                <div key={s.token} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${s.token})` }} />
                  <span className="swatch-name">{s.name}</span>
                  <span className="swatch-token">{s.token}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ink" subtitle="Three steps. Muted is for non-essential text only — anything carrying required information moves up a step.">
            <div className="swatch-grid">
              {INK.map((s) => (
                <div key={s.token} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${s.token})` }} />
                  <span className="swatch-name">{s.name}</span>
                  <span className="swatch-token">{s.token}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Accent" subtitle="Interactive affordances only. Never used to encode a risk value.">
            <div className="swatch-grid">
              {ACCENT.map((s) => (
                <div key={s.token} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${s.token})` }} />
                  <span className="swatch-name">{s.name}</span>
                  <span className="swatch-token">{s.token}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Sequential risk ramp"
            subtitle="The only encoding for a probability"
            footnote="One hue, monotonic from track to saturated. A 92% mortality estimate is a dark, saturated blue wedge with a 26px number beside it — not a red gauge. This is the single most common thing a new engineer wants to change; §14.3.2 is why they should not."
          >
            <div className="swatch-grid">
              {SEQ.map((t) => (
                <div key={t} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${t})` }} />
                  <span className="swatch-token">{t}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Categorical — condition families"
            subtitle="Eight validated hues plus a neutral overflow"
            footnote="Colourblind-validated as an ordered set. Do not reorder them and do not add a ninth — a ninth family folds into the neutral bucket instead. These are used only for the small family swatch, never for a probability bar."
          >
            <div className="swatch-grid">
              {CAT.map((t) => (
                <div key={t} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${t})` }} />
                  <span className="swatch-token">{t}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="Status"
            subtitle="System states, not clinical risk"
            footnote="A structurally separate family from the risk ramp. Every status colour ships with an icon and a label — the pairing is what prevents confusion, not hue avoidance."
          >
            <div className="swatch-grid">
              {STATUS.map((s) => (
                <div key={s.token} className="swatch">
                  <div className="swatch-chip" style={{ background: `var(${s.token})` }} />
                  <span className="swatch-name">{s.name}</span>
                  <span className="swatch-token">{s.token}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {tab === "type" && (
        <>
          <Card title="Type scale" subtitle="Named tokens, so new screens stop inventing in-between sizes">
            {TYPE.map((t) => (
              <div key={t.token} className="type-row">
                <span className="type-token">{t.token}</span>
                <span style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: 1.3 }}>
                  Acute decompensated heart failure
                </span>
                <span className="type-spec">{t.size}px / {t.weight} · {t.use}</span>
              </div>
            ))}
          </Card>

          <div className="split">
            <Card title="Tabular numerals" subtitle="Any number that will be compared with another number">
              <div className="stack" style={{ gap: 4 }}>
                {["0.412", "0.301", "0.487", "1.104"].map((n) => (
                  <span key={n} className="tnum" style={{ fontSize: 17, fontWeight: 650 }}>{n}</span>
                ))}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                Digits align in a column, so a scan down the list reads magnitude rather than shape.
              </p>
              <div className="divider" />
              <div className="stack" style={{ gap: 4 }}>
                {["0.412", "0.301", "0.487", "1.104"].map((n) => (
                  <span key={n} style={{ fontSize: 17, fontWeight: 650, fontVariantNumeric: "normal" }}>{n}</span>
                ))}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Without it — the same numbers, harder to compare.</p>
            </Card>

            <Card title="Monospace, and where it is not used" subtitle="Comparing characters vs. reading prose">
              <p className="mono" style={{ margin: 0, fontSize: 14 }}>CIR007 · CIR070 · MRN-400118 · 10 mg vs 100 mg</p>
              <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
                Monospace only where telling two characters apart matters: codes, identifiers, doses.
                Never for a condition name or a sentence — monospace prose reads as &ldquo;code&rdquo;,
                which is the wrong register for something a clinician has to act on.
              </p>
            </Card>
          </div>
        </>
      )}

      {tab === "components" && (
        <>
          <div className="split">
            <Card title="Buttons">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button variant="primary">Primary</Button>
                <Button>Default</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
                <Button disabled>Disabled</Button>
                <Button size="sm">Small</Button>
              </div>
            </Card>

            <Card title="Form controls">
              <Field label="Text input" hint="With a hint"><TextInput placeholder="Placeholder" /></Field>
              <Field label="With an error" error="This field is required"><TextInput aria-invalid /></Field>
              <Field label="Select"><Select><option>Option one</option><option>Option two</option></Select></Field>
              <Field label="Textarea"><TextArea rows={2} placeholder="Longer text" /></Field>
              <Toggle checked={toggle} onChange={setToggle} label="A toggle" hint="With an explanation of what it actually does." />
              <SegmentedControl value={seg} onChange={setSeg} ariaLabel="Segmented" options={[{ value: "a", label: "One" }, { value: "b", label: "Two" }, { value: "c", label: "Three" }]} />
            </Card>
          </div>

          <Card title="Badges, pills and domain tags" subtitle="One enum-to-appearance mapping across all four consoles">
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="good" icon={<CheckIcon size={11} />}>Good</Badge>
              <Badge tone="warning" icon={<AlertIcon size={11} />}>Warning</Badge>
              <Badge tone="critical" icon={<XIcon size={11} />}>Critical</Badge>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusPill status="active" />
              <StatusPill status="pending" />
              <StatusPill status="suspended" />
              <StatusPill status="degraded" />
              <SeverityTag severity="critical" />
              <OutcomeTag outcome="denied" />
              <TransferStateTag state="mpi_review" />
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <RoleBadge role="physician" />
              <RoleBadge role="privacy_officer" />
              <RoleBadge role="super_admin" />
              <ScopeChip scope="Unit: 4-West" />
              <ScopeChip scope="Roster: 12 patients" />
              <ModeTag mode="on_prem" />
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <CalibratedBadge calibrated />
              <CalibratedBadge calibrated={false} />
              <CalibratedBadge calibrated validity="reduced" />
              <FusionPill status="tower_a_only" />
              <FusionPill status="fused" />
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Chip swatch="var(--cat-1)">Circulatory</Chip>
              <Chip swatch="var(--cat-3)">Respiratory</Chip>
              <Chip onRemove={() => setToast("Chip removed")}>Removable</Chip>
            </div>
            <GradeLegend />
          </Card>

          <Card title="Banners" subtitle="Tone plus icon plus text — never colour alone">
            <Banner tone="accent" title="Accent">Context or an explanation that is not a warning.</Banner>
            <Banner tone="good" title="Good">Something succeeded or is within tolerance.</Banner>
            <Banner tone="warning" title="Warning">Something needs attention but is not broken.</Banner>
            <Banner tone="critical" title="Critical">Something is wrong and needs a decision now.</Banner>
            <ErrorBanner code="ESAP-4031" message="You do not have access to this encounter." detail={'{"code":"ESAP-4031","scope":"assigned","required":"unit"}'} showDetail />
          </Card>

          <div className="split">
            <Card title="Overlays">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button onClick={() => setModal(true)}>Modal</Button>
                <Button onClick={() => setDrawer(true)}>Drawer</Button>
                <Button variant="danger" onClick={() => setConfirm(true)}>Two-step confirm</Button>
                <Button onClick={() => setToast("This is a toast")}>Toast</Button>
              </div>
            </Card>

            <Card title="States">
              <LoadingRows rows={2} />
              <div className="divider" />
              <EmptyState icon={<InfoIcon size={20} />} title="Nothing here yet" message="Every list screen uses this shape, with copy specific to what is missing and why." action={<Button size="sm">Primary action</Button>} />
            </Card>
          </div>
        </>
      )}

      {tab === "charts" && (
        <>
          <Card
            title="Risk gauges"
            subtitle="Arc length carries magnitude; the ramp reinforces it; the number and phrase carry it in text"
            footnote="Remove the colour entirely and these still read correctly. That is the test every colour decision in this system has to pass."
          >
            <div className="row" style={{ gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
              {[0.03, 0.18, 0.44, 0.71, 0.92].map((p) => (
                <RiskGauge key={p} label="Example outcome" modelId="M-02" probability={p} calibrated={p !== 0.71} size={120} />
              ))}
            </div>
          </Card>

          <Card title="Small multiples, never a dual axis" subtitle="Three metrics on three scales">
            <PanelGrid>
              <LinePanel title="Recall@20" labels={["W-5", "W-4", "W-3", "W-2", "W-1", "W-0"]} values={[0.40, 0.41, 0.42, 0.41, 0.40, 0.412]} format={(v) => v.toFixed(3)} reference={{ value: 0.6, label: "leakage ceiling", tone: "critical" }} />
              <LinePanel title="Calibration error" labels={["W-5", "W-4", "W-3", "W-2", "W-1", "W-0"]} values={[0.018, 0.019, 0.022, 0.026, 0.029, 0.031]} format={(v) => v.toFixed(3)} reference={{ value: 0.05, label: "threshold", tone: "warning" }} color="var(--vital)" />
              <LinePanel title="Volume" labels={["W-5", "W-4", "W-3", "W-2", "W-1", "W-0"]} values={[3800, 4100, 4400, 4200, 4900, 5100]} format={(v) => v.toLocaleString()} />
            </PanelGrid>
            <p className="chart-hint">
              Two y-scales on one plot is the single most common charting mistake, and it makes two
              unrelated series look correlated. Three panels sharing an x-axis says the same thing
              without the lie.
            </p>
          </Card>

          <div className="split">
            <Card title="Ranked magnitude bars">
              <BarRows
                rows={[
                  { key: "a", label: "Heart failure", value: 0.82, swatch: "var(--cat-1)", meta: "Circulatory" },
                  { key: "b", label: "Pneumonia", value: 0.54, swatch: "var(--cat-3)", meta: "Respiratory" },
                  { key: "c", label: "Acute kidney injury", value: 0.31, swatch: "var(--cat-4)", meta: "Genitourinary" },
                  { key: "d", label: "Anaemia", value: 0.17, swatch: "var(--cat-6)", meta: "Blood" },
                ]}
                max={1}
              />
            </Card>

            <Card title="Reliability plot">
              <ReliabilityPlot
                bins={[
                  { predicted: 0.05, observed: 0.043, n: 4120 },
                  { predicted: 0.25, observed: 0.241, n: 1302 },
                  { predicted: 0.45, observed: 0.438, n: 504 },
                  { predicted: 0.65, observed: 0.631, n: 190 },
                  { predicted: 0.85, observed: 0.834, n: 88 },
                ]}
                ece={0.018}
              />
            </Card>
          </div>

          <Card title="Sparklines and meters" subtitle="Inline, no legend — the label beside them names the series">
            <div className="row" style={{ gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              <Sparkline points={[3, 5, 4, 8, 6, 9, 7, 11]} ariaLabel="Example trend" />
              <Sparkline points={[11, 9, 10, 6, 7, 4, 5, 3]} stroke="var(--vital)" ariaLabel="Example falling trend" />
              <div style={{ width: 200 }}><Meter value={0.72} label="Example meter" height={8} /></div>
            </div>
          </Card>
        </>
      )}

      {tab === "rules" && (
        <>
          <Card title="The rules, in priority order" subtitle="§14.1">
            <ol className="run-steps">
              <li><strong>Legible fast, not legible eventually.</strong> Graded against a shared workstation at 2am between two other tasks, not against a poster.</li>
              <li><strong>Colour is reinforcement, never the sole carrier.</strong> Every coloured state pairs with an icon, a label, a position or a length.</li>
              <li><strong>Weight before size for hierarchy.</strong> A twenty-row differential must not become twenty font sizes.</li>
              <li><strong>Tabular numerals on anything comparable.</strong> If two numbers will be scanned against each other, they align.</li>
              <li><strong>One focus treatment everywhere.</strong> No exceptions, no per-component variants.</li>
              <li><strong>Nothing scrolls horizontally at the body level.</strong> Wide content scrolls inside its own container.</li>
            </ol>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><ScaleIcon size={16} /> Status vs. risk</span>} subtitle="§14.3.3 — check this before adding any coloured element" padded={false}>
            <div className="scroll-x">
              <table className="data-table is-dense">
                <thead><tr><th>Situation</th><th>Token family</th><th>Icon</th><th>Label always shown?</th></tr></thead>
                <tbody>
                  <tr><td>A model probability</td><td className="mono">--seq-*</td><td>none — arc length carries it</td><td>Yes — percentage plus percentile phrase</td></tr>
                  <tr><td>Length-of-stay interval</td><td className="mono">--accent</td><td>Clock</td><td>Yes — &ldquo;3–6 days (95% interval)&rdquo;</td></tr>
                  <tr><td>Calibrated</td><td className="mono">--status-good</td><td>Check</td><td>Yes</td></tr>
                  <tr><td>Uncalibrated</td><td className="mono">--surface-2</td><td>none</td><td>Yes — deliberately not a warning colour</td></tr>
                  <tr><td>Unconfirmed extraction</td><td className="mono">--status-warning</td><td>Alert</td><td>Yes</td></tr>
                  <tr><td>Form validation error</td><td className="mono">--status-critical</td><td>Alert</td><td>Yes, with message text under the field</td></tr>
                  <tr><td>Audit severity</td><td className="mono">--status-*</td><td>Severity icon</td><td>Yes — never a bare colour chip in a log row</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Accessibility" subtitle="§14.7 — a CI gate, not a manual pass">
            <ul className="caveat-list">
              <li><CheckIcon size={13} /> WCAG AA contrast in both themes, audited automatically on every change to the token file.</li>
              <li><CheckIcon size={13} /> Minimum interactive text 13px; 11px reserved for footnotes that never carry required information.</li>
              <li><CheckIcon size={13} /> Focus visible on every interactive element, with one shared ring treatment.</li>
              <li><CheckIcon size={13} /> Reflows and stays legible at 200% zoom with no horizontal page scroll.</li>
              <li><CheckIcon size={13} /> Motion respects <span className="mono">prefers-reduced-motion</span>.</li>
              <li><CheckIcon size={13} /> Every chart has a text readout; no plot is the only route to its numbers.</li>
            </ul>
          </Card>

          <AssistiveLine />
        </>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="A modal" subtitle="For a focused decision" footer={<><Button onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Confirm</Button></>}>
        <p style={{ margin: 0 }}>Modals are for one decision. Anything that needs context alongside it goes in a drawer instead.</p>
      </Modal>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="A drawer" subtitle="For detail beside the thing it explains">
        <p style={{ margin: 0 }}>
          The Why panel is a drawer rather than a modal so the estimate it explains stays on screen
          behind it. Losing sight of the number while reading its explanation is exactly wrong.
        </p>
      </Drawer>

      <ConfirmDestructive
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => setToast("Confirmed")}
        title="A destructive action"
        confirmWord="example"
        actionLabel="Do it"
        body="Typing the name of the thing is the point — it makes the action impossible to perform by reflex."
        consequences={["Every consequence is listed explicitly.", "Including the ones that are not obvious.", "Especially the ones that are not reversible."]}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
