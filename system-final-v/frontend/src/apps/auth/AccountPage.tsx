/**
 * Account and security for hospital staff and platform staff (QA issue 8):
 * who you are signed in as and changing your password.
 * Patients have the same controls on their own Settings page.
 */
import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { Banner, Button, Card, Field, PageHeader, TextInput } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { ShieldIcon } from "@/components/ui/icons";
import { act } from "@/api/actions";
import { ApiError, api } from "@/api/client";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/rbac";

export function PasswordChangeButton({ onResult }: { onResult: (message: string) => void }) {
  const [password, setPassword] = useState<{ current: string; next: string; again: string } | null>(null);
  function change() {
    const p = password;
    setPassword(null);
    if (!p) return;
    void act(
      () => api.post("/api/v1/auth/password", { current_password: p.current, new_password: p.next }),
      () => t("Password changed — you have been signed out everywhere else"),
    ).then(onResult);
  }
  return (
    <>
      <Button icon={<ShieldIcon size={15} />} onClick={() => setPassword({ current: "", next: "", again: "" })}>{t("Change my password")}</Button>
      <Modal
        open={password !== null}
        onClose={() => setPassword(null)}
        title={t("Change my password")}
        footer={
          <>
            <Button onClick={() => setPassword(null)}>{t("Cancel")}</Button>
            <Button variant="primary" disabled={!password || !password.current || password.next.length < 8 || password.next !== password.again} onClick={change}>
              {t("Change my password")}
            </Button>
          </>
        }
      >
        {password && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label={t("Current password")} required>
              <TextInput type="password" autoComplete="current-password" value={password.current} onChange={(e) => setPassword({ ...password, current: e.currentTarget.value })} />
            </Field>
            <Field label={t("New password")} required hint={t("At least 8 characters.")}>
              <TextInput type="password" autoComplete="new-password" value={password.next} onChange={(e) => setPassword({ ...password, next: e.currentTarget.value })} />
            </Field>
            <Field label={t("New password again")} required error={password.again && password.again !== password.next ? t("The two new passwords do not match.") : undefined}>
              <TextInput type="password" autoComplete="new-password" value={password.again} onChange={(e) => setPassword({ ...password, again: e.currentTarget.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

type EmailStatus = { email: string; verified: boolean | null; verifiedAt: string | null };

/** Confirm-your-email card. Hidden for accounts that never needed it, and when there is no API. */
function EmailConfirmation({ onResult }: { onResult: (msg: string) => void }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<EmailStatus>("/api/v1/auth/email/status")
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => { /* demo build or signed out: nothing to show */ });
    return () => { alive = false; };
  }, []);

  if (!status || status.verified === null) return null;

  async function resend() {
    setBusy(true);
    try {
      const r = await api.post<{ sent: boolean; verified: boolean }>("/api/v1/auth/email/resend");
      if (r.verified) setStatus((s) => (s ? { ...s, verified: true } : s));
      onResult(r.sent ? t("Confirmation email sent. Check your inbox.") : t("Your email is already confirmed."));
    } catch (err) {
      onResult(err instanceof ApiError ? err.message : t("Could not reach the ESAP API."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("Email address")}>
      {status.verified ? (
        <Banner tone="good" title={t("Your email is confirmed")}><span lang="en" dir="ltr">{status.email}</span></Banner>
      ) : (
        <Banner tone="warning" title={t("Please confirm your email")}>
          {t("We sent a confirmation link to {email}. Open it to confirm the address is yours.", { email: status.email })}
        </Banner>
      )}
      {!status.verified && (
        <div style={{ marginTop: 12 }}>
          <Button variant="ghost" disabled={busy} onClick={() => void resend()}>{t("Send the link again")}</Button>
        </div>
      )}
    </Card>
  );
}

export function AccountPage() {
  const { name, email, role, idleMinutes } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow={t("Account")} title={t("Account and security")} lede={t("How you sign in, and keeping this account safe.")} />
      <Card title={t("Signed in as")}>
        <dl className="kv">
          <dt>{t("Name")}</dt><dd>{name}</dd>
          <dt>{t("Email")}</dt><dd>{email}</dd>
          <dt>{t("Role")}</dt><dd>{t(ROLES[role]?.label ?? role)}</dd>
        </dl>
        <p className="muted" style={{ margin: 0 }}>
          {t("You are signed out after {n} minutes without activity, and always after 12 hours.", { n: idleMinutes })}
        </p>
      </Card>
      <EmailConfirmation onResult={setToast} />
      <Card title={t("Password")}>
        <PasswordChangeButton onResult={setToast} />
      </Card>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
