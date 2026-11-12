/**
 * Two-factor sign-in (TOTP), set up from the account's own settings.
 *
 * Every signed-in person can turn it on (QA issues 8 and 25). For admin and
 * platform accounts it is required: they get `MfaSetupPage` in place of every
 * screen until it is on, and they cannot turn it off.
 *
 * The secret is shown as text and as an `otpauth://` link (a phone opens it
 * straight in an authenticator app). There is no QR code: drawing one needs a
 * library, and typing the key works in every authenticator.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "@/i18n";
import { Badge, Banner, Button, Card, Field, TextInput } from "@/components/ui/primitives";
import { CheckIcon, LogoutIcon, ShieldIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/api/client";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/rbac";
import { AuthLayout } from "./AuthLayout";

type Enrolment = { secret: string; otpauth_uri: string };

function grouped(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorPanel({ mandatory = false, onActivated }: { mandatory?: boolean; onActivated?: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ enabled: boolean }>("/api/v1/auth/mfa/status")
      .then((r) => setEnabled(r.enabled))
      .catch(() => setEnabled(false));
  }, []);

  async function run<T>(call: () => Promise<T>, done: (r: T) => void) {
    setBusy(true);
    setFailure(null);
    try {
      done(await call());
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : t("Could not reach the ESAP API."));
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(() => api.post<Enrolment>("/api/v1/auth/mfa/enroll"), (r) => { setEnrolment(r); setCode(""); });
  const activate = () => run(() => api.post("/api/v1/auth/mfa/activate", { code }), () => {
    setEnabled(true);
    setEnrolment(null);
    setCode("");
    setMessage(t("Two-factor sign-in is on. You will be asked for a code each time you sign in."));
    onActivated?.();
  });
  const disable = () => run(() => api.post("/api/v1/auth/mfa/disable", { code }), () => {
    setEnabled(false);
    setDisabling(false);
    setCode("");
    setMessage(t("Two-factor sign-in is off."));
  });

  return (
    <Card
      title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> {t("Two-factor sign-in")}</span>}
      actions={enabled === null ? null : enabled
        ? <Badge tone="good" icon={<CheckIcon size={11} />}>{t("On")}</Badge>
        : <Badge tone="neutral">{t("Off")}</Badge>}
    >
      <p style={{ margin: 0, lineHeight: 1.7 }}>
        {mandatory
          ? t("Administrator accounts must use two-factor sign-in. After your password, you also enter a 6-digit code from an authenticator app on your phone.")
          : t("After your password, you also enter a 6-digit code from an authenticator app on your phone. Someone who learns your password still cannot sign in.")}
      </p>
      {message && <Banner tone="good">{message}</Banner>}
      {failure && <Banner tone="critical" title={t("That did not work")}>{failure}</Banner>}

      {enabled === false && !enrolment && (
        <Button variant="primary" icon={<ShieldIcon size={15} />} disabled={busy} onClick={() => void start()}>
          {t("Set up two-factor sign-in")}
        </Button>
      )}

      {enrolment && (
        <div className="stack" style={{ gap: 12 }}>
          <ol className="qa-list" style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>{t("Open an authenticator app, such as Google Authenticator, Microsoft Authenticator or 1Password.")}</li>
            <li>{t("Add an account and type this key, or on your phone open the link below.")}</li>
            <li>{t("Enter the 6-digit code the app shows.")}</li>
          </ol>
          <Field label={t("Setup key")}>
            <TextInput readOnly className="mono tnum" value={grouped(enrolment.secret)} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <a className="auth-link" href={enrolment.otpauth_uri}>{t("Open in my authenticator app")}</a>
          <Field label={t("Verification code")}>
            <TextInput
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" dir="ltr"
              className="tnum" value={code} onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ""))}
            />
          </Field>
          <Button variant="primary" disabled={busy || code.length < 6} onClick={() => void activate()}>
            {t("Turn on two-factor sign-in")}
          </Button>
        </div>
      )}

      {enabled && !mandatory && !disabling && (
        <Button variant="ghost" onClick={() => { setDisabling(true); setCode(""); }}>{t("Turn off two-factor sign-in")}</Button>
      )}
      {enabled && mandatory && (
        <p className="muted" style={{ margin: 0 }}>{t("Required for your role, so it cannot be turned off.")}</p>
      )}
      {disabling && (
        <div className="stack" style={{ gap: 10 }}>
          <Field label={t("Enter a current code to turn it off")}>
            <TextInput inputMode="numeric" maxLength={6} placeholder="000000" dir="ltr" className="tnum" value={code}
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ""))} />
          </Field>
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={() => setDisabling(false)}>{t("Cancel")}</Button>
            <Button variant="danger" disabled={busy || code.length < 6} onClick={() => void disable()}>{t("Turn off")}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Shown instead of every screen while an admin account has no MFA yet. */
export function MfaSetupPage() {
  const nav = useNavigate();
  const { completeMfaSetup, signOut, role } = useSession();
  const [done, setDone] = useState(false);
  return (
    <AuthLayout variant="signin">
      <div className="auth-card auth-step">
        <div className="auth-head">
          <span className="auth-kicker"><ShieldIcon size={13} /> {t("One more step")}</span>
          <h1 className="auth-title">{t("Set up two-factor sign-in")}</h1>
          <p className="auth-sub">{t("Your account can change hospital settings and see who looked at patient records, so it needs a second factor before you can use it.")}</p>
        </div>
        <TwoFactorPanel mandatory onActivated={() => setDone(true)} />
        {done && (
          <Button variant="primary" onClick={() => void completeMfaSetup().then(() => nav(ROLES[role].home))}>
            {t("Continue")}
          </Button>
        )}
        <button type="button" className="auth-link" onClick={() => { signOut(); nav("/login"); }}>
          <LogoutIcon size={13} /> {t("Sign out")}
        </button>
      </div>
    </AuthLayout>
  );
}
