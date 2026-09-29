/**
 * Screen P4 — Pre-visit summary, "Ready to share" (§13.3).
 *
 * One page the patient can hand over. It is built to be printed or shown on a
 * phone in a seven-minute appointment, so it leads with what changed rather
 * than with a tidy history the clinician already has.
 *
 * Its content is what the patient told us, from their latest "Tell us how you
 * feel" submission on the server, in their own words. With nothing submitted
 * yet, it says so and points them there.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/lib/session";
import { dateLabel } from "@/lib/format";
import { t } from "@/i18n";
import { Badge, Banner, Button, Card, PageHeader, Toggle } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { CheckIcon, DownloadIcon, FileIcon, PillIcon, SendIcon, ShieldIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";

type Submission = {
  id: string;
  kind: "symptoms" | "previsit";
  submittedAt: string;
  describe?: string;
  since?: string | null;
  gettingWorse?: boolean | null;
  missedDoses?: boolean | null;
  concerns?: string[];
  medications?: string | null;
  questions?: string[];
  /** Set when a named clinician marks it as read. */
  seenAt?: string;
  seenBy?: string;
};

type Include = { symptoms: boolean; meds: boolean; questions: boolean };

const SINCE: Record<string, string> = {
  today: "Today", days: "A few days", weeks: "A few weeks", months: "A few months", longer: "Longer",
};

function lines(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

/** Save a text file through the browser. */
function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function PatientPreVisit() {
  const nav = useNavigate();
  const { name } = useSession();
  const [include, setInclude] = useState<Include>({ symptoms: true, meds: true, questions: true });
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [latest, setLatest] = useState<Submission | null | undefined>(undefined);
  // The last summary sent, and whether anyone on the team has read it yet.
  const [lastSent, setLastSent] = useState<Submission | null>(null);

  function load() {
    if (!isLive()) { setLatest(null); return; }
    api.get<{ submissions: Submission[] }>("/api/v1/patient/submissions")
      .then((r) => {
        setLatest(r.submissions.find((s) => s.kind === "symptoms") ?? null);
        setLastSent(r.submissions.find((s) => s.kind === "previsit") ?? null);
      })
      .catch(() => setLatest(null));
  }
  useEffect(load, []);

  const today = dateLabel(new Date().toISOString());
  const changes = latest ? lines(latest.describe) : [];
  const started = latest
    ? [
        latest.since ? `${t("Started")}: ${t(SINCE[latest.since] ?? latest.since)}.` : "",
        latest.gettingWorse === true ? t("Getting worse: yes.") : latest.gettingWorse === false ? t("Getting worse: no.") : "",
      ].filter(Boolean).join(" ")
    : "";
  const meds = latest ? lines(latest.medications) : [];
  const questions = latest?.questions ?? [];
  const nothingIncluded = !latest || !Object.values(include).some(Boolean);

  function summaryText(): string {
    const out = [t("Summary for {name}", { name }), t("Prepared {date} · to be reviewed by a clinician", { date: today }), ""];
    if (include.symptoms) out.push(t("What has changed"), ...changes.map((c) => `- ${c}`), started, "");
    if (include.meds) {
      out.push(t("What I am taking"), ...(meds.length ? meds.map((m) => `- ${m}`) : [`- ${t("Nothing recorded")}`]));
      if (latest?.missedDoses) out.push(`- ${t("I have missed some doses recently")}`);
      out.push("");
    }
    if (include.questions && questions.length) out.push(t("Questions I want to ask"), ...questions.map((q, i) => `${i + 1}. ${q}`), "");
    out.push(t("This is a record of what the patient reported in their own words. It is not a clinical assessment and contains no model output."));
    return out.join("\n");
  }

  function download() {
    downloadText(`pre-visit-summary-${new Date().toISOString().slice(0, 10)}.txt`, summaryText());
    setToast(t("Summary downloaded"));
  }

  /** Send what is on screen, section by section as the patient left them switched on. */
  async function send() {
    const changed: string[] = [];
    if (include.symptoms) changed.push(...changes, started);
    if (include.meds && meds.length) changed.push(`${t("What I am taking")}: ${meds.join("; ")}`);
    setSending(true);
    const message = await act(
      () => api.post("/api/v1/patient/previsit", {
        visit_with: t("My care team"),
        questions: include.questions ? questions : [],
        changes_since_last: changed.filter(Boolean).join("\n").slice(0, 2000) || null,
        medications_changed: Boolean(latest?.missedDoses),
      }),
      () => t("Sent to your care team"),
    );
    setSending(false);
    setToast(message);
    load();
  }

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("Ready to share")}
        title={t("Your summary")}
        lede={t("One page to hand to your doctor or nurse. Print it, or just show them this screen.")}
        meta={<Badge tone="neutral">{t("Prepared {date}", { date: today })}</Badge>}
        actions={
          <>
            <Button icon={<DownloadIcon size={16} />} disabled={nothingIncluded} onClick={download}>{t("Download")}</Button>
            <Button variant="primary" icon={<SendIcon size={16} />} disabled={nothingIncluded || sending} onClick={() => void send()}>
              {sending ? t("Sending…") : t("Send to my team")}
            </Button>
          </>
        }
      />

      {latest === undefined ? (
        <p className="muted">{t("Loading your answers…")}</p>
      ) : latest === null ? (
        <Card title={t("Nothing to summarise yet")}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7 }}>
            {t("Your summary is made from what you tell us. Answer a few questions about how you are feeling first, and it will appear here.")}
          </p>
          <Button variant="primary" onClick={() => nav("/patient/intake")}>{t("Tell us how you feel")}</Button>
        </Card>
      ) : (
        <>
          <Card title={t("What to include")} subtitle={t("Turn anything off that you would rather not share")}>
            <Toggle checked={include.symptoms} onChange={(v) => setInclude({ ...include, symptoms: v })} label={t("What has changed")} hint={t("The things you told us about how you have been feeling.")} />
            <Toggle checked={include.meds} onChange={(v) => setInclude({ ...include, meds: v })} label={t("What you are taking")} hint={t("Including the ones you were not sure about — those are often the most useful.")} />
            <Toggle checked={include.questions} onChange={(v) => setInclude({ ...include, questions: v })} label={t("Your questions")} hint={t("So you do not forget them when you are put on the spot.")} />
          </Card>

          <Card
            title={<span className="row" style={{ gap: 8 }}><FileIcon size={18} /> {t("Summary for {name}", { name })}</span>}
            subtitle={t("From your answers on {date}", { date: dateLabel(latest.submittedAt) })}
            footnote={t("This is a record of what the patient reported in their own words. It is not a clinical assessment and contains no model output.")}
          >
            {include.symptoms && (
              <section>
                <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>{t("What has changed")}</h3>
                <ul className="qa-list">
                  {changes.map((c) => <li key={c}><CheckIcon size={16} /> {c}</li>)}
                </ul>
                {started && <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>{started}</p>}
              </section>
            )}

            {include.meds && (
              <section>
                <h3 style={{ fontSize: 16, margin: "18px 0 8px" }}>
                  <span className="row" style={{ gap: 7 }}><PillIcon size={16} /> {t("What I am taking")}</span>
                </h3>
                {meds.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t("Nothing recorded")}</p>
                ) : (
                  <ul className="qa-list">
                    {meds.map((m) => <li key={m}><PillIcon size={16} /> <span>{m}</span></li>)}
                  </ul>
                )}
                {latest.missedDoses && <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>{t("I have missed some doses recently")}</p>}
              </section>
            )}

            {include.questions && questions.length > 0 && (
              <section>
                <h3 style={{ fontSize: 16, margin: "18px 0 8px" }}>{t("Questions I want to ask")}</h3>
                <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 15.5, lineHeight: 1.8 }}>
                  {questions.map((q) => <li key={q}>{q}</li>)}
                </ol>
              </section>
            )}
          </Card>
        </>
      )}

      {lastSent && (
        <Card title={t("What happens to what you send")}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7 }}>
            {t("Sent {date}", { date: dateLabel(lastSent.submittedAt) })}
            {" · "}
            {lastSent.seenAt
              ? <strong>{t("Seen by {name} on {date}", { name: lastSent.seenBy ?? "", date: dateLabel(lastSent.seenAt) })}</strong>
              : <strong>{t("Not seen yet")}</strong>}
          </p>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6 }}>
            {t("A member of your care team reads it. It is never turned into a score and does not change any result. If it matters, your doctor will talk to you about it.")}
          </p>
        </Card>
      )}

      <Banner tone="accent" icon={<ShieldIcon size={18} />} title={t("Who sees this")}>
        {t("Only you, and whoever you show it to. Sending it to your care team adds it to your record. It is not shared with anyone else, and it is not used to make any decision on its own.")}
      </Banner>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Button onClick={() => nav("/patient/intake")}>{t("Change my answers")}</Button>
        <Button onClick={() => nav("/patient/home")}>{t("Back to my health")}</Button>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
