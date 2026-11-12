/**
 * Choose a new password from an emailed reset link (QA issue 17).
 *
 * The link carries a one-time token that works for 60 minutes. Setting the
 * password signs the account out everywhere; the person then signs in again.
 */
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { t } from "@/i18n";
import { Banner } from "@/components/ui/primitives";
import { ArrowRight, LockIcon, ShieldIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/api/client";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = again.length > 0 && again !== next;
  const ready = token.length >= 16 && next.length >= 8 && next === again;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/auth/password/reset", { token, new_password: next }, { anonymous: true });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("Could not reach the ESAP API."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="signin">
      <form className="auth-card auth-step" onSubmit={submit} noValidate>
        <div className="auth-head">
          <span className="auth-kicker"><ShieldIcon size={13} /> {t("Password reset")}</span>
          <h1 className="auth-title">{t("Choose a new password")}</h1>
          <p className="auth-sub">{t("At least 8 characters. You will be signed out everywhere, then you can sign in with the new one.")}</p>
        </div>

        {!token && <Banner tone="warning" title={t("This page needs the link from your email")}>{t("Open the reset link from the email again, or ask for a new one on the sign-in page.")}</Banner>}
        {error && <Banner tone="critical" title={t("That did not work")}>{error}</Banner>}

        {done ? (
          <>
            <Banner tone="good" title={t("Your password has been changed")}>{t("Sign in with the new one.")}</Banner>
            <Link className="btn btn-primary auth-submit" to="/login">{t("Sign in")} <ArrowRight size={15} /></Link>
          </>
        ) : (
          <>
            <label className="auth-field">
              <span className="auth-label">{t("New password")}</span>
              <span className="auth-input-wrap">
                <LockIcon size={16} />
                <input className="input auth-input" type="password" autoComplete="new-password" value={next}
                  onChange={(e) => setNext(e.currentTarget.value)} autoFocus />
              </span>
            </label>
            <label className="auth-field">
              <span className="auth-label">{t("New password again")}</span>
              <span className="auth-input-wrap">
                <LockIcon size={16} />
                <input className="input auth-input" type="password" autoComplete="new-password" value={again}
                  onChange={(e) => setAgain(e.currentTarget.value)} />
              </span>
              {mismatch && <span className="auth-hint is-error" role="alert">{t("The two new passwords do not match.")}</span>}
            </label>
            <button type="submit" className="btn btn-primary auth-submit" disabled={!ready || busy}>
              {busy ? <><span className="esap-spinner" /> {t("Saving…")}</> : t("Set the new password")}
            </button>
            <Link className="auth-link" to="/login">{t("Back to sign in")}</Link>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
