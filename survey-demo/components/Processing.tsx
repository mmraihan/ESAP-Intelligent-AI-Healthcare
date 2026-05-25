"use client";

import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
}

const STEPS = [
  { label: "Collecting health assessment data", detail: "Reading survey responses…" },
  { label: "Running AI symptom analysis", detail: "Correlating responses with clinical knowledge base…" },
  { label: "Generating risk profile", detail: "Applying RAG-based clinical reasoning…" },
  { label: "Building clinical summary", detail: "Preparing doctor-facing interface…" },
  { label: "Analysis complete", detail: "Launching Clinical Dashboard…" },
];

export default function Processing({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timings = [700, 1300, 1100, 900, 600];
    let current = 0;

    function advance() {
      if (current >= STEPS.length - 1) {
        setStep(STEPS.length - 1);
        setDone(true);
        setTimeout(onDone, 900);
        return;
      }
      current++;
      setStep(current);
      setTimeout(advance, timings[current] ?? 800);
    }

    const t = setTimeout(advance, timings[0]);
    return () => clearTimeout(t);
  }, [onDone]);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Animated orb */}
        <div className="relative inline-flex items-center justify-center mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 opacity-20 animate-ping absolute" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 opacity-30 animate-pulse absolute" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center relative z-10">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.122V21m-9-3h10.5M5 14.5l.75.75M5 14.5H3.75m16.5 0H18.75m-1.5 0l.75-.75M5.25 3.186A24.363 24.363 0 0112 3c2.392 0 4.697.34 6.75.97" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">AI Analysis in Progress</h2>
        <p className="text-slate-400 text-sm mb-8">ESAP Clinical Intelligence Engine</p>

        {/* Steps */}
        <div className="space-y-3 mb-8 text-left">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  state === "active"
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : state === "done"
                    ? "bg-white/5"
                    : "opacity-30"
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {state === "done" ? (
                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : state === "active" ? (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${state === "done" ? "text-slate-300" : state === "active" ? "text-white" : "text-slate-500"}`}>
                    {s.label}
                  </p>
                  {state === "active" && (
                    <p className="text-xs text-blue-300 mt-0.5">{s.detail}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-2">{pct}%</p>

        {done && (
          <p className="text-teal-400 text-sm font-semibold mt-4 animate-pulse">
            ✓ Ready — Loading dashboard…
          </p>
        )}
      </div>
    </div>
  );
}
