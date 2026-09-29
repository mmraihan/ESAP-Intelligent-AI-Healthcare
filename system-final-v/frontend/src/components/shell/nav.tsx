/** Nav trees — PRODUCT_BLUEPRINT §11.2 (consoles) and §12.2 (workspaces). */
import type { ReactNode } from "react";
import {
  ActivityIcon, BedIcon, BellIcon, BookIcon, BuildingIcon, ChartIcon, ClipboardIcon, CreditCardIcon,
  FileIcon, FlaskIcon, GlobeIcon, GridIcon, HandoffIcon, HeartPulseIcon, KeyIcon, LinkIcon, ListIcon,
  PaletteIcon, ScaleIcon, ServerIcon, SettingsIcon, ShieldIcon, StethoscopeIcon, UnlockIcon, UserIcon,
  UsersIcon,
} from "@/components/ui/icons";
import type { Permission, RoleCode } from "@/lib/rbac";

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  /** Blueprint section this screen implements — shown in the demo inspector. */
  ref?: string;
  /** Restrict the item to these roles. Omit to show for everyone on the surface. */
  roles?: RoleCode[];
  /**
   * Show the item only to a role that holds AT LEAST ONE of these permissions —
   * the same permission its page's backend endpoint enforces. This keeps the
   * nav honest: a role that would 403 on the page never sees the link.
   */
  anyPerm?: Permission[];
  badge?: string;
};

export type NavGroup = { title?: string; items: NavItem[] };

const S = 17;

export const DOCTOR_NAV: NavGroup[] = [
  {
    items: [
      { to: "/doctor/worklist", label: "Worklist", icon: <ListIcon size={S} />, ref: "12.3.1" },
      { to: "/doctor/discharge", label: "Discharge planning", icon: <HandoffIcon size={S} />, ref: "12.3.1a" },
      // Admitting needs patient:write — only prescribers hold it. Case managers and
      // pharmacists share this nav but would 403 here, so the item is gated.
      { to: "/doctor/encounters/new", label: "New encounter", icon: <ClipboardIcon size={S} />, ref: "12.3.2", roles: ["physician", "resident", "np_pa"] },
    ],
  },
  {
    title: "Reference",
    items: [
      { to: "/models", label: "Models & basis", icon: <FlaskIcon size={S} />, ref: "18" },
      { to: "/help", label: "How to read a result", icon: <BookIcon size={S} />, ref: "12.8" },
    ],
  },
];

export const NURSE_NAV: NavGroup[] = [
  {
    items: [
      { to: "/nurse/roster", label: "Unit risk roster", icon: <GridIcon size={S} />, ref: "12.4.1", roles: ["charge_nurse"] },
      { to: "/nurse/my-patients", label: "My patients", icon: <BedIcon size={S} />, ref: "12.4.2" },
      // Triage creates an encounter (patient:write), same as Admit a patient —
      // a charge nurse landing here could fill the whole form and 403 on submit.
      { to: "/nurse/triage", label: "Triage", icon: <ActivityIcon size={S} />, ref: "12.4.5", roles: ["staff_nurse"] },
      { to: "/nurse/handoff", label: "Handoff summary", icon: <HandoffIcon size={S} />, ref: "12.4.6", roles: ["charge_nurse"] },
      // Only the bedside (staff) nurse holds patient:write; charge nurses do unit
      // oversight (roster + handoff), so admitting from their nav would 403.
      { to: "/nurse/encounters/new", label: "Admit a patient", icon: <ClipboardIcon size={S} />, ref: "12.4.3", roles: ["staff_nurse"] },
    ],
  },
  {
    title: "Reference",
    items: [
      { to: "/models", label: "Models & basis", icon: <FlaskIcon size={S} />, ref: "18" },
      { to: "/help", label: "How to read a result", icon: <BookIcon size={S} />, ref: "12.8" },
    ],
  },
];

// Each item is gated on the exact permission its page's backend endpoint
// enforces, so a role that would 403 on the page never sees the link. "Home" is
// ungated — every admin-surface role has a dashboard.
export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { to: "/admin/home", label: "Home", icon: <GridIcon size={S} />, ref: "11.4.1" },
      { to: "/admin/roster", label: "Roster", icon: <UsersIcon size={S} />, ref: "11.4.2", anyPerm: ["user:manage"] },
      { to: "/admin/invites", label: "Invites", icon: <BellIcon size={S} />, ref: "11.4.3", anyPerm: ["user:manage"] },
      { to: "/admin/facilities", label: "Facilities & units", icon: <BuildingIcon size={S} />, ref: "11.4.4", anyPerm: ["tenant:manage"] },
      { to: "/admin/roles", label: "Roles & scopes", icon: <KeyIcon size={S} />, ref: "11.4.5", anyPerm: ["user:manage"] },
    ],
  },
  {
    title: "Configuration",
    items: [
      { to: "/admin/integrations", label: "Integrations", icon: <LinkIcon size={S} />, ref: "11.4.6", anyPerm: ["tenant:manage"] },
      { to: "/admin/models", label: "Model & display", icon: <FlaskIcon size={S} />, ref: "11.4.7", anyPerm: ["tenant:manage"] },
      { to: "/admin/org", label: "Org settings", icon: <SettingsIcon size={S} />, ref: "11.4.12", anyPerm: ["tenant:manage"] },
    ],
  },
  {
    title: "Governance",
    items: [
      { to: "/admin/usage", label: "Usage & outcomes", icon: <ChartIcon size={S} />, ref: "11.4.8", anyPerm: ["tenant:manage", "audit:view", "fairness:audit_view", "billing:view"] },
      { to: "/admin/fairness", label: "Fairness audit", icon: <ScaleIcon size={S} />, ref: "15.9", anyPerm: ["fairness:audit_view"] },
      { to: "/admin/interop", label: "Interop & transfer", icon: <GlobeIcon size={S} />, ref: "11.4.9", anyPerm: ["transfer:approve", "transfer:initiate"] },
      { to: "/admin/audit", label: "Audit log", icon: <ShieldIcon size={S} />, ref: "11.4.10", anyPerm: ["audit:view"] },
      { to: "/admin/billing", label: "Billing", icon: <CreditCardIcon size={S} />, ref: "11.4.11", anyPerm: ["billing:view"] },
    ],
  },
];

export const OPS_NAV: NavGroup[] = [
  {
    items: [
      { to: "/ops/fleet", label: "Fleet dashboard", icon: <GridIcon size={S} />, ref: "11.5.1" },
      { to: "/ops/provision", label: "Provisioning wizard", icon: <BuildingIcon size={S} />, ref: "11.5.2" },
      { to: "/ops/incidents", label: "Incidents", icon: <ActivityIcon size={S} />, ref: "11.5.8" },
    ],
  },
  {
    title: "Platform",
    items: [
      { to: "/ops/rollout", label: "Model rollout", icon: <FlaskIcon size={S} />, ref: "11.5.4" },
      { to: "/ops/config", label: "Global config", icon: <ServerIcon size={S} />, ref: "11.5.5" },
      { to: "/ops/plans", label: "Plan catalog", icon: <CreditCardIcon size={S} />, ref: "11.5.9" },
    ],
  },
  {
    title: "Governance",
    items: [
      { to: "/ops/break-glass", label: "Break-glass", icon: <UnlockIcon size={S} />, ref: "11.5.6" },
      { to: "/ops/audit", label: "Platform audit log", icon: <ShieldIcon size={S} />, ref: "11.5.7" },
    ],
  },
];

export const PATIENT_NAV: NavGroup[] = [
  {
    items: [
      { to: "/patient/home", label: "My health", icon: <HeartPulseIcon size={S} />, ref: "P2" },
      { to: "/patient/intake", label: "Tell us how you feel", icon: <StethoscopeIcon size={S} />, ref: "P3" },
      { to: "/patient/previsit", label: "Ready to share", icon: <FileIcon size={S} />, ref: "P4" },
      { to: "/patient/results", label: "My results", icon: <ClipboardIcon size={S} />, ref: "P5" },
      { to: "/patient/records", label: "My records", icon: <BookIcon size={S} />, ref: "P6" },
    ],
  },
  {
    title: "Access & people",
    items: [
      { to: "/patient/sharing", label: "Share & consent", icon: <ShieldIcon size={S} />, ref: "P7" },
      { to: "/patient/care-team", label: "Care team", icon: <UsersIcon size={S} />, ref: "P8" },
      { to: "/patient/family", label: "Family access", icon: <UserIcon size={S} />, ref: "P9" },
      { to: "/patient/settings", label: "Settings", icon: <SettingsIcon size={S} />, ref: "P10" },
    ],
  },
];

export const DESIGN_NAV: NavGroup[] = [
  {
    items: [
      { to: "/design", label: "Design system", icon: <PaletteIcon size={S} />, ref: "14" },
      { to: "/design/permissions", label: "Permissions matrix", icon: <KeyIcon size={S} />, ref: "4.6" },
      { to: "/design/coverage", label: "Blueprint coverage", icon: <ListIcon size={S} />, ref: "—" },
    ],
  },
];
