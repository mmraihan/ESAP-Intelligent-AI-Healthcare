/**
 * N6 — Triage (§12.4.5). ED / admitting-unit acuity screen.
 *
 * Minimal-field intake plus the signal rail, because in triage the honest
 * question is "have I given it enough to say anything useful yet?". The screen
 * refuses to show an estimate until the minimum signal is met, rather than
 * showing a confident-looking number built on two fields.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ENCOUNTERS } from "@/mock/db";
import { ago, pct, percentilePhrase, seqToken } from "@/lib/format";
import {
  Badge, Banner, Button, Card, Field, Meter, PageHeader, Select, TextArea, TextInput, Toggle, cx,
} from "@/components/ui/primitives";
import { AssistiveLine } from "@/components/ui/domain";
import { RiskGauge } from "@/components/ui/charts";
import { Toast } from "@/components/ui/overlays";
import { ActivityIcon, AlertIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";
import { ALL_UNITS } from "@/mock/db";
import { myUnitId } from "@/lib/scope";
import { actAndRefresh } from "@/api/actions";
import { api } from "@/api/client";

const MIN_FIELDS = ["age", "sex", "admissionType"] as const;

export function TriagePage() {
  const nav = useNavigate();
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ age: "", sex: "F", admissionType: "EW EMER.", complaint: "" });
  const [viaEd, setViaEd] = useState(true);
  const [vitals, setVitals] = useState<Record<string, string>>({});
  // Set by the create call so the navigation can land on the new encounter.
  let created = "";

  const filledMin = MIN_FIELDS.every((f) => form[f]?.trim());
  const vitalCount = Object.values(vitals).filter(Boolean).length;
  const signal = useMemo(() => {
    let s = 0;
    if (filledMin) s += 0.4;
    s += Math.min(0.35, vitalCount * 0.09);
    if (form.complaint.trim().length > 20) s += 0.15;
    return Math.min(0.95, s);
  }, [filledMin, vitalCount, form.complaint]);

  const minimumSignalMet = filledMin && vitalCount >= 2;

  // A provisional estimate only exists once the minimum signal is met.
  const provisional = minimumSignalMet
    ? {
        mortality: Math.min(0.9, 0.04 + (Number(form.age) || 50) / 220 + (viaEd ? 0.06 : 0) + vitalCount * 0.01),
        icu: Math.min(0.92, 0.09 + (viaEd ? 0.14 : 0) + (Number(vitals.rr) > 22 ? 0.18 : 0) + (Number(form.age) || 50) / 380),
      }
    : null;

  const waiting = ENCOUNTERS.filter((e) => e.viaEd && e.state !== "closed").slice(0, 7);

  return (
    <>
      <PageHeader
        eyebrow="Emergency / admitting"
        title="Triage"
        lede="Capture the minimum needed to get a provisional read, then keep adding. Nothing is estimated until there is enough input to say something honest."
        actions={<Button variant="primary" onClick={() => void actAndRefresh(
          () => api.post<{ id: string }>("/api/v1/encounters", {
            mrn: `MRN-${Date.now().toString().slice(-6)}`,
            name: form.name || "Unidentified patient",
            age: Number(form.age) || 0,
            sex: form.sex === "M" ? "M" : "F",
            // Land the patient on the triaging nurse's own unit, not whichever
            // unit happens to sort first — the ED/admitting screen has no unit
            // picker of its own, so this silently decided where every triaged
            // patient went.
            unit_id: myUnitId() ?? ALL_UNITS[0]?.id ?? "",
            admission_type: form.admissionType,
            via_ed: viaEd,
            chief_complaint: form.complaint,
          }),
          (e) => { created = e.id; return "Encounter created — continue to the full intake"; },
        ).then((m) => {
          setToast(m);
          if (created) setTimeout(() => nav(`/nurse/encounters/${created}/intake`), 800);
        })}>Create encounter</Button>}
      />

      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Minimum viable intake" subtitle="Three fields get you to a provisional read; vitals make it usable">
            <div className="grid grid-3">
              <Field label="Age" required>
                <TextInput type="number" className="tnum" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="—" />
              </Field>
              <Field label="Sex" required>
                <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </Select>
              </Field>
              <Field label="Admission type" required>
                <Select value={form.admissionType} onChange={(e) => setForm({ ...form, admissionType: e.target.value })}>
                  {["EW EMER.", "URGENT", "DIRECT EMER.", "OBSERVATION ADMIT"].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <Toggle checked={viaEd} onChange={setViaEd} label="Arrived via the emergency department" hint="One of the strongest single intake-time signals for both M-02 and M-03." />
            <Field label="Presenting complaint" hint="A sentence is enough. Free text feeds the note tower.">
              <TextArea rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} placeholder="Three days of worsening breathlessness, worse on exertion" />
            </Field>
          </Card>

          <Card title="Presenting vitals" subtitle="Two or more unlocks a provisional estimate">
            <div className="grid grid-3">
              {[
                { k: "sbp", label: "Systolic BP", unit: "mmHg" },
                { k: "dbp", label: "Diastolic BP", unit: "mmHg" },
                { k: "hr", label: "Heart rate", unit: "/min" },
                { k: "rr", label: "Respiratory rate", unit: "/min" },
                { k: "temp", label: "Temperature", unit: "°C" },
                { k: "spo2", label: "SpO₂", unit: "%" },
              ].map((v) => (
                <Field key={v.k} label={`${v.label} (${v.unit})`}>
                  <TextInput
                    type="number"
                    className="tnum"
                    placeholder="—"
                    value={vitals[v.k] ?? ""}
                    onChange={(e) => setVitals({ ...vitals, [v.k]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
          </Card>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Card
            title="Signal completeness"
            subtitle={minimumSignalMet ? "Minimum signal met" : "Below the minimum signal threshold"}
            footnote="The threshold is not a formality. Below it, the calibration that makes these numbers meaningful has not been validated, so no number is shown at all."
          >
            <Meter value={signal} color={seqToken(signal)} height={8} label="Signal completeness" />
            <ul className="signal-list">
              {[
                { label: "Age, sex, admission type", ok: filledMin },
                { label: "At least two vitals", ok: vitalCount >= 2 },
                { label: "Presenting complaint", ok: form.complaint.trim().length > 20 },
                { label: "Prior history (adds most)", ok: false },
              ].map((s) => (
                <li key={s.label} className={cx(s.ok && "is-present")}>
                  {s.ok ? <CheckIcon size={13} /> : <span className="signal-dot" aria-hidden="true" />}
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </Card>

          {provisional ? (
            <Card
              title="Provisional read"
              subtitle="Uncalibrated — for triage ordering only"
              actions={<Badge tone="warning" icon={<AlertIcon size={11} />}>provisional</Badge>}
              footnote="These are not calibrated probabilities. With this little input the ordering is informative and the absolute values are not. They are shown here because triage is a ranking decision."
            >
              <div className="row" style={{ gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
                <RiskGauge label="ICU admission" modelId="M-03" probability={provisional.icu} calibrated={false} size={116} />
                <RiskGauge label="In-hospital mortality" modelId="M-02" probability={provisional.mortality} calibrated={false} size={116} />
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: "center" }}>
                ICU estimate is {percentilePhrase(provisional.icu)}.
              </p>
            </Card>
          ) : (
            <Card title="No estimate yet" subtitle="This is deliberate">
              <p className="prose" style={{ margin: 0 }}>
                Age and sex alone are not enough for a useful estimate, and a number produced from them
                would look far more certain than it is. Add two vitals and a provisional read appears —
                clearly labelled as uncalibrated.
              </p>
            </Card>
          )}

          <AssistiveLine />
        </div>
      </div>

      <Card
        title={<span className="row" style={{ gap: 7 }}><ClockIcon size={16} /> In the department now</span>}
        subtitle={`${waiting.length} patients arrived via the ED and are still open`}
        padded={false}
      >
        <div className="scroll-x">
          <table className="data-table is-dense">
            <thead>
              <tr><th>Patient</th><th>Complaint</th><th className="col-secondary">Waiting</th><th style={{ textAlign: "right" }}>ICU</th><th style={{ textAlign: "right" }}>Mortality</th></tr>
            </thead>
            <tbody>
              {waiting.map((e) => (
                <tr key={e.id} className="is-clickable" onClick={() => nav(`/nurse/encounters/${e.id}/results`)}>
                  <td>
                    <div className="cell-stack">
                      <strong>{e.patient.name}</strong>
                      <span className="muted mono">{e.patient.mrn}</span>
                    </div>
                  </td>
                  <td>{e.chiefComplaint}</td>
                  <td className="col-secondary muted">{ago(e.admittedAt)}</td>
                  <td style={{ textAlign: "right" }} className="tnum">{pct(e.risks.icu, 0)}</td>
                  <td style={{ textAlign: "right" }} className="tnum">{pct(e.risks.mortality, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Banner tone="accent" icon={<ActivityIcon size={16} />} title="Triage estimates are provisional by construction">
        An ED triage record is the thinnest input the models ever see. Every estimate produced from one
        carries the uncalibrated badge until the full intake lands, and the results page will re-run and
        re-label it automatically.
      </Banner>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
