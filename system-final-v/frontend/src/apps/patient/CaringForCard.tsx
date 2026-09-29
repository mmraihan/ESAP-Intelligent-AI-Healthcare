/**
 * "People you care for" — the caregiver's side of family access (§13.3).
 *
 * A carer's own record is empty; their access lives here. Shows each person who
 * gave them access and what they shared — released summaries, and the full
 * record when the patient allowed it. Never a raw score, the same §13.6 gate as
 * the patient's own view.
 */
import { useEffect, useState } from "react";
import { isLive } from "@/api/actions";
import { api } from "@/api/client";
import { dateLabel } from "@/lib/format";
import { t } from "@/i18n";
import { Badge, Card } from "@/components/ui/primitives";
import { HeartPulseIcon, UsersIcon } from "@/components/ui/icons";

type Released = { id: string; headline: string; plainLanguage?: string; releasedAt?: string; releasedBy?: string };
type CaringFor = { patientName: string; relationship: string; level: string; released: Released[]; records: unknown[] };

const LEVEL: Record<string, string> = {
  view_summaries: "Summaries",
  view_all: "Full record",
  act_on_behalf: "Full record · can act for them",
};

export function CaringForCard() {
  const [items, setItems] = useState<CaringFor[]>([]);

  useEffect(() => {
    if (!isLive()) return;
    api.get<{ caring_for: CaringFor[] }>("/api/v1/patient/for-caregiver")
      .then((r) => setItems(r.caring_for)).catch(() => undefined);
  }, []);

  if (!isLive() || items.length === 0) return null;

  return (
    <Card
      title={<span className="row" style={{ gap: 8 }}><UsersIcon size={18} /> {t("People you care for")}</span>}
      subtitle={t("Records shared with you. You are never shown a raw score.")}
    >
      <div className="stack" style={{ gap: 16 }}>
        {items.map((p, i) => (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", paddingBottom: 12 }}>
            <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15.5 }}>{p.patientName}</strong>
              <span className="muted" style={{ fontSize: 13 }}>{t("as {relationship}", { relationship: p.relationship })}</span>
              <Badge tone="neutral">{t(LEVEL[p.level] ?? "Summaries")}</Badge>
            </div>
            {p.released.length === 0 ? (
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>{t("Nothing has been shared with you yet")}</p>
            ) : (
              <ul className="qa-list" style={{ marginTop: 6 }}>
                {p.released.map((r) => (
                  <li key={r.id}>
                    <HeartPulseIcon size={15} />
                    <span>
                      <strong>{r.headline}</strong>
                      {r.plainLanguage && <><br /><span style={{ fontSize: 13.5 }}>{r.plainLanguage}</span></>}
                      {r.releasedAt && <><br /><span className="muted" style={{ fontSize: 12.5 }}>{dateLabel(r.releasedAt)}{r.releasedBy ? ` · ${r.releasedBy}` : ""}</span></>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
