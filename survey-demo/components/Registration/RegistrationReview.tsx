"use client";

import { registrationSections, RegAnswers } from "@/data/registration-fields";

interface Props {
  answers: RegAnswers;
  onBack: () => void;
  onSubmit: () => void;
}

function formatValue(value: RegAnswers[string]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "string" && value.startsWith("data:image")) return "✓ Signature captured";
  if (value === "signed") return "✓ Signed";
  return String(value);
}

const SECTION_COLORS: Record<string, { border: string; header: string; badge: string }> = {
  blue:   { border: "border-blue-100",   header: "bg-blue-50 text-blue-700",   badge: "bg-blue-100 text-blue-600" },
  teal:   { border: "border-teal-100",   header: "bg-teal-50 text-teal-700",   badge: "bg-teal-100 text-teal-600" },
  red:    { border: "border-red-100",    header: "bg-red-50 text-red-700",     badge: "bg-red-100 text-red-600" },
  purple: { border: "border-purple-100", header: "bg-purple-50 text-purple-700", badge: "bg-purple-100 text-purple-600" },
  orange: { border: "border-orange-100", header: "bg-orange-50 text-orange-700", badge: "bg-orange-100 text-orange-600" },
  green:  { border: "border-green-100",  header: "bg-green-50 text-green-700",  badge: "bg-green-100 text-green-600" },
  yellow: { border: "border-yellow-100", header: "bg-yellow-50 text-yellow-700", badge: "bg-yellow-100 text-yellow-600" },
  indigo: { border: "border-indigo-100", header: "bg-indigo-50 text-indigo-700", badge: "bg-indigo-100 text-indigo-600" },
  cyan:   { border: "border-cyan-100",   header: "bg-cyan-50 text-cyan-700",   badge: "bg-cyan-100 text-cyan-600" },
  slate:  { border: "border-slate-200",  header: "bg-slate-100 text-slate-700", badge: "bg-slate-100 text-slate-600" },
};

export default function RegistrationReview({ answers, onBack, onSubmit }: Props) {
  const totalFields = registrationSections.reduce((acc, s) => acc + s.fields.filter((f) => !f.autoCalc).length, 0);
  const answeredFields = registrationSections.reduce((acc, s) =>
    acc + s.fields.filter((f) => {
      if (f.autoCalc) return false;
      const v = answers[f.id];
      if (v === null || v === undefined || v === "") return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }).length, 0
  );

  const requiredMissing = registrationSections.flatMap((s) =>
    s.fields.filter((f) => {
      if (!f.required || f.autoCalc) return false;
      if (f.conditional && answers[f.conditional.fieldId] !== f.conditional.value) return false;
      const v = answers[f.id];
      if (v === null || v === undefined || v === "") return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    }).map((f) => ({ section: s.title, field: f.label }))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-xs text-slate-400">ESAP Registration</p>
              <p className="text-sm font-bold text-slate-800">Review Your Answers</p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-blue-600">{answeredFields}</span> / {totalFields} fields answered
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Missing required warning */}
        {requiredMissing.length > 0 && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-red-700 mb-2">
                  {requiredMissing.length} required field{requiredMissing.length > 1 ? "s" : ""} incomplete
                </p>
                <div className="flex flex-wrap gap-2">
                  {requiredMissing.map((m, i) => (
                    <span key={i} className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg">
                      {m.section} → {m.field}
                    </span>
                  ))}
                </div>
                <button
                  onClick={onBack}
                  className="mt-3 text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-800"
                >
                  ← Go back and complete these fields
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Sections", value: registrationSections.length, icon: "📋" },
            { label: "Fields Answered", value: answeredFields, icon: "✅" },
            { label: "Required Remaining", value: requiredMissing.length, icon: requiredMissing.length > 0 ? "⚠️" : "✓" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Section-by-section review */}
        {registrationSections.map((section) => {
          const colors = SECTION_COLORS[section.color] ?? SECTION_COLORS.blue;
          const visibleFields = section.fields.filter((f) => {
            if (f.autoCalc) return false;
            if (f.conditional) return answers[f.conditional.fieldId] === f.conditional.value;
            return true;
          });
          const answeredInSection = visibleFields.filter((f) => {
            const v = answers[f.id];
            return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
          }).length;

          return (
            <div key={section.id} className={`bg-white rounded-2xl border ${colors.border} shadow-sm overflow-hidden`}>
              <div className={`flex items-center justify-between px-5 py-3 ${colors.header}`}>
                <div className="flex items-center gap-2">
                  <span>{section.icon}</span>
                  <h2 className="font-bold text-sm">{section.title}</h2>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {answeredInSection}/{visibleFields.length}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {visibleFields.map((field) => {
                  const val = answers[field.id];
                  const isEmpty = val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0);
                  return (
                    <div key={field.id} className="flex items-start justify-between px-5 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-500 truncate">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </p>
                        <p className={`text-sm mt-0.5 ${isEmpty ? "text-slate-300 italic" : "text-slate-800 font-medium"}`}>
                          {isEmpty ? "Not answered" : formatValue(val)}
                        </p>
                      </div>
                      {field.required && isEmpty && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-red-500 text-xs font-bold">!</span>
                        </span>
                      )}
                      {!isEmpty && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Consent notice */}
        <div className="bg-slate-800 rounded-2xl p-5 text-white">
          <p className="text-sm font-semibold mb-2">⚖️ Legal Notice</p>
          <p className="text-xs text-slate-300 leading-relaxed">
            By submitting this registration, you confirm that all information provided is accurate to the best of your knowledge.
            Your data will be stored securely in the ESAP Global Health Data Center and processed in accordance with HIPAA, GDPR,
            and applicable healthcare regulations. The AI will only be activated for fields where you have granted consent.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            ← Edit Answers
          </button>
          <button
            onClick={onSubmit}
            disabled={requiredMissing.length > 0}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              requiredMissing.length > 0
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-teal-400 text-white shadow-md hover:shadow-lg hover:opacity-95"
            }`}
          >
            Submit Registration →
          </button>
        </div>
      </main>
    </div>
  );
}
