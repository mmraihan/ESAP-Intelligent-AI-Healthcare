/**
 * 11.4.8 — Usage & Outcomes.
 *
 * Adoption and model quality in one place, with the leakage alarm wired in. The
 * metric a hospital will want to quote is Recall@20; the metric that keeps it
 * honest is the stratified split beneath it, so both are on screen together.
 */
import { useState } from "react";
import { ADOPTION_SERIES, DRIFT, MODELS } from "@/mock/db";
import { num, pct } from "@/lib/format";
import { LeakageAlarm } from "@/components/clinical";
import { BarRows, LinePanel, PanelGrid } from "@/components/ui/charts";
import { Banner, Button, Card, PageHeader, SegmentedControl, StatTile, Tabs } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { ArrowRight, ChartIcon, DownloadIcon, ScaleIcon, UsersIcon } from "@/components/ui/icons";
import { requestExport } from "@/api/actions";

export function AdminUsage() {
  const [tab, setTab] = useState<"adoption" | "quality" | "outcomes">("adoption");
  const [window, setWindow] = useState<"12w" | "16w">("12w");
  const [toast, setToast] = useState<string | null>(null);

  const series = window === "12w" ? ADOPTION_SERIES : ADOPTION_SERIES;
  const drift = window === "12w" ? DRIFT.slice(-12) : DRIFT;
  const totalAssessments = series.reduce((a, s) => a + s.assessments, 0);
  const latest = series.length ? series[series.length - 1] : undefined;
  const lastAck = latest?.acknowledgedPct ?? 0;
  const m01 = MODELS.find((m) => m.id === "M-01");
  const m01Recall = Number(m01?.headline[0]?.value) || 0;
  // The evaluation of record's calibration error, averaged over the models that report one.
  const withEce = MODELS.filter((m) => m.id !== "M-05" && m.ece > 0);
  const evalEce = withEce.length ? withEce.reduce((a, m) => a + m.ece, 0) / withEce.length : 0;
  // Assessments in the latest half of the window against the half before it.
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((a, s) => a + s.assessments, 0);
  const earlier = series.slice(0, half).reduce((a, s) => a + s.assessments, 0);
  const change = earlier ? (recent - earlier) / earlier : null;

  return (
    <>
      <PageHeader
        eyebrow="Hospital admin"
        title="Usage & outcomes"
        lede="Whether people are using it, and whether it is still working. Both matter, and high usage of a drifting model is worse than low usage of a sound one."
        actions={
          <>
            <Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("usage_report").then(setToast)}>Export report</Button>
            <SegmentedControl
              size="sm"
              ariaLabel="Time window"
              value={window}
              onChange={setWindow}
              options={[{ value: "12w", label: "12 weeks" }, { value: "16w", label: "16 weeks" }]}
            />
          </>
        }
      />

      <div className="grid grid-4">
        <StatTile label="Assessments" value={num(totalAssessments)} icon={<ChartIcon size={15} />} delta={change === null ? undefined : { dir: change > 0 ? "up" : change < 0 ? "down" : "flat", label: `${change > 0 ? "+" : ""}${Math.round(change * 100)}% on the earlier half of the window` }} />
        <StatTile label="Active clinicians" value={latest?.activeClinicians ?? 0} icon={<UsersIcon size={15} />} hint="Ran at least one assessment this week" />
        <StatTile
          label="Acknowledged within 24 h"
          value={pct(lastAck, 0)}
          tone={lastAck > 0.7 ? "good" : "warning"}
          hint="The share of assessments a clinician actually reviewed"
        />
        <StatTile
          label="Calibration error (ECE)"
          value={evalEce.toFixed(4)}
          tone={evalEce > 0.05 ? "critical" : "good"}
          icon={<ScaleIcon size={15} />}
          hint="From the evaluation of record, M-01 to M-04. Action threshold 0.05."
        />
      </div>

      <Banner tone="accent" title="Read the acknowledgement rate before the volume">
        Volume tells you the tool is in the workflow. The acknowledgement rate tells you clinicians are
        reading it rather than clicking past it — and a falling acknowledgement rate with rising volume
        is the signature of alert fatigue setting in.
      </Banner>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "adoption", label: "Adoption" },
          { value: "quality", label: "Model quality" },
          { value: "outcomes", label: "Outcomes" },
        ]}
      />

      {tab === "adoption" && (
        <Card title="Adoption over time" subtitle="Three measures, three panels — never two scales on one axis">
          <PanelGrid>
            <LinePanel
              title="Assessments per week"
              labels={series.map((s) => s.week)}
              values={series.map((s) => s.assessments)}
              format={(v) => num(v)}
            />
            <LinePanel
              title="Active clinicians"
              labels={series.map((s) => s.week)}
              values={series.map((s) => s.activeClinicians)}
              format={(v) => num(v)}
              color="var(--vital)"
            />
            <LinePanel
              title="Acknowledged within 24 h"
              labels={series.map((s) => s.week)}
              values={series.map((s) => s.acknowledgedPct)}
              format={(v) => pct(v, 1)}
              domain={[0, 1]}
              reference={{ value: 0.7, label: "target 70%", tone: "good" }}
            />
          </PanelGrid>
        </Card>
      )}

      {tab === "quality" && (
        <>
          {m01 && (
          <LeakageAlarm
            metric="Recall@20"
            value={m01Recall}
            threshold={0.6}
            negativeControl={m01.negativeControl}
          />
          )}

          <div className="split">
            <Card
              title="M-01 performance, stratified"
              subtitle="The headline and the split that qualifies it"
              footnote={`The pooled figure is ${m01Recall.toFixed(3)}. Quoting it without the split overstates performance for patients with no prior history.`}
            >
              <BarRows
                rows={[
                  { key: "pooled", label: "Pooled (all admissions)", value: m01Recall, meta: `n = ${num(m01?.cohortN ?? 0)}` },
                  ...(m01?.strata ?? []).map((s) => ({ key: s.label, label: s.label, value: s.value, meta: `${s.metric} · n = ${num(s.n)}` })),
                ]}
                max={Math.max(0.6, m01Recall, ...(m01?.strata ?? []).map((x) => x.value))}
                format={(v) => v.toFixed(3)}
              />
            </Card>

            <Card title="Calibration in your population" subtitle="Needs the outcomes of your own admissions">
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                Calibration on your own patients compares each estimate with what then happened, so it needs
                discharge outcomes from your ADT feed. None is connected yet, so nothing is plotted here. The
                calibration error above is from the evaluation of record.
              </p>
            </Card>
          </div>

          <Card title="Drift monitoring" subtitle="Input distribution and calibration, weekly">
            <PanelGrid>
              <LinePanel
                title="Population stability index (PSI)"
                hint="How far your current admissions have drifted from the training population"
                labels={drift.map((d) => d.week)}
                values={drift.map((d) => d.psi)}
                format={(v) => v.toFixed(3)}
                reference={{ value: 0.2, label: "investigate above 0.2", tone: "warning" }}
                color="var(--vital)"
              />
              <LinePanel
                title="Calibration error (ECE)"
                labels={drift.map((d) => d.week)}
                values={drift.map((d) => d.ece)}
                format={(v) => v.toFixed(3)}
                reference={{ value: 0.05, label: "action threshold", tone: "warning" }}
              />
              <LinePanel
                title="Recall@20"
                labels={drift.map((d) => d.week)}
                values={drift.map((d) => d.recall20)}
                format={(v) => v.toFixed(3)}
                reference={{ value: 0.6, label: "leakage ceiling 0.60", tone: "critical" }}
              />
            </PanelGrid>
          </Card>
        </>
      )}

      {tab === "outcomes" && (
        <>
          <Banner tone="warning" title="These are associations, not attributed effects">
            The figures below compare periods before and after ESAP was introduced on each unit. They
            are not a controlled comparison, and anything that changed at the same time — staffing,
            case mix, a new pathway — is also in them. Treat them as a prompt to investigate, not as a
            measured effect of the software.
          </Banner>

          <Card title="No outcome data yet">
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Length of stay, ICU transfers and readmissions for your admissions come from discharge and
              transfer messages on your ADT feed. None is connected on this server, so no outcome is shown
              rather than an estimate of one.
            </p>
          </Card>

          <Card title="What would make these numbers meaningful" subtitle="Be honest in the board pack">
            <ul className="caveat-list">
              <li><ArrowRight size={13} /> A stepped-wedge rollout across units, so each unit is its own control.</li>
              <li><ArrowRight size={13} /> Case-mix adjustment, so a quieter quarter does not read as an improvement.</li>
              <li><ArrowRight size={13} /> A pre-registered primary endpoint, chosen before the data is looked at.</li>
              <li><ArrowRight size={13} /> Linking each acknowledged assessment to what the clinician actually did next.</li>
            </ul>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
              Your account team can help design this. A vendor claiming a causal effect from a
              before/after comparison is a vendor you should not believe, including this one.
            </p>
          </Card>
        </>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
