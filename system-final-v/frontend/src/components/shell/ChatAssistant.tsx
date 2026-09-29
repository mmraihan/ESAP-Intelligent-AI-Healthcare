/**
 * Conversational intake assistant, available on every signed-in surface.
 *
 * Anyone — doctor, nurse, patient, caregiver — can enter admission information by
 * chatting instead of filling the form. Each message is sent to POST /api/v1/chat,
 * which extracts structured fields (deterministically, with LLM help when it is
 * reachable) and returns the running draft plus what it captured. A clinician who
 * has enough captured can run the assessment straight from the chat; a patient can
 * describe their history but never sees a raw score (the server enforces both).
 */
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/api/client";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/primitives";
import { XIcon } from "@/components/ui/icons";
import { t } from "@/i18n";

type Msg = { role: "assistant" | "user"; content: string };

type ChatResponse = {
  reply: string;
  draft: Record<string, unknown>;
  captured: string[];
  needs_confirmation: string[];
  ready: boolean;
  can_run_assessment: boolean;
  llm_used: boolean;
};

function greeting(patientVoice: boolean): string {
  return patientVoice
    ? t("Hi — I can take down your details for your visit. Tell me your age and what's been going on, however feels natural.")
    : t("Intake assistant. Describe the patient in plain language — age, sex, presentation, history, home meds, vitals — and I'll structure it. You can run the assessment once the basics are in.");
}

export function ChatAssistant() {
  const { authenticated, role } = useSession();
  const patientVoice = role === "patient" || role === "guest";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [captured, setCaptured] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [canRun, setCanRun] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: "assistant", content: greeting(patientVoice) }]);
    }
  }, [open, msgs.length, patientVoice]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [msgs, busy]);

  if (!authenticated) return null;

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const history = msgs.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post<ChatResponse>("/api/v1/chat", { message, draft, history });
      setDraft(res.draft);
      setCaptured(res.captured);
      setNeeds(res.needs_confirmation);
      setCanRun(res.can_run_assessment);
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "I couldn't reach the assistant just now.";
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
    } finally {
      setBusy(false);
    }
  }

  async function runAssessment() {
    if (busy) return;
    setBusy(true);
    try {
      const features = (draft as { features?: Record<string, unknown> }).features ?? {};
      const audit = (draft as { audit_covariates?: Record<string, unknown> }).audit_covariates ?? {};
      const req = {
        features,
        audit_covariates: audit,
        provenance: { source: "chat", needs_confirmation: needs },
      };
      const r = await api.post<any>("/api/v1/assess?top_n=5", req);
      setMsgs((m) => [...m, { role: "assistant", content: summarise(r) }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "The assessment could not be run.";
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label={t("Open the intake assistant")}>
        <ChatGlyph />
        <span>{t("Assistant")}</span>
      </button>
    );
  }

  return (
    <section className="chat-dock" aria-label={t("Intake assistant")}>
      <header className="chat-dock-head">
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <ChatGlyph />
          <strong style={{ fontSize: 14 }}>{t("Intake assistant")}</strong>
        </div>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t("Close assistant")}>
          <XIcon size={16} />
        </button>
      </header>

      <div className="chat-dock-body" ref={bodyRef}>
        {msgs.map((m, i) => (
          <div key={i} className={`chat-bubble chat-${m.role}`}>{m.content}</div>
        ))}
        {busy && <div className="chat-bubble chat-assistant chat-typing">…</div>}
      </div>

      {captured.length > 0 && (
        <div className="chat-captured" aria-label={t("Captured so far")}>
          {captured.slice(0, 8).map((c, i) => (
            <span key={i} className="pill pill-neutral">{c}</span>
          ))}
        </div>
      )}

      {canRun && (
        <div style={{ padding: "0 12px 8px" }}>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void runAssessment()}>
            {t("Run assessment from this")}
          </Button>
        </div>
      )}

      <form
        className="chat-dock-input"
        onSubmit={(e) => { e.preventDefault(); void send(); }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={patientVoice ? t("Tell me what's going on…") : t("Describe the patient…")}
          aria-label={t("Message the assistant")}
          disabled={busy}
        />
        <Button size="sm" variant="primary" disabled={busy || !input.trim()} onClick={() => void send()}>
          {t("Send")}
        </Button>
      </form>
      <p className="chat-foot">
        {patientVoice
          ? t("This helps prepare your visit. A clinician reviews everything.")
          : t("Extracted history and labs are flagged for your confirmation. Decision support, not diagnosis.")}
      </p>
    </section>
  );
}

function summarise(r: any): string {
  const diff = r?.differential?.result?.items ?? [];
  const top = diff.slice(0, 3)
    .map((i: any) => `${i.family} ${Math.round((i.probability ?? 0) * 100)}%`)
    .join(", ");
  const pct = (o: any) => (o?.result?.probability != null ? `${Math.round(o.result.probability * 100)}%` : "—");
  const los = r?.los?.result;
  const losTxt = los?.interval_low != null ? `${los.interval_low}–${los.interval_high} d` : "—";
  const lines = [
    "Assessment complete.",
    top ? `Top considerations: ${top}.` : "",
    `Mortality ${pct(r?.mortality)} · ICU ${pct(r?.icu)} · Readmission ${pct(r?.readmission)} · Length of stay ${losTxt}.`,
    "Open the results screen for the full breakdown and the Why panels.",
  ];
  return lines.filter(Boolean).join(" ");
}

function ChatGlyph() {
  return (
    <span className="chat-glyph" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
      </svg>
    </span>
  );
}
