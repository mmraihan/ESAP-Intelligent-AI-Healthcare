"use client";

import { RegSection, RegAnswers } from "@/data/registration-fields";

interface Props {
  sections: RegSection[];
  currentIdx: number;
  answers: RegAnswers;
  onSelect: (idx: number) => void;
}

const COLOR_MAP: Record<string, { dot: string; active: string; done: string }> = {
  blue:   { dot: "bg-blue-500",   active: "bg-blue-50 border-blue-400 text-blue-700",   done: "bg-blue-50 border-blue-200 text-blue-600" },
  teal:   { dot: "bg-teal-500",   active: "bg-teal-50 border-teal-400 text-teal-700",   done: "bg-teal-50 border-teal-200 text-teal-600" },
  red:    { dot: "bg-red-500",    active: "bg-red-50 border-red-400 text-red-700",       done: "bg-red-50 border-red-200 text-red-600" },
  purple: { dot: "bg-purple-500", active: "bg-purple-50 border-purple-400 text-purple-700", done: "bg-purple-50 border-purple-200 text-purple-600" },
  orange: { dot: "bg-orange-500", active: "bg-orange-50 border-orange-400 text-orange-700", done: "bg-orange-50 border-orange-200 text-orange-600" },
  green:  { dot: "bg-green-500",  active: "bg-green-50 border-green-400 text-green-700",  done: "bg-green-50 border-green-200 text-green-600" },
  yellow: { dot: "bg-yellow-500", active: "bg-yellow-50 border-yellow-400 text-yellow-700", done: "bg-yellow-50 border-yellow-200 text-yellow-600" },
  indigo: { dot: "bg-indigo-500", active: "bg-indigo-50 border-indigo-400 text-indigo-700", done: "bg-indigo-50 border-indigo-200 text-indigo-600" },
  cyan:   { dot: "bg-cyan-500",   active: "bg-cyan-50 border-cyan-400 text-cyan-700",   done: "bg-cyan-50 border-cyan-200 text-cyan-600" },
  slate:  { dot: "bg-slate-500",  active: "bg-slate-100 border-slate-400 text-slate-700", done: "bg-slate-50 border-slate-200 text-slate-600" },
};

function sectionProgress(section: RegSection, answers: RegAnswers): { answered: number; total: number } {
  const visible = section.fields.filter((f) => {
    if (!f.conditional) return true;
    return answers[f.conditional.fieldId] === f.conditional.value;
  });
  const answered = visible.filter((f) => {
    const v = answers[f.id];
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
  return { answered, total: visible.length };
}

export default function SectionNav({ sections, currentIdx, answers, onSelect }: Props) {
  return (
    <nav className="w-full lg:w-64 flex-shrink-0">
      <div className="lg:sticky lg:top-20 space-y-1">
        {sections.map((section, idx) => {
          const { answered, total } = sectionProgress(section, answers);
          const isActive = idx === currentIdx;
          const isDone = answered === total && total > 0;
          const colors = COLOR_MAP[section.color] ?? COLOR_MAP.blue;
          const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

          return (
            <button
              key={section.id}
              onClick={() => onSelect(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                isActive
                  ? colors.active + " border-opacity-100"
                  : "border-transparent hover:bg-slate-100 text-slate-500"
              }`}
            >
              {/* Status indicator */}
              <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center">
                {isDone && !isActive ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <span className="text-base leading-none">{section.icon}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate leading-tight">{section.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isDone ? "bg-emerald-500" : colors.dot}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{answered}/{total}</span>
                </div>
              </div>
            </button>
          );
        })}

        {/* Overall progress */}
        <div className="mt-4 px-3 py-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Overall Progress</span>
            <span>
              {sections.reduce((acc, s) => acc + sectionProgress(s, answers).answered, 0)} /{" "}
              {sections.reduce((acc, s) => acc + sectionProgress(s, answers).total, 0)}
            </span>
          </div>
          {(() => {
            const total = sections.reduce((acc, s) => acc + sectionProgress(s, answers).total, 0);
            const answered = sections.reduce((acc, s) => acc + sectionProgress(s, answers).answered, 0);
            const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
            return (
              <>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-right mt-1">{pct}% complete</p>
              </>
            );
          })()}
        </div>
      </div>
    </nav>
  );
}
