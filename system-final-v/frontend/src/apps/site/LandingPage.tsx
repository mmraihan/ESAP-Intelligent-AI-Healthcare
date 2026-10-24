/**
 * Public landing page (§16.1, §16.7).
 *
 * The positioning is the blueprint's: intake-time decision support, calibrated
 * and explainable, for a clinician. The build-status honesty rule (§16.11)
 * applies: every figure on a mock screen is labelled illustrative, and the
 * stat band only prints numbers that are true of the product.
 *
 * Visual language follows additional-files/reference-files/ESAP_Clinical_AI_Landing_Page_1*.png:
 * bold geometric sans display type with a gradient second half, a tilted
 * product-dashboard mock, ring-gauge impact cards, a light hero in light mode
 * and a navy hero with cyan / violet glows in dark mode. Styles are scoped
 * under `.au` in styles/landing.css; the palette comes from the `.pub` tokens
 * in styles/public.css, shared with the other public pages.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "@/styles/landing.css";
import { MODELS } from "@/mock/db";
import { BrandMark } from "@/components/shell/AppShell";
import { HeartMonitor } from "@/components/ui/HeartMonitor";
import { SiteFooter, SiteHeader } from "./SiteLayout";
import { CareStory } from "./CareStory";
import { ProductExplode } from "./ProductExplode";
import {
  ActivityIcon, ArrowRight, BedIcon, BookIcon, BuildingIcon, ChartIcon, CheckIcon, ChevronDown, ClockIcon,
  FileIcon, FlaskIcon, GlobeIcon, HeartPulseIcon, InfoIcon, LockIcon, PillIcon, RefreshIcon, ScaleIcon,
  ShieldIcon, StethoscopeIcon, UserIcon, UsersIcon,
} from "@/components/ui/icons";

const SECTIONS = [
  { id: "admission", label: "Admission" },
  { id: "story", label: "Story" },
  { id: "inside", label: "Inside" },
  { id: "impact", label: "Impact" },
  { id: "intake", label: "Intake" },
  { id: "estimate", label: "Estimate" },
  { id: "review", label: "Review" },
  { id: "principle", label: "Principle" },
  { id: "platform", label: "Platform" },
  { id: "faq", label: "FAQ" },
] as const;

/** Illustrative values for the three binary-risk models shown on the page. */
const DEMO = [
  {
    id: "M-02", hue: "g1", p: 0.31, icon: <HeartPulseIcon size={18} />, title: "In-hospital mortality",
    body: "Binary · death before discharge.",
  },
  {
    id: "M-03", hue: "g2", p: 0.44, icon: <BedIcon size={18} />, title: "ICU admission",
    body: "Binary · an ICU stay at any point in the admission.",
  },
  {
    id: "M-04", hue: "g3", p: 0.18, icon: <RefreshIcon size={18} />, title: "30-day readmission",
    body: "Binary · unplanned return within 30 days of discharge.",
  },
] as const;

const WHY_CHIPS = ["Age", "Comorbidities", "Vitals", "Labs", "Medications"];

const INPUTS = [
  { icon: <HeartPulseIcon size={16} />, name: "Triage vitals", count: "7 signals" },
  { icon: <FlaskIcon size={16} />, name: "Labs drawn before t₀", count: "23 results" },
  { icon: <FileIcon size={16} />, name: "Prior diagnoses", count: "11 codes" },
  { icon: <PillIcon size={16} />, name: "Home medications", count: "6 drugs" },
  { icon: <UserIcon size={16} />, name: "Chief complaint & demographics", count: "4 fields" },
];

/** The five models, with illustrative values and drivers for the demo stage. */
const ESTIMATES = [
  {
    id: "M-01", title: "Differential diagnosis", icon: <StethoscopeIcon size={18} />,
    body: "A ranked list over 500+ CCSR conditions likely already present at admission.",
    value: "Top 20", unit: "ranked conditions",
    drivers: [
      { src: "Labs · troponin", text: <>Rising <mark>troponin before admission</mark> moves cardiac causes up the list.</> },
      { src: "History · prior dx", text: <>A <mark>prior heart-failure code</mark> keeps decompensation in the top five.</> },
    ],
  },
  {
    id: "M-02", title: "In-hospital mortality", icon: <HeartPulseIcon size={18} />,
    body: "Risk of death during this stay, calibrated so 30% means close to 30%.",
    value: "31%", unit: "illustrative",
    drivers: [
      { src: "Vitals · triage", text: <><mark>Low systolic pressure</mark> at triage is the largest single contributor.</> },
      { src: "Demographics", text: <>Age adds risk; <mark>no prior admissions</mark> widens the uncertainty.</> },
    ],
  },
  {
    id: "M-03", title: "ICU admission", icon: <BedIcon size={18} />,
    body: "Risk of needing intensive care at any point in the stay.",
    value: "44%", unit: "illustrative",
    drivers: [
      { src: "Vitals · triage", text: <><mark>Respiratory rate of 28</mark> and falling SpO₂ drive most of the estimate.</> },
      { src: "Labs · lactate", text: <>A <mark>lactate above 4</mark> drawn in the emergency department.</> },
    ],
  },
  {
    id: "M-04", title: "30-day readmission", icon: <RefreshIcon size={18} />,
    body: "Risk of unplanned return within 30 days, reported separately for patients with and without history.",
    value: "18%", unit: "illustrative",
    drivers: [
      { src: "History · encounters", text: <><mark>Two admissions in the past year</mark> is the strongest signal.</> },
      { src: "Medications", text: <>Ten or more <mark>home medications</mark> adds modest risk.</> },
    ],
  },
  {
    id: "M-05", title: "Length of stay", icon: <ClockIcon size={18} />,
    body: "Expected days in hospital, from the day of admission rather than the day before discharge.",
    value: "5.2", unit: "days · illustrative",
    drivers: [
      { src: "Complaint", text: <>A <mark>hip fracture</mark> complaint sets the baseline stay.</> },
      { src: "Social · discharge", text: <><mark>Lives alone</mark> lengthens the expected time to a safe discharge.</> },
    ],
  },
];

const GUARDS = ["No stoplight colours", "No automatic orders", "Badge suppressed on thin input", "No raw score for patients"];

const PLATFORM = [
  { icon: <BuildingIcon size={18} />, title: "Hospital admin console", body: "Roster, invites, facilities and roles — one tenant, walled off from every other." },
  { icon: <BookIcon size={18} />, title: "Append-only audit log", body: "Every estimate, every view and every break-glass access, with the reason recorded." },
  { icon: <ScaleIcon size={18} />, title: "Fairness panel", body: "Performance by subgroup, published to your own compliance team rather than asserted." },
  { icon: <GlobeIcon size={18} />, title: "SMART on FHIR", body: "Launch from the EHR, HL7v2 ADT for new encounters, FHIR R4 for problems and labs." },
  { icon: <LockIcon size={18} />, title: "Your data stays yours", body: "US or EU residency, a dedicated VPC or on-prem, and zero standing vendor access." },
  { icon: <UsersIcon size={18} />, title: "Patient portal", body: "Plain language, no raw scores, and the patient decides who sees their record." },
];

const AUDIENCES = [
  { icon: <StethoscopeIcon size={16} />, who: "Attending physicians", what: "A ranked differential and four risk estimates at admission." },
  { icon: <ActivityIcon size={16} />, who: "Charge nurses", what: "The whole unit ranked, so staffing goes where the risk is." },
  { icon: <HeartPulseIcon size={16} />, who: "Case managers", what: "Length of stay and readmission from day one." },
  { icon: <ShieldIcon size={16} />, who: "Privacy officers", what: "An access log and fairness panel they can read themselves." },
  { icon: <BuildingIcon size={16} />, who: "Hospital administrators", what: "Usage, rollout and model versions in one console." },
  { icon: <UserIcon size={16} />, who: "Patients & carers", what: "A plain-language portal with no raw scores." },
];

const FAQ = [
  { q: "Does ESAP diagnose?", a: "No. It is clinical decision support. It estimates, shows its reasoning and its limits, and a qualified clinician reviews every estimate and makes the call." },
  { q: "Why only data from admission?", a: "Because a prediction that needs the whole stay arrives too late to change anything. Every input is cut at t₀, the admission time, and the training data was cut the same way." },
  { q: "What does “calibrated” mean here?", a: "Of the cases called 30%, close to 30% had the outcome. When a specific case has too little input for that to hold, the calibration badge is suppressed rather than qualified." },
  { q: "Are race or insurance used by the models?", a: "Never as inputs. They are recorded only so that performance can be reported by subgroup on the fairness panel." },
  { q: "Can I try it without a hospital contract?", a: "Yes. The free individual tier needs no card, and nothing you enter is retained on it." },
];

/** Marks every `[data-au-reveal]` under the page as shown the first time it scrolls into view. */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-au-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.setAttribute("data-shown", "");
        io.unobserve(e.target);
      }),
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Which section is under the middle of the viewport, for the side rail. */
function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return active;
}

function Eyebrow({ n, children }: { n?: string; children: ReactNode }) {
  return <span className="au-eyebrow">{n && <span className="au-eyebrow-n">{n}</span>}{children}</span>;
}

/** Soft edge glows behind a band: gradients painted inside the band, so nothing extends past it. */
function Glows() {
  return (
<div className="au-glows" aria-hidden="true" />
  );
}

const MOTION_OK = "(prefers-reduced-motion: no-preference)";
/** Ambient, pointer-driven motion only where there is a mouse and motion is welcome. */
const AMBIENT_OK = `(hover: hover) and (pointer: fine) and ${MOTION_OK}`;

/**
 * Counts up to `to` once the gauge scrolls into view, in step with the ring's
 * arc (same 0.35s delay, 1.3s, strong ease-out). Writes textContent directly so
 * React never re-renders per frame. Reduced motion just prints the value.
 */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = String(to);
    if (typeof IntersectionObserver === "undefined" || !window.matchMedia?.(MOTION_OK).matches) return;
    el.textContent = "0";
    let raf = 0;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 1300);
            el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 4))));
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }, 350);
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      el.textContent = String(to);
    };
  }, [to]);
  return <span ref={ref} />;
}

/**
 * Slow tilt of the hero mock toward the cursor, on fine pointers only. One
 * passive listener on the hero; a time-based ease toward the target written
 * straight to the element's transform, and the loop stops once it settles.
 */
function useHeroTilt() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const hero = el?.closest("section");
    if (!el || !hero || !window.matchMedia?.(AMBIENT_OK).matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, last = 0;
    const step = (now: number) => {
      const k = 1 - Math.exp(-(now - (last || now - 16)) / 140);
      last = now;
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.transform = `perspective(1600px) rotateX(${y.toFixed(3)}deg) rotateY(${x.toFixed(3)}deg)`;
      if (Math.abs(tx - x) > 0.005 || Math.abs(ty - y) > 0.005) raf = requestAnimationFrame(step);
      else raf = last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 5;
      ty = -((e.clientY - r.top) / r.height - 0.5) * 4;
      kick();
    };
    const onLeave = () => {
      tx = ty = 0;
      kick();
    };
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, []);
  return ref;
}

/**
 * Primary CTA leans a few pixels toward the cursor while it is over it, and
 * springs back on leave (the CSS transition does the easing). Fine pointers
 * with motion welcome only; everyone else gets the plain button.
 */
function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia?.(AMBIENT_OK).matches) return;
    const clamp = (v: number) => Math.max(-6, Math.min(6, v));
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mg-x", `${clamp((e.clientX - r.left - r.width / 2) * 0.2).toFixed(1)}px`);
      el.style.setProperty("--mg-y", `${clamp((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
    };
    const onLeave = () => {
      el.style.removeProperty("--mg-x");
      el.style.removeProperty("--mg-y");
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return <span ref={ref} className="au-magnet">{children}</span>;
}

/** Ring gauge. Decorative: the number is printed inside it and beside it in text. */
function Ring({ p, size = 116, label }: { p: number; size?: number; label?: string }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <span className="au-ring" style={{ width: size, height: size, "--c": c, "--off": c * (1 - p) } as CSSProperties}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="au-ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle className="au-ring-arc" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} />
      </svg>
      <span className="au-ring-text">
        <strong className="tnum">
          <span className="visually-hidden">{Math.round(p * 100)}%</span>
          <span aria-hidden="true"><CountUp to={Math.round(p * 100)} />%</span>
        </strong>
        {label && <small>{label}</small>}
      </span>
    </span>
  );
}

const ECG = "M0 60 H70 L80 60 L88 46 L96 60 L108 60 L116 18 L126 100 L134 60 L150 60 L160 48 L170 60 H240";

/**
 * The hero's product dashboard mock: a tilted results window over a slab with
 * an ECG trace, and a checklist card beside it. Every value is illustrative
 * and the window says so. The checklist sits in its own column, beside the
 * window rather than over it, so it never covers data at any width.
 */
function HeroDashboard() {
  const tilt = useHeroTilt();
  return (
    <div className="au-visual" aria-hidden="true">
      <div className="au-float" ref={tilt}>
        <div className="au-tilt">
          <div className="au-slab">
            <svg viewBox="0 0 240 120" preserveAspectRatio="none">
              <path className="au-slab-ecg" d={ECG} pathLength={1000} />
            </svg>
          </div>
          <div className="au-window">
            <aside className="au-win-side">
              <span className="au-win-brand">
                <BrandMark size={22} withWordmark={false} />
                <span><strong>ESAP</strong><small>Clinical AI</small></span>
              </span>
              <span className="au-win-item is-on"><UserIcon size={13} /> Overview</span>
              <span className="au-win-item"><ChartIcon size={13} /> Predictions</span>
              <span className="au-win-item"><FileIcon size={13} /> Evidence</span>
              <span className="au-win-item"><BookIcon size={13} /> Notes</span>
            </aside>
            <div className="au-win-main">
              <div className="au-win-head">
                <div>
                  <strong>Patient #48293</strong>
                  <span>68 y/o · Male · Admitted 2h ago</span>
                </div>
                <span className="au-win-tag">Illustrative</span>
              </div>
              <p className="au-win-label">Key predictions</p>
              <div className="au-tiles">
                {DEMO.map((d, i) => (
                  <div key={d.id} className={`au-tile ${d.hue}`} style={{ "--i": i } as CSSProperties}>
                    <span className="au-tile-icon">{d.icon}</span>
                    <small>{d.title}</small>
                    <strong className="tnum">{Math.round(d.p * 100)}%</strong>
                    <span className="au-tile-sub">illustrative</span>
                  </div>
                ))}
              </div>
              <div className="au-why">
                <div className="au-why-top">
                  <span>Why this prediction?</span>
                  <span className="au-why-link">View reasoning <ArrowRight size={11} /></span>
                </div>
                <div className="au-why-chips">
                  {WHY_CHIPS.map((c, i) => <span key={c} style={{ "--i": i } as CSSProperties}>{c}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="au-checklist">
        {["Evidence based", "Calibrated", "Transparent limits"].map((c, i) => (
          <span key={c} style={{ "--i": i } as CSSProperties}><CheckIcon size={12} /> {c}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Auto-advancing model tabs. The progress bar's CSS animation is the timer:
 * when it ends, the next tab is selected. Hover, focus or scrolling the panel
 * off-screen pauses it; reduced motion hides the bar, which stops autoplay.
 */
function EstimateSteps() {
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const cur = ESTIMATES[sel];
  return (
    <div
      ref={wrap}
      className="au-steps-wrap"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="au-steps" role="tablist" aria-label="The five models" data-paused={paused || offscreen ? "" : undefined}>
        {ESTIMATES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            id={`au-tab-${e.id}`}
            aria-selected={i === sel}
            aria-controls="au-stage"
            className="au-step"
            onClick={() => setSel(i)}
          >
            <span className="au-step-num">{e.id}</span>
            <span>
              <span className="au-step-title">{e.title}</span>
              <span className="au-step-body"><span>{e.body}</span></span>
            </span>
            {i === sel && (
              <span className="au-step-bar" onAnimationEnd={() => setSel((s) => (s + 1) % ESTIMATES.length)} />
            )}
          </button>
        ))}
      </div>

      <div id="au-stage" className="au-stage" role="tabpanel" aria-labelledby={`au-tab-${cur.id}`}>
        <div key={cur.id} className="au-stage-panel">
          <div className="au-stage-head">
            <span className="au-stage-icon">{cur.icon}</span>
            <div>
              <span className="au-mono">{cur.id}</span>
              <strong>{cur.title}</strong>
            </div>
            <span className="au-stage-val">
              <strong className="tnum">{cur.value}</strong>
              <small>{cur.unit}</small>
            </span>
          </div>
          <span className="au-mono au-stage-label">Why this estimate</span>
          {cur.drivers.map((d, i) => (
            <div key={d.src} className="au-src" style={{ "--i": i } as CSSProperties}>
              <span className="au-src-file"><FileIcon size={13} /> {d.src}</span>
              <p>{d.text}</p>
            </div>
          ))}
          <span className="au-chip au-chip-ok"><CheckIcon size={12} /> calibrated · reviewed by a clinician</span>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="au-faq-item" data-open={open ? "" : undefined}>
      <button type="button" className="au-faq-q" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        <ChevronDown size={18} />
      </button>
      <div className="au-faq-a"><p>{a}</p></div>
    </div>
  );
}

export function LandingPage() {
  const rootRef = useReveal();
  const active = useActiveSection();
  // The model cards carry the labels-scored figure only when trained metrics
  // are on this server; fall back to the design figure rather than crash.
  const labelsScored = MODELS[0]?.headline?.find((h) => h.label === "Labels scored")?.value ?? "500+";

  return (
    <div ref={rootRef} className="pub au">
      <SiteHeader />
      <div className="au-progress" aria-hidden="true" />

      <nav className="au-rail" aria-label="Page sections">
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} className="au-rail-btn" aria-current={active === s.id ? "true" : undefined}>
            <span className="au-rail-label">{String(i).padStart(2, "0")} {s.label}</span>
            <span className="au-rail-dot" />
          </a>
        ))}
      </nav>

      {/* 00 · Admission */}
      <section id="admission" className="au-hero">
        <Glows />
        <div className="au-wrap au-hero-inner">
          <div className="au-hero-copy">
            {/* Reference layout: pill, a large headline whose last word carries
                the gradient, then the lede and CTAs. */}
            <span className="au-badge au-hero-badge au-rise" style={{ "--i": 0 } as CSSProperties}>
              <span className="au-badge-pulse" aria-hidden="true" />
              AI-powered clinical decision support
            </span>
            <h1 className="au-title">
              <span className="au-title-line au-rise" style={{ "--i": 1 } as CSSProperties}>Five questions answered</span>{" "}
              <span className="au-title-line au-rise" style={{ "--i": 2 } as CSSProperties}>the hour a patient is</span>{" "}
              <span className="au-title-line">
                <span className="au-grad" style={{ "--i": 3 } as CSSProperties}>admitted.</span>
              </span>
            </h1>
            <p className="au-lede au-rise" style={{ "--i": 3 } as CSSProperties}>
              ESAP reads what is known at admission and estimates what is likely already present, how the stay is
              likely to go and how long it is likely to last — with the reasoning attached, the calibration stated
              and the limits printed on the same card as the number.
            </p>
            <div className="au-cta-row au-rise" style={{ "--i": 4 } as CSSProperties}>
              <Magnetic>
                <Link to="/signup" className="pub-btn pub-btn-primary">
                  <ArrowRight size={16} className="pub-arrow" /> Try it on your own cases
                </Link>
              </Magnetic>
              <Link to="/evidence" className="pub-btn pub-btn-outline">
                See the evidence <ArrowRight size={15} className="pub-arrow" />
              </Link>
              <Link to="/waitlist" className="pub-btn pub-btn-outline au-btn-quiet">Join the waitlist</Link>
            </div>
            <p className="au-note au-rise" style={{ "--i": 5 } as CSSProperties}>
              <LockIcon size={13} /> Free tier, no card. Nothing you enter is retained on the free tier.
            </p>
          </div>
          <HeroDashboard />
        </div>
      </section>

      {/* 01 · Story: one admission, start to finish, as a 3D diorama */}
      <section id="story" className="au-sec au-story">
        <div className="au-wrap">
          <div className="au-center-head" data-au-reveal>
            <Eyebrow n="01">The story</Eyebrow>
            <h2 className="au-h2">One admission, <em>start to finish.</em></h2>
            <p className="au-lede">
              Follow one patient from the door to the summary they read later — and see exactly where the
              software stops and the clinician decides.
            </p>
          </div>
          <div data-au-reveal>
            <CareStory />
          </div>
        </div>
      </section>

      {/* Inside · scroll-driven exploded view of one estimate */}
      <ProductExplode />

      {/* 01 · Impact */}
      <section id="impact" className="au-sec au-impact">
        <div className="au-wrap">
          <div className="au-center-head" data-au-reveal>
            <span className="au-kicker">The impact</span>
            <h2 className="au-h2">Better insights. <em>Better decisions.</em></h2>
            <p className="au-lede">
              ESAP puts what is likely ahead next to the evidence behind it — so a clinician can plan sooner, with
              the limits in view.
            </p>
          </div>
          <div className="au-impact-grid">
            {DEMO.map((d, i) => (
              <article key={d.id} className={`au-gauge-card au-spot au-lift ${d.hue}`} data-au-reveal style={{ "--i": i } as CSSProperties}>
                <div className="au-gauge-top">
                  <span className="au-gauge-icon">{d.icon}</span>
                  <div>
                    <h3>{d.title}</h3>
                    <p>{d.body}</p>
                  </div>
                </div>
                <Ring p={d.p} label="illustrative" />
                <p className="au-gauge-note">
                  <InfoIcon size={14} />
                  <span>Illustrative demo value. Not a validated patient-specific prediction.</span>
                </p>
              </article>
            ))}
            <article className="au-gauge-card au-explain au-spot au-lift" data-au-reveal style={{ "--i": 3 } as CSSProperties}>
              <span className="au-gauge-icon"><ShieldIcon size={18} /></span>
              <h3>Transparent &amp; explainable</h3>
              <p>
                Every estimate comes with its <strong>reasoning</strong>, its <strong>calibration</strong> and its
                limits — and a clinician makes the call.
              </p>
              <Link to="/evidence" className="au-link">Read the evidence <ArrowRight size={14} className="pub-arrow" /></Link>
            </article>
          </div>
        </div>
      </section>

      {/* 03 · Intake */}
      <section id="intake" className="au-sec au-sec-alt">
        <div className="au-wrap au-split">
          <div data-au-reveal>
            <Eyebrow n="04">Intake</Eyebrow>
            <h2 className="au-h2">Only what is known <em>at admission.</em></h2>
            <p className="au-lede">
              Every input is cut at t₀, the moment the encounter opens. Nothing charted during or after the stay
              can reach the models — that constraint is what makes an estimate early enough to act on.
            </p>
            <ul className="au-checks">
              <li><CheckIcon size={14} /> Opened by an ADT message or the intake form</li>
              <li><CheckIcon size={14} /> Labs counted only if drawn before admission</li>
              <li><CheckIcon size={14} /> Training data cut at the same moment</li>
            </ul>
          </div>
          <div className="au-panel au-spot" data-au-reveal style={{ "--i": 1 } as CSSProperties}>
            <div className="au-panel-top">
              <span className="au-mono">Encounter · inputs read</span>
              <span className="au-stat-mini"><strong className="tnum">5/5</strong> sources</span>
            </div>
            {INPUTS.map((d, i) => (
              <div key={d.name} className="au-doc" style={{ "--i": i } as CSSProperties}>
                {d.icon}<span>{d.name}</span><span className="au-doc-count">{d.count}</span>
              </div>
            ))}
            <div className="au-dots" aria-hidden="true">
              {Array.from({ length: 48 }, (_, i) => (
                <span key={i} data-on={i < 40 ? "" : undefined} style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
            <p className="au-panel-foot"><span className="au-key-on" /> read at t₀ <span className="au-key-off" /> after t₀ — excluded</p>
          </div>
        </div>
      </section>

      {/* 03 · Estimate */}
      <section id="estimate" className="au-sec">
        <div className="au-wrap">
          <div className="au-sec-head" data-au-reveal>
            <div>
              <Eyebrow n="05">Estimate</Eyebrow>
              <h2 className="au-h2">Five models. <em>Every number</em> carries its reasoning.</h2>
            </div>
            <p className="au-lede">
              The drivers behind each estimate are computed from the model itself, not narrated afterwards by a
              language model — so a clinician can check the basis independently.
            </p>
          </div>
          <div data-au-reveal style={{ "--i": 1 } as CSSProperties}><EstimateSteps /></div>
        </div>
      </section>

      {/* 04 · Review */}
      <section id="review" className="au-sec au-sec-alt">
        <div className="au-wrap au-split">
          <div className="au-panel au-spot" data-au-reveal>
            <div className="au-ticket">
              <div className="au-ticket-top">
                <span className="au-mono">Bed 14 · M-03 ICU admission</span>
                <span className="au-status">Reviewed</span>
              </div>
              <p className="au-ticket-body">
                The attending read the estimate, its drivers and its limits, and decided to admit to step-down
                with a 2-hour reassessment.
              </p>
              <span className="au-mono au-ticket-log"><BookIcon size={12} /> written to the audit log · 08:52</span>
            </div>
            <span className="au-mono au-stage-label">What the interface refuses to do</span>
            <div className="au-guards">
              {GUARDS.map((g, i) => (
                <span key={g} className="au-guard" data-hit={i === 2 ? "" : undefined}>{g}</span>
              ))}
            </div>
          </div>
          <div data-au-reveal style={{ "--i": 1 } as CSSProperties}>
            <Eyebrow n="06">Review</Eyebrow>
            <h2 className="au-h2">A clinician <em>makes the call.</em></h2>
            <p className="au-lede">
              ESAP is decision support, not diagnosis. The number, its drivers and its limits sit on one card; the
              clinician decides, and the run is recorded. When the input is too thin for a calibrated estimate, the
              badge is suppressed rather than dressed up.
            </p>
            <Link to="/security" className="au-link">How we stay non-device CDS <ArrowRight size={14} className="pub-arrow" /></Link>
          </div>
        </div>
      </section>

      {/* 05 · Principle */}
      <section id="principle" className="pub-night au-band au-principle">
        <Glows />
        <div className="au-wrap au-principle-inner" data-au-reveal>
          <Eyebrow n="07">The principle</Eyebrow>
          <p className="au-giant" aria-label="One in twelve">1 in 12</p>
          <blockquote className="au-quote">
            men has the colour-vision difference a red/amber/green gauge depends on. So our gauges use{" "}
            <em>one calm ramp</em> — unreadable at a glance, readable at the number.
          </blockquote>
          <p className="au-lede">
            A stoplight trains the eye to snap-judge: green means ignore, red means act. That is exactly the
            over-reliance that turns decision support into software making the call.
          </p>
        </div>
      </section>

      {/* 06 · Platform */}
      <section id="platform" className="au-sec">
        <div className="au-wrap">
          <div className="au-sec-head" data-au-reveal>
            <div>
              <Eyebrow n="08">Platform</Eyebrow>
              <h2 className="au-h2">Built for the <em>whole ward,</em> and the people who sign it off.</h2>
            </div>
            <p className="au-lede">Everything a hospital needs to run it, audit it and trust it — in the same product.</p>
          </div>
          <div className="au-grid">
            {PLATFORM.map((p, i) => (
              <article key={p.title} className="au-card au-spot au-lift" data-au-reveal style={{ "--i": i % 3 } as CSSProperties}>
                <span className="au-card-icon">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="au-stats" aria-label="ESAP at a glance">
        <div className="au-wrap">
          <p className="au-kicker au-stats-title" data-au-reveal>ESAP at a glance</p>
          <div className="au-stats-row">
            {[
              { n: String(MODELS.length || 5), l: "outcomes estimated at the moment of admission" },
              { n: labelsScored, l: "conditions ranked in the differential" },
              { n: "0", l: "inputs taken from after admission" },
              { n: "0", l: "raw scores ever shown to a patient" },
            ].map((s, i) => (
              <div key={s.l} className="au-stat" data-au-reveal style={{ "--i": i } as CSSProperties}>
                <strong className="tnum">{s.n}</strong>
                <span>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="au-marquee-sec" aria-label="Who it is for">
        <div className="au-marquee">
          {[0, 1].map((copy) => (
            <ul key={copy} className="au-marquee-track" aria-hidden={copy === 1 ? "true" : undefined}>
              {AUDIENCES.map((a) => (
                <li key={a.who} className="au-aud">
                  <span className="au-aud-icon">{a.icon}</span>
                  <span><strong>{a.who}</strong><small>{a.what}</small></span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* 07 · FAQ */}
      <section id="faq" className="au-sec au-sec-alt">
        <div className="au-wrap au-split au-split-top">
          <div data-au-reveal>
            <Eyebrow n="09">FAQ</Eyebrow>
            <h2 className="au-h2">Questions people <em>actually</em> ask.</h2>
            <p className="au-lede">Anything else, the evidence and security pages go into detail.</p>
            <div className="au-cta-row">
              <Link to="/evidence" className="pub-btn pub-btn-outline">See the evidence</Link>
              <Link to="/security" className="pub-btn pub-btn-outline">Security</Link>
            </div>
          </div>
          <div className="au-faq" data-au-reveal style={{ "--i": 1 } as CSSProperties}>
            {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>
      </section>

      <section className="pub-night au-band au-final">
        <Glows />
        <div className="au-wrap au-final-inner" data-au-reveal>
          <HeartMonitor className="au-final-monitor" />
          <Eyebrow>Get started</Eyebrow>
          <h2 className="au-h2 au-final-title">Start where it <em>costs nothing.</em></h2>
          <p className="au-lede">Run it on your own cases today. Bring it to the ward when the evidence convinces you.</p>
          <div className="au-cta-row">
            <Link to="/signup" className="pub-btn pub-btn-primary">
              Create a free account <ArrowRight size={15} className="pub-arrow" />
            </Link>
            <Link to="/pricing" className="pub-btn pub-btn-outline">See pricing</Link>
          </div>
          <p className="au-note">90-day hospital pilot available</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
