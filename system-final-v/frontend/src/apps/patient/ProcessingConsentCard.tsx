/**
 * "How my information is used" — the patient's own consent choices, per
 * purpose, against a numbered policy version (QA issue 9). Each change is
 * recorded with its time; a withdrawal keeps the earlier record and stamps
 * when it stopped. Turning off AI decision support stops the tool being run
 * for this patient; their care is otherwise the same.
 */
import { useEffect, useState } from "react";
import { t } from "@/i18n";
import { Badge, Card, Toggle } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { ShieldIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { dateTimeLabel } from "@/lib/format";

type Purpose = { id: string; label: string; detail: string; default: boolean };
type Decision = { status: "given" | "withdrawn" | null; version: string | null; decidedAt: string | null; needsReview: boolean };
type Consents = { policy: { version: string; purposes: Purpose[] }; decisions: Record<string, Decision> };

export function ProcessingConsentCard() {
  const [data, setData] = useState<Consents | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    if (!isLive()) return;
    api.get<Consents>("/api/v1/consents").then(setData).catch(() => undefined);
  }
  useEffect(load, []);

  function decide(purpose: string, on: boolean) {
    if (!data) return;
    void act(
      () => api.post("/api/v1/consents", { purpose, version: data.policy.version, decision: on ? "given" : "withdrawn" }),
      () => (on ? t("Saved. You said yes.") : t("Saved. You said no, from now on.")),
    ).then((m) => { setToast(m); load(); });
  }

  if (!data) return null;
  return (
    <Card
      title={<span className="row" style={{ gap: 8 }}><ShieldIcon size={18} /> {t("How my information is used")}</span>}
      subtitle={t("Policy version {v}", { v: data.policy.version })}
      footnote={t("Each choice is recorded with the date. Saying no later does not undo what was already done, but it stops it from now on.")}
    >
      {data.policy.purposes.map((p) => {
        const d = data.decisions[p.id];
        const on = d?.status ? d.status === "given" : p.default;
        return (
          <div key={p.id} className="stack" style={{ gap: 4 }}>
            <Toggle checked={on} onChange={(v) => decide(p.id, v)} label={t(p.label)} hint={t(p.detail)} />
            <span className="muted" style={{ fontSize: 13 }}>
              {d?.decidedAt
                ? t("You chose this on {date}.", { date: dateTimeLabel(d.decidedAt) })
                : t("You have not chosen yet. Until you do, this follows the default shown.")}
              {d?.needsReview && d.decidedAt ? <> <Badge tone="warning">{t("Policy changed — please choose again")}</Badge></> : null}
            </span>
          </div>
        );
      })}
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}
