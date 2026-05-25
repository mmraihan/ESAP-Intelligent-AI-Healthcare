import { survey } from "@/data/questions";

export type RiskLevel = "low" | "moderate" | "high";

export interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  priority: "routine" | "soon" | "urgent";
  icon: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  riskScore: number; // 0–100
  summary: string;
  flags: RiskFlag[];
  recommendations: RecommendedAction[];
  profileLabel: string; // e.g., "Active Adult – Low Risk"
  completionPct: number;
}

type Answers = Record<string, string | string[] | number | undefined>;

function getLabel(questionId: string, value: string, answers: Answers): string {
  const q = survey.questions.find((q) => q.id === questionId);
  if (!q) return value;
  return q.options?.find((o) => o.id === value)?.label ?? value;
}

export function analyzeAnswers(answers: Answers): AnalysisResult {
  const flags: RiskFlag[] = [];
  const recommendations: RecommendedAction[] = [];
  let riskScore = 0;

  // ── Q1: Overall health status ──────────────────────────────────
  const health = answers["q1"] as string;
  if (health === "poor") {
    riskScore += 35;
    flags.push({
      id: "poor-health",
      label: "Self-reported Poor Health",
      detail: "Patient reports poor overall health. Comprehensive physical assessment recommended.",
      severity: "critical",
    });
    recommendations.push({
      id: "gp-urgent",
      title: "Urgent GP Consultation",
      description: "Schedule a full physical assessment with your primary care physician within 1 week.",
      priority: "urgent",
      icon: "🏥",
    });
  } else if (health === "fair") {
    riskScore += 15;
    flags.push({
      id: "fair-health",
      label: "Fair Health Status",
      detail: "Patient self-rates health as fair. Preventive check-up is advisable.",
      severity: "warning",
    });
    recommendations.push({
      id: "gp-soon",
      title: "Schedule Preventive Check-up",
      description: "Book a routine GP visit within 4–6 weeks to review overall health.",
      priority: "soon",
      icon: "📋",
    });
  } else if (health === "good" || health === "excellent") {
    recommendations.push({
      id: "annual-screening",
      title: "Annual Health Screening",
      description: "Continue annual preventive screenings to maintain your good health baseline.",
      priority: "routine",
      icon: "✅",
    });
  }

  // ── Q2: Healthcare services used ───────────────────────────────
  const services = (answers["q2"] as string[]) ?? [];
  if (services.includes("emergency")) {
    riskScore += 20;
    flags.push({
      id: "ed-use",
      label: "Emergency Department Use",
      detail: "Patient used Emergency Department in the past 12 months. Review underlying cause.",
      severity: "warning",
    });
  }
  if (services.includes("mental")) {
    flags.push({
      id: "mental-services",
      label: "Active Mental Health Support",
      detail: "Patient is engaged with mental health services — ensure continuity of care.",
      severity: "info",
    });
    recommendations.push({
      id: "mental-continuity",
      title: "Mental Health Continuity",
      description: "Ensure ongoing mental health appointments are maintained and documented in your profile.",
      priority: "soon",
      icon: "🧠",
    });
  }
  if (services.includes("telehealth")) {
    flags.push({
      id: "telehealth",
      label: "Telehealth User",
      detail: "Patient is comfortable with digital health channels — AI assistant adoption likely high.",
      severity: "info",
    });
  }

  // ── Q3: Satisfaction rating ─────────────────────────────────────
  const satisfaction = answers["q3"] as number;
  if (satisfaction !== undefined && satisfaction <= 2) {
    riskScore += 10;
    flags.push({
      id: "low-satisfaction",
      label: "Low Care Satisfaction",
      detail: "Patient rates care satisfaction at 2/5 or below. Investigate care gaps.",
      severity: "warning",
    });
    recommendations.push({
      id: "feedback-review",
      title: "Patient Experience Review",
      description: "Patient Care team to follow up on care quality concerns raised in this assessment.",
      priority: "soon",
      icon: "💬",
    });
  }

  // ── Q4: AI comfort scale ────────────────────────────────────────
  const aiComfort = answers["q4"] as number;
  if (aiComfort !== undefined && aiComfort < 4) {
    flags.push({
      id: "ai-discomfort",
      label: "Low AI Comfort Level",
      detail: "Patient is not comfortable with AI-assisted care. Human oversight required for all AI suggestions.",
      severity: "warning",
    });
    recommendations.push({
      id: "ai-education",
      title: "AI Literacy Support",
      description: "Provide patient with information materials about how AI assistance works and its safety protocols.",
      priority: "routine",
      icon: "📖",
    });
  } else if (aiComfort !== undefined && aiComfort >= 8) {
    flags.push({
      id: "ai-ready",
      label: "AI-Ready Patient",
      detail: "High comfort with AI — candidate for full AI assistant onboarding and personal health app.",
      severity: "info",
    });
    recommendations.push({
      id: "ai-app",
      title: "Personal AI Health App",
      description: "Enroll patient in the ESAP Personal Healthcare Assistant for continuous AI-powered monitoring.",
      priority: "routine",
      icon: "📱",
    });
  }

  // ── Q5: Primary health info source ─────────────────────────────
  const infoSource = answers["q5"] as string;
  if (infoSource === "internet") {
    flags.push({
      id: "self-diagnosis-risk",
      label: "Internet Self-Diagnosis Tendency",
      detail: "Patient primarily uses internet search for health information. Risk of misinformation.",
      severity: "warning",
    });
    recommendations.push({
      id: "trusted-sources",
      title: "Provide Verified Health Resources",
      description: "Share curated, clinician-approved health resources to replace unverified internet searches.",
      priority: "routine",
      icon: "🔗",
    });
  }

  // ── Q6: Desired AI features ─────────────────────────────────────
  const desiredFeatures = (answers["q6"] as string[]) ?? [];
  if (desiredFeatures.includes("mental_support")) {
    if (!services.includes("mental")) {
      flags.push({
        id: "mental-need-unmet",
        label: "Unmet Mental Health Need",
        detail: "Patient wants mental health AI support but has not used mental health services.",
        severity: "warning",
      });
      recommendations.push({
        id: "mental-referral",
        title: "Mental Health Screening",
        description: "Patient indicated interest in mental health support. Consider a PHQ-9 screening at next visit.",
        priority: "soon",
        icon: "🧘",
      });
    }
  }
  if (desiredFeatures.includes("medication")) {
    recommendations.push({
      id: "med-reminder",
      title: "Enable Medication Reminders",
      description: "Set up AI-driven medication reminder system for improved adherence.",
      priority: "routine",
      icon: "💊",
    });
  }

  // ── Q7: Likelihood to recommend ─────────────────────────────────
  const nps = answers["q7"] as number;
  if (nps !== undefined && nps <= 2) {
    riskScore += 5;
    flags.push({
      id: "low-nps",
      label: "Low Recommendation Score",
      detail: "Patient unlikely to recommend AI healthcare tools. Address trust and usability barriers.",
      severity: "info",
    });
  }

  // ── Determine risk level ─────────────────────────────────────────
  const riskLevel: RiskLevel =
    riskScore >= 40 ? "high" : riskScore >= 15 ? "moderate" : "low";

  // ── Completion percentage ────────────────────────────────────────
  const answered = survey.questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : a !== undefined && a !== "";
  }).length;
  const completionPct = Math.round((answered / survey.questions.length) * 100);

  // ── Profile label ────────────────────────────────────────────────
  const healthLabel = health
    ? getLabel("q1", health, answers)
    : "Unknown Health Status";

  const infoLabel =
    infoSource === "ai_tools"
      ? "Tech-Forward"
      : infoSource === "internet"
      ? "Self-Directed"
      : infoSource === "doctor"
      ? "Doctor-Centric"
      : "General";

  const profileLabel = `${healthLabel} · ${infoLabel} · ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk`;

  // ── AI narrative summary ─────────────────────────────────────────
  const summaryParts: string[] = [];

  if (health) {
    summaryParts.push(
      `Patient self-reports ${getLabel("q1", health, answers).toLowerCase()} overall health.`
    );
  }
  if (services.length > 0) {
    const serviceLabels = services
      .slice(0, 3)
      .map((s) => getLabel("q2", s, answers))
      .join(", ");
    summaryParts.push(`In the past 12 months, services accessed include: ${serviceLabels}.`);
  }
  if (satisfaction !== undefined) {
    summaryParts.push(
      `Care satisfaction is rated ${satisfaction}/5 — ${
        satisfaction >= 4 ? "indicating a positive care experience" : "suggesting areas for care improvement"
      }.`
    );
  }
  if (aiComfort !== undefined) {
    summaryParts.push(
      `AI comfort level is ${aiComfort}/10 — ${
        aiComfort >= 7
          ? "patient is a strong candidate for full AI assistant enrollment"
          : aiComfort >= 4
          ? "moderate AI readiness; guided onboarding recommended"
          : "patient requires education and human oversight for AI-assisted care"
      }.`
    );
  }

  const flagCount = flags.filter((f) => f.severity !== "info").length;
  if (flagCount > 0) {
    summaryParts.push(
      `RAG analysis identified ${flagCount} clinical concern${flagCount > 1 ? "s" : ""} requiring attention. See flags below.`
    );
  } else {
    summaryParts.push("No critical clinical concerns identified from this assessment.");
  }

  const summary = summaryParts.join(" ");

  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    recommendations.push({
      id: "maintain-health",
      title: "Maintain Current Health Practices",
      description: "Continue regular exercise, balanced diet, and annual health screenings.",
      priority: "routine",
      icon: "🌱",
    });
  }

  return {
    riskLevel,
    riskScore: Math.min(riskScore, 100),
    summary,
    flags,
    recommendations,
    profileLabel,
    completionPct,
  };
}
