/**
 * Chart primitives.
 *
 * Rules this file follows (dataviz method + PRODUCT_BLUEPRINT §14.3):
 *  - **Never a dual axis.** Metrics of different scale (PSI, ECE, Recall@20)
 *    render as small multiples sharing one x, not two y-scales on one plot.
 *  - **Sequential = one hue, light → dark**, and it encodes magnitude only. The
 *    risk ramp is never remapped to red/amber/green (§14.3.2).
 *  - **Color is never the sole carrier**: every plot prints its numbers, and
 *    series carry a direct label or a legend.
 *  - Text wears ink tokens, never the series color.
 *  - Every plot has a hover layer; a table view is reachable where it matters.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { pct, percentilePhrase, seqToken } from "@/lib/format";

const AXIS = "var(--grid)";
const INK_MUTED = "var(--text-muted)";

// --- Sparkline --------------------------------------------------------------

/** One series, no legend — the title names it. */
export function Sparkline({
  points, width = 120, height = 32, stroke = "var(--accent)", fill = true, ariaLabel,
}: { points: number[]; width?: number; height?: number; stroke?: string; fill?: boolean; ariaLabel?: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const gid = useId();
  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel ?? "trend"} style={{ display: "block", overflow: "visible" }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={2.8} fill={stroke} />
    </svg>
  );
}

// --- Line panel (one metric, one axis) --------------------------------------

export type LinePanelProps = {
  title: string;
  /** Optional one-line reading aid under the title. */
  hint?: string;
  labels: string[];
  values: number[];
  format: (v: number) => string;
  /** Horizontal reference line — a target, a promotion bar, a nominal level. */
  reference?: { value: number; label: string; tone?: "good" | "warning" | "critical" };
  /** Forces the y-domain; otherwise it is padded around the data. */
  domain?: [number, number];
  color?: string;
  height?: number;
};

/**
 * One metric, one y-axis. Compose several of these into a grid for a
 * multi-metric view — that is the small-multiples answer to "two scales".
 */
export function LinePanel({
  title, hint, labels, values, format, reference, domain, color = "var(--accent)", height = 132,
}: LinePanelProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 100; // viewBox units; the SVG scales to its container
  const padT = 8, padB = 18, padL = 2, padR = 2;

  const { lo, hi } = useMemo(() => {
    const all = reference ? [...values, reference.value] : values;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (domain) [lo, hi] = domain;
    else {
      const pad = (hi - lo) * 0.18 || Math.abs(hi) * 0.1 || 1;
      lo -= pad; hi += pad;
    }
    return { lo, hi };
  }, [values, reference, domain]);

  // No points yet (a new tenant, or a role without access to the series): say so
  // rather than drawing a path through NaN.
  if (values.length === 0) {
    return (
      <figure className="chart-panel">
        <figcaption><span className="chart-title">{title}</span></figcaption>
        {hint && <p className="chart-hint">{hint}</p>}
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>No data yet.</p>
      </figure>
    );
  }

  const x = (i: number) => padL + (i / Math.max(1, values.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (height - padT - padB);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const last = values.length - 1;

  return (
    <figure className="chart-panel">
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-readout tnum">
          {format(hover === null ? values[last] : values[hover])}
          <span className="chart-readout-when">{hover === null ? labels[last] : labels[hover]}</span>
        </span>
      </figcaption>
      {hint && <p className="chart-hint">{hint}</p>}
      <div className="chart-plot" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${title} over time`}>
          {/* recessive baseline */}
          <line x1={padL} y1={height - padB} x2={W - padR} y2={height - padB} stroke={AXIS} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          {reference && (
            <line
              x1={padL} y1={y(reference.value)} x2={W - padR} y2={y(reference.value)}
              stroke={reference.tone ? `var(--status-${reference.tone})` : AXIS}
              strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
            />
          )}
          <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {hover !== null && (
            <line x1={x(hover)} y1={padT} x2={x(hover)} y2={height - padB} stroke={INK_MUTED} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          )}
          <circle cx={x(hover ?? last)} cy={y(values[hover ?? last])} r={3} fill={color} stroke="var(--surface-1)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* hover hit-targets, wider than the marks */}
        <div className="chart-hit-row" onMouseLeave={() => setHover(null)}>
          {values.map((_, i) => (
            <button
              key={i}
              type="button"
              className="chart-hit"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${labels[i]}: ${format(values[i])}`}
            />
          ))}
        </div>
      </div>
      <div className="chart-xaxis">
        <span>{labels[0]}</span>
        {reference && <span className="chart-ref-label">{reference.label}</span>}
        <span>{labels[last]}</span>
      </div>
    </figure>
  );
}

/** Small-multiples grid — the sanctioned way to show metrics of different scale. */
export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="panel-grid">{children}</div>;
}

// --- Risk gauge -------------------------------------------------------------

/**
 * The single highest-priority glanceable number on a clinical screen.
 * Magnitude is carried by arc length first and ramp step second, and the
 * percentage is always printed with a population-percentile phrase (§14.3.3).
 */
export function RiskGauge({
  label, modelId, probability, calibrated, size = 132, threshold, flag,
}: {
  label: string; modelId: string; probability: number | null; calibrated: boolean;
  size?: number; threshold?: number; flag?: boolean;
}) {
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  // 240° arc, opening at the bottom — an instrument dial, not a full ring.
  const START = 150, SWEEP = 240;
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = polar(from);
    const [x2, y2] = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
  };
  const p = probability ?? 0;
  const color = seqToken(probability);

  return (
    <div className="gauge">
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} role="img"
        aria-label={`${label}: ${probability === null ? "not estimated" : pct(probability, 1)}, ${percentilePhrase(probability)}`}>
        <path d={arc(START, START + SWEEP)} fill="none" stroke="var(--seq-track)" strokeWidth={9} strokeLinecap="round" />
        {/* Quarter ticks just outside the track: the dial reads as an instrument scale. */}
        {[0, 0.25, 0.5, 0.75, 1].map((q) => {
          const deg = ((START + SWEEP * q) * Math.PI) / 180;
          const [ox, oy] = [cx + (r + 8) * Math.cos(deg), cy + (r + 8) * Math.sin(deg)];
          const [ix, iy] = [cx + (r + 5.5) * Math.cos(deg), cy + (r + 5.5) * Math.sin(deg)];
          return <line key={q} className="gauge-tick" x1={ix} y1={iy} x2={ox} y2={oy} />;
        })}
        {probability !== null && p > 0 && (
          <>
            <path
              className="gauge-fill" pathLength={1}
              d={arc(START, START + SWEEP * Math.max(0.012, p))} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
            />
            {(() => {
              const [ex, ey] = polar(START + SWEEP * Math.max(0.012, p));
              return <circle className="gauge-cap" cx={ex} cy={ey} r={3.4} stroke={color} />;
            })()}
          </>
        )}
        {threshold !== undefined && (
          (() => {
            const [tx, ty] = polar(START + SWEEP * threshold);
            const [ix, iy] = [cx + (r - 8) * (tx - cx) / r, cy + (r - 8) * (ty - cy) / r];
            return <line x1={ix} y1={iy} x2={tx} y2={ty} stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" />;
          })()
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" className="gauge-value tnum">
          {probability === null ? "—" : pct(probability, probability < 0.1 ? 1 : 0)}
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle" className="gauge-model">{modelId}</text>
      </svg>
      <div className="gauge-caption">
        <strong>{label}</strong>
        <span className="muted">{percentilePhrase(probability)}</span>
        <span className={calibrated ? "cal-badge is-cal" : "cal-badge"}>
          {calibrated ? "Calibrated" : "uncalibrated"}
        </span>
        {flag && <span className="cal-badge is-flag">above alert threshold</span>}
      </div>
    </div>
  );
}

// --- Horizontal magnitude bars ---------------------------------------------

/**
 * Ranked magnitude comparison. One sequential hue: the bar length does the work,
 * the ramp step reinforces it, and every row carries its printed value.
 */
export function BarRows({
  rows, max, format = (v: number) => pct(v, 1), colorBy = "magnitude", dense,
}: {
  rows: { key: string; label: ReactNode; value: number; meta?: ReactNode; swatch?: string; icon?: ReactNode }[];
  max?: number; format?: (v: number) => string; colorBy?: "magnitude" | "swatch"; dense?: boolean;
}) {
  const ceiling = max ?? Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className={`bar-rows${dense ? " is-dense" : ""}${rows.some((r) => r.icon) ? " has-icons" : ""}`}>
      {rows.map((r) => (
        <li key={r.key}>
          {r.icon && <span className="bar-row-icon">{r.icon}</span>}
          <div className="bar-row-head">
            <span className="bar-row-label">
              {r.swatch && !r.icon && <span className="chip-swatch" style={{ background: r.swatch }} />}
              {r.label}
            </span>
            <span className="bar-row-value tnum">{format(r.value)}</span>
          </div>
          <div className="meter">
            <div
              className="meter-fill"
              style={{
                width: `${Math.max(1.5, (r.value / ceiling) * 100)}%`,
                background: colorBy === "swatch" && r.swatch ? r.swatch : seqToken(r.value),
              }}
            />
          </div>
          {r.meta && <p className="bar-row-meta">{r.meta}</p>}
        </li>
      ))}
    </ul>
  );
}

// --- Reliability / calibration plot -----------------------------------------

/**
 * Predicted vs. observed, with the 45° perfect-calibration reference. This is
 * the evidence behind the "Calibrated" badge, so it ships as a real plot rather
 * than a single ECE number.
 */
export function ReliabilityPlot({
  bins, ece, size = 220,
}: { bins: { predicted: number; observed: number; n: number }[]; ece: number; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const pad = 26;
  const x = (v: number) => pad + v * (size - pad * 2);
  const y = (v: number) => size - pad - v * (size - pad * 2);
  return (
    <figure className="chart-panel">
      <figcaption>
        <span className="chart-title">Reliability — predicted vs. observed</span>
        <span className="chart-readout tnum">ECE {ece.toFixed(3)}</span>
      </figcaption>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Calibration plot, expected calibration error ${ece.toFixed(3)}`}>
        <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} fill="none" stroke={AXIS} strokeWidth={1} />
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g}>
            <line x1={x(g)} y1={pad} x2={x(g)} y2={size - pad} stroke={AXIS} strokeWidth={0.5} />
            <line x1={pad} y1={y(g)} x2={size - pad} y2={y(g)} stroke={AXIS} strokeWidth={0.5} />
          </g>
        ))}
        {/* perfect calibration */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={INK_MUTED} strokeWidth={1} strokeDasharray="4 3" />
        <polyline
          points={bins.map((b) => `${x(b.predicted)},${y(b.observed)}`).join(" ")}
          fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round"
        />
        {bins.map((b, i) => (
          <circle
            key={i} cx={x(b.predicted)} cy={y(b.observed)} r={hover === i ? 6 : 4.5}
            fill="var(--accent)" stroke="var(--surface-1)" strokeWidth={2}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={size / 2} y={size - 6} textAnchor="middle" className="axis-text">predicted probability</text>
        <text x={10} y={size / 2} textAnchor="middle" transform={`rotate(-90 10 ${size / 2})`} className="axis-text">observed rate</text>
      </svg>
      <p className="chart-hint">
        {hover === null
          ? "The dashed line is perfect calibration. Points below it mean the model over-predicts; above, it under-predicts."
          : `Predicted ${pct(bins[hover].predicted, 0)} · observed ${pct(bins[hover].observed, 1)} · n=${bins[hover].n.toLocaleString()}`}
      </p>
    </figure>
  );
}

// --- Canary slider (§11.3) --------------------------------------------------

export function CanarySlider({
  value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  return (
    <div className="canary">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <label htmlFor="canary-range" className="field-label" style={{ margin: 0 }}>Traffic share</label>
        <span className="canary-value tnum">{draft}%</span>
      </div>
      <input
        id="canary-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(Number(e.target.value))}
        className="range"
      />
      <div className="canary-foot">
        <span className="muted" style={{ fontSize: 12.5 }}>
          {draft === 0 ? "No traffic — the version is staged but dark."
            : draft <= 10 ? "Canary. Watch stratified ECE and Recall@20 hourly before advancing."
            : draft < 100 ? "Partial rollout. Both versions are serving; results stay comparable."
            : "Full rollout. Every tenant not pinned to an older version gets this one."}
        </span>
        {dirty && (
          <button type="button" className="btn btn-sm btn-primary" disabled={disabled} onClick={() => onChange(draft)}>
            Confirm {draft}%
          </button>
        )}
      </div>
    </div>
  );
}
