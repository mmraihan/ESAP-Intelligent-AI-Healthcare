"use client";

import { survey, Question } from "@/data/questions";

type Answers = Record<string, string | string[] | number | undefined>;

interface Props {
  answers: Answers;
  onRestart: () => void;
}

function formatAnswer(question: Question, value: string | string[] | number | undefined): string {
  if (value === undefined || value === "") return "—";

  if (question.type === "single") {
    return question.options?.find((o) => o.id === value)?.label ?? String(value);
  }
  if (question.type === "multiple") {
    const ids = Array.isArray(value) ? value : [];
    if (ids.length === 0) return "—";
    return ids
      .map((id) => question.options?.find((o) => o.id === id)?.label ?? id)
      .join(", ");
  }
  if (question.type === "rating") {
    const stars = ["", "★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];
    return `${value}/5  ${stars[value as number] ?? ""}`;
  }
  if (question.type === "scale") {
    return `${value} / ${question.max}`;
  }
  return String(value);
}

export default function Results({ answers, onRestart }: Props) {
  const answered = survey.questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== ""
  ).length;
  const total = survey.questions.length;
  const score = Math.round((answered / total) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Survey Complete!</h1>
          <p className="text-slate-500 mt-2">Thank you for your valuable feedback.</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
            <span>{answered} of {total} questions answered</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>{score}% completion</span>
          </div>
        </div>

        {/* Answers */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Your Responses</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {survey.questions.map((q, i) => (
              <div key={q.id} className="px-6 py-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Q{i + 1}
                </p>
                <p className="text-slate-700 font-medium text-sm mb-1">{q.text}</p>
                <p className="text-blue-600 font-semibold text-sm">
                  {formatAnswer(q, answers[q.id])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onRestart}
            className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            Retake Survey
          </button>
          <button
            onClick={() => {
              const text = survey.questions
                .map((q, i) => `Q${i + 1}: ${q.text}\nA: ${formatAnswer(q, answers[q.id])}`)
                .join("\n\n");
              navigator.clipboard.writeText(text);
              alert("Responses copied to clipboard!");
            }}
            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold hover:opacity-90 transition-all shadow-md"
          >
            Copy Responses
          </button>
        </div>
      </div>
    </div>
  );
}
