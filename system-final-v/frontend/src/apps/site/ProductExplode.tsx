/**
 * "Inside an estimate" — a scroll-driven exploded view, in the manner of 3D
 * product landing pages: the estimate starts as one closed device on a dark
 * stage, then, as the visitor scrolls, separates into its five layers with a
 * light beam through the core and a callout for each layer in turn.
 *
 * Pure CSS 3D (preserve-3d plates), no WebGL. One passive scroll listener
 * writes --e (explode, eased) and data-on / data-active attributes, so React
 * never re-renders per frame. Below 960px, or with reduced motion, the scene
 * is static and fully exploded, and the step list carries the text. The
 * scene is decorative (aria-hidden); the ordered list is the accessible copy.
 * Every value drawn on a plate is illustrative.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import "@/styles/explode.css";

type Layer = { n: string; title: string; text: string; art: ReactNode };

const DOTS = Array.from({ length: 36 }, (_, i) => i);
const DRIVERS = [0.92, 0.7, 0.48, 0.3];

/** Bottom (i = 0) to top: the order an estimate is built in. */
const LAYERS: Layer[] = [
  {
    n: "01", title: "Intake at t₀",
    text: "Vitals, labs drawn before admission, prior codes and home medications. Nothing charted after t₀.",
    art: (
      <span className="ex-art-dots">
        {DOTS.map((i) => <span key={i} data-on={i % 7 !== 5 && i < 31 ? "" : undefined} />)}
      </span>
    ),
  },
  {
    n: "02", title: "Five models",
    text: "Differential, mortality, ICU, readmission and length of stay, all trained on the same cut.",
    art: (
      <span className="ex-art-models">
        {["M-01", "M-02", "M-03", "M-04", "M-05"].map((m, i) => (
          <span key={m} style={{ "--bar": `${38 + ((i * 23) % 50)}%` } as CSSProperties}><i />{m}</span>
        ))}
      </span>
    ),
  },
  {
    n: "03", title: "Calibration",
    text: "Each model is calibrated, so 30% means close to 30%. On thin input the badge is suppressed.",
    art: (
      <svg className="ex-art-cal" viewBox="0 0 120 70" preserveAspectRatio="none">
        <path className="ex-art-cal-ref" d="M6 64 L114 6" />
        <path className="ex-art-cal-line" d="M6 64 C30 54 44 40 60 34 S96 14 114 8" />
      </svg>
    ),
  },
  {
    n: "04", title: "Reasoning",
    text: "Drivers are computed from the model itself, not narrated afterwards by a language model.",
    art: (
      <span className="ex-art-drivers">
        {DRIVERS.map((w, i) => <span key={i} style={{ "--len": w } as CSSProperties} />)}
      </span>
    ),
  },
  {
    n: "05", title: "The clinician's card",
    text: "The number, its drivers and its limits on one card. A clinician reviews it and decides.",
    art: (
      <span className="ex-art-card">
        <span className="ex-art-card-head"><b>Bed 14</b><small>Illustrative</small></span>
        <span className="ex-art-card-val"><b className="tnum">44%</b><small>ICU admission</small></span>
        <span className="ex-art-card-chip">Calibrated · reviewed</span>
      </span>
    ),
  },
];

const ANIMATED = "(prefers-reduced-motion: no-preference) and (min-width: 960px)";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Share of the scroll spent separating the layers; the rest walks the callouts. */
const EXPLODE_END = 0.28;

function toggle(el: Element, attr: string, on: boolean) {
  if (on) el.setAttribute(attr, "");
  else el.removeAttribute(attr);
}

export function ProductExplode() {
  const ref = useRef<HTMLElement>(null);

  // Layout effect, so the static attribute is in place before first paint.
  useLayoutEffect(() => {
    const sec = ref.current;
    if (!sec) return;
    const stage = sec.querySelector<HTMLElement>(".ex-stage")!;
    const marked = Array.from(sec.querySelectorAll<HTMLElement>("[data-ex]"));
    const mq = window.matchMedia?.(ANIMATED);
    let raf = 0;
    let lastStep = Number.NaN;

    const setStep = (step: number, all: boolean) => {
      if (step === lastStep) return;
      lastStep = step;
      marked.forEach((el) => {
        const i = Number(el.dataset.ex);
        toggle(el, "data-on", all || i <= step);
        toggle(el, "data-active", !all && i === step);
      });
    };

    const update = () => {
      raf = 0;
      if (!mq?.matches) {
        toggle(sec, "data-static", true);
        stage.style.setProperty("--e", "1");
        setStep(LAYERS.length, true);
        return;
      }
      toggle(sec, "data-static", false);
      const r = sec.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = clamp01(-r.top / span);
      const t = clamp01(p / EXPLODE_END);
      stage.style.setProperty("--e", (1 - Math.pow(1 - t, 3)).toFixed(4));
      const step = p < EXPLODE_END * 0.85
        ? -1
        : Math.min(LAYERS.length - 1, Math.floor(((p - EXPLODE_END * 0.85) / (1 - EXPLODE_END)) * LAYERS.length));
      setStep(step, false);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    mq?.addEventListener?.("change", kick);
    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      mq?.removeEventListener?.("change", kick);
      cancelAnimationFrame(raf);
    };
  }, []);

  // A slight lean toward the cursor, fine pointers only. Eased per frame and
  // stopped once settled, like the hero mock's tilt.
  useEffect(() => {
    const sec = ref.current;
    const stage = sec?.querySelector<HTMLElement>(".ex-stage");
    if (!sec || !stage || !window.matchMedia?.(`(hover: hover) and (pointer: fine) and ${ANIMATED}`).matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const step = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      stage.style.setProperty("--tx", x.toFixed(3));
      stage.style.setProperty("--ty", y.toFixed(3));
      raf = Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(step);
    };
    stage.addEventListener("pointermove", onMove, { passive: true });
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={ref} id="inside" className="ex" aria-labelledby="ex-title">
      <div className="ex-stage">
        <div className="ex-glow" aria-hidden="true" />
        <div className="ex-copy">
          <span className="au-kicker">Inside an estimate</span>
          <h2 id="ex-title" className="au-h2">Five layers. <em>One card.</em></h2>
          <p className="au-lede">
            One estimate taken apart, from the data cut at admission to the card a clinician reads.
          </p>
          <ol className="ex-steps">
            {LAYERS.map((l, i) => (
              <li key={l.n} data-ex={i}>
                <span className="ex-step-n tnum">{l.n}</span>
                <span>
                  <strong>{l.title}</strong>
                  <span className="ex-step-text">{l.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="ex-hint" aria-hidden="true"><span className="ex-hint-line" /> Scroll</p>
        </div>

        <div className="ex-scene" aria-hidden="true">
          <div className="ex-floor" />
          <div className="ex-stack">
            <span className="ex-beam" />
            {[0, 1, 2].map((k) => <span key={k} className="ex-spark" style={{ "--k": k } as CSSProperties} />)}
            {LAYERS.map((l, i) => (
              <div key={l.n} className="ex-plate" data-ex={i} style={{ "--i": i } as CSSProperties}>
                <span className="ex-plate-label">{l.n} · {l.title}</span>
                <span className="ex-plate-art">{l.art}</span>
              </div>
            ))}
          </div>
          <div className="ex-callouts">
            {LAYERS.map((l, i) => (
              <div key={l.n} className="ex-callout" data-ex={i} style={{ "--i": i } as CSSProperties}>
                <span className="ex-callout-n tnum">{l.n}</span>
                <strong>{l.title}</strong>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
