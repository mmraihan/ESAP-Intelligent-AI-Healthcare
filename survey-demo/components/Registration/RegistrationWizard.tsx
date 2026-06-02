"use client";

import { useState } from "react";
import { registrationSections, RegAnswers } from "@/data/registration-fields";
import FieldRenderer from "@/components/Registration/FieldRenderer";
import SectionNav from "@/components/Registration/SectionNav";
import RegistrationReview from "@/components/Registration/RegistrationReview";
import RegistrationDone from "@/components/Registration/RegistrationDone";

type Stage = "form" | "review" | "done";

const COLOR_HEADER: Record<string, string> = {
  blue:   "from-blue-500 to-blue-600",
  teal:   "from-teal-500 to-teal-600",
  red:    "from-red-500 to-red-600",
  purple: "from-purple-500 to-purple-600",
  orange: "from-orange-500 to-orange-600",
  green:  "from-green-500 to-green-600",
  yellow: "from-yellow-500 to-yellow-600",
  indigo: "from-indigo-500 to-indigo-600",
  cyan:   "from-cyan-500 to-cyan-600",
  slate:  "from-slate-600 to-slate-700",
};

export default function RegistrationWizard() {
  const [stage, setStage] = useState<Stage>("form");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<RegAnswers>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sections = registrationSections;
  const currentSection = sections[sectionIdx];
  const isFirst = sectionIdx === 0;
  const isLast = sectionIdx === sections.length - 1;

  function setField(id: string, value: RegAnswers[string]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function getMissingRequired(): string[] {
    return currentSection.fields
      .filter((f) => {
        if (!f.required) return false;
        if (f.conditional) {
          if (answers[f.conditional.fieldId] !== f.conditional.value) return false;
        }
        if (f.autoCalc) return false;
        const v = answers[f.id];
        if (v === null || v === undefined || v === "") return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      })
      .map((f) => f.label);
  }

  function handleNext() {
    const missing = getMissingRequired();
    if (missing.length > 0) {
      alert(`Please complete required fields:\n• ${missing.join("\n• ")}`);
      return;
    }
    if (isLast) {
      setStage("review");
    } else {
      setSectionIdx((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (stage === "review") {
    return (
      <RegistrationReview
        answers={answers}
        onBack={() => setStage("form")}
        onSubmit={() => setStage("done")}
      />
    );
  }

  if (stage === "done") {
    return <RegistrationDone answers={answers} onReset={() => { setAnswers({}); setSectionIdx(0); setStage("form"); }} />;
  }

  const headerColor = COLOR_HEADER[currentSection.color] ?? COLOR_HEADER.blue;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top Nav ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">ESAP Intelligence</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">Patient Registration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all"
                  style={{ width: `${((sectionIdx + 1) / sections.length) * 100}%` }}
                />
              </div>
              <span>Section {sectionIdx + 1}/{sections.length}</span>
            </div>
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile section nav dropdown */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 max-h-64 overflow-y-auto">
            <SectionNav
              sections={sections}
              currentIdx={sectionIdx}
              answers={answers}
              onSelect={(i) => { setSectionIdx(i); setMobileNavOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </div>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* ── Desktop Sidebar ── */}
        <div className="hidden lg:block">
          <SectionNav
            sections={sections}
            currentIdx={sectionIdx}
            answers={answers}
            onSelect={(i) => { setSectionIdx(i); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Section header */}
          <div className={`rounded-2xl bg-gradient-to-r ${headerColor} p-5 text-white`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentSection.icon}</span>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-widest">
                  Section {sectionIdx + 1} of {sections.length}
                </p>
                <h1 className="text-xl font-bold leading-tight">{currentSection.title}</h1>
                <p className="text-white/80 text-xs mt-0.5 max-w-lg">{currentSection.description}</p>
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {currentSection.fields.map((field) => {
              // Check conditional visibility
              if (field.conditional) {
                if (answers[field.conditional.fieldId] !== field.conditional.value) return null;
              }

              return (
                <div key={field.id} className="px-6 py-5">
                  {/* Field label */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-800">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                    </div>
                    {/* AI purpose tooltip */}
                    <div className="group relative flex-shrink-0">
                      <button className="w-5 h-5 rounded-full bg-blue-100 text-blue-500 text-xs font-bold flex items-center justify-center hover:bg-blue-200 transition-colors">
                        ?
                      </button>
                      <div className="absolute right-0 top-6 w-64 bg-slate-800 text-white text-xs rounded-xl p-3 hidden group-hover:block z-10 shadow-xl">
                        <p className="font-semibold text-blue-300 mb-1">AI Purpose</p>
                        <p className="text-slate-300 leading-snug">{field.aiPurpose}</p>
                      </div>
                    </div>
                  </div>

                  <FieldRenderer
                    field={field}
                    value={answers[field.id]}
                    onChange={setField}
                    allAnswers={answers}
                  />
                </div>
              );
            })}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pb-8">
            <button
              onClick={() => { if (!isFirst) { setSectionIdx((i) => i - 1); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
              disabled={isFirst}
              className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 font-medium text-sm hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Previous
            </button>

            <div className="flex gap-1">
              {sections.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === sectionIdx ? "w-6 bg-blue-500" : i < sectionIdx ? "w-3 bg-teal-400" : "w-3 bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 active:scale-95 transition-all"
            >
              {isLast ? "Review & Submit →" : "Next Section →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
