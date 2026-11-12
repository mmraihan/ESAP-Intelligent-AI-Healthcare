/**
 * English / Arabic, with full right-to-left layout.
 *
 * Two languages only, by product decision. English strings are the keys: a
 * component writes `t("Share & consent")`, and the Arabic dictionary maps that
 * exact string to its translation. A missing entry falls back to English, and
 * the i18n test fails the build if any key used on a translated surface has no
 * Arabic entry — so a half-translated screen cannot ship silently.
 *
 * Language is chosen on the patient-facing surfaces (§13.5) and applies there:
 * the patient portal, the welcome screen, and sign-in / sign-up / invite. The
 * clinical, admin and ops consoles stay English regardless, so a patient-side
 * preference never flips a clinician's workstation into a layout they did not
 * choose.
 */
import { Fragment, useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";
import { AR } from "./ar";

export type Lang = "en" | "ar";

const STORAGE_KEY = "esap.lang";

/**
 * Route prefixes where the chosen language applies. Everything else is English.
 * The public website (product, pricing, security, evidence, FAQ, waitlist and
 * the legal pages) is localised too (QA issue 14).
 */
export const LOCALISED_PREFIXES = [
  "/patient", "/welcome", "/login", "/signup", "/invite", "/reset-password", "/privacy", "/terms",
  "/product", "/pricing", "/security", "/evidence", "/faq", "/waitlist",
];

export function isLocalisedPath(pathname: string): boolean {
  // "/" is the product page for a signed-out visitor; matched exactly, never as a prefix.
  if (pathname === "/") return true;
  return LOCALISED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

type LangState = { lang: Lang; setLang: (l: Lang) => void };

export const useLangStore = create<LangState>((set) => ({
  lang: readStored(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* the choice still applies for this session */
    }
    set({ lang });
  },
}));

/**
 * The language actually rendering right now. Set by the provider during render,
 * before any child renders, so plain `t()` calls in children read the right one.
 */
let current: Lang = "en";

export function currentLang(): Lang {
  return current;
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Translate an English string. Falls back to the English text if no entry exists. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = current === "ar" ? AR[key] ?? key : key;
  return interpolate(s, vars);
}

/**
 * Render a translated string that carries **bold** spans. Word order differs
 * between English and Arabic, so emphasis lives inside the translated sentence
 * rather than being stitched together from fragments.
 */
export function rich(s: string, Tag: "strong" | "mark" | "em" = "strong"): ReactNode {
  const parts = s.split("**");
  return parts.map((p, i) => (i % 2 === 1 ? <Tag key={i}>{p}</Tag> : <Fragment key={i}>{p}</Fragment>));
}

/** `t()` then `rich()`. */
export function tr(key: string, vars?: Record<string, string | number>): ReactNode {
  return rich(t(key, vars));
}

/** `t()` then `rich()` with the emphasis as <mark> (the landing page's highlighted drivers). */
export function tm(key: string): ReactNode {
  return rich(t(key), "mark");
}

/**
 * Translate a sentence that carries links or other elements. The element goes
 * in as a `{name}` placeholder, so the Arabic sentence can put it where Arabic
 * word order needs it: tl("See the {faq}.", { faq: <Link to="/faq">{t("full FAQ")}</Link> }).
 * Bold `**…**` spans in the surrounding text still work.
 */
export function tl(key: string, nodes: Record<string, ReactNode>): ReactNode {
  return t(key).split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in nodes ? nodes[m[1]] : rich(part)}</Fragment>;
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const lang = useLangStore((s) => s.lang);
  const effective: Lang = isLocalisedPath(pathname) ? lang : "en";
  current = effective;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", effective);
    root.setAttribute("dir", effective === "ar" ? "rtl" : "ltr");
  }, [effective]);

  // Keyed so a language switch remounts the tree and every t() re-reads.
  return <Fragment key={effective}>{children}</Fragment>;
}

/** EN | العربية switch. Only rendered on the surfaces where language applies. */
export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLangStore();
  const opts: { value: Lang; label: string; aria: string }[] = [
    { value: "en", label: compact ? "EN" : "English", aria: "English" },
    { value: "ar", label: "العربية", aria: "Arabic" },
  ];
  return (
    <div className="theme-toggle" role="radiogroup" aria-label={t("Language")}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={lang === o.value}
          aria-label={o.aria}
          lang={o.value}
          className={`theme-opt${lang === o.value ? " is-active" : ""}`}
          onClick={() => setLang(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
