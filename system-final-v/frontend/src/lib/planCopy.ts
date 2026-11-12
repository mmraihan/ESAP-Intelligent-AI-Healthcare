/**
 * What a plan record may say to a customer today.
 *
 * Plan records come from the server and can be edited from the ops console, so
 * their text describes the intended product. Anything in them that is not built
 * yet is shown as planned here, on every customer-facing screen (QA issue 2).
 * The ops catalogue keeps the raw text.
 */
const AS_BUILT: Record<string, string> = {
  "Admin console + SSO": "Admin console (hospital SSO planned)",
  "TEFCA / external EHR transfer": "TEFCA / external EHR transfer (planned)",
  "SMART on FHIR launch": "SMART on FHIR launch (planned)",
  "SCIM provisioning": "SCIM provisioning (planned)",
  "On-prem / private-cloud delivery": "On-prem / private-cloud delivery (planned)",
  "Dedicated isolation tier": "Dedicated isolation tier (planned)",
  "Health systems, on-prem deployments, and anyone with a BAA negotiation.":
    "Health systems that need a dedicated deployment and a negotiated data processing agreement.",
  "TEFCA + ESAP fast path": "ESAP fast path (TEFCA planned)",
  "DB-per-tenant or single-tenant VPC": "Dedicated isolation planned",
  "US": "Saudi hosting planned",
  "US or EU": "Saudi hosting planned",
  "US, EU, or on-site": "Saudi hosting planned",
};

export function planCopy(text: string): string {
  return AS_BUILT[text] ?? text;
}
