/**
 * Public evidence page (§16.12, §18).
 *
 * The page a sceptical CMIO is sent to. It leads with the weakest number rather
 * than the strongest, because that is the one they will find anyway, and a
 * vendor who volunteered it is a vendor worth a second meeting.
 */
import { MODELS, SUBGROUP_FAIRNESS } from "@/mock/db";
import { num } from "@/lib/format";
import { BarRows } from "@/components/ui/charts";
import { Badge, Banner, Card } from "@/components/ui/primitives";
import { SiteLayout } from "./SiteLayout";
import { AlertIcon, CheckIcon, FlaskIcon, ScaleIcon, XIcon } from "@/components/ui/icons";

export function ModelEvidencePage() {
  const m01 = MODELS.find((m) => m.id === "M-01");
  const m02 = MODELS.find((m) => m.id === "M-02");
  const m04 = MODELS.find((m) => m.id === "M-04");
  const m01Recall = Number(m01?.headline[0]?.value) || 0;
  const m04Cold = m04?.strata.find((x) => /cold/i.test(x.label));
  const cold = m01?.strata.find((x) => /cold/i.test(x.label));
  const coldShare = m01 && cold ? cold.n / Math.max(1, m01.strata.reduce((a, x) => a + x.n, 0)) : null;
  if (!m01 || !m04) {
    return (
      <SiteLayout>
        <section className="hero"><h1>Evidence</h1><p className="hero-lede">The model evaluation is not available from this server.</p></section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="hero" style={{ paddingBottom: 0 }}>
        <span className="hero-eyebrow"><FlaskIcon size={14} /> Evidence</span>
        <h1>The weakest number first.</h1>
        <p className="hero-lede">
          Every vendor leads with their best metric. Here is ours going the other way, because you
          will find it in the pilot anyway and it is better that you hear it now.
        </p>
      </section>

      <Banner tone="warning" icon={<AlertIcon size={18} />} title="M-04 readmission is not good enough yet, and we ship it labelled as such">
        On patients with no prior admission its AUROC is <strong>{m04Cold ? m04Cold.value.toFixed(3) : "—"}</strong> —
        close to chance. It is genuinely useful for ranking patients who <em>do</em> have an admission
        history, and it is close to useless for the rest. Rather than pull it or quote only the pooled
        figure of {m04.headline[0].value}, it serves with a degraded badge on every screen it appears
        on, and the results page tells the clinician which stratum their patient falls into.
      </Banner>

      <section className="grid grid-2">
        <Card
          title="M-01 differential — pooled vs. stratified"
          subtitle={`Recall@20 · ${m01.headline.find((h) => /labels/i.test(h.label))?.value ?? "—"} CCSR categories scored`}
          footnote={`Cohort n = ${num(m01.cohortN)}. The pooled figure is the one that would go on a slide; the split is the one that determines whether it helps with your patient.`}
        >
          <BarRows
            rows={[
              { key: "pooled", label: "Pooled", value: m01Recall, meta: "all admissions" },
              ...m01.strata.map((s) => ({ key: s.label, label: s.label, value: s.value, meta: `n = ${num(s.n)}` })),
            ]}
            max={Math.max(0.6, m01Recall, ...m01.strata.map((x) => x.value))}
            format={(v) => v.toFixed(3)}
          />
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            A cold-start patient — no coded history on file — gets materially worse performance.
            {coldShare !== null && <> {Math.round(coldShare * 100)}% of the held-out admissions are in that group,</>} and
            the product labels them rather than averaging them away.
          </p>
        </Card>

        <Card title="Calibration" subtitle="Expected calibration error on the held-out test set">
          <BarRows
            rows={MODELS.filter((m) => m.id !== "M-05").map((m) => ({ key: m.id, label: `${m.id} ${m.name}`, value: m.ece, meta: m.calibrationMethod }))}
            max={0.05}
            format={(v) => v.toFixed(4)}
          />
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            Lower is better; 0.05 is the action threshold. {m02 ? `M-02 is ${m02.ece.toFixed(4)}.` : ""} The per-bin
            reliability curves are not stored with the evaluation, so they are not drawn here.
          </p>
        </Card>
      </section>

      <section>
        <Card
          title={<span className="row" style={{ gap: 8 }}><ScaleIcon size={18} /> Performance by subgroup</span>}
          subtitle="Published, not asserted"
          footnote="Race and insurance are recorded solely so this table can exist. They are never model inputs, and they never appear on a clinical screen."
          padded={false}
        >
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subgroup</th>
                  <th style={{ textAlign: "right" }}>n</th>
                  <th style={{ textAlign: "right" }}>AUROC</th>
                  <th style={{ textAlign: "right" }}>ECE</th>
                  <th>Assessment</th>
                </tr>
              </thead>
              <tbody>
                {SUBGROUP_FAIRNESS.length === 0 && (
                  <tr><td colSpan={5} className="muted">
                    No subgroup evaluation has been run on these models yet. When it has, every group and every
                    metric will be published here — including the ones that look bad.
                  </td></tr>
                )}
                {SUBGROUP_FAIRNESS.map((s) => {
                  const weak = s.auroc < 0.84 || s.ece > 0.03;
                  return (
                    <tr key={s.subgroup}>
                      <td><strong>{s.subgroup}</strong></td>
                      <td style={{ textAlign: "right" }} className="tnum">{num(s.n)}</td>
                      <td style={{ textAlign: "right" }} className="tnum">{s.auroc.toFixed(3)}</td>
                      <td style={{ textAlign: "right" }} className="tnum">{s.ece.toFixed(3)}</td>
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
      </section>

      <section className="grid grid-2">
        <Card title="How we handled class imbalance" subtitle="And what we deliberately did not do">
          <ul className="caveat-list">
            <li><XIcon size={14} /> <strong>No SMOTE, no oversampling.</strong> Synthetic minority sampling improves a confusion matrix and wrecks calibration — and calibration is what makes a probability mean anything to a clinician.</li>
            <li><CheckIcon size={14} /> Class weights during training.</li>
            <li><CheckIcon size={14} /> Ranking metrics and reliability curves for evaluation, not accuracy.</li>
            <li><CheckIcon size={14} /> Per-label isotonic calibration fitted on a held-out split; conformal intervals for length of stay.</li>
          </ul>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            If you are comparing vendors, ask each of them this question and ask to see the reliability
            curve. A model balanced into a good-looking AUROC has one it will not want to show you.
          </p>
        </Card>

        <Card title="How we know it is not cheating" subtitle="The leakage alarm and its negative control">
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>
            An intake-only model that scores too well is almost always a model that saw something from
            during the stay. So there is a hard ceiling: if pooled Recall@20 goes above 0.60, an alarm
            fires and the number is not trusted until a negative control has been run and recorded.
          </p>
          <div className="note-block">
            <strong>M-01 negative control:</strong> {m01.negativeControl}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            The alarm cannot be silenced from any screen in the product. It can be explained and
            resolved; it cannot be dismissed.
          </p>
        </Card>
      </section>

      <section>
        <Card title="Every model, every headline number" padded={false}>
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Model</th><th>Outcome</th><th>Status</th>
                  <th style={{ textAlign: "right" }}>Headline</th>
                  <th style={{ textAlign: "right" }}>ECE</th>
                  <th>Weakest stratum</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => {
                  const weakest = [...m.strata].sort((a, b) => a.value - b.value)[0] ?? { label: "—", metric: "", value: 0 };
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.id}</strong></td>
                      <td>
                        <div className="cell-stack">
                          <span>{m.name}</span>
                          <span className="muted">{m.outcome}</span>
                        </div>
                      </td>
                      <td><Badge tone={m.status === "live" ? "good" : "warning"}>{m.status}</Badge></td>
                      <td style={{ textAlign: "right" }} className="tnum">
                        {m.headline[0].value} <span className="muted">{m.headline[0].label}</span>
                      </td>
                      <td style={{ textAlign: "right" }} className="tnum">{m.id === "M-05" ? "—" : m.ece.toFixed(3)}</td>
                      <td>
                        <div className="cell-stack">
                          <span>{weakest.label}</span>
                          <span className="muted tnum">{weakest.metric} {weakest.value.toFixed(3)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <Banner tone="accent" title="What we do not have">
          No controlled outcome study. No published peer-reviewed trial of this system. No claim that
          using ESAP reduces mortality, length of stay or readmission. When those exist, they will be
          pre-registered and they will be linked here whichever way they come out.
        </Banner>
      </section>
    </SiteLayout>
  );
}
