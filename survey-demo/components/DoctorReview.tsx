"use client";

import { useState } from "react";
import { AnalysisResult, RiskFlag } from "@/lib/analyze";

export interface FlagReview {
  flagId: string;
  decision: "accept" | "modify" | "dismiss";
  note: string;
}

export interface Prescription {
  drug: string;
  dosage: string;
  frequency: string;
}

export interface DoctorDecision {
  flagReviews: FlagReview[];
  primaryDiagnosis: string;
  secondaryDiagnosis: string;
  icdCode: string;
  clinicalNotes: string;
  treatmentItems: string[];
  treatmentDetails: Record<string, string>;
  prescriptions: Prescription[];
  followUp: string;
  doctorName: string;
}

const TREATMENT_OPTIONS = [
  { id: "labs", label: "Blood / Lab Tests", icon: "🧪" },
  { id: "imaging", label: "Imaging (X-ray / CT / MRI)", icon: "🩻" },
  { id: "medication", label: "Prescription Medication", icon: "💊" },
  { id: "referral", label: "Specialist Referral", icon: "👨‍⚕️" },
  { id: "lifestyle", label: "Lifestyle Modification", icon: "🥗" },
  { id: "physio", label: "Physiotherapy", icon: "🏃" },
  { id: "mental", label: "Mental Health Referral", icon: "🧠" },
  { id: "followup", label: "Scheduled Follow-up Only", icon: "📅" },
];

const FOLLOWUP_OPTIONS = [
  "1 Week", "2 Weeks", "1 Month", "3 Months", "6 Months", "As Needed", "Emergency Return"
];

interface Props {
  result: AnalysisResult;
  onSubmit: (decision: DoctorDecision) => void;
}

export default function DoctorReview({ result, onSubmit }: Props) {
  const [flagReviews, setFlagReviews] = useState<Record<string, FlagReview>>(
    Object.fromEntries(
      result.flags.map((f) => [f.id, { flagId: f.id, decision: "accept", note: "" }])
    )
  );
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("");
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [treatmentItems, setTreatmentItems] = useState<string[]>([]);
  const [treatmentDetails, setTreatmentDetails] = useState<Record<string, string>>({});
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([
    { drug: "", dosage: "", frequency: "" },
  ]);
  const [followUp, setFollowUp] = useState("1 Month");
  const [doctorName, setDoctorName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function setFlagDecision(id: string, decision: FlagReview["decision"]) {
    setFlagReviews((prev) => ({ ...prev, [id]: { ...prev[id], decision } }));
  }

  function setFlagNote(id: string, note: string) {
    setFlagReviews((prev) => ({ ...prev, [id]: { ...prev[id], note } }));
  }

  function toggleTreatment(id: string) {
    setTreatmentItems((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function addPrescription() {
    setPrescriptions((prev) => [...prev, { drug: "", dosage: "", frequency: "" }]);
  }

  function updatePrescription(i: number, field: keyof Prescription, value: string) {
    setPrescriptions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  function removePrescription(i: number) {
    setPrescriptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    const errs: string[] = [];
    if (!primaryDiagnosis.trim()) errs.push("Primary diagnosis is required.");
    if (!clinicalNotes.trim()) errs.push("Clinical notes are required.");
    if (!doctorName.trim()) errs.push("Doctor name / ID is required.");
    if (treatmentItems.includes("medication") && prescriptions.every((p) => !p.drug.trim()))
      errs.push("Add at least one prescription when medication is selected.");
    setErrors(errs);
    if (errs.length > 0) return;

    onSubmit({
      flagReviews: Object.values(flagReviews),
      primaryDiagnosis,
      secondaryDiagnosis,
      icdCode,
      clinicalNotes,
      treatmentItems,
      treatmentDetails,
      prescriptions: prescriptions.filter((p) => p.drug.trim()),
      followUp,
      doctorName,
    });
  }

  const SEVERITY_BORDER: Record<string, string> = {
    critical: "border-red-300 bg-red-50",
    warning: "border-amber-300 bg-amber-50",
    info: "border-blue-300 bg-blue-50",
  };

  const DECISION_STYLES = {
    accept: {
      active: "bg-emerald-500 text-white border-emerald-500",
      inactive: "bg-white text-slate-500 border-slate-200 hover:border-emerald-300",
    },
    modify: {
      active: "bg-amber-500 text-white border-amber-500",
      inactive: "bg-white text-slate-500 border-slate-200 hover:border-amber-300",
    },
    dismiss: {
      active: "bg-slate-500 text-white border-slate-500",
      inactive: "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
    },
  };

  return (
    <div className="space-y-7 pb-8">

      {/* ── Section 1: Flag Reviews ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>
          <h3 className="font-semibold text-slate-800">Review AI Flags</h3>
          <span className="text-xs text-slate-400">Accept, modify, or dismiss each flag</span>
        </div>

        {result.flags.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl text-slate-400 text-sm border border-slate-100">
            No AI flags to review for this patient.
          </div>
        ) : (
          <div className="space-y-3">
            {result.flags.map((flag: RiskFlag) => {
              const review = flagReviews[flag.id];
              return (
                <div key={flag.id} className={`rounded-xl border-2 p-4 ${SEVERITY_BORDER[flag.severity]}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 text-sm">{flag.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{flag.detail}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {(["accept", "modify", "dismiss"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setFlagDecision(flag.id, d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all capitalize ${
                            review.decision === d
                              ? DECISION_STYLES[d].active
                              : DECISION_STYLES[d].inactive
                          }`}
                        >
                          {d === "accept" ? "✓ Accept" : d === "modify" ? "✎ Modify" : "✗ Dismiss"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {review.decision === "modify" && (
                    <div className="mt-3">
                      <textarea
                        value={review.note}
                        onChange={(e) => setFlagNote(flag.id, e.target.value)}
                        placeholder="Add clinical context or correction…"
                        rows={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-amber-300 focus:outline-none focus:border-amber-500 bg-white resize-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Diagnosis ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">2</span>
          <h3 className="font-semibold text-slate-800">Diagnosis</h3>
          <span className="text-xs text-red-400">* required</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-500 block mb-1">Primary Diagnosis *</label>
            <input
              type="text"
              value={primaryDiagnosis}
              onChange={(e) => setPrimaryDiagnosis(e.target.value)}
              placeholder="e.g. Hypertension, Type 2 Diabetes…"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">ICD-10 Code</label>
            <input
              type="text"
              value={icdCode}
              onChange={(e) => setIcdCode(e.target.value)}
              placeholder="e.g. I10, E11"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-slate-500 block mb-1">Secondary / Comorbid Diagnosis</label>
            <input
              type="text"
              value={secondaryDiagnosis}
              onChange={(e) => setSecondaryDiagnosis(e.target.value)}
              placeholder="Optional — additional diagnoses"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: Clinical Notes ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
          <span className="text-xs text-red-400">* required</span>
        </div>
        <textarea
          value={clinicalNotes}
          onChange={(e) => setClinicalNotes(e.target.value)}
          placeholder="Document clinical observations, patient presentation, examination findings, and reasoning behind diagnosis…"
          rows={6}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none resize-none text-sm text-slate-700 placeholder-slate-300 transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1 text-right">{clinicalNotes.length} characters</p>
      </section>

      {/* ── Section 4: Treatment Plan ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">4</span>
          <h3 className="font-semibold text-slate-800">Treatment Plan</h3>
          <span className="text-xs text-slate-400">Select all that apply</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {TREATMENT_OPTIONS.map((opt) => {
            const active = treatmentItems.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleTreatment(opt.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white hover:border-blue-300 text-slate-600"
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-xs font-medium leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {/* Detail fields for selected treatments */}
        {treatmentItems.filter((id) => id !== "medication").map((id) => {
          const opt = TREATMENT_OPTIONS.find((o) => o.id === id)!;
          return (
            <div key={id} className="mb-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">
                {opt.icon} {opt.label} — Details
              </label>
              <input
                type="text"
                value={treatmentDetails[id] ?? ""}
                onChange={(e) =>
                  setTreatmentDetails((prev) => ({ ...prev, [id]: e.target.value }))
                }
                placeholder={`Specify ${opt.label.toLowerCase()} details…`}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
              />
            </div>
          );
        })}
      </section>

      {/* ── Section 5: Prescriptions ── */}
      {treatmentItems.includes("medication") && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">5</span>
            <h3 className="font-semibold text-slate-800">Prescriptions</h3>
          </div>
          <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <input
                    type="text"
                    value={rx.drug}
                    onChange={(e) => updatePrescription(i, "drug", e.target.value)}
                    placeholder="Drug name"
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
                  />
                  <input
                    type="text"
                    value={rx.dosage}
                    onChange={(e) => updatePrescription(i, "dosage", e.target.value)}
                    placeholder="Dosage (e.g. 10mg)"
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
                  />
                  <input
                    type="text"
                    value={rx.frequency}
                    onChange={(e) => updatePrescription(i, "frequency", e.target.value)}
                    placeholder="Frequency (e.g. Once daily)"
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
                  />
                </div>
                {prescriptions.length > 1 && (
                  <button
                    onClick={() => removePrescription(i)}
                    className="p-2.5 rounded-xl border-2 border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-500 transition-all mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addPrescription}
              className="flex items-center gap-1.5 text-sm text-blue-500 font-medium hover:text-blue-700 transition-colors mt-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add another medication
            </button>
          </div>
        </section>
      )}

      {/* ── Section 6: Follow-up + Doctor ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">
            {treatmentItems.includes("medication") ? "6" : "5"}
          </span>
          <h3 className="font-semibold text-slate-800">Follow-up & Sign-off</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Follow-up Schedule</label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFollowUp(opt)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                    followUp === opt
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-teal-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Doctor Name / ID *
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Smith — ID: 10432"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300"
            />
          </div>
        </div>
      </section>

      {/* ── Validation Errors ── */}
      {errors.length > 0 && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">Please fix the following:</p>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white font-bold text-base shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-[.99] flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Submit to Record &amp; Train AI
      </button>
    </div>
  );
}
