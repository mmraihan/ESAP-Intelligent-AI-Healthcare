/**
 * Retention purge and consent summary for the privacy officer (QA issue 9).
 *
 * The purge runs every day on its own; "Run now" applies this hospital's rules
 * straight away. Every run writes a report saying what was deleted, by rule,
 * with the cutoff used, so a deletion can be shown as well as claimed.
 */
import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { TrashIcon } from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { dateTimeLabel } from "@/lib/format";
import { useSession } from "@/lib/session";

type Rule = { rule: string; table: string; cutoff: string; deleted: number; tenantId?: string };
type Report = { id: string; runAt: string; by: string; trigger: string; rules: Rule[]; totalDeleted: number };
type Summary = { policyVersion: string; patients: number; byPurpose: Record<string, { given: number; withdrawn: number; undecided: number }> };

const PURPOSE_LABEL: Record<string, string> = {
  ai_decision_support: "AI decision support",
  quality_improvement: "Fairness and accuracy checks",
  research: "Approved research",
};

export function RetentionCard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // An auditor reads the reports but cannot run a purge (the API refuses it).
  const canRun = useSession().role !== "auditor";

  function load() {
    if (!isLive()) return;
    api.get<{ reports: Report[] }>("/api/v1/admin/retention/reports").then((r) => setReports(r.reports)).catch(() => undefined);
    api.get<Summary>("/api/v1/admin/consents/summary").then(setSummary).catch(() => undefined);
  }
  useEffect(load, []);

  async function runNow() {
    setBusy(true);
    const m = await act(() => api.post<Report>("/api/v1/admin/retention/run"),
      (r) => `Retention run finished: ${r.totalDeleted} record${r.totalDeleted === 1 ? "" : "s"} deleted`);
    setBusy(false);
    setToast(m);
    load();
  }

  const last = reports[0];
  return (
    <>
      <Card
        title="Retention purge"
        subtitle="Runs every day; each run leaves a report"
        actions={canRun ? <Button size="sm" icon={<TrashIcon size={14} />} disabled={busy} onClick={() => void runNow()}>Run now</Button> : undefined}
        footnote="Hospital medical records are not purged here; the hospital keeps those under its own rules. This removes what ESAP holds past its retention period."
      >
        {last ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              Last run {dateTimeLabel(last.runAt)} ({last.trigger === "schedule" ? "scheduled" : `by ${last.by}`}) · <span className="tnum">{last.totalDeleted}</span> deleted
            </p>
            <table className="data-table">
              <thead><tr><th>Rule</th><th>Older than</th><th className="num">Deleted</th></tr></thead>
              <tbody>
                {last.rules.map((r, i) => (
                  <tr key={i}><td>{r.rule}</td><td className="tnum">{dateTimeLabel(r.cutoff)}</td><td className="num tnum">{r.deleted}</td></tr>
                ))}
              </tbody>
            </table>
            {reports.length > 1 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{reports.length - 1} earlier report{reports.length > 2 ? "s" : ""} kept.</p>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No purge has run yet. The first scheduled run is five minutes after the server starts.</p>
        )}
      </Card>
      {summary && (
        <Card title="Patient consent choices" subtitle={`Policy version ${summary.policyVersion} · ${summary.patients} portal patients · counts only, no names`}>
          <table className="data-table">
            <thead><tr><th>Purpose</th><th className="num">Yes</th><th className="num">No</th><th className="num">Not chosen</th></tr></thead>
            <tbody>
              {Object.entries(summary.byPurpose).map(([k, v]) => (
                <tr key={k}>
                  <td>{PURPOSE_LABEL[k] ?? k} {k === "ai_decision_support" && v.withdrawn > 0 && <Badge tone="neutral">not run for {v.withdrawn}</Badge>}</td>
                  <td className="num tnum">{v.given}</td><td className="num tnum">{v.withdrawn}</td><td className="num tnum">{v.undecided}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
