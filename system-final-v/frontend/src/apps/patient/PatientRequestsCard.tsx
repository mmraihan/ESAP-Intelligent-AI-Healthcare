/**
 * "Things you've sent" — the patient side of the request loop (§13.3).
 *
 * A patient who messages their care team, asks about a result or requests a
 * record used to get a one-off confirmation and never see it again. This closes
 * the loop: everything they raised, and where it is — received, being looked at,
 * or handled — so a sent message is not a message into a void.
 */
import { useEffect, useState } from "react";
import { isLive, myRequests, type PatientRequest } from "@/api/actions";
import { ago } from "@/lib/format";
import { t } from "@/i18n";
import { Badge, Card } from "@/components/ui/primitives";
import { SendIcon } from "@/components/ui/icons";

const STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "good" }> = {
  open: { label: "Received", tone: "warning" },
  in_progress: { label: "Being looked at", tone: "neutral" },
  closed: { label: "Handled", tone: "good" },
};

export function PatientRequestsCard() {
  const [requests, setRequests] = useState<PatientRequest[] | null>(null);

  useEffect(() => {
    if (!isLive()) return;
    myRequests().then((r) => setRequests(r.requests)).catch(() => setRequests([]));
  }, []);

  // Only the things the patient themselves raised as messages/questions/requests
  // — not connection requests, which have their own card.
  const items = (requests ?? []).filter((r) => r.kind !== "connection_request");
  if (!isLive() || items.length === 0) return null;

  return (
    <Card
      title={<span className="row" style={{ gap: 8 }}><SendIcon size={18} /> {t("Things you've sent")}</span>}
      subtitle={t("Messages, questions and requests you have raised, and where each one is.")}
    >
      <div className="stack" style={{ gap: 10 }}>
        {items.map((r) => {
          const s = STATUS[r.status] ?? STATUS.open;
          return (
            <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{t(r.label)}</strong>
                  {r.ref && <span className="muted" style={{ fontSize: 12.5 }}>· {r.ref}</span>}
                  {r.urgent && <Badge tone="critical">{t("urgent")}</Badge>}
                </div>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{r.detail}</p>
                <span className="muted" style={{ fontSize: 12 }}>{t("sent")} {ago(r.requestedAt)}</span>
              </div>
              <Badge tone={s.tone}>{t(s.label)}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
