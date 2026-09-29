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

// Fixed family -> slot index. Ordered by prevalence in an adult intake cohort so
// the common families get the leading (most-separable) slots.
const FAMILY_SLOT: Record<string, number> = {
  Circulatory: 0,
  "Endocrine/metabolic": 1,
  Respiratory: 2,
  Genitourinary: 3,
  "Mental/behavioral": 4,
  Digestive: 5,
  "Nervous system": 6,
  Infectious: 7,
};

/** Returns a CSS custom-property-driven color pair, or null for the neutral "Other". */
export function familySlot(family: string): number | null {
  return family in FAMILY_SLOT ? FAMILY_SLOT[family] : null;
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
