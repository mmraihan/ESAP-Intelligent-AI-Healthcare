"use client";

import { useMemo, useState } from "react";
import { survey } from "@/data/questions";
import { analyzeAnswers } from "@/lib/analyze";
import { DoctorDecision } from "@/components/DoctorReview";
import ProgressBar from "@/components/ProgressBar";
import QuestionCard from "@/components/QuestionCard";
import Processing from "@/components/Processing";
import Dashboard from "@/components/Dashboard";
import FeedbackProcessing from "@/components/FeedbackProcessing";
import RecordUpdated from "@/components/RecordUpdated";

type Answers = Record<string, string | string[] | number | undefined>;
type Stage = "welcome" | "survey" | "processing" | "dashboard" | "feedback" | "updated";

export default function Survey() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [doctorDecision, setDoctorDecision] = useState<DoctorDecision | null>(null);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const questions = survey.questions;
  const current = questions[index];
  const answer = answers[current?.id];

  const canProceed =
    !current?.required ||
    (Array.isArray(answer) ? answer.length > 0 : answer !== undefined && answer !== "");

  const analysisResult = useMemo(
    () => (stage === "dashboard" || stage === "feedback" || stage === "updated")
      ? analyzeAnswers(answers)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stage]
  );

  function navigate(dir: "forward" | "back") {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      if (dir === "forward") {
        if (index < questions.length - 1) setIndex((i) => i + 1);
        else setStage("processing");
      } else {
        if (index > 0) setIndex((i) => i - 1);
      }
      setAnimating(false);
    }, 220);
  }

  function restart() {
    setAnswers({});
    setIndex(0);
    setDoctorDecision(null);
    setStage("welcome");
  }

  function handleDoctorSubmit(decision: DoctorDecision) {
    setDoctorDecision(decision);
    setStage("feedback");
  }

  // ── Processing (AI analysis animation) ─────────────────────────
  if (stage === "processing") {
    return <Processing onDone={() => setStage("dashboard")} />;
  }

  // ── Feedback loop animation ─────────────────────────────────────
  if (stage === "feedback") {
    return <FeedbackProcessing onDone={() => setStage("updated")} />;
  }

  // ── Record Updated confirmation ─────────────────────────────────
  if (stage === "updated" && doctorDecision && analysisResult) {
    return (
      <RecordUpdated
        decision={doctorDecision}
        result={analysisResult}
        onNewPatient={restart}
      />
    );
  }

  // ── Clinical Dashboard ──────────────────────────────────────────
  if (stage === "dashboard" && analysisResult) {
    return (
      <Dashboard
        result={analysisResult}
        answers={answers}
        onRestart={restart}
        onDoctorSubmit={handleDoctorSubmit}
      />
    );
  }

  // ── Welcome screen ──────────────────────────────────────────────
  if (stage === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-3">{survey.title}</h1>
          <p className="text-slate-500 text-lg mb-2">{survey.subtitle}</p>
          <p className="text-slate-400 text-sm mb-6">
            {questions.length} questions &bull; ~3 minutes &bull; Full AI pipeline demo
          </p>

          {/* Pipeline flow */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8 text-xs">
            {[
              { label: "Survey", icon: "📋" },
              { label: "AI Analysis", icon: "🤖" },
              { label: "Clinical Dashboard", icon: "📊" },
              { label: "Doctor Review", icon: "👨‍⚕️" },
              { label: "Record Updated", icon: "✅" },
            ].map((step, i, arr) => (
              <span key={step.label} className="flex items-center gap-1.5">
                <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-full font-medium text-slate-600 shadow-sm flex items-center gap-1">
                  <span>{step.icon}</span> {step.label}
                </span>
                {i < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: "🛡️", label: "Private", sub: "No data stored" },
              { icon: "⚡", label: "Quick", sub: "3 min survey" },
              { icon: "🤖", label: "AI + Doctor", sub: "Full pipeline" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                <div className="text-xs text-slate-400">{item.sub}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStage("survey")}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white text-lg font-semibold shadow-lg hover:shadow-xl hover:opacity-95 transition-all active:scale-95"
          >
            Start Survey →
          </button>
        </div>
      </div>
    );
  }

  // ── Survey questions ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6">
          <ProgressBar current={index + 1} total={questions.length} />
        </div>

        <div
          className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-8 transition-all duration-200 ${
            animating
              ? direction === "forward" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4"
              : "opacity-100 translate-x-0"
          }`}
        >
          <div className="mb-6">
            <span className="inline-block text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">
              Question {index + 1}
              {current.required && <span className="text-red-400 ml-1">*</span>}
            </span>
            <h2 className="text-xl font-bold text-slate-800 leading-snug">{current.text}</h2>
            {current.description && (
              <p className="text-slate-400 text-sm mt-1">{current.description}</p>
            )}
          </div>

          <QuestionCard
            question={current}
            answer={answer}
            onChange={(val) => setAnswers((prev) => ({ ...prev, [current.id]: val }))}
          />
        </div>

        <div className="flex justify-between items-center mt-5">
          <button
            onClick={() => navigate("back")}
            disabled={index === 0}
            className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 font-medium hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Back
          </button>
          <span className="text-xs text-slate-400">{index + 1} / {questions.length}</span>
          <button
            onClick={() => navigate("forward")}
            disabled={!canProceed}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
              canProceed
                ? "bg-gradient-to-r from-blue-500 to-teal-400 text-white shadow-md hover:shadow-lg hover:opacity-95 active:scale-95"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            }`}
          >
            {index === questions.length - 1 ? "Submit →" : "Next →"}
          </button>
        </div>

        {!current.required && (
          <div className="text-center mt-3">
            <button
              onClick={() => navigate("forward")}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              Skip this question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
