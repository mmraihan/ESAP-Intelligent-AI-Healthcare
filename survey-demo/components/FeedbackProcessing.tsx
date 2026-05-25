"use client";

import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

const STEPS = [
  { label: "Saving clinical notes to patient record", detail: "Writing doctor observations and diagnosis…" },
  { label: "Updating AI flag decisions", detail: "Recording accepted, modified, and dismissed flags…" },
  { label: "Syncing to Global Health Data Center", detail: "Versioning patient record with timestamp…" },
  { label: "Sending feedback to AI pipeline", detail: "Submitting doctor corrections for model improvement…" },
  { label: "Triggering RLHF training update", detail: "Doctor decisions queued for reinforcement learning…" },
  { label: "Record finalized", detail: "Patient profile updated. Feedback loop complete." },
];

export default function FeedbackProcessing({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timings = [600, 900, 800, 1000, 900, 700];
    let current = 0;

    function advance() {
      if (current >= STEPS.length - 1) {
        setStep(STEPS.length - 1);
        setDone(true);
        setTimeout(onDone, 1000);
        return;
      }
      current++;
      setStep(current);
      setTimeout(advance, timings[current] ?? 700);
    }

    const t = setTimeout(advance, timings[0]);
    return () => clearTimeout(t);
  }, [onDone]);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-teal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">

        {/* Animated icon */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 opacity-20 animate-ping absolute" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 opacity-30 animate-pulse absolute" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center relative z-10 shadow-xl">
            {done ? (
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">
          {done ? "Feedback Loop Complete" : "Processing Doctor Feedback"}
        </h2>
        <p className="text-slate-400 text-sm mb-8">ESAP AI Training Pipeline · RLHF Module</p>

        {/* Steps */}
        <div className="space-y-2.5 mb-8 text-left">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  state === "active"
                    ? "bg-teal-500/20 border border-teal-400/30"
                    : state === "done"
                    ? "bg-white/5"
                    : "opacity-25"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {state === "done" ? (
                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : state === "active" ? (
                    <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${state !== "pending" ? "text-white" : "text-slate-500"}`}>
                    {s.label}
                  </p>
                  {state === "active" && (
                    <p className="text-xs text-teal-300 mt-0.5">{s.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-2">{pct}%</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["Patient Record", "AI Pipeline", "RLHF Queue", "Data Center"].map((tag, i) => (
            <span
              key={tag}
              className={`text-xs px-3 py-1 rounded-full border transition-all duration-500 ${
                step >= i * 1.5
                  ? "border-teal-400/40 bg-teal-400/10 text-teal-300"
                  : "border-slate-700 text-slate-600"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
