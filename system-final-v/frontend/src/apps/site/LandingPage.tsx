/**
 * Public landing page (§16.1, §16.7).
 *
 * The positioning is the blueprint's: intake-time decision support, calibrated
 * and explainable, for a clinician. The build-status honesty rule (§16.11)
 * applies here too — the page says what is live and what is not rather than
 * implying the whole roadmap ships today.
 */
import { useNavigate } from "react-router-dom";
import { MODELS } from "@/mock/db";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { RiskGauge } from "@/components/ui/charts";
import { SiteLayout } from "./SiteLayout";
import { WaitlistSection } from "./WaitlistSection";
import {
  ActivityIcon, AlertIcon, ArrowRight, BookIcon, CheckIcon, ClockIcon, GlobeIcon, HeartPulseIcon,
  ScaleIcon, ShieldIcon, SparkIcon, StethoscopeIcon,
} from "@/components/ui/icons";

const PILLARS = [
  {
    icon: <ClockIcon size={20} />,
    title: "Answers at intake, not at discharge",
    body: "Every estimate uses only what is known at the moment of admission. That constraint is what makes it useful — a prediction that needs the whole stay to be accurate arrives too late to change anything.",
  },
  {
    icon: <ScaleIcon size={20} />,
    title: "Calibrated, and honest when it is not",
    body: "A probability means what it says: of the cases called 30%, close to 30% had the outcome. When a specific case has too little input for that to hold, the badge is suppressed rather than qualified.",
  },
  {
    icon: <BookIcon size={20} />,
    title: "Every number carries its reasoning",
    body: "The drivers behind an estimate are computed from the model itself, not narrated afterwards by a language model. A clinician can review the basis independently — which is also what keeps this non-device decision support.",
  },
  {
    icon: <ShieldIcon size={20} />,
    title: "Fairness reported, not asserted",
    body: "Performance is broken out by subgroup and published to your own compliance team. Race and insurance are recorded so that report can exist, and are never model inputs.",
  },
];

const AUDIENCES = [
  { icon: <StethoscopeIcon size={20} />, who: "Attending physicians", what: "A ranked differential and four risk estimates at admission, each with its drivers and its limits." },
  { icon: <ActivityIcon size={20} />, who: "Charge nurses", what: "The whole unit ranked, so staffing goes where the risk is rather than where the noise is." },
  { icon: <HeartPulseIcon size={20} />, who: "Case managers", what: "Length of stay and readmission on one screen, from the day of admission rather than the day before discharge." },
  { icon: <ShieldIcon size={20} />, who: "Privacy officers", what: "An append-only access log, a fairness panel, and visibility of everything the vendor did in your tenant." },
];

export function LandingPage() {
  const nav = useNavigate();
  const m01 = MODELS[0];
  // The model cards arrive with a rich headline only when the trained metrics
  // are on this server; without them each card is served "not ready" with a
  // single-entry headline. The public page must render either way, so read the
  // labels-scored figure by its label (not a fixed index) and fall back to the
  // known design figure rather than crashing on an absent entry.
  const labelsScored =
    m01?.headline?.find((h) => h.label === "Labels scored")?.value ?? "500+";

  return (
    <SiteLayout>
      <section className="hero">
        <span className="hero-eyebrow"><SparkIcon size={14} /> Intake-time clinical decision support</span>
        <h1>Five questions answered the hour a patient is admitted.</h1>
        <p className="hero-lede">
          ESAP reads what is known at admission and estimates what is likely already present, how the
          stay is likely to go, and how long it is likely to last — with the reasoning attached, the
          calibration stated, and the limits printed on the same card as the number.
        </p>
        <div className="hero-actions">
          <Button variant="primary" onClick={() => nav("/signup")}>Try it on your own cases</Button>
          <Button onClick={() => nav("/evidence")}>See the evidence <ArrowRight size={14} /></Button>
          <Button onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}>
            Join the waitlist
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          Free tier, no card. Nothing you enter is retained on the free tier.
        </p>
      </section>

      <section className="grid grid-3">
        {MODELS.slice(1, 4).map((m) => (
          <Card key={m.id} title={`${m.id} — ${m.name}`} subtitle={m.outcome}>
            <div style={{ display: "grid", placeItems: "center" }}>
              <RiskGauge
                label={m.name}
                modelId={m.id}
                probability={m.id === "M-02" ? 0.31 : m.id === "M-03" ? 0.44 : 0.18}
                calibrated={m.status === "live"}
                size={118}
              />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: "center" }}>
              {m.headline?.[0]?.label} {m.headline?.[0]?.value} · ECE {(m.ece ?? 0).toFixed(3)}
            </p>
          </Card>
        ))}
      </section>

      <section className="stack" style={{ gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 26, margin: 0, letterSpacing: "-0.02em" }}>Why the colour is not a stoplight</h2>
          <p className="hero-lede" style={{ marginTop: 8 }}>
            Every gauge uses one calm blue ramp. A red/amber/green gauge trains the eye to snap-judge —
            green means ignore, red means act — which is exactly the over-reliance that turns decision
            support into the software making the call. It is also the most common colour-vision
            confusion there is, affecting roughly one in twelve men. Our gauges are deliberately
            un-skimmable at the &ldquo;just glance at the colour&rdquo; level and maximally readable at
            the &ldquo;read the number and the label&rdquo; level.
          </p>
        </div>
      </section>

      <section className="feature-grid">
        {PILLARS.map((p) => (
          <article key={p.title} className="feature">
            <span className="feature-icon">{p.icon}</span>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </article>
        ))}
      </section>

      <section className="stack" style={{ gap: 18 }}>
        <h2 style={{ fontSize: 24, margin: 0, letterSpacing: "-0.02em" }}>Built for the whole ward, not just the physician</h2>
        <div className="feature-grid">
          {AUDIENCES.map((a) => (
            <article key={a.who} className="feature">
              <span className="feature-icon">{a.icon}</span>
              <h3>{a.who}</h3>
              <p>{a.what}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <Card
          title="What is live today, and what is not"
          subtitle="§16.11 — we would rather tell you now than in the pilot"
          footnote="If a vendor's roadmap and their product look identical in a demo, ask which screens are real. These ones are."
        >
          <div className="split">
            <div>
              <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Live</h3>
              <ul className="caveat-list">
                <li><CheckIcon size={14} /> M-01 differential over {labelsScored} CCSR categories, tabular tower.</li>
                <li><CheckIcon size={14} /> M-02 mortality, M-03 ICU, M-05 length of stay — calibrated and stratified.</li>
                <li><CheckIcon size={14} /> Per-estimate explanation computed from the model.</li>
                <li><CheckIcon size={14} /> Admin console, audit log, fairness panel.</li>
                <li><CheckIcon size={14} /> ESAP-to-ESAP and TEFCA record transfer.</li>
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Not yet</h3>
              <ul className="caveat-list">
                <li><AlertIcon size={14} /> M-04 readmission is serving <strong>degraded</strong> — close to chance on patients with no prior admission, and labelled as such everywhere it appears.</li>
                <li><AlertIcon size={14} /> Note-embedding and sequence towers are built but not fused into production scoring.</li>
                <li><AlertIcon size={14} /> Next-best-test is designed and deliberately renders empty until it is validated.</li>
                <li><AlertIcon size={14} /> No outcome study yet. Before/after numbers are associations, and we say so on the screen that shows them.</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid grid-2">
        <Card title={<span className="row" style={{ gap: 8 }}><GlobeIcon size={18} /> Works with your EHR, not against it</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            SMART on FHIR launch, HL7v2 ADT for encounter creation, FHIR R4 for problem lists and labs.
            ESAP reads; it never writes back into the patient record unless you build that yourself.
          </p>
          <Button onClick={() => nav("/security")}>How the integration works</Button>
        </Card>
        <Card title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> Your data stays yours</span>}>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            Tenant isolation up to a dedicated VPC, US or EU residency, on-prem delivery, and zero
            standing vendor access to any patient record. You can switch off our ability to request
            emergency access entirely.
          </p>
          <Button onClick={() => nav("/security")}>Security and compliance</Button>
        </Card>
      </section>

      <section>
        <Card title="Start where it costs you nothing">
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" onClick={() => nav("/signup")}>Create a free account</Button>
            <Button onClick={() => nav("/pricing")}>See pricing</Button>
            <Badge tone="neutral">90-day hospital pilot available</Badge>
          </div>
        </Card>
      </section>

      <WaitlistSection />
    </SiteLayout>
  );
}
