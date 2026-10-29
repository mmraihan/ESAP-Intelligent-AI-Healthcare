/**
 * Route tree for the whole product.
 *
 * Four surfaces live in one bundle here so a single link demonstrates
 * everything. PRODUCT_BLUEPRINT §11.1 requires three separate deployables in
 * production — the route groups below map 1:1 onto those bundles, so splitting
 * them is a build-config change rather than a rewrite:
 *   /doctor, /nurse, /models, /help  → clinician app (guest-reachable)
 *   /admin                           → hospital admin console (tenant-walled)
 *   /ops                             → super-admin console (not on public DNS)
 *   /patient                         → patient portal / individual tier
 */
import { lazy, Suspense, useState, type ComponentType } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "@/lib/session";
import { can, ROLES, type RoleCode } from "@/lib/rbac";
import { AppShell, BrandMark } from "@/components/shell/AppShell";
import { RefreshIcon, ServerIcon } from "@/components/ui/icons";
import {
  ADMIN_NAV, DESIGN_NAV, DOCTOR_NAV, NURSE_NAV, OPS_NAV, PATIENT_NAV, type NavGroup,
} from "@/components/shell/nav";

// Public site & auth
import { LandingPage } from "@/apps/site/LandingPage";
import { PricingPage } from "@/apps/site/PricingPage";
import { SecurityPage } from "@/apps/site/SecurityPage";
import { ModelEvidencePage } from "@/apps/site/ModelEvidencePage";
import { WaitlistPage } from "@/apps/site/WaitlistPage";
import { PrivacyPage, TermsPage } from "@/apps/site/LegalPages";
import { FaqPage } from "@/apps/site/FaqPage";
import { BillingSuccessPage } from "@/apps/site/BillingSuccessPage";
import { LoginPage } from "@/apps/auth/LoginPage";
import { SignupPage } from "@/apps/auth/SignupPage";
import { InviteAcceptPage } from "@/apps/auth/InviteAcceptPage";
import { CaregiverAcceptPage } from "@/apps/auth/CaregiverAcceptPage";

/**
 * The demo role picker's route. Set VITE_DEMO_ACCESS_PATH in a gitignored
 * .env.local (e.g. "/some-unguessable-slug"); leave it unset and the page is
 * not mounted at all. Lazy, so its code is fetched only on that path.
 */
const DEMO_ACCESS_PATH = (() => {
  const raw = ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_DEMO_ACCESS_PATH ?? "").trim();
  if (!raw) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
})();
const DemoAccessPage = lazy(() => import("@/apps/auth/DemoAccessPage").then((m) => ({ default: m.DemoAccessPage })));
import { useDataVersion } from "@/hooks/useData";
import { ScreenErrorBoundary } from "@/components/shell/ScreenErrorBoundary";
import { SOURCE } from "@/mock/db";
import { boot } from "@/api/bootstrap";

/**
 * The server cannot be reached. The app has no data of its own to fall back
 * on, so it says so rather than showing screens that look live and save nothing.
 */
function OfflineScreen() {
  const [trying, setTrying] = useState(false);
  const { adoptSession } = useSession();
  const reason = SOURCE.current.kind === "offline" ? SOURCE.current.reason : "";
  async function retry() {
    setTrying(true);
    const result = await boot();
    if (result.session) adoptSession(result.session);
    setTrying(false);
  }
  // Public palette (styles/public.css), so it matches the site it sits beside.
  return (
    <div className="pub pub-offline">
      <main className="pub-offline-card">
        <BrandMark />
        <span className="pub-offline-icon"><ServerIcon size={20} /></span>
        <h1>Cannot reach the ESAP server</h1>
        <p>
          {reason && <>{reason} </>}Everything behind sign-in comes from the server, so nothing can be shown
          or saved until it is back. Check that the backend is running, then try again.
        </p>
        <div className="pub-offline-actions">
          <button type="button" className="pub-btn pub-btn-primary" disabled={trying} onClick={() => void retry()}>
            <RefreshIcon size={16} /> {trying ? "Connecting…" : "Try again"}
          </button>
          <Link to="/product" className="pub-btn pub-btn-outline">Go to the product page</Link>
        </div>
      </main>
    </div>
  );
}

// Everything behind sign-in is fetched on first visit to its route, so a
// clinician never downloads the ops console and vice versa. The public site
// and auth screens stay in the entry bundle so the first paint needs no
// second round-trip.
function lazyNamed<K extends string, M extends Record<K, ComponentType<any>>>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

/** Holds the shell's content area while a screen's chunk downloads. */
function RouteFallback() {
  return <div className="route-loading" role="status" aria-busy="true" aria-label="Loading" />;
}

/** Suspends only the page, so the shell's navigation stays put during a load. */
function Page({ children }: { children: JSX.Element }) {
  // Keyed on the route, so leaving a screen that crashed clears the error.
  const { pathname } = useLocation();
  return (
    <ScreenErrorBoundary key={pathname}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ScreenErrorBoundary>
  );
}

// Clinician
const WorklistPage = lazyNamed(() => import("@/apps/clinician/WorklistPage"), "WorklistPage");
const DischargePlanningPage = lazyNamed(() => import("@/apps/clinician/DischargePlanningPage"), "DischargePlanningPage");
const IntakePage = lazyNamed(() => import("@/apps/clinician/IntakePage"), "IntakePage");
const ResultsPage = lazyNamed(() => import("@/apps/clinician/ResultsPage"), "ResultsPage");
const TimelinePage = lazyNamed(() => import("@/apps/clinician/TimelinePage"), "TimelinePage");
const HistoryPage = lazyNamed(() => import("@/apps/clinician/HistoryPage"), "HistoryPage");
const RosterPage = lazyNamed(() => import("@/apps/clinician/RosterPage"), "RosterPage");
const MyPatientsPage = lazyNamed(() => import("@/apps/clinician/MyPatientsPage"), "MyPatientsPage");
const TriagePage = lazyNamed(() => import("@/apps/clinician/TriagePage"), "TriagePage");
const HandoffPage = lazyNamed(() => import("@/apps/clinician/HandoffPage"), "HandoffPage");
const VitalsPage = lazyNamed(() => import("@/apps/clinician/VitalsPage"), "VitalsPage");
const ModelsPage = lazyNamed(() => import("@/apps/clinician/ModelsPage"), "ModelsPage");
const HelpPage = lazyNamed(() => import("@/apps/clinician/HelpPage"), "HelpPage");

// Admin console
const AdminHome = lazyNamed(() => import("@/apps/admin/AdminHome"), "AdminHome");
const AdminRoster = lazyNamed(() => import("@/apps/admin/AdminRoster"), "AdminRoster");
const AdminInvites = lazyNamed(() => import("@/apps/admin/AdminInvites"), "AdminInvites");
const AdminFacilities = lazyNamed(() => import("@/apps/admin/AdminFacilities"), "AdminFacilities");
const AdminRoles = lazyNamed(() => import("@/apps/admin/AdminRoles"), "AdminRoles");
const AdminIntegrations = lazyNamed(() => import("@/apps/admin/AdminIntegrations"), "AdminIntegrations");
const AdminModels = lazyNamed(() => import("@/apps/admin/AdminModels"), "AdminModels");
const AdminUsage = lazyNamed(() => import("@/apps/admin/AdminUsage"), "AdminUsage");
const AdminFairness = lazyNamed(() => import("@/apps/admin/AdminFairness"), "AdminFairness");
const AdminInterop = lazyNamed(() => import("@/apps/admin/AdminInterop"), "AdminInterop");
const AdminAudit = lazyNamed(() => import("@/apps/admin/AdminAudit"), "AdminAudit");
const AdminBilling = lazyNamed(() => import("@/apps/admin/AdminBilling"), "AdminBilling");
const AdminOrg = lazyNamed(() => import("@/apps/admin/AdminOrg"), "AdminOrg");

// Ops console
const OpsFleet = lazyNamed(() => import("@/apps/ops/OpsFleet"), "OpsFleet");
const OpsProvision = lazyNamed(() => import("@/apps/ops/OpsProvision"), "OpsProvision");
const OpsTenantDetail = lazyNamed(() => import("@/apps/ops/OpsTenantDetail"), "OpsTenantDetail");
const OpsRollout = lazyNamed(() => import("@/apps/ops/OpsRollout"), "OpsRollout");
const OpsConfig = lazyNamed(() => import("@/apps/ops/OpsConfig"), "OpsConfig");
const OpsBreakGlass = lazyNamed(() => import("@/apps/ops/OpsBreakGlass"), "OpsBreakGlass");
const OpsAudit = lazyNamed(() => import("@/apps/ops/OpsAudit"), "OpsAudit");
const OpsIncidents = lazyNamed(() => import("@/apps/ops/OpsIncidents"), "OpsIncidents");
const OpsPlans = lazyNamed(() => import("@/apps/ops/OpsPlans"), "OpsPlans");
const OpsWaitlist = lazyNamed(() => import("@/apps/ops/OpsWaitlist"), "OpsWaitlist");
const OpsUsers = lazyNamed(() => import("@/apps/ops/OpsUsers"), "OpsUsers");
const OpsSupport = lazyNamed(() => import("@/apps/ops/OpsSupport"), "OpsSupport");
const OpsAnnouncements = lazyNamed(() => import("@/apps/ops/OpsAnnouncements"), "OpsAnnouncements");

// Help & support (every signed-in surface)
const SupportPage = lazyNamed(() => import("@/apps/support/SupportPage"), "SupportPage");

// Patient portal
const PatientWelcome = lazyNamed(() => import("@/apps/patient/PatientWelcome"), "PatientWelcome");
const PatientHome = lazyNamed(() => import("@/apps/patient/PatientHome"), "PatientHome");
const PatientIntake = lazyNamed(() => import("@/apps/patient/PatientIntake"), "PatientIntake");
const PatientPreVisit = lazyNamed(() => import("@/apps/patient/PatientPreVisit"), "PatientPreVisit");
const PatientResults = lazyNamed(() => import("@/apps/patient/PatientResults"), "PatientResults");
const PatientRecords = lazyNamed(() => import("@/apps/patient/PatientRecords"), "PatientRecords");
const PatientSharing = lazyNamed(() => import("@/apps/patient/PatientSharing"), "PatientSharing");
const PatientCareTeam = lazyNamed(() => import("@/apps/patient/PatientCareTeam"), "PatientCareTeam");
const PatientFamily = lazyNamed(() => import("@/apps/patient/PatientFamily"), "PatientFamily");
const PatientSettings = lazyNamed(() => import("@/apps/patient/PatientSettings"), "PatientSettings");

// Design system
const DesignSystemPage = lazyNamed(() => import("@/apps/design/DesignSystemPage"), "DesignSystemPage");
const PermissionsMatrixPage = lazyNamed(() => import("@/apps/design/PermissionsMatrixPage"), "PermissionsMatrixPage");
const CoveragePage = lazyNamed(() => import("@/apps/design/CoveragePage"), "CoveragePage");

/** Sends "/" to the right home for the signed-in role — §12.2. */
function RoleHome() {
  const { authenticated, role } = useSession();
  if (!authenticated) return <LandingPage />;
  return <Navigate to={ROLES[role].home} replace />;
}

/**
 * Client-side route guard (§11.6). A signed-out visitor is sent to sign in; a
 * signed-in user on the wrong surface is sent to their own home rather than
 * shown another role's console chrome. The backend still enforces every
 * request independently — this only stops the wrong shell from ever painting.
 *
 * A nav item's `roles`/`anyPerm` only ever hid the sidebar *link* — a role
 * that failed both checks could still reach the same page directly (typed
 * URL, or a dashboard shortcut button that doesn't consult the nav at all)
 * and get a fully-painted, if data-empty, screen. Re-check the same two
 * conditions here against whichever nav item matches the current path, so
 * the page itself is off-limits, not just its link.
 */
function guardRedirect(
  authenticated: boolean,
  role: RoleCode,
  surface: "clinician" | "admin" | "ops" | "patient",
  pathname: string,
  nav?: NavGroup[],
): string | null {
  if (!authenticated) return `/login?next=${encodeURIComponent(pathname)}`;
  if (ROLES[role].surface !== surface) return ROLES[role].home;
  const item = nav?.flatMap((g) => g.items).find((i) => i.to.split("?")[0] === pathname);
  if (item?.roles && !item.roles.includes(role)) return ROLES[role].home;
  if (item?.anyPerm && !item.anyPerm.some((p) => can(role, p))) return ROLES[role].home;
  return null;
}

function Clinician({ children }: { children: JSX.Element }) {
  const { authenticated, role } = useSession();
  const { pathname } = useLocation();
  const nurseSurface = role === "charge_nurse" || role === "staff_nurse";
  const nav = nurseSurface ? NURSE_NAV : DOCTOR_NAV;
  const to = guardRedirect(authenticated, role, "clinician", pathname, nav);
  if (to) return <Navigate to={to} replace />;
  return <AppShell surface="clinician" nav={nav}><Page>{children}</Page></AppShell>;
}

function Admin({ children }: { children: JSX.Element }) {
  const { authenticated, role } = useSession();
  const { pathname } = useLocation();
  const to = guardRedirect(authenticated, role, "admin", pathname, ADMIN_NAV);
  if (to) return <Navigate to={to} replace />;
  return <AppShell surface="admin" nav={ADMIN_NAV}><Page>{children}</Page></AppShell>;
}

function Ops({ children }: { children: JSX.Element }) {
  const { authenticated, role } = useSession();
  const { pathname } = useLocation();
  const to = guardRedirect(authenticated, role, "ops", pathname, OPS_NAV);
  if (to) return <Navigate to={to} replace />;
  return <AppShell surface="ops" nav={OPS_NAV} wide><Page>{children}</Page></AppShell>;
}

function Patient({ children }: { children: JSX.Element }) {
  const { authenticated, role } = useSession();
  const { pathname } = useLocation();
  const to = guardRedirect(authenticated, role, "patient", pathname, PATIENT_NAV);
  if (to) return <Navigate to={to} replace />;
  return <AppShell surface="patient" nav={PATIENT_NAV}><Page>{children}</Page></AppShell>;
}

function Design({ children }: { children: JSX.Element }) {
  const { role } = useSession();
  return <AppShell surface={ROLES[role].surface} nav={DESIGN_NAV}><Page>{children}</Page></AppShell>;
}

/**
 * /support renders inside whichever shell the signed-in person already has,
 * with that surface's own nav — it is one page shared by every role. Platform
 * staff are sent to the queue, which is their side of the same tickets.
 */
function Support({ children }: { children: JSX.Element }) {
  const { authenticated, role } = useSession();
  const { pathname } = useLocation();
  if (!authenticated) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  const surface = ROLES[role].surface;
  if (surface === "ops") return <Navigate to="/ops/support" replace />;
  const nav = surface === "admin" ? ADMIN_NAV
    : surface === "patient" ? PATIENT_NAV
    : role === "charge_nurse" || role === "staff_nurse" ? NURSE_NAV : DOCTOR_NAV;
  return <AppShell surface={surface} nav={nav}><Page>{children}</Page></AppShell>;
}

function NotFound() {
  const { pathname } = useLocation();
  const { role, authenticated } = useSession();
  return (
    <div className="main" style={{ margin: "0 auto", maxWidth: 560, paddingTop: 80 }}>
      <h1 className="page-title">This screen does not exist</h1>
      <p className="page-lede">
        Nothing is routed at <code className="inline-code">{pathname}</code>.
      </p>
      <a className="btn btn-primary" href={authenticated ? ROLES[role].home : "/"}>
        Back to {authenticated ? "your workspace" : "the home page"}
      </a>
    </div>
  );
}

export function App() {
  // The data store fills its arrays in place, so a reload after a write
  // changes nothing React is watching. Keying the route tree on the store's
  // version remounts the current screen when fresh data lands, which is what
  // makes a saved change show up without a manual refresh.
  const version = useDataVersion();

  // Offline, the static marketing pages still render (they carry no live data
  // and fall back gracefully on an empty store); everything else — sign-in and
  // every signed-in surface — needs the server, so it gets the offline screen.
  if (SOURCE.current.kind === "offline") {
    return (
      <Routes key={version}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/product" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/evidence" element={<ModelEvidencePage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<OfflineScreen />} />
      </Routes>
    );
  }

  return (
    <Routes key={version}>
      {/* Public */}
      <Route path="/" element={<RoleHome />} />
      <Route path="/product" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/evidence" element={<ModelEvidencePage />} />
      <Route path="/waitlist" element={<WaitlistPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      {/* Unlisted demo role picker — exists only when VITE_DEMO_ACCESS_PATH is set. */}
      {DEMO_ACCESS_PATH && (
        <Route path={DEMO_ACCESS_PATH} element={<Suspense fallback={null}><DemoAccessPage /></Suspense>} />
      )}
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/caregiver/accept/:token" element={<CaregiverAcceptPage />} />
      <Route path="/welcome" element={<Page><PatientWelcome /></Page>} />

      {/* Clinician workspace */}
      <Route path="/doctor/worklist" element={<Clinician><WorklistPage /></Clinician>} />
      <Route path="/doctor/discharge" element={<Clinician><DischargePlanningPage /></Clinician>} />
      <Route path="/doctor/encounters/new" element={<Clinician><IntakePage isNew /></Clinician>} />
      <Route path="/doctor/encounters/:id/intake" element={<Clinician><IntakePage /></Clinician>} />
      <Route path="/doctor/encounters/:id/results" element={<Clinician><ResultsPage /></Clinician>} />
      <Route path="/doctor/encounters/:id/timeline" element={<Clinician><TimelinePage /></Clinician>} />
      <Route path="/doctor/encounters/:id/history" element={<Clinician><HistoryPage /></Clinician>} />

      <Route path="/nurse/roster" element={<Clinician><RosterPage /></Clinician>} />
      <Route path="/nurse/my-patients" element={<Clinician><MyPatientsPage /></Clinician>} />
      <Route path="/nurse/triage" element={<Clinician><TriagePage /></Clinician>} />
      <Route path="/nurse/handoff" element={<Clinician><HandoffPage /></Clinician>} />
      <Route path="/nurse/encounters/new" element={<Clinician><IntakePage isNew nurseMode /></Clinician>} />
      <Route path="/nurse/encounters/:id/intake" element={<Clinician><IntakePage nurseMode /></Clinician>} />
      <Route path="/nurse/encounters/:id/vitals" element={<Clinician><VitalsPage /></Clinician>} />
      <Route path="/nurse/encounters/:id/results" element={<Clinician><ResultsPage readOnly /></Clinician>} />

      <Route path="/models" element={<Clinician><ModelsPage /></Clinician>} />
      <Route path="/help" element={<Clinician><HelpPage /></Clinician>} />

      {/* Hospital admin console */}
      <Route path="/admin/home" element={<Admin><AdminHome /></Admin>} />
      <Route path="/admin/roster" element={<Admin><AdminRoster /></Admin>} />
      <Route path="/admin/invites" element={<Admin><AdminInvites /></Admin>} />
      <Route path="/admin/facilities" element={<Admin><AdminFacilities /></Admin>} />
      <Route path="/admin/roles" element={<Admin><AdminRoles /></Admin>} />
      <Route path="/admin/integrations" element={<Admin><AdminIntegrations /></Admin>} />
      <Route path="/admin/models" element={<Admin><AdminModels /></Admin>} />
      <Route path="/admin/usage" element={<Admin><AdminUsage /></Admin>} />
      <Route path="/admin/fairness" element={<Admin><AdminFairness /></Admin>} />
      <Route path="/admin/interop" element={<Admin><AdminInterop /></Admin>} />
      <Route path="/admin/audit" element={<Admin><AdminAudit /></Admin>} />
      <Route path="/admin/billing" element={<Admin><AdminBilling /></Admin>} />
      <Route path="/admin/org" element={<Admin><AdminOrg /></Admin>} />

      {/* Platform ops console */}
      <Route path="/ops/fleet" element={<Ops><OpsFleet /></Ops>} />
      <Route path="/ops/provision" element={<Ops><OpsProvision /></Ops>} />
      <Route path="/ops/tenants/:id" element={<Ops><OpsTenantDetail /></Ops>} />
      <Route path="/ops/rollout" element={<Ops><OpsRollout /></Ops>} />
      <Route path="/ops/config" element={<Ops><OpsConfig /></Ops>} />
      <Route path="/ops/break-glass" element={<Ops><OpsBreakGlass /></Ops>} />
      <Route path="/ops/audit" element={<Ops><OpsAudit /></Ops>} />
      <Route path="/ops/incidents" element={<Ops><OpsIncidents /></Ops>} />
      <Route path="/ops/plans" element={<Ops><OpsPlans /></Ops>} />
      <Route path="/ops/waitlist" element={<Ops><OpsWaitlist /></Ops>} />
      <Route path="/ops/users" element={<Ops><OpsUsers /></Ops>} />
      <Route path="/ops/support" element={<Ops><OpsSupport /></Ops>} />
      <Route path="/ops/announcements" element={<Ops><OpsAnnouncements /></Ops>} />

      {/* Help & support — every signed-in surface */}
      <Route path="/support" element={<Support><SupportPage /></Support>} />

      {/* Patient portal & individual tier */}
      <Route path="/patient/home" element={<Patient><PatientHome /></Patient>} />
      <Route path="/patient/intake" element={<Patient><PatientIntake /></Patient>} />
      <Route path="/patient/previsit" element={<Patient><PatientPreVisit /></Patient>} />
      <Route path="/patient/results" element={<Patient><PatientResults /></Patient>} />
      <Route path="/patient/records" element={<Patient><PatientRecords /></Patient>} />
      <Route path="/patient/sharing" element={<Patient><PatientSharing /></Patient>} />
      <Route path="/patient/care-team" element={<Patient><PatientCareTeam /></Patient>} />
      <Route path="/patient/family" element={<Patient><PatientFamily /></Patient>} />
      <Route path="/patient/settings" element={<Patient><PatientSettings /></Patient>} />

      {/* Design system & spec coverage */}
      <Route path="/design" element={<Design><DesignSystemPage /></Design>} />
      <Route path="/design/permissions" element={<Design><PermissionsMatrixPage /></Design>} />
      <Route path="/design/coverage" element={<Design><CoveragePage /></Design>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
