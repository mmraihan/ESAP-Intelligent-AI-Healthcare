/**
 * Screen P5 — My Results (§13.3, §13.6).
 *
 * The release-gate screen. Nothing here is generated for the patient: every
 * item was read by a named clinician who then wrote the summary. The gate has
 * a visible state, so a patient waiting on a result knows it exists and is
 * being reviewed rather than wondering whether they are being kept from it.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RELEASED_RESULTS } from "@/mock/db";
import { ago, dateLabel } from "@/lib/format";
import { t } from "@/i18n";
import { Badge, Banner, Button, Card, PageHeader, cx } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { RequestDialog, type RequestSpec } from "./RequestDialog";
import {
  AlertIcon, CheckIcon, ClockIcon, HeartPulseIcon, LockIcon, SendIcon, StethoscopeIcon, UsersIcon,
} from "@/components/ui/icons";

/** §13.6 — the gate a result passes through before a patient can see it. */
type GateStep = { key: string; label: string; done: boolean; who: string };

/** The gate a released summary went through, from the summary's own record. */
function releasedGate(r: { releasedBy: string; releasedAt: string }): GateStep[] {
  return [
    { key: "run", label: "Assessment run", done: true, who: "At admission" },
    { key: "review", label: "Read by a clinician", done: true, who: r.releasedBy },
    { key: "written", label: "Summary written for you", done: true, who: r.releasedBy },
    { key: "released", label: "Released to you", done: true, who: dateLabel(r.releasedAt) },
  ];
}

const PENDING_GATE: GateStep[] = [
  { key: "run", label: "Assessment run", done: false, who: "—" },
  { key: "review", label: "Read by a clinician", done: false, who: "Waiting for your care team" },
  { key: "written", label: "Summary written for you", done: false, who: "—" },
  { key: "released", label: "Released to you", done: false, who: "—" },
];

/** Fixed step text translates; names and dates are shown as written. */
const TRANSLATED_WHO = new Set(["At admission", "Waiting for your care team"]);
function gateWho(who: string): string {
  return TRANSLATED_WHO.has(who) ? t(who) : who;
}

function Gate({ steps }: { steps: GateStep[] }) {
  return (
    <ul className="gate-list">
      {steps.map((g) => (
        <li key={g.key} className={cx(g.done && "is-done")}>
          <span className="gate-dot">{g.done ? <CheckIcon size={13} /> : null}</span>
          <div>
            <strong>{t(g.label)}</strong>
            <span>{gateWho(g.who)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PatientResults() {
  const nav = useNavigate();
  const [toast, setToast] = useState<string | null>(null);
  const [request, setRequest] = useState<RequestSpec | null>(null);

  return (
    <div className="plain">
      <PageHeader
        eyebrow={t("My results")}
        title={t("What your care team has shared")}
        lede={t("Everything here was read by a member of your team, who then wrote the summary in their own words. You are never shown a raw score from a computer.")}
      />

      <Banner tone="accent" icon={<LockIcon size={18} />} title={t("Why you see a summary rather than a number")}>
        {t("The tool your team uses produces probabilities — numbers like “31%” that compare you with many past hospital stays. On their own those numbers mislead: they describe a group, not you, and they say nothing about how you are actually doing. So your clinician reads them, combines them with what they know about you, and writes you something true.")}
      </Banner>

      {RELEASED_RESULTS.length === 0 && (
      <Card
        title={t("Nothing has been shared with you yet")}
        subtitle={t("Your care team reviews every result before it reaches you")}
        actions={<Badge tone="warning" icon={<ClockIcon size={12} />}>{t("With your care team")}</Badge>}
        footnote={t("If this has been waiting a long time and nobody has spoken to you about it, ask your nurse. You are entitled to chase it.")}
      >
        <Gate steps={PENDING_GATE} />
        <Button onClick={() => setRequest({
          kind: "result_explain_request", ref: "pending assessment",
          title: t("Ask my nurse about this"),
          label: t("What would you like to know?"),
          initial: t("Could someone let me know when my result will be reviewed?"),
          done: t("Your nurse has been notified that you asked"),
        })} icon={<SendIcon size={15} />}>
          {t("Ask my nurse about this")}
        </Button>
      </Card>
      )}

      {RELEASED_RESULTS.map((r, i) => (
        <Card
          key={r.id}
          title={t(r.headline)}
          subtitle={t("Written by {name} · {date} · {when}", { name: r.releasedBy, date: dateLabel(r.releasedAt), when: ago(r.releasedAt) })}
          actions={<Badge tone="good" icon={<CheckIcon size={12} />}>{t("Reviewed and released")}</Badge>}
        >
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.75 }}>{t(r.plainLanguage)}</p>

          <section>
            <h3 style={{ fontSize: 16, margin: "8px 0" }}>
              <span className="row" style={{ gap: 7 }}><HeartPulseIcon size={16} /> {t("What this means for you")}</span>
            </h3>
            <ul className="qa-list">
              {r.whatThisMeans.map((w) => <li key={w}><CheckIcon size={16} /> {t(w)}</li>)}
            </ul>
          </section>

          <section>
            <h3 style={{ fontSize: 16, margin: "14px 0 8px" }}>
              <span className="row" style={{ gap: 7 }}><StethoscopeIcon size={16} /> {t("Good questions to ask")}</span>
            </h3>
            <ul className="qa-list">
              {r.questionsToAsk.map((q) => <li key={q}><span style={{ fontWeight: 700 }}>{t("?")}</span> {t(q)}</li>)}
            </ul>
          </section>

          {i === 0 && (
            <>
              <h3 style={{ fontSize: 16, margin: "14px 0 8px" }}>{t("How this reached you")}</h3>
              <Gate steps={releasedGate(r)} />
            </>
          )}

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => nav("/patient/care-team")} icon={<UsersIcon size={15} />}>{t("Who wrote this")}</Button>
            <Button onClick={() => setRequest({
              kind: "result_question", ref: r.headline,
              title: t("Ask a question about it"),
              label: t("Your question"),
              done: t("Your question has been sent to your care team"),
            })} icon={<SendIcon size={15} />}>{t("Ask a question about it")}</Button>
          </div>
        </Card>
      ))}

      <Card title={t("If something here does not sound right")}>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75 }}>
          {t("Say so. A summary that does not match how you feel, or that describes someone else’s situation, is something your team needs to know about immediately — it may be a mistake in the record rather than a difference of opinion. Tell your nurse, or use the button on any summary above.")}
        </p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={() => setRequest({
            kind: "result_urgent_flag", ref: RELEASED_RESULTS[0]?.headline,
            title: t("This does not describe me"),
            label: t("What is wrong with it?"),
            hint: t("Your team treats this as urgent: it may be someone else's record."),
            done: t("Flagged for your care team to review urgently"),
          })} icon={<AlertIcon size={15} />}>
            {t("This does not describe me")}
          </Button>
        </div>
      </Card>

      <RequestDialog spec={request} onClose={() => setRequest(null)} onResult={setToast} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
