/**
 * D2 / N4 — Intake (§12.3.2, §12.4.3).
 *
 * One component serves the physician (review-and-edit of what the nurse
 * captured) and the nurse (first capture). The difference is framing and which
 * sections are expanded, not a second form — a fork here is how the two roles
 * end up disagreeing about what was recorded.
 *
 * Everything on this form is knowable at t0. There is deliberately no field for
 * anything that happens after admission.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ALL_UNITS, encounterById } from "@/mock/db";
import { FairnessNote, SignalRail, T0Chip } from "@/components/clinical";
import { AssistiveLine } from "@/components/ui/domain";
import {
  Badge, Banner, Button, Card, Field, PageHeader, SegmentedControl, Select, TextArea, TextInput, Toggle,
} from "@/components/ui/primitives";
import { Toast } from "@/components/ui/overlays";
import {
  ActivityIcon, AlertIcon, CheckIcon, ClipboardIcon, FlaskIcon, PillIcon, SparkIcon, StethoscopeIcon,
  UserIcon,
} from "@/components/ui/icons";
import { act, isLive } from "@/api/actions";
import { api } from "@/api/client";
import { hydrateFromApi } from "@/api/bootstrap";
import { EMPTY_INTAKE, SAMPLE_PROFILES, toFeatures, type IntakeValues, type VitalKey } from "./intakeForm";
import { useAssessments } from "@/hooks/useAssessments";
import { useSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { myUnitId } from "@/lib/scope";

const VITALS: { key: VitalKey; label: string; unit: string }[] = [
  { key: "bp_sys", label: "Systolic BP", unit: "mmHg" },
  { key: "bp_dia", label: "Diastolic BP", unit: "mmHg" },
  { key: "heart_rate", label: "Heart rate", unit: "/min" },
  { key: "resp_rate", label: "Respiratory rate", unit: "/min" },
  { key: "temp_c", label: "Temperature", unit: "°C" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "height_cm", label: "Height", unit: "cm" },
];

const LABS = [
  { id: "50912", name: "Creatinine", unit: "mg/dL", ref: "0.6–1.3" },
  { id: "50971", name: "Potassium", unit: "mEq/L", ref: "3.5–5.1" },
  { id: "50983", name: "Sodium", unit: "mEq/L", ref: "136–145" },
  { id: "51222", name: "Haemoglobin", unit: "g/dL", ref: "12–17" },
  { id: "51301", name: "White blood cells", unit: "K/uL", ref: "4.5–11" },
  { id: "50813", name: "Lactate", unit: "mmol/L", ref: "0.5–2.0" },
  { id: "50862", name: "Albumin", unit: "g/dL", ref: "3.5–5.0" },
  { id: "51006", name: "Urea nitrogen", unit: "mg/dL", ref: "7–20" },
];

type SectionKey = "demographics" | "context" | "vitals" | "labs" | "history" | "meds" | "notes" | "audit";

type Extracted = { field: string; value: unknown; confidence: number; needs_confirmation: boolean; source_span?: string | null };
type Extraction = { fields: Extracted[]; ask_back: string[]; unresolved: string[]; model_status: string };

type Observation = { atT0: boolean; values: Partial<Record<VitalKey, number | null>> & { labs?: Record<string, number> } };

const VITAL_KEYS: VitalKey[] = ["bp_sys", "bp_dia", "heart_rate", "resp_rate", "temp_c", "spo2", "weight_kg", "height_cm"];

/** Fill blank vitals and labs from at-admission observations, newest first. Never overwrites. */
function withBedside(form: IntakeValues, observations: Observation[]): IntakeValues {
  if (!observations.length) return form;
  const vitals = { ...form.vitals };
  const labs = { ...form.labs };
  for (const o of observations) {
    for (const k of VITAL_KEYS) {
      const v = o.values[k];
      if (v !== null && v !== undefined && !vitals[k]) vitals[k] = String(v);
    }
    for (const [id, v] of Object.entries(o.values.labs ?? {})) if (!labs[id]) labs[id] = String(v);
  }
  return { ...form, vitals, labs };
}

const DICTATION ="81-year-old woman, brought in by ambulance with three days of worsening breathlessness. Known heart failure, on furosemide and ramipril. Two admissions this year.";

export function IntakePage({ isNew, nurseMode }: { isNew?: boolean; nurseMode?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const enc = encounterById(id ?? "");
  const { role } = useSession();
  // Nursing roles admit and capture; running the five models is a prescriber's
  // action (§4.6 `assess:run`). Asking the server anyway only produces a refusal.
  const mayAssess = can(role, "assess:run");
  // A role with no patient:write (case manager, pharmacist, auditor) can still
  // usefully read what was captured at intake — but Save draft / Run assessment
  // both need patient:write and would 403. Show the form read-only instead of a
  // dead button.
  const canWrite = can(role, "patient:write");
  const [toast, setToast] = useState<string | null>(null);
  const [source, setSource] = useState<"form" | "chat">("form");
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    demographics: true, context: true, vitals: true, labs: !nurseMode, history: true,
    meds: !nurseMode, notes: true, audit: false,
  });
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  // Every field is bound rather than uncontrolled, so "Run assessment" sends
  // what is on screen and a sample patient can fill the whole form.
  const [form, setForm] = useState<IntakeValues>(() => ({
    ...EMPTY_INTAKE,
    age: String(enc?.patient.age ?? ""),
    sex: enc?.patient.sex ?? "F",
    admissionType: enc?.admissionType ?? "EW EMER.",
    viaEd: enc?.viaEd ?? true,
    notes: { ...EMPTY_INTAKE.notes, chiefComplaint: enc?.chiefComplaint ?? "" },
  }));
  // An existing encounter opens on what its last assessment was actually given.
  const { latest } = useAssessments(isNew ? undefined : enc?.id);
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || !latest || savedDraftPresent) return;
    setPrefilled(true);
    const f = latest.features;
    const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
    setForm((prev) => withBedside({
      ...prev,
      age: str(f.demographics?.admission_age) || prev.age,
      sex: f.demographics ? (f.demographics.is_female ? "F" : "M") : prev.sex,
      admissionType: f.admission_context?.admission_type ?? prev.admissionType,
      admissionLocation: f.admission_context?.admission_location ?? prev.admissionLocation,
      viaEd: f.admission_context?.via_ed === undefined ? prev.viaEd : Boolean(f.admission_context.via_ed),
      vitals: {
        ...EMPTY_INTAKE.vitals,
        bp_sys: str(f.vitals?.bp_sys), bp_dia: str(f.vitals?.bp_dia),
        weight_kg: str(f.vitals?.weight_kg), height_cm: str(f.vitals?.height_cm),
      },
      labs: Object.fromEntries(Object.entries(f.labs ?? {}).map(([k, v]) => [k, String(v)])),
      priorCcsr: (f.prior_history?.prior_ccsr ?? []).map((code) => ({ code, label: code })),
      priorAdmissions: str(f.prior_history?.n_prior_admissions),
      charlson: str(f.prior_history?.charlson_index),
      meds: (f.meds ?? []).map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
      notes: {
        chiefComplaint: f.notes?.chief_complaint ?? prev.notes.chiefComplaint,
        hpi: f.notes?.hpi ?? "", pmh: f.notes?.pmh ?? "", exam: f.notes?.physical_exam ?? "",
      },
    }, bedside));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  // Bedside values recorded at or before admission (the Vitals & labs screen)
  // fill any field the intake left blank, so they reach the models on the next
  // run. They never overwrite what is already here, and anything recorded
  // after admission is not offered at all — that would move the t₀ cut.
  const [bedside, setBedside] = useState<Observation[]>([]);
  useEffect(() => {
    if (isNew || !enc || !isLive()) return;
    api.get<{ observations: Observation[] }>(`/api/v1/encounters/${enc.id}/vitals`)
      .then((r) => {
        const atT0 = r.observations.filter((o) => o.atT0);
        setBedside(atT0);
        setForm((prev) => withBedside(prev, atT0));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc?.id]);

  // Name any condition that arrived as a bare code, from the server's catalogue.
  const unnamed = form.priorCcsr.some((c) => c.label === c.code);
  useEffect(() => {
    if (!unnamed || !isLive()) return;
    api.get<{ ccsr: { ccsr: string; description: string }[] }>("/api/v1/schema/ccsr")
      .then((r) => {
        const names = Object.fromEntries(r.ccsr.map((c) => [c.ccsr, c.description]));
        setForm((f) => ({ ...f, priorCcsr: f.priorCcsr.map((c) => ({ ...c, label: names[c.code] ?? c.label })) }));
      })
      .catch(() => undefined);
  }, [unnamed]);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const labValues = form.labs;
  // A new patient needs identifying details before there is an encounter to attach to.
  const [admit, setAdmit] = useState({ name: "", mrn: "", unitId: myUnitId() ?? ALL_UNITS[0]?.id ?? "", bed: "" });
  // Captured for the fairness audit on admission only — never sent as a feature.
  const [covariates, setCovariates] = useState({
    race: enc?.patient.auditCovariates.race ?? "",
    insurance: enc?.patient.auditCovariates.insurance ?? "",
    maritalStatus: enc?.patient.auditCovariates.maritalStatus ?? "",
  });
  const [dictation, setDictation] = useState(DICTATION);
  const [ccsrQuery, setCcsrQuery] = useState("");
  const [ccsrHits, setCcsrHits] = useState<{ ccsr: string; description: string }[]>([]);
  const [medQuery, setMedQuery] = useState("");
  const [medHits, setMedHits] = useState<string[]>([]);

  // Search as you type against the server's catalogues — the same vocabularies
  // the models were trained on, so a chosen code is one the models know.
  useEffect(() => {
    const q = ccsrQuery.trim().toLowerCase();
    if (q.length < 2 || !isLive()) { setCcsrHits([]); return; }
    let live = true;
    api.get<{ ccsr: { ccsr: string; description: string }[] }>("/api/v1/schema/ccsr")
      .then((r) => {
        if (!live) return;
        setCcsrHits(r.ccsr.filter((c) => c.ccsr.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
          .filter((c) => !form.priorCcsr.some((p) => p.code === c.ccsr)).slice(0, 8));
      })
      .catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccsrQuery]);

  useEffect(() => {
    const q = medQuery.trim();
    if (q.length < 2 || !isLive()) { setMedHits([]); return; }
    let live = true;
    api.get<{ meds: { name: string }[] }>(`/api/v1/schema/vocab/meds?q=${encodeURIComponent(q)}`)
      .then((r) => { if (live) setMedHits(r.meds.map((m) => m.name).slice(0, 8)); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [medQuery]);

  function addCondition(c: { ccsr: string; description: string }) {
    setForm((f) => ({ ...f, priorCcsr: [...f.priorCcsr, { code: c.ccsr, label: c.description }] }));
    setCcsrQuery("");
  }

  function addMed(name: string) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    setForm((f) => (f.meds.some((m) => m.toLowerCase() === name.toLowerCase()) ? f : { ...f, meds: [...f.meds, label] }));
    setMedQuery("");
  }
  const [extraction, setExtraction] = useState<Extraction | null>(null);

  // Reopen a saved draft exactly as it was left.
  const savedDraft = (enc as (typeof enc & { intakeDraft?: IntakeValues; draftSavedAt?: string; draftSavedBy?: string }) | undefined);
  const savedDraftPresent = Boolean(savedDraft?.intakeDraft);
  const [draftNote] = useState(() => savedDraft?.intakeDraft
    ? `Draft saved by ${savedDraft.draftSavedBy ?? "a colleague"}` : null);
  const [loadedDraft, setLoadedDraft] = useState(false);
  if (!loadedDraft && savedDraft?.intakeDraft) {
    setLoadedDraft(true);
    setForm({ ...EMPTY_INTAKE, ...savedDraft.intakeDraft });
  }

  function saveDraft() {
    if (!enc) {
      setToast(`A draft is kept on the encounter — ${mayAssess ? "run the assessment" : "choose Admit patient"} to admit this patient first.`);
      return;
    }
    void act(
      () => api.put(`/api/v1/encounters/${enc.id}/draft`, { draft: form }),
      () => "Draft saved on the encounter. Nothing has been sent to a model yet.",
    ).then(setToast);
  }

  function extract() {
    void act(
      () => api.post<Extraction>("/api/v1/extract", { text: dictation }),
      (r) => {
        setExtraction(r);
        return r.fields.length
          ? `${r.fields.length} field${r.fields.length === 1 ? "" : "s"} proposed — confirm each before it is used`
          : `The extractor (${r.model_status}) proposed no fields — answer its questions or use the structured form`;
      },
    ).then(setToast);
  }

  function loadSample(id: string) {
    const sample = SAMPLE_PROFILES.find((p) => p.id === id);
    if (!sample) return;
    setForm(sample.values);
    setSampleId(id);
    setToast(`Loaded the ${sample.label} sample — review it, then run the assessment.`);
  }

  function clearForm() {
    setForm(EMPTY_INTAKE);
    setSampleId(null);
  }

  /**
   * Build the IntakeRequest from what is on the form.
   *
   * Audit covariates are deliberately absent: they are captured on the
   * encounter for the fairness panel and are refused inside `features` by the
   * server, so there is nowhere for them to leak into a prediction from here.
   */
  function buildCase(encounterId: string) {
    return {
      features: toFeatures(form),
      encounter_id: encounterId,
      provenance: {
        source,
        field_confidence: {},
        // Anything extracted but not ticked stays unconfirmed, and the server
        // marks every differential row it touched.
        needs_confirmation: source === "chat"
          ? ["prior_history.prior_ccsr"].filter(() => !Object.values(confirmed).some(Boolean))
          : [],
      },
    };
  }

  /**
   * Admit (for a new patient), then assess. Admitting stamps t₀ on the server,
   * so the cut every feature respects is the moment of admission — never a
   * time the client chose.
   */
  async function runAssessment() {
    if (!enc && (!admit.name.trim() || !admit.mrn.trim() || !admit.unitId || !form.age)) {
      setToast("Fill in the patient's name, MRN, unit and age to admit them first.");
      return;
    }
    setBusy(true);
    let encounterId = enc?.id ?? "";
    const message = await act(
      async () => {
        if (!encounterId) {
          const created = await api.post<{ id: string }>("/api/v1/encounters", {
            mrn: admit.mrn.trim(), name: admit.name.trim(), age: Number(form.age) || 0, sex: form.sex,
            unit_id: admit.unitId, bed: admit.bed.trim(), admission_type: form.admissionType, via_ed: form.viaEd,
            chief_complaint: form.notes.chiefComplaint.trim(),
            race: covariates.race || null, insurance: covariates.insurance || null, marital_status: covariates.maritalStatus || null,
          });
          encounterId = created.id;
        }
        if (mayAssess) {
          await api.post(`/api/v1/assess?top_n=10`, buildCase(encounterId));
        } else {
          // Keep what was captured, so the prescriber who runs it starts from it.
          await api.put(`/api/v1/encounters/${encounterId}/draft`, { draft: form });
        }
        await hydrateFromApi();
      },
      () => (!mayAssess
        ? `${enc ? "Intake saved" : "Patient admitted"} — awaiting assessment by a physician or NP/PA; opening the results`
        : enc ? "Assessment complete — opening the results" : "Patient admitted and assessed — opening the results"),
    );
    setBusy(false);
    setToast(message);
    if (message.includes("opening the results")) {
      setTimeout(() => nav(`/${nurseMode ? "nurse" : "doctor"}/encounters/${encounterId}/results`), 700);
    }
  }

  const title = isNew ? (nurseMode ? "Admit a patient" : "New encounter") : "Intake";
  const lede = nurseMode
    ? "You are capturing the admission record that all five models run on. Everything here is knowable at the moment of admission — there is no field for anything that happens later, by design."
    : "Review and correct what was captured at admission. Your edits re-run the models against the same t₀ cut; they never move the cut forward.";

  const completeness = useMemo(() => {
    const filled = Object.values(labValues).filter(Boolean).length;
    return Math.min(0.98, 0.32 + filled * 0.08 + (openSections.notes ? 0.12 : 0));
  }, [labValues, openSections.notes]);

  function toggle(k: SectionKey) {
    setOpenSections((s) => ({ ...s, [k]: !s[k] }));
  }

  return (
    <>
      <PageHeader
        eyebrow={nurseMode ? "Nurse intake capture" : "Physician review"}
        title={enc && !isNew ? `${title} — ${enc.patient.name}` : title}
        lede={lede}
        meta={
          <>
            {enc && <T0Chip t0={enc.t0} />}
            <Badge tone="accent" icon={<CheckIcon size={11} />}>Intake-only · nothing post-admission</Badge>
          </>
        }
        actions={
          canWrite && (
            <>
              <Button onClick={saveDraft}>Save draft</Button>
              <Button
                variant="primary"
                icon={<StethoscopeIcon size={15} />}
                disabled={busy}
                onClick={() => void runAssessment()}
              >
                {mayAssess ? (enc ? "Run assessment" : "Admit & run assessment") : (enc ? "Save intake" : "Admit patient")}
              </Button>
            </>
          )
        }
      />

      {!canWrite && (
        <Banner tone="info" title="Read-only">
          Your role can review what was captured at intake but not edit it or run a new assessment.
        </Banner>
      )}

      {canWrite && (
      <Banner tone="accent" title="Two ways to fill this in">
        <SegmentedControl
          size="sm"
          ariaLabel="Capture mode"
          value={source}
          onChange={setSource}
          options={[
            { value: "form", label: "Structured form", icon: <ClipboardIcon size={13} /> },
            { value: "chat", label: "Dictate / describe", icon: <SparkIcon size={13} /> },
          ]}
        />
      </Banner>
      )}

      {canWrite && source === "form" && (
        <div className="sample-loader">
          <div className="sample-loader-head">
            <strong>Load a sample patient</strong>
            <span className="muted">Illustrative demo data — replaces the form.</span>
          </div>
          {SAMPLE_PROFILES.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={sampleId === p.id ? "primary" : undefined}
              title={p.blurb}
              onClick={() => loadSample(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="sample-loader-clear" onClick={clearForm}>
            Clear
          </Button>
        </div>
      )}

      {source === "chat" && (
        <Card
          title="Describe the admission"
          subtitle="The extractor proposes structured fields; nothing is accepted until you confirm it"
          footnote="Every extracted field arrives marked unconfirmed and carries its source span. An unconfirmed field is used by the models but is flagged as such on the results — it never silently becomes fact."
        >
          <TextArea
            rows={4}
            placeholder={DICTATION}
            value={dictation}
            onChange={(e) => { setDictation(e.currentTarget.value); setExtraction(null); }}
          />
          <div className="row" style={{ gap: 8 }}>
            <Button icon={<SparkIcon size={14} />} disabled={!dictation.trim()} onClick={extract}>Extract fields</Button>
          </div>
          {extraction && (
            <>
              {extraction.fields.length === 0 ? (
                <Banner tone="warning" title={`The extractor proposed no fields (${extraction.model_status})`}>
                  Nothing is filled in from free text until the extraction service is live. Use the structured
                  form, or answer these first:
                  <ul style={{ margin: "6px 0 0" }}>
                    {extraction.ask_back.map((q) => <li key={q}>{q}</li>)}
                  </ul>
                </Banner>
              ) : (
                <div className="extract-list">
                  {extraction.fields.map((x) => {
                    const key = `${x.field}-${String(x.value)}`;
                    return (
                      <div key={key} className="extract-row">
                        <span className="extract-field">{x.field}</span>
                        <span className="extract-value">{String(x.value)}</span>
                        <span className="tnum extract-conf">{(x.confidence * 100).toFixed(0)}%</span>
                        {confirmed[key] ? (
                          <span className="pill pill-good"><CheckIcon size={12} /> Confirmed</span>
                        ) : (
                          <Button size="sm" onClick={() => setConfirmed((c) => ({ ...c, [key]: true }))}>Confirm</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {bedside.length > 0 && (
        <Banner tone="accent" title={`${bedside.length} bedside reading${bedside.length > 1 ? "s" : ""} from admission`}>
          Values recorded on the Vitals &amp; labs screen at or before admission fill any field below that
          was blank. Review them — they are sent to the models the next time the assessment runs.
        </Banner>
      )}
      {draftNote && <Banner tone="accent" title={draftNote}>The form below is the saved draft. Run the assessment when it is ready.</Banner>}

      <div className="split">
        <div className="stack" style={{ gap: 16 }}>
          {!enc && (
            <Card title="Patient" subtitle="Admitting stamps t₀ — the moment every model's inputs are cut at">
              <div className="grid grid-2">
                <Field label="Full name" required>
                  <TextInput value={admit.name} onChange={(e) => setAdmit({ ...admit, name: e.currentTarget.value })} />
                </Field>
                <Field label="MRN" required>
                  <TextInput className="mono" placeholder="MRN-" value={admit.mrn} onChange={(e) => setAdmit({ ...admit, mrn: e.currentTarget.value })} />
                </Field>
                <Field label="Unit" required>
                  <Select value={admit.unitId} onChange={(e) => setAdmit({ ...admit, unitId: e.currentTarget.value })}>
                    {ALL_UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Select>
                </Field>
                <Field label="Bed">
                  <TextInput value={admit.bed} onChange={(e) => setAdmit({ ...admit, bed: e.currentTarget.value })} />
                </Field>
              </div>
            </Card>
          )}
          <IntakeSection
            k="demographics" open={openSections.demographics} onToggle={toggle}
            icon={<UserIcon size={16} />} title="Demographics" level="required"
            hint="Age and sex are the only demographic inputs any model receives."
          >
            <div className="grid grid-2">
              <Field label="Age at admission" required><TextInput type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.currentTarget.value })} className="tnum" /></Field>
              <Field label="Sex" required>
                <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.currentTarget.value as "F" | "M" })}>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </Select>
              </Field>
            </div>
          </IntakeSection>

          <IntakeSection
            k="context" open={openSections.context} onToggle={toggle}
            icon={<ActivityIcon size={16} />} title="Admission context" level="required"
            hint="How the patient arrived. This is one of the strongest intake-time signals for M-02 and M-03."
          >
            <div className="grid grid-2">
              <Field label="Admission type" required>
                <Select value={form.admissionType} onChange={(e) => setForm({ ...form, admissionType: e.currentTarget.value })}>
                  {["EW EMER.", "URGENT", "ELECTIVE", "OBSERVATION ADMIT", "DIRECT EMER."].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Admission location">
                <Select value={form.admissionLocation} onChange={(e) => setForm({ ...form, admissionLocation: e.currentTarget.value })}>
                  {["EMERGENCY ROOM", "PHYSICIAN REFERRAL", "TRANSFER FROM HOSPITAL", "CLINIC REFERRAL", "WALK-IN"].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <Toggle checked={form.viaEd} onChange={(v) => setForm({ ...form, viaEd: v })} label="Arrived via the emergency department" hint="Recorded separately from admission type because the two diverge for direct emergency admissions." />
          </IntakeSection>

          <IntakeSection
            k="vitals" open={openSections.vitals} onToggle={toggle}
            icon={<ActivityIcon size={16} />} title="Presenting vitals" level="recommended"
            hint="First recorded set. Leave blank rather than guessing — a blank is handled honestly, a guess is not."
          >
            <div className="grid grid-3">
              {VITALS.map((f) => (
                <Field key={f.key} label={`${f.label} (${f.unit})`}>
                  <TextInput
                    type="number"
                    className="tnum"
                    value={form.vitals[f.key]}
                    onChange={(e) => setForm({ ...form, vitals: { ...form.vitals, [f.key]: e.currentTarget.value } })}
                  />
                </Field>
              ))}
            </div>
          </IntakeSection>

          <IntakeSection
            k="labs" open={openSections.labs} onToggle={toggle}
            icon={<FlaskIcon size={16} />} title="Early labs" level="recommended"
            hint="Only results drawn before or at admission. A result timestamped after t₀ is leakage and is rejected."
          >
            <div className="lab-grid">
              {LABS.map((l) => (
                <div key={l.id} className="lab-row">
                  <div className="cell-stack">
                    <strong>{l.name}</strong>
                    <span className="muted mono">{l.id} · ref {l.ref} {l.unit}</span>
                  </div>
                  <TextInput
                    className="tnum"
                    style={{ width: 92 }}
                    placeholder="—"
                    value={labValues[l.id] ?? ""}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, labs: { ...f.labs, [l.id]: value } }));
                    }}
                    aria-label={l.name}
                  />
                </div>
              ))}
            </div>
          </IntakeSection>

          <IntakeSection
            k="history" open={openSections.history} onToggle={toggle}
            icon={<ClipboardIcon size={16} />} title="Prior history" level="recommended"
            hint="Coded prior conditions and admission counts. This is the single biggest driver of M-01 accuracy — a cold-start patient scores materially worse."
          >
            <Field label="Prior conditions (CCSR)" hint="Type to search the 502-category CCSR taxonomy.">
              <TextInput placeholder="Search a condition or CCSR code" value={ccsrQuery} onChange={(e) => setCcsrQuery(e.currentTarget.value)} />
            </Field>
            {ccsrHits.length > 0 && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {ccsrHits.map((c) => (
                  <Button key={c.ccsr} size="sm" variant="ghost" onClick={() => addCondition(c)}>+ {c.ccsr} {c.description}</Button>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {form.priorCcsr.length === 0 && (
                <span className="muted" style={{ fontSize: 12.5 }}>None recorded — this is scored as a cold-start patient.</span>
              )}
              {form.priorCcsr.map((c) => (
                <span key={c.code} className="chip">
                  {c.code} {c.label}
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove ${c.label}`}
                    onClick={() => setForm({ ...form, priorCcsr: form.priorCcsr.filter((x) => x.code !== c.code) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-2">
              <Field label="Prior admissions (12 months)"><TextInput type="number" value={form.priorAdmissions} onChange={(e) => setForm({ ...form, priorAdmissions: e.currentTarget.value })} className="tnum" /></Field>
              <Field label="Charlson comorbidity index" hint="Leave blank if not calculated — it is imputed, and the imputation is disclosed on the result.">
                <TextInput
                  type="number"
                  className="tnum"
                  value={form.charlson}
                  onChange={(e) => setForm({ ...form, charlson: e.currentTarget.value })}
                />
              </Field>
            </div>
          </IntakeSection>

          <IntakeSection
            k="meds" open={openSections.meds} onToggle={toggle}
            icon={<PillIcon size={16} />} title="Medications on admission" level="optional"
            hint="What the patient was already taking when they arrived — not what has been prescribed since."
          >
            <Field label="Add a medication">
              <TextInput placeholder="Search the formulary" value={medQuery} onChange={(e) => setMedQuery(e.currentTarget.value)} />
            </Field>
            {medHits.length > 0 && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {medHits.map((m) => <Button key={m} size="sm" variant="ghost" onClick={() => addMed(m)}>+ {m}</Button>)}
              </div>
            )}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {form.meds.length === 0 && (
                <span className="muted" style={{ fontSize: 12.5 }}>No medications recorded.</span>
              )}
              {form.meds.map((m) => (
                <span key={m} className="chip">
                  {m}
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={`Remove ${m}`}
                    onClick={() => setForm({ ...form, meds: form.meds.filter((x) => x !== m) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </IntakeSection>

          <IntakeSection
            k="notes" open={openSections.notes} onToggle={toggle}
            icon={<ClipboardIcon size={16} />} title="Admission note" level="optional"
            hint="Free text from the admitting clinician. Used by the note tower; having one materially improves the differential."
          >
            {([
              { key: "chiefComplaint", label: "Chief complaint", rows: 2 },
              { key: "hpi", label: "History of present illness", rows: 4 },
              { key: "pmh", label: "Past medical history", rows: 3 },
              { key: "exam", label: "Physical examination", rows: 3 },
            ] as const).map((f) => (
              <Field key={f.key} label={f.label}>
                <TextArea
                  rows={f.rows}
                  value={form.notes[f.key]}
                  onChange={(e) => setForm({ ...form, notes: { ...form.notes, [f.key]: e.currentTarget.value } })}
                />
              </Field>
            ))}
          </IntakeSection>

          <IntakeSection
            k="audit" open={openSections.audit} onToggle={toggle}
            icon={<AlertIcon size={16} />} title="Audit covariates" level="never-a-model-input"
            hint="Captured for the fairness audit only."
          >
            <Banner tone="warning" title="These are never model inputs">
              Race, insurance and marital status are recorded so the fairness panel can report whether
              the models perform differently across groups. They are stored beside the features, never
              inside them, and they never appear on a clinical screen.
            </Banner>
            <div className="grid grid-3">
              <Field label="Race / ethnicity">
                <Select value={covariates.race} disabled={Boolean(enc)} onChange={(e) => setCovariates({ ...covariates, race: e.currentTarget.value })}>
                  <option value="">Not recorded</option>
                  {["White", "Black/African American", "Hispanic/Latino", "Asian", "Other/Declined"].map((r) => <option key={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Insurance">
                <Select value={covariates.insurance} disabled={Boolean(enc)} onChange={(e) => setCovariates({ ...covariates, insurance: e.currentTarget.value })}>
                  <option value="">Not recorded</option>
                  {["Medicare", "Medicaid", "Private", "Self-pay"].map((r) => <option key={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Marital status">
                <Select value={covariates.maritalStatus} disabled={Boolean(enc)} onChange={(e) => setCovariates({ ...covariates, maritalStatus: e.currentTarget.value })}>
                  <option value="">Not recorded</option>
                  {["Married", "Single", "Widowed", "Divorced"].map((r) => <option key={r}>{r}</option>)}
                </Select>
              </Field>
            </div>
            <FairnessNote />
          </IntakeSection>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {enc ? (
            <SignalRail enc={{ ...enc, signalCompleteness: completeness }} />
          ) : (
            <Card title="Signal completeness" subtitle="Updates as you fill the form">
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Demographics and admission context are enough to run. Everything above that narrows the
                interval — prior history and an admission note are worth the most.
              </p>
            </Card>
          )}

          <Card title="What happens when you run this" subtitle="No surprises">
            <ol className="run-steps">
              <li>The form is frozen at t₀ and every feature is cut at that instant.</li>
              <li>M-01 scores ~502 CCSR conditions; M-02 – M-05 each produce one estimate.</li>
              <li>Per-label calibration is applied, or suppressed if required inputs were imputed.</li>
              <li>Drivers are computed from the model itself — not narrated afterwards.</li>
              <li>The run is written to the audit log with your name against it.</li>
            </ol>
          </Card>

          {nurseMode && (
            <Card title="After you save" subtitle="Handoff">
              <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                {mayAssess ? (
                  <>Saving hands this encounter to the attending as <strong>assessed, awaiting review</strong>.</>
                ) : (
                  <>Saving hands this encounter to the attending as <strong>awaiting assessment</strong>; a
                  physician or NP/PA runs the models from what you captured.</>
                )}{" "}
                You do not acknowledge the result — that is the physician&rsquo;s signature. If something
                looks wrong to you, escalate from the read-only results view.
              </p>
            </Card>
          )}

          <AssistiveLine />
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function IntakeSection({
  k, open, onToggle, icon, title, level, hint, children,
}: {
  k: SectionKey; open: boolean; onToggle: (k: SectionKey) => void;
  icon: React.ReactNode; title: string; level: string; hint: string; children: React.ReactNode;
}) {
  return (
    <section className="card intake-section">
      <button type="button" className="intake-head" onClick={() => onToggle(k)} aria-expanded={open}>
        <span className="intake-icon">{icon}</span>
        <span className="intake-head-text">
          <strong>{title}</strong>
          <span>{hint}</span>
        </span>
        <span className={`level-tag level-${level.replace(/[^a-z]/g, "")}`}>{level.replace(/-/g, " ")}</span>
      </button>
      {open && <div className="intake-body">{children}</div>}
    </section>
  );
}
