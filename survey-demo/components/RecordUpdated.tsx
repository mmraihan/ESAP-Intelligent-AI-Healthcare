"use client";

import { DoctorDecision } from "@/components/DoctorReview";
import { AnalysisResult } from "@/lib/analyze";

interface Props {
  decision: DoctorDecision;
  result: AnalysisResult;
  onNewPatient: () => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-600 bg-red-50",
  soon: "text-amber-600 bg-amber-50",
  routine: "text-slate-600 bg-slate-100",
};

export default function RecordUpdated({ decision, result, onNewPatient }: Props) {
  const now = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const accepted = decision.flagReviews.filter((r) => r.decision === "accept").length;
  const modified = decision.flagReviews.filter((r) => r.decision === "modify").length;
  const dismissed = decision.flagReviews.filter((r) => r.decision === "dismiss").length;

  const aiImpact = modified + dismissed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-5">

        {/* ── Header ── */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Record Updated</h1>
          <p className="text-slate-500 mt-1 text-sm">Patient record saved · AI feedback loop triggered</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium border border-teal-200">
              {now}
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-200">
              Signed by {decision.doctorName}
            </span>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Flags Accepted", value: accepted, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Flags Modified", value: modified, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Flags Dismissed", value: dismissed, color: "text-slate-500", bg: "bg-slate-50 border-slate-100" },
            { label: "AI Training Items", value: aiImpact, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Diagnosis Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-blue-500 to-teal-400">
            <h2 className="text-sm font-semibold text-white">Confirmed Diagnosis</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 font-medium mb-0.5">Primary</p>
              <p className="text-slate-800 font-bold">{decision.primaryDiagnosis || "—"}</p>
            </div>
            {decision.icdCode && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">ICD-10</p>
                <p className="text-slate-700 font-semibold font-mono">{decision.icdCode}</p>
              </div>
            )}
            {decision.secondaryDiagnosis && (
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Secondary</p>
                <p className="text-slate-700">{decision.secondaryDiagnosis}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Treatment + Prescriptions ── */}
        {(decision.treatmentItems.length > 0 || decision.prescriptions.length > 0) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <h2 className="text-sm font-semibold text-slate-800">Treatment Plan</h2>
            </div>
            <div className="p-5 space-y-3">
              {decision.treatmentItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {decision.treatmentItems.map((id) => (
                    <span key={id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium capitalize">
                      {id.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
              {decision.prescriptions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Prescriptions</p>
                  <div className="space-y-1.5">
                    {decision.prescriptions.map((rx, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-base">💊</span>
                        <span className="text-sm font-semibold text-slate-700">{rx.drug}</span>
                        {rx.dosage && <span className="text-xs text-slate-500">{rx.dosage}</span>}
                        {rx.frequency && (
                          <span className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-600 ml-auto">
                            {rx.frequency}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 text-xs">Follow-up:</span>
                <span className="font-semibold text-slate-700">📅 {decision.followUp}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Clinical Notes ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">Clinical Notes</h2>
          </div>
          <p className="px-5 py-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {decision.clinicalNotes}
          </p>
        </div>

        {/* ── AI Feedback Impact ── */}
        {aiImpact > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-2xl p-5 text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-base">AI Training Impact</p>
                <p className="text-white/80 text-sm mt-0.5">
                  {aiImpact} doctor correction{aiImpact > 1 ? "s" : ""} submitted to the RLHF training queue.
                  The AI model will improve its clinical reasoning based on this feedback.
                </p>
                <div className="flex gap-4 mt-3">
                  {modified > 0 && (
                    <div className="text-center">
                      <p className="text-xl font-bold">{modified}</p>
                      <p className="text-xs text-white/70">Modified</p>
                    </div>
                  )}
                  {dismissed > 0 && (
                    <div className="text-center">
                      <p className="text-xl font-bold">{dismissed}</p>
                      <p className="text-xs text-white/70">Dismissed</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-xl font-bold">→</p>
                    <p className="text-xs text-white/70">RLHF Queue</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pipeline Status ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Pipeline Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Survey", icon: "📋", done: true },
              { label: "AI Analysis", icon: "🤖", done: true },
              { label: "Doctor Review", icon: "👨‍⚕️", done: true },
              { label: "EHR Sync", icon: "🏥", done: false, next: true },
            ].map((item) => (
              <div
                key={item.label}
                className={`text-center p-3 rounded-xl border-2 ${
                  item.done
                    ? "border-teal-200 bg-teal-50"
                    : item.next
                    ? "border-blue-200 bg-blue-50 border-dashed"
                    : "border-slate-100 bg-slate-50 opacity-40"
                }`}
              >
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className={`text-xs font-semibold ${item.done ? "text-teal-700" : "text-blue-600"}`}>
                  {item.label}
                </p>
                <p className={`text-xs mt-0.5 ${item.done ? "text-teal-500" : "text-blue-400"}`}>
                  {item.done ? "✓ Done" : "Next →"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              const lines = [
                "ESAP — Clinical Record Update",
                `Timestamp: ${now}`,
                `Doctor: ${decision.doctorName}`,
                "",
                `PRIMARY DIAGNOSIS: ${decision.primaryDiagnosis}`,
                decision.icdCode ? `ICD-10: ${decision.icdCode}` : "",
                decision.secondaryDiagnosis ? `SECONDARY: ${decision.secondaryDiagnosis}` : "",
                "",
                "CLINICAL NOTES:",
                decision.clinicalNotes,
                "",
                "TREATMENT PLAN:",
                ...decision.treatmentItems.map((t) => `  • ${t}`),
                decision.prescriptions.length > 0 ? "\nPRESCRIPTIONS:" : "",
                ...decision.prescriptions.map((rx) => `  • ${rx.drug} ${rx.dosage} — ${rx.frequency}`),
                "",
                `FOLLOW-UP: ${decision.followUp}`,
                "",
                "AI FLAG REVIEWS:",
                ...decision.flagReviews.map((r) => `  [${r.decision.toUpperCase()}] ${r.flagId}${r.note ? `: ${r.note}` : ""}`),
                "",
                `AI Training Items Submitted: ${aiImpact}`,
              ].filter(Boolean).join("\n");
              navigator.clipboard.writeText(lines);
              alert("Clinical record copied to clipboard!");
            }}
            className="flex-1 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:border-blue-300 hover:bg-blue-50 transition-all text-sm"
          >
            Export Record
          </button>
          <button
            onClick={onNewPatient}
            className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold shadow-md hover:shadow-lg hover:opacity-95 transition-all text-sm"
          >
            New Patient →
          </button>
        </div>

      </div>
    </div>
  );
}
