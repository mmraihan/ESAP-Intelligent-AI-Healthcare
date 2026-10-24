/**
 * "One admission" — an illustrated, interactive story for the product page.
 *
 * Five scenes follow one patient from arrival to the summary they read later:
 * arrival (t₀), intake, estimate, clinician review, and release. The people and
 * objects persist across scenes and walk to new marks, so it reads as one
 * continuous story rather than a slideshow.
 *
 * It carries the product's rules rather than decorating around them: every
 * number is labelled illustrative, the clinician makes the call (acknowledging
 * records that the estimate was read, not followed), and the patient only ever
 * sees a summary a person wrote — never a score.
 *
 * Interaction: the scene tabs, prev / next, arrow keys and play / pause. It
 * auto-advances only while on screen, not hovered or focused, and never under
 * prefers-reduced-motion (the progress bar that drives it does not run there).
 * The stage is a CSS 3D diorama: the room is a box and the actors and
 * overlays stand on depth layers, and each scene moves the camera to a new
 * angle. Reduced motion keeps one fixed angle and no transitions.
 * Styles: styles/care-story.css (scoped under `.cs`).
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import "@/styles/care-story.css";
import { CheckIcon, ChevronLeft, ChevronRight, ClockIcon, InfoIcon } from "@/components/ui/icons";

const SCENES = [
  {
    id: "arrival",
    time: "08:14",
    title: "Arrival",
    body: "A patient arrives short of breath. The moment they are admitted is t₀ — every input the models will ever see is cut at that instant.",
    rule: "Nothing from later in the stay can leak in.",
  },
  {
    id: "intake",
    time: "08:20",
    title: "Intake",
    body: "The nurse records what is known now: the first vitals, early labs, history and home medicines. A blank is allowed; a guess is not.",
    rule: "Missing data is shown as missing, not filled in quietly.",
  },
  {
    id: "estimate",
    time: "08:21",
    title: "Estimate",
    body: "Five models return their estimates in seconds — each with the drivers that produced it, its calibration state and its limits on the same card.",
    rule: "Every number carries its reasoning.",
  },
  {
    id: "review",
    time: "08:35",
    title: "Review",
    body: "The attending reads the estimate and the Why panel, weighs it against the patient in front of them, and makes the call.",
    rule: "Acknowledging records that it was read — not that it was followed.",
  },
  {
    id: "shared",
    time: "Later",
    title: "Shared",
    body: "Once a clinician has reviewed it, the patient sees a plain-language summary their team wrote — and can ask about it.",
    rule: "A patient never sees a raw score.",
  },
] as const;

/** Illustrative values only — the same ones the hero mock uses. */
const EST = [
  { k: "In-hospital mortality", v: 0.31 },
  { k: "ICU admission", v: 0.44 },
  { k: "30-day readmission", v: 0.18 },
];

const CHIPS = ["BP 150/90", "HR 104", "SpO₂ 91%", "Creatinine", "Prior HF"];

const reduceMotion = () => !window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches;

export function CareStory() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false); // hovered or focused
  const [offscreen, setOffscreen] = useState(true);
  const [still, setStill] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  // The diorama leans toward the cursor (fine pointers, motion welcome).
  // Eased per frame into --lx / --ly and stopped once settled.
  useEffect(() => {
    const el = stage.current;
    const host = wrap.current;
    if (!el || !host || !window.matchMedia?.("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.1;
      y += (ty - y) * 0.1;
      el.style.setProperty("--lx", x.toFixed(3));
      el.style.setProperty("--ly", y.toFixed(3));
      raf = Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    setStill(reduceMotion());
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = (n: number) => setScene((n + SCENES.length) % SCENES.length);
  const running = playing && !hold && !offscreen && !still;
  const cur = SCENES[scene];

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(scene + 1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(scene - 1); }
  }

  return (
    <div
      ref={wrap}
      className="cs"
      data-scene={scene}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      {/* ---- the scene picker ---- */}
      <div className="cs-tabs" role="tablist" aria-label="One admission, step by step" onKeyDown={onTabKey}>
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`cs-tab-${s.id}`}
            aria-selected={i === scene}
            aria-controls="cs-panel"
            tabIndex={i === scene ? 0 : -1}
            className="cs-tab"
            onClick={() => setScene(i)}
          >
            <span className="cs-tab-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="cs-tab-t">{s.title}</span>
            {i === scene && (
              <span
                key={s.id}
                className="cs-tab-bar"
                data-run={running ? "" : undefined}
                onAnimationEnd={() => go(scene + 1)}
              />
            )}
          </button>
        ))}
      </div>

      <div className="cs-body">
        {/* ---- the caption ---- */}
        <div id="cs-panel" className="cs-caption" role="tabpanel" aria-labelledby={`cs-tab-${cur.id}`}>
          <div key={cur.id} className="cs-caption-in">
            <span className="cs-time"><ClockIcon size={13} /> {cur.time}</span>
            <h3>{cur.title}</h3>
            <p>{cur.body}</p>
            <p className="cs-rule"><CheckIcon size={14} /> {cur.rule}</p>
          </div>
          <div className="cs-controls">
            <button type="button" className="cs-ctl" onClick={() => go(scene - 1)} aria-label="Previous scene">
              <ChevronLeft size={16} />
            </button>
            {!still && (
              <button type="button" className="cs-ctl cs-play" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
                {playing ? <PauseGlyph /> : <PlayGlyph />}
                <span>{playing ? "Pause" : "Play"}</span>
              </button>
            )}
            <button type="button" className="cs-ctl" onClick={() => go(scene + 1)} aria-label="Next scene">
              <ChevronRight size={16} />
            </button>
            <span className="cs-count tnum" aria-hidden="true">{scene + 1} / {SCENES.length}</span>
          </div>
        </div>

        {/* ---- the stage: a 3D diorama ----
            The room is a box (back wall + floor plane) and everything in it
            sits on depth layers, so the per-scene camera moves read as real
            parallax. Nesting: camera (per scene) > lean (pointer) > sway
            (ambient) > box. Every layer shares the 640×400 frame. */}
        <div className="cs-stage" aria-hidden="true" ref={stage}>
          <div className="cs-cam">
            <div className="cs-lean">
              <div className="cs-sway">
                <span className="cs-shadow" />
                <span className="cs-plane cs-plane-floor" />
                <span className="cs-edge cs-edge-front" />
                <span className="cs-edge cs-edge-top" />
                <span className="cs-edge cs-edge-left" />
                <span className="cs-edge cs-edge-right" />
                <svg viewBox="0 0 640 400" className="cs-svg cs-layer cs-l-back"><Room /></svg>
                <svg viewBox="0 0 640 400" className="cs-svg cs-layer cs-l-mid">
                  <Bed />
                  <g className="cs-actor cs-patient-walk"><PatientWalking /></g>
                  <g className="cs-actor cs-patient-bed"><PatientInBed /></g>
                  <BedBlanket />
                </svg>
                <svg viewBox="0 0 640 400" className="cs-svg cs-layer cs-l-front">
                  <g className="cs-actor cs-nurse"><Nurse /></g>
                  <g className="cs-actor cs-doctor"><Doctor /></g>
                </svg>
                <div className="cs-layer cs-l-ui">
                  {/* HTML overlays, positioned in stage-width units so they scale with it. */}
                  <span className="cs-t0"><ClockIcon size={12} /> t₀ 08:14 · admitted</span>

          <div className="cs-chips">
            {CHIPS.map((c, i) => (
              <span key={c} className="cs-chip" style={{ "--i": i } as CSSProperties}>{c}</span>
            ))}
          </div>

          <div className="cs-card">
            <div className="cs-card-head">
              <strong>ESAP · intake estimate</strong>
              <span className="cs-illus">Illustrative</span>
            </div>
            {EST.map((e, i) => (
              <div key={e.k} className="cs-meter" style={{ "--i": i } as CSSProperties}>
                <span>{e.k}</span>
                <span className="cs-meter-track"><span className="cs-meter-fill" style={{ width: `${e.v * 100}%` }} /></span>
                <strong className="tnum">{Math.round(e.v * 100)}%</strong>
              </div>
            ))}
            <div className="cs-why">
              <span className="cs-why-k">Why</span>
              <span>SpO₂ 91% at arrival</span>
              <span>Prior heart failure</span>
            </div>
            <span className="cs-stamp"><CheckIcon size={12} /> Reviewed · clinician&rsquo;s own judgement</span>
          </div>

          <div className="cs-phone">
            <span className="cs-phone-notch" />
            <strong>From your care team</strong>
            <span className="cs-phone-line" />
            <span className="cs-phone-line" />
            <span className="cs-phone-line is-short" />
            <span className="cs-phone-tag"><CheckIcon size={10} /> Written by a person · no score shown</span>
          </div>

          <span className="cs-bubble">Here&rsquo;s what we found, and what happens next.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="cs-note"><InfoIcon size={13} /> An illustrated walk-through. Values are illustrative demo values, not a patient-specific prediction.</p>
    </div>
  );
}

function PlayGlyph() {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>;
}
function PauseGlyph() {
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor" /></svg>;
}

/* ===================== illustration ===================== */

function Room() {
  return (
    <g className="cs-room">
      <rect x="0" y="0" width="640" height="340" className="cs-wall" />
      <rect x="0" y="340" width="640" height="60" className="cs-floor" />
      <line x1="0" y1="340" x2="640" y2="340" className="cs-skirting" />
      {/* window */}
      <rect x="470" y="56" width="128" height="96" rx="8" className="cs-window" />
      <path d="M534 56 V152 M470 104 H598" className="cs-window-bar" />
      {/* bedside monitor with a live trace */}
      <rect x="62" y="96" width="118" height="74" rx="10" className="cs-monitor" />
      <path className="cs-trace" pathLength={1} d="M72 136 H100 l6 -10 l6 22 l7 -32 l7 32 l5 -12 H170" />
      <rect x="112" y="170" width="18" height="14" className="cs-monitor-arm" />
      {/* IV pole */}
      <line x1="208" y1="120" x2="208" y2="338" className="cs-pole" />
      <path d="M196 120 H220" className="cs-pole" />
      <rect x="198" y="126" width="20" height="30" rx="6" className="cs-iv" />
      <path d="M208 156 C208 190 236 196 262 214" className="cs-iv-line" />
    </g>
  );
}

function Bed() {
  return (
    <g className="cs-bed">
      <rect x="222" y="196" width="12" height="144" rx="5" className="cs-bed-frame" />
      <path d="M238 270 L262 196 Q266 188 274 190 L290 196 L272 270 Z" className="cs-bed-back" />
      <rect x="232" y="266" width="250" height="18" rx="8" className="cs-mattress" />
      <rect x="236" y="284" width="242" height="10" rx="4" className="cs-bed-frame" />
      <path d="M252 294 V328 M462 294 V328" className="cs-bed-leg" />
      <circle cx="252" cy="332" r="7" className="cs-wheel" />
      <circle cx="462" cy="332" r="7" className="cs-wheel" />
    </g>
  );
}

function BedBlanket() {
  return <path d="M292 262 Q300 244 330 244 H468 Q480 244 480 258 V284 H292 Z" className="cs-blanket" />;
}

/** Shared parts. Local origin: between the feet, on the floor. */
function Head({ skin, hair, style }: { skin: string; hair: "short" | "bun" | "curly"; style?: string }) {
  return (
    <g className={`cs-head ${style ?? ""}`}>
      <rect x="-5" y="-130" width="10" height="12" rx="3" className={skin} />
      <circle cx="0" cy="-143" r="16" className={skin} />
      {hair === "short" && <path d="M-16 -146 Q-15 -162 0 -162 Q15 -162 16 -146 Q10 -154 0 -153 Q-9 -153 -16 -146 Z" className="cs-hair-a" />}
      {hair === "bun" && (
        <>
          <path d="M-16 -144 Q-16 -162 0 -162 Q16 -162 16 -144 Q12 -152 0 -152 Q-12 -152 -16 -144 Z" className="cs-hair-b" />
          <circle cx="12" cy="-160" r="7" className="cs-hair-b" />
        </>
      )}
      {hair === "curly" && <path d="M-17 -142 Q-20 -160 -6 -163 Q0 -168 7 -163 Q20 -161 17 -142 Q14 -150 6 -151 Q0 -147 -6 -151 Q-14 -150 -17 -142 Z" className="cs-hair-c" />}
      {/* face: two eyes and a small smile, so the figure reads as a person */}
      <circle cx="-5.5" cy="-143" r="1.6" className="cs-eye" />
      <circle cx="5.5" cy="-143" r="1.6" className="cs-eye" />
      <path d="M-4 -136 Q0 -133 4 -136" className="cs-mouth" />
    </g>
  );
}

function Legs({ cls, walk }: { cls: string; walk: string }) {
  return (
    <g>
      <g className={`cs-leg cs-leg-a ${walk}`}>
        <rect x="-12" y="-64" width="10" height="62" rx="5" className={cls} />
        <ellipse cx="-8" cy="-1" rx="8" ry="3.5" className="cs-shoe" />
      </g>
      <g className={`cs-leg cs-leg-b ${walk}`}>
        <rect x="2" y="-64" width="10" height="62" rx="5" className={cls} />
        <ellipse cx="8" cy="-1" rx="8" ry="3.5" className="cs-shoe" />
      </g>
    </g>
  );
}

function PatientWalking() {
  return (
    <g className="cs-breathe">
      <Legs cls="cs-pants" walk="cs-walk-patient" />
      <path d="M-21 -60 L-20 -108 Q-19 -120 -7 -121 H7 Q19 -120 20 -108 L21 -60 Z" className="cs-gown" />
      <path d="M-7 -121 L0 -110 L7 -121" className="cs-gown-tie" />
      {/* one hand on the chest: short of breath */}
      <path d="M-18 -112 Q-24 -96 -10 -98" className="cs-arm cs-arm-gown" />
      <circle cx="-8" cy="-99" r="5" className="cs-skin-a" />
      <path d="M18 -112 Q23 -92 22 -72" className="cs-arm cs-arm-gown" />
      <circle cx="22" cy="-70" r="5" className="cs-skin-a" />
      <Head skin="cs-skin-a" hair="curly" />
      {/* breath marks */}
      <path d="M22 -146 q6 -3 10 0 M24 -138 q6 -3 10 0" className="cs-breath" />
    </g>
  );
}

function PatientInBed() {
  // Reclined against the raised backrest; the blanket (drawn after) covers the legs.
  return (
    <g transform="translate(300 264)">
      {/* The SVG tilt stays on this group; the breathing animation (a CSS
          transform, which would replace it) runs on the child. */}
      <g transform="rotate(-14)"><g className="cs-breathe">
        <path d="M-20 0 L-19 -40 Q-18 -52 -6 -53 H8 Q20 -52 21 -40 L22 0 Z" className="cs-gown" />
        <g transform="translate(0 73)"><Head skin="cs-skin-a" hair="curly" /></g>
        {/* resting arm */}
        <path d="M18 -44 Q34 -26 46 -14" className="cs-arm cs-arm-gown cs-arm-rest" />
        <circle cx="48" cy="-13" r="5" className="cs-skin-a cs-arm-rest" />
        {/* in the last scene: holding a phone, reading */}
        <g className="cs-phone-arm">
          <path d="M18 -44 Q36 -48 34 -66" className="cs-arm cs-arm-gown" />
          <rect x="26" y="-84" width="14" height="22" rx="3" className="cs-handset" />
          <circle cx="33" cy="-66" r="5" className="cs-skin-a" />
        </g>
      </g></g>
    </g>
  );
}

function Nurse() {
  return (
    <g className="cs-breathe">
      <Legs cls="cs-scrub-dark" walk="cs-walk-nurse" />
      <path d="M-21 -60 L-20 -108 Q-19 -120 -7 -121 H7 Q19 -120 20 -108 L21 -60 Z" className="cs-scrub" />
      <path d="M-7 -121 L0 -111 L7 -121" className="cs-vneck" />
      {/* left arm down */}
      <path d="M-18 -112 Q-24 -92 -23 -72" className="cs-arm cs-arm-scrub" />
      <circle cx="-23" cy="-70" r="5" className="cs-skin-b" />
      {/* right arm holds the tablet; the hand taps during intake */}
      <g className="cs-tap">
        <path d="M18 -112 Q26 -94 10 -88" className="cs-arm cs-arm-scrub" />
        <circle cx="8" cy="-88" r="5" className="cs-skin-b" />
      </g>
      <g className="cs-tablet">
        <rect x="-16" y="-104" width="28" height="20" rx="3.5" transform="rotate(-12 -2 -94)" className="cs-tablet-body" />
        <rect x="-13" y="-101" width="22" height="14" rx="2" transform="rotate(-12 -2 -94)" className="cs-tablet-screen" />
      </g>
      <Head skin="cs-skin-b" hair="bun" />
    </g>
  );
}

function Doctor() {
  return (
    <g className="cs-breathe">
      <Legs cls="cs-pants-dark" walk="cs-walk-doctor" />
      {/* white coat, longer than the torso, open at the front */}
      <path d="M-23 -44 L-21 -108 Q-20 -121 -7 -122 H7 Q20 -121 21 -108 L23 -44 Z" className="cs-coat" />
      <path d="M0 -112 V-46" className="cs-coat-seam" />
      <path d="M-7 -122 L-2 -100 M7 -122 L2 -100" className="cs-coat-seam" />
      {/* stethoscope */}
      <path d="M-8 -120 Q-12 -98 0 -96 Q12 -98 8 -120" className="cs-stetho" />
      <circle cx="0" cy="-94" r="3.4" className="cs-stetho-bell" />
      <path d="M-19 -112 Q-26 -90 -25 -70" className="cs-arm cs-arm-coat" />
      <circle cx="-25" cy="-68" r="5" className="cs-skin-c" />
      {/* hand to chin while reading the card; open hand while talking */}
      <g className="cs-think">
        <path d="M19 -112 Q28 -100 8 -124" className="cs-arm cs-arm-coat" />
        <circle cx="7" cy="-126" r="5" className="cs-skin-c" />
      </g>
      <g className="cs-talk">
        <path d="M19 -112 Q30 -96 36 -104" className="cs-arm cs-arm-coat" />
        <circle cx="38" cy="-106" r="5" className="cs-skin-c" />
      </g>
      <Head skin="cs-skin-c" hair="short" style="cs-nod" />
    </g>
  );
}
