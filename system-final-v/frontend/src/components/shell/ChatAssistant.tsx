/**
 * Conversational intake assistant, available on every signed-in surface.
 *
 * Anyone — doctor, nurse, patient, caregiver — can enter admission information by
 * chatting instead of filling the form. Each message is sent to POST /api/v1/chat,
 * which extracts structured fields (deterministically, with LLM help when it is
 * reachable) and returns the running draft plus what it captured. A clinician who
 * has enough captured can run the assessment straight from the chat; a patient can
 * describe their history but never sees a raw score (the server enforces both).
 *
 * The launcher lives in the top bar rather than floating over the page: a
 * floating button sat on top of table columns and form controls, which the
 * layout rules forbid. The open/closed state is shared through a tiny store so
 * the shell's launcher and this dock agree.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { create } from "zustand";
import { api, ApiError } from "@/api/client";
import { useSession } from "@/lib/session";
import { pct } from "@/lib/format";
import { Button, cx } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, SendIcon, SparkIcon, XIcon } from "@/components/ui/icons";
import { BodySystemGlyph } from "@/components/ui/bodySystems";
import { currentLang, t } from "@/i18n";

type Outcome = { result?: { probability?: number | null; interval_low?: number; interval_high?: number } };
type AssessSummary = {
  mortality: number | null; icu: number | null; readmission: number | null;
  losLow: number | null; losHigh: number | null;
  conditions: { ccsr: string; family: string; probability: number }[];
};
type Msg =
  | { role: "assistant" | "user"; content: string }
  | { role: "result"; summary: AssessSummary };

type ChatResponse = {
  reply: string;
  draft: Record<string, unknown>;
  captured: string[];
  needs_confirmation: string[];
  ready: boolean;
  can_run_assessment: boolean;
  llm_used: boolean;
};

export const useAssistant = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

function greeting(patientVoice: boolean): string {
  return patientVoice
    ? t("Hi — I can take down your details for your visit. Tell me your age and what's been going on, however feels natural.")
    : t("Intake assistant. Describe the patient in plain language — age, sex, presentation, history, home meds, vitals — and I'll structure it. You can run the assessment once the basics are in.");
}

/** Example phrasings — they show the kind of sentence the extractor reads, nothing more. */
function starters(patientVoice: boolean): string[] {
  return patientVoice
    ? [
        t("I'm 54 and I've had chest pain since yesterday"),
        t("I take metformin and lisinopril every day"),
        t("I've been short of breath for three days"),
      ]
    : [
        "68-year-old woman, 3 days of worsening shortness of breath and ankle swelling",
        "Arrived via ED. BP 150/90, HR 104, RR 22, SpO2 91%",
        "History of heart failure and type 2 diabetes; on furosemide and metformin",
      ];
}

/** The top-bar button that opens the dock. */
export function AssistantLauncher() {
  const { authenticated } = useSession();
  const { open, setOpen } = useAssistant();
  if (!authenticated) return null;
  return (
    <button
      type="button"
      className={cx("assist-launch", open && "is-open")}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={t("Open the intake assistant")}
    >
      <SparkIcon size={15} />
      <span className="assist-launch-label">{t("Assistant")}</span>
    </button>
  );
}

export function ChatAssistant() {
  const { authenticated, role } = useSession();
  const patientVoice = role === "patient" || role === "guest";
  const { open, setOpen } = useAssistant();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [captured, setCaptured] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [canRun, setCanRun] = useState(false);
  const [llmUsed, setLlmUsed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: "assistant", content: greeting(patientVoice) }]);
    }
    if (open) inputRef.current?.focus();
  }, [open, msgs.length, patientVoice]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Autosize the composer up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  if (!authenticated || !open) return null;

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const history = msgs
        .filter((m): m is Extract<Msg, { content: string }> => m.role !== "result")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post<ChatResponse>("/api/v1/chat", { message, draft, history });
      setDraft(res.draft);
      setCaptured(res.captured);
      setNeeds(res.needs_confirmation);
      setCanRun(res.can_run_assessment);
      setLlmUsed(res.llm_used);
      setMsgs((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : t("I couldn't reach the assistant just now.");
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
      setMsgs((m) => [...m, { role: "result", summary: summarise(r) }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "The assessment could not be run.";
      setMsgs((m) => [...m, { role: "assistant", content: text }]);
    } finally {
      setBusy(false);
    }
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  // Example prompts only where the extractor can read them: its rules are
  // English, so suggesting Arabic sentences would promise parsing it cannot do.
  const fresh = msgs.length <= 1 && !busy && currentLang() !== "ar";

  return (
    <section className="assist-dock" role="dialog" aria-label={t("Intake assistant")}>
      <header className="assist-head">
        <span className="assist-mark" aria-hidden="true"><SparkIcon size={16} /></span>
        <div className="assist-head-text">
          <strong>{t("Intake assistant")}</strong>
          <span>
            {llmUsed === null
              ? t("Turns what you type into intake fields")
              : llmUsed
                ? t("Language-model assisted extraction")
                : t("Rule-based extraction")}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t("Close assistant")}>
          <XIcon size={16} />
        </button>
      </header>

      <div className="assist-body" ref={bodyRef} aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "result" ? (
            <ResultCard key={i} s={m.summary} />
          ) : (
            <div key={i} className={cx("assist-msg", `is-${m.role}`)}>
              {m.role === "assistant" && <span className="assist-avatar" aria-hidden="true"><SparkIcon size={12} /></span>}
              <div className="assist-bubble">{m.content}</div>
            </div>
          ),
        )}
        {busy && (
          <div className="assist-msg is-assistant">
            <span className="assist-avatar" aria-hidden="true"><SparkIcon size={12} /></span>
            <div className="assist-bubble assist-typing" aria-label={t("Working…")}><i /><i /><i /></div>
          </div>
        )}
        {fresh && (
          <div className="assist-starters">
            <p className="assist-label">{t("Try writing something like")}</p>
            {starters(patientVoice).map((s) => (
              <button key={s} type="button" className="assist-starter" onClick={() => void send(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {(captured.length > 0 || needs.length > 0) && (
        <div className="assist-captured">
          {captured.length > 0 && (
            <div>
              <p className="assist-label">{t("Captured so far")} · <span className="tnum">{captured.length}</span></p>
              <div className="assist-chips">
                {captured.slice(0, 10).map((c, i) => (
                  <span key={i} className="assist-chip"><CheckIcon size={11} />{c}</span>
                ))}
              </div>
            </div>
          )}
          {needs.length > 0 && (
            <div>
              <p className="assist-label">{t("Needs your confirmation")}</p>
              <div className="assist-chips">
                {needs.slice(0, 8).map((c, i) => (
                  <span key={i} className="assist-chip is-confirm"><AlertIcon size={11} />{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {canRun && (
        <div className="assist-ready">
          <span>{t("Enough is captured to run the five models.")}</span>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void runAssessment()}>
            {t("Run assessment from this")}
          </Button>
        </div>
      )}

      <form className="assist-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onComposerKey}
          placeholder={patientVoice ? t("Tell me what's going on…") : t("Describe the patient…")}
          aria-label={t("Message the assistant")}
          disabled={busy}
        />
        <button type="submit" className="assist-send" disabled={busy || !input.trim()} aria-label={t("Send")}>
          <SendIcon size={16} />
        </button>
      </form>
      <p className="assist-foot">
        {patientVoice
          ? t("This helps prepare your visit. A clinician reviews everything.")
          : t("Extracted history and labs are flagged for your confirmation. Decision support, not diagnosis.")}
      </p>
    </section>
  );
}

/** The assessment, laid out as the numbers it returned — no prose added. */
function ResultCard({ s }: { s: AssessSummary }) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (s.conditions.length === 0) return;
    api.get<{ ccsr: { ccsr: string; description: string }[] }>("/api/v1/schema/ccsr")
      .then((r) => setNames(Object.fromEntries(r.ccsr.map((c) => [c.ccsr, c.description]))))
      .catch(() => undefined);
  }, [s.conditions.length]);
  const rows: [string, string][] = [
    ["In-hospital mortality", pct(s.mortality, s.mortality !== null && s.mortality < 0.1 ? 1 : 0)],
    ["ICU admission", pct(s.icu, 0)],
    ["30-day readmission", pct(s.readmission, 0)],
    ["Length of stay", s.losLow !== null && s.losHigh !== null ? `${s.losLow}–${s.losHigh} d` : "—"],
  ];
  return (
    <div className="assist-result">
      <p className="assist-result-head"><SparkIcon size={13} /> Assessment complete</p>
      <dl className="assist-result-grid">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>
        ))}
      </dl>
      {s.conditions.length > 0 && (
        <ul className="assist-result-conds">
          {s.conditions.map((c) => (
            <li key={c.ccsr}>
              <BodySystemGlyph family={c.family} size={14} />
              <span>{names[c.ccsr] ? <>{names[c.ccsr]} <span className="mono muted">{c.ccsr}</span></> : <span className="mono">{c.ccsr}</span>}</span>
              <span className="tnum">{pct(c.probability, 0)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="assist-result-foot">
        Population-level estimates from intake data only. Open a results screen for the Why panels.
      </p>
    </div>
  );
}

function summarise(r: any): AssessSummary {
  const prob = (o: Outcome | undefined) => (o?.result?.probability ?? null);
  const los = r?.los?.result;
  return {
    mortality: prob(r?.mortality),
    icu: prob(r?.icu),
    readmission: prob(r?.readmission),
    losLow: los?.interval_low ?? null,
    losHigh: los?.interval_high ?? null,
    conditions: (r?.differential?.result?.items ?? []).slice(0, 3).map((i: any) => ({
      ccsr: String(i.ccsr ?? ""),
      family: i.family ?? "",
      probability: i.probability ?? 0,
    })),
  };
}
