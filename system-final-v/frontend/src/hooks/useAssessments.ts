/**
 * An encounter's stored assessments, newest first, from the API.
 *
 * Every number, driver and differential the clinical screens show for a
 * patient comes from here: the response the models actually returned, and the
 * intake features they were given.
 */
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { isLive } from "@/api/actions";

export type ApiContributor = {
  feature: string;
  human_label: string;
  value_display: string;
  direction: "increases" | "decreases";
  contribution: number;
  from_missing: boolean;
};

export type ApiExplanation = {
  method: "exact-linear" | "shap" | "marginal-occlusion";
  basis: string;
  top_contributors: ApiContributor[];
  caveats: string[];
  rationale: { text: string } | null;
  reconstruction_ok: boolean | null;
};

export type ApiOutcome = {
  model_id: string;
  status: string;
  model_version: string;
  result: Record<string, unknown> | null;
  explanation: ApiExplanation | null;
  reason?: string | null;
};

export type ApiDifferentialItem = {
  ccsr: string;
  probability: number;
  family: string;
  calibrated: boolean;
  from_unconfirmed_extraction: boolean;
  explanation: ApiExplanation | null;
};

export type StoredAssessment = {
  id: string;
  created_at: string;
  actor: string;
  features: {
    demographics?: { admission_age: number; is_female: number };
    admission_context?: { via_ed?: number; admission_type?: string; admission_location?: string };
    vitals?: Record<string, number | null>;
    labs?: Record<string, number>;
    prior_history?: { prior_ccsr: string[]; n_prior_admissions: number; charlson_index: number | null };
    meds?: string[];
    notes?: Record<string, string | null> | null;
  };
  response: {
    request_id: string;
    differential: ApiOutcome & { result: { items: ApiDifferentialItem[]; unscored_ccsr_count?: number } | null };
    mortality: ApiOutcome;
    icu: ApiOutcome;
    readmission: ApiOutcome;
    los: ApiOutcome;
  };
};

export function useAssessments(encounterId: string | undefined) {
  const [items, setItems] = useState<StoredAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId || !isLive()) { setItems([]); return; }
    let live = true;
    api.get<{ assessments: StoredAssessment[] }>(`/api/v1/encounters/${encounterId}/assessments`)
      .then((r) => { if (live) setItems(r.assessments); })
      .catch((e) => { if (live) { setItems([]); setError(e instanceof Error ? e.message : "Could not load"); } });
    return () => { live = false; };
  }, [encounterId]);

  return { assessments: items, latest: items?.[0] ?? null, loading: items === null, error };
}

/** The Why panel's shape, from an API explanation. */
export function toContributors(e: ApiExplanation | null | undefined) {
  return (e?.top_contributors ?? []).map((c) => ({
    label: c.human_label,
    valueDisplay: c.value_display,
    direction: c.direction,
    contribution: c.contribution,
    fromMissing: c.from_missing,
  }));
}
