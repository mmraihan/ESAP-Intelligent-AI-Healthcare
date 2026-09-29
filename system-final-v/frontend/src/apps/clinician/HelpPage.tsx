/**
 * "How to read a result" — the clinician-facing explainer.
 *
 * This page is a safety control, not documentation. Most of the ways a
 * probability gets misused come from reading it as a statement about the
 * individual, or reading colour instead of number. Both are addressed head-on.
 */
import { AssistiveLine } from "@/components/ui/domain";
import { Card, PageHeader } from "@/components/ui/primitives";
import { RiskGauge } from "@/components/ui/charts";
import { AlertIcon, CheckIcon, ScaleIcon, XIcon } from "@/components/ui/icons";

const RAMP = [0.02, 0.09, 0.22, 0.38, 0.62, 0.88];

export function HelpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Orientation"
        title="How to read a result"
        lede="Five minutes that will stop the two mistakes people actually make with this tool."
      />

      <div className="split">
        <div className="stack" style={{ gap: 18 }}>
          <Card title="Mistake 1 — reading a probability as a statement about this person">
            <div className="prose">
              <p>
                When the mortality card reads <strong>31%</strong>, it does not mean this patient has a
                31% chance of dying. It means: <em>of past admissions that looked like this one at the
                moment of admission, about 31% did not survive to discharge.</em>
              </p>
              <p>
                That is a statement about a population, and the patient in front of you is one person who
                may differ from that population in ways the model never saw — because the model only saw
                what was recorded by admission time.
              </p>
              <p>
                This is why every card prints a phrase next to the number (&ldquo;in the upper range of
                admissions&rdquo;) rather than just the figure. The phrase is the honest reading.
              </p>
            </div>
          </Card>

          <Card title="Mistake 2 — reading the colour instead of the number">
            <div className="prose">
              <p>
                The gauges use one blue ramp that gets darker as the estimate rises. They are
                deliberately <strong>not</strong> red / amber / green.
              </p>
              <p>
                A stoplight trains the eye to snap-judge — green means ignore, red means act — and that
                is exactly the over-reliance this tool is designed to avoid. A single calm ramp forces
                you to read the number and the label, which is the behaviour that keeps the software as
                decision <em>support</em>.
              </p>
              <p>
                There is a second reason. Red/green confusion is the most common colour-vision
                deficiency, affecting roughly one in twelve men. A stoplight gauge is a patient-safety
                defect for a real share of any clinical workforce.
              </p>
            </div>
            <div className="ramp-demo">
              {RAMP.map((v) => (
                <div key={v} className="ramp-step">
                  <span className="ramp-swatch" style={{ background: `var(--seq-${v < 0.05 ? 100 : v < 0.15 ? 250 : v < 0.3 ? 400 : v < 0.5 ? 500 : v < 0.75 ? 600 : 700})` }} />
                  <span className="tnum">{(v * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="What each of the five models answers">
            <table className="data-table is-dense">
              <thead><tr><th>Model</th><th>The question it answers</th><th>Frame</th></tr></thead>
              <tbody>
                <tr><td><strong>M-01</strong></td><td>Which conditions may already be present at admission?</td><td>Presence, not prediction</td></tr>
                <tr><td><strong>M-02</strong></td><td>How often did similar admissions not survive to discharge?</td><td>This admission only</td></tr>
                <tr><td><strong>M-03</strong></td><td>How often did similar admissions reach the ICU at some point?</td><td>Any time in the stay</td></tr>
                <tr><td><strong>M-04</strong></td><td>How often did similar patients come back within 30 days?</td><td>Intake frame, not discharge</td></tr>
                <tr><td><strong>M-05</strong></td><td>How long did similar admissions stay?</td><td>An interval, not a number</td></tr>
              </tbody>
            </table>
          </Card>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <Card title="The gauge, annotated">
            <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
              <RiskGauge label="In-hospital mortality" modelId="M-02" probability={0.31} calibrated />
            </div>
            <ul className="caveat-list">
              <li><CheckIcon size={13} /> <strong>The arc length</strong> carries the magnitude — it works with the colour removed.</li>
              <li><CheckIcon size={13} /> <strong>The number</strong> is the estimate, always printed, never below 24px.</li>
              <li><CheckIcon size={13} /> <strong>The phrase</strong> tells you where that sits against other admissions.</li>
              <li><CheckIcon size={13} /> <strong>The badge</strong> says whether the number means what it says.</li>
            </ul>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><CheckIcon size={16} /> Calibrated vs. uncalibrated</span>}>
            <div className="prose">
              <p>
                <strong>Calibrated</strong> means the number has been checked against reality: of the
                cases called 30%, close to 30% actually had the outcome.
              </p>
              <p>
                <strong>Uncalibrated</strong> is not a fault — it is expected early in a deployment. It
                means the ordering is trustworthy but the absolute figure may be off.
              </p>
              <p>
                <strong>Calibration reduced</strong> means this specific case had required inputs
                imputed. The badge is suppressed entirely rather than shown with a caveat, because a
                calibration claim with an asterisk gets read as a calibration claim.
              </p>
            </div>
          </Card>

          <Card title="When to disregard it entirely">
            <ul className="caveat-list">
              <li><XIcon size={13} /> When the intake is wrong. Fix the intake and re-run; do not mentally adjust the output.</li>
              <li><XIcon size={13} /> When the patient has clearly changed since admission. Nothing after t₀ is in the estimate.</li>
              <li><XIcon size={13} /> When the model is flagged degraded for the stratum this patient is in.</li>
              <li><XIcon size={13} /> Any time your own assessment disagrees. You are the decision-maker; record the disagreement in the acknowledgement note.</li>
            </ul>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><ScaleIcon size={16} /> What is never used</span>}>
            <p className="prose" style={{ margin: 0 }}>
              Race, insurance status and marital status are recorded for the fairness audit and are
              never model inputs. If you ever see one of them on a clinical screen, that is a defect —
              report it.
            </p>
          </Card>

          <Card title={<span className="row" style={{ gap: 7 }}><AlertIcon size={16} /> Reporting a problem</span>}>
            <p className="prose" style={{ margin: 0 }}>
              A wrong-patient banner, an estimate that cannot be right, a Why panel that does not match
              the chart — these go to your informatics team, who can escalate to ESAP. Support access to
              a named patient requires an audited break-glass elevation; nobody at ESAP can read a chart
              on request.
            </p>
          </Card>
        </div>
      </div>

      <AssistiveLine />
    </>
  );
}
