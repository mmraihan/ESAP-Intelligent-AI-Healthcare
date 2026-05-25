"use client";

import { useState } from "react";
import { AnalysisResult, RiskLevel } from "@/lib/analyze";
import DoctorReview, { DoctorDecision } from "@/components/DoctorReview";

type Answers = Record<string, string | string[] | number | undefined>;

interface Props {
  result: AnalysisResult;
  answers: Answers;
  onRestart: () => void;
  onDoctorSubmit: (decision: DoctorDecision) => void;
}

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; border: string; badge: string }> = {
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700" },
  moderate: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", badge: "bg-red-100 text-red-700" },
};

const SEVERITY_STYLES = {
  info: "border-l-4 border-blue-400 bg-blue-50",
  warning: "border-l-4 border-amber-400 bg-amber-50",
  critical: "border-l-4 border-red-500 bg-red-50",
};

const SEVERITY_ICON = { info: "ℹ️", warning: "⚠️", critical: "🚨" };

const PRIORITY_BADGE = {
  routine: "bg-slate-100 text-slate-600",
  soon: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export default function Dashboard({ result, answers, onRestart, onDoctorSubmit }: Props) {
  const [tab, setTab] = useState<"ai" | "doctor">("ai");
  const risk = RISK_COLORS[result.riskLevel];
  const now = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const criticalFlags = result.flags.filter((f) => f.severity === "critical");
  const warningFlags = result.flags.filter((f) => f.severity === "warning");
  const infoFlags = result.flags.filter((f) => f.severity === "info");
  const sortedFlags = [...criticalFlags, ...warningFlags, ...infoFlags];
  const sortedActions = [
    ...result.recommendations.filter((r) => r.priority === "urgent"),
    ...result.recommendations.filter((r) => r.priority === "soon"),
    ...result.recommendations.filter((r) => r.priority === "routine"),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top Nav ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">ESAP Intelligence</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">Clinical Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:block">{now}</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Active
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-0 border-t border-slate-100">
          <button
            onClick={() => setTab("ai")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
              tab === "ai"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            AI Analysis
          </button>
          <button
            onClick={() => setTab("doctor")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              tab === "doctor"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Doctor Review
            {criticalFlags.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {criticalFlags.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Hero Card ── */}
        <div className={`rounded-2xl border-2 ${risk.border} ${risk.bg} p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl">👤</div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Patient Profile</p>
                <h1 className="text-xl font-bold text-slate-800">Anonymous Patient</h1>
                <p className={`text-sm font-medium mt-0.5 ${risk.text}`}>{result.profileLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Completion</p>
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke="#3b82f6" strokeWidth="6"
                      strokeDasharray={`${(result.completionPct / 100) * 138.2} 138.2`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                    {result.completionPct}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Risk Score</p>
                <div className={`w-16 h-16 rounded-2xl ${risk.badge} flex flex-col items-center justify-center`}>
                  <span className="text-xl font-bold leading-none">{result.riskScore}</span>
                  <span className="text-xs font-medium capitalize">{result.riskLevel}</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Flags</p>
                <div className="w-16 h-16 rounded-2xl bg-white flex flex-col items-center justify-center shadow-sm border border-slate-100">
                  <span className="text-xl font-bold text-slate-700 leading-none">{result.flags.length}</span>
                  <span className="text-xs text-slate-400">items</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Critical Alerts", value: criticalFlags.length, color: "text-red-600", bg: "bg-red-50 border-red-100" },
            { label: "Warnings", value: warningFlags.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Info Notes", value: infoFlags.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
            { label: "Actions", value: result.recommendations.length, color: "text-slate-700", bg: "bg-white border-slate-100" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── TAB: AI Analysis ── */}
        {tab === "ai" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">

              {/* AI Summary */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b bg-gradient-to-r from-blue-500 to-teal-400">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
                  </svg>
                  <h2 className="font-semibold text-white text-sm">AI-Generated Clinical Summary</h2>
                  <span className="ml-auto text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">RAG · v1.0</span>
                </div>
                <div className="px-5 py-5">
                  <p className="text-slate-600 text-sm leading-relaxed">{result.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">Based on survey responses</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">Not a medical diagnosis</span>
                  </div>
                </div>
              </section>

              {/* Clinical Flags */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                  <h2 className="font-semibold text-slate-800 text-sm">Clinical Flags & Alerts</h2>
                  <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{result.flags.length} total</span>
                </div>
                <div className="p-4 space-y-2.5">
                  {sortedFlags.length === 0 ? (
                    <div className="text-center py-8 text-slate-300">
                      <p className="text-4xl mb-2">✓</p>
                      <p className="text-sm">No clinical flags identified</p>
                    </div>
                  ) : (
                    sortedFlags.map((flag) => (
                      <div key={flag.id} className={`${SEVERITY_STYLES[flag.severity]} rounded-r-xl p-3.5`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base leading-none mt-0.5">{SEVERITY_ICON[flag.severity]}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{flag.label}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{flag.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              {/* Recommended Actions */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                  <h2 className="font-semibold text-slate-800 text-sm">Recommended Actions</h2>
                  <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{result.recommendations.length}</span>
                </div>
                <div className="p-4 space-y-3">
                  {sortedActions.map((action) => (
                    <div key={action.id} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                      <span className="text-xl leading-none mt-0.5 flex-shrink-0">{action.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{action.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${PRIORITY_BADGE[action.priority]}`}>
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-snug">{action.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pipeline Status */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50">
                  <h2 className="font-semibold text-slate-800 text-sm">AI Pipeline Status</h2>
                </div>
                <div className="p-4 space-y-2.5">
                  {[
                    { label: "Data Collection", done: true },
                    { label: "RAG Analysis", done: true },
                    { label: "Risk Scoring", done: true },
                    { label: "Clinical Summary", done: true },
                    { label: "Doctor Review", done: false, next: true },
                    { label: "EHR Sync", done: false },
                    { label: "Feedback Loop", done: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">{item.label}</span>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${item.done ? "text-emerald-600" : item.next ? "text-blue-500" : "text-slate-300"}`}>
                        {item.done ? (
                          <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Done</>
                        ) : item.next ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" /> Awaiting</>
                        ) : (
                          <><span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" /> Pending</>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* CTA to Doctor Review */}
              <button
                onClick={() => setTab("doctor")}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Open Doctor Review →
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: Doctor Review ── */}
        {tab === "doctor" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50">
              <div>
                <h2 className="font-bold text-slate-800">Doctor Decision Interface</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review AI findings · Set diagnosis · Submit feedback to training pipeline
                </p>
              </div>
              <span className="text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
                Phase 3
              </span>
            </div>
            <div className="p-6">
              <DoctorReview result={result} onSubmit={onDoctorSubmit} />
            </div>
          </div>
        )}

        {/* ── Bottom bar (AI tab only) ── */}
        {tab === "ai" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">Ready for Doctor Review</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Switch to the Doctor Review tab to accept/modify AI flags, set diagnosis, and complete the feedback loop.
              </p>
            </div>
            <div className="flex gap-3 items-center flex-shrink-0">
              <button onClick={onRestart}
                className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-medium text-sm hover:border-blue-300 hover:bg-blue-50 transition-all">
                New Survey
              </button>
              <button onClick={() => setTab("doctor")}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-medium text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all">
                Doctor Review →
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
