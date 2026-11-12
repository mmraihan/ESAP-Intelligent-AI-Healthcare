import type { ModelCard } from "@/mock/types";

/**
 * Whether a model's card holds measured results. A card with no evaluation
 * files carries zeros to fill its shape, and those must never be drawn as
 * scores: an ECE of 0.000 reads as perfect calibration.
 */
export function isEvaluated(m: ModelCard): boolean {
  return m.status !== "not_ready" && m.cohortN > 0;
}

/**
 * An expected calibration error for display. A real but tiny value must not
 * round to 0.000, which reads as perfect calibration (QA issue 4).
 */
export function formatEce(ece: number): string {
  return ece < 0.001 ? "< 0.001" : ece.toFixed(3);
}
