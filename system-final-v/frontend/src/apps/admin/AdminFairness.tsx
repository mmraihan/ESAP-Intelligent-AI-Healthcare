/**
 * Fairness audit (§15.9) — the privacy officer's and QI auditor's screen.
 *
 * This is the only place in the entire product where audit covariates are
 * displayed. They exist so this page can exist: you cannot show that a model
 * performs evenly across groups without recording which group someone was in.
 * The same fields are never available to any model.
 */
import { useState } from "react";
import { SUBGROUP_FAIRNESS, MODELS } from "@/mock/db";
import { num, pct } from "@/lib/format";
import { BarRows } from "@/components/ui/charts";
import { Banner, Button, Card, PageHeader, SegmentedControl, StatTile, cx } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { AlertIcon, CheckIcon, DownloadIcon, LockIcon, ScaleIcon } from "@/components/ui/icons";
import { requestExport } from "@/api/actions";

type Metric = "auroc" | "ece" | "flagRate";

const METRIC_LABEL: Record<Metric, { label: string; hint: string; good: "high" | "low"; format: (v: number) => string }> = {
  auroc: { label: "Discrimination (AUROC)", hint: "How well the model separates outcomes within this group. A gap here means the model is less useful for that group.", good: "high", format: (v) => v.toFixed(3) },
  ece: { label: "Calibration error (ECE)", hint: "Whether the probabilities mean what they say within this group. A gap here means the number is misleading for that group.", good: "low", format: (v) => v.toFixed(3) },
  flagRate: { label: "Alert rate", hint: "How often someone in this group is flagged. A gap is not automatically a fault — underlying rates differ — but it is what to investigate.", good: "low", format: (v) => pct(v, 1) },
};

export function AdminFairness() {
  const [metric, setMetric] = useState<Metric>("auroc");
  const [model, setModel] = useState("M-02");
  const [toast, setToast] = useState<string | null>(null);

  // Nothing is shown until a subgroup evaluation has actually been run: a
  // fairness table of placeholder numbers would be worse than none.
  if (SUBGROUP_FAIRNESS.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Governance"
          title="Fairness audit"
          lede="Whether the models perform evenly across groups. This is the only screen in the product where race, insurance and marital status are shown — and they are never model inputs."
        />
        <Banner tone="warning" icon={<ScaleIcon size={16} />} title="No subgroup evaluation has been run yet">
          The models have been evaluated overall and by prior history versus cold start (see Models &amp;
          basis), but not yet by race, insurance or marital status. That evaluation is a requirement before
          clinical use, and when it runs, every group and every metric appears here — including any that
          look bad.
        </Banner>
        <Banner tone="accent" icon={<LockIcon size={16} />} title="Why these fields exist at all">
          You cannot demonstrate that a model treats groups evenly without recording which group each
          person was in. So ESAP captures race, insurance and marital status, stores them <em>beside</em>
          the feature matrix rather than inside it, and surfaces them only here.
        </Banner>
      </>
    );
  }

  const RACE = SUBGROUP_FAIRNESS.slice(0, 5);
  const INSURANCE = SUBGROUP_FAIRNESS.slice(5);

  const m = METRIC_LABEL[metric];
  const all = SUBGROUP_FAIRNESS.map((s) => s[metric]);
  const spread = Math.max(...all) - Math.min(...all);
  const worstRace = [...RACE].sort((a, b) => (m.good === "high" ? a[metric] - b[metric] : b[metric] - a[metric]))[0];
  const worstIns = [...INSURANCE].sort((a, b) => (m.good === "high" ? a[metric] - b[metric] : b[metric] - a[metric]))[0];

  const concerning = metric === "auroc" ? spread > 0.05 : metric === "ece" ? spread > 0.02 : spread > 0.05;

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Fairness audit"
        lede="Whether the models perform evenly across groups. This is the only screen in the product where race, insurance and marital status are shown — and they are never model inputs."
        actions={<Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("fairness_report").then(setToast)}>Export report</Button>}
      />

      <Banner tone="accent" icon={<LockIcon size={16} />} title="Why these fields exist at all">
        You cannot demonstrate that a model treats groups evenly without recording which group each
        person was in. So ESAP captures race, insurance and marital status, stores them <em>beside</em>
        the feature matrix rather than inside it, and surfaces them only here. If one of them ever
        appears on a clinical screen, that is a defect.
      </Banner>

      <div className="grid grid-4">
        <StatTile label="Subgroups monitored" value={SUBGROUP_FAIRNESS.length} icon={<ScaleIcon size={15} />} />
        <StatTile label="Assessments in the audit" value={num(SUBGROUP_FAIRNESS.reduce((a, s) => a + s.n, 0))} hint="Rolling 12 months, this tenant" />
        <StatTile
          label={`${m.label} spread`}
          value={m.format(spread)}
          tone={concerning ? "warning" : "good"}
          hint="Largest gap between any two subgroups"
        />
        <StatTile label="Models audited" value={MODELS.length} hint="Every model is stratified on the same covariates" />
      </div>

      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <SegmentedControl
          ariaLabel="Metric"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "auroc", label: "Discrimination" },
            { value: "ece", label: "Calibration" },
            { value: "flagRate", label: "Alert rate" },
          ]}
        />
        <SegmentedControl
          size="sm"
          ariaLabel="Model"
          value={model}
          onChange={setModel}
          options={MODELS.filter((x) => x.id !== "M-05").map((x) => ({ value: x.id, label: x.id }))}
        />
      </div>

      {concerning && (
        <Banner tone="warning" title={`A gap worth investigating in ${m.label.toLowerCase()}`}>
          The spread across subgroups is {m.format(spread)}. The weakest groups are{" "}
          <strong>{worstRace.subgroup}</strong> and <strong>{worstIns.subgroup}</strong>. A gap is not
          proof of bias — subgroup sizes and underlying rates differ — but it is exactly what a
          regulator will ask about, and it should have an explanation on file before they do.
        </Banner>
      )}

      <div className="split">
        <Card
          title={`${m.label} by race / ethnicity`}
          subtitle={m.hint}
          footnote="Recorded as the patient self-reported it at registration. 'Other / Declined' is a real category and is reported rather than dropped — dropping it would hide the group most likely to be underserved."
        >
          <BarRows
            rows={RACE.map((s) => ({
              key: s.subgroup,
              label: s.subgroup,
              value: s[metric],
              meta: `n = ${num(s.n)}`,
            }))}
            max={metric === "auroc" ? 1 : metric === "ece" ? 0.06 : 0.2}
            format={m.format}
          />
        </Card>

        <Card
          title={`${m.label} by insurance class`}
          subtitle="The covariate most likely to encode access to care rather than clinical risk"
          footnote="Insurance is a proxy for a great deal that is not clinical. A model that performs differently across insurance classes may be learning about the health system rather than about the patient."
        >
          <BarRows
            rows={INSURANCE.map((s) => ({
              key: s.subgroup,
              label: s.subgroup,
              value: s[metric],
              meta: `n = ${num(s.n)}`,
            }))}
            max={metric === "auroc" ? 1 : metric === "ece" ? 0.06 : 0.2}
            format={m.format}
          />
        </Card>
      </div>

      <Card title="Full subgroup table" subtitle="Every monitored group, every metric" padded={false}>
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Subgroup</th>
                <th style={{ textAlign: "right" }}>n</th>
                <th style={{ textAlign: "right" }}>AUROC</th>
                <th style={{ textAlign: "right" }}>ECE</th>
                <th style={{ textAlign: "right" }}>Alert rate</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {SUBGROUP_FAIRNESS.map((s) => {
                const weak = s.auroc < 0.84 || s.ece > 0.03;
                return (
                  <tr key={s.subgroup}>
                    <td><strong>{s.subgroup}</strong></td>
                    <td style={{ textAlign: "right" }} className="tnum">{num(s.n)}</td>
                    <td style={{ textAlign: "right" }} className={cx("tnum", s.auroc < 0.84 && "is-weak")}>{s.auroc.toFixed(3)}</td>
                    <td style={{ textAlign: "right" }} className={cx("tnum", s.ece > 0.03 && "is-weak")}>{s.ece.toFixed(3)}</td>
                    <td style={{ textAlign: "right" }} className="tnum">{pct(s.flagRate, 1)}</td>
                    <td>
                      <span className={weak ? "pill pill-warning" : "pill pill-good"}>
                        {weak ? <AlertIcon size={12} /> : <CheckIcon size={12} />}
                        {weak ? "Investigate" : "Within tolerance"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What was deliberately not done" subtitle="§6 guardrail 5">
        <p className="prose" style={{ margin: 0 }}>
          The training data was <strong>not</strong> rebalanced with SMOTE or oversampling. Synthetic
          minority sampling improves a confusion matrix and destroys calibration, and calibration is the
          thing that makes a probability mean anything to a clinician. Class imbalance is handled with
          class weights and evaluated with ranking metrics and reliability curves instead. If you are
          comparing vendors, ask them what they did here — a model that was balanced into a good-looking
          AUROC will have a reliability curve it does not want to show you.
        </p>
      </Card>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
