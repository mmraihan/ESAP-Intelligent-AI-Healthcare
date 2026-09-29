/**
 * Caregiver acceptance.
 *
 * Where a patient's family-access invite becomes the carer's own sign-in. The
 * invite (`GET /auth/caregiver-invite/{token}`) says who invited them and how
 * much they may see; accepting (`POST /auth/caregiver-accept`) creates the
 * carer's account and links it to that patient. Strings are plain English: this
 * one-time step sits outside the localised patient surface.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "@/lib/session";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Banner, Button, Card, Field, TextInput } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, ShieldIcon } from "@/components/ui/icons";
import { ApiError, NetworkError, api } from "@/api/client";
import type { SessionPayload } from "@/api/bootstrap";

const h1 = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" } as const;

const LEVEL_TEXT: Record<string, string> = {
  view_summaries: "See their visit summaries",
  view_all: "See their whole record",
  act_on_behalf: "See their record and act on their behalf",
};

type InviteView = { patientName: string; relationship: string; level: string; email: string };

function message(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof NetworkError) return "Could not reach the ESAP API.";
  return "Something went wrong.";
}

export function CaregiverAcceptPage() {
  const { token } = useParams();
  const nav = useNavigate();
  const { startSession } = useSession();
  const [view, setView] = useState<InviteView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState({ first: "", again: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api.get<InviteView>(`/api/v1/auth/caregiver-invite/${encodeURIComponent(token)}`)
      .then((v) => { if (live) setView(v); })
      .catch((e) => { if (live) setLoadError(message(e)); });
    return () => { live = false; };
  }, [token]);

  const passwordOk = password.first.length >= 8 && password.first === password.again && name.trim().length > 0;

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<SessionPayload>("/api/v1/auth/caregiver-accept", {
        token, name: name.trim(), password: password.first,
      }, { anonymous: true });
      await startSession(session);
      nav("/patient/home");
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="stack" style={{ gap: 18, width: "100%", maxWidth: 520, alignItems: "center" }}>
        <div className="row" style={{ justifyContent: "space-between", width: "100%", gap: 10 }}>
          <BrandMark />
          <ThemeToggle compact />
        </div>

        <div className="auth-card" style={{ maxWidth: 520 }}>
          {loadError ? (
            <>
              <Banner tone="critical" icon={<AlertIcon size={16} />} title="This invitation cannot be used">
                {loadError} Ask the person who invited you to send a new link.
              </Banner>
              <Button onClick={() => nav("/login")}>Go to sign in</Button>
            </>
          ) : !view ? (
            <p className="muted" style={{ margin: 0 }}>Checking your invitation…</p>
          ) : (
            <>
              <div className="auth-head">
                <h1 style={h1}>{view.patientName} would like your help</h1>
                <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
                  You have been invited as their {view.relationship}. Set up your own sign-in below — please
                  do not use anyone else's password.
                </p>
              </div>

              <Card title="What you will be able to do">
                <p style={{ margin: 0, fontSize: 14.5 }}>
                  <span className="row" style={{ gap: 8 }}><ShieldIcon size={15} /> {LEVEL_TEXT[view.level] ?? "See what they have shared"}</span>
                </p>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55 }}>
                  You will never be shown a raw score, exactly as they are not. {view.patientName} can stop your access at any time.
                </p>
              </Card>

              {error && <Banner tone="critical" icon={<AlertIcon size={16} />} title="Could not create your access">{error}</Banner>}

              <Field label="Your name" required>
                <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} />
              </Field>
              <Field label="Choose a password" required hint="At least 8 characters.">
                <TextInput type="password" autoComplete="new-password" value={password.first} onChange={(e) => setPassword({ ...password, first: e.currentTarget.value })} />
              </Field>
              <Field
                label="Confirm password"
                required
                error={password.again && password.again !== password.first ? "The two passwords do not match." : undefined}
              >
                <TextInput type="password" autoComplete="new-password" value={password.again} onChange={(e) => setPassword({ ...password, again: e.currentTarget.value })} />
              </Field>

              <Button variant="primary" disabled={!passwordOk || busy} onClick={() => void accept()}>
                {busy ? "Setting up…" : "Set up my access"}
              </Button>
              <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => nav("/login")}>
                <span className="row" style={{ gap: 6 }}><CheckIcon size={13} /> I already have an account</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
