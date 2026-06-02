"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Tab = "overview" | "chat" | "medications" | "alerts" | "appointments";

// ─── Demo data ────────────────────────────────────────────────────────────────

const PATIENT = {
  name: "Demo Patient",
  id: "ESAP-4K8J2M9",
  age: 38,
  bloodGroup: "O+",
  bmi: 25.2,
  bmiCategory: "Borderline Overweight",
  registeredDate: "June 1, 2026",
  aiEnabled: true,
  primaryConditions: ["Mild Hypertension (monitoring)", "Seasonal Rhinitis"],
};

const HEALTH_METRICS = [
  { label: "Blood Pressure", value: "128/82", unit: "mmHg", icon: "❤️", status: "warning", detail: "Slightly elevated" },
  { label: "BMI", value: "25.2", unit: "kg/m²", icon: "⚖️", status: "ok", detail: "Borderline overweight" },
  { label: "Sleep", value: "6.5", unit: "hrs/night", icon: "🌙", status: "warning", detail: "Below 7–9 hr target" },
  { label: "Stress Level", value: "7/10", unit: "", icon: "🧠", status: "warning", detail: "High — needs attention" },
  { label: "Exercise", value: "2x", unit: "/week", icon: "🏃", status: "warning", detail: "Below WHO 5x target" },
  { label: "Hydration", value: "1.5", unit: "L/day", icon: "💧", status: "ok", detail: "Adequate" },
];

const MEDICATIONS = [
  { name: "Cetirizine", dosage: "10mg", frequency: "Once daily", purpose: "Seasonal rhinitis relief", icon: "💊", adherence: true, color: "blue" },
  { name: "Vitamin D3", dosage: "1,000 IU", frequency: "Once daily with food", purpose: "Bone health & immunity", icon: "🌞", adherence: true, color: "amber" },
  { name: "Magnesium Glycinate", dosage: "200mg", frequency: "Before bed", purpose: "Sleep quality support", icon: "🧴", adherence: false, color: "purple" },
];

const ALERTS = [
  {
    id: "bp", severity: "warning",
    icon: "⚠️", title: "Blood Pressure Slightly Elevated",
    detail: "Your reading of 128/82 mmHg is above normal (120/80). Reduce sodium intake and monitor daily.",
    tip: "Aim for <2,300mg sodium/day", date: "Today",
  },
  {
    id: "stress", severity: "warning",
    icon: "⚠️", title: "High Stress Level Detected",
    detail: "Reported stress of 7/10 is a direct contributing factor to elevated blood pressure and poor sleep.",
    tip: "10 min daily mindfulness can reduce BP by 5 mmHg", date: "Today",
  },
  {
    id: "vaccine", severity: "info",
    icon: "ℹ️", title: "Annual Flu Vaccine Due",
    detail: "No influenza vaccine recorded for 2026. Book with your GP or local pharmacy.",
    tip: "Takes 2 weeks to take effect — book now", date: "This week",
  },
  {
    id: "sleep", severity: "info",
    icon: "ℹ️", title: "Sleep Below Recommended",
    detail: "6.5 hours is below the 7–9 hr adult target. Poor sleep compounds hypertension and stress.",
    tip: "Consistent sleep/wake times improve quality significantly", date: "Today",
  },
  {
    id: "exercise", severity: "info",
    icon: "ℹ️", title: "Exercise Frequency Below Target",
    detail: "WHO recommends ≥150 min moderate activity/week (≈5x). You're currently at 2x/week.",
    tip: "30 min brisk walking daily is most effective for BP", date: "This week",
  },
];

const APPOINTMENTS = [
  {
    type: "Follow-up Consultation", doctor: "Dr. James O'Brien (GP)",
    date: "July 1, 2026", time: "10:30 AM", status: "confirmed", icon: "👨‍⚕️",
    notes: "Review blood pressure readings and lifestyle plan",
  },
  {
    type: "Blood Pressure Check", doctor: "Nurse — ESAP Clinic",
    date: "June 15, 2026", time: "9:00 AM", status: "confirmed", icon: "🩺",
    notes: "Bring home BP log",
  },
];

const PAST_VISITS = [
  {
    type: "Initial Registration", doctor: "ESAP Registration System",
    date: "June 1, 2026", summary: "Full patient profile created. 10 sections completed. AI pipeline activated.",
  },
];

// ─── AI Chat ──────────────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "ai"; text: string }

const SUGGESTED_Qs = [
  "What are my main health risks?",
  "Tell me about my blood pressure",
  "What can I do to reduce stress?",
  "Are my medications interacting?",
  "How can I improve my sleep?",
  "What exercise do you recommend?",
];

function getAIResponse(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("blood pressure") || m.includes("bp") || m.includes("hypertension"))
    return "Your blood pressure is 128/82 mmHg — slightly above normal (120/80). Key actions:\n\n• Reduce sodium intake to <2,300mg/day\n• Add 30 min brisk walking 5 days/week\n• Stress management is critical — your 7/10 stress level is a direct contributor\n• Monitor daily with a home cuff and log readings\n\nIf it consistently reaches 140/90, discuss medication with your doctor. You're currently in the \"high normal\" monitoring stage.";
  if (m.includes("stress") || m.includes("anxiety") || m.includes("mental"))
    return "Your stress level of 7/10 is elevated. Chronic stress directly raises blood pressure and disrupts sleep. Recommended actions:\n\n• 10–15 min daily breathing exercises (box breathing: 4-4-4-4)\n• Aim for 3–5 exercise sessions/week (you're at 2x — add one more)\n• Your sleep of 6.5 hrs needs improvement — stress and sleep are linked\n• Consider asking your GP about a mental health care plan (free sessions available)\n\nConsistent practice over 4–6 weeks makes a measurable difference.";
  if (m.includes("medication") || m.includes("med") || m.includes("drug") || m.includes("cetirizine") || m.includes("interact"))
    return "Your current medications:\n\n💊 Cetirizine 10mg — antihistamine for seasonal rhinitis. No known interactions with your supplements.\n🌞 Vitamin D3 1,000IU — safe, no interactions.\n🧴 Magnesium Glycinate 200mg — supports sleep quality. Safe with your current list.\n\nNo critical drug interactions detected. ✅\n\nAlways inform your doctor before starting anything new. Some antihistamines can slightly raise BP — Cetirizine is one of the safer options for your profile.";
  if (m.includes("sleep"))
    return "Your 6.5 hrs of sleep is below the 7–9 hr adult target. Poor sleep worsens both hypertension and stress.\n\nTips to improve:\n• Fixed sleep/wake time — even weekends\n• No screens 30–60 min before bed\n• Keep bedroom cool (18–20°C)\n• Your Magnesium Glycinate (take 30 min before bed) actively supports sleep quality\n• Avoid caffeine after 2 PM — you reported moderate caffeine use\n\nA 2-week sleep diary helps identify your specific patterns.";
  if (m.includes("exercise") || m.includes("workout") || m.includes("fitness") || m.includes("active"))
    return "You're exercising 2x/week. WHO recommends 150–300 min of moderate activity weekly.\n\nGiven your elevated BP and stress:\n\n🚶 30 min brisk walking 5 days/week — most effective intervention for BP\n🏋️ Add 1 resistance training session — improves metabolic health\n🧘 Yoga or Tai Chi — dual benefit for BP and stress\n\nStart with walking — it's free, low-impact, and has the strongest evidence for blood pressure reduction. Even 3 × 10-min walks count.";
  if (m.includes("diet") || m.includes("food") || m.includes("eat") || m.includes("nutrition"))
    return "For your blood pressure and health profile, the DASH diet is recommended:\n\n✅ Increase: fruits, vegetables, whole grains, legumes, low-fat dairy\n❌ Reduce: sodium (<2,300mg/day), processed foods, red meat\n✅ Potassium-rich foods: bananas, spinach, sweet potato (counteracts sodium)\n✅ Magnesium sources: nuts, seeds, dark chocolate\n\nThe DASH diet can reduce systolic BP by 8–14 mmHg — comparable to one medication. Start with cutting sodium from packaged foods.";
  if (m.includes("risk") || m.includes("health") || m.includes("condition") || m.includes("overview"))
    return "Your current health risk profile:\n\n🔴 Elevated stress (7/10) — highest priority\n🟡 Blood pressure (128/82) — monitoring stage, not yet medicated\n🟡 Sub-optimal sleep (6.5 hrs) — compounding both above\n🟡 Exercise below target (2x vs 5x/week)\n🟢 BMI 25.2 — borderline, manageable\n🟢 No critical drug allergies\n🟢 Seasonal rhinitis — controlled with Cetirizine\n\nOverall risk: Moderate. All flagged areas are lifestyle-modifiable — no medication required yet.";
  if (m.includes("vaccine") || m.includes("vaccination") || m.includes("immunis"))
    return "Vaccines on record: COVID-19 ✓, Hepatitis B ✓, Tetanus ✓\n\nDue / Recommended:\n• Influenza (Flu) — annual, due now for 2026 season\n• Pneumococcal — not required at your age unless high-risk\n\nBook your flu vaccine at your GP or local pharmacy. Takes 2 weeks to become effective. Flu can temporarily spike blood pressure — staying vaccinated protects your cardiovascular health.";
  return "I've reviewed your full health profile. Your main focus areas are blood pressure (128/82), stress (7/10), and sleep quality (6.5 hrs) — all three are interconnected.\n\nI can help you with:\n• Detailed health risk analysis\n• Blood pressure management plan\n• Stress and sleep improvement strategies\n• Medication information and interactions\n• Exercise and diet recommendations\n• Vaccination status\n\nWhat would you like to explore?";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      status === "warning" ? "bg-amber-400" : status === "critical" ? "bg-red-500" : "bg-emerald-400"
    }`} />
  );
}

function MetricCard({ metric }: { metric: typeof HEALTH_METRICS[0] }) {
  return (
    <div className={`bg-white rounded-2xl border-2 p-4 ${
      metric.status === "warning" ? "border-amber-200" : "border-slate-100"
    }`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{metric.icon}</span>
        <StatusDot status={metric.status} />
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-none">
        {metric.value}
        {metric.unit && <span className="text-xs font-normal text-slate-400 ml-1">{metric.unit}</span>}
      </p>
      <p className="text-xs font-semibold text-slate-600 mt-1">{metric.label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{metric.detail}</p>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">👤</div>
            <div>
              <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Personal Health Dashboard</p>
              <h2 className="text-xl font-bold">{PATIENT.name}</h2>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">🆔 {PATIENT.id}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">🩸 {PATIENT.bloodGroup}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">📅 Since {PATIENT.registeredDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/50 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            AI Assistant Active
          </div>
        </div>
      </div>

      {/* Active conditions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Active Conditions</p>
        <div className="flex flex-wrap gap-2">
          {PATIENT.primaryConditions.map((c) => (
            <span key={c} className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-1.5 rounded-xl font-medium">
              {c}
            </span>
          ))}
          <span className="bg-blue-50 border border-blue-200 text-blue-600 text-sm px-3 py-1.5 rounded-xl font-medium">
            Seasonal Allergies (controlled)
          </span>
        </div>
      </div>

      {/* Health metrics grid */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Health Metrics Snapshot</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HEALTH_METRICS.map((m) => <MetricCard key={m.label} metric={m} />)}
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-blue-500 to-teal-400">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
          </svg>
          <h3 className="font-semibold text-white text-sm">AI Health Summary</h3>
          <span className="ml-auto text-xs text-white/70 bg-white/10 px-2 py-0.5 rounded-full">RAG · Updated now</span>
        </div>
        <div className="px-5 py-5">
          <p className="text-slate-600 text-sm leading-relaxed">
            Based on your registration profile, your key health risk factors are elevated stress (7/10), borderline blood pressure (128/82 mmHg),
            and sub-optimal sleep (6.5 hrs). These three factors are interconnected — stress elevates blood pressure and disrupts sleep quality.
            Your BMI is borderline (25.2 kg/m²) and your current medications show no interactions. Immediate focus should be
            stress reduction and a consistent sleep routine before considering pharmacological blood pressure management.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">Based on registration data</span>
            <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-medium">⚠️ 2 warnings · 3 info alerts</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: "📊", label: "View Alerts", sub: "2 warnings", color: "bg-amber-50 border-amber-200 text-amber-700" },
          { icon: "💊", label: "Medications", sub: "3 active", color: "bg-blue-50 border-blue-200 text-blue-700" },
          { icon: "📅", label: "Appointments", sub: "2 upcoming", color: "bg-teal-50 border-teal-200 text-teal-700" },
          { icon: "💬", label: "Ask AI", sub: "Always available", color: "bg-purple-50 border-purple-200 text-purple-700" },
        ].map((item) => (
          <div key={item.label} className={`border rounded-xl p-4 text-center cursor-pointer hover:shadow-sm transition-shadow ${item.color}`}>
            <span className="text-2xl">{item.icon}</span>
            <p className="text-sm font-semibold mt-1">{item.label}</p>
            <p className="text-xs opacity-70">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "Hello! I'm your ESAP AI Health Assistant. I have full access to your registered health profile and can answer questions about your conditions, medications, risk factors, and lifestyle recommendations. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function send(text: string) {
    if (!text.trim() || typing) return;
    const userMsg: ChatMsg = { role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const response = getAIResponse(text);
      setMessages((prev) => [...prev, { role: "ai", text: response }]);
      setTyping(false);
    }, 1000 + Math.random() * 800);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Chat header */}
      <div className="bg-gradient-to-r from-blue-500 to-teal-400 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">🤖</div>
        <div>
          <p className="font-bold text-white text-sm">ESAP AI Health Assistant</p>
          <p className="text-white/70 text-xs">Powered by RAG + Healthcare LLM · Trained on your profile</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-xs text-white/80 bg-white/10 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          Online
        </span>
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2 font-medium">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_Qs.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${
              msg.role === "ai" ? "bg-gradient-to-br from-blue-500 to-teal-400 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {msg.role === "ai" ? "🤖" : "👤"}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
              msg.role === "ai"
                ? "bg-white border border-slate-100 shadow-sm text-slate-700"
                : "bg-gradient-to-r from-blue-500 to-teal-400 text-white"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl px-4 py-3 flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about your health, medications, risk factors…"
          disabled={typing}
          className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm text-slate-700 placeholder-slate-300 disabled:opacity-60 transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || typing}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MedicationsTab() {
  const [adherence, setAdherence] = useState<Record<string, boolean>>(
    Object.fromEntries(MEDICATIONS.map((m) => [m.name, m.adherence]))
  );

  const colorMap: Record<string, { bg: string; border: string; badge: string }> = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700" },
    amber:  { bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Medications", value: MEDICATIONS.length, icon: "💊", color: "text-blue-600" },
          { label: "Taken Today", value: Object.values(adherence).filter(Boolean).length, icon: "✅", color: "text-emerald-600" },
          { label: "Drug Interactions", value: 0, icon: "🛡️", color: "text-teal-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Medications list */}
      <div className="space-y-3">
        {MEDICATIONS.map((med) => {
          const c = colorMap[med.color];
          const taken = adherence[med.name];
          return (
            <div key={med.name} className={`bg-white rounded-2xl border-2 ${c.border} p-5 transition-all`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center text-2xl flex-shrink-0`}>
                    {med.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800">{med.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{med.dosage}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">⏱ {med.frequency}</p>
                    <p className="text-xs text-slate-500 mt-0.5">🎯 {med.purpose}</p>
                  </div>
                </div>

                <button
                  onClick={() => setAdherence((prev) => ({ ...prev, [med.name]: !prev[med.name] }))}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    taken
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300"
                  }`}
                >
                  {taken ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Taken
                    </>
                  ) : (
                    "Mark taken"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety notice */}
      <div className="bg-slate-800 rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-2">🛡️ Drug Interaction Check</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          No critical interactions detected between your current medications and supplements.
          Always inform your doctor or pharmacist before adding new medications — including OTC drugs and supplements.
        </p>
      </div>
    </div>
  );
}

function AlertsTab() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const active = ALERTS.filter((a) => !dismissed.includes(a.id));
  const warnings = active.filter((a) => a.severity === "warning");
  const infos = active.filter((a) => a.severity === "info");

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Alerts", value: active.length, icon: "🔔", color: "text-slate-700" },
          { label: "Warnings", value: warnings.length, icon: "⚠️", color: "text-amber-600" },
          { label: "Info", value: infos.length, icon: "ℹ️", color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {active.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-slate-400 text-sm">All alerts dismissed — great job!</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Warnings</p>
          {warnings.map((alert) => (
            <div key={alert.id} className="bg-white rounded-2xl border-2 border-amber-200 overflow-hidden">
              <div className="flex items-start gap-3 p-5">
                <span className="text-xl flex-shrink-0 mt-0.5">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{alert.title}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{alert.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.detail}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                      💡 {alert.tip}
                    </span>
                    <button
                      onClick={() => setDismissed((p) => [...p, alert.id])}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Informational</p>
          {infos.map((alert) => (
            <div key={alert.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-start gap-3 p-5">
                <span className="text-xl flex-shrink-0 mt-0.5">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{alert.title}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0">{alert.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.detail}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
                      💡 {alert.tip}
                    </span>
                    <button
                      onClick={() => setDismissed((p) => [...p, alert.id])}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentsTab() {
  return (
    <div className="space-y-5">
      {/* Upcoming */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Upcoming Appointments</p>
        <div className="space-y-3">
          {APPOINTMENTS.map((appt, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                  {appt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{appt.type}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{appt.doctor}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full font-medium capitalize">
                      ✓ {appt.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                      📅 {appt.date}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                      🕐 {appt.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">📋 {appt.notes}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Past visits */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Past Visits</p>
        <div className="space-y-3">
          {PAST_VISITS.map((visit, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 opacity-80">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">📋</div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{visit.type}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{visit.doctor}</p>
                  <p className="text-xs text-slate-400 mt-0.5">📅 {visit.date}</p>
                  <p className="text-xs text-slate-500 mt-2">{visit.summary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Book new */}
      <div className="bg-gradient-to-r from-teal-500 to-blue-500 rounded-2xl p-5 text-white">
        <p className="font-bold mb-1">Need an appointment sooner?</p>
        <p className="text-white/80 text-xs mb-4">Contact your GP or use the ESAP booking system to schedule an urgent or routine visit.</p>
        <button className="px-5 py-2.5 bg-white text-teal-600 font-semibold text-sm rounded-xl hover:bg-white/90 transition-colors">
          Book Appointment →
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",      label: "Overview",     icon: "🏠" },
  { id: "chat",          label: "AI Assistant", icon: "💬" },
  { id: "medications",   label: "Medications",  icon: "💊" },
  { id: "alerts",        label: "Alerts",       icon: "🔔" },
  { id: "appointments",  label: "Appointments", icon: "📅" },
];

export default function PatientApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const activeAlerts = ALERTS.length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 leading-none">ESAP Intelligence</p>
              <p className="text-sm font-bold text-slate-800 leading-tight">My Health</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Demo banner */}
            <span className="hidden sm:flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-600 px-2.5 py-1 rounded-full font-medium">
              🧪 Demo Mode
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Active
            </span>
            <Link
              href="/"
              className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              title="Back to home"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="max-w-4xl mx-auto px-4 flex gap-0.5 overflow-x-auto border-t border-slate-100 pb-0 no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap relative ${
                tab === t.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.id === "alerts" && activeAlerts > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold ml-0.5">
                  {activeAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Demo notice */}
        <div className="mb-5 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">🧪</span>
          <div>
            <p className="text-sm font-semibold text-purple-800">Demo Patient App — Phase 5</p>
            <p className="text-xs text-purple-600 mt-0.5">
              This demo uses sample health data. In production, your data would come from your actual registration profile.
              <Link href="/register" className="ml-1 underline font-medium hover:text-purple-800">Complete registration →</Link>
            </p>
          </div>
        </div>

        {tab === "overview"     && <OverviewTab />}
        {tab === "chat"         && <ChatTab />}
        {tab === "medications"  && <MedicationsTab />}
        {tab === "alerts"       && <AlertsTab />}
        {tab === "appointments" && <AppointmentsTab />}
      </main>
    </div>
  );
}
