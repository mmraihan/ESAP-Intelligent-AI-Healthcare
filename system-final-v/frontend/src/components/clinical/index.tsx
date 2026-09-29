/**
 * Clinical surfaces shared by the doctor and nurse workspaces.
 *
 * The safety rules encoded here are not styling choices:
 *  - Every probability prints its number and a population phrase, never a
 *    colour alone (§14.3.3).
 *  - Calibration state is always visible, and "calibration reduced" hard-
 *    suppresses the Calibrated badge (§3.1 of the API contract).
 *  - Every explanation names its method and says what it is not — the drivers
 *    are computed from the model, never narrated by an LLM (EXPLAINABILITY.md).
 *  - Audit covariates are visible only on the fairness surface, never here.
 */
import { MODELS } from "@/mock/db";
import { ApiError, api } from "@/api/client";
import { OFFLINE_NOTICE, isLive } from "@/api/actions";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { familyColorVar } from "@/lib/ccsrFamilies";
import { ago, dateTimeLabel, pct, percentilePhrase, seqToken } from "@/lib/format";
import type { Encounter } from "@/mock/types";
import { BarRows, RiskGauge } from "@/components/ui/charts";
import { Drawer } from "@/components/ui/overlays";
import { AssistiveLine, FusionPill } from "@/components/ui/domain";
import { Badge, Button, Card, Meter, cx } from "@/components/ui/primitives";
import {
  AlertIcon, CheckIcon, ClockIcon, FlaskIcon, InfoIcon, ScaleIcon, SparkIcon, StethoscopeIcon,
} from "@/components/ui/icons";

// --- Patient / encounter header --------------------------------------------

export function EncounterHeader({ enc, actions }: { enc: Encounter; actions?: ReactNode }) {
  return (
    <div className="enc-header">
      <div className="enc-identity">
        <h1 className="page-title">{enc.patient.name}</h1>
        <div className="enc-facts">
          <span className="tnum">{enc.patient.age} {enc.patient.sex}</span>
          <span className="dot" />
          <span className="mono">{enc.patient.mrn}</span>
          <span className="dot" />
          <span>{enc.unitName} · {enc.bed}</span>
          <span className="dot" />
          <span>{enc.admissionType}{enc.viaEd ? " · via ED" : ""}</span>
        </div>
        <p className="enc-complaint">{enc.chiefComplaint}</p>
      </div>
      <div className="enc-side">
        <T0Chip t0={enc.t0} />
        {actions}
      </div>
    </div>
  );
}

/**
 * The t0 chip. Every feature in every model is cut at this instant; showing it
 * on screen is how a clinician knows the estimate did not see anything that
 * happened after admission (§6 guardrail 1).
 */
export function T0Chip({ t0 }: { t0: string }) {
  return (
    <span className="t0-chip" title="All features are cut at t0 = admission time. Nothing recorded after this instant enters any model.">
      <ClockIcon size={13} />
      <span>
        <strong>t₀ {dateTimeLabel(t0)}</strong>
        <span>intake-only cut · {ago(t0)}</span>
      </span>
    </span>
  );
}

// --- Risk readout row -------------------------------------------------------

export type RiskSlot = {
  modelId: string;
  label: string;
  probability: number | null;
  calibrated: boolean;
  threshold?: number;
  flag?: boolean;
  status?: "live" | "degraded" | "stub" | "not_ready" | "suppressed";
  reason?: string | null;
};

export function RiskRow({ slots, onExplain }: { slots: RiskSlot[]; onExplain?: (modelId: string) => void }) {
  return (
    <div className="risk-row">
      {slots.map((s) => (
        <div key={s.modelId} className="risk-slot">
          {s.status === "degraded" && (
            <span className="slot-flag" title="This model is serving at reduced confidence — see Models & basis.">
              <AlertIcon size={12} /> degraded
            </span>
          )}
          {s.status === "suppressed" && (
            <span className="slot-flag" title={s.reason ?? "Turned off for this site or unit in Settings → Model display."}>
              <AlertIcon size={12} /> suppressed
            </span>
          )}
          <RiskGauge
            label={s.label}
            modelId={s.modelId}
            probability={s.probability}
            calibrated={s.calibrated}
            threshold={s.threshold}
            flag={s.flag}
          />
          {onExplain && s.probability !== null && (
            <Button size="sm" variant="ghost" onClick={() => onExplain(s.modelId)}>Why?</Button>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Length of stay ---------------------------------------------------------

/**
 * LOS is a range, not a probability, so it never touches the risk ramp — it
 * gets a neutral accent band and always shows the interval before the point
 * estimate (§14.3.3).
 */
export function LosCard({ low, high, coverage: given, level = 0.95, lowSignal }: {
  low: number | null; high: number | null; coverage?: number; level?: number; lowSignal?: boolean;
}) {
  // Measured coverage from M-05's evaluation of record, unless the caller has a better figure.
  const coverage = given ?? (Number(MODELS.find((m) => m.id === "M-05")?.headline[0]?.value) || level);
  if (low === null || high === null) {
    return (
      <Card title="Expected length of stay" subtitle="M-05">
        <p className="muted" style={{ margin: 0 }}>Not estimated — this encounter has not been assessed yet.</p>
      </Card>
    );
  }
  const scaleMax = Math.max(14, high + 2);
  return (
    <Card
      title={<span className="row" style={{ gap: 7 }}><ClockIcon size={16} /> Expected length of stay</span>}
      subtitle="M-05 · conformal interval"
      footnote={`Measured coverage ${pct(coverage, 1)} against a nominal ${pct(level, 0)} level. Tail coverage is reduced beyond 14 days.`}
    >
      <p className="los-value tnum">
        {low}–{high} <span className="los-unit">days</span>
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        {pct(level, 0)} interval. The interval is the estimate — the midpoint is secondary and should
        not be quoted on its own.
      </p>
      <div className="los-scale">
        <div className="los-track">
          <div
            className="los-band"
            style={{ left: `${(low / scaleMax) * 100}%`, width: `${((high - low) / scaleMax) * 100}%` }}
          />
        </div>
        <div className="los-ticks tnum">
          <span>0</span><span>7</span><span>14</span><span>{scaleMax}+</span>
        </div>
      </div>
      {lowSignal && (
        <p className="inline-warn"><AlertIcon size={13} /> Low signal: few inputs were available, so this interval is wider than usual.</p>
      )}
    </Card>
  );
}

// --- Differential -----------------------------------------------------------

export function DifferentialCard({
  items, fusionStatus = "tower_a_only", calibrationValidity, onExplain, unscored = 0, topN = 20,
}: {
  items: { ccsr: string; name: string; family: string; probability: number; unconfirmed?: boolean }[];
  fusionStatus?: "tower_a_only" | "pending" | "fused";
  calibrationValidity: "full" | "reduced";
  onExplain?: (ccsr: string) => void;
  unscored?: number;
  topN?: number;
}) {
  return (
    <Card
      title={<span className="row" style={{ gap: 7 }}><StethoscopeIcon size={16} /> Likely concurrent conditions</span>}
      subtitle={`M-01 · top ${Math.min(topN, items.length)} of ~502 CCSR categories`}
      actions={<FusionPill status={fusionStatus} />}
      footnote={
        unscored > 0
          ? `${unscored} CCSR categories were not scored for this patient because the required inputs were absent. They are omitted rather than shown as zero.`
          : "Ranked by presence probability. These are conditions that may already be present at admission — not predictions of what will develop."
      }
    >
      {calibrationValidity === "reduced" && (
        <p className="inline-warn">
          <AlertIcon size={13} />
          Calibration is reduced for this case: required inputs were imputed, so the probabilities are
          ordered reliably but their absolute values should not be read as calibrated.
        </p>
      )}
      <BarRows
        rows={items.map((it) => ({
          key: it.ccsr,
          label: (
            <>
              {it.name}
              <span className="mono muted" style={{ fontSize: 11 }}>{it.ccsr}</span>
              {it.unconfirmed && (
                <span className="cal-badge is-flag" title="Extracted from free text and not yet confirmed by a clinician.">
                  <AlertIcon size={10} /> unconfirmed
                </span>
              )}
            </>
          ),
          value: it.probability,
          swatch: familyColorVar(it.family),
          meta: (
            <span className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <span>{it.family}</span>
              <span>· {percentilePhrase(it.probability)}</span>
              {onExplain && (
                <button type="button" className="link-btn" style={{ marginInlineStart: 0 }} onClick={() => onExplain(it.ccsr)}>
                  Why this condition?
                </button>
              )}
            </span>
          ),
        }))}
        max={1}
        colorBy="magnitude"
      />
    </Card>
  );
}

// --- Explanation drawer -----------------------------------------------------

export type Contributor = {
  label: string;
  valueDisplay: string;
  direction: "increases" | "decreases";
  contribution: number;
  fromMissing: boolean;
};

/**
 * The Why panel. §8.8 makes this the load-bearing surface for the FDA
 * non-device-CDS posture: the clinician must be able to independently review
 * the basis, so the method, the inputs and the caveats are all stated.
 */
export function ExplanationDrawer({
  open, onClose, title, subtitle, method, basis, contributors, caveats, rationale, reconstructionOk,
}: {
  open: boolean; onClose: () => void; title: string; subtitle: string;
  method: "exact-linear" | "marginal-occlusion" | "shap";
  basis: string;
  contributors: Contributor[];
  caveats: string[];
  rationale?: string;
  reconstructionOk?: boolean;
}) {
  const maxAbs = Math.max(...contributors.map((c) => Math.abs(c.contribution)), 0.0001);
  const methodLabel =
    method === "exact-linear" ? "Exact linear decomposition"
    : method === "marginal-occlusion" ? "Marginal occlusion (model-agnostic, approximate)"
    : "SHAP";

  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle} width={560}>
      <div className="stack" style={{ gap: 18 }}>
        <div className="note-block">
          <strong>How this was produced.</strong> {methodLabel}.{" "}
          {method === "exact-linear"
            ? "Each contribution is the model's own coefficient times this patient's value; the contributions plus the intercept reconstruct the score exactly."
            : "Each contribution is measured by removing that input and re-scoring. It is a faithful local approximation, not an exact decomposition."}
          {reconstructionOk !== undefined && (
            <>
              {" "}
              <span className={reconstructionOk ? "pill pill-good" : "pill pill-warning"}>
                {reconstructionOk ? <CheckIcon size={12} /> : <AlertIcon size={12} />}
                {reconstructionOk ? "Reconstruction check passed" : "Reconstruction check failed"}
              </span>
            </>
          )}
          <br />
          <span className="muted" style={{ fontSize: 12 }}>Basis: {basis}</span>
        </div>

        <section className="stack" style={{ gap: 10 }}>
          <h3 className="section-title" style={{ fontSize: 14 }}>What moved this estimate</h3>
          <ul className="contrib-list">
            {contributors.map((c) => (
              <li key={c.label}>
                <div className="contrib-head">
                  <span className="contrib-label">
                    {c.label}
                    {c.fromMissing && (
                      <span className="cal-badge" title="This input was absent and was imputed. It still moves the estimate, so it is shown.">
                        imputed
                      </span>
                    )}
                  </span>
                  <span className="contrib-value tnum">{c.valueDisplay}</span>
                </div>
                <div className="contrib-bar">
                  <span className="contrib-axis" />
                  <span
                    className={cx("contrib-fill", c.direction === "increases" ? "is-up" : "is-down")}
                    style={{ width: `${(Math.abs(c.contribution) / maxAbs) * 46}%` }}
                  />
                </div>
                <p className="contrib-note">
                  {c.direction === "increases" ? "Raises" : "Lowers"} the estimate
                  <span className="tnum"> ({c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(3)} on the log-odds scale)</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        {rationale && (
          <section className="stack" style={{ gap: 6 }}>
            <h3 className="section-title" style={{ fontSize: 14 }}>In words</h3>
            <p className="note-block" style={{ margin: 0 }}>{rationale}</p>
            <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>
              This sentence is generated from the computed drivers above. It is a restatement of them,
              not an additional model output, and it can add no information they do not contain.
            </p>
          </section>
        )}

        <section className="stack" style={{ gap: 6 }}>
          <h3 className="section-title" style={{ fontSize: 14 }}>What this does not tell you</h3>
          <ul className="caveat-list">
            {caveats.map((c) => <li key={c}><InfoIcon size={13} /> {c}</li>)}
          </ul>
        </section>

        <AssistiveLine />
      </div>
    </Drawer>
  );
}

// --- Signal completeness ----------------------------------------------------

/**
 * How much of the intake the models actually got. This is the honest answer to
 * "why is this estimate uncertain" and it gates the calibration badge.
 */
export function SignalRail({ enc, compact }: { enc: Encounter; compact?: boolean }) {
  const signals = [
    { key: "demographics", label: "Demographics", present: true, weight: "required" },
    { key: "context", label: "Admission context", present: true, weight: "required" },
    { key: "vitals", label: "Vitals", present: enc.signalCompleteness > 0.4, weight: "recommended" },
    { key: "labs", label: "Early labs", present: enc.signalCompleteness > 0.55, weight: "recommended" },
    { key: "history", label: "Prior history", present: enc.hasPriorHistory, weight: "recommended" },
    { key: "meds", label: "Medications", present: enc.signalCompleteness > 0.6, weight: "optional" },
    { key: "notes", label: "Admission note", present: enc.hasNotes, weight: "optional" },
  ];
  const got = signals.filter((s) => s.present).length;

  return (
    <Card
      title="Signal completeness"
      subtitle={`${got} of ${signals.length} input groups present`}
      footnote={
        enc.calibrationValidity === "reduced"
          ? "With this little input the ranking is still usable but the absolute probabilities are not calibrated. Adding prior history or an admission note is the single biggest improvement."
          : "Enough input is present for calibrated probabilities."
      }
    >
      <Meter value={enc.signalCompleteness} color={seqToken(enc.signalCompleteness)} height={8} label="Signal completeness" />
      {!compact && (
        <ul className="signal-list">
          {signals.map((s) => (
            <li key={s.key} className={s.present ? "is-present" : ""}>
              {s.present ? <CheckIcon size={13} /> : <span className="signal-dot" aria-hidden="true" />}
              <span>{s.label}</span>
              <span className={cx("level-tag", `level-${s.weight}`)}>{s.weight}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// --- Worklist risk cell -----------------------------------------------------

/** Compact risk cell for a table row: bar length + printed number, no bare colour. */
export function RiskCell({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="muted">—</span>;
  return (
    <div className="risk-cell" title={`${label}: ${pct(value, 1)} · ${percentilePhrase(value)}`}>
      <span className="tnum risk-cell-num">{pct(value, 0)}</span>
      <Meter value={value} color={seqToken(value)} height={4} label={label} />
    </div>
  );
}

export function LosCell({ low, high }: { low: number | null; high: number | null }) {
  if (low === null || high === null) return <span className="muted">—</span>;
  return <span className="tnum">{low}–{high} d</span>;
}

// --- Acknowledge / act-on ---------------------------------------------------

/**
 * §12.3.4. Acknowledging records that a named clinician reviewed the estimate —
 * it is the audit trail behind "independent HCP review", so it captures who and
 * when, and a resident's acknowledgement routes to an attending when the tenant
 * requires a co-sign.
 */
export function AcknowledgeBar({
  enc, canAcknowledge, requiresCosign, onAcknowledge, onEscalate,
}: {
  enc: Encounter; canAcknowledge: boolean; requiresCosign: boolean;
  onAcknowledge: (note: string) => void; onEscalate?: () => void;
}) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  // Awaiting a co-sign: a resident acknowledged and it now needs an attending.
  // Whoever can sign off (the attending) gets the co-sign action here; everyone
  // else sees that it is pending. Only a completed encounter shows the "done" bar.
  if (enc.state === "awaiting_cosign" && !enc.cosignBy) {
    if (canAcknowledge) {
      return (
        <div className="ack-bar is-action">
          <StethoscopeIcon size={16} />
          <div style={{ flex: 1 }}>
            <strong>Co-sign this review</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              Acknowledged by <strong>{enc.acknowledgedBy}</strong>{enc.acknowledgedAt ? ` ${ago(enc.acknowledgedAt)}` : ""}. Your co-sign closes it.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => onAcknowledge("")}>Co-sign</Button>
        </div>
      );
    }
    return (
      <div className="ack-bar">
        <InfoIcon size={16} />
        <span>Acknowledged by <strong>{enc.acknowledgedBy}</strong> — awaiting an attending&rsquo;s co-sign.</span>
      </div>
    );
  }

  if (enc.acknowledgedBy) {
    return (
      <div className="ack-bar is-done">
        <CheckIcon size={16} />
        <span>
          Reviewed by <strong>{enc.acknowledgedBy}</strong> {enc.acknowledgedAt ? ago(enc.acknowledgedAt) : ""}.
          {enc.cosignBy && <> Co-signed by <strong>{enc.cosignBy}</strong>.</>}
        </span>
      </div>
    );
  }

  if (!canAcknowledge) {
    return (
      <div className="ack-bar">
        <InfoIcon size={16} />
        <span>
          Your role reads these estimates but does not sign them off. If something here does not match
          the patient in front of you, escalate to the attending.
        </span>
        {onEscalate && <Button size="sm" onClick={onEscalate}>Escalate</Button>}
      </div>
    );
  }

  return (
    <div className="ack-bar is-action">
      <StethoscopeIcon size={16} />
      <div style={{ flex: 1 }}>
        <strong>Record your review</strong>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
          {requiresCosign
            ? "Your acknowledgement will be routed to the attending for co-sign before it closes."
            : "This records that you read the estimate and made your own clinical judgement."}
        </p>
        {open && (
          <textarea
            className="input"
            rows={2}
            style={{ marginTop: 8 }}
            placeholder="Optional note — what you did with this, or why you disagreed."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </div>
      {!open ? (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>Acknowledge</Button>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" onClick={() => { setOpen(false); setNote(""); }}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => { onAcknowledge(note); setOpen(false); }}>
            {requiresCosign ? "Submit for co-sign" : "Confirm review"}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Leakage alarm ----------------------------------------------------------

/**
 * §6 guardrail 7. If an intake-only metric looks too good, the alarm fires and
 * stays visible until a negative control is recorded. It is never silenced from
 * the UI — the copy explains what has to happen instead.
 */
export function LeakageAlarm({ metric, value, threshold, negativeControl }: {
  metric: string; value: number; threshold: number; negativeControl?: string;
}) {
  const firing = value > threshold;
  return (
    <div className={cx("leak-alarm", firing ? "is-firing" : "is-clear")}>
      <span className="leak-icon">{firing ? <AlertIcon size={16} /> : <CheckIcon size={16} />}</span>
      <div>
        <strong>
          {firing ? `Leakage alarm: ${metric} is above the honest intake-only ceiling` : `Leakage alarm clear — ${metric} within the intake-only ceiling`}
        </strong>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>
          <span className="tnum">{metric} {value.toFixed(3)} vs. ceiling {threshold.toFixed(2)}.</span>{" "}
          {firing
            ? "A result this strong from admission-time data alone usually means a feature saw something from during the stay. This must be resolved with a negative control before the number is trusted or quoted."
            : negativeControl}
        </p>
      </div>
    </div>
  );
}

// --- Chat slide-over --------------------------------------------------------

/**
 * Grounded Q&A over the current assessment. It can only restate what is already
 * on screen — it never produces a new estimate, and every answer points back to
 * the card it came from.
 */
export function ChatPanel({ open, onClose, enc }: { open: boolean; onClose: () => void; enc: Encounter }) {
  const [log, setLog] = useState<{ who: "you" | "esap"; text: string; source?: string }[]>([
    {
      who: "esap",
      text: `I can answer questions about this assessment for ${enc.patient.name}. I only restate what the models produced and what is on these cards — I cannot add a new estimate or look anything up.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);

  /**
   * Every answer comes from the server, which reads it off this encounter's
   * stored assessment — the same probabilities and drivers as the cards and the
   * Why panel. Nothing here composes an answer of its own.
   */
  async function send() {
    const q = draft.trim();
    if (!q || asking) return;
    setDraft("");
    setLog((l) => [...l, { who: "you", text: q }]);
    if (!isLive()) {
      setLog((l) => [...l, { who: "esap", text: OFFLINE_NOTICE.replace("Not saved", "No answer"), source: "offline" }]);
      return;
    }
    setAsking(true);
    try {
      const r = await api.post<{ answer: string; sources: string[] }>(`/api/v1/encounters/${enc.id}/ask`, { question: q });
      setLog((l) => [...l, { who: "esap", text: r.answer, source: r.sources.join(" · ") || undefined }]);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : "Could not reach the ESAP API.";
      setLog((l) => [...l, { who: "esap", text, source: "error" }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ask about this assessment"
      subtitle={`${enc.patient.name} · ${enc.patient.mrn}`}
      width={460}
      footer={
        <div className="row" style={{ gap: 8, width: "100%" }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={draft}
            placeholder="Why is the ICU estimate this high?"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          />
          <Button variant="primary" disabled={asking || !draft.trim()} onClick={() => void send()}>{asking ? "Asking…" : "Ask"}</Button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        {log.map((m, i) => (
          <div key={i} className={cx("chat-msg", m.who === "you" ? "is-you" : "is-esap")}>
            {m.who === "esap" && <SparkIcon size={14} />}
            <div>
              <p style={{ margin: 0 }}>{m.text}</p>
              {m.source && <span className="chat-source">from: {m.source}</span>}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

// --- Small shared bits ------------------------------------------------------

export function EncounterLink({ enc, tab = "results", children }: { enc: Encounter; tab?: string; children: ReactNode }) {
  return <Link className="enc-link" to={`/doctor/encounters/${enc.id}/${tab}`}>{children}</Link>;
}

export function ModelChip({ id, status }: { id: string; status?: string }) {
  return (
    <Badge tone={status === "degraded" ? "warning" : "neutral"} icon={<FlaskIcon size={11} />}>
      {id}{status === "degraded" ? " · degraded" : ""}
    </Badge>
  );
}

export function FairnessNote() {
  return (
    <p className="fairness-note">
      <ScaleIcon size={13} />
      Race, insurance and marital status are recorded for the fairness audit only. They are never model
      inputs and never appear on a clinical screen.
    </p>
  );
}
