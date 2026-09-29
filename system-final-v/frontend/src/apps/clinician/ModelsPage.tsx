/**
 * Models & basis (§18, §8.8's GET /models/{id}/basis).
 *
 * The governance drill-down any role can reach. It exists so a clinician can
 * answer "what is this thing, and how well does it actually work" without
 * asking anyone — which is also what the non-device-CDS posture requires.
 *
 * The honest-reporting rules apply hardest here: stratified numbers, not just
 * the headline; the leakage alarm state; the negative control that was run.
 */
import { useState } from "react";
import { DRIFT, MODELS } from "@/mock/db";
import { dateLabel, num } from "@/lib/format";
import type { ModelCard } from "@/mock/types";
import { LeakageAlarm } from "@/components/clinical";
import { AssistiveLine, FusionPill } from "@/components/ui/domain";
import { Badge, Banner, Button, Card, PageHeader, StatTile, Tabs, cx } from "@/components/ui/primitives";
import { BarRows, LinePanel, PanelGrid } from "@/components/ui/charts";
import { AlertIcon, CheckIcon, DownloadIcon, FlaskIcon, ScaleIcon } from "@/components/ui/icons";
import { Toast } from "@/components/ui/overlays";
import { saveFile, toCsv } from "@/api/actions";

/**
 * The model card as a document someone can file or attach to a governance
 * review. Built from the same public evidence this page renders — no patient
 * data, so it needs no export record.
 */
function modelCardMarkdown(m: ModelCard): string {
  return [
    `# ${m.id} — ${m.name}`,
    "",
    `**Outcome:** ${m.outcome}  `,
    `**Version:** ${m.version} · **Status:** ${m.status} · **Fusion:** ${m.fusion.replace(/_/g, " ")}  `,
    `**Trained on:** ${m.trainedOn} (n = ${m.cohortN.toLocaleString()})  `,
    `**Last evaluated:** ${m.lastEvaluated}`,
    "",
    "## Headline metrics",
    "",
    "| Metric | Value |", "|---|---|",
    ...m.headline.map((h) => `| ${h.label} | ${h.value} |`),
    "",
    "## Calibration",
    "",
    `${m.calibrationMethod}. Expected calibration error: ${m.id === "M-05" ? "n/a (interval model — see coverage)" : m.ece.toFixed(3)}.`,
    "",
    "## Performance by subgroup",
    "",
    "| Subgroup | n | Metric | Value |", "|---|---|---|---|",
    ...m.strata.map((st) => `| ${st.label} | ${st.n.toLocaleString()} | ${st.metric} | ${st.value.toFixed(3)} |`),
    "",
    "## Leakage control",
    "",
    `Leakage alarm: **${m.leakageAlarm ? "FIRING" : "clear"}**. Negative control: ${m.negativeControl}`,
    "",
    "---",
    "Decision support only — assistive and calibrated, not autonomous diagnosis. These figures come from the",
    "demonstration dataset; the trained models' measured results are in ml-pipeline/models/*/results.md.",
    "",
  ].join("\n");
}

export function ModelsPage() {
  const [selected, setSelected] = useState<ModelCard["id"]>("M-01");
  const model = MODELS.find((m) => m.id === selected)!;
  const [toast, setToast] = useState<string | null>(null);

  function downloadCard() {
    const name = `esap-${model.id.toLowerCase()}-model-card.md`;
    setToast(saveFile(name, modelCardMarkdown(model), "text/markdown;charset=utf-8") ? `Saved ${name}` : "This browser could not save the file.");
  }

  function downloadFairness() {
    const rows = MODELS.flatMap((m) => m.strata.map((st) => ({
      model: m.id, model_name: m.name, version: m.version, subgroup: st.label, n: st.n, metric: st.metric, value: st.value,
    })));
    const name = "esap-subgroup-performance.csv";
    setToast(saveFile(name, toCsv(rows), "text/csv;charset=utf-8") ? `Saved ${name} — ${rows.length} subgroup rows across ${MODELS.length} models` : "This browser could not save the file.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Models & basis"
        lede="What each model is, what it was trained on, how well it actually performs — including where it performs worse. Nothing here is rounded in the product's favour."
      />

      <Tabs
        value={selected}
        onChange={(v) => setSelected(v as ModelCard["id"])}
        tabs={MODELS.map((m) => ({ value: m.id, label: `${m.id} · ${m.name}` }))}
      />

      {model.status === "degraded" && (
        <Banner tone="warning" title={`${model.id} is serving degraded`}>
          It is still available, and it is labelled as degraded everywhere it appears. The specific
          weakness is stated in the stratified table below — read that before acting on this model.
        </Banner>
      )}

      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          <Card
            title={`${model.id} — ${model.name}`}
            subtitle={model.outcome}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={model.status === "live" ? "good" : model.status === "degraded" ? "warning" : "neutral"} icon={<FlaskIcon size={11} />}>
                  {model.status}
                </Badge>
                <Badge tone="neutral">{model.version}</Badge>
              </div>
            }
            footnote={`Trained on ${model.trainedOn}. Cohort n = ${num(model.cohortN)}. Last evaluated ${dateLabel(model.lastEvaluated)}.`}
          >
            <div className="grid grid-3">
              {model.headline.map((h) => (
                <StatTile key={h.label} label={h.label} value={h.value} />
              ))}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <FusionPill status={model.fusion} />
              {model.towers.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
            </div>
          </Card>

          <Card
            title={<span className="row" style={{ gap: 7 }}><ScaleIcon size={16} /> Performance by subgroup</span>}
            subtitle="The headline number is an average. These are the numbers that matter for the patient in front of you."
            footnote="A model that performs well on average and poorly on a stratum you routinely treat is, for you, a model that performs poorly. The stratified split is reported first for that reason."
          >
            <BarRows
              rows={model.strata.map((s) => ({
                key: s.label,
                label: s.label,
                value: s.value,
                meta: `${s.metric} · n = ${num(s.n)}`,
              }))}
              max={1}
              format={(v) => v.toFixed(3)}
            />
            {model.strata.length === 2 && Math.abs(model.strata[0].value - model.strata[1].value) > 0.1 && (
              <p className="inline-warn">
                <AlertIcon size={13} />
                The gap between these strata is {(Math.abs(model.strata[0].value - model.strata[1].value)).toFixed(3)}.
                On the weaker stratum this model is substantially less useful, and the results page labels
                cases that fall in it.
              </p>
            )}
          </Card>

          <LeakageAlarm
            metric={model.id === "M-01" ? "Recall@20" : "AUROC"}
            value={Number(model.headline[0].value) || 0}
            threshold={model.id === "M-01" ? 0.6 : 0.95}
            negativeControl={model.negativeControl}
          />
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card
            title="Calibration"
            subtitle={`${model.calibrationMethod} · ECE ${model.ece.toFixed(3)}`}
            footnote="Calibration is what makes a probability mean what it says: of the cases the model called 30%, close to 30% should actually have the outcome. Without it a well-ranked model still misleads."
          >
            {model.id === "M-05" ? (
              <div className="stack" style={{ gap: 10 }}>
                <p className="prose" style={{ margin: 0 }}>
                  M-05 produces an interval, not a probability, so it is not calibrated in the usual
                  sense. The equivalent guarantee is <strong>coverage</strong>: the measured share of
                  patients whose true stay fell inside the interval.
                </p>
                <div className="grid grid-2">
                  <StatTile label="Measured coverage" value={model.headline[0]?.value ?? "—"} tone={Number(model.headline[0]?.value) >= 0.94 ? "good" : "warning"} />
                  <StatTile label="Nominal level" value="0.95" />
                </div>
              </div>
            ) : (
              <p className="prose" style={{ margin: 0 }}>
                The evaluation of record reports an expected calibration error of <strong>{model.ece.toFixed(4)}</strong> on
                the held-out test set. It does not record the per-bin reliability curve, so no curve is drawn here
                rather than an illustration of one.
              </p>
            )}
          </Card>

          <Card title="Monitoring" subtitle={DRIFT.length ? `${DRIFT.length} weeks of production behaviour` : "No production monitoring yet — there is no live traffic to monitor"}>
            <PanelGrid>
              <LinePanel
                title="Calibration error (ECE)"
                labels={DRIFT.map((d) => d.week)}
                values={DRIFT.map((d) => d.ece)}
                format={(v) => v.toFixed(3)}
                reference={{ value: 0.05, label: "action threshold 0.05", tone: "warning" }}
              />
              <LinePanel
                title="Input drift (PSI)"
                labels={DRIFT.map((d) => d.week)}
                values={DRIFT.map((d) => d.psi)}
                format={(v) => v.toFixed(3)}
                reference={{ value: 0.2, label: "investigate above 0.2", tone: "warning" }}
                color="var(--vital)"
              />
            </PanelGrid>
            <p className="chart-hint">
              Two metrics on different scales, so two panels sharing one x-axis — never two y-axes on
              one plot.
            </p>
          </Card>

          <Card title="What this model is not" subtitle="Read before acting">
            <ul className="caveat-list">
              <li><AlertIcon size={13} /> It is not a diagnosis. It estimates how often an outcome occurred in similar past admissions.</li>
              <li><AlertIcon size={13} /> It uses admission-time data only and cannot know anything about the patient&rsquo;s course since.</li>
              <li><AlertIcon size={13} /> It was trained on one population. Where your patients differ from it, it will be less accurate in ways the headline number does not show.</li>
              <li><CheckIcon size={13} /> It is independently reviewable: every estimate carries its computed drivers.</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card title="All five models at a glance" padded={false}>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th><th>Outcome</th><th>Version</th><th>Status</th>
                <th style={{ textAlign: "right" }}>Headline</th><th style={{ textAlign: "right" }}>ECE</th><th>Fusion</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className={cx("is-clickable", m.id === selected && "is-selected")} onClick={() => setSelected(m.id)}>
                  <td><strong>{m.id}</strong></td>
                  <td>
                    <div className="cell-stack">
                      <span>{m.name}</span>
                      <span className="muted">{m.outcome}</span>
                    </div>
                  </td>
                  <td className="mono">{m.version}</td>
                  <td>
                    <Badge tone={m.status === "live" ? "good" : m.status === "degraded" ? "warning" : "neutral"}>{m.status}</Badge>
                  </td>
                  <td style={{ textAlign: "right" }} className="tnum">{m.headline[0].value} <span className="muted">{m.headline[0].label}</span></td>
                  <td style={{ textAlign: "right" }} className="tnum">{m.id === "M-05" ? "—" : m.ece.toFixed(3)}</td>
                  <td><FusionPill status={m.fusion} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Button icon={<DownloadIcon size={15} />} onClick={downloadCard}>Download the {model.id} model card</Button>
        <Button icon={<DownloadIcon size={15} />} onClick={downloadFairness}>Download subgroup performance (CSV)</Button>
      </div>

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
