/**
 * Individual / self-serve signup (§10.7, §13.2.1).
 *
 * The capacity attestation is the load-bearing field. A self-serve clinical
 * tool with no gate is a tool a member of the public will use on themselves and
 * then act on. The attestation decides which product they get: the clinician
 * surface, or the patient one.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { LanguageToggle, t } from "@/i18n";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Banner, Button, Card, Field, Select, TextInput, Toggle, cx } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, HeartPulseIcon, ShieldIcon, StethoscopeIcon } from "@/components/ui/icons";
import { ApiError, NetworkError, api } from "@/api/client";
import type { SessionPayload } from "@/api/bootstrap";
import { ROLES, type RoleCode } from "@/lib/rbac";

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

const h1 = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } as const;

export function SignupPage() {
  const nav = useNavigate();
  const { startSession } = useSession();
  const [capacity, setCapacity] = useState<Capacity>(null);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", roleLabel: CLINICAL_ROLES[0].label, licence: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = form.name.trim() && EMAIL.test(form.email.trim()) && form.password.length >= 12;

  /** A real account on the server, then a real session — never a demo identity. */
  async function create(kind: "clinician" | "patient") {
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof NetworkError ? "Could not reach the ESAP API." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const failure = error && (
    <Banner tone="critical" icon={<AlertIcon size={16} />} title={t("Could not create the account")}>{error}</Banner>
  );

  return (
    <div className="auth-page">
      <div className="stack" style={{ gap: 18, width: "100%", maxWidth: 560, alignItems: "center" }}>
        <div className="row" style={{ justifyContent: "space-between", width: "100%", gap: 10 }}>
          <BrandMark />
          <div className="row" style={{ gap: 8 }}>
            <LanguageToggle compact />
            <ThemeToggle compact />
          </div>
        </div>

        {step === 0 && (
          <div className="auth-card" style={{ maxWidth: 560 }}>
            <div className="auth-head">
              <h1 style={h1}>{t("First, who are you?")}</h1>
              <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                {t("This determines which product you get. They are genuinely different — not the same screens with a different label.")}
              </p>
            </div>

            <button
              type="button"
              className={cx("big-choice", capacity === "clinician" && "is-selected")}
              onClick={() => setCapacity("clinician")}
            >
              <span className="big-choice-icon"><StethoscopeIcon size={22} /></span>
              <div style={{ flex: 1 }}>
                <strong>{t("I am a healthcare professional")}</strong>
                <span>{t("You will see probabilities, their drivers and their calibration state — the same clinical interface a hospital user gets.")}</span>
              </div>
              {capacity === "clinician" && <CheckIcon size={18} />}
            </button>

            <button
              type="button"
              className={cx("big-choice", capacity === "patient" && "is-selected")}
              onClick={() => setCapacity("patient")}
            >
              <span className="big-choice-icon"><HeartPulseIcon size={22} /></span>
              <div style={{ flex: 1 }}>
                <strong>{t("I am a patient or a carer")}</strong>
                <span>{t("You will get the plain-language portal: keep track of your health, prepare for appointments, and see what your care team shares with you.")}</span>
              </div>
              {capacity === "patient" && <CheckIcon size={18} />}
            </button>

            <Banner tone="warning" icon={<AlertIcon size={16} />} title={t("Why we ask rather than letting you choose freely")}>
              {t("A clinical risk score shown to someone without the training to contextualise it does harm — a 31% mortality estimate read as a personal prognosis is frightening and wrong. So the clinician surface is gated behind an attestation, and the patient surface never shows a raw score at all.")}
            </Banner>

            <Button variant="primary" disabled={!capacity} onClick={() => setStep(1)}>{t("Continue")}</Button>

            <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/login")}>
              {t("I already have an account")}
            </button>
          </div>
        )}

        {step === 1 && capacity === "clinician" && (
          <div className="auth-card" style={{ maxWidth: 560 }}>
            <div className="auth-head">
              <h1 style={h1}>{t("Create your individual account")}</h1>
              <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                {t("A single seat, just for you. No hospital administrator involved.")}
              </p>
            </div>

            {failure}
            <Field label={t("Full name")} required>
              <TextInput placeholder="Dr. Elin Bergström" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            </Field>
            <Field label={t("Professional email")} required>
              <TextInput type="email" placeholder="you@practice.example" value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
            </Field>
            <Field label={t("Your role")} required>
              <Select value={form.roleLabel} onChange={(e) => setForm({ ...form, roleLabel: e.currentTarget.value })}>
                {CLINICAL_ROLES.map((r) => <option key={r.label} value={r.label}>{t(r.label)}</option>)}
              </Select>
            </Field>
            <Field label={t("Registration or licence number")} hint={t("Not verified automatically today. It is recorded, and it is what an audit would check against.")}>
              <TextInput placeholder={t("Optional")} value={form.licence} onChange={(e) => setForm({ ...form, licence: e.currentTarget.value })} />
            </Field>
            <Field label={t("Password")} required hint={t("At least 12 characters. Longer beats complicated.")}>
              <TextInput type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })} />
            </Field>

            <Card title={t("The attestation")} subtitle={t("Required — please read it rather than ticking past it")}>
              <Toggle
                checked={accepted}
                onChange={setAccepted}
                label={t("I am a qualified healthcare professional")}
                hint={t("I confirm that I hold a clinical qualification, that I will use these estimates as decision support alongside my own judgement, and that I will not present them to a patient as a diagnosis or a prognosis.")}
              />
            </Card>

            <Button variant="primary" disabled={!accepted || !valid || busy} onClick={() => void create("clinician")}>
              {busy ? t("Creating…") : t("Create account")}
            </Button>
            <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => setStep(0)}>{t("Back")}</button>
          </div>
        )}

        {step === 1 && capacity === "patient" && (
          <div className="auth-card" style={{ maxWidth: 560 }}>
            <div className="auth-head">
              <h1 style={h1}>{t("Create your account")}</h1>
              <p className="muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65 }}>
                {t("Keep track of how you are feeling, prepare for appointments, and see what your care team shares with you.")}
              </p>
            </div>

            {failure}
            <Field label={t("Your name")} required>
              <TextInput placeholder="Delia Salib" style={{ fontSize: 16 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
            </Field>
            <Field label={t("Email")} required>
              <TextInput type="email" placeholder="you@example.com" style={{ fontSize: 16 }} value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
            </Field>
            <Field label={t("Password")} required hint={t("At least 12 characters. A short phrase you will remember is better than a complicated word you will not.")}>
              <TextInput type="password" autoComplete="new-password" style={{ fontSize: 16 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.currentTarget.value })} />
            </Field>

            <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("Two promises")}>
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, lineHeight: 1.7 }}>
                <li>{t("You will never be shown a raw score from a computer. Only summaries a clinician has read and written for you.")}</li>
                <li>{t("Nothing is shared with anyone until you say so, and you can take that back at any time.")}</li>
              </ul>
            </Banner>

            <Button variant="primary" disabled={!valid || busy} onClick={() => void create("patient")}>{busy ? t("Creating…") : t("Create account")}</Button>
            <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => setStep(0)}>{t("Back")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
