/**
 * Screen P2 — Home / "My Health" (§13.3).
 *
 * The patient's landing surface. The hard rule it exists to honour: a patient
 * never sees a raw model score. What they see is what a named clinician read
 * and released, in plain language, plus the things they can actually do.
 */
import { useNavigate } from "react-router-dom";
import { CARE_TEAM, CONSENTS, PATIENT_PORTAL_ENABLED, RECORDS, RELEASED_RESULTS } from "@/mock/db";
import { useSession } from "@/lib/session";
import { ago, dateLabel } from "@/lib/format";
import { t, tr } from "@/i18n";
import { Badge, Banner, Button, Card, PageHeader } from "@/components/ui/primitives";
import { CaringForCard } from "./CaringForCard";
import {
  ArrowRight, BedIcon, BookIcon, CheckIcon, ClipboardIcon, FileIcon, HeartPulseIcon, ShieldIcon,
  StethoscopeIcon, UsersIcon,
} from "@/components/ui/icons";
import type { ReactNode } from "react";

type StepState = "done" | "current" | "todo";

/**
 * Where the patient's care is up to, drawn from what the record actually says:
 * admitted (a care team exists) and reviewed + shared (a clinician released a
 * summary). It never shows a score or a model — only the people-led steps.
 */
function CareJourney({ released }: { released: boolean }) {
  const steps: { label: string; icon: ReactNode; state: StepState }[] = [
    { label: t("Admitted"), icon: <BedIcon size={16} />, state: "done" },
    { label: t("Details recorded"), icon: <ClipboardIcon size={16} />, state: released ? "done" : "current" },
    { label: t("Reviewed by your doctor"), icon: <StethoscopeIcon size={16} />, state: released ? "done" : "todo" },
    { label: t("Shared with you"), icon: <HeartPulseIcon size={16} />, state: released ? "done" : "todo" },
  ];
  const stateLabel = { done: t("Done"), current: t("In progress"), todo: t("Not yet") };
  return (
    <Card title={t("Your care journey")} subtitle={t("Where your care is up to — each step is done by a person, not the computer tool.")}>
      <ol className="journey" aria-label={t("Your care journey")}>
        {steps.map((s) => (
          <li key={s.label} className={`journey-step is-${s.state}`}>
            <span className="journey-dot" aria-hidden="true">{s.state === "done" ? <CheckIcon size={15} /> : s.icon}</span>
            <span className="journey-text">
              <strong>{s.label}</strong>
              <span>{stateLabel[s.state]}</span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function PatientHome() {
  const nav = useNavigate();
  const { name, role } = useSession();
  const latest = RELEASED_RESULTS[0];
  const activeConsents = CONSENTS.filter((c) => c.status === "active");
  const primary = CARE_TEAM.find((c) => c.primary);
  // Newest lab result, if there is one. A new account has no records at all.
  const latestLab = RECORDS.filter((r) => r.kind === "lab").sort((a, b) => b.date.localeCompare(a.date))[0];
  // The inpatient timeline only applies to someone under a hospital's care.
  const inCare = CARE_TEAM.length > 0;
  const isIndividual = role === "guest";

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("My health")}
        title={t("Hello, {name}", { name: name.split(" ")[0] })}
        lede={
          isIndividual
            ? t("You are using ESAP on your own, not linked to a hospital. You can check how you are feeling and produce a summary to take to an appointment.")
            : t("Everything your care team has shared with you, and the things you can do here.")
        }
      />

      {!PATIENT_PORTAL_ENABLED && (
        <Banner tone="warning" icon={<ShieldIcon size={18} />} title={t("The portal is turned off for this hospital right now")}>
          {t("Your hospital has switched off online access to released results for the moment. Nothing you were shown here has changed — contact them directly for anything you need.")}
        </Banner>
      )}

      <CaringForCard />

      {primary && (
      <div className="patient-hero">
        <span className="row" style={{ gap: 8, fontSize: 13.5, fontWeight: 650 }}>
          <HeartPulseIcon size={18} /> {t("You are being cared for at {hospital}", { hospital: primary.facility })}
        </span>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65 }}>
          {t("Your care team has looked after you since {date}.", { date: dateLabel(primary.since) })}{" "}
          {tr("Your consultant is **{name}**.", { name: primary.name })}
        </p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <Button variant="primary" onClick={() => nav("/patient/results")}>{t("See what my team shared")}</Button>
          <Button onClick={() => nav("/patient/care-team")} icon={<UsersIcon size={16} />}>{t("My care team")}</Button>
        </div>
      </div>
      )}

      {inCare && <CareJourney released={Boolean(latest)} />}

      {latest && (
        <Card
          title={t("Latest update from your care team")}
          subtitle={t("Written by {name} · {when}", { name: latest.releasedBy, when: ago(latest.releasedAt) })}
          actions={<Badge tone="good" icon={<CheckIcon size={12} />}>{t("Reviewed by a clinician")}</Badge>}
          footnote={t("Your care team reads every result before you see it, and writes the summary themselves. You will never be shown a raw score from a computer without a person having looked at it first.")}
        >
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{t(latest.plainLanguage)}</p>
          <Button onClick={() => nav("/patient/results")}>{t("Read the full summary")} <ArrowRight size={14} /></Button>
        </Card>
      )}

      <div className="grid grid-2">
        <Card
          title={<span className="row" style={{ gap: 8 }}><StethoscopeIcon size={18} /> {t("Tell us how you are feeling")}</span>}
          subtitle={t("Takes about five minutes")}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {t("Answer some questions in your own words. We turn it into a summary you can hand to your doctor or nurse, so nothing important gets forgotten in a short appointment.")}
          </p>
          <Button variant="primary" onClick={() => nav("/patient/intake")}>{t("Start")}</Button>
        </Card>

        <Card
          title={<span className="row" style={{ gap: 8 }}><FileIcon size={18} /> {t("Ready to share")}</span>}
          subtitle={t("A one-page summary for your next appointment")}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {t("Print it, or show it on your phone. It lists what has changed, what you are taking, and the questions you wanted to ask.")}
          </p>
          <Button onClick={() => nav("/patient/previsit")}>{t("Open my summary")}</Button>
        </Card>

        <Card
          title={<span className="row" style={{ gap: 8 }}><BookIcon size={18} /> {t("My records")}</span>}
          subtitle={t("{n} documents", { n: RECORDS.length })}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {t("Your visit summaries, test results and letters — including ones from other hospitals that have been sent here. You can download all of it whenever you want.")}
          </p>
          <Button onClick={() => nav("/patient/records")}>{t("See my records")}</Button>
        </Card>

        <Card
          title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> {t("Who can see my record")}</span>}
          subtitle={t("{n} people and places right now", { n: activeConsents.length })}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {t("You decide who has access, and you can take it away again at any time. Nothing is shared outside your care team without you agreeing to it.")}
          </p>
          <Button onClick={() => nav("/patient/sharing")}>{t("Manage sharing")}</Button>
        </Card>
      </div>

      <Card title={t("What is coming up")} subtitle={t("From your record")}>
        {inCare || latestLab ? (
          <ul className="timeline">
            {inCare && (
              <li>
                <span className="timeline-when">{t("Tomorrow, 09:00")}</span>
                <p className="timeline-what"><strong>{t("Ward round")}</strong><br />{t("Your consultant and the team will see you. A good time to ask the questions on your summary.")}</p>
              </li>
            )}
            {latestLab && (
              <li>
                <span className="timeline-when">{dateLabel(latestLab.date)}</span>
                <p className="timeline-what"><strong>{t("Blood test results")}</strong><br />{t("Added to your records. Your nurse can talk you through them.")}</p>
              </li>
            )}
            {inCare && (
              <li>
                <span className="timeline-when">{t("In about 6 weeks")}</span>
                <p className="timeline-what"><strong>{t("Follow-up at {clinic}", { clinic: t("Harbour Street Clinic") })}</strong><br />{t("Not booked yet. Your case manager will arrange it before you go home.")}</p>
              </li>
            )}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
            {t("Nothing yet. When a hospital looks after you and shares your record here, your appointments and results will appear in this list.")}
          </p>
        )}
      </Card>

      <Banner tone="accent" icon={<ClipboardIcon size={18} />} title={t("A note about what this service is")}>
        {t("ESAP helps your care team think about your admission by comparing it with many past hospital stays. It does not decide anything. Every decision about your care is made by a person, and anything you see here has been read by one of them first.")}
      </Banner>
    </div>
  );
}
