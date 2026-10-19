/**
 * Invite acceptance (§10.5).
 *
 * Where a hospital's invite becomes a working account: confirm the invite,
 * set a credential, done. Everything shown comes from the invite itself
 * (`GET /auth/invite/{token}`) and the account is created by the server
 * (`POST /auth/invite/accept`) — the role, scope and hospital are the ones the
 * administrator granted, not something this screen assumes.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ROLES, type RoleCode } from "@/lib/rbac";
import { useSession } from "@/lib/session";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { RoleBadge, ScopeChip } from "@/components/ui/domain";
import { Banner, Button, Card, Field, TextInput, cx } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, LockIcon, ShieldIcon } from "@/components/ui/icons";
import { ApiError, NetworkError, api } from "@/api/client";
import type { SessionPayload } from "@/api/bootstrap";

const STEPS = ["Confirm who you are", "Set a credential", "Done"];

const h1 = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } as const;

type InviteView = {
  invite: { email: string; role: RoleCode; scope: string; sentBy: string; expiresAt: string; status: string };
  tenant: { name: string } | null;
  valid: boolean;
  reason: string | null;
};

function message(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof NetworkError) return t("Could not reach the ESAP API.");
  return t("Something went wrong.");
}

export function InviteAcceptPage() {
  const { token } = useParams();
  const nav = useNavigate();
  const { startSession } = useSession();
  const [step, setStep] = useState(0);
  const [view, setView] = useState<InviteView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState({ first: "", again: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api.get<InviteView>(`/api/v1/auth/invite/${encodeURIComponent(token)}`)
      .then((v) => { if (live) setView(v); })
      .catch((e) => { if (live) setLoadError(message(e)); });
    return () => { live = false; };
  }, [token]);

  const role = view?.invite.role;
  const hospital = view?.tenant?.name ?? "";
  const emailMatches = view ? email.trim().toLowerCase() === view.invite.email.toLowerCase() : false;
  const passwordOk = password.first.length >= 12 && password.first === password.again && name.trim().length > 0;

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<SessionPayload>("/api/v1/auth/invite/accept", {
        token, name: name.trim(), password: password.first,
      }, { anonymous: true });
      await startSession(session);
      setStep(2);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const unusable = loadError ?? (view && !view.valid ? (view.reason ?? t("This invitation can no longer be used.")) : null);

  return (
    <div className="pub auth-page">
      <div className="stack" style={{ gap: 18, width: "100%", maxWidth: 560, alignItems: "center" }}>
        <div className="row" style={{ justifyContent: "space-between", width: "100%", gap: 10 }}>
          <BrandMark />
          <div className="row" style={{ gap: 8 }}>
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>

        <ul className="step-list" style={{ justifyContent: "center" }}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <span className={cx("step", i === step && "is-active", i < step && "is-done")}>
                <span className="step-num">{i < step ? <CheckIcon size={11} /> : i + 1}</span>
                {t(s)}
              </span>
            </li>
          ))}
        </ul>

        <div className="auth-card" style={{ maxWidth: 560 }}>
          {unusable ? (
            <>
              <Banner tone="critical" icon={<AlertIcon size={16} />} title={t("This invitation cannot be used")}>
                {unusable} {t("Ask your administrator to send a new one.")}
              </Banner>
              <Button onClick={() => nav("/login")}>{t("Go to sign in")}</Button>
            </>
          ) : !view || !role ? (
            <p className="muted" style={{ margin: 0 }}>{t("Checking your invitation…")}</p>
          ) : (
            <>
              {step === 0 && (
                <>
                  <div className="auth-head">
                    <h1 style={h1}>{t("You have been invited to {hospital}", { hospital })}</h1>
                    <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                      {t("{name} invited you. Check that this is right before you continue — if any of it is wrong, tell your administrator rather than accepting it.", { name: view.invite.sentBy })}
                    </p>
                  </div>

                  <Card title={t("What you are being granted")}>
                    <dl className="kv">
                      <dt>{t("Organisation")}</dt><dd>{hospital}</dd>
                      <dt>{t("Role")}</dt><dd><RoleBadge role={role} /></dd>
                      <dt>{t("Scope")}</dt><dd><ScopeChip scope={view.invite.scope} /></dd>
                      <dt>{t("What that means")}</dt><dd style={{ fontSize: 12.5, lineHeight: 1.55 }}>{t(ROLES[role].blurb)}</dd>
                    </dl>
                  </Card>

                  <Banner tone="accent" icon={<ShieldIcon size={16} />} title={t("This invite is single-use and expires in 7 days")}>
                    {t("Once you accept it, the link stops working. If you never accept it, it expires on its own and has to be reissued — a forwarded invite email does not stay usable forever.")}
                  </Banner>

                  <Field
                    label={t("Confirm your email")}
                    required
                    hint={t("Must match the address the invite was sent to.")}
                    error={email.trim() && !emailMatches ? t("That is not the address this invitation was sent to.") : undefined}
                  >
                    <TextInput type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
                  </Field>

                  <Button variant="primary" disabled={!emailMatches} onClick={() => setStep(1)}>{t("This is me — continue")}</Button>
                  <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/login")}>
                    {t("This is not me / something is wrong")}
                  </button>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="auth-head">
                    <h1 style={h1}>{t("How will you sign in?")}</h1>
                  </div>

                  <Banner tone="warning" icon={<LockIcon size={16} />} title={t("Hospital single sign-on is not connected here yet")}>
                    {t("Set a password for now. When your hospital connects single sign-on, you will be able to switch to it.")}
                  </Banner>
                  {error && <Banner tone="critical" icon={<AlertIcon size={16} />} title={t("Could not create the account")}>{error}</Banner>}
                  <Field label={t("Your name")} required>
                    <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} />
                  </Field>
                  <Field label={t("Password")} required hint={t("At least 12 characters.")}>
                    <TextInput type="password" autoComplete="new-password" value={password.first} onChange={(e) => setPassword({ ...password, first: e.currentTarget.value })} />
                  </Field>
                  <Field
                    label={t("Confirm password")}
                    required
                    error={password.again && password.again !== password.first ? t("The two passwords do not match.") : undefined}
                  >
                    <TextInput type="password" autoComplete="new-password" value={password.again} onChange={(e) => setPassword({ ...password, again: e.currentTarget.value })} />
                  </Field>

                  <Button variant="primary" disabled={!passwordOk || busy} onClick={() => void accept()}>
                    {busy ? t("Creating…") : t("Continue")}
                  </Button>
                  <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => setStep(0)}>{t("Back")}</button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="auth-head">
                    <h1 style={h1}>
                      <span className="row" style={{ gap: 8 }}><CheckIcon size={22} /> {t("You are in")}</span>
                    </h1>
                    <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                      {t("Your account is active at {hospital}. Before you start, five minutes on how to read a result is genuinely worth it.", { hospital })}
                    </p>
                  </div>

                  <Card title={t("Worth reading first")}>
                    <ul className="caveat-list">
                      <li><CheckIcon size={13} /> {t("A probability describes a population of similar admissions, never the individual in front of you.")}</li>
                      <li><CheckIcon size={13} /> {t("The gauges use one blue ramp on purpose — read the number, not the colour.")}</li>
                      <li><CheckIcon size={13} /> {t("Every estimate uses admission-time data only. It cannot know how someone has responded since.")}</li>
                      <li><CheckIcon size={13} /> {t("Acknowledging records that you reviewed it, not that you agreed with it.")}</li>
                    </ul>
                  </Card>

                  <Button variant="primary" onClick={() => nav("/help")}>{t("Read that first (5 min)")}</Button>
                  <Button onClick={() => nav(ROLES[role].home)}>{t("Go straight to my worklist")}</Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
