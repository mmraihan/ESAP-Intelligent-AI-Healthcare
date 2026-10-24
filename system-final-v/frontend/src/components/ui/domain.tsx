/**
 * Domain-aware shared components — §11.3.
 * One enum→appearance mapping, used identically by every console, so a status
 * word never means two different things in two screens.
 */
import type { ReactNode } from "react";
import { GRADE_LABEL, GRADE_SYMBOL, ROLES, grade, type Grade, type Permission, type RoleCode } from "@/lib/rbac";
import type { AuditSeverity, DeploymentMode, IsolationTier, StatusKind, TransferState } from "@/mock/types";
import { AlertIcon, CheckIcon, ClockIcon, InfoIcon, LockIcon, XIcon } from "./icons";
import { cx } from "./primitives";
import { t } from "@/i18n";

// --- StatusPill -------------------------------------------------------------

const STATUS_MAP: Record<StatusKind, { tone: string; icon: ReactNode; label: string }> = {
  active: { tone: "good", icon: <CheckIcon size={12} />, label: "Active" },
  healthy: { tone: "good", icon: <CheckIcon size={12} />, label: "Healthy" },
  pending: { tone: "warning", icon: <ClockIcon size={12} />, label: "Pending" },
  draft: { tone: "neutral", icon: <InfoIcon size={12} />, label: "Draft" },
  expired: { tone: "neutral", icon: <ClockIcon size={12} />, label: "Expired" },
  revoked: { tone: "neutral", icon: <XIcon size={12} />, label: "Revoked" },
  suspended: { tone: "critical", icon: <LockIcon size={12} />, label: "Suspended" },
  degraded: { tone: "warning", icon: <AlertIcon size={12} />, label: "Degraded" },
  failed: { tone: "critical", icon: <AlertIcon size={12} />, label: "Failed" },
};

export function StatusPill({ status, label }: { status: StatusKind; label?: string }) {
  const s = STATUS_MAP[status];
  return (
    <span className={cx("pill", `pill-${s.tone}`)}>
      {s.icon}
      {label ?? s.label}
    </span>
  );
}

// --- RoleBadge / ScopeChip --------------------------------------------------

export function RoleBadge({ role, showScope }: { role: RoleCode; showScope?: boolean }) {
  const meta = ROLES[role];
  return (
    <span className={cx("role-badge", `surface-${meta.surface}`)} title={`${t(meta.label)} · HL7: ${meta.hl7}`}>
      {t(meta.label)}
      {showScope && <span className="role-badge-scope">{t(meta.scopeLabel)}</span>}
    </span>
  );
}

export function ScopeChip({ scope }: { scope: string }) {
  const kind = scope.startsWith("Unit") ? "unit" : scope.startsWith("Roster") ? "roster" : scope.startsWith("Facility") ? "facility" : "tenant";
  return <span className={cx("scope-chip", `scope-${kind}`)}>{scope}</span>;
}

/** One cell of the permissions matrix — symbol, color and the full label in the title. */
export function GradeCell({ role, permission }: { role: RoleCode; permission: Permission }) {
  const g = grade(role, permission);
  return (
    <span className={cx("grade", `grade-${g}`)} title={GRADE_LABEL[g]}>
      <span aria-hidden="true">{GRADE_SYMBOL[g]}</span>
      <span className="visually-hidden">{GRADE_LABEL[g]}</span>
    </span>
  );
}

export function GradeLegend() {
  const items: Grade[] = ["full", "scoped", "cosign", "breakglass", "none"];
  return (
    <ul className="grade-legend">
      {items.map((g) => (
        <li key={g}>
          <span className={cx("grade", `grade-${g}`)} aria-hidden="true">{GRADE_SYMBOL[g]}</span>
          {GRADE_LABEL[g]}
        </li>
      ))}
    </ul>
  );
}

// --- Calibration ------------------------------------------------------------

/**
 * Calibration is a first-class visual state. "Uncalibrated" is deliberately not
 * a warning color — it is expected in early deployment, not a fault (§14.3.3).
 */
export function CalibratedBadge({ calibrated, validity, estimated = true }: {
  calibrated: boolean;
  validity?: "full" | "reduced";
  /** False when no estimate exists yet — a calibration claim about nothing is suppressed, not shown. */
  estimated?: boolean;
}) {
  if (!estimated) {
    return <span className="cal-badge" title="No estimate has been produced yet, so there is no calibration to report.">no estimate yet</span>;
  }
  if (validity === "reduced") {
    return (
      <span className="cal-badge" title="Calibration is reduced because required inputs were imputed.">
        calibration reduced
      </span>
    );
  }
  return calibrated ? (
    <span className="cal-badge is-cal"><CheckIcon size={11} /> Calibrated</span>
  ) : (
    <span className="cal-badge">uncalibrated</span>
  );
}

/** Fusion state pill — "Tower A only" vs "A+B+C fused". Always text, never a bare color. */
export function FusionPill({ status }: { status: "tower_a_only" | "pending" | "fused" }) {
  const label = status === "fused" ? "Towers A+B+C fused" : status === "pending" ? "Fusion pending" : "Tower A only";
  return <span className={cx("fusion-pill", status === "fused" ? "is-fused" : "is-partial")}>{label}</span>;
}

// --- Severity ---------------------------------------------------------------

const SEVERITY: Record<AuditSeverity, { tone: string; icon: ReactNode; label: string }> = {
  info: { tone: "neutral", icon: <InfoIcon size={12} />, label: "Info" },
  notice: { tone: "accent", icon: <InfoIcon size={12} />, label: "Notice" },
  warning: { tone: "warning", icon: <AlertIcon size={12} />, label: "Warning" },
  critical: { tone: "critical", icon: <AlertIcon size={12} />, label: "Critical" },
};

/** Severity is never a bare color chip — it always carries the event-type label. */
export function SeverityTag({ severity }: { severity: AuditSeverity }) {
  const s = SEVERITY[severity];
  return <span className={cx("pill", `pill-${s.tone}`)}>{s.icon}{s.label}</span>;
}

export function OutcomeTag({ outcome }: { outcome: "success" | "denied" | "error" }) {
  return (
    <span className={cx("pill", outcome === "success" ? "pill-good" : outcome === "denied" ? "pill-warning" : "pill-critical")}>
      {outcome === "success" ? <CheckIcon size={12} /> : outcome === "denied" ? <LockIcon size={12} /> : <AlertIcon size={12} />}
      {outcome === "success" ? "Success" : outcome === "denied" ? "Denied" : "Error"}
    </span>
  );
}

// --- Tenancy ----------------------------------------------------------------

export const MODE_LABEL: Record<DeploymentMode, string> = {
  saas: "Multi-tenant SaaS",
  on_prem: "On-prem / private cloud",
  individual: "Individual self-serve",
};

export const ISOLATION_LABEL: Record<IsolationTier, string> = {
  shared_rls: "Shared schema + row-level security",
  schema_per_tenant: "Schema per tenant",
  db_per_tenant: "Database per tenant",
  single_tenant_vpc: "Single-tenant VPC",
};

export function ModeTag({ mode }: { mode: DeploymentMode }) {
  return <span className={cx("mode-tag", `mode-${mode}`)}>{MODE_LABEL[mode]}</span>;
}

// --- Interop ----------------------------------------------------------------

export const TRANSFER_STATE_LABEL: Record<TransferState, string> = {
  requested: "Requested",
  consent_pending: "Awaiting consent",
  mpi_review: "MPI review",
  approved: "Approved",
  delivered: "Delivered",
  rejected: "Rejected",
  expired: "Expired",
};

export function TransferStateTag({ state }: { state: TransferState }) {
  const tone =
    state === "delivered" || state === "approved" ? "good"
    : state === "rejected" ? "critical"
    : state === "mpi_review" || state === "consent_pending" ? "warning"
    : "neutral";
  return <span className={cx("pill", `pill-${tone}`)}>{TRANSFER_STATE_LABEL[state]}</span>;
}

// --- The standing assistive line -------------------------------------------

/**
 * "Decision support, not diagnosis" — the blueprint requires this on every
 * clinical surface, and the FDA non-device-CDS posture (§15.3) depends on it
 * being standing text rather than a dismissible banner.
 */
export function AssistiveLine({ compact }: { compact?: boolean }) {
  return (
    <p className={cx("assistive-line", compact && "is-compact")}>
      <InfoIcon size={13} />
      <span>
        <strong>{t("Decision support, not diagnosis.")}</strong>{" "}
        {!compact && t("Every estimate is a population-level probability from intake-only data. A clinician reviews it independently and makes the call.")}
      </span>
    </p>
  );
}
