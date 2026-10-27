/**
 * Hero illustrations for the public sub-pages (security, evidence, pricing,
 * waitlist).
 *
 * Each one draws what its page says, never a claim the page does not make:
 * the security art is the isolation layers listed under Technical controls, the
 * evidence art plots the real M-01 strata from the evaluation of record, the
 * pricing art is a ward priced per bed, and the waitlist art is the pilot path
 * the pricing page describes. Colours are tokens, so both themes follow.
 * Motion is CSS-only (styles/public.css, `.art-*`): transform and opacity,
 * frozen under prefers-reduced-motion.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MODELS } from "@/mock/db";
import { BuildingIcon, ClipboardIcon, EyeOffIcon, KeyIcon, LockIcon, ScaleIcon } from "@/components/ui/icons";
import "@/styles/site-art.css";

const d = (i: number) => ({ "--i": i } as CSSProperties);

/** Concentric boundaries around one tenant's data, with the audit chain below. */
export function SecurityArt() {
  const layers = [
    { r: 132, label: "Audit · append-only, hash-chained" },
    { r: 100, label: "Tenant-scoped keys · AES-256" },
    { r: 68, label: "Your tenant" },
  ];
  return (
    <figure className="site-art art-security" aria-hidden="true">
      <svg viewBox="0 0 400 360" role="presentation">
        <g transform="translate(200 170)">
          {/* Outer ring: a slow-turning dashed perimeter. */}
          <circle className="art-orbit" r="158" />
          {layers.map((l, i) => (
            <g key={l.r} className="art-layer" style={d(i)}>
              <circle r={l.r} className={`art-ring art-ring-${i}`} />
              <text y={-l.r + 17} textAnchor="middle" className="art-ring-label">{l.label}</text>
            </g>
          ))}
          {/* The shield + lock at the centre. */}
          <g className="art-core" style={d(3)}>
            <path d="M0 -34 L28 -23 V2 C28 20 15 31 0 38 C-15 31 -28 20 -28 2 V-23 Z" className="art-shield" />
            <rect x="-11" y="-3" width="22" height="17" rx="3.5" className="art-lock" />
            <path d="M-6.5 -3 V-8 a6.5 6.5 0 0 1 13 0 V-3" className="art-lock-arc" />
          </g>
          {/* One request travelling the perimeter: everything crosses the boundary. */}
          <g className="art-orbiter"><circle cx="158" cy="0" r="5.5" className="art-orbit-dot" /></g>
        </g>
        {/* The audit chain: links that settle in one after another. */}
        <g transform="translate(92 336)">
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={i * 32} y="-7" width="24" height="14" rx="7" className="art-link" style={d(i)} />
          ))}
        </g>
      </svg>
    </figure>
  );
}

/**
 * Leans a 3D art piece toward the pointer by writing --px / --py (-1…1) on
 * the element. Skipped on touch and under reduced motion, where the piece
 * keeps its resting tilt.
 */
function usePointerTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof matchMedia === "undefined") return;
    if (!matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", px.toFixed(3));
        el.style.setProperty("--py", py.toFixed(3));
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);
  return ref;
}

/** The M-01 stratified recall, drawn against the leakage-alarm ceiling. */
export function EvidenceArt() {
  const m01 = MODELS.find((m) => m.id === "M-01");
  const pooled = Number(m01?.headline[0]?.value) || 0;
  if (!m01 || !pooled) return null;
  const rows = [{ label: "Pooled", value: pooled }, ...m01.strata.map((s) => ({ label: s.label, value: s.value }))];
  const CEIL = 0.6;
  const scale = (v: number) => (v / 0.8) * 100; // axis 0 → 0.8
  const tiltRef = usePointerTilt<HTMLElement>();
  return (
    <figure ref={tiltRef} className="site-art art-evidence">
      {/* 3D stage: the panel floats over two plates; the bars sit a little
          proud of the card. Pointer tilt writes --px/--py (fine pointers only). */}
      <div className="art-3d-float">
      <div className="art-3d">
      <span className="art-plate art-plate-2" aria-hidden="true" />
      <span className="art-plate art-plate-1" aria-hidden="true" />
      <div className="art-panel">
        <p className="art-panel-head">
          <strong>M-01 · Recall@20</strong>
          <span>held-out test set</span>
        </p>
        <div className="art-bars">
          {rows.map((r, i) => (
            <div key={r.label} className="art-bar-row">
              <span className="art-bar-label" style={{ gridRow: i + 1 }}>{r.label}</span>
              <span className="art-bar-track" style={{ gridRow: i + 1 }}>
                <span className={`art-bar-fill${/cold/i.test(r.label) ? " is-weak" : ""}`} style={{ width: `${scale(r.value)}%`, ...d(i) }} />
              </span>
              <span className="art-bar-value tnum" style={{ gridRow: i + 1 }}>{r.value.toFixed(3)}</span>
            </div>
          ))}
          {/* Spans the track column over every row; the line sits at the ceiling. */}
          <span className="art-ceiling" style={{ gridRow: `1 / span ${rows.length}` }}>
            <span className="art-ceiling-line" style={{ insetInlineStart: `${scale(CEIL)}%` }}>
              <span>leakage alarm · {CEIL.toFixed(2)}</span>
            </span>
          </span>
        </div>
        <p className="art-panel-foot">
          The weakest stratum is shown, not averaged away. Above the ceiling, a score is not trusted until a
          negative control has run.
        </p>
      </div>
      </div>
      </div>
    </figure>
  );
}

/** A ward: priced per bed, with the beds coming online one by one. */
export function PricingArt() {
  const cols = 6;
  const beds = Array.from({ length: 18 }, (_, i) => i);
  return (
    <figure className="site-art art-pricing" aria-hidden="true">
      <svg viewBox="0 0 400 352" role="presentation">
        {/* Building */}
        <rect x="70" y="70" width="260" height="220" rx="16" className="art-building" />
        <rect x="160" y="34" width="80" height="44" rx="10" className="art-building" />
        <g transform="translate(200 56)" className="art-cross">
          <rect x="-4.5" y="-13" width="9" height="26" rx="2" />
          <rect x="-13" y="-4.5" width="26" height="9" rx="2" />
        </g>
        {/* Beds as windows */}
        {beds.map((i) => {
          const x = 92 + (i % cols) * 38;
          const y = 96 + Math.floor(i / cols) * 46;
          return (
            <g key={i} className="art-bed" style={d(i)}>
              <rect x={x} y={y} width="28" height="30" rx="6" className="art-bed-frame" />
              {/* headboard, mattress with a pillow, foot of the bed */}
              <path d={`M${x + 5} ${y + 9} v15 M${x + 5} ${y + 19} h18 v5 M${x + 5} ${y + 16} h18`} className="art-bed-glyph" />
              <rect x={x + 7.5} y={y + 12} width="6" height="3.4" rx="1.4" className="art-bed-pillow" />
            </g>
          );
        })}
        <rect x="178" y="244" width="44" height="46" rx="8" className="art-door" />
        {/* The ground line carries a heartbeat. It runs below the building
            (bottom edge y=290) so the spike's peak (y≈298) never crosses the door. */}
        <path className="art-ecg" pathLength={1} d="M20 324 H230 l10 -14 l10 26 l9 -38 l10 38 l8 -12 H380" />
      </svg>
      <figcaption className="art-caption">Priced per bed — every clinician on the ward is included.</figcaption>
    </figure>
  );
}

/** How a place on the waitlist becomes a pilot. */
export function WaitlistPath() {
  const steps = [
    { t: "You join", s: "Your place is fixed in sign-up order" },
    { t: "We talk", s: "A person learns your setting" },
    { t: "90-day pilot", s: "One unit, a defined success metric" },
    { t: "Hospital plan", s: "Only if the pilot earns it" },
  ];
  return (
    <figure className="site-art art-path">
      <ol>
        {steps.map((st, i) => (
          <li key={st.t} style={d(i)}>
            <span className="art-path-dot">{i + 1}</span>
            <strong>{st.t}</strong>
            <span>{st.s}</span>
          </li>
        ))}
      </ol>
      <span className="art-path-pulse" aria-hidden="true"><i /></span>
    </figure>
  );
}

/**
 * FAQ hero: real questions from the page, floating as cards at three depths
 * around a "?" — the front one open, as an answer would be. Same 3D stage as
 * the evidence art (pointer tilt, drift); each card also bobs on its own beat.
 */
export function FaqArt({ questions }: { questions: string[] }) {
  const tiltRef = usePointerTilt<HTMLElement>();
  return (
    <figure ref={tiltRef} className="site-art art-faq" aria-hidden="true">
      <div className="art-3d-float">
        <div className="art-3d art-faq-stage">
          {questions.slice(0, 3).map((q, i) => (
            <div key={q} className={`art-faq-card art-faq-card-${i}`} style={d(i)}>
              <span className="art-faq-q">
                <span>{q}</span>
                <i className="art-faq-chev" />
              </span>
              {i === 0 && (
                <span className="art-faq-a">
                  <i style={{ width: "92%" }} /><i style={{ width: "78%" }} /><i style={{ width: "54%" }} />
                </span>
              )}
            </div>
          ))}
          <span className="art-faq-orb">?</span>
          <Magnifier />
        </div>
      </div>
    </figure>
  );
}

/**
 * A magnifying glass that glides over the FAQ cards, settling on each
 * question in turn as if reading it; a glint sweeps the lens while it rests.
 */
function Magnifier() {
  return (
    <span className="art-magnifier">
      <svg viewBox="0 0 120 120" width="120" height="120" role="presentation">
        <defs>
          <radialGradient id="art-lens" cx="38%" cy="34%" r="70%">
            <stop offset="0%" className="art-lens-hi" />
            <stop offset="100%" className="art-lens-lo" />
          </radialGradient>
          <clipPath id="art-lens-clip"><circle cx="48" cy="48" r="31" /></clipPath>
        </defs>
        <path d="M71 71 L106 106" className="art-mag-handle" />
        <path d="M71 71 L84 84" className="art-mag-collar" />
        <circle cx="48" cy="48" r="31" fill="url(#art-lens)" className="art-mag-glass" />
        <g clipPath="url(#art-lens-clip)">
          <rect x="-30" y="0" width="16" height="110" className="art-mag-glint" />
        </g>
        <circle cx="48" cy="48" r="35" className="art-mag-rim" />
      </svg>
    </span>
  );
}

/**
 * Legal hero: the document as a fanned stack of pages, the front one carrying
 * the real section titles, with a seal standing proud of the page.
 */
/** A loose cursive flourish; the pen tip follows exactly this path. */
const SIGNATURE = "M4 34 C14 8 24 8 22 30 C20 44 32 40 40 24 C46 12 50 30 56 32 C64 34 66 14 74 18 C82 22 74 40 86 36 C96 32 100 20 108 26 C116 32 112 40 122 34 C134 26 140 30 150 28 C160 26 168 30 176 26";

/**
 * A pen signing the page. The pen and the ink live in one SVG and share one
 * path: SMIL's animateMotion moves the nib along it while the ink's dash
 * offset draws the same path on the same clock, so the ink appears exactly
 * under the nib. Under reduced motion the signature is simply there.
 */
function Signature() {
  const [still] = useState(() =>
    typeof matchMedia === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches);
  const loop = { begin: "1.4s", dur: "7s", repeatCount: "indefinite" } as const;
  return (
    <span className="art-sign">
      <svg viewBox="0 0 180 48" width="180" height="48" role="presentation">
        <path d="M0 46 H180" className="art-sign-line" />
        <path d={SIGNATURE} pathLength={1} className="art-sign-ink" strokeDasharray="1" strokeDashoffset={still ? 0 : 1}>
          {!still && <>
            <animate attributeName="stroke-dashoffset" values="1;0;0;0" keyTimes="0;0.45;0.85;1" {...loop} />
            <animate attributeName="opacity" values="1;1;1;0;0" keyTimes="0;0.45;0.85;0.95;1" {...loop} />
          </>}
        </path>
        {!still && (
          <g opacity="0">
            <animateMotion path={SIGNATURE} keyPoints="0;1;1" keyTimes="0;0.45;1" calcMode="linear" {...loop} />
            <animate attributeName="opacity" values="0;1;1;1;0;0" keyTimes="0;0.04;0.45;0.55;0.7;1" {...loop} />
            {/* Drawn with the nib at the origin, leaning like a hand holds it. */}
            <g transform="rotate(28)" className="art-pen">
              <path d="M0 0 L-6 -16 H6 Z" className="art-pen-nib" />
              <rect x="-7" y="-66" width="14" height="52" rx="5" className="art-pen-body" />
              <rect x="-7" y="-74" width="14" height="14" rx="5" className="art-pen-cap" />
              <path d="M5 -62 V-38" className="art-pen-clip" />
            </g>
          </g>
        )}
      </svg>
    </span>
  );
}

export function LegalArt({ title, lines, signed = false }: { title: string; lines: string[]; signed?: boolean }) {
  const tiltRef = usePointerTilt<HTMLElement>();
  return (
    <figure ref={tiltRef} className="site-art art-legal" aria-hidden="true">
      <div className="art-3d-float">
        <div className="art-3d art-legal-stage">
          <span className="art-legal-page art-legal-page-2" />
          <span className="art-legal-page art-legal-page-1" />
          <div className="art-legal-page art-legal-front">
            <strong>{title}</strong>
            <ol>
              {lines.slice(0, 5).map((l, i) => (
                <li key={l} style={d(i)}><span className="tnum">{i + 1}.</span> {l}</li>
              ))}
            </ol>
            {signed ? <Signature /> : (
              <span className="art-legal-rule" />
            )}
          </div>
          <span className="art-legal-seal">
            <svg viewBox="0 0 24 24" width="30" height="30" role="presentation">
              <path d="M12 2.5 19.5 5.5v6c0 4.8-3.2 8.3-7.5 10-4.3-1.7-7.5-5.2-7.5-10v-6Z" />
              <path d="m8.5 12 2.4 2.4 4.6-4.8" className="art-legal-tick" />
            </svg>
          </span>
        </div>
      </div>
    </figure>
  );
}

/**
 * Privacy hero: a data cube turning slowly inside an orbit. Each face is one
 * promise the Privacy Policy actually makes; the ring is the boundary every
 * request crosses. The cube spins on its own; the stage leans to the pointer.
 */
const CUBE_FACES = [
  { icon: <LockIcon size={26} />, label: "Encrypted at rest" },
  { icon: <EyeOffIcon size={26} />, label: "Never sold" },
  { icon: <ClipboardIcon size={26} />, label: "Every read logged" },
  { icon: <BuildingIcon size={26} />, label: "Hospital-owned" },
  { icon: <ScaleIcon size={26} />, label: "Fairness audited" },
  { icon: <KeyIcon size={26} />, label: "Tenant-scoped keys" },
];

export function PrivacyArt() {
  const tiltRef = usePointerTilt<HTMLElement>();
  return (
    <figure ref={tiltRef} className="site-art art-privacy" aria-hidden="true">
      <div className="art-3d-float">
        <div className="art-3d art-privacy-stage">
          <span className="art-privacy-orbit"><i /></span>
          <div className="art-cube">
            {CUBE_FACES.map((f, i) => (
              <span key={f.label} className={`art-cube-face art-cube-face-${i}`}>
                {f.icon}
                <span>{f.label}</span>
              </span>
            ))}
          </div>
          <span className="art-privacy-floor" />
        </div>
      </div>
    </figure>
  );
}
