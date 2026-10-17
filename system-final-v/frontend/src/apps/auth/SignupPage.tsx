/**
 * Individual / self-serve signup (§10.7, §13.2.1).
 *
 * The capacity attestation is the load-bearing field. A self-serve clinical
 * tool with no gate is a tool a member of the public will use on themselves and
 * then act on. The attestation decides which product they get: the clinician
 * surface, or the patient one.
 */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { t } from "@/i18n";
import { Banner, Select, Toggle, cx } from "@/components/ui/primitives";
import { AlertIcon, ArrowRight, CheckIcon, EyeIcon, EyeOffIcon, HeartPulseIcon, ShieldIcon, StethoscopeIcon } from "@/components/ui/icons";
import { ApiError, NetworkError, api } from "@/api/client";
import type { SessionPayload } from "@/api/bootstrap";
import { ROLES, type RoleCode } from "@/lib/rbac";
import { AuthLayout } from "./AuthLayout";

type Capacity = "clinician" | "patient" | null;

/** What a self-serve clinician may be — the server refuses admin and platform roles here. */
const CLINICAL_ROLES: { label: string; role: RoleCode }[] = [
  { label: "Physician", role: "physician" },
  { label: "Resident / trainee", role: "resident" },
  { label: "Nurse practitioner", role: "np_pa" },
  { label: "Physician assistant", role: "np_pa" },
  { label: "Registered nurse", role: "staff_nurse" },
  { label: "Pharmacist", role: "pharmacist" },
  { label: "Care coordinator / case manager", role: "case_manager" },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 12;

/** Length-led strength: the policy is "longer beats complicated", so the meter says the same. */
function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < MIN_PASSWORD) return { score: 1, label: "Too short" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || (pw.length >= 12 && variety >= 3)) return { score: 3, label: "Strong" };
  return { score: 2, label: "Good" };
}

export function SignupPage() {
  const nav = useNavigate();
  const { startSession } = useSession();
  const [capacity, setCapacity] = useState<Capacity>(null);
  const [step, setStep] = useState(0);
  // Direction of the last step change, so the next panel slides in from the
  // side the user is moving towards.
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", roleLabel: CLINICAL_ROLES[0].label, licence: "", password: "" });
  const [touched, setTouched] = useState({ email: false });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailBad = touched.email && form.email.trim() !== "" && !EMAIL.test(form.email.trim());
  const valid = form.name.trim() && EMAIL.test(form.email.trim()) && form.password.length >= MIN_PASSWORD;
  const pw = strength(form.password);

  function go(next: number) {
    setDir(next > step ? "fwd" : "back");
    setError(null);
    setStep(next);
  }

  /** A real account on the server, then a real session — never a demo identity. */
  async function create(e: FormEvent) {
    e.preventDefault();
    const kind = capacity === "patient" ? "patient" : "clinician";
    if (busy || !valid || (kind === "clinician" && !accepted)) return;
    const role = kind === "patient" ? "patient" : CLINICAL_ROLES.find((r) => r.label === form.roleLabel)!.role;
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<SessionPayload>("/api/v1/auth/signup", {
        name: form.name.trim(), email: form.email.trim(), password: form.password, role,
        licence_number: kind === "clinician" ? form.licence.trim() || null : null,
      }, { anonymous: true });
      await startSession(session);
      nav(kind === "patient" ? "/welcome" : ROLES[role].home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof NetworkError ? t("Could not reach the ESAP API.") : t("Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  const failure = error && (
    <div className="auth-shake">
      <Banner tone="critical" icon={<AlertIcon size={16} />} title={t("Could not create the account")}>{error}</Banner>
    </div>
  );

  const patient = capacity === "patient";

  const stepper = (
    <ol className="auth-steps" aria-label={t("Progress")}>
      {[t("Who you are"), t("Your details")].map((label, i) => (
        <li key={label} className={cx("auth-step-dot", i === step && "is-current", i < step && "is-done")} aria-current={i === step ? "step" : undefined}>
          <span className="auth-step-num">{i < step ? <CheckIcon size={12} /> : i + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <AuthLayout variant="signup">
      {step === 0 && (
        <div key="s0" className={cx("auth-card auth-step", dir === "back" && "is-back")}>
          {stepper}
          <div className="auth-head">
            <h1 className="auth-title">{t("First, who are you?")}</h1>
            <p className="auth-sub">
              {t("This determines which product you get. They are genuinely different — not the same screens with a different label.")}
            </p>
          </div>

          <div className="auth-choices" role="radiogroup" aria-label={t("Who are you?")}>
            <button
              type="button"
              role="radio"
              aria-checked={capacity === "clinician"}
              className={cx("big-choice", capacity === "clinician" && "is-selected")}
              onClick={() => setCapacity("clinician")}
            >
              <span className="big-choice-icon"><StethoscopeIcon size={22} /></span>
              <div style={{ flex: 1 }}>
                <strong>{t("I am a healthcare professional")}</strong>
                <span>{t("You will see probabilities, their drivers and their calibration state — the same clinical interface a hospital user gets.")}</span>
              </div>
              <span className="big-choice-check"><CheckIcon size={14} /></span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={capacity === "patient"}
              className={cx("big-choice", capacity === "patient" && "is-selected")}
              onClick={() => setCapacity("patient")}
            >
              <span className="big-choice-icon"><HeartPulseIcon size={22} /></span>
              <div style={{ flex: 1 }}>
                <strong>{t("I am a patient or a carer")}</strong>
                <span>{t("You will get the plain-language portal: keep track of your health, prepare for appointments, and see what your care team shares with you.")}</span>
              </div>
              <span className="big-choice-check"><CheckIcon size={14} /></span>
            </button>
          </div>

          <details className="auth-why">
            <summary><AlertIcon size={14} /> {t("Why we ask rather than letting you choose freely")}</summary>
            <p>
              {t("A clinical risk score shown to someone without the training to contextualise it does harm — a 31% mortality estimate read as a personal prognosis is frightening and wrong. So the clinician surface is gated behind an attestation, and the patient surface never shows a raw score at all.")}
            </p>
          </details>

          <button type="button" className="btn btn-primary auth-submit" disabled={!capacity} onClick={() => go(1)}>
            {t("Continue")} <ArrowRight size={15} />
          </button>
          <p className="auth-switch">
            {t("Already have an account?")}{" "}
            <button type="button" className="auth-link is-inline" onClick={() => nav("/login")}>{t("Sign in")}</button>
          </p>
        </div>
      )}

      {step === 1 && capacity && (
        <form key="s1" className={cx("auth-card auth-step", dir === "back" && "is-back")} onSubmit={create} noValidate>
          {stepper}
          <div className="auth-head">
            <h1 className="auth-title">{patient ? t("Create your account") : t("Create your individual account")}</h1>
            <p className="auth-sub">
              {patient
                ? t("Keep track of how you are feeling, prepare for appointments, and see what your care team shares with you.")
                : t("A single seat, just for you. No hospital administrator involved.")}
            </p>
          </div>

          {failure}

          <label className="auth-field">
            <span className="auth-label">{patient ? t("Your name") : t("Full name")} <em aria-hidden="true">*</em></span>
            <input
              className="input auth-input is-plain"
              autoComplete="name"
              autoFocus
              placeholder={patient ? "Delia Salib" : "Dr. Elin Bergström"}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">{patient ? t("Email") : t("Professional email")} <em aria-hidden="true">*</em></span>
            <input
              className="input auth-input is-plain"
              type="email"
              autoComplete="email"
              placeholder={patient ? "you@example.com" : "you@practice.example"}
              aria-invalid={emailBad || undefined}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              onBlur={() => setTouched({ email: true })}
            />
            {emailBad && <span className="auth-hint is-error" role="alert"><AlertIcon size={13} /> {t("That does not look like an email address.")}</span>}
          </label>

          {!patient && (
            <div className="auth-row-2">
              <label className="auth-field">
                <span className="auth-label">{t("Your role")} <em aria-hidden="true">*</em></span>
                <Select value={form.roleLabel} onChange={(e) => setForm({ ...form, roleLabel: e.currentTarget.value })}>
                  {CLINICAL_ROLES.map((r) => <option key={r.label} value={r.label}>{t(r.label)}</option>)}
                </Select>
              </label>
              <label className="auth-field">
                <span className="auth-label">{t("Licence number")}</span>
                <input className="input auth-input is-plain" placeholder={t("Optional")} value={form.licence} onChange={(e) => setForm({ ...form, licence: e.currentTarget.value })} />
              </label>
              <span className="auth-hint auth-row-span">
                {t("Not verified automatically today. It is recorded, and it is what an audit would check against.")}
              </span>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-password">{t("Password")} <em aria-hidden="true">*</em></label>
            <span className="auth-input-wrap is-plain">
              <input
                id="signup-password"
                className="input auth-input is-plain has-action"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
                aria-describedby="signup-password-hint"
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
            <span className={cx("auth-meter", `is-${pw.score}`)} aria-hidden="true"><span /><span /><span /></span>
            <span id="signup-password-hint" className="auth-hint">
              {pw.label ? <strong className={cx("auth-meter-label", `is-${pw.score}`)}>{t(pw.label)} · </strong> : null}
              {t("At least 12 characters. Longer beats complicated.")}
            </span>
          </div>

          {patient ? (
            <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("Two promises")}>
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, lineHeight: 1.7 }}>
                <li>{t("You will never be shown a raw score from a computer. Only summaries a clinician has read and written for you.")}</li>
                <li>{t("Nothing is shared with anyone until you say so, and you can take that back at any time.")}</li>
              </ul>
            </Banner>
          ) : (
            <div className={cx("auth-attest", accepted && "is-on")}>
              <Toggle
                checked={accepted}
                onChange={setAccepted}
                label={t("I am a qualified healthcare professional")}
                hint={t("I confirm that I hold a clinical qualification, that I will use these estimates as decision support alongside my own judgement, and that I will not present them to a patient as a diagnosis or a prognosis.")}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !valid || (!patient && !accepted)}>
            {busy ? <><span className="esap-spinner" /> {t("Creating…")}</> : <>{t("Create account")} <ArrowRight size={15} /></>}
          </button>
          <button type="button" className="auth-link" onClick={() => go(0)}>{t("Back")}</button>
        </form>
      )}
    </AuthLayout>
  );
}
