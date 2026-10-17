/**
 * Shared frame for sign-in and sign-up: the form on one side, a quiet brand
 * panel on the other — a headline and a live-looking heart monitor. The panel
 * follows the theme like the rest of the page, and collapses away below 960px
 * so the form is never pushed below the fold.
 */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { HeartPulseIcon } from "@/components/ui/icons";

const COPY = {
  signin: {
    title: "Decision support at the moment of admission.",
    lede: "Five calibrated estimates from what is known at intake, each with its reasoning and its limits on the same card.",
  },
  signup: {
    title: "Run it on your own cases, today.",
    lede: "An individual seat takes a minute. Clinicians get the clinical interface; patients get the plain-language portal.",
  },
} as const;

/** One P-QRS-T complex, 150 units wide on a 60-unit baseline; four make the strip. */
const beat = (x: number) =>
  `L${x + 30},60 Q${x + 37},50 ${x + 44},60 L${x + 56},60 L${x + 60},68 L${x + 66},14 L${x + 72},92 ` +
  `L${x + 77},60 L${x + 92},60 Q${x + 104},44 ${x + 116},60 L${x + 150},60`;
const ECG_PATH = `M0,60 ${[0, 150, 300, 450].map(beat).join(" ")}`;

/** Decorative heart monitor. Four beats per 3.2s sweep = 75 bpm, matching the icon's pulse. */
function HeartMonitor() {
  return (
    <div className="auth-monitor" aria-hidden="true">
      <div className="auth-pulse">
        <span className="auth-pulse-ring" />
        <span className="auth-pulse-ring" style={{ animationDelay: "0.8s" }} />
        <span className="auth-pulse-core"><HeartPulseIcon size={26} /></span>
      </div>
      <svg className="auth-ecg" viewBox="0 0 600 110" preserveAspectRatio="none">
        <path className="auth-ecg-base" d={ECG_PATH} pathLength={1000} />
        <path className="auth-ecg-trace" d={ECG_PATH} pathLength={1000} />
      </svg>
    </div>
  );
}

export function AuthLayout({ variant, children }: { variant: "signin" | "signup"; children: ReactNode }) {
  const copy = COPY[variant];
  return (
    <div className="auth-page auth-split">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <Link to="/product" className="brand-link"><BrandMark /></Link>

          <div className="auth-aside-copy">
            <div className="auth-rise" style={{ "--i": 0 } as CSSProperties}><HeartMonitor /></div>
            <h2 className="auth-aside-title auth-rise" style={{ "--i": 1 } as CSSProperties}>{t(copy.title)}</h2>
            <p className="auth-aside-lede auth-rise" style={{ "--i": 2 } as CSSProperties}>{t(copy.lede)}</p>
          </div>

          <p className="auth-aside-foot">{t("Decision support, not diagnosis. A clinician reviews every estimate.")}</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-topline">
          <span className="auth-topline-brand"><Link to="/product" className="brand-link"><BrandMark /></Link></span>
          <div className="row" style={{ gap: 8, marginInlineStart: "auto" }}>
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>
        <div className="auth-main-body">{children}</div>
      </main>
    </div>
  );
}
