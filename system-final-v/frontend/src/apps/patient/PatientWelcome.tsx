/**
 * Screen P0 — Welcome, language and reading level (§13.5).
 *
 * The first thing the patient surface does is ask how they want to be written
 * to, before showing them anything. Two languages — English and Arabic — and
 * choosing one switches the whole patient surface immediately, including the
 * reading direction. Reading level is a real accessibility setting, not a tone
 * preference, and the default is the simpler one.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { t, tr, useLangStore, type Lang } from "@/i18n";
import { Banner, Button, Card, cx } from "@/components/ui/primitives";
import { BookIcon, CheckIcon, GlobeIcon, HeartPulseIcon, ShieldIcon, UsersIcon } from "@/components/ui/icons";

const LANGUAGES: { code: Lang; native: string }[] = [
  { code: "en", native: "English" },
  { code: "ar", native: "العربية" },
];

const READING = [
  { key: "simple", title: "Plain and simple", blurb: "Short sentences. No medical words unless we explain them. This is what we use unless you tell us otherwise." },
  { key: "standard", title: "Standard", blurb: "Everyday language, with the medical term in brackets when it is useful to know it." },
  { key: "detailed", title: "Detailed", blurb: "More clinical detail, including the terms your care team uses with each other." },
];

export function PatientWelcome() {
  const nav = useNavigate();
  const { lang, setLang } = useLangStore();
  const [level, setLevel] = useState("simple");

  return (
    <div className="site plain">
      <header className="site-nav">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="site-main" style={{ maxWidth: 720, gap: 28 }}>
        <div className="hero" style={{ paddingTop: 48, gap: 16 }}>
          <span className="hero-eyebrow"><HeartPulseIcon size={14} /> {t("Your health record")}</span>
          <h1 style={{ maxWidth: "16ch" }}>{t("Welcome. Let us set this up the way you want it.")}</h1>
          <p className="hero-lede">
            {t("Two quick questions, then you are in. You can change both of these at any time in settings.")}
          </p>
        </div>

        <Card title={<span className="row" style={{ gap: 8 }}><GlobeIcon size={18} /> {t("What language would you like?")}</span>}>
          <div className="grid grid-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                lang={l.code}
                className={cx("big-choice", lang === l.code && "is-selected")}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
              >
                <div style={{ flex: 1 }}>
                  <strong>{l.native}</strong>
                  {/* Each option also names itself in the other language, so a reader of
                      either can find theirs whichever language the page is currently in. */}
                  <span>{l.code === "ar" ? "Arabic" : "الإنجليزية"}</span>
                </div>
                {lang === l.code && <CheckIcon size={18} />}
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            {t("The page switches as soon as you choose. If you need another language for an appointment, your hospital can arrange an interpreter — ask at the front desk.")}
          </p>
        </Card>

        <Card title={<span className="row" style={{ gap: 8 }}><BookIcon size={18} /> {t("How much detail do you want?")}</span>}>
          <div className="stack" style={{ gap: 10 }}>
            {READING.map((r) => (
              <button
                key={r.key}
                type="button"
                className={cx("big-choice", level === r.key && "is-selected")}
                onClick={() => setLevel(r.key)}
              >
                <span className="big-choice-icon"><BookIcon size={20} /></span>
                <div style={{ flex: 1 }}>
                  <strong>{t(r.title)}</strong>
                  <span>{t(r.blurb)}</span>
                </div>
                {level === r.key && <CheckIcon size={18} />}
              </button>
            ))}
          </div>
        </Card>

        <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("Before you go in, two things worth knowing")}>
          <ul style={{ margin: "6px 0 0", paddingInlineStart: 20, lineHeight: 1.7 }}>
            <li>{tr("You will only ever see results **after a member of your care team has read them and written you a summary**. You will not see a raw score from a computer.")}</li>
            <li>{t("You decide who else can see your record. That is in Share & consent, and you can take access away again at any time.")}</li>
          </ul>
        </Banner>

        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => nav("/patient/home")}>{t("Continue")}</Button>
          <Button onClick={() => nav("/patient/family")} icon={<UsersIcon size={16} />}>{t("I am helping someone else")}</Button>
        </div>

        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, maxWidth: "60ch" }}>
          {t("If you are a family member or carer helping someone, you can be given access properly rather than sharing their password — it is set up under Family access, and it keeps a record of who saw what, which protects both of you.")}
        </p>
      </main>
    </div>
  );
}
