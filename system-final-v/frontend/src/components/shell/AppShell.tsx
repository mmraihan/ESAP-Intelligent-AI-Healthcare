/**
 * The shell every signed-in surface renders inside: a persistent left rail, one
 * top bar, and the standing clinical-safety line.
 *
 * The top bar pattern is shared across all four surfaces on purpose (§11.2) —
 * context switcher left, identity + role badge + theme right — so the product
 * reads as one family even though production ships it as three bundles.
 */
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ROLES, can } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { TENANTS } from "@/mock/db";
import { initials } from "@/lib/format";
import { AssistiveLine, RoleBadge } from "@/components/ui/domain";
import { Badge, Button, cx } from "@/components/ui/primitives";
import {
  BellIcon, ChevronDown, LogoutIcon, MenuIcon, UnlockIcon, XIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "./ThemeToggle";
import { ChatAssistant } from "./ChatAssistant";
import { LanguageToggle, t } from "@/i18n";
import type { NavGroup } from "./nav";

/** The ESAP mark: a medical cross with an ECG trace cut through its arm. */
function BrandGlyph() {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" focusable="false">
      <rect className="brand-cross" x="12" y="5" width="8" height="22" rx="2.2" />
      <rect className="brand-cross" x="5" y="12" width="22" height="8" rx="2.2" />
      <polyline
        className="brand-pulse"
        points="5.6,16 10.6,16 12.6,13.3 14.8,19.4 17.2,10.6 19.4,18.3 21,16 26.4,16"
      />
    </svg>
  );
}

export function BrandMark({ size = 30, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-glyph" style={{ width: size, height: size }} aria-hidden="true">
        <BrandGlyph />
      </span>
      {withWordmark && (
        <span className="brand-words">
          <strong>ESAP</strong>
          <span>{t("Clinical AI")}</span>
        </span>
      )}
    </span>
  );
}

/** Account menu: identity and sign-out. */
function RoleSwitcher() {
  const { role, name, email, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="role-switcher" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="identity-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="avatar" aria-hidden="true">{initials(name)}</span>
        <span className="identity-text">
          <strong>{name}</strong>
          <span>{t(ROLES[role].label)}</span>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-note">{email}</p>
          <div className="menu-foot">
            <Button size="sm" icon={<LogoutIcon size={14} />} onClick={() => { signOut(); nav("/"); }}>
              {t("Sign out")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TenantSwitcher() {
  const { tenantId, switchTenant, role } = useSession();
  const [open, setOpen] = useState(false);
  const tenant = TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0];
  const crossTenant = role === "super_admin";

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  if (!crossTenant) {
    return (
      <span className="tenant-static" title={t("Your session is walled to this tenant.")}>
        {t(tenant.name)}
      </span>
    );
  }

  return (
    <div className="tenant-switcher" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="tenant-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {tenant.name}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu-note">
            Selecting a tenant here changes the ops context only. It grants no access to that
            tenant&rsquo;s patient data — that needs a break-glass elevation.
          </p>
          {TENANTS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              className={cx("menu-item", t.id === tenantId && "is-active")}
              onClick={() => { switchTenant(t.id); setOpen(false); }}
            >
              <span>
                <strong>{t.name}</strong>
                <span className="menu-item-sub">{t.slug} · {t.status}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ElevationBanner() {
  const { elevation, dropElevation } = useSession();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!elevation) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [elevation]);
  if (!elevation) return null;
  const left = Math.max(0, Math.round((elevation.expiresAt - Date.now()) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="elevation-banner" role="status">
      <UnlockIcon size={15} />
      <span>
        <strong>Break-glass access is active.</strong> Ticket {elevation.ticket} · every action you
        take is written to the platform audit log with your justification.
      </span>
      <span className="elevation-clock tnum">{mm}:{ss}</span>
      <button type="button" className="icon-btn" onClick={dropElevation} aria-label="End elevated access">
        <XIcon size={15} />
      </button>
    </div>
  );
}

export function AppShell({
  nav, surface, children, wide,
}: { nav: NavGroup[]; surface: "clinician" | "admin" | "ops" | "patient"; children: ReactNode; wide?: boolean }) {
  const { role } = useSession();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const surfaceLabel =
    surface === "clinician" ? "Clinical workspace"
    : surface === "admin" ? "Hospital admin console"
    : surface === "ops" ? "Platform ops console"
    : t("Patient portal");

  return (
    <div className={cx("shell", `shell-${surface}`)} data-surface={surface}>
      <header className="topbar glass">
        <div className="topbar-left">
          <button type="button" className="icon-btn nav-toggle" onClick={() => setMobileOpen((v) => !v)} aria-label={t("Toggle navigation")}>
            {mobileOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
          <NavLink to={ROLES[role].home} className="brand-link"><BrandMark /></NavLink>
          <span className="topbar-divider" aria-hidden="true" />
          <span className="surface-tag">{surfaceLabel}</span>
          <TenantSwitcher />
        </div>
        <div className="topbar-right">
          <RoleBadge role={role} />
          {surface === "patient" && <LanguageToggle compact />}
          <ThemeToggle compact />
          <RoleSwitcher />
        </div>
      </header>

      <ElevationBanner />

      <div className={cx("shell-body", mobileOpen && "nav-open")}>
        <nav className="rail" aria-label={t("{surface} navigation", { surface: surfaceLabel })}>
          {nav.map((group, gi) => {
            const items = group.items.filter((i) =>
              (!i.roles || i.roles.includes(role)) &&
              (!i.anyPerm || i.anyPerm.some((p) => can(role, p))));
            if (items.length === 0) return null;
            return (
              <div key={gi} className="rail-group">
                {group.title && <p className="rail-title">{t(group.title)}</p>}
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => cx("rail-item", isActive && "is-active")}
                  >
                    <span className="rail-icon">{item.icon}</span>
                    <span className="rail-label">{t(item.label)}</span>
                    {item.badge && <Badge tone="accent">{item.badge}</Badge>}
                    {item.ref && <span className="rail-ref" title={`PRODUCT_BLUEPRINT §${item.ref}`}>§{item.ref}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
          <div className="rail-foot">
            <NavLink to="/design" className={({ isActive }) => cx("rail-item", isActive && "is-active")}>
              <span className="rail-icon"><BellIcon size={17} /></span>
              <span className="rail-label">{t("Design system")}</span>
            </NavLink>
            <AssistiveLine compact />
          </div>
        </nav>

        <main className={cx("main", wide && "is-wide")} id="main">
          {children}
        </main>
      </div>

      <ChatAssistant />
    </div>
  );
}
