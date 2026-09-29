/**
 * Platform domain types — the non-clinical entities the admin, ops, patient and
 * interop surfaces render. Mirrors PRODUCT_BLUEPRINT §5 (tenancy), §6 (data
 * model), §7 (interop), §9 (platform API), §17 (packaging).
 *
 * Clinical shapes (IntakeRequest / AssessResponse / Explanation) live in
 * ./clinical-types.ts, transcribed from API_CONTRACT.md.
 */

import type { RoleCode } from "@/lib/rbac";

export type StatusKind =
  | "active"
  | "pending"
  | "suspended"
  | "expired"
  | "revoked"
  | "degraded"
  | "healthy"
  | "failed"
  | "draft";

export type DeploymentMode = "saas" | "on_prem" | "individual";
export type IsolationTier = "shared_rls" | "schema_per_tenant" | "db_per_tenant" | "single_tenant_vpc";
export type PlanTier = "pilot" | "essential" | "professional" | "enterprise" | "free" | "pro";

// --- Tenancy (§5) -----------------------------------------------------------

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  mode: DeploymentMode;
  isolation: IsolationTier;
  region: "us-east" | "us-west" | "eu-central" | "on-site";
  plan: PlanTier;
  status: StatusKind;
  beds: number;
  seats: number;
  seatsUsed: number;
  facilities: number;
  goLive: string;
  lastEtlRefresh: string;
  openIncidents: number;
  /** 30-day assessment volume, the enterprise usage meter (§17.4). */
  assessments30d: number;
  adoptionPct: number;
  contact: string;
  brandingHex?: string;
}

export interface Facility {
  id: string;
  tenantId: string;
  name: string;
  type: "hospital" | "clinic" | "ed";
  beds: number;
  units: Unit[];
}

export interface Unit {
  id: string;
  name: string;
  serviceLine: string;
  beds: number;
  occupied: number;
}

// --- People (§4, §10) -------------------------------------------------------

export interface DirectoryUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roles: RoleCode[];
  /** Human-readable scope, e.g. "Unit: 4-West" or "Facility". */
  scope: string;
  unitIds: string[];
  status: StatusKind;
  mfa: "hardware_key" | "totp" | "none";
  sso: boolean;
  lastActive: string;
  createdAt: string;
  localTitle: string;
}

export interface Invite {
  id: string;
  tenantId: string;
  email: string;
  role: RoleCode;
  scope: string;
  status: StatusKind;
  sentAt: string;
  expiresAt: string;
  sentBy: string;
  remindersSent: number;
}

// --- Audit (§8.11, §11.4.10, §15.8) ----------------------------------------

export type AuditSeverity = "info" | "notice" | "warning" | "critical";

export interface AuditEvent {
  id: string;
  tenantId: string;
  at: string;
  actor: string;
  actorRole: RoleCode;
  action: string;
  target: string;
  outcome: "success" | "denied" | "error";
  severity: AuditSeverity;
  /** Required on break-glass and admin actions — §4.8. */
  reason?: string;
  ip: string;
  scope?: string;
}

export interface BreakGlassGrant {
  id: string;
  requestedBy: string;
  tenantId: string;
  tenantName: string;
  patientRef: string;
  reason: string;
  ticket: string;
  ttlMinutes: number;
  requestedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked" | "pending_approval";
  approver?: string;
}

// --- Interop (§7) -----------------------------------------------------------

export type TransferPath = "esap_fast" | "tefca" | "manual";
export type TransferState =
  | "requested"
  | "consent_pending"
  | "mpi_review"
  | "approved"
  | "delivered"
  | "rejected"
  | "expired";

export interface TransferRequest {
  id: string;
  direction: "inbound" | "outbound";
  path: TransferPath;
  counterparty: string;
  patientDisplay: string;
  mrn: string;
  requestedAt: string;
  state: TransferState;
  /** 0–1 probabilistic MPI match score; < 0.92 routes to human review (§7.3). */
  mpiScore: number;
  consentBasis: "patient_mediated" | "treatment" | "explicit_authorization";
  requestedBy: string;
  bundleItems: string[];
  note?: string;
}

// --- Encounters & clinical worklist (§12) ----------------------------------

export type EncounterState =
  | "intake_in_progress"
  | "awaiting_assessment"
  | "assessed"
  | "acknowledged"
  | "awaiting_cosign"
  | "closed";

export interface PatientSummary {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: "F" | "M";
  /** Audit covariates — captured for fairness reporting, NEVER model inputs (§6 guardrail 4). */
  auditCovariates: { race: string; insurance: string; maritalStatus: string };
}

export interface Encounter {
  id: string;
  tenantId: string;
  patient: PatientSummary;
  unitId: string;
  unitName: string;
  bed: string;
  admittedAt: string;
  /** t0 — the cut every feature respects. Equals admittime. */
  t0: string;
  admissionType: string;
  viaEd: boolean;
  chiefComplaint: string;
  attending: string;
  nurse: string;
  state: EncounterState;
  /** Denormalised headline risks so the worklist does not need every AssessResponse. */
  risks: {
    mortality: number | null;
    icu: number | null;
    readmission: number | null;
    losLow: number | null;
    losHigh: number | null;
  };
  topDifferential: { ccsr: string; name: string; family: string; probability: number }[];
  calibrated: boolean;
  calibrationValidity: "full" | "reduced";
  signalCompleteness: number;
  hasNotes: boolean;
  hasPriorHistory: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  cosignBy?: string;
  lastAssessedAt?: string;
  assessmentCount: number;
  releasedToPatient: boolean;
  /** A charge nurse (or anyone) raising this patient to the attending on call
   *  (§12.4). Recorded server-side by POST /encounters/{id}/escalate. */
  escalations?: { at: string; by: string; to: string; reason: string; urgency: "routine" | "urgent" | "immediate" }[];
}

// --- Models (§18) -----------------------------------------------------------

export type ModelId = "M-01" | "M-02" | "M-03" | "M-04" | "M-05";

export interface ModelCard {
  id: ModelId;
  name: string;
  outcome: string;
  version: string;
  status: "live" | "stub" | "degraded" | "canary" | "not_ready";
  towers: string[];
  fusion: "tower_a_only" | "fused" | "pending";
  trainedOn: string;
  cohortN: number;
  headline: { label: string; value: string }[];
  ece: number;
  calibrationMethod: string;
  /** Stratified — the blueprint requires metrics split by the key subgroup. */
  strata: { label: string; n: number; metric: string; value: number }[];
  leakageAlarm: boolean;
  negativeControl: string;
  lastEvaluated: string;
}

export interface RolloutStage {
  modelId: ModelId;
  version: string;
  stage: "canary" | "partial" | "full" | "rolled_back";
  trafficPct: number;
  tenantsPinned: number;
  startedAt: string;
  note: string;
}

export interface DriftPoint {
  week: string;
  psi: number;
  ece: number;
  recall20: number;
  volume: number;
}

// --- Platform health (§11.5.8) ---------------------------------------------

export interface Incident {
  id: string;
  title: string;
  tenantName: string | null;
  severity: AuditSeverity;
  state: "open" | "mitigating" | "resolved";
  openedAt: string;
  component: string;
  detail: string;
}

// --- Billing (§17) ----------------------------------------------------------

export interface Invoice {
  id: string;
  period: string;
  amountUsd: number;
  status: "paid" | "due" | "overdue";
  issuedAt: string;
  lines: { label: string; qty: string; amountUsd: number }[];
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceLabel: string;
  unit: string;
  forWho: string;
  features: string[];
  limits: { label: string; value: string }[];
  highlighted?: boolean;
}

// --- Patient portal (§13) ---------------------------------------------------

export interface ReleasedResult {
  id: string;
  encounterId: string;
  releasedAt: string;
  releasedBy: string;
  headline: string;
  plainLanguage: string;
  whatThisMeans: string[];
  questionsToAsk: string[];
  /** Patients never see a raw probability — §13.6's release-gate state machine. */
  rawScoreWithheld: true;
}

export interface ConsentGrant {
  id: string;
  grantee: string;
  granteeType: "hospital" | "clinician" | "caregiver" | "app";
  purpose: string;
  scope: string[];
  grantedAt: string;
  expiresAt: string | null;
  status: "active" | "revoked" | "expired";
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  facility: string;
  since: string;
  primary: boolean;
  /**
   * Where the server found them: named on an encounter, the unit team on an
   * encounter, or someone outside this hospital kept from the stored list.
   */
  source?: "encounter" | "unit" | "external";
  encounterId?: string;
  unitName?: string;
}

export interface RecordDocument {
  id: string;
  title: string;
  kind: "visit_summary" | "lab" | "imaging" | "medication" | "discharge";
  facility: string;
  date: string;
  source: "esap_fast" | "tefca" | "local";
}
