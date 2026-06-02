"use client";

import Link from "next/link";
import { registrationSections, RegAnswers } from "@/data/registration-fields";

interface Props {
  answers: RegAnswers;
  onReset: () => void;
}

export default function RegistrationDone({ answers, onReset }: Props) {
  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const patientId = `ESAP-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  const patientName = (answers["full_name"] as string) || "Patient";

  const totalFields = registrationSections.reduce((acc, s) =>
    acc + s.fields.filter((f) => !f.autoCalc).length, 0
  );
  const answered = registrationSections.reduce((acc, s) =>
    acc + s.fields.filter((f) => {
      if (f.autoCalc) return false;
      const v = answers[f.id];
      return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    }).length, 0
  );

  const aiEnabled = answers["consent_ai_diagnosis"] === "yes";
  const speechEnabled = answers["consent_speech_recording"] === "yes";
  const researchEnabled = answers["consent_research"] === "yes";

  const PIPELINE_STEPS = [
    { label: "Patient Profile Created", detail: "Stored in Global Health Data Center", done: true, icon: "👤" },
    { label: "RAG Index Built", detail: "Patient history vectorized for retrieval", done: true, icon: "🔍" },
    { label: "AI Agent Activated", detail: aiEnabled ? "AI clinical assistant armed" : "Pending consent", done: aiEnabled, icon: "🤖" },
    { label: "Speech Pipeline", detail: speechEnabled ? "Real-time ASR ready" : "Not enabled", done: speechEnabled, icon: "🎙️" },
    { label: "Doctor Interface Ready", detail: "Clinical display armed for next visit", done: true, icon: "👨‍⚕️" },
    { label: "Research Contribution", detail: researchEnabled ? "Anonymized data queued for model improvement" : "Opted out", done: researchEnabled, icon: "🧬" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-5">

        {/* ── Hero ── */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 mb-4 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Registration Complete</h1>
          <p className="text-slate-500 mt-1">Welcome to ESAP Intelligent AI Healthcare, {patientName.split(" ")[0]}.</p>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className="text-xs bg-teal-100 text-teal-700 px-3 py-1.5 rounded-full font-semibold border border-teal-200 flex items-center gap-1">
              🆔 {patientId}
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold border border-blue-200">
              📅 {now}
            </span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Sections", value: registrationSections.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
            { label: "Fields Saved", value: answered, color: "text-teal-600", bg: "bg-teal-50 border-teal-100" },
            { label: "AI Enabled", value: aiEnabled ? "Yes" : "No", color: aiEnabled ? "text-emerald-600" : "text-slate-400", bg: "bg-white border-slate-100" },
            { label: "Completion", value: `${Math.round((answered / totalFields) * 100)}%`, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── AI Pipeline Activation ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-teal-500">
            <h2 className="font-bold text-white text-sm">AI Pipeline Activation Status</h2>
            <p className="text-white/70 text-xs mt-0.5">Based on your registration data and consent preferences</p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.label}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  step.done ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100 opacity-60"
                }`}
              >
                <span className="text-xl flex-shrink-0">{step.icon}</span>
                <div>
                  <p className={`text-xs font-semibold ${step.done ? "text-emerald-700" : "text-slate-500"}`}>
                    {step.label}
                    {step.done && (
                      <svg className="w-3 h-3 inline ml-1 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── What's Next ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 text-sm mb-4">What happens next?</h2>
          <div className="space-y-3">
            {[
              { step: "1", title: "Your doctor reviews your profile", detail: "AI has pre-loaded your complete history for the clinician's review dashboard.", icon: "📊" },
              { step: "2", title: "AI assists at every consultation", detail: "Symptom correlation, drug interaction checks, and history summarization — all automatic.", icon: "🤖" },
              { step: "3", title: "Personal Health App access", detail: aiEnabled ? "Your personal AI assistant is ready. Open the ESAP patient app now →" : "Enable AI consent to unlock the personal health assistant.", icon: "📱", link: aiEnabled ? "/patient" : undefined },
              { step: "4", title: "Continuous learning", detail: "Every doctor correction improves the AI for you and future patients.", icon: "🔁", link: undefined },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    {item.icon} {item.title}
                  </p>
                  {item.link ? (
                    <Link href={item.link} className="text-xs text-blue-500 underline underline-offset-2 mt-0.5 hover:text-blue-700 transition-colors">
                      {item.detail}
                    </Link>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={onReset}
            className="flex-1 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            Register New Patient
          </button>
          <Link
            href="/"
            className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all text-center"
          >
            Go to Health Survey →
          </Link>
        </div>
      </div>
    </div>
  );
}
