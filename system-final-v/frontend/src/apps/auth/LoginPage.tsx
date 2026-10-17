/**
 * Sign in (§10.8, §10.10, §10.12).
 *
 * SSO first, password second — a hospital that signs in with local passwords
 * ends up with shared passwords, which destroys the audit trail. SSO is not
 * wired up in this build, so the screen says so rather than showing a dead
 * button.
 *
 * The demo role picker no longer lives here: it is on an unlinked route
 * (DemoAccessPage, mounted only when VITE_DEMO_ACCESS_PATH is set).
 */
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ROLES } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { t } from "@/i18n";
import { Banner } from "@/components/ui/primitives";
import { AlertIcon, ArrowRight, EyeIcon, EyeOffIcon, HeartPulseIcon, LockIcon, MailIcon, ShieldIcon, StethoscopeIcon } from "@/components/ui/icons";
import { api } from "@/api/client";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const nav = useNavigate();
  const { signInWithPassword, verifyMfa, cancelMfa, mfaPending, pending, error } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [resetNote, setResetNote] = useState<string | null>(null);
  // Bumped on every failed attempt so the error banner re-runs its shake.
  const [attempt, setAttempt] = useState(0);

  /**
   * There is no email service, so a reset goes to the hospital admin's request
   * queue. The reply is the same for any address — the server will not say
   * whether an account exists.
   */
  async function forgot() {
    if (!email.trim()) {
      setResetNote(t("Enter your email address above, then choose “Forgot password?” again."));
      return;
    }
    try {
      await api.post("/api/v1/auth/password/forgot", { email: email.trim() }, { anonymous: true });
      setResetNote(t("If that address has an account, your administrator has been asked to send you a reset link."));
    } catch {
      setResetNote(t("Could not reach the ESAP API."));
    }
  }

  /** Real credentials against the API. The role comes back in the session. */
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending || !email.trim() || !password) return;
    try {
      await signInWithPassword(email.trim(), password);
      // A second factor may be required; if so, wait on the code step rather
      // than navigating with a role we do not yet have.
      if (useSession.getState().mfaPending) return;
      nav(ROLES[useSession.getState().role].home);
    } catch {
      setAttempt((n) => n + 1); // `error` on the store already holds the server's message.
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    if (pending || mfaCode.trim().length < 6) return;
    try {
      await verifyMfa(mfaCode.trim());
      setMfaCode("");
      nav(ROLES[useSession.getState().role].home);
    } catch {
      setAttempt((n) => n + 1);
    }
  }

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  const failure = error ? (
    <div key={attempt} className="auth-shake">
      <Banner tone="critical" icon={<ShieldIcon size={16} />} title={t("Could not sign in")}>{error}</Banner>
    </div>
  ) : null;

  return (
    <AuthLayout variant="signin">
      {mfaPending ? (
        <form className="auth-card auth-step" onSubmit={submitMfa} noValidate>
          <div className="auth-head">
            <span className="auth-kicker"><ShieldIcon size={13} /> {t("Two-step verification")}</span>
            <h1 className="auth-title">{t("Check your authenticator")}</h1>
            <p className="auth-sub">{t("Enter the 6-digit code from your authenticator app to finish signing in.")}</p>
          </div>
          {failure}
          <label className="auth-field">
            <span className="auth-label">{t("Verification code")}</span>
            <input
              className="input auth-input auth-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.currentTarget.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="submit" className="btn btn-primary auth-submit" disabled={pending || mfaCode.trim().length < 6}>
            {pending ? <><span className="esap-spinner" /> {t("Verifying…")}</> : t("Verify and sign in")}
          </button>
          <button type="button" className="auth-link" onClick={cancelMfa}>{t("Use a different account")}</button>
        </form>
      ) : (
        <form className="auth-card auth-step" onSubmit={submit} noValidate>
          <div className="auth-head">
            <h1 className="auth-title">{t("Welcome back")}</h1>
            <p className="auth-sub">
              {t("Sign in with your hospital account. No account yet? Your administrator sends you an invite.")}
            </p>
          </div>

          {failure}

          <label className="auth-field">
            <span className="auth-label">{t("Work email")}</span>
            <span className="auth-input-wrap">
              <MailIcon size={16} />
              <input
                className="input auth-input"
                type="email"
                placeholder="you@hospital.example"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
            </span>
          </label>

          <div className="auth-field">
            <span className="auth-label-row">
              <label className="auth-label" htmlFor="login-password">{t("Password")}</label>
              <button type="button" className="auth-link is-inline" onClick={() => void forgot()}>{t("Forgot password?")}</button>
            </span>
            <span className="auth-input-wrap">
              <LockIcon size={16} />
              <input
                id="login-password"
                className="input auth-input has-action"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                onKeyUp={trackCaps}
                onKeyDown={trackCaps}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("Hide password") : t("Show password")}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </span>
            {capsLock && <span className="auth-hint is-warn" role="status"><AlertIcon size={13} /> {t("Caps Lock is on")}</span>}
            {resetNote && <span className="auth-hint" role="status">{resetNote}</span>}
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={pending || !email.trim() || !password}>
            {pending ? <><span className="esap-spinner" /> {t("Signing in…")}</> : <>{t("Sign in")} <ArrowRight size={15} /></>}
          </button>

          <p className="auth-sso"><ShieldIcon size={13} /> {t("Hospital single sign-on is not connected in this build yet.")}</p>

          <div className="auth-divider">{t("New to ESAP?")}</div>

          <div className="auth-paths">
            <button type="button" className="auth-path" onClick={() => nav("/signup")}>
              <span className="auth-path-icon"><StethoscopeIcon size={18} /></span>
              <span className="auth-path-text">
                <strong>{t("Solo clinician")}</strong>
                <small>{t("Create an individual account")}</small>
              </span>
              <ArrowRight size={14} />
            </button>
            <button type="button" className="auth-path" onClick={() => nav("/welcome")}>
              <span className="auth-path-icon"><HeartPulseIcon size={18} /></span>
              <span className="auth-path-text">
                <strong>{t("Patient or carer")}</strong>
                <small>{t("Open the patient portal")}</small>
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
