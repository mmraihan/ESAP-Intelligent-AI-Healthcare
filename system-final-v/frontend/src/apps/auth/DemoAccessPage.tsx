/**
 * Demo role picker — deliberately NOT linked from anywhere.
 *
 * It used to sit under the public sign-in form. It now lives on its own route,
 * mounted only when VITE_DEMO_ACCESS_PATH is set (see .env.example). Leave the
 * variable unset and the route does not exist at all.
 *
 * This hides the picker; it does not secure it. The path is compiled into the
 * bundle, and the server still answers /public/demo-accounts while
 * ESAP_DEMO_PICKER is on — switch that off on any deployment that must not
 * offer demo sign-in.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES, type RoleCode } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { api } from "@/api/client";
import { DEMO_IDENTITY, mergeDemoAccounts } from "@/mock/db";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { DemoBadge } from "@/components/ui/domain";
import { Badge, Banner, Button } from "@/components/ui/primitives";
import { ActivityIcon, AlertIcon, ArrowRight, GlobeIcon, HeartPulseIcon, LockIcon, ShieldIcon } from "@/components/ui/icons";

// Clinical and patient roles sign in with one click (the demo password). The
// super admin is listed but private: it opens the normal sign-in with the
// email filled in, and needs its own password and MFA. Hospital admin roles
// are not offered here.
const DEMO_GROUPS: { title: string; note: string; icon: JSX.Element; roles: RoleCode[] }[] = [
  { title: "Clinical workspace", note: "Doctors and nurses. Guest-reachable in production.", icon: <ActivityIcon size={18} />, roles: ["physician", "resident", "charge_nurse", "staff_nurse", "case_manager"] },
  { title: "Platform ops console", note: "Own password and two-factor code required.", icon: <GlobeIcon size={18} />, roles: ["super_admin"] },
  { title: "Patient portal", note: "Plain language, released content only.", icon: <HeartPulseIcon size={18} />, roles: ["patient"] },
];

/** Never signed in with the shared demo password, whatever the server sends. */
const PRIVATE_ROLES = new Set<RoleCode>(["super_admin"]);

const isPrivate = (role: RoleCode) => PRIVATE_ROLES.has(role) || Boolean(DEMO_IDENTITY[role]?.private);

export function DemoAccessPage() {
  const nav = useNavigate();
  const { signIn, pending, error } = useSession();
  const [, setLoaded] = useState(false);

  // A signed-in session only holds its own identity, so a person who opens this
  // page while signed in still needs the full list to switch role.
  useEffect(() => {
    api.get<{ accounts: Record<string, { name: string; email: string; title: string; private?: boolean }> }>("/api/v1/public/demo-accounts")
      .then((r) => { mergeDemoAccounts(r.accounts ?? {}); setLoaded(true); })
      .catch(() => undefined);
  }, []);

  const available = Object.keys(DEMO_IDENTITY).length > 0;

  // Keep the page out of search indexes even if the URL leaks.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  function enter(role: RoleCode) {
    if (isPrivate(role)) {
      nav(`/login?email=${encodeURIComponent(DEMO_IDENTITY[role]?.email ?? "")}`);
      return;
    }
    void signIn(role).then(() => nav(ROLES[role].home)).catch(() => undefined);
  }

  return (
    <div className="pub auth-page">
      <div className="auth-shell is-wide">
        <div className="auth-topline">
          <BrandMark />
          <DemoBadge />
          <div className="row" style={{ gap: 8, marginInlineStart: "auto" }}>
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>

        <div className="auth-card demo-card">
          <div className="auth-head">
            <span className="auth-kicker"><AlertIcon size={13} /> {t("Internal · demonstration build")}</span>
            <h1 className="auth-title">{t("Sign in as any role")}</h1>
            <p className="auth-sub">
              {t("Every account here is synthetic. Pick a role to open its home screen with seeded data.")}
            </p>
          </div>

          {error ? <Banner tone="critical" icon={<ShieldIcon size={16} />} title={t("Could not sign in")}>{error}</Banner> : null}

          {!available ? (
            <Banner tone="warning" icon={<AlertIcon size={16} />} title={t("Demo accounts are switched off")}>
              {t("The server is not offering demo accounts (ESAP_DEMO_PICKER). Use a real account on the sign-in page.")}
            </Banner>
          ) : (
            <div className="demo-groups">
              {DEMO_GROUPS.map((g, gi) => {
                const roles = g.roles.filter((r) => DEMO_IDENTITY[r]);
                if (!roles.length) return null;
                return (
                  <section key={g.title} className="demo-group auth-rise" style={{ "--i": gi } as CSSProperties}>
                    <header className="demo-group-head">
                      <span className="demo-group-icon">{g.icon}</span>
                      <div>
                        <strong>{t(g.title)}</strong>
                        <span>{t(g.note)}</span>
                      </div>
                    </header>
                    <div className="demo-roles">
                      {roles.map((r) => (
                        <button key={r} type="button" className="demo-role" disabled={pending} onClick={() => enter(r)}>
                          <span className="demo-role-text">
                            <strong>{t(ROLES[r].label)}</strong>
                            <small>{DEMO_IDENTITY[r]?.name}</small>
                          </span>
                          {isPrivate(r) ? <LockIcon size={14} aria-label={t("Own password required")} /> : <ArrowRight size={14} />}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Badge tone="neutral">{t("All data synthetic")}</Badge>
            <Badge tone="neutral">{t("Live API")}</Badge>
            <Badge tone="neutral">{t("No real PHI anywhere")}</Badge>
          </div>
          <Button variant="ghost" onClick={() => nav("/login")}>{t("Back to the normal sign-in")}</Button>
        </div>
      </div>
    </div>
  );
}
