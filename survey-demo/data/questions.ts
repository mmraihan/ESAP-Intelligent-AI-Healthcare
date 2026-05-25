export type QuestionType = "single" | "multiple" | "rating" | "text" | "scale";

export interface Option {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  description?: string;
  options?: Option[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  required: boolean;
}

export interface SurveyConfig {
  title: string;
  subtitle: string;
  questions: Question[];
}

export const survey: SurveyConfig = {
  title: "Healthcare Experience Survey",
  subtitle: "Help us improve AI-powered healthcare services by sharing your experience.",
  questions: [
    {
      id: "q1",
      type: "single",
      text: "How would you describe your overall health status?",
      description: "Select the option that best describes you right now.",
      options: [
        { id: "excellent", label: "Excellent" },
        { id: "good", label: "Good" },
        { id: "fair", label: "Fair" },
        { id: "poor", label: "Poor" },
      ],
      required: true,
    },
    {
      id: "q2",
      type: "multiple",
      text: "Which healthcare services have you used in the past 12 months?",
      description: "Select all that apply.",
      options: [
        { id: "gp", label: "General Practitioner (GP)" },
        { id: "specialist", label: "Specialist Consultation" },
        { id: "telehealth", label: "Telehealth / Online Consultation" },
        { id: "emergency", label: "Emergency Department" },
        { id: "mental", label: "Mental Health Services" },
        { id: "pharmacy", label: "Pharmacy / Medication" },
      ],
      required: true,
    },
    {
      id: "q3",
      type: "rating",
      text: "How satisfied are you with the quality of healthcare you received?",
      description: "Rate from 1 (very dissatisfied) to 5 (very satisfied).",
      min: 1,
      max: 5,
      required: true,
    },
    {
      id: "q4",
      type: "scale",
      text: "How comfortable are you with AI being used in your healthcare?",
      description: "Drag or click to indicate your comfort level.",
      min: 0,
      max: 10,
      minLabel: "Not comfortable at all",
      maxLabel: "Very comfortable",
      required: true,
    },
    {
      id: "q5",
      type: "single",
      text: "How do you primarily access healthcare information?",
      options: [
        { id: "doctor", label: "My doctor / healthcare provider" },
        { id: "internet", label: "Internet search (Google, etc.)" },
        { id: "apps", label: "Health apps or wearables" },
        { id: "ai_tools", label: "AI tools (ChatGPT, Copilot, etc.)" },
        { id: "family", label: "Family / friends" },
      ],
      required: true,
    },
    {
      id: "q6",
      type: "multiple",
      text: "What features would you value most in an AI healthcare assistant?",
      description: "Select up to 3 features.",
      options: [
        { id: "symptom", label: "Symptom checker & triage" },
        { id: "appointments", label: "Appointment scheduling" },
        { id: "records", label: "Access to my health records" },
        { id: "medication", label: "Medication reminders & info" },
        { id: "nutrition", label: "Nutrition & lifestyle advice" },
        { id: "mental_support", label: "Mental health support" },
        { id: "second_opinion", label: "Second opinion & explanations" },
      ],
      required: true,
    },
    {
      id: "q7",
      type: "rating",
      text: "How likely are you to recommend AI-powered healthcare tools to others?",
      description: "Rate your likelihood from 1 to 5.",
      min: 1,
      max: 5,
      required: false,
    },
    {
      id: "q8",
      type: "text",
      text: "Is there anything else you'd like to share about your healthcare experience or expectations?",
      description: "Optional — your feedback helps us improve.",
      required: false,
    },
  ],
};
