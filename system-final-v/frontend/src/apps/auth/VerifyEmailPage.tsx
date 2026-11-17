/**
 * Confirm an email address from the link in the sign-up email.
 *
 * The link carries a one-time token that works for 48 hours. Opening it again
 * after it has been used just says the address is already confirmed.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { t } from "@/i18n";
import { Banner } from "@/components/ui/primitives";
import { ArrowRight, MailIcon } from "@/components/ui/icons";
import { ApiError, api } from "@/api/client";
import { MailLink, SUPPORT_EMAIL } from "@/lib/contact";
import { AuthLayout } from "./AuthLayout";

type View = { kind: "checking" } | { kind: "done"; email: string; already: boolean } | { kind: "failed"; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [view, setView] = useState<View>(token ? { kind: "checking" } : { kind: "failed", message: "" });
  const sent = useRef(false);

  useEffect(() => {
    // Once only: React's development double-run would otherwise post twice.
    if (!token || sent.current) return;
    sent.current = true;
    api.post<{ verified: boolean; email: string; already: boolean }>("/api/v1/auth/email/verify", { token }, { anonymous: true })
      .then((r) => setView({ kind: "done", email: r.email, already: r.already }))
      .catch((err) => setView({ kind: "failed", message: err instanceof ApiError ? err.message : t("Could not reach the ESAP API.") }));
  }, [token]);

  return (
    <AuthLayout variant="signin">
      <div className="auth-card auth-step">
        <div className="auth-head">
          <span className="auth-kicker"><MailIcon size={13} /> {t("Email confirmation")}</span>
          <h1 className="auth-title">{t("Confirm your email")}</h1>
        </div>

        {view.kind === "checking" && <p className="auth-sub"><span className="esap-spinner" /> {t("Checking your link…")}</p>}

        {view.kind === "done" && (
          <>
            <Banner tone="good" title={view.already ? t("This address is already confirmed") : t("Your email is confirmed")}>
              <span lang="en" dir="ltr">{view.email}</span>
            </Banner>
            <Link className="btn btn-primary auth-submit" to="/login">{t("Sign in")} <ArrowRight size={15} /></Link>
          </>
        )}

        {view.kind === "failed" && (
          <>
            <Banner tone="warning" title={token ? t("That did not work") : t("This page needs the link from your email")}>
              {view.message || t("Open the confirmation link from the email again, or ask for a new one from your account page.")}
            </Banner>
            <p className="auth-sub">
              {t("Still stuck? Write to")} <MailLink address={SUPPORT_EMAIL} />.
            </p>
            <Link className="btn btn-ghost auth-submit" to="/login">{t("Sign in")}</Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
