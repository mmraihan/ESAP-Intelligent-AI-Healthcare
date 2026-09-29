/**
 * Screen P10 — Settings & accessibility (§13.5).
 *
 * Accessibility settings sit at the top rather than at the bottom, because the
 * people who need them are the people least likely to go hunting. Language and
 * theme are both here as first-class choices, matching every other surface.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/ThemeProvider";
import { t, useLangStore, type Lang } from "@/i18n";
import { Badge, Button, Card, Field, PageHeader, SegmentedControl, Select, TextInput, Toggle } from "@/components/ui/primitives";
import { ConfirmDestructive, Modal, Toast } from "@/components/ui/overlays";
import {
  BookIcon, DownloadIcon, GlobeIcon, LogoutIcon, MonitorIcon, MoonIcon, ShieldIcon, SunIcon, TrashIcon,
} from "@/components/ui/icons";
import { act } from "@/api/actions";
import { api } from "@/api/client";
import { useSettings } from "@/hooks/useSettings";

type Prefs = {
  language: string;
  theme: string;
  textSize: "normal" | "large" | "xlarge";
  detailLevel: string;
  reduceMotion: boolean;
  readAloud: boolean;
  notifications: { results: boolean; access: boolean; appointments: boolean; marketing: boolean };
};

const PREF_DEFAULTS: Prefs = {
  language: "en", theme: "system", textSize: "normal", detailLevel: "simple", reduceMotion: false, readAloud: false,
  notifications: { results: true, access: true, appointments: false, marketing: false },
};

function saveFile(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function PatientSettings() {
  const nav = useNavigate();
  const { name, email, signOut } = useSession();
  const { mode, setMode, resolved } = useTheme();
  const { lang, setLang } = useLangStore();
  const { settings: prefs, save } = useSettings<Prefs>("patient_prefs", PREF_DEFAULTS);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [password, setPassword] = useState<{ current: string; next: string; again: string } | null>(null);

  const saved = t("Saved");
  const pref = (patch: Record<string, unknown>) => void save(patch, saved).then(setToast);

  function changePassword() {
    const p = password;
    setPassword(null);
    if (!p) return;
    void act(
      () => api.post("/api/v1/auth/password", { current_password: p.current, new_password: p.next }),
      () => t("Password changed — you have been signed out everywhere else"),
    ).then(setToast);
  }

  /** Who has looked at the record, as the server's audit trail has it. */
  function downloadAccessLog() {
    void act(
      () => api.get<{ events: { at: string; actor: string; action: string; target: string }[] }>("/api/v1/patient/access-log"),
      (r) => {
        const rows = [["when", "who", "what", "on"], ...r.events.map((e) => [e.at, e.actor, e.action, e.target])];
        saveFile("who-has-looked-at-my-record.csv", rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
        return t("Access history downloaded ({n} entries)", { n: r.events.length });
      },
    ).then(setToast);
  }

  async function closeAccount() {
    const message = await act(
      () => api.post("/api/v1/requests", {
        kind: "account_closure", detail: "Close my ESAP account. I understand my hospital record is kept by the hospital.",
      }),
      () => t("Account closure requested"),
    );
    setToast(message);
    if (message === t("Account closure requested")) { signOut(); nav("/"); }
  }

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("Settings")}
        title={t("How this works for you")}
        lede={t("Change how things look and read, and control what happens with your account.")}
      />

      <Card title={<span className="row" style={{ gap: 8 }}><GlobeIcon size={18} /> {t("Language")}</span>}>
        <Field label={t("Language")} hint={t("The page switches straight away, including the reading direction.")}>
          <SegmentedControl<Lang>
            ariaLabel={t("Language")}
            value={lang}
            onChange={(v) => { setLang(v); pref({ language: v }); }}
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
            ]}
          />
        </Field>
        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
          {t("Your care team can also arrange a human interpreter for appointments. Ask at the front desk — it is free and you are entitled to it.")}
        </p>
      </Card>

      <Card title={<span className="row" style={{ gap: 8 }}><BookIcon size={18} /> {t("Reading and seeing")}</span>} subtitle={t("These change every page")}>
        <Field label={t("Text size")} hint={t("Larger text reflows rather than cutting off — nothing gets hidden.")}>
          <SegmentedControl
            ariaLabel={t("Text size")}
            value={prefs.textSize}
            onChange={(v) => pref({ textSize: v })}
            options={[
              { value: "normal", label: t("Normal") },
              { value: "large", label: t("Large") },
              { value: "xlarge", label: t("Extra large") },
            ]}
          />
        </Field>

        <Field
          label={t("Light or dark")}
          hint={t("“System” follows whatever your phone or computer is set to — currently {mode}.", { mode: t(resolved === "dark" ? "Dark" : "Light") })}
        >
          <SegmentedControl
            ariaLabel={t("Colour theme")}
            value={mode}
            onChange={(v) => { setMode(v); pref({ theme: v }); }}
            options={[
              { value: "light", label: t("Light"), icon: <SunIcon size={15} /> },
              { value: "dark", label: t("Dark"), icon: <MoonIcon size={15} /> },
              { value: "system", label: t("System"), icon: <MonitorIcon size={15} /> },
            ]}
          />
        </Field>

        <Field label={t("How much detail in what we write")} hint={t("You can change this any time. Most people leave it on plain.")}>
          <Select value={prefs.detailLevel} onChange={(e) => pref({ detailLevel: e.currentTarget.value })} style={{ fontSize: 16 }}>
            <option value="simple">{t("Plain and simple")}</option>
            <option value="standard">{t("Standard")}</option>
            <option value="detailed">{t("Detailed, including medical terms")}</option>
          </Select>
        </Field>

        <Toggle checked={prefs.reduceMotion} onChange={(v) => pref({ reduceMotion: v })} label={t("Reduce movement")} hint={t("Turns off the small animations. Helps if motion makes you feel unwell, or if you find it distracting.")} />
        <Toggle checked={prefs.readAloud} onChange={(v) => pref({ readAloud: v })} label={t("Read pages aloud")} hint={t("Uses your device's built-in voice. Works with the text size setting above.")} />
      </Card>

      <Card title={t("Notifications")} subtitle={t("We keep these few on purpose")}>
        <Toggle checked={prefs.notifications.results} onChange={(v) => pref({ notifications: { results: v } })} label={t("When my care team shares something new")} hint={t("A summary has been written for you and released.")} />
        <Toggle checked={prefs.notifications.access} onChange={(v) => pref({ notifications: { access: v } })} label={t("When someone looks at my record")} hint={t("Including family members you have given access to.")} />
        <Toggle checked={prefs.notifications.appointments} onChange={(v) => pref({ notifications: { appointments: v } })} label={t("Appointment reminders")} hint={t("Two days before, and again on the morning.")} />
        <Toggle checked={prefs.notifications.marketing} onChange={(v) => pref({ notifications: { marketing: v } })} label={t("Occasional emails about new features")} hint={t("Off by default. Nothing about your health is ever in a marketing email.")} />
      </Card>

      <Card title={t("Your account")}>
        <Field label={t("Name")} hint={t("To change your name or email, ask your care team — it has to match your hospital record.")}>
          <TextInput value={name} readOnly style={{ fontSize: 16 }} />
        </Field>
        <Field label={t("Email")}><TextInput value={email} readOnly type="email" style={{ fontSize: 16 }} /></Field>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Button icon={<ShieldIcon size={15} />} onClick={() => setPassword({ current: "", next: "", again: "" })}>{t("Change my password")}</Button>
        </div>
      </Card>

      <Card title={<span className="row" style={{ gap: 8 }}><DownloadIcon size={18} /> {t("Your data")}</span>}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Button onClick={() => nav("/patient/records")}>{t("Download my whole record")}</Button>
          <Button onClick={downloadAccessLog}>{t("Download who has looked at it")}</Button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
          {t("Both are free, and you do not have to say why you want them.")}
        </p>
      </Card>

      <Card title={t("Closing your account")}>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>
          {t("Closing your ESAP account stops you signing in here. It does not delete your hospital medical record — hospitals are legally required to keep that, and it stays with them under their own rules. If you want your hospital record deleted, or a part of it corrected, that is a conversation with the hospital’s privacy officer.")}
        </p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Button icon={<LogoutIcon size={15} />} onClick={() => { signOut(); nav("/"); }}>{t("Sign out")}</Button>
          <Button variant="danger" icon={<TrashIcon size={15} />} onClick={() => setDeleting(true)}>{t("Close my account")}</Button>
        </div>
      </Card>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Badge tone="neutral">{t("Language")}: {lang === "ar" ? "العربية" : "English"}</Badge>
        <Badge tone="neutral">{t("Theme")}: {t(mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System")}</Badge>
      </div>

      <ConfirmDestructive
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void closeAccount()}
        title={t("Close your ESAP account")}
        confirmWord={t("CLOSE")}
        actionLabel={t("Close my account")}
        body={t("You will no longer be able to sign in here.")}
        consequences={[
          t("Your hospital medical record is NOT deleted — hospitals must keep it by law."),
          t("Anyone you gave access to loses it immediately."),
          t("Download anything you want to keep before you do this."),
          t("You can create a new account later, but your sharing settings will not come back."),
        ]}
      />

      <Modal
        open={password !== null}
        onClose={() => setPassword(null)}
        title={t("Change my password")}
        footer={
          <>
            <Button onClick={() => setPassword(null)}>{t("Cancel")}</Button>
            <Button
              variant="primary"
              disabled={!password || !password.current || password.next.length < 8 || password.next !== password.again}
              onClick={changePassword}
            >
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

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
