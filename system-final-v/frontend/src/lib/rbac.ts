/**
 * Role catalog and permission matrix — PRODUCT_BLUEPRINT §4.3 / §4.6.
 *
 * Permissions are `resource:action` strings. Access is graded, not boolean:
 *   full       (●) standing access at the role's scope
 *   scoped     (◐) own-record / assigned-roster / unit only
 *   cosign     (△) allowed, but a second approver must sign
 *   breakglass (⚡) not standing — only via a time-boxed elevation (§4.8)
 *   none       (○)
 * The UI renders the grade, it does not collapse it to yes/no: a scoped or
 * co-sign capability still shows, with its constraint stated on the control.
 */

export type RoleCode =
  | "super_admin"
  | "tenant_owner"
  | "it_admin"
  | "privacy_officer"
  | "billing_admin"
  | "physician"
  | "resident"
  | "np_pa"
  | "charge_nurse"
  | "staff_nurse"
  | "case_manager"
  | "pharmacist"
  | "auditor"
  | "patient"
  | "guest";

export type Grade = "full" | "scoped" | "cosign" | "breakglass" | "none";

export type Permission =
  | "patient:read"
  | "patient:write"
  | "assess:run"
  | "explain:view"
  | "roster:view"
  | "fairness:audit_view"
  | "chat:use"
  | "export:phi"
  | "export:deidentified"
  | "transfer:initiate"
  | "transfer:approve"
  | "user:manage"
  | "tenant:manage"
  | "tenant:create"
  | "billing:view"
  | "audit:view"
  | "audit:cross_tenant"
  | "model:admin"
  | "break_glass:invoke"
  | "delegation:grant";

export type Surface = "clinician" | "admin" | "ops" | "patient";

export type RoleMeta = {
  code: RoleCode;
  /** Title a human sees. */
  label: string;
  /** Which console this role lands in after login. */
  surface: Surface;
  /** Where "/" redirects for this role — §12.2's role-based redirect. */
  home: string;
  /** HL7 PractitionerRole mapping, shown in Roles & Scopes (§11.4.5). */
  hl7: string;
  scopeLabel: string;
  blurb: string;
};

export const ROLES: Record<RoleCode, RoleMeta> = {
  super_admin: {
    code: "super_admin",
    label: "Super-Admin (Platform)",
    surface: "ops",
    home: "/ops/fleet",
    hl7: "n/a — platform, not clinical",
    scopeLabel: "Cross-tenant (elevation-gated)",
    blurb:
      "ESAP platform staff. Zero standing access to PHI; cross-tenant reach only through an audited break-glass elevation.",
  },
  tenant_owner: {
    code: "tenant_owner",
    label: "Hospital Admin",
    surface: "admin",
    home: "/admin/home",
    hl7: "administrative",
    scopeLabel: "Single tenant, all facilities",
    blurb:
      "The hospital contract signatory / CMIO office. Owns roster, units, model display policy and billing.",
  },
  it_admin: {
    code: "it_admin",
    label: "IT Admin",
    surface: "admin",
    home: "/admin/integrations",
    hl7: "ICT professional",
    scopeLabel: "Single tenant, config only",
    blurb:
      "Integration lead. Provisions users and wires SSO / SMART / ADT — but never grants clinical roles.",
  },
  privacy_officer: {
    code: "privacy_officer",
    label: "Compliance / Privacy Officer",
    surface: "admin",
    home: "/admin/audit",
    hl7: "172 — privacy officer",
    scopeLabel: "Single tenant, audit and governance only",
    blurb:
      "HIPAA Privacy Officer. Lives in the audit log and the fairness panel; cannot open a chart or run a model.",
  },
  billing_admin: {
    code: "billing_admin",
    label: "Billing Admin",
    surface: "admin",
    home: "/admin/billing",
    hl7: "administrative",
    scopeLabel: "Single tenant, billing only",
    blurb: "Revenue-cycle contact. Plan, usage and invoices — no clinical surface at all.",
  },
  physician: {
    code: "physician",
    label: "Attending Physician",
    surface: "clinician",
    home: "/doctor/worklist",
    hl7: "doctor",
    scopeLabel: "Facility + unit + assigned patients",
    blurb:
      "The primary decision-maker. Runs assessments, reads every Why panel, acknowledges and acts.",
  },
  resident: {
    code: "resident",
    label: "Resident / Fellow",
    surface: "clinician",
    home: "/doctor/worklist",
    hl7: "doctor (trainee)",
    scopeLabel: "Same as physician, co-sign gated",
    blurb:
      "Full clinical workspace, but acknowledgements route to an attending for co-sign when the tenant requires it.",
  },
  np_pa: {
    code: "np_pa",
    label: "Nurse Practitioner / PA",
    surface: "clinician",
    home: "/doctor/worklist",
    hl7: "nurse / doctor hybrid",
    scopeLabel: "Facility + unit + assigned patients",
    blurb:
      "Independent clinical authority on assigned patients: intake, assess, acknowledge, initiate transfer.",
  },
  charge_nurse: {
    code: "charge_nurse",
    label: "Charge Nurse",
    surface: "clinician",
    home: "/nurse/roster",
    hl7: "nurse",
    scopeLabel: "Unit-level roster (all patients on unit)",
    blurb:
      "Owns the unit. Sees every patient risk ranking to allocate staffing and drive the shift handoff.",
  },
  staff_nurse: {
    code: "staff_nurse",
    label: "Staff / Bedside Nurse",
    surface: "clinician",
    home: "/nurse/my-patients",
    hl7: "nurse",
    scopeLabel: "Assigned patients only",
    blurb:
      "Captures the intake every model runs on. Reads risk summaries; escalates rather than acknowledges.",
  },
  case_manager: {
    code: "case_manager",
    label: "Care Coordinator / Case Manager",
    surface: "clinician",
    // Was "/doctor/worklist?tab=discharge" — WorklistPage never read that query
    // param, so this role landed on the plain mortality/ICU worklist instead of
    // the discharge-focused screen its own blurb describes. Point it at the
    // real screen.
    home: "/doctor/discharge",
    hl7: "226 — care coordination",
    scopeLabel: "Assigned caseload, LOS + readmission focus",
    blurb:
      "Works the discharge-planning view: M-04 readmission and M-05 length-of-stay drive the whole day.",
  },
  pharmacist: {
    code: "pharmacist",
    label: "Clinical Pharmacist",
    surface: "clinician",
    home: "/doctor/worklist",
    hl7: "pharmacist",
    scopeLabel: "Assigned patients, read-only",
    // Was "Medication-relevant slice only: the drivers that are drug-related,
    // and nothing else" — home medications are not yet a dense feature the
    // models take as input, so there is no medication-specific driver to filter
    // to. Corrected to describe what this role actually sees today rather than
    // a filter that doesn't exist, pending that model input landing.
    blurb: "Read-only clinical view of the assessment and its drivers, same as any other reviewer. Home medications are not yet a model input, so there is no medication-specific filter here.",
  },
  auditor: {
    code: "auditor",
    label: "Quality / QI Auditor",
    surface: "admin",
    home: "/admin/usage",
    hl7: "administrative",
    scopeLabel: "Facility, de-identified where possible",
    blurb:
      "Reads the fairness and calibration evidence, exports de-identified cohorts, never exports PHI.",
  },
  patient: {
    code: "patient",
    label: "Patient / Caregiver",
    surface: "patient",
    home: "/patient/home",
    hl7: "n/a (RelatedPerson for proxies)",
    scopeLabel: "Self only (or guardian via proxy)",
    blurb: "Sees plain-language, clinician-released content only — never a raw model score.",
  },
  guest: {
    code: "guest",
    label: "Individual / Guest",
    surface: "patient",
    home: "/patient/home",
    hl7: "n/a",
    scopeLabel: "Self (single-seat tenant-of-one)",
    blurb: "Self-serve tier. The union of patient + self-assessment rights on exactly one seat.",
  },
};

const F: Grade = "full";
const S: Grade = "scoped";
const C: Grade = "cosign";
const B: Grade = "breakglass";

/** §4.6 — the matrix, transcribed. A missing entry means "none". */
export const MATRIX: Record<RoleCode, Partial<Record<Permission, Grade>>> = {
  physician: {
    "patient:read": S,
    "patient:write": F,
    "assess:run": F,
    "explain:view": F,
    "roster:view": S,
    "chat:use": F,
    "export:phi": S,
    "transfer:initiate": F,
    "break_glass:invoke": F,
    "delegation:grant": F,
  },
  resident: {
    "patient:read": C,
    "patient:write": F,
    "assess:run": F,
    "explain:view": F,
    "roster:view": S,
    "chat:use": F,
    "break_glass:invoke": F,
  },
  np_pa: {
    "patient:read": S,
    "patient:write": F,
    "assess:run": F,
    "explain:view": F,
    "roster:view": S,
    "chat:use": F,
    "export:phi": S,
    "transfer:initiate": F,
    "break_glass:invoke": F,
    "delegation:grant": F,
  },
  charge_nurse: {
    "patient:read": S,
    "explain:view": S,
    "roster:view": F,
    "break_glass:invoke": F,
    "delegation:grant": F,
  },
  staff_nurse: {
    "patient:read": S,
    "patient:write": S,
    "explain:view": S,
    "break_glass:invoke": F,
  },
  case_manager: {
    "patient:read": S,
    "explain:view": S,
    "roster:view": S,
    "chat:use": F,
    "export:phi": S,
    "transfer:initiate": F,
    "transfer:approve": C,
    "delegation:grant": F,
  },
  pharmacist: { "patient:read": S, "explain:view": S },
  auditor: {
    "patient:read": S,
    "explain:view": F,
    "roster:view": F,
    "fairness:audit_view": F,
    "export:deidentified": F,
    "audit:view": F,
  },
  patient: {
    "patient:read": S,
    "explain:view": S,
    "chat:use": S,
    "export:phi": S,
    "transfer:initiate": F,
    "billing:view": S,
  },
  guest: {
    "patient:read": S,
    "patient:write": S,
    "assess:run": S,
    "explain:view": S,
    "chat:use": S,
    "export:phi": S,
    "billing:view": S,
  },
  tenant_owner: {
    "user:manage": F,
    "tenant:manage": F,
    "billing:view": F,
    "audit:view": S,
    "transfer:initiate": F,
    "transfer:approve": C,
  },
  it_admin: { "user:manage": S, "tenant:manage": F },
  privacy_officer: { "fairness:audit_view": F, "audit:view": F },
  billing_admin: { "billing:view": F },
  super_admin: {
    "patient:read": B,
    "fairness:audit_view": F,
    "user:manage": F,
    "tenant:manage": F,
    "tenant:create": F,
    "audit:view": F,
    "audit:cross_tenant": F,
    "model:admin": F,
  },
};

export function grade(role: RoleCode, perm: Permission): Grade {
  return MATRIX[role]?.[perm] ?? "none";
}

/** True when the role can reach the capability at all (any grade but "none"). */
export function can(role: RoleCode, perm: Permission): boolean {
  return grade(role, perm) !== "none";
}

/** True only for unconstrained standing access — use for destructive affordances. */
export function canFully(role: RoleCode, perm: Permission): boolean {
  return grade(role, perm) === "full";
}

export const GRADE_SYMBOL: Record<Grade, string> = {
  full: "●",
  scoped: "◐",
  cosign: "△",
  breakglass: "⚡",
  none: "○",
};

export const GRADE_LABEL: Record<Grade, string> = {
  full: "Full access",
  scoped: "Scoped — assigned patients / own record only",
  cosign: "Requires a second approver",
  breakglass: "Break-glass only — time-boxed and reviewed",
  none: "No access",
};

export const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "patient:read", label: "View patient", group: "Clinical" },
  { key: "patient:write", label: "Create / edit intake", group: "Clinical" },
  { key: "assess:run", label: "Run M-01 – M-05", group: "Clinical" },
  { key: "explain:view", label: "Why / explainability", group: "Clinical" },
  { key: "roster:view", label: "Unit risk roster", group: "Clinical" },
  { key: "chat:use", label: "Chat assistant", group: "Clinical" },
  { key: "fairness:audit_view", label: "Fairness / audit covariates", group: "Governance" },
  { key: "audit:view", label: "Audit log (own tenant)", group: "Governance" },
  { key: "audit:cross_tenant", label: "Audit log (cross-tenant)", group: "Governance" },
  { key: "export:phi", label: "Export PHI", group: "Governance" },
  { key: "export:deidentified", label: "Export de-identified", group: "Governance" },
  { key: "break_glass:invoke", label: "Invoke break-glass", group: "Governance" },
  { key: "delegation:grant", label: "Delegate own permissions", group: "Governance" },
  { key: "transfer:initiate", label: "Initiate record transfer", group: "Interop" },
  { key: "transfer:approve", label: "Approve inbound transfer", group: "Interop" },
  { key: "user:manage", label: "Manage users", group: "Platform" },
  { key: "tenant:manage", label: "Manage tenant config", group: "Platform" },
  { key: "tenant:create", label: "Create / suspend a tenant", group: "Platform" },
  { key: "billing:view", label: "Billing", group: "Platform" },
  { key: "model:admin", label: "Model / feature-flag admin", group: "Platform" },
];

export const CLINICAL_ROLES: RoleCode[] = [
  "physician",
  "resident",
  "np_pa",
  "charge_nurse",
  "staff_nurse",
  "case_manager",
  "pharmacist",
];

export const ADMIN_ROLES: RoleCode[] = [
  "tenant_owner",
  "it_admin",
  "privacy_officer",
  "billing_admin",
  "auditor",
];
