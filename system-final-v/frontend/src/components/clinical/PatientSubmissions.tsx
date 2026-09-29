/**
 * "From the patient" — what the patient sent from the portal (§13.3).
 *
 * Symptom reports and pre-visit summaries, in the patient's own words. They
 * are context for the care team, never a model input: sent after t₀ and
 * unreviewed, so nothing here moves an estimate. If something belongs on the
 * intake, the clinician puts it there and re-runs the assessment.
 */
import { useEffect, useState, type ReactNode } from "react";
import { ago, dateTimeLabel } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { CheckIcon, MailIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";

export type PatientSubmission = {
  id: string;
  kind: "symptoms" | "previsit" | "message";
  submittedAt: string;
  describe?: string;
  // message kind (a care-team message / result question the patient raised)
  messageKind?: string;
  messageLabel?: string;
  ref?: string | null;
  urgent?: boolean;
  requestStatus?: string;
  since?: string | null;
  severity?: number | null;
  gettingWorse?: boolean | null;
  missedDoses?: boolean | null;
  concerns?: string[];
  medications?: string | null;
  questions?: string[];
  visitWith?: string;
  changesSinceLast?: string | null;
  medicationsChanged?: boolean;
  seenAt?: string;
  seenBy?: string;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd style={{ whiteSpace: "pre-wrap" }}>{children}</dd>
    </>
  );
}

export function PatientSubmissions({ encounterId, onToast, canRespond = true }: { encounterId: string; onToast: (m: string) => void; canRespond?: boolean }) {
  const [subs, setSubs] = useState<PatientSubmission[] | null>(null);
  const [linked, setLinked] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isLive()) { setSubs([]); return; }
    api.get<{ submissions: PatientSubmission[]; portal_linked: boolean }>(`/api/v1/encounters/${encounterId}/patient-submissions`)
      .then((r) => { setSubs(r.submissions); setLinked(r.portal_linked); })
      .catch(() => setSubs([]));
  }, [encounterId]);

  async function markSeen(s: PatientSubmission) {
    const message = await act(
      () => api.post<PatientSubmission>(`/api/v1/encounters/${encounterId}/patient-submissions/${s.id}/seen`),
      (updated) => {
        setSubs((all) => (all ?? []).map((x) => (x.id === updated.id ? updated : x)));
        return `Marked as seen — the patient's portal now shows it was read by ${updated.seenBy}`;
      },
    );
    onToast(message);
  }

  const unseen = (subs ?? []).filter((s) => s.kind !== "message" && !s.seenAt).length;

  return (
    <Card
      title={<span className="row" style={{ gap: 7 }}><MailIcon size={16} /> From the patient</span>}
      subtitle={subs === null ? "Loading…" : !linked ? "This patient has no portal account" : `${subs.length} sent · ${unseen} not yet seen`}
      actions={<Badge tone="neutral">Patient-reported · not used by any model</Badge>}
      footnote="Sent from the patient portal after admission, in their own words. Nothing here changes an estimate. If it matters clinically, add it to the intake and run the assessment again."
    >
      {subs && subs.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {linked ? "Nothing has been sent from the portal." : "Submissions appear here once the patient is linked to a portal account."}
        </p>
      ) : (
        <ul className="watch-list">
          {(subs ?? []).map((s) => (
            <li key={s.id} style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>
                    {s.kind === "symptoms" ? "Symptom report" : s.kind === "previsit" ? "Pre-visit summary" : (s.messageLabel ?? "Message")}
                  </strong>
                  <span className="muted" style={{ fontSize: 12 }} title={dateTimeLabel(s.submittedAt)}>sent {ago(s.submittedAt)}</span>
                  {s.kind === "symptoms" && s.gettingWorse && <span className="pill pill-warning">getting worse</span>}
                  {s.kind === "message" && s.urgent && <span className="pill pill-critical">urgent</span>}
                  {s.kind === "message"
                    ? <span className={`pill ${s.requestStatus === "closed" ? "pill-neutral" : "pill-warning"}`}>{s.requestStatus === "closed" ? "handled" : s.requestStatus === "in_progress" ? "in progress" : "open"}</span>
                    : s.seenAt
                      ? <span className="pill pill-neutral"><CheckIcon size={11} /> seen by {s.seenBy}</span>
                      : <span className="pill pill-warning">not yet seen</span>}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {s.kind === "symptoms"
                    ? s.describe
                    : s.kind === "message"
                      ? <>{s.ref ? <span className="muted">To {s.ref}: </span> : null}{s.describe}</>
                      : (s.changesSinceLast || (s.questions?.length ? `${s.questions.length} question(s)` : "—"))}
                </p>
                {open === s.id && (
                  <dl className="kv" style={{ marginTop: 8 }}>
                    {s.kind === "symptoms" ? (
                      <>
                        {s.since && <Row label="Since">{s.since}</Row>}
                        {s.severity !== null && s.severity !== undefined && <Row label="Severity (0–10)">{s.severity}</Row>}
                        {s.gettingWorse !== null && s.gettingWorse !== undefined && <Row label="Getting worse">{s.gettingWorse ? "Yes" : "No"}</Row>}
                        {s.missedDoses !== null && s.missedDoses !== undefined && <Row label="Missed doses">{s.missedDoses ? "Yes" : "No"}</Row>}
                        {!!s.concerns?.length && <Row label="Concerns">{s.concerns.join(", ")}</Row>}
                        {s.medications && <Row label="Taking">{s.medications}</Row>}
                      </>
                    ) : (
                      <>
                        {s.changesSinceLast && <Row label="What has changed">{s.changesSinceLast}</Row>}
                        <Row label="Medicines changed">{s.medicationsChanged ? "Yes" : "No"}</Row>
                      </>
                    )}
                    {!!s.questions?.length && <Row label="Questions">{s.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}</Row>}
                    {s.seenAt && <Row label="Seen">{`${s.seenBy} · ${dateTimeLabel(s.seenAt)}`}</Row>}
                  </dl>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {s.kind !== "message" && <Button size="sm" variant="ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Less" : "Read"}</Button>}
                {s.kind !== "message" && !s.seenAt && canRespond && <Button size="sm" icon={<CheckIcon size={13} />} onClick={() => void markSeen(s)}>Mark seen</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
