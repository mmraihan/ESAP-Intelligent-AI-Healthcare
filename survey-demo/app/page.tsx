import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 mb-5 shadow-xl">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .85.467 1.643 1.237 2.065l.763.43m-9 3.057l.75.75m7.5-7.5l.75-.75M5.25 3.186A24.363 24.363 0 0112 3c2.392 0 4.697.34 6.75.97" />
          </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">ESAP Intelligent AI Healthcare</h1>
          <p className="text-slate-500 text-lg">AI-powered clinical decision support · Patient registration · Doctor feedback loop</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs">
            {["RAG Pipeline", "Clinical Dashboard", "Doctor Review", "RLHF Feedback", "Global Data Center"].map((tag) => (
              <span key={tag} className="bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-full shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Three entry points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Path A: Quick Survey */}
          <Link href="/survey" className="group block bg-white rounded-2xl border-2 border-slate-200 p-6 hover:border-blue-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-105 transition-transform">
              📋
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-800">Healthcare Survey</h2>
              <span className="text-xs bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">Phases 1–5</span>
            </div>
            <p className="text-sm text-slate-500 mb-4 leading-snug">
              8-question health experience survey → AI analysis → Clinical Dashboard → Doctor Review → RLHF Feedback Loop
            </p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["8 Questions", "~3 min", "AI Analysis", "Doctor Review"].map((t) => (
                <span key={t} className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <div className="flex items-center text-sm font-semibold text-blue-600 group-hover:gap-2 gap-1 transition-all">
              Start Survey <span>→</span>
            </div>
          </Link>

          {/* Path B: Full Registration */}
          <Link href="/register" className="group block bg-white rounded-2xl border-2 border-slate-200 p-6 hover:border-teal-400 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-2xl mb-4 group-hover:scale-105 transition-transform">
              🏥
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-800">Full Patient Registration</h2>
              <span className="text-xs bg-teal-100 text-teal-600 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">Phase 6</span>
            </div>
            <p className="text-sm text-slate-500 mb-4 leading-snug">
              10-section, 90-field registration form — complete patient profile for the AI clinical pipeline.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["10 Sections", "~90 Fields", "All Field Types", "Digital Consent"].map((t) => (
                <span key={t} className="text-xs bg-teal-50 text-teal-600 border border-teal-200 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            <div className="flex items-center text-sm font-semibold text-teal-600 group-hover:gap-2 gap-1 transition-all">
              Start Registration <span>→</span>
            </div>
          </Link>

          {/* Path C: Patient App — Phase 7 */}
          <Link href="/patient" className="group block bg-white rounded-2xl border-2 border-slate-200 p-6 hover:border-purple-400 hover:shadow-lg transition-all sm:col-span-2">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform">
                📱
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-lg font-bold text-slate-800">Personal Health App</h2>
                  <span className="text-xs bg-purple-100 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">Phase 7</span>
                  <span className="text-xs bg-emerald-100 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">New ✓</span>
                </div>
                <p className="text-sm text-slate-500 mb-3 leading-snug">
                  Patient-facing AI health dashboard — health overview, AI chat assistant, medication tracker, health alerts, and appointment management.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["AI Chat Assistant", "Health Metrics", "Medication Tracker", "Health Alerts", "Appointments"].map((t) => (
                    <span key={t} className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center text-sm font-semibold text-purple-600 group-hover:gap-2 gap-1 transition-all flex-shrink-0">
                Open App <span>→</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Pipeline overview */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Full System Pipeline</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { icon: "📝", label: "Survey",             phase: "Phase 1" },
              { icon: "🤖", label: "AI Processing",      phase: "Phase 2" },
              { icon: "📊", label: "Clinical Dashboard", phase: "Phase 3" },
              { icon: "👨‍⚕️", label: "Doctor Review",     phase: "Phase 4" },
              { icon: "🔁", label: "RLHF Feedback",      phase: "Phase 5" },
              { icon: "🏥", label: "Registration",       phase: "Phase 6" },
              { icon: "📱", label: "Patient App",        phase: "Phase 7" },
            ].map((item, i, arr) => (
              <span key={item.label} className="flex items-center gap-2">
                <span className="flex flex-col items-center">
                  <span className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-medium flex items-center gap-1">
                    {item.icon} {item.label}
                  </span>
                  <span className="text-xs mt-0.5 text-blue-400">
                    {item.phase}
                  </span>
                </span>
                {i < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
