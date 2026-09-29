/**
 * N2 — Handoff Summary (§12.4.1, §12.4.6). Shift-change brief.
 *
 * Generated from the unit's current state and then edited by the outgoing
 * charge nurse. The model estimates appear as context lines, never as the
 * headline: a handoff is a human account of the unit, and the software's job is
 * to make sure nothing was forgotten, not to write it.
 */
import { useEffect, useMemo, useState } from "react";
import { ALL_UNITS, ENCOUNTERS } from "@/mock/db";
import { ago, dateTimeLabel, pct } from "@/lib/format";
import { NOW } from "@/mock/db";
import { useSession } from "@/lib/session";
import { myUnitId } from "@/lib/scope";
import { Banner, Button, Card, PageHeader, Select, StatTile, TextArea, cx } from "@/components/ui/primitives";
import { AssistiveLine } from "@/components/ui/domain";
import { Toast } from "@/components/ui/overlays";
import { AlertIcon, CheckIcon, DownloadIcon, HandoffIcon, SendIcon } from "@/components/ui/icons";
import { act, isLive, requestExport } from "@/api/actions";
import { api } from "@/api/client";

type Handoff = {
  id: string; unitName: string; sentAt: string; sentBy: string; notesWritten: number;
  patients: { encounterId: string; name: string; bed: string; note: string; noteWritten: boolean; planConfirmed: boolean }[];
};

export function HandoffPage() {
  const { name } = useSession();
  const [unitId, setUnitId] = useState(() => myUnitId() ?? ALL_UNITS[0]?.id ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [received, setReceived] = useState<Handoff | null>(null);
  const [sending, setSending] = useState(false);

  // The last handoff filed for this unit — what the outgoing shift told you.
  useEffect(() => {
    setReceived(null);
    if (!isLive() || !unitId) return;
    api.get<{ handoffs: Handoff[] }>(`/api/v1/handoffs?unit_id=${encodeURIComponent(unitId)}&limit=1`)
      .then((r) => setReceived(r.handoffs[0] ?? null))
      .catch(() => undefined);
  }, [unitId]);

  /** File the handoff on the server, where the incoming shift reads it back. */
  async function send() {
    setSending(true);
    const message = await act(
      () => api.post<Handoff>("/api/v1/handoffs", {
        unit_id: unitId,
        notes: Object.fromEntries(Object.entries(notes).filter(([, v]) => v.trim())),
        checked: Object.keys(checked).filter((k) => checked[k]),
      }),
      (h) => {
        setReceived(h);
        return `Handoff filed for ${h.unitName} — ${h.notesWritten} of ${h.patients.length} patients have a note; logged as handoff.send`;
      },
    );
    setSending(false);
    setToast(message);
  }

  const unit = ALL_UNITS.find((u) => u.id === unitId);
  const rows = useMemo(
    () => ENCOUNTERS.filter((e) => e.unitId === unitId && e.state !== "closed").sort((a, b) => (b.risks.icu ?? 0) - (a.risks.icu ?? 0)),
    [unitId],
  );

  // An account with no units (an individual, self-serve seat) has no roster.
  if (!unit) {
    return (
      <>
        <PageHeader eyebrow="Shift change" title="Handoff summary" />
        <Card title="No units in this account">
          <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
            This view works on a hospital unit, and your account has none. It appears once you are
            part of a hospital with wards set up.
          </p>
        </Card>
      </>
    );
  }

  const watch = rows.filter((e) => (e.risks.icu ?? 0) > 0.4);
  const unassessed = rows.filter((e) => e.risks.mortality === null);
  const noHistory = rows.filter((e) => !e.hasPriorHistory);
  const reviewed = rows.filter((e) => Boolean(e.acknowledgedBy));

  return (
    <>
      <PageHeader
        eyebrow="Shift change"
        title="Handoff summary"
        lede={`${unit.name} · prepared by ${name} · ${dateTimeLabel(NOW.toISOString())}`}
        actions={
          <>
            <Button icon={<DownloadIcon size={15} />} onClick={() => void requestExport("handoff", "Shift handover export", { notes }).then(setToast)}>Export</Button>
            <Button variant="primary" icon={<SendIcon size={15} />} disabled={sending || rows.length === 0} onClick={() => void send()}>{sending ? "Sending…" : "Send to next shift"}</Button>
          </>
        }
      />

      <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Unit" >
        {ALL_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </Select>

      <div className="grid grid-4">
        <StatTile label="Patients on unit" value={rows.length} unit={`/ ${unit.beds}`} icon={<HandoffIcon size={15} />} />
        <StatTile label="Flagged to watch" value={watch.length} tone={watch.length > 0 ? "warning" : "neutral"} hint="ICU estimate above 40%" />
        <StatTile label="No estimate available" value={unassessed.length} hint="Intake incomplete at handoff" />
        <StatTile label="Reviewed by the attending" value={`${reviewed.length}`} unit={`/ ${rows.length}`} hint="Acknowledged assessments" />
      </div>

      {received && (
        <Card
          title="Last handoff for this unit"
          subtitle={`From ${received.sentBy} · ${dateTimeLabel(received.sentAt)} · ${received.notesWritten} of ${received.patients.length} with a note`}
        >
          <ul className="caveat-list">
            {received.patients.filter((p) => p.noteWritten || p.planConfirmed).map((p) => (
              <li key={p.encounterId}>
                <strong>{p.name}</strong> <span className="mono muted">{p.bed}</span>
                {p.planConfirmed && <span className="pill pill-neutral" style={{ marginInlineStart: 6 }}>plan confirmed</span>}
                {p.noteWritten && <span className="muted"> — {p.note}</span>}
              </li>
            ))}
            {!received.patients.some((p) => p.noteWritten || p.planConfirmed) && (
              <li className="muted">No concerns were raised at that handoff.</li>
            )}
          </ul>
        </Card>
      )}

      <Banner tone="accent" title="What this document is">
        A record of the unit as you are leaving it. The estimates are included so the incoming nurse
        knows what the system currently says — the clinical account of each patient is yours to write,
        and the box under each name is where it goes.
      </Banner>

      {watch.length > 0 && (
        <Card
          title={<span className="row" style={{ gap: 7 }}><AlertIcon size={16} /> Flagged to watch</span>}
          subtitle="Highest ICU estimates on the unit — confirm each one has a plan before you hand over"
        >
          <ul className="watch-list">
            {watch.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={cx("task-check", checked[e.id] && "is-on")}
                  onClick={() => setChecked((c) => ({ ...c, [e.id]: !c[e.id] }))}
                  aria-label={`Mark ${e.patient.name} as handed over`}
                >
                  {checked[e.id] ? <CheckIcon size={12} /> : null}
                </button>
                <div style={{ flex: 1 }}>
                  <strong>{e.patient.name}</strong> <span className="mono muted">{e.bed}</span>
                  <span className="muted" style={{ marginInlineStart: 8, fontSize: 12.5 }}>
                    ICU <span className="tnum">{pct(e.risks.icu, 0)}</span> · mortality <span className="tnum">{pct(e.risks.mortality, 0)}</span>
                  </span>
                  <p className="bed-complaint" style={{ margin: "3px 0 0" }}>{e.chiefComplaint}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Patient-by-patient"
        subtitle="Add your note against each. Anything left blank prints as 'no concerns raised at handoff'."
      >
        <div className="stack" style={{ gap: 16 }}>
          {rows.map((e) => (
            <div key={e.id} className="handoff-row">
              <div className="handoff-head">
                <span className="mono bed-num">{e.bed}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{e.patient.name}</strong>
                  <span className="muted" style={{ marginInlineStart: 8, fontSize: 12.5 }}>
                    {e.patient.age}{e.patient.sex} · admitted {ago(e.admittedAt)} · {e.nurse}
                  </span>
                  <p className="bed-complaint" style={{ margin: "2px 0 0" }}>{e.chiefComplaint}</p>
                </div>
                <div className="handoff-metrics">
                  {e.risks.mortality === null ? (
                    <span className="pill pill-neutral">no estimate</span>
                  ) : (
                    <>
                      <span className="tnum">ICU {pct(e.risks.icu, 0)}</span>
                      <span className="tnum">Mort {pct(e.risks.mortality, 0)}</span>
                      <span className="tnum">LOS {e.risks.losLow}–{e.risks.losHigh} d</span>
                    </>
                  )}
                </div>
              </div>
              <TextArea
                rows={2}
                placeholder="What the incoming nurse needs to know — plan, family situation, outstanding jobs, anything that does not fit in a number."
                value={notes[e.id] ?? ""}
                onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
              />
            </div>
          ))}
        </div>
      </Card>

      {(unassessed.length > 0 || noHistory.length > 0) && (
        <Card title="Loose ends to mention" subtitle="Things the system knows are missing">
          <ul className="caveat-list">
            {unassessed.length > 0 && (
              <li><AlertIcon size={13} /> {unassessed.length} patient{unassessed.length > 1 ? "s have" : " has"} an incomplete intake, so no estimate exists for them at all.</li>
            )}
            {noHistory.length > 0 && (
              <li><AlertIcon size={13} /> {noHistory.length} patient{noHistory.length > 1 ? "s have" : " has"} no prior history on record. Their differential is running in the cold-start stratum, where recall is materially lower.</li>
            )}
          </ul>
        </Card>
      )}

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
