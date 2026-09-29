/** Formatting helpers. Every number a clinician compares is rendered tabular. */

import { NOW } from "@/mock/db";
import { currentLang } from "@/i18n";

export function pct(p: number | null | undefined, digits = 0): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

export function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/**
 * Arabic counted nouns: 1 and 2 use the singular and dual forms with no numeral,
 * 3–10 take the plural, 11+ take the accusative singular.
 */
const AR_UNITS = {
  min: { one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة" },
  h: { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" },
  d: { one: "يوم", two: "يومين", few: "أيام", many: "يومًا" },
  mo: { one: "شهر", two: "شهرين", few: "أشهر", many: "شهرًا" },
} as const;

function arCount(n: number, unit: keyof typeof AR_UNITS): string {
  const u = AR_UNITS[unit];
  if (n === 1) return u.one;
  if (n === 2) return u.two;
  if (n <= 10) return `${n} ${u.few}`;
  return `${n} ${u.many}`;
}

/** "3 h ago" / "in 5 d" (or the Arabic equivalent) — relative to the demo's fixed NOW. */
export function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((NOW.getTime() - then) / 60_000);
  const future = diffMin < 0;
  const m = Math.abs(diffMin);

  const [n, unit]: [number, "min" | "h" | "d" | "mo"] | [0, "now"] =
    m < 1 ? [0, "now"] :
    m < 60 ? [m, "min"] :
    m < 60 * 36 ? [Math.round(m / 60), "h"] :
    m < 60 * 24 * 60 ? [Math.round(m / 1440), "d"] :
    [Math.round(m / 43200), "mo"];

  if (currentLang() === "ar") {
    if (unit === "now") return "الآن";
    return future ? `خلال ${arCount(n, unit)}` : `منذ ${arCount(n, unit)}`;
  }

  if (unit === "now") return "just now";
  const body = `${n} ${unit}`;
  return future ? `in ${body}` : `${body} ago`;
}

/** Arabic with Gregorian calendar and Latin digits — the convention in clinical records. */
function locale(): string {
  return currentLang() === "ar" ? "ar-u-ca-gregory-nu-latn" : "en-GB";
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

export function dateTimeLabel(iso: string): string {
  return `${dateLabel(iso)} · ${timeLabel(iso)}`;
}

/**
 * Maps a probability to a step on the sequential ramp (§14.3). One hue, never a
 * stoplight — magnitude is carried by lightness plus the printed number.
 */
export function seqToken(p: number | null | undefined): string {
  if (p === null || p === undefined) return "var(--seq-track)";
  if (p < 0.05) return "var(--seq-100)";
  if (p < 0.15) return "var(--seq-250)";
  if (p < 0.3) return "var(--seq-400)";
  if (p < 0.5) return "var(--seq-500)";
  if (p < 0.75) return "var(--seq-600)";
  return "var(--seq-700)";
}

/**
 * The population-percentile phrase that must accompany every probability —
 * §14.3.3 requires the number never stand alone.
 */
export function percentilePhrase(p: number | null | undefined): string {
  if (p === null || p === undefined) return "not estimated";
  if (p < 0.02) return "lower than most admissions";
  if (p < 0.08) return "below the typical admission";
  if (p < 0.2) return "around the middle of admissions";
  if (p < 0.45) return "above the typical admission";
  if (p < 0.7) return "in the upper range of admissions";
  return "among the highest of admissions";
}

export function initials(name: string): string {
  return name
    .replace(/(Dr\.|,.*$)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
