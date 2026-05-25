"use client";

import { Question } from "@/data/questions";

interface Props {
  question: Question;
  answer: string | string[] | number | undefined;
  onChange: (value: string | string[] | number) => void;
}

export default function QuestionCard({ question, answer, onChange }: Props) {
  const { type, options, min = 1, max = 5, minLabel, maxLabel } = question;

  /* ── Single choice ── */
  if (type === "single") {
    return (
      <div className="flex flex-col gap-3">
        {options?.map((opt) => {
          const selected = answer === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 text-left transition-all duration-200 ${
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  selected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                }`}
              >
                {selected && (
                  <span className="w-2 h-2 rounded-full bg-white block" />
                )}
              </span>
              <span className="font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Multiple choice ── */
  if (type === "multiple") {
    const selected: string[] = Array.isArray(answer) ? answer : [];
    const toggle = (id: string) => {
      const next = selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id];
      onChange(next);
    };
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options?.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                checked
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span
                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  checked ? "border-teal-500 bg-teal-500" : "border-slate-300"
                }`}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="font-medium text-sm">{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Star rating ── */
  if (type === "rating") {
    const stars = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    const labels = ["Terrible", "Poor", "Okay", "Good", "Excellent"];
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-3">
          {stars.map((star) => (
            <button
              key={star}
              onClick={() => onChange(star)}
              className="group transition-transform hover:scale-110 active:scale-95"
            >
              <svg
                className={`w-12 h-12 transition-colors duration-150 ${
                  (answer as number) >= star
                    ? "text-yellow-400"
                    : "text-slate-200 group-hover:text-yellow-300"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </button>
          ))}
        </div>
        {answer !== undefined && (
          <p className="text-slate-600 font-medium text-sm animate-fade-in">
            {labels[(answer as number) - 1]}
          </p>
        )}
        <div className="flex justify-between w-full text-xs text-slate-400 px-2">
          <span>Not satisfied</span>
          <span>Very satisfied</span>
        </div>
      </div>
    );
  }

  /* ── Slider scale ── */
  if (type === "scale") {
    const val = answer !== undefined ? (answer as number) : Math.floor((min + max) / 2);
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <span className="text-5xl font-bold text-blue-600">{val}</span>
          <span className="text-slate-400 text-sm"> / {max}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    );
  }

  /* ── Free text ── */
  if (type === "text") {
    return (
      <textarea
        value={(answer as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer here..."
        rows={5}
        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none resize-none text-slate-700 placeholder-slate-300 transition-colors"
      />
    );
  }

  return null;
}
