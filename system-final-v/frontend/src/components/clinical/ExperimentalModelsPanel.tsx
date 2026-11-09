/**
 * Towers B and C beside Tower A, and readmission at discharge.
 *
 * The server only sends these with ESAP_EXPERIMENTAL_MODELS on. Tower A's
 * ranking above is unchanged: no fusion model exists, so nothing here is
 * combined with it, and nothing here is written to the chart.
 */
import { useState } from "react";
import { ApiError, api } from "@/api/client";
import { Badge, Banner, Button, Card, Field, Select, TextArea, TextInput } from "@/components/ui/primitives";
import type { ApiOutcome, ExperimentalTower, StoredAssessment } from "@/hooks/useAssessments";

/** The discharge destinations the model was trained on. Anything else scores as OTHER. */
const DISCHARGE_LOCATIONS = [
  "HOME", "HOME HEALTH CARE", "SKILLED NURSING FACILITY", "REHAB", "CHRONIC/LONG TERM ACUTE CARE",
  "HOSPICE", "AGAINST ADVICE", "PSYCH FACILITY", "ACUTE HOSPITAL", "OTHER FACILITY",
  "ASSISTED LIVING", "HEALTHCARE FACILITY",
];

const TOWER_NAME: Record<string, string> = { B: "Tower B: admission note", C: "Tower C: prior-admission timeline" };

type DischargeResult = {
  probability: number;
  lace_score: number | null;
  top_decile_flag: boolean;
  calibrated: boolean;
};

/** "CIR019, 40" per line: a CCSR code and the days from that discharge to this admission. */
export function parseTimeline(text: string): { ccsr: string; gap_days: number }[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const events: { ccsr: string; gap_days: number }[] = [];
  for (const line of lines) {
    const match = /^([A-Z]{3}\d{3})\s*,\s*(\d+)$/.exec(line.toUpperCase());
    if (!match || Number(match[2]) <= 0) return null;
    events.push({ ccsr: match[1], gap_days: Number(match[2]) });
  }
  return events;
}

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Could not reach the ESAP API.";
}

function TowerColumn({ tower }: { tower: ExperimentalTower }) {
  return (
    <div className="stack" style={{ gap: 8, flex: "1 1 260px", minWidth: 0 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <strong>{TOWER_NAME[tower.tower] ?? tower.tower}</strong>
        <Badge tone={tower.status === "live" ? "warning" : "neutral"}>{tower.status.replace("_", " ")}</Badge>
      </div>
      {tower.reason && <p className="muted" style={{ margin: 0, fontSize: 13, overflowWrap: "anywhere" }}>{tower.reason}</p>}
      {tower.items.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
          {tower.items.map((item) => (
            <li key={item.ccsr}>
              <code>{item.ccsr}</code> · {item.family} · {(item.probability * 100).toFixed(1)}%{" "}
              {!item.calibrated && <span className="muted">(uncalibrated)</span>}
            </li>
          ))}
        </ol>
      )}
      <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
        {tower.caveats.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  );
}

export function ExperimentalModelsPanel({ features, towers: initial }: {
  features: StoredAssessment["features"];
  towers: Record<string, ExperimentalTower>;
}) {
  const [towers, setTowers] = useState(initial);
  const [timeline, setTimeline] = useState("");
  const [timelineBusy, setTimelineBusy] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [hours, setHours] = useState("");
  const [location, setLocation] = useState(DISCHARGE_LOCATIONS[0]);
  const [edVisits, setEdVisits] = useState("0");
  const [dischargeBusy, setDischargeBusy] = useState(false);
  const [dischargeError, setDischargeError] = useState<string | null>(null);
  const [discharge, setDischarge] = useState<(DischargeResult & { caveats: string[] }) | null>(null);

  async function runTimeline() {
    const events = parseTimeline(timeline);
    if (!events?.length) {
      setTimelineError("Enter one event per line as CODE, DAYS, for example CIR019, 40.");
      return;
    }
    setTimelineBusy(true);
    setTimelineError(null);
    try {
      const outcome = await api.post<ApiOutcome & { result: { experimental_towers?: Record<string, ExperimentalTower> } | null }>(
        "/api/v1/predict/differential?top_n=10",
        { features: { ...features, coded_sequence: events } },
      );
      if (outcome.result?.experimental_towers) setTowers(outcome.result.experimental_towers);
      else setTimelineError(outcome.reason ?? "The server returned no tower output.");
    } catch (error) {
      setTimelineError(message(error));
    } finally {
      setTimelineBusy(false);
    }
  }

  async function runDischarge() {
    const losHours = Number(hours);
    if (!hours.trim() || !Number.isFinite(losHours) || losHours < 0) {
      setDischargeError("Enter the length of stay in hours.");
      return;
    }
    setDischargeBusy(true);
    setDischargeError(null);
    try {
      const outcome = await api.post<ApiOutcome>("/api/v1/predict/readmission?frame=discharge", {
        features,
        discharge: { los_hours: losHours, discharge_location: location, n_ed_visits_180d: Number(edVisits) || 0 },
      });
      if (!outcome.result) {
        setDischarge(null);
        setDischargeError(outcome.reason ?? `The model did not return a result (${outcome.status}).`);
      } else {
        setDischarge({ ...(outcome.result as unknown as DischargeResult), caveats: outcome.explanation?.caveats ?? [] });
      }
    } catch (error) {
      setDischargeError(message(error));
    } finally {
      setDischargeBusy(false);
    }
  }

  return (
    <Card title="Experimental models" subtitle="Local testing only. Shown beside Tower A and never combined with it.">
      <div className="stack" style={{ gap: 16 }}>
        <Banner tone="warning" title="Not for clinical decisions">
          These outputs are not validated for patient care and do not change the differential above or the chart.
        </Banner>

        <div className="row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {Object.values(towers).map((t) => <TowerColumn key={t.tower} tower={t} />)}
        </div>

        <Field label="Prior-admission timeline for Tower C" hint="One event per line: CCSR code, days from that discharge to this admission." error={timelineError ?? undefined}>
          <TextArea rows={3} value={timeline} placeholder={"CIR019, 400\nEND002, 40"} onChange={(e) => setTimeline(e.currentTarget.value)} />
        </Field>
        <div><Button size="sm" disabled={timelineBusy} onClick={() => void runTimeline()}>{timelineBusy ? "Running…" : "Run towers with this timeline"}</Button></div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Field label="Length of stay (hours)" error={dischargeError ?? undefined}>
            <TextInput type="number" min={0} value={hours} onChange={(e) => setHours(e.currentTarget.value)} />
          </Field>
          <Field label="Discharge location">
            <Select value={location} onChange={(e) => setLocation(e.currentTarget.value)}>
              {DISCHARGE_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="ED visits, past 180 days">
            <TextInput type="number" min={0} value={edVisits} onChange={(e) => setEdVisits(e.currentTarget.value)} />
          </Field>
        </div>
        <div><Button size="sm" disabled={dischargeBusy} onClick={() => void runDischarge()}>{dischargeBusy ? "Running…" : "Estimate readmission at discharge"}</Button></div>

        {discharge && (
          <div className="stack" style={{ gap: 6 }}>
            <p style={{ margin: 0 }}>
              <strong>{(discharge.probability * 100).toFixed(1)}%</strong> 30-day readmission · LACE {discharge.lace_score ?? "—"}{" "}
              {discharge.top_decile_flag && <Badge tone="warning">Top decile</Badge>}
            </p>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              {discharge.caveats.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
