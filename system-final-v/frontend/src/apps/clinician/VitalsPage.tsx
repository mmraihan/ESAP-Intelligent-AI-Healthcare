/**
 * N5 — Vitals & Labs fast entry (§12.4.4).
 *
 * Condensed, keyboard-first, large targets — this gets used on a cart at a
 * bedside, one-handed. The important behaviour is the t₀ guard: a value
 * timestamped after admission is accepted into the chart but explicitly
 * excluded from the models, and the screen says so rather than silently
 * dropping it.
 */
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { encounterById } from "@/mock/db";
import { dateTimeLabel } from "@/lib/format";
import { T0Chip } from "@/components/clinical";
import { AssistiveLine } from "@/components/ui/domain";
import { Badge, Banner, Button, Card, Field, PageHeader, SegmentedControl, TextInput, cx } from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import { ActivityIcon, AlertIcon, CheckIcon, FlaskIcon } from "@/components/ui/icons";
import { act } from "@/api/actions";
import { api } from "@/api/client";

const VITALS = [
  { k: "sbp", label: "Systolic BP", unit: "mmHg", lo: 60, hi: 250, normal: [90, 140] },
  { k: "dbp", label: "Diastolic BP", unit: "mmHg", lo: 30, hi: 150, normal: [60, 90] },
  { k: "hr", label: "Heart rate", unit: "/min", lo: 20, hi: 220, normal: [60, 100] },
  { k: "rr", label: "Respiratory rate", unit: "/min", lo: 4, hi: 60, normal: [12, 20] },
  { k: "temp", label: "Temperature", unit: "°C", lo: 30, hi: 43, normal: [36.1, 37.8] },
  { k: "spo2", label: "SpO₂", unit: "%", lo: 50, hi: 100, normal: [94, 100] },
  { k: "weight", label: "Weight", unit: "kg", lo: 25, hi: 300, normal: [45, 120] },
  { k: "height", label: "Height", unit: "cm", lo: 120, hi: 220, normal: [150, 195] },
];

const LABS = [
  { id: "50912", name: "Creatinine", unit: "mg/dL", ref: [0.6, 1.3] },
  { id: "50971", name: "Potassium", unit: "mEq/L", ref: [3.5, 5.1] },
  { id: "50983", name: "Sodium", unit: "mEq/L", ref: [136, 145] },
  { id: "51222", name: "Haemoglobin", unit: "g/dL", ref: [12, 17] },
  { id: "51301", name: "White blood cells", unit: "K/uL", ref: [4.5, 11] },
  { id: "50813", name: "Lactate", unit: "mmol/L", ref: [0.5, 2] },
  { id: "50862", name: "Albumin", unit: "g/dL", ref: [3.5, 5] },
  { id: "51006", name: "Urea nitrogen", unit: "mg/dL", ref: [7, 20] },
  { id: "50960", name: "Magnesium", unit: "mg/dL", ref: [1.6, 2.6] },
  { id: "50931", name: "Glucose", unit: "mg/dL", ref: [70, 140] },
];

export function VitalsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const enc = encounterById(id ?? "");
  const [tab, setTab] = useState<"vitals" | "labs">("vitals");
  const [values, setValues] = useState<Record<string, string>>({});
  const [timing, setTiming] = useState<"at_admission" | "since">("at_admission");
  const [toast, setToast] = useState<string | null>(null);

  if (!enc) return <Navigate to="/nurse/my-patients" replace />;

  const entered = Object.values(values).filter(Boolean).length;
  const num = (v: string | undefined) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  const countsForModels = timing === "at_admission";

  function flag(v: string, lo: number, hi: number, normal: [number, number]) {
    const n = Number(v);
    if (!v || Number.isNaN(n)) return null;
    if (n < lo || n > hi) return "impossible";
    if (n < normal[0] || n > normal[1]) return "abnormal";
    return "normal";
  }

  return (
    <>
      <PageHeader
        eyebrow="Fast entry"
        title={`Vitals & labs — ${enc.patient.name}`}
        lede={`${enc.bed} · ${enc.unitName} · ${enc.patient.mrn}`}
        meta={<T0Chip t0={enc.t0} />}
        actions={
          <>
            <Button onClick={() => nav(`/nurse/encounters/${enc.id}/results`)}>Back to results</Button>
            <Button
              variant="primary"
              disabled={entered === 0}
              onClick={() => void act(
                () => api.post(`/api/v1/encounters/${enc.id}/vitals`, {
                  bp_sys: num(values.sbp),
                  bp_dia: num(values.dbp),
                  heart_rate: num(values.hr),
                  resp_rate: num(values.rr),
                  temp_c: num(values.temp),
                  spo2: num(values.spo2),
                  weight_kg: num(values.weight),
                  height_cm: num(values.height),
                  labs: Object.fromEntries(LABS.filter((l) => num(values[l.id]) !== null).map((l) => [l.id, Number(values[l.id])])),
                  at_t0: countsForModels,
                }),
                () => countsForModels
                  ? `${entered} values saved inside the t0 cut — they fill the intake and reach the models on the next assessment run`
                  : `${entered} values saved to the chart only — taken after admission, so they never reach a model`,
              ).then(setToast)}
            >
              Save {entered > 0 ? `${entered} value${entered > 1 ? "s" : ""}` : ""}
            </Button>
          </>
        }
      />

      <Card title="When were these taken?" subtitle="This determines whether the models can use them">
        <SegmentedControl
          ariaLabel="Timing"
          value={timing}
          onChange={setTiming}
          options={[
            { value: "at_admission", label: "At or before admission" },
            { value: "since", label: "Since admission" },
          ]}
        />
        {countsForModels ? (
          <Banner tone="good" title="These will be used by the models">
            Values at or before t₀ ({dateTimeLabel(enc.t0)}) are inside the intake cut. Saving them
            re-runs M-01 – M-05 and the estimates on the results page will move.
          </Banner>
        ) : (
          <Banner tone="warning" title="These go to the chart but not to the models">
            Anything recorded after admission is outside the intake cut. It is saved and visible on the
            timeline, and it is deliberately excluded from every estimate — including it would be
            time-travel, and it is the single failure mode that would invalidate the whole system.
          </Banner>
        )}
      </Card>

      <SegmentedControl
        ariaLabel="Entry type"
        value={tab}
        onChange={setTab}
        options={[
          { value: "vitals", label: "Vitals", icon: <ActivityIcon size={14} /> },
          { value: "labs", label: "Labs", icon: <FlaskIcon size={14} /> },
        ]}
      />

      {tab === "vitals" ? (
        <Card title="Vitals" subtitle="Tab moves between fields. Leave anything you did not measure blank.">
          <div className="fast-grid">
            {VITALS.map((v) => {
              const f = flag(values[v.k] ?? "", v.lo, v.hi, v.normal as [number, number]);
              return (
                <Field
                  key={v.k}
                  label={`${v.label} (${v.unit})`}
                  error={f === "impossible" ? `Outside the possible range ${v.lo}–${v.hi}` : undefined}
                  hint={f === "abnormal" ? `Outside the usual range ${v.normal[0]}–${v.normal[1]}` : undefined}
                >
                  <div className="fast-input">
                    <TextInput
                      type="number"
                      className={cx("tnum", "fast-field")}
                      inputMode="decimal"
                      placeholder="—"
                      aria-invalid={f === "impossible"}
                      value={values[v.k] ?? ""}
                      onChange={(e) => setValues({ ...values, [v.k]: e.target.value })}
                    />
                    {f === "normal" && <span className="fast-flag is-ok"><CheckIcon size={13} /></span>}
                    {f === "abnormal" && <span className="fast-flag is-warn"><AlertIcon size={13} /></span>}
                  </div>
                </Field>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title="Labs" subtitle="Enter results as they come back. Reference ranges are shown for orientation only.">
          <div className="fast-grid">
            {LABS.map((l) => {
              const n = Number(values[l.id]);
              const out = values[l.id] && !Number.isNaN(n) && (n < l.ref[0] || n > l.ref[1]);
              return (
                <Field
                  key={l.id}
                  label={`${l.name} (${l.unit})`}
                  hint={out ? `Outside reference ${l.ref[0]}–${l.ref[1]}` : `Reference ${l.ref[0]}–${l.ref[1]}`}
                >
                  <div className="fast-input">
                    <TextInput
                      type="number"
                      className="tnum fast-field"
                      inputMode="decimal"
                      placeholder="—"
                      value={values[l.id] ?? ""}
                      onChange={(e) => setValues({ ...values, [l.id]: e.target.value })}
                    />
                    {out && <span className="fast-flag is-warn"><AlertIcon size={13} /></span>}
                  </div>
                  <span className="muted mono" style={{ fontSize: 10.5 }}>itemid {l.id}</span>
                </Field>
              );
            })}
          </div>
        </Card>
      )}

      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone={entered > 0 ? "accent" : "neutral"}>{entered} value{entered === 1 ? "" : "s"} entered</Badge>
        <Badge tone={countsForModels ? "good" : "warning"}>
          {countsForModels ? "inside the t₀ cut" : "outside the t₀ cut — chart only"}
        </Badge>
      </div>

      <AssistiveLine />
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
