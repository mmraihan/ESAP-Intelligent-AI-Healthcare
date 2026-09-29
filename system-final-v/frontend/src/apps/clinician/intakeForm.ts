/**
 * The intake form's values, how they become an IntakeRequest, and the canned
 * sample patients that fill it in one click (ported from the earlier build's
 * "Load a sample patient" card) so the flow can be demonstrated without typing.
 *
 * Values use the real feature schema — CCSR codes from the server's catalog and
 * MIMIC lab itemids — so the models produce real output. Purely illustrative:
 * these are not patients.
 */

export type VitalKey =
  | "bp_sys" | "bp_dia" | "heart_rate" | "resp_rate" | "temp_c" | "spo2" | "weight_kg" | "height_cm";

export type IntakeValues = {
  age: string;
  sex: "F" | "M";
  admissionType: string;
  admissionLocation: string;
  viaEd: boolean;
  vitals: Record<VitalKey, string>;
  /** itemid -> value */
  labs: Record<string, string>;
  priorCcsr: { code: string; label: string }[];
  priorAdmissions: string;
  charlson: string;
  meds: string[];
  notes: { chiefComplaint: string; hpi: string; pmh: string; exam: string };
};

/** A number the server will accept, or undefined for blank / garbage. */
function num(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() && !Number.isNaN(n) ? n : undefined;
}

/**
 * The `features` object of an IntakeRequest, built from what is on the form.
 *
 * Audit covariates are deliberately absent: they are captured on the
 * encounter for the fairness panel and are refused inside `features` by the
 * server, so there is nowhere for them to leak into a prediction from here.
 */
export function toFeatures(form: IntakeValues) {
  const labs: Record<string, number> = {};
  for (const [itemid, raw] of Object.entries(form.labs)) {
    const n = num(raw);
    if (n !== undefined) labs[itemid] = n;
  }
  // The intake contract carries blood pressure and body size; heart rate,
  // respiratory rate, temperature and SpO₂ stay on the chart only.
  const weight = num(form.vitals.weight_kg);
  const height = num(form.vitals.height_cm);
  const notes = {
    chief_complaint: form.notes.chiefComplaint.trim() || undefined,
    hpi: form.notes.hpi.trim() || undefined,
    pmh: form.notes.pmh.trim() || undefined,
    physical_exam: form.notes.exam.trim() || undefined,
  };
  return {
    demographics: {
      admission_age: Number(form.age) || 0,
      is_female: form.sex === "F" ? 1 : 0,
    },
    admission_context: {
      via_ed: form.viaEd ? 1 : 0,
      admission_type: form.admissionType,
      admission_location: form.admissionLocation,
    },
    vitals: {
      bp_sys: num(form.vitals.bp_sys),
      bp_dia: num(form.vitals.bp_dia),
      weight_kg: weight,
      height_cm: height,
      bmi: weight && height ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : undefined,
    },
    labs,
    // Prior conditions come from what the clinician recorded, never from the
    // encounter's own differential — that would feed a model its own
    // prediction back as history.
    prior_history: {
      prior_ccsr: form.priorCcsr.map((c) => c.code),
      n_prior_admissions: Number(form.priorAdmissions) || 0,
      charlson_index: num(form.charlson) ?? null,
    },
    meds: form.meds.map((m) => m.toLowerCase()),
    notes: Object.values(notes).some(Boolean) ? notes : null,
  };
}

export type SampleProfile = { id: string; label: string; blurb: string; values: IntakeValues };

export const EMPTY_VITALS: Record<VitalKey, string> = {
  bp_sys: "", bp_dia: "", heart_rate: "", resp_rate: "", temp_c: "", spo2: "", weight_kg: "", height_cm: "",
};

/** What "Clear" leaves behind: nothing but the required defaults. */
export const EMPTY_INTAKE: IntakeValues = {
  age: "",
  sex: "F",
  admissionType: "EW EMER.",
  admissionLocation: "EMERGENCY ROOM",
  viaEd: true,
  vitals: EMPTY_VITALS,
  labs: {},
  priorCcsr: [],
  priorAdmissions: "",
  charlson: "",
  meds: [],
  notes: { chiefComplaint: "", hpi: "", pmh: "", exam: "" },
};

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: "cardiac",
    label: "Cardiac · 68M",
    blurb: "68M via ED, heart failure + hypertension + diabetes, five home meds, abnormal labs — a repeat-patient case.",
    values: {
      age: "68",
      sex: "M",
      admissionType: "EW EMER.",
      admissionLocation: "EMERGENCY ROOM",
      viaEd: true,
      vitals: {
        bp_sys: "150", bp_dia: "95", heart_rate: "102", resp_rate: "22",
        temp_c: "36.9", spo2: "94", weight_kg: "88", height_cm: "176",
      },
      labs: { "50912": "1.4", "50971": "4.3", "50983": "137", "51222": "12.1", "51301": "8.2", "50813": "1.6", "50862": "3.6", "51006": "28" },
      priorCcsr: [
        { code: "CIR019", label: "Heart failure" },
        { code: "CIR008", label: "Hypertension with complications" },
        { code: "END003", label: "Diabetes with complication" },
      ],
      priorAdmissions: "3",
      charlson: "5",
      meds: ["Metformin", "Furosemide", "Lisinopril", "Metoprolol", "Aspirin"],
      notes: {
        chiefComplaint: "Worsening shortness of breath and ankle swelling for four days.",
        hpi: "Known heart failure. Increasing breathlessness on exertion, now at rest; two-pillow orthopnoea. Weight up 3 kg this week. Missed furosemide doses.",
        pmh: "Heart failure, hypertension, type 2 diabetes. Three admissions in the past year.",
        exam: "Bibasal crackles, raised JVP, pitting oedema to mid-shin. Alert and oriented.",
      },
    },
  },
  {
    id: "respiratory",
    label: "Respiratory · 74F",
    blurb: "74F via ED, COPD with raised white count and low saturations — a respiratory exacerbation.",
    values: {
      age: "74",
      sex: "F",
      admissionType: "EW EMER.",
      admissionLocation: "EMERGENCY ROOM",
      viaEd: true,
      vitals: {
        bp_sys: "132", bp_dia: "78", heart_rate: "108", resp_rate: "28",
        temp_c: "38.1", spo2: "88", weight_kg: "58", height_cm: "164",
      },
      labs: { "50912": "0.9", "50971": "4.0", "50983": "139", "51222": "11.8", "51301": "13.5", "50813": "2.4", "50862": "3.2", "51006": "18" },
      priorCcsr: [
        { code: "RSP008", label: "COPD and bronchiectasis" },
        { code: "CIR019", label: "Heart failure" },
      ],
      priorAdmissions: "5",
      charlson: "4",
      meds: ["Salbutamol", "Prednisolone", "Apixaban"],
      notes: {
        chiefComplaint: "Increasing breathlessness and productive cough for three days.",
        hpi: "Known COPD. Green sputum, fever since yesterday, using reliever inhaler hourly without relief.",
        pmh: "COPD, heart failure. Five admissions in the past year, two for exacerbations.",
        exam: "Tachypnoeic, using accessory muscles. Widespread wheeze, coarse crackles right base.",
      },
    },
  },
  {
    id: "coldstart",
    label: "Cold-start · 45F",
    blurb: "45F elective admission with no prior history — exercises the cold-start / no-history path.",
    values: {
      age: "45",
      sex: "F",
      admissionType: "ELECTIVE",
      admissionLocation: "PHYSICIAN REFERRAL",
      viaEd: false,
      vitals: {
        bp_sys: "118", bp_dia: "76", heart_rate: "72", resp_rate: "14",
        temp_c: "36.7", spo2: "99", weight_kg: "66", height_cm: "165",
      },
      labs: { "50912": "0.8", "50983": "140", "51222": "13.5" },
      priorCcsr: [],
      priorAdmissions: "0",
      charlson: "0",
      meds: [],
      notes: {
        chiefComplaint: "Planned admission for elective procedure.",
        hpi: "Referred by her physician. No acute complaints.",
        pmh: "No significant past history.",
        exam: "Well, comfortable at rest. Unremarkable.",
      },
    },
  },
];
