/**
 * Sign in (§10.8, §10.10, §10.12).
 *
 * SSO first, password second — a hospital that signs in with local passwords
 * ends up with shared passwords, which destroys the audit trail. The demo role
 * picker is on this screen because it is the honest place for it: a real build
 * would have three separate sign-in surfaces on three different hostnames.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES, type RoleCode } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { DEMO_IDENTITY } from "@/mock/db";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge, Banner, Button, Card, Field, TextInput } from "@/components/ui/primitives";
import { EyeIcon, EyeOffIcon, KeyIcon, ShieldIcon, UserIcon } from "@/components/ui/icons";
import { api } from "@/api/client";

const DEMO_GROUPS: { title: string; note: string; roles: RoleCode[] }[] = [
  { title: "Clinical workspace", note: "Doctors and nurses. Guest-reachable in production.", roles: ["physician", "resident", "charge_nurse", "staff_nurse", "case_manager"] },
  { title: "Hospital admin console", note: "Tenant-walled. A separate bundle in production.", roles: ["tenant_owner", "it_admin", "privacy_officer", "billing_admin", "auditor"] },
  { title: "Platform ops console", note: "Not on public DNS. VPN and hardware key only.", roles: ["super_admin"] },
  { title: "Patient portal", note: "Plain language, released content only.", roles: ["patient"] },
];

export function LoginPage() {
  const nav = useNavigate();
  const { signIn, signInWithPassword, verifyMfa, cancelMfa, mfaPending, pending, error } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [resetNote, setResetNote] = useState<string | null>(null);

  /**
   * There is no email service, so a reset goes to the hospital admin's request
   * queue. The reply is the same for any address — the server will not say
   * whether an account exists.
   */
  async function forgot() {
    if (!email.trim()) {
      setResetNote(t("Enter your email address above, then choose “Forgotten your password?” again."));
      return;
    }
    try {
      await api.post("/api/v1/auth/password/forgot", { email: email.trim() }, { anonymous: true });
      setResetNote(t("If that address has an account, your administrator has been asked to send you a reset link."));
    } catch {
      setResetNote(t("Could not reach the ESAP API."));
    }
  }

  function enter(role: RoleCode) {
    void signIn(role).then(() => nav(ROLES[role].home)).catch(() => undefined);
  }

  /** Real credentials against the API. The role comes back in the session. */
  async function submit() {
    try {
      await signInWithPassword(email.trim(), password);
      // A second factor may be required; if so, wait on the code step rather
      // than navigating with a role we do not yet have.
      if (useSession.getState().mfaPending) return;
      nav(ROLES[useSession.getState().role].home);
    } catch {
      // `error` on the store already holds the server's message.
    }
  }

  async function submitMfa() {
    try {
      await verifyMfa(mfaCode.trim());
      setMfaCode("");
      nav(ROLES[useSession.getState().role].home);
    } catch {
      // `error` on the store already holds the server's message.
    }
  }

  return (
    <div className="auth-page">
      <div className="stack" style={{ gap: 18, width: "100%", maxWidth: 820, alignItems: "center" }}>
        <div className="row" style={{ justifyContent: "space-between", width: "100%", maxWidth: 440, gap: 10 }}>
          <BrandMark />
          <div className="row" style={{ gap: 8 }}>
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-head">
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{t("Sign in")}</h1>
            <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
              {t("Use your hospital account. If you do not have one, your administrator invites you — ESAP does not create clinical accounts directly.")}
            </p>
          </div>

          {mfaPending ? (
            <div className="stack" style={{ gap: 12 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                {t("Enter the 6-digit code from your authenticator app to finish signing in.")}
              </p>
              {error ? (
                <Banner tone="critical" icon={<ShieldIcon size={16} />} title={t("Could not sign in")}>{error}</Banner>
              ) : null}
              <Field label={t("Verification code")}>
                <TextInput
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.currentTarget.value)}
                />
              </Field>
              <Button variant="primary" disabled={pending || mfaCode.trim().length < 6} onClick={() => void submitMfa()}>
                {pending ? t("Verifying…") : t("Verify and sign in")}
              </Button>
              <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={cancelMfa}>
                {t("Use a different account")}
              </button>
            </div>
          ) : (
          <>
              <Button variant="primary" icon={<KeyIcon size={16} />} onClick={() => enter("physician")}>
                {t("Explore the demo as an attending physician")}
              </Button>
              <p className="muted" style={{ margin: "-4px 0 0", fontSize: 12, lineHeight: 1.5 }}>
                {t("Hospital single sign-on is not connected here yet")}
              </p>
              <div className="auth-divider">{t("or sign in with a password")}</div>

              {error ? (
                <Banner tone="critical" icon={<ShieldIcon size={16} />} title={t("Could not sign in")}>
                  {error}
                </Banner>
              ) : null}

              <Field label={t("Email")}>
                <TextInput
                  type="email"
                  placeholder="you@hospital.example"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
              </Field>
              <Field label={t("Password")}>
                <div style={{ position: "relative", display: "flex" }}>
                  <TextInput
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    style={{ flex: 1, paddingInlineEnd: 38 }}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ position: "absolute", insetInlineEnd: 4, top: "50%", transform: "translateY(-50%)" }}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                  >
                    {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                  </button>
                </div>
              </Field>
              <Button
                variant="primary"
                disabled={pending || !email.trim() || !password}
                onClick={() => void submit()}
              >
                {pending ? t("Signing in…") : t("Sign in")}
              </Button>

              <div className="auth-alt">
                <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => void forgot()}>{t("Forgotten your password?")}</button>
                {resetNote && <p className="muted" role="status" style={{ margin: 0, fontSize: 12.5 }}>{resetNote}</p>}
                <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/signup")}>
                  {t("I am a solo clinician — create an individual account")}
                </button>
                <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/welcome")}>
                  {t("I am a patient")}
                </button>
              </div>
          </>
          )}
        </div>

        {/* Only when the server offers demo accounts (ESAP_DEMO_PICKER). */}
        {Object.keys(DEMO_IDENTITY).length > 0 && (
        <Card
          title={t("Demo — sign in as any role")}
          subtitle={t("This picker exists only in the demonstration build")}
          footnote={t("In production these are three separate deployables on three different hostnames: a guest-reachable clinical app, a tenant-walled admin console, and an ops console that is not on public DNS at all. A single bundle containing all three is a demo convenience, not the architecture.")}
        >
          <div className="stack" style={{ gap: 14 }}>
            {DEMO_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="row" style={{ gap: 8, alignItems: "baseline", marginBottom: 6, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{t(g.title)}</strong>
                  <span className="muted" style={{ fontSize: 11.5 }}>{t(g.note)}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {g.roles.filter((r) => DEMO_IDENTITY[r]).map((r) => (
                    <Button key={r} size="sm" icon={<UserIcon size={13} />} onClick={() => enter(r)}>
                      {t(ROLES[r].label)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Badge tone="neutral">{t("All data synthetic")}</Badge>
            <Badge tone="neutral">{t("Live API")}</Badge>
            <Badge tone="neutral">{t("No real PHI anywhere")}</Badge>
          </div>
        </Card>
        )}
      </div>
    </div>
  );
}
