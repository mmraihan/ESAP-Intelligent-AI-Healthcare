import type { ModelCard } from "@/mock/types";

/**
 * Whether a model's card holds measured results. A card with no evaluation
 * files carries zeros to fill its shape, and those must never be drawn as
 * scores: an ECE of 0.000 reads as perfect calibration.
 */
export function isEvaluated(m: ModelCard): boolean {
  return m.status !== "not_ready" && m.cohortN > 0;
}
