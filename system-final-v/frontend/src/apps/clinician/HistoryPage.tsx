/**
 * D8 — Results history (§12.3.4 / §8.9).
 *
 * Every /assess run on this encounter, in order, with what changed between
 * them. A single current number hides the fact that an estimate moved when
 * someone added a lab; this screen is how a clinician (or an auditor) sees that.
 */
import { useState } from "react";
import { useAssessments, type StoredAssessment } from "@/hooks/useAssessments";
import { act } from "@/api/actions";
import { api } from "@/api/client";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { Toast } from "@/components/ui/overlays";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { encounterById } from "@/mock/db";
import { ago, dateTimeLabel, pct } from "@/lib/format";
import { EncounterHeader } from "@/components/clinical";
import { AssistiveLine, CalibratedBadge } from "@/components/ui/domain";
import { Badge, Button, Card, Tabs, cx } from "@/components/ui/primitives";
import { ArrowDown, ArrowUp, DownloadIcon, FlaskIcon } from "@/components/ui/icons";

type Run = {
  n: number;
  at: string;
  by: string;
  trigger: string;
  mortality: number;
  icu: number;
  readmission: number;
  losLow: number;
  losHigh: number;
  calibrated: boolean;
  changed: string[];
  modelVersions: string;
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** What differs between two runs' inputs, in words a clinician recognises. */
function describeChanges(now: StoredAssessment, prev: StoredAssessment | undefined): string[] {
  if (!prev) return ["First assessment for this encounter."];
  const a = prev.features, b = now.features, out: string[] = [];
  const labsA = a.labs ?? {}, labsB = b.labs ?? {};
  for (const [id, v] of Object.entries(labsB)) {
    if (!(id in labsA)) out.push(`Lab ${id} added (${v})`);
    else if (labsA[id] !== v) out.push(`Lab ${id} changed ${labsA[id]} → ${v}`);
  }
  for (const id of Object.keys(labsA)) if (!(id in labsB)) out.push(`Lab ${id} removed`);
  const ccsrA = new Set(a.prior_history?.prior_ccsr ?? []), ccsrB = new Set(b.prior_history?.prior_ccsr ?? []);
  for (const c of ccsrB) if (!ccsrA.has(c)) out.push(`Prior condition ${c} added`);
  for (const c of ccsrA) if (!ccsrB.has(c)) out.push(`Prior condition ${c} removed`);
  const admA = a.prior_history?.n_prior_admissions ?? 0, admB = b.prior_history?.n_prior_admissions ?? 0;
  if (admA !== admB) out.push(`Prior admissions ${admA} → ${admB}`);
  const medsA = new Set(a.meds ?? []), medsB = new Set(b.meds ?? []);
  for (const m of medsB) if (!medsA.has(m)) out.push(`Medication ${m} added`);
  for (const m of medsA) if (!medsB.has(m)) out.push(`Medication ${m} removed`);
  for (const [k, v] of Object.entries(b.vitals ?? {})) {
    if (v != null && (a.vitals ?? {})[k] !== v) out.push(`${k.replace("_", " ")} ${(a.vitals ?? {})[k] ?? "blank"} → ${v}`);
  }
  const noteA = Boolean(a.notes && Object.values(a.notes).some(Boolean));
  const noteB = Boolean(b.notes && Object.values(b.notes).some(Boolean));
  if (noteA !== noteB) out.push(noteB ? "Admission note added" : "Admission note removed");
  return out.length ? out : ["Re-run with the same inputs."];
}

/** Runs from the API, newest first, numbered from the first. */
function toRuns(list: StoredAssessment[]): Run[] {
  const oldestFirst = [...list].reverse();
  return oldestFirst.map((a, k) => {
    const r = a.response;
    const los = (r.los.result ?? {}) as Record<string, unknown>;
    return {
      n: k + 1,
      at: a.created_at,
      by: a.actor === "seed" ? "Initial load" : a.actor,
      trigger: k === 0 ? "Initial assessment" : "Re-run",
      changed: describeChanges(a, oldestFirst[k - 1]),
      mortality: num(r.mortality.result?.probability),
      icu: num(r.icu.result?.probability),
      readmission: num(r.readmission.result?.probability),
      losLow: num(los.interval_low),
      losHigh: num(los.interval_high),
      calibrated: Boolean(r.mortality.result?.calibrated ?? true),
      modelVersions: (["differential", "mortality", "icu", "readmission", "los"] as const)
        .map((key, i) => `M-0${i + 1} ${r[key].model_version}`).join(" · "),
    };
  }).reverse();
}

function Delta({ now, prev, invert }: { now: number; prev?: number; invert?: boolean }) {
  if (prev === undefined) return <span className="muted">—</span>;
  const d = now - prev;
  if (Math.abs(d) < 0.005) return <span className="muted">no change</span>;
  const up = d > 0;
  return (
    <span className={cx("delta", up !== !!invert ? "is-up" : "is-down")}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      <span className="tnum">{up ? "+" : ""}{(d * 100).toFixed(1)} pp</span>
    </span>
  );
}

export function HistoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const enc = encounterById(id ?? "");
  const { role } = useSession();
  const canExport = can(role, "export:phi");
  const [selected, setSelected] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const { assessments, loading } = useAssessments(enc?.id);
  if (!enc) return <Navigate to="/doctor/worklist" replace />;

  const runs = toRuns(assessments ?? []);
  const current = runs[selected];
  const versionChanged = current && runs[selected + 1] && current.modelVersions !== runs[selected + 1].modelVersions;

  /** The run log, recorded as an export first, then saved as a file. */
  function exportRuns() {
    void act(
      () => api.post("/api/v1/exports", {
        kind: "encounter_summary", reason: "Assessment run log exported from the history screen",
        scope: { encounter_id: enc!.id },
      }),
      () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${enc!.id}-assessment-runs.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return "Run log exported — written to the audit log";
      },
    ).then(setToast);
  }

  return (
    <>
      <EncounterHeader enc={enc} actions={canExport && <Button size="sm" icon={<DownloadIcon size={14} />} disabled={!runs.length} onClick={exportRuns}>Export run log</Button>} />

      <Tabs
        value="history"
        onChange={(v) => {
          if (v === "results") nav(`/doctor/encounters/${enc.id}/results`);
          if (v === "intake") nav(`/doctor/encounters/${enc.id}/intake`);
          if (v === "timeline") nav(`/doctor/encounters/${enc.id}/timeline`);
        }}
        tabs={[
          { value: "results", label: "Results" },
          { value: "intake", label: "Intake" },
          { value: "timeline", label: "Timeline" },
          { value: "history", label: "History", count: runs.length },
        ]}
      />

      {loading ? (
        <p className="muted">Loading assessment runs…</p>
      ) : runs.length === 0 ? (
        <Card title="No assessment runs yet">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing has been assessed for this encounter. Runs appear here as the intake is scored.
          </p>
        </Card>
      ) : (<>
      <Card
        title="Assessment runs"
        subtitle={`${runs.length} runs against the same t₀. The cut never moved — only what was known about it did.`}
        footnote="An estimate that moves between runs is not the model changing its mind. It is the model being given more of the admission record than it had before."
        padded={false}
      >
        <div className="scroll-x">
          <table className="data-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>When</th>
                <th className="col-secondary">Triggered by</th>
                <th style={{ textAlign: "right" }}>Mortality</th>
                <th style={{ textAlign: "right" }}>ICU</th>
                <th style={{ textAlign: "right" }}>Readmission</th>
                <th style={{ textAlign: "right" }}>LOS</th>
                <th>Calibration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => {
                const prev = runs[i + 1];
                return (
                  <tr key={r.n} className={cx("is-clickable", i === selected && "is-selected")} onClick={() => setSelected(i)}>
                    <td><strong className="tnum">#{r.n}</strong></td>
                    <td>
                      <div className="cell-stack">
                        <span>{ago(r.at)}</span>
                        <span className="muted mono">{dateTimeLabel(r.at)}</span>
                      </div>
                    </td>
                    <td className="col-secondary">
                      <div className="cell-stack">
                        <span>{r.trigger}</span>
                        <span className="muted">{r.by}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="cell-stack" style={{ alignItems: "flex-end" }}>
                        <span className="tnum">{pct(r.mortality, 1)}</span>
                        <Delta now={r.mortality} prev={prev?.mortality} />
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="cell-stack" style={{ alignItems: "flex-end" }}>
                        <span className="tnum">{pct(r.icu, 1)}</span>
                        <Delta now={r.icu} prev={prev?.icu} />
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="cell-stack" style={{ alignItems: "flex-end" }}>
                        <span className="tnum">{pct(r.readmission, 1)}</span>
                        <Delta now={r.readmission} prev={prev?.readmission} />
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }} className="tnum">{r.losLow}–{r.losHigh} d</td>
                    <td><CalibratedBadge calibrated={r.calibrated} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={`What changed in run #${runs[selected].n}`}
        subtitle={`${dateTimeLabel(runs[selected].at)} · ${runs[selected].by}`}
        actions={<Badge tone="neutral" icon={<FlaskIcon size={11} />}>{runs[selected].modelVersions}</Badge>}
      >
        <ul className="change-list">
          {runs[selected].changed.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {selected < runs.length - 1 && (
          <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            Compared with run #{runs[selected + 1].n}, the mortality estimate moved{" "}
            <span className="tnum">
              {((runs[selected].mortality - runs[selected + 1].mortality) * 100).toFixed(1)} percentage points
            </span>{" "}
            on the inputs listed above.{" "}
            {versionChanged
              ? "A model version also changed between these runs, so part of the difference may come from the new version."
              : "No model version changed between these runs, so the difference is entirely attributable to the inputs."}
          </p>
        )}
      </Card>
      </>)}

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
