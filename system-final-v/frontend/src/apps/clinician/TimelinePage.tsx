/**
 * D7 — Patient timeline (§12.3.8).
 *
 * The coded history and medications the models were given, with one line drawn
 * hard across the page at t₀: everything above it was available to the models,
 * everything below it was not. That line is the whole point of the screen.
 *
 * Everything here is what the latest assessment was actually given (from the
 * API). Per-admission detail — dates, facilities, lengths of stay — arrives
 * through the EHR integration; until one is connected, the screen says so
 * rather than inventing a history.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { MODELS, encounterById } from "@/mock/db";
import { dateTimeLabel } from "@/lib/format";
import { familyColorVar } from "@/lib/ccsrFamilies";
import { EncounterHeader } from "@/components/clinical";
import { AssistiveLine } from "@/components/ui/domain";
import { Banner, Card, Tabs } from "@/components/ui/primitives";
import { ClockIcon, PillIcon } from "@/components/ui/icons";
import { useAssessments } from "@/hooks/useAssessments";
import { api } from "@/api/client";
import { isLive } from "@/api/actions";

type CcsrEntry = { ccsr: string; description: string; family: string };

export function TimelinePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const enc = encounterById(id ?? "");
  const { latest, loading } = useAssessments(enc?.id);
  const [catalog, setCatalog] = useState<Record<string, CcsrEntry>>({});

  useEffect(() => {
    if (!isLive()) return;
    api.get<{ ccsr: CcsrEntry[] }>("/api/v1/schema/ccsr")
      .then((r) => setCatalog(Object.fromEntries(r.ccsr.map((c) => [c.ccsr, c]))))
      .catch(() => undefined);
  }, []);

  if (!enc) return <Navigate to="/doctor/worklist" replace />;

  const history = latest?.features.prior_history;
  const prior = history?.prior_ccsr ?? [];
  const meds = latest?.features.meds ?? [];
  const hasNote = Boolean(latest?.features.notes && Object.values(latest.features.notes).some(Boolean));
  const m01 = MODELS.find((m) => m.id === "M-01");
  const stratum = m01?.strata.find((s) => (prior.length ? !/cold/i.test(s.label) : /cold/i.test(s.label)));

  return (
    <>
      <EncounterHeader enc={enc} />

      <Tabs
        value="timeline"
        onChange={(v) => {
          if (v === "results") nav(`/doctor/encounters/${enc.id}/results`);
          if (v === "intake") nav(`/doctor/encounters/${enc.id}/intake`);
          if (v === "history") nav(`/doctor/encounters/${enc.id}/history`);
        }}
        tabs={[
          { value: "results", label: "Results" },
          { value: "intake", label: "Intake" },
          { value: "timeline", label: "Timeline" },
          { value: "history", label: "History", count: enc.assessmentCount },
        ]}
      />

      <Banner tone="accent" icon={<ClockIcon size={16} />} title={`The t₀ line is ${dateTimeLabel(enc.t0)}`}>
        Everything listed here was on the record at admission and was given to the models.
        Anything recorded after it — including today&rsquo;s observations — was not, and cannot have
        influenced any estimate on the Results tab.
      </Banner>

      {loading ? (
        <p className="muted">Loading the admission record…</p>
      ) : !latest ? (
        <Card title="Not assessed yet">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            No assessment has run for this encounter, so there is no admission record to show. Complete the
            intake and run the assessment.
          </p>
        </Card>
      ) : (
        <div className="split">
          <Card
            title="Coded prior history"
            subtitle={`${prior.length} prior condition${prior.length === 1 ? "" : "s"} · ${history?.n_prior_admissions ?? 0} admission${history?.n_prior_admissions === 1 ? "" : "s"} in the last 12 months`}
            footnote="Dates, facilities and lengths of stay for each prior admission come through the EHR integration. None is connected on this server, so only the coded summary the models used is shown."
          >
            <div className="t0-line">
              <span>t₀ — admission · {dateTimeLabel(enc.t0)}</span>
            </div>
            {prior.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No prior conditions on record — this patient is scored as cold start.
              </p>
            ) : (
              <ul className="timeline">
                {prior.map((code) => {
                  const entry = catalog[code];
                  return (
                    <li key={code}>
                      <span className="timeline-when">Before this admission</span>
                      <p className="timeline-what">
                        <strong>{entry?.description ?? code}</strong>
                        <br />
                        <span className="chip" style={{ marginTop: 4 }}>
                          <span className="chip-swatch" style={{ background: familyColorVar(entry?.family ?? "") }} />
                          {code}{entry ? ` · ${entry.family}` : ""}
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="stack" style={{ gap: 16 }}>
            <Card
              title={<span className="row" style={{ gap: 7 }}><PillIcon size={16} /> Medications on admission</span>}
              subtitle="What the patient was already taking at t₀"
              footnote="Anything prescribed during this admission is excluded by construction — it would be time-travel relative to the models' cut."
            >
              {meds.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>No medications were recorded at admission.</p>
              ) : (
                <ul className="caveat-list">
                  {meds.map((m) => <li key={m}><PillIcon size={13} /> {m.charAt(0).toUpperCase() + m.slice(1)}</li>)}
                </ul>
              )}
            </Card>

            <Card title="What the models actually saw" subtitle="From the latest assessment's input">
              <dl className="kv">
                <dt>Prior coded conditions</dt><dd className="tnum">{prior.length || "none on record"}</dd>
                <dt>Prior admissions (12 mo)</dt><dd className="tnum">{history?.n_prior_admissions ?? 0}</dd>
                <dt>Charlson index</dt><dd className="tnum">{history?.charlson_index ?? "not recorded"}</dd>
                <dt>Admission note</dt><dd>{hasNote ? "present" : "absent"}</dd>
                <dt>Cohort</dt><dd>{prior.length ? "Has prior history" : "Cold start"}</dd>
              </dl>
              {stratum && (
                <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.55 }}>
                  This patient falls in the {stratum.label.toLowerCase()} stratum, where M-01 {stratum.metric} is{" "}
                  {stratum.value.toFixed(3)} in the evaluation of record.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      <AssistiveLine />
    </>
  );
}
