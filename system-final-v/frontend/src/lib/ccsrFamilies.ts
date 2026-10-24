/**
 * CCSR family -> categorical color slot.
 *
 * dataviz rule: assign categorical hues in FIXED order, never cycled; at most 8
 * distinct hues on screen at once; overflow folds to a neutral "Other" swatch.
 * Color follows the ENTITY (family name), not its rank in a given differential,
 * so the same family always gets the same swatch across results.
 *
 * We keep a stable, curated ordering of the clinically most-common families to
 * the 8 validated categorical slots (see references/palette.md). Any family past
 * slot 8 — and the excluded SYM/FAC/symptom families — render neutral. The chip
 * always carries the family NAME text, so color is reinforcing, never the sole
 * carrier of identity.
 */

// The 8 categorical hues (light / dark), from the validated reference palette.
export const CATEGORICAL_SLOTS: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // 1 blue
  { light: "#eb6834", dark: "#d95926" }, // 2 orange
  { light: "#1baf7a", dark: "#199e70" }, // 3 aqua
  { light: "#eda100", dark: "#c98500" }, // 4 yellow
  { light: "#e87ba4", dark: "#d55181" }, // 5 magenta
  { light: "#008300", dark: "#008300" }, // 6 green
  { light: "#4a3aa7", dark: "#9085e9" }, // 7 violet
  { light: "#e34948", dark: "#e66767" }, // 8 red
];

/**
 * The body systems a CCSR family can name. The API spells families several
 * ways ("Endocrine" / "Endocrine/metabolic", "Mental/Behavioural" /
 * "Mental/behavioral", "Nervous" / "Nervous system"), so a family is resolved by
 * its leading word rather than by exact string — an exact-match table silently
 * turned most families grey.
 */
export type BodySystem =
  | "circulatory" | "endocrine" | "respiratory" | "genitourinary" | "mental" | "digestive"
  | "nervous" | "infectious" | "blood" | "musculoskeletal" | "injury" | "neoplasm" | "other";

const SYSTEM_PREFIX: [string, BodySystem][] = [
  ["circ", "circulatory"], ["endo", "endocrine"], ["resp", "respiratory"], ["genito", "genitourinary"],
  ["mental", "mental"], ["digest", "digestive"], ["nerv", "nervous"], ["infect", "infectious"],
  ["blood", "blood"], ["musc", "musculoskeletal"], ["injur", "injury"], ["neoplas", "neoplasm"],
];

export function bodySystem(family: string): BodySystem {
  const f = (family || "").trim().toLowerCase();
  return SYSTEM_PREFIX.find(([p]) => f.startsWith(p))?.[1] ?? "other";
}

// Fixed system -> slot index. Ordered by prevalence in an adult intake cohort so
// the common families get the leading (most-separable) slots. Blood,
// musculoskeletal, injury and neoplasms fold to the neutral "Other" swatch: a 9th
// hue would break the validated 8-slot palette. Their icon still tells them apart.
const SYSTEM_SLOT: Partial<Record<BodySystem, number>> = {
  circulatory: 0,
  endocrine: 1,
  respiratory: 2,
  genitourinary: 3,
  mental: 4,
  digestive: 5,
  nervous: 6,
  infectious: 7,
};

/** Returns a CSS custom-property-driven color pair, or null for the neutral "Other". */
export function familySlot(family: string): number | null {
  return SYSTEM_SLOT[bodySystem(family)] ?? null;
}

/**
 * Resolve a family to the CSS variable name the chip should use for its accent.
 * Neutral families use the muted token so they read as "Other" without inventing
 * a 9th hue.
 */
export function familyColorVar(family: string): string {
  const slot = familySlot(family);
  return slot === null ? "var(--cat-other)" : `var(--cat-${slot + 1})`;
}
