/**
 * D3 — Results (§12.3.3), with D4 Why panel, D5 next-best-test, D6 chat.
 *
 * This is the screen the whole product exists to render. Its job is to make the
 * estimate reviewable, not persuasive: the number, what moved it, what it does
 * not cover, and what the clinician did about it.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { SOURCE, encounterById, MODELS } from "@/mock/db";
import { ApiError, api } from "@/api/client";
import { ago, dateTimeLabel } from "@/lib/format";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  AcknowledgeBar, ChatPanel, DifferentialCard, EncounterHeader, ExplanationDrawer, LosCard,
  RiskRow, SignalRail, type RiskSlot,
} from "@/components/clinical";
import { AssistiveLine, FusionPill } from "@/components/ui/domain";
import { PatientSubmissions } from "@/components/clinical/PatientSubmissions";
import { Badge, Banner, Button, Card, EmptyState, Field, Select, Tabs, TextArea, TextInput } from "@/components/ui/primitives";
import { Modal, Toast } from "@/components/ui/overlays";
import { BookIcon, CheckIcon, ClockIcon, DownloadIcon, GlobeIcon, SendIcon, SparkIcon, StethoscopeIcon } from "@/components/ui/icons";
import { act, actAndRefresh, requestExport, requestRecordTransfer } from "@/api/actions";
import { hydrateFromApi } from "@/api/bootstrap";
import { toContributors, useAssessments, type ApiExplanation } from "@/hooks/useAssessments";
import { useSettings } from "@/hooks/useSettings";

/** Model id → the key its outcome has on an AssessResponse. */
const OUTCOME_KEY = { "M-02": "mortality", "M-03": "icu", "M-04": "readmission" } as const;

export function ResultsPage({ readOnly }: { readOnly?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { role, requireResidentCosign } = useSession();
  const enc = encounterById(id ?? "");
  const [explain, setExplain] = useState<{ kind: "model" | "ccsr"; key: string } | null>(null);
  const [chat, setChat] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nbt, setNbt] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [release, setRelease] = useState({ headline: "", plain: "", means: "", questions: "" });
  const [transferring, setTransferring] = useState(false);
  const [transfer, setTransfer] = useState({ counterparty: "", consentBasis: "treatment", note: "" });
  // What the models actually returned for this patient, and the display policy.
  const { latest } = useAssessments(enc?.id);
  const { settings: display } = useSettings("model_display", { readmissionAlertThreshold: 0.28 });

  if (!enc) return <Navigate to="/doctor/worklist" replace />;

  const assessed = enc.state !== "intake_in_progress" && enc.state !== "awaiting_assessment";
  const m04 = MODELS.find((m) => m.id === "M-04");
  const coldStart = m04?.strata.find((s) => /cold/i.test(s.label));
  const alertAt = Number(display.readmissionAlertThreshold) || 0.28;
  const diffItems = latest?.response.differential.result?.items ?? [];

  /** The explanation the model returned for whatever the clinician asked about. */
  const explanation: ApiExplanation | null = !explain || !latest
    ? null
    : explain.kind === "ccsr"
      ? diffItems.find((i) => i.ccsr === explain.key)?.explanation ?? null
      : latest.response[OUTCOME_KEY[explain.key as keyof typeof OUTCOME_KEY]]?.explanation ?? null;

  // A tenant-wide OR per-unit "Settings → Model display" suppression comes back
  // on the outcome itself (status:"suppressed") — surfaced here rather than
  // left as a bare blank gauge, per §11.4.7: "a hidden model is never silently
  // hidden."
  const suppressedStatus = (o?: { status: string; reason?: string | null }): RiskSlot["status"] | undefined =>
    o?.status === "suppressed" ? "suppressed" : undefined;
  const slots: RiskSlot[] = [
    { modelId: "M-02", label: "In-hospital mortality", probability: enc.risks.mortality, calibrated: enc.calibrated, status: suppressedStatus(latest?.response.mortality), reason: latest?.response.mortality.reason },
    { modelId: "M-03", label: "ICU admission", probability: enc.risks.icu, calibrated: enc.calibrated, status: suppressedStatus(latest?.response.icu), reason: latest?.response.icu.reason },
    { modelId: "M-04", label: "30-day readmission", probability: enc.risks.readmission, calibrated: enc.calibrated, threshold: alertAt, flag: (enc.risks.readmission ?? 0) > alertAt, status: suppressedStatus(latest?.response.readmission) ?? (m04?.status === "degraded" ? "degraded" : undefined), reason: latest?.response.readmission.reason },
  ];

  const canAck = !readOnly && can(role, "assess:run") && role !== "pharmacist";
  const needsCosign = role === "resident" && requireResidentCosign;

  const explainTitle =
    explain?.kind === "model"
      ? `Why ${slots.find((s) => s.modelId === explain.key)?.label ?? explain.key}?`
      : `Why ${enc.topDifferential.find((d) => d.ccsr === explain?.key)?.name ?? "this condition"}?`;

  /**
   * Record the review on the server, so it lands in the audit log and the
   * encounter's state actually moves. Whether it needs a co-sign is the
   * server's answer, not the client's guess — `cosign` in the §4.6 matrix is an
   * access grade, and a resident's acknowledgement is not complete without one.
   */
  async function acknowledge(note: string) {
    if (!enc) return;
    if (SOURCE.current.kind !== "api") {
      setToast("Not saved — the ESAP server cannot be reached");
      return;
    }
    try {
      const result = await api.post<{ requires_cosign: boolean }>(
        `/api/v1/encounters/${enc.id}/acknowledge`,
        { note: note || null },
      );
      setToast(
        result.requires_cosign
          ? "Submitted to the attending for co-sign"
          : "Review recorded and written to the audit log",
      );
      // The encounter's state moved on the server; show it here too.
      await hydrateFromApi().catch(() => undefined);
    } catch (error) {
      setToast(error instanceof ApiError ? error.message : "Could not reach the ESAP API.");
    }
  }

  /**
   * Release a plain-language summary to the patient portal (§13.6). What the
   * patient receives is this text — the server never forwards a probability.
   */
  function submitRelease() {
    if (!enc) return;
    const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 10);
    setReleasing(false);
    void actAndRefresh(
      () => api.post(`/api/v1/encounters/${enc.id}/release`, {
        headline: release.headline.trim(), plain_language: release.plain.trim(),
        what_this_means: lines(release.means), questions_to_ask: lines(release.questions),
      }),
      () => `Summary released to ${enc.patient.name}'s portal — logged as result.release`,
    ).then(setToast);
  }
  const canRelease = canAck && assessed;

  return (
    <>
      <EncounterHeader
        enc={enc}
        actions={
          <div className="row" style={{ gap: 8 }}>
            {enc.releasedToPatient && <Badge tone="good" icon={<CheckIcon size={11} />}>Released to patient</Badge>}
            {canRelease && <Button size="sm" icon={<SendIcon size={14} />} onClick={() => setReleasing(true)}>Release to patient</Button>}
            {can(role, "chat:use") && <Button size="sm" icon={<SparkIcon size={14} />} onClick={() => setChat(true)}>Ask</Button>}
            {can(role, "transfer:initiate") && <Button size="sm" icon={<GlobeIcon size={14} />} onClick={() => setTransferring(true)}>Request record from elsewhere</Button>}
            {can(role, "export:phi") && <Button size="sm" icon={<DownloadIcon size={14} />} onClick={() => void requestExport("encounter_summary", "Clinical review export from the results screen", { encounter_id: enc.id }).then(setToast)}>Export</Button>}
          </div>
        }
      />

      <Tabs
        value="results"
        onChange={(v) => {
          if (v === "intake") nav(`/doctor/encounters/${enc.id}/intake`);
          if (v === "timeline") nav(`/doctor/encounters/${enc.id}/timeline`);
          if (v === "history") nav(`/doctor/encounters/${enc.id}/history`);
        }}
        tabs={[
          { value: "results", label: "Results" },
          { value: "intake", label: "Intake" },
          { value: "timeline", label: "Timeline" },
          { value: "history", label: "History", count: enc.assessmentCount },
        ]}
      />

      {!!enc.escalations?.length && (
        <Banner tone="critical" title={`Escalated to ${enc.escalations[enc.escalations.length - 1].to}`}>
          {enc.escalations.slice().reverse().map((e, i) => (
            <p key={i} style={{ margin: i ? "6px 0 0" : 0 }}>
              <strong>{e.urgency}</strong> · by {e.by}, {ago(e.at)} — {e.reason}
            </p>
          ))}
        </Banner>
      )}

      {!assessed ? (
        <EmptyState
          icon={<StethoscopeIcon size={20} />}
          title="Not assessed yet"
          message="The intake for this encounter is still incomplete, so no model has run. Complete the required fields and the five models will run against the admission-time cut."
          action={<Button variant="primary" onClick={() => nav(`/doctor/encounters/${enc.id}/intake`)}>Go to intake</Button>}
        />
      ) : (
        <>
          {enc.calibrationValidity === "reduced" && (
            <Banner tone="warning" title="Calibration is reduced for this case">
              Required inputs were imputed. The ordering of conditions is still usable, but the absolute
              probabilities should not be read as calibrated, and the Calibrated badge is suppressed
              everywhere on this page.
            </Banner>
          )}

          <p className="result-meta">
            <ClockIcon size={13} /> Assessed {enc.lastAssessedAt ? ago(enc.lastAssessedAt) : "—"} ·{" "}
            {enc.lastAssessedAt ? dateTimeLabel(enc.lastAssessedAt) : ""} · run {enc.assessmentCount} of {enc.assessmentCount}{" "}
            <FusionPill status="tower_a_only" />
          </p>

          <RiskRow slots={slots} onExplain={(k) => setExplain({ kind: "model", key: k })} />

          {(enc.risks.readmission ?? 0) > alertAt && m04?.status === "degraded" && coldStart && (
            <Banner tone="warning" title="M-04 is serving degraded">
              {coldStart.label}: AUROC {coldStart.value.toFixed(3)}. On a patient with no prior
              admissions this estimate is close to chance and should not carry weight on its own.{" "}
              <Link to="/models">See the model basis</Link>.
            </Banner>
          )}

          <div className="split">
            <div className="stack" style={{ gap: 18 }}>
              <DifferentialCard
                items={enc.topDifferential.map((d) => ({
                  ...d,
                  unconfirmed: Boolean(diffItems.find((i) => i.ccsr === d.ccsr)?.from_unconfirmed_extraction),
                }))}
                calibrationValidity={enc.calibrationValidity}
                onExplain={(c) => setExplain({ kind: "ccsr", key: c })}
                unscored={latest?.response.differential.result?.unscored_ccsr_count ?? 0}
              />

              <Card
                title="Next best test"
                subtitle="Phase 3 — designed, not yet built"
                actions={<Button size="sm" onClick={() => setNbt((v) => !v)}>{nbt ? "Hide" : "What is this?"}</Button>}
                footnote="This panel is reserved so the layout does not shift when value-of-information lands. It shows nothing today because nothing has been computed."
              >
                {nbt ? (
                  <p className="prose" style={{ margin: 0 }}>
                    Value-of-information ranks which single missing input would most reduce uncertainty in
                    these estimates — typically a specific lab rather than a panel. It is specified in
                    §18.5 and is deliberately absent rather than approximated: a suggested test that is
                    not computed from the model would read as clinical advice the software cannot support.
                  </p>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>No recommendation is available for this encounter.</p>
                )}
              </Card>
            </div>

            <div className="stack" style={{ gap: 18 }}>
              <LosCard
                low={enc.risks.losLow}
                high={enc.risks.losHigh}
                lowSignal={enc.signalCompleteness < 0.45}
              />
              <SignalRail enc={enc} />
              <Card title="How to read this" subtitle="Every card, one rule">
                <ul className="caveat-list">
                  <li><BookIcon size={13} /> A probability is a population rate for admissions that look like this one. It is never a statement about this individual.</li>
                  <li><BookIcon size={13} /> Colour encodes magnitude on one blue ramp — it is never a red/amber/green verdict, on purpose.</li>
                  <li><BookIcon size={13} /> Every estimate uses admission-time data only. It cannot know how the patient has responded since.</li>
                  <li><BookIcon size={13} /> You are the decision-maker. Acknowledging records that you reviewed it, not that you agreed with it.</li>
                </ul>
              </Card>
            </div>
          </div>

          <AcknowledgeBar
            enc={enc}
            canAcknowledge={canAck}
            requiresCosign={needsCosign}
            onAcknowledge={(note) => void acknowledge(note)}
            onEscalate={() => void act(() => api.post(`/api/v1/encounters/${enc.id}/escalate`, { to: "Attending on call", reason: "Escalated from the results review", urgency: "urgent" }), () => "Escalated to the attending on call").then(setToast)}
          />
        </>
      )}

      <PatientSubmissions encounterId={enc.id} onToast={setToast} canRespond={role !== "auditor"} />

      <AssistiveLine />

      <ExplanationDrawer
        open={explain !== null}
        onClose={() => setExplain(null)}
        title={explainTitle}
        subtitle={`${enc.patient.name} · ${enc.patient.mrn} · t₀ ${dateTimeLabel(enc.t0)}`}
        method={explanation?.method ?? "exact-linear"}
        basis={explanation?.basis ?? "No explanation was returned for this estimate."}
        contributors={toContributors(explanation)}
        caveats={explanation?.caveats ?? []}
        rationale={explanation?.rationale?.text}
        reconstructionOk={explanation?.reconstruction_ok ?? undefined}
      />

      <ChatPanel open={chat} onClose={() => setChat(false)} enc={enc} />

      <Modal
        open={releasing}
        onClose={() => setReleasing(false)}
        title="Release a summary to the patient"
        subtitle={`${enc.patient.name} · ${enc.patient.mrn}`}
        size="lg"
        footer={
          <>
            <Button onClick={() => setReleasing(false)}>Cancel</Button>
            <Button variant="primary" icon={<SendIcon size={14} />} disabled={!release.headline.trim() || !release.plain.trim()} onClick={submitRelease}>Release</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Banner tone="accent" title="The patient sees your words, never a score">
            No probability, percentile or model output crosses to the portal. Write what you would say
            at the bedside. The release is logged against your name.
          </Banner>
          <Field label="Headline" required>
            <TextInput value={release.headline} maxLength={300} onChange={(e) => setRelease({ ...release, headline: e.target.value })} placeholder="What we found when you were admitted" />
          </Field>
          <Field label="In plain language" required hint="Short sentences. No abbreviations the patient would have to look up.">
            <TextArea rows={5} maxLength={4000} value={release.plain} onChange={(e) => setRelease({ ...release, plain: e.target.value })} />
          </Field>
          <Field label="What this means for you" hint="One point per line (up to 10).">
            <TextArea rows={3} value={release.means} onChange={(e) => setRelease({ ...release, means: e.target.value })} />
          </Field>
          <Field label="Questions you might want to ask" hint="One per line (up to 10).">
            <TextArea rows={3} value={release.questions} onChange={(e) => setRelease({ ...release, questions: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={transferring}
        onClose={() => setTransferring(false)}
        title="Request this patient's record from another hospital"
        subtitle={`${enc.patient.name} · ${enc.patient.mrn}`}
        footer={
          <>
            <Button onClick={() => setTransferring(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<GlobeIcon size={14} />}
              disabled={transfer.counterparty.trim().length < 2}
              onClick={() => {
                setTransferring(false);
                void requestRecordTransfer(
                  enc.patient.mrn, enc.patient.name, transfer.counterparty.trim(),
                  transfer.consentBasis, transfer.note.trim(),
                ).then((m) => { setToast(m); setTransfer({ counterparty: "", consentBasis: "treatment", note: "" }); });
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 14 }}>
          <Banner tone="accent" title="This starts an identity-matched request, not an instant pull">
            It lands in the queue the Hospital Admin works, alongside every other cross-organisation
            request, and needs a match confirmation before anything arrives.
          </Banner>
          <Field label="Organisation holding the record" required>
            <TextInput value={transfer.counterparty} maxLength={160} onChange={(e) => setTransfer({ ...transfer, counterparty: e.target.value })} placeholder="e.g. Riverside Medical Center" />
          </Field>
          <Field label="Consent basis" required>
            <Select value={transfer.consentBasis} onChange={(e) => setTransfer({ ...transfer, consentBasis: e.target.value })}>
              <option value="treatment">Treatment</option>
              <option value="patient_request">Patient request</option>
              <option value="continuity_of_care">Continuity of care</option>
            </Select>
          </Field>
          <Field label="Note for the other organisation" hint="Optional.">
            <TextArea rows={3} maxLength={500} value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
