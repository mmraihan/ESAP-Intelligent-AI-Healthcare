import type { RegAnswers } from "@/data/registration-fields";

type Answer = RegAnswers[string];

function yn(v: Answer): boolean {
  return v === "yes" || v === true;
}
function str(v: Answer): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}
function num(v: Answer): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function arr(v: Answer): string[] | undefined {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "string" ? (v as string[]) : undefined;
}

interface FamilyHistoryEntry {
  condition: string;
  affected_relatives?: string[];
  additional_details?: string;
}

function buildFamilyHistory(a: RegAnswers): FamilyHistoryEntry[] | undefined {
  const entries: FamilyHistoryEntry[] = [];
  if (yn(a.family_diabetes)) entries.push({ condition: "diabetes", affected_relatives: arr(a.family_diabetes_relative) });
  if (yn(a.family_hypertension)) entries.push({ condition: "hypertension" });
  if (yn(a.family_heart_disease)) entries.push({ condition: "heart_disease", affected_relatives: arr(a.family_heart_relative) });
  if (yn(a.family_cancer)) entries.push({ condition: "cancer", additional_details: str(a.family_cancer_type) });
  if (yn(a.family_mental_health)) entries.push({ condition: "mental_health", additional_details: str(a.family_mental_type) });
  if (yn(a.family_stroke)) entries.push({ condition: "stroke" });
  if (yn(a.family_kidney_disease)) entries.push({ condition: "kidney_disease" });
  const genetic = str(a.family_genetic_diseases);
  if (genetic) entries.push({ condition: "genetic_or_rare_disease", additional_details: genetic });
  return entries.length > 0 ? entries : undefined;
}

/** Maps the flat registration-wizard answers to the nested PatientCreateRequest
 *  shape esap-api expects, plus a separate Visit payload for the "Current
 *  Symptoms" section (submitted via POST /api/surveys as visit_type="registration"). */
export function toPatientCreateRequest(answers: RegAnswers) {
  const a = answers;

  const patient = {
    full_name: str(a.full_name),
    preferred_name: str(a.preferred_name),
    date_of_birth: str(a.dob),
    biological_sex: str(a.biological_sex),
    gender_identity: str(a.gender_identity),
    blood_group: str(a.blood_group),
    height_cm: num(a.height_cm),
    weight_kg: num(a.weight_kg),
    nationality: str(a.nationality),
    ethnicity: arr(a.ethnicity),
    marital_status: str(a.marital_status),
    education_level: str(a.education_level),
    religion: str(a.religion),

    contact: {
      primary_phone: str(a.primary_phone),
      secondary_phone: str(a.secondary_phone),
      email: str(a.email),
      address_street: str(a.address_street),
      address_city: str(a.address_city),
      address_country: str(a.address_country),
      postal_code: str(a.postal_code),
      emergency_name: str(a.emergency_name),
      emergency_phone: str(a.emergency_phone),
      emergency_relation: str(a.emergency_relationship),
      preferred_method: str(a.preferred_contact_method),
      preferred_time: str(a.preferred_contact_time),
    },

    medical_history: {
      chronic_conditions: arr(a.chronic_conditions),
      past_surgeries: str(a.past_surgeries) ? [{ description: str(a.past_surgeries) }] : undefined,
      past_hospitalizations: str(a.past_hospitalizations),
      serious_infections: arr(a.serious_infections),
      cancer_history: yn(a.cancer_history),
      cancer_details: str(a.cancer_details),
      mental_health_history: arr(a.mental_health_history),
      pregnancy_status: str(a.pregnancy_status),
      gestational_age_weeks: num(a.gestational_age),
      disability_status: arr(a.disability_status),
      vaccinations: arr(a.vaccinations),
    },

    lifestyle: {
      smoking_status: str(a.smoking_status),
      cigarettes_per_day: num(a.cigarettes_per_day),
      alcohol_consumption: str(a.alcohol_consumption),
      exercise_frequency: str(a.exercise_frequency),
      exercise_type: arr(a.exercise_type),
      diet_type: str(a.diet_type),
      water_intake: str(a.water_intake),
      sleep_hours: num(a.sleep_hours),
      stress_level: num(a.stress_level),
      occupation: str(a.occupation),
      work_environment: str(a.work_environment),
      caffeine_consumption: str(a.caffeine_consumption),
    },

    family_history: buildFamilyHistory(a),

    insurance: {
      insurance_provider: str(a.insurance_provider),
      policy_number: str(a.insurance_policy_number),
      plan_type: str(a.insurance_plan_type),
      coverage_expiry: str(a.insurance_expiry),
      pcp_name: str(a.pcp_name),
      referring_doctor: str(a.referring_doctor),
      preferred_hospital: str(a.preferred_hospital),
      preferred_language: str(a.preferred_language),
      interpreter_required: yn(a.interpreter_required),
      preferred_doctor: str(a.preferred_doctor),
    },

    consent: {
      ai_diagnosis: yn(a.consent_ai_diagnosis),
      speech_recording: yn(a.consent_speech_recording),
      transcription: yn(a.consent_transcription),
      share_with_doctors: yn(a.consent_share_doctors),
      share_with_specialists: yn(a.consent_share_specialists),
      research_training: yn(a.consent_research),
      lab_sharing: yn(a.consent_labs),
      personal_app: yn(a.consent_personal_app),
      emergency_override: yn(a.emergency_override_consent),
      signature_data: str(a.digital_signature),
      data_retention: str(a.data_retention),
    },

    // Freeform medication/allergy narrative + external-records metadata that
    // doesn't map to a structured row — kept as raw text, not parsed.
    intake_detail: {
      current_medications_text: str(a.current_medications),
      otc_medications_text: str(a.otc_medications),
      supplements_text: str(a.supplements),
      medication_adherence: str(a.medication_adherence),
      drug_allergies_text: str(a.drug_allergies),
      food_allergies_text: str(a.food_allergies),
      environmental_allergies_text: str(a.environmental_allergies),
      allergy_reaction_type: str(a.allergy_reaction_type),
      previous_anaphylaxis: yn(a.previous_anaphylaxis),
      latex_allergy: yn(a.latex_allergy),
      existing_ehr_id: str(a.existing_ehr_id),
      previous_hospital: str(a.previous_hospital),
      previous_doctor: str(a.previous_doctor),
      last_visit_date: str(a.last_visit_date),
      previous_diagnoses: str(a.previous_diagnoses),
    },
  };

  const hasSymptomData = [a.chief_complaint, a.symptom_description, a.duration].some((v) => str(v));
  const visit = hasSymptomData
    ? {
        visit_type: "registration",
        chief_complaint: str(a.chief_complaint),
        symptom_description: str(a.symptom_description),
        onset_date: str(a.onset_date),
        onset_type: str(a.onset_type),
        duration: str(a.duration),
        pain_scale: num(a.pain_scale),
        symptom_location: str(a.symptom_location),
        associated_symptoms: arr(a.associated_symptoms),
        aggravating_factors: arr(a.aggravating_factors),
        relieving_factors: arr(a.relieving_factors),
        previous_episodes: a.previous_episodes === undefined ? undefined : yn(a.previous_episodes),
        self_treatment: str(a.self_treatment),
      }
    : null;

  return { patient, visit };
}
