/**
 * Decorative heart monitor: a beating heart beside a sweeping ECG strip.
 * Shared by the sign-in / sign-up brand panel and the public landing page so
 * there is one implementation. Styles and keyframes: styles/heart-monitor.css.
 *
 * Four beats per 3.2s sweep = 75 bpm, matching the heart's pulse. The trace
 * takes --vital; reduced motion hides the moving segment and stills the heart.
 * Mirrored in RTL. Always aria-hidden: it carries no information.
 *
 * `children` sit between the heart and the strip (the landing hero puts its
 * eyebrow pill there); `size="sm"` is a compact variant and `size="lg"` the
 * landing hero's centrepiece.
 */
import type { ReactNode } from "react";
import "@/styles/heart-monitor.css";
import { HeartPulseIcon } from "./icons";

/** One P-QRS-T complex, 150 units wide on a 60-unit baseline; four make the strip. */
const beat = (x: number) =>
  `L${x + 30},60 Q${x + 37},50 ${x + 44},60 L${x + 56},60 L${x + 60},68 L${x + 66},14 L${x + 72},92 ` +
  `L${x + 77},60 L${x + 92},60 Q${x + 104},44 ${x + 116},60 L${x + 150},60`;
const ECG_PATH = `M0,60 ${[0, 150, 300, 450].map(beat).join(" ")}`;

export function HeartMonitor({
  size = "md",
  className,
  children,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
}) {
  const cls = ["heart-monitor", size !== "md" && `heart-monitor-${size}`, className].filter(Boolean).join(" ");
  const iconSize = size === "sm" ? 20 : size === "lg" ? 34 : 26;
  return (
    <div className={cls}>
      <div className="hm-pulse" aria-hidden="true">
        <span className="hm-pulse-ring" />
        <span className="hm-pulse-ring" style={{ animationDelay: "0.8s" }} />
        <span className="hm-pulse-core"><HeartPulseIcon size={iconSize} /></span>
      </div>
      {children}
      <svg className="hm-ecg" viewBox="0 0 600 110" preserveAspectRatio="none" aria-hidden="true">
        <path className="hm-ecg-base" d={ECG_PATH} pathLength={1000} />
        <path className="hm-ecg-trace" d={ECG_PATH} pathLength={1000} />
      </svg>
    </div>
  );
}
