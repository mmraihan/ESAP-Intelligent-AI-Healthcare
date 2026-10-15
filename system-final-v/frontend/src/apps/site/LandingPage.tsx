/**
 * Public landing page (§16.1, §16.7).
 *
 * The positioning is the blueprint's: intake-time decision support, calibrated
 * and explainable, for a clinician. The build-status honesty rule (§16.11)
 * applies here too — the page says what is live and what is not rather than
 * implying the whole roadmap ships today.
 *
 * Visual language follows additional-files/reference-files (light + dark).
 * The hero preview and impact rings show ILLUSTRATIVE values and say so; the
 * clinical screens keep the single-hue RiskGauge.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { MODELS } from "@/mock/db";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { SiteLayout } from "./SiteLayout";
import {
  ActivityIcon, AlertIcon, ArrowRight, BedIcon, BookIcon, ChartIcon, CheckIcon, ClockIcon, FileIcon,
  GlobeIcon, HeartPulseIcon, InfoIcon, LockIcon, RefreshIcon, ScaleIcon, ShieldIcon, SparkIcon,
  StethoscopeIcon, UserIcon,
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

/** Illustrative values for the three binary-risk models shown on the page. */
const DEMO: Record<string, { p: number; tone: "a" | "b" | "c"; icon: ReactNode; blurb: string }> = {
  "M-02": { p: 0.31, tone: "a", icon: <HeartPulseIcon size={20} />, blurb: "Risk of death during this hospital stay." },
  "M-03": { p: 0.44, tone: "b", icon: <BedIcon size={20} />, blurb: "Risk of requiring ICU care during this stay." },
  "M-04": { p: 0.18, tone: "c", icon: <RefreshIcon size={20} />, blurb: "Risk of unplanned readmission within 30 days of discharge." },
};

/** Adds `.is-in` to every `[data-reveal]` under the root as it scrolls into view. */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Full-circle progress ring (decorative; the number is always printed beside it). */
function Ring({ p, tone, size = 92, label }: { p: number; tone: string; size?: number; label?: string }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <span className={`lp-ring tone-${tone}`} style={{ width: size, height: size, "--ring-c": c, "--ring-off": c * (1 - p) } as CSSProperties}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="lp-ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="lp-ring-arc" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} />
      </svg>
      <span className="lp-ring-text">
        <strong className="tnum">{Math.round(p * 100)}%</strong>
        {label && <small>{label}</small>}
      </span>
    </span>
  );
}

/** The hero product preview — a stylised results screen with floating chrome. */
function HeroPreview() {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-orbit" />
      <svg className="lp-ecg" viewBox="0 0 600 120" preserveAspectRatio="none">
        <path
          className="ecg-trace"
          style={{ "--ecg-len": 900 } as CSSProperties}
          d="M0 60 H170 L188 60 L198 44 L210 60 L228 60 L240 12 L254 108 L266 60 L286 60 L302 40 L318 60 H600"
        />
      </svg>
      <div className="lp-panel lp-panel-back" />
      <div className="lp-window">
        <aside className="lp-window-side">
          <span className="lp-mini-brand"><span className="lp-mini-glyph" />ESAP</span>
          <span className="lp-side-item is-on"><UserIcon size={13} /> Overview</span>
          <span className="lp-side-item"><ChartIcon size={13} /> Predictions</span>
          <span className="lp-side-item"><FileIcon size={13} /> Evidence</span>
          <span className="lp-side-item"><BookIcon size={13} /> Notes</span>
        </aside>
        <div className="lp-window-main">
          <div className="lp-window-head">
            <div>
              <strong>Patient #48293</strong>
              <span>68 y/o · Male · Admitted 2h ago</span>
            </div>
            <span className="lp-tag">Illustrative</span>
          </div>
          <p className="lp-window-label">Key predictions</p>
          <div className="lp-tiles">
            {Object.entries(DEMO).map(([id, d], i) => (
              <div key={id} className={`lp-tile tone-${d.tone}`} style={{ "--i": i } as CSSProperties}>
                <span className="lp-tile-icon">{d.icon}</span>
                <small>{id === "M-02" ? "In-hospital mortality" : id === "M-03" ? "ICU admission" : "30-day readmission"}</small>
                <strong className="tnum">{Math.round(d.p * 100)}%</strong>
                <span className="lp-tile-bar"><span style={{ width: `${d.p * 100}%` }} /></span>
              </div>
            ))}
          </div>
          <div className="lp-why">
            <span>Why this prediction?</span>
            <div className="lp-why-chips">
              {["Age", "Comorbidities", "Vitals", "Labs", "Medications"].map((c, i) => (
                <span key={c} style={{ "--i": i } as CSSProperties}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="lp-float lp-float-checks">
        {["Evidence based", "Calibrated", "Transparent limits"].map((c) => (
          <span key={c}><CheckIcon size={13} /> {c}</span>
        ))}
      </div>
      <div className="lp-float lp-float-ai"><SparkIcon size={14} /> AI powered</div>
    </div>
  );
}

export function LandingPage() {
  const nav = useNavigate();
  const rootRef = useScrollReveal();
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
      <div ref={rootRef} className="lp">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="hero-eyebrow lp-in" style={{ "--i": 0 } as CSSProperties}>
              <ActivityIcon size={14} /> Intake-time clinical decision support
            </span>
            <h1 className="lp-in" style={{ "--i": 1 } as CSSProperties}>
              Five questions answered <span className="lp-grad">the hour a patient is admitted.</span>
            </h1>
            <p className="hero-lede lp-in" style={{ "--i": 2 } as CSSProperties}>
              ESAP reads what is known at admission and estimates what is likely already present, how the
              stay is likely to go, and how long it is likely to last — with the reasoning attached, the
              calibration stated, and the limits printed on the same card as the number.
            </p>
            <div className="hero-actions lp-in" style={{ "--i": 3 } as CSSProperties}>
              <Button variant="primary" className="lp-cta" onClick={() => nav("/signup")}>
                <ArrowRight size={15} /> Try it on your own cases
              </Button>
              <Button onClick={() => nav("/evidence")}>
                <FileIcon size={15} /> See the evidence <ArrowRight size={13} />
              </Button>
              <Button onClick={() => nav("/pricing")}>See pricing</Button>
            </div>
            <p className="lp-note lp-in" style={{ "--i": 4 } as CSSProperties}>
              <LockIcon size={13} /> Free tier, no card. Nothing you enter is retained on the free tier.
            </p>
          </div>
          <HeroPreview />
        </section>

        <section className="lp-section">
          <header className="lp-section-head" data-reveal>
            <span className="lp-kicker">The impact</span>
            <h2>Better insights. Better decisions.</h2>
            <p>
              ESAP helps clinicians anticipate what is next — so they can act sooner, plan smarter and give
              every patient the right care at the right time.
            </p>
          </header>
          <div className="lp-impact">
            {MODELS.slice(1, 4).map((m, i) => {
              const d = DEMO[m.id] ?? { p: 0.3, tone: "a" as const, icon: <ActivityIcon size={20} />, blurb: m.outcome };
              return (
                <article key={m.id} className={`lp-impact-card tone-${d.tone}`} data-reveal style={{ "--i": i } as CSSProperties}>
                  <div className="lp-impact-top">
                    <span className="lp-impact-icon">{d.icon}</span>
                    <div>
                      <h3>{m.name}</h3>
                      <p>{d.blurb}</p>
                    </div>
                  </div>
                  <Ring p={d.p} tone={d.tone} size={108} label="risk" />
                  <p className="lp-impact-foot">
                    <InfoIcon size={13} />
                    <span>
                      Illustrative demo value — not a patient-specific prediction.
                      {m.headline?.[0] && <> {m.id} {m.headline[0].label} {m.headline[0].value} · ECE {(m.ece ?? 0).toFixed(3)}</>}
                    </span>
                  </p>
                </article>
              );
            })}
            <article className="lp-impact-card lp-impact-explain" data-reveal style={{ "--i": 3 } as CSSProperties}>
              <span className="lp-impact-icon"><ShieldIcon size={20} /></span>
              <h3>Transparent &amp; explainable</h3>
              <p>
                Every prediction comes with its <strong>reasoning</strong>, its <strong>calibration</strong> and
                its limits — on the same card as the number.
              </p>
            </article>
          </div>
        </section>

        <section className="lp-section lp-split" data-reveal>
          <div>
            <span className="lp-kicker">Design principle</span>
            <h2>Why the colour is not a stoplight</h2>
          </div>
          <p className="hero-lede">
            Clinical gauges use one calm blue ramp. A red/amber/green gauge trains the eye to snap-judge —
            green means ignore, red means act — which is exactly the over-reliance that turns decision
            support into the software making the call. It is also the most common colour-vision
            confusion there is, affecting roughly one in twelve men. Our gauges are deliberately
            un-skimmable at the &ldquo;just glance at the colour&rdquo; level and maximally readable at
            the &ldquo;read the number and the label&rdquo; level.
          </p>
        </section>

        <section className="feature-grid">
          {PILLARS.map((p, i) => (
            <article key={p.title} className="feature" data-reveal style={{ "--i": i } as CSSProperties}>
              <span className="feature-icon">{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </section>

        <section className="lp-section">
          <header className="lp-section-head" data-reveal>
            <span className="lp-kicker">Who it is for</span>
            <h2>Built for the whole ward, not just the physician</h2>
          </header>
          <div className="feature-grid">
            {AUDIENCES.map((a, i) => (
              <article key={a.who} className="feature" data-reveal style={{ "--i": i } as CSSProperties}>
                <span className="feature-icon">{a.icon}</span>
                <h3>{a.who}</h3>
                <p>{a.what}</p>
              </article>
            ))}
          </div>
        </section>

        <section data-reveal>
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
          <div data-reveal style={{ "--i": 0 } as CSSProperties}>
            <Card className="card-interactive" title={<span className="row" style={{ gap: 8 }}><GlobeIcon size={18} /> Works with your EHR, not against it</span>}>
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                SMART on FHIR launch, HL7v2 ADT for encounter creation, FHIR R4 for problem lists and labs.
                ESAP reads; it never writes back into the patient record unless you build that yourself.
              </p>
              <Button onClick={() => nav("/security")}>How the integration works</Button>
            </Card>
          </div>
          <div data-reveal style={{ "--i": 1 } as CSSProperties}>
            <Card className="card-interactive" title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> Your data stays yours</span>}>
              <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                Tenant isolation up to a dedicated VPC, US or EU residency, on-prem delivery, and zero
                standing vendor access to any patient record. You can switch off our ability to request
                emergency access entirely.
              </p>
              <Button onClick={() => nav("/security")}>Security and compliance</Button>
            </Card>
          </div>
        </section>

        <section className="lp-final" data-reveal>
          <div>
            <h2>Start where it costs you nothing</h2>
            <p>Run it on your own cases today. Bring it to the ward when the evidence convinces you.</p>
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" className="lp-cta" onClick={() => nav("/signup")}>Create a free account</Button>
            <Button onClick={() => nav("/pricing")}>See pricing</Button>
            <Badge tone="neutral">90-day hospital pilot available</Badge>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
