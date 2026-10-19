/**
 * Shared frame for sign-in and sign-up: the form on one side, a quiet brand
 * panel on the other — a live-looking heart monitor, a headline and a small
 * illustrative preview in the landing page's language. The panel follows the theme like the rest of the
 * page, and collapses away below 960px so the form is never pushed below the
 * fold. The `pub` root gives it the public palette (styles/public.css).
 */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { HeartMonitor } from "@/components/ui/HeartMonitor";
import { BedIcon, HeartPulseIcon, InfoIcon, RefreshIcon } from "@/components/ui/icons";

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

/** Illustrative values only — the preview says so, and it is hidden from assistive tech. */
const PREVIEW = [
  { label: "In-hospital mortality", p: 0.31, hue: "g1", icon: <HeartPulseIcon size={16} /> },
  { label: "ICU admission", p: 0.44, hue: "g2", icon: <BedIcon size={16} /> },
  { label: "30-day readmission", p: 0.18, hue: "g3", icon: <RefreshIcon size={16} /> },
] as const;

function AuthPreview() {
  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview-head">
        <span>{t("Calibrated")}</span>
        <span className="auth-preview-tag">{t("Illustrative")}</span>
      </div>
      {PREVIEW.map((r, i) => (
        <div key={r.label} className={`auth-preview-row ${r.hue}`}>
          <span className="auth-preview-icon">{r.icon}</span>
          <span>{t(r.label)}</span>
          <span className="auth-preview-bar">
            <span style={{ width: `${r.p * 100}%`, "--i": i } as CSSProperties} />
          </span>
          <span className="auth-preview-val">{Math.round(r.p * 100)}%</span>
        </div>
      ))}
      <p className="auth-preview-note">
        <InfoIcon size={13} /> {t("Illustrative demo values. Not a validated patient-specific prediction.")}
      </p>
    </div>
  );
}

export function AuthLayout({ variant, children }: { variant: "signin" | "signup"; children: ReactNode }) {
  const copy = COPY[variant];
  return (
    <div className="pub auth-page auth-split">
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <Link to="/product" className="brand-link"><BrandMark /></Link>

          <div className="auth-aside-copy">
            <div className="auth-rise" style={{ "--i": 0 } as CSSProperties}><HeartMonitor /></div>
            <h2 className="auth-aside-title auth-rise" style={{ "--i": 1 } as CSSProperties}>{t(copy.title)}</h2>
            <p className="auth-aside-lede auth-rise" style={{ "--i": 2 } as CSSProperties}>{t(copy.lede)}</p>
            <div className="auth-rise" style={{ "--i": 3 } as CSSProperties}><AuthPreview /></div>
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
