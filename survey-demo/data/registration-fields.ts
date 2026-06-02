export type FieldType =
  | "text" | "number" | "date" | "email" | "tel"
  | "dropdown" | "multiselect" | "boolean"
  | "textarea" | "slider" | "scale"
  | "file" | "signature";

export interface FieldOption { value: string; label: string }

export interface RegField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  unit?: string;
  aiPurpose: string;
  conditional?: { fieldId: string; value: string | boolean };
  autoCalc?: string; // formula hint, display only
}

export interface RegSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  fields: RegField[];
}

const yn: FieldOption[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];

export const registrationSections: RegSection[] = [
  // ─────────────────────────────────────────────────────────────────
  // 1. Personal & Demographics
  // ─────────────────────────────────────────────────────────────────
  {
    id: "demographics",
    title: "Personal & Demographics",
    icon: "👤",
    color: "blue",
    description: "Core identity data used to anchor your medical record and power age-specific AI clinical rules.",
    fields: [
      { id: "full_name", label: "Full Legal Name", type: "text", required: true, placeholder: "e.g. Jane Marie Smith", aiPurpose: "Patient identity anchor across all records and AI queries" },
      { id: "preferred_name", label: "Preferred Name / Nickname", type: "text", required: false, placeholder: "e.g. Jamie", aiPurpose: "Personalization in patient-facing app and doctor UI" },
      { id: "dob", label: "Date of Birth", type: "date", required: true, aiPurpose: "Age calculation; age-specific risk models and drug dosage thresholds" },
      { id: "biological_sex", label: "Biological Sex", type: "dropdown", required: true, options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "intersex", label: "Intersex" }], aiPurpose: "Sex-specific disease risk, medication metabolism, lab reference ranges" },
      { id: "gender_identity", label: "Gender Identity", type: "text", required: false, placeholder: "Optional — describe if applicable", aiPurpose: "Inclusive care; hormone-related history and mental health context" },
      { id: "nationality", label: "Nationality", type: "text", required: true, placeholder: "e.g. Australian", aiPurpose: "Population-level epidemiological risk baselines" },
      { id: "ethnicity", label: "Ethnicity / Race", type: "multiselect", required: false, options: [{ value: "caucasian", label: "Caucasian / White" }, { value: "asian", label: "Asian" }, { value: "black", label: "Black / African" }, { value: "hispanic", label: "Hispanic / Latino" }, { value: "middle_eastern", label: "Middle Eastern" }, { value: "indigenous", label: "Indigenous / First Nations" }, { value: "mixed", label: "Mixed Heritage" }, { value: "other", label: "Other" }], aiPurpose: "Genetic disease predisposition risk overlay" },
      { id: "blood_group", label: "Blood Group", type: "dropdown", required: true, options: ["A+","A−","B+","B−","AB+","AB−","O+","O−"].map(v => ({ value: v, label: v })), aiPurpose: "Emergency transfusion decisions; surfaced immediately in critical alerts" },
      { id: "height_cm", label: "Height", type: "number", required: true, min: 50, max: 250, unit: "cm", placeholder: "e.g. 172", aiPurpose: "BMI calculation; weight-based drug dosage rules" },
      { id: "weight_kg", label: "Weight", type: "number", required: true, min: 2, max: 500, unit: "kg", placeholder: "e.g. 68", aiPurpose: "BMI calculation; obesity-related risk stratification" },
      { id: "bmi", label: "BMI (auto-calculated)", type: "number", required: false, autoCalc: "weight_kg / (height_cm/100)²", aiPurpose: "Metabolic syndrome screening, surgical risk scoring" },
      { id: "marital_status", label: "Marital Status", type: "dropdown", required: false, options: ["Single","Married","De Facto","Divorced","Widowed","Separated"].map(v => ({ value: v.toLowerCase(), label: v })), aiPurpose: "Psychosocial context for mental health and chronic disease compliance" },
      { id: "education_level", label: "Highest Education Level", type: "dropdown", required: false, options: ["No formal education","Primary school","Secondary school","Certificate / Diploma","Bachelor's degree","Postgraduate degree"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Health literacy estimation; simplifies AI-generated explanations" },
      { id: "religion", label: "Religion", type: "text", required: false, placeholder: "Optional", aiPurpose: "Dietary restrictions and blood transfusion consent flags" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. Contact & Emergency Info
  // ─────────────────────────────────────────────────────────────────
  {
    id: "contact",
    title: "Contact & Emergency Info",
    icon: "📞",
    color: "teal",
    description: "Used for AI-driven alerts, appointment reminders, and emergency escalation routing.",
    fields: [
      { id: "primary_phone", label: "Primary Phone Number", type: "tel", required: true, placeholder: "+61 4XX XXX XXX", aiPurpose: "Appointment reminders; AI-driven follow-up and medication alerts" },
      { id: "secondary_phone", label: "Secondary Phone Number", type: "tel", required: false, placeholder: "Optional", aiPurpose: "Fallback for critical AI-triggered health alerts" },
      { id: "email", label: "Email Address", type: "email", required: true, placeholder: "you@example.com", aiPurpose: "Secure delivery of AI-generated health summaries and lab results" },
      { id: "address_street", label: "Home Address — Street", type: "text", required: true, placeholder: "e.g. 14 Health Street", aiPurpose: "Geographic disease cluster detection; nearest facility routing" },
      { id: "address_city", label: "City / Suburb", type: "text", required: true, placeholder: "e.g. Sydney", aiPurpose: "Regional disease prevalence overlay in risk models" },
      { id: "address_country", label: "Country", type: "dropdown", required: true, options: ["Australia","Bangladesh","Canada","India","Malaysia","New Zealand","Singapore","United Kingdom","United States","Other"].map(v => ({ value: v.toLowerCase().replace(/\s/g,"_"), label: v })), aiPurpose: "Country-specific clinical guidelines and formulary references" },
      { id: "postal_code", label: "Postal / ZIP Code", type: "text", required: true, placeholder: "e.g. 2000", aiPurpose: "Granular epidemiological data; environmental exposure risk" },
      { id: "emergency_name", label: "Emergency Contact — Full Name", type: "text", required: true, placeholder: "e.g. John Smith", aiPurpose: "Critical alert routing when patient is unresponsive" },
      { id: "emergency_relationship", label: "Emergency Contact — Relationship", type: "dropdown", required: true, options: ["Spouse","Parent","Sibling","Child","Friend","Guardian","Other"].map(v => ({ value: v.toLowerCase(), label: v })), aiPurpose: "Context for medical decision-making authority" },
      { id: "emergency_phone", label: "Emergency Contact — Phone", type: "tel", required: true, placeholder: "+61 4XX XXX XXX", aiPurpose: "Immediate escalation by the AI alert system" },
      { id: "preferred_contact_method", label: "Preferred Contact Method", type: "dropdown", required: true, options: ["Phone","SMS","Email","WhatsApp"].map(v => ({ value: v.toLowerCase(), label: v })), aiPurpose: "AI notification routing preference" },
      { id: "preferred_contact_time", label: "Preferred Contact Time", type: "dropdown", required: false, options: ["Morning","Afternoon","Evening","Any time"].map(v => ({ value: v.toLowerCase().replace(/\s/g,"_"), label: v })), aiPurpose: "Smart scheduling for AI-driven reminders" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. Current Symptoms & Chief Complaint
  // ─────────────────────────────────────────────────────────────────
  {
    id: "symptoms",
    title: "Current Symptoms",
    icon: "🩺",
    color: "red",
    description: "Entry point for AI symptom-matching, triage scoring, and differential generation.",
    fields: [
      { id: "chief_complaint", label: "Chief Complaint", type: "textarea", required: true, placeholder: "Describe the primary reason for this visit…", aiPurpose: "Entry point for AI symptom-matching and differential generation" },
      { id: "symptom_description", label: "Symptom Description", type: "textarea", required: true, placeholder: "Describe your symptoms in detail…", aiPurpose: "NLP extraction of symptom entities for RAG retrieval" },
      { id: "onset_date", label: "Symptom Onset Date", type: "date", required: true, aiPurpose: "Acuity calculation; acute vs. chronic classification" },
      { id: "onset_type", label: "Onset Type", type: "dropdown", required: true, options: [{ value: "sudden", label: "Sudden" }, { value: "gradual", label: "Gradual" }, { value: "intermittent", label: "Intermittent" }], aiPurpose: "Triage prioritization; sudden onset triggers critical-alert rules" },
      { id: "duration", label: "Symptom Duration", type: "text", required: true, placeholder: "e.g. 3 days, 2 weeks", aiPurpose: "Urgency scoring; pattern matching against historical visit durations" },
      { id: "pain_scale", label: "Pain Scale (0 = none, 10 = worst imaginable)", type: "scale", required: true, min: 0, max: 10, aiPurpose: "Quantified severity for AI severity scoring and trend tracking" },
      { id: "symptom_location", label: "Primary Symptom Location", type: "dropdown", required: true, options: ["Head / Neck","Chest","Abdomen","Back","Upper Limbs","Lower Limbs","Whole Body","Skin","Other"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Anatomical context for differential diagnosis retrieval" },
      { id: "associated_symptoms", label: "Associated Symptoms", type: "multiselect", required: false, options: ["Fever","Nausea / Vomiting","Fatigue","Shortness of breath","Dizziness","Chest pain","Headache","Cough","Diarrhoea","Joint pain","Rash","Weight loss","Sweating"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Symptom cluster matching for syndrome identification" },
      { id: "aggravating_factors", label: "Aggravating Factors", type: "multiselect", required: false, options: ["Movement","Eating","Stress","Cold","Heat","Lying down","Standing","Exercise","Fatigue"].map(v => ({ value: v.toLowerCase(), label: v })), aiPurpose: "Contextual modifiers fed into RAG symptom correlation" },
      { id: "relieving_factors", label: "Relieving Factors", type: "multiselect", required: false, options: ["Rest","Medication","Heat pack","Ice","Eating","Drinking water","Positional change"].map(v => ({ value: v.toLowerCase().replace(/\s/g,"_"), label: v })), aiPurpose: "Self-care patterns; medication effectiveness inference" },
      { id: "previous_episodes", label: "Previous Episodes of Same Symptom?", type: "boolean", required: false, options: yn, aiPurpose: "Recurrence flag links AI to prior visit notes and outcomes" },
      { id: "self_treatment", label: "Self-Treatment Attempted", type: "textarea", required: false, placeholder: "e.g. Paracetamol 500mg twice daily for 2 days", aiPurpose: "Medication interaction check; OTC drug surfacing in clinical display" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. Medical History
  // ─────────────────────────────────────────────────────────────────
  {
    id: "medical_history",
    title: "Medical History",
    icon: "📋",
    color: "purple",
    description: "Permanent context loaded into every AI session. Informs differential diagnosis, risk scoring, and drug safety checks.",
    fields: [
      { id: "chronic_conditions", label: "Chronic / Long-term Conditions", type: "multiselect", required: true, options: ["Diabetes Type 1","Diabetes Type 2","Hypertension","Asthma","COPD","Coronary Artery Disease","Chronic Kidney Disease","Epilepsy","Thyroid Disorder","Arthritis","Depression","Anxiety","None"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Persistent context loaded into every AI session for this patient" },
      { id: "past_surgeries", label: "Past Surgeries / Procedures", type: "textarea", required: false, placeholder: "Name, date, hospital — e.g. Appendectomy, 2019, Royal Brisbane Hospital", aiPurpose: "Surgical history context; post-op complication risk" },
      { id: "past_hospitalizations", label: "Past Hospitalizations", type: "textarea", required: false, placeholder: "Reason, date, duration, hospital", aiPurpose: "Severity history; readmission risk scoring" },
      { id: "serious_infections", label: "History of Serious Infections", type: "multiselect", required: false, options: ["Tuberculosis (TB)","HIV","Hepatitis B","Hepatitis C","Malaria","COVID-19 (severe)","Sepsis","Meningitis","None"].map(v => ({ value: v.toLowerCase().replace(/[\s()]/g,"_"), label: v })), aiPurpose: "Immunocompromised status; drug interaction and precaution flags" },
      { id: "cancer_history", label: "History of Cancer?", type: "boolean", required: false, options: yn, aiPurpose: "Oncology history context; recurrence monitoring triggers" },
      { id: "cancer_details", label: "Cancer Type, Stage & Year", type: "text", required: false, placeholder: "e.g. Breast cancer, Stage II, 2021", conditional: { fieldId: "cancer_history", value: "yes" }, aiPurpose: "Oncology context for AI clinical display" },
      { id: "mental_health_history", label: "Mental Health History", type: "multiselect", required: false, options: ["Depression","Anxiety","Bipolar Disorder","PTSD","Schizophrenia","OCD","Eating Disorder","ADHD","None"].map(v => ({ value: v.toLowerCase().replace(/[\s]/g,"_"), label: v })), aiPurpose: "Mental health context for holistic AI summary; medication interaction flags" },
      { id: "pregnancy_status", label: "Current Pregnancy Status", type: "dropdown", required: false, options: [{ value: "not_applicable", label: "Not Applicable" }, { value: "not_pregnant", label: "Not Pregnant" }, { value: "pregnant", label: "Currently Pregnant" }, { value: "possibly_pregnant", label: "Possibly Pregnant" }], aiPurpose: "Contraindicated medication suppression; obstetric triage rules" },
      { id: "gestational_age", label: "Gestational Age (weeks)", type: "number", required: false, min: 1, max: 42, unit: "weeks", placeholder: "e.g. 24", conditional: { fieldId: "pregnancy_status", value: "pregnant" }, aiPurpose: "Trimester-specific drug safety; fetal development context" },
      { id: "disability_status", label: "Disability Status", type: "multiselect", required: false, options: ["Physical disability","Cognitive disability","Sensory impairment","None"].map(v => ({ value: v.toLowerCase().replace(/\s/g,"_"), label: v })), aiPurpose: "Accessibility flags in UI; care plan adaptation" },
      { id: "vaccinations", label: "Vaccination Record", type: "multiselect", required: false, options: ["COVID-19","Influenza (Flu)","Hepatitis B","MMR","Tetanus","HPV","Pneumococcal","Meningococcal"].map(v => ({ value: v.toLowerCase().replace(/[\s()]/g,"_"), label: v })), aiPurpose: "Preventive care gap analysis; infection risk assessment" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. Medications & Allergies
  // ─────────────────────────────────────────────────────────────────
  {
    id: "medications",
    title: "Medications & Allergies",
    icon: "💊",
    color: "orange",
    description: "Powers the drug interaction engine and contraindication suppression in AI recommendations.",
    fields: [
      { id: "current_medications", label: "Current Prescription Medications", type: "textarea", required: true, placeholder: "Drug name, dosage, frequency, prescribing doctor — e.g. Metformin 500mg twice daily (Dr. Jones)", aiPurpose: "Drug interaction checking; contraindication alerts in AI clinical display" },
      { id: "otc_medications", label: "Current OTC / Self-Prescribed Medications", type: "textarea", required: false, placeholder: "e.g. Paracetamol 500mg as needed, Vitamin D 1000IU daily", aiPurpose: "Complete polypharmacy picture for interaction engine" },
      { id: "supplements", label: "Supplements / Herbal / Traditional Remedies", type: "textarea", required: false, placeholder: "e.g. St. John's Wort, Fish Oil, Turmeric", aiPurpose: "Herb-drug interactions surfaced in AI alerts" },
      { id: "medication_adherence", label: "Medication Adherence", type: "dropdown", required: false, options: ["Always","Usually","Sometimes","Rarely","Never"].map(v => ({ value: v.toLowerCase(), label: v })), aiPurpose: "Compliance risk factor; AI follow-up prompt trigger" },
      { id: "drug_allergies", label: "Drug Allergies", type: "textarea", required: true, placeholder: "Drug name, reaction type, severity — e.g. Penicillin → anaphylaxis (severe)", aiPurpose: "Hard block in any AI drug recommendation; displayed prominently on doctor UI" },
      { id: "food_allergies", label: "Food Allergies", type: "textarea", required: false, placeholder: "e.g. Peanuts → anaphylaxis, Shellfish → hives", aiPurpose: "Nutritional advice context; anaphylaxis risk flagging" },
      { id: "environmental_allergies", label: "Environmental Allergies", type: "textarea", required: false, placeholder: "e.g. Dust mites → rhinitis, Pollen → hay fever", aiPurpose: "Allergy load context; anti-histamine interaction awareness" },
      { id: "allergy_reaction_type", label: "Worst Allergy Reaction Type", type: "dropdown", required: false, options: ["Rash / Urticaria","Anaphylaxis","GI Distress","Facial Swelling","Respiratory","Unknown"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Severity-based alerting logic in AI clinical display" },
      { id: "previous_anaphylaxis", label: "Previous Anaphylaxis Episode?", type: "boolean", required: false, options: yn, aiPurpose: "High-priority flag; epi-pen prescription reminder" },
      { id: "latex_allergy", label: "Contrast Dye / Latex Allergy?", type: "boolean", required: false, options: yn, aiPurpose: "Pre-procedure safety flags for imaging and surgical workflows" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 6. Lifestyle & Habits
  // ─────────────────────────────────────────────────────────────────
  {
    id: "lifestyle",
    title: "Lifestyle & Habits",
    icon: "🏃",
    color: "green",
    description: "Feeds risk stratification, preventive care recommendations, and chronic disease management AI.",
    fields: [
      { id: "smoking_status", label: "Smoking Status", type: "dropdown", required: true, options: [{ value: "never", label: "Never Smoked" }, { value: "former", label: "Former Smoker" }, { value: "current", label: "Current Smoker" }], aiPurpose: "Cardiovascular, pulmonary, and oncological risk stratification" },
      { id: "cigarettes_per_day", label: "Cigarettes Per Day", type: "number", required: false, min: 1, max: 100, unit: "cigs/day", conditional: { fieldId: "smoking_status", value: "current" }, aiPurpose: "Pack-year calculation; COPD and lung cancer risk modeling" },
      { id: "alcohol_consumption", label: "Alcohol Consumption", type: "dropdown", required: true, options: [{ value: "none", label: "None" }, { value: "occasional", label: "Occasional (social)" }, { value: "moderate", label: "Moderate (1–2 drinks/day)" }, { value: "heavy", label: "Heavy (3+ drinks/day)" }, { value: "former", label: "Former Drinker" }], aiPurpose: "Liver function context; drug metabolism (CYP450); withdrawal risk" },
      { id: "exercise_frequency", label: "Exercise Frequency", type: "dropdown", required: true, options: [{ value: "none", label: "None" }, { value: "1_2x_week", label: "1–2x per week" }, { value: "3_4x_week", label: "3–4x per week" }, { value: "5_plus_week", label: "5+ times per week" }, { value: "daily", label: "Daily" }], aiPurpose: "Cardiovascular fitness baseline; rehab and recovery AI planning" },
      { id: "exercise_type", label: "Exercise Type", type: "multiselect", required: false, options: ["Walking","Running","Gym / Weights","Swimming","Cycling","Yoga / Pilates","Team Sports","Martial Arts"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Injury context; orthopedic and cardio risk refinement" },
      { id: "diet_type", label: "Diet Type", type: "dropdown", required: true, options: ["Omnivore","Vegetarian","Vegan","Ketogenic","Gluten-Free","Diabetic Diet","Halal","Kosher","Other"].map(v => ({ value: v.toLowerCase().replace(/[\s-]/g,"_"), label: v })), aiPurpose: "Nutritional deficiency risk; dietary-drug interactions" },
      { id: "water_intake", label: "Average Daily Water Intake", type: "dropdown", required: false, options: [{ value: "lt1", label: "Less than 1 litre" }, { value: "1_2l", label: "1–2 litres" }, { value: "2_3l", label: "2–3 litres" }, { value: "gt3", label: "More than 3 litres" }], aiPurpose: "Dehydration and kidney stone risk; medication absorption context" },
      { id: "sleep_hours", label: "Average Sleep Hours Per Night", type: "number", required: true, min: 1, max: 24, unit: "hours", placeholder: "e.g. 7", aiPurpose: "Sleep disorder screening; chronic disease and mental health correlation" },
      { id: "stress_level", label: "Stress Level (self-assessed)", type: "scale", required: true, min: 1, max: 10, aiPurpose: "Mental health triage; cortisol-related condition risk" },
      { id: "occupation", label: "Occupation / Job Title", type: "text", required: true, placeholder: "e.g. Software Engineer, Teacher, Nurse", aiPurpose: "Occupational hazard exposure (chemicals, dust, radiation, sedentary risk)" },
      { id: "work_environment", label: "Work Environment", type: "dropdown", required: false, options: ["Office","Outdoor","Industrial / Manufacturing","Healthcare","Remote / Work from home","Student","Unemployed","Retired"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), aiPurpose: "Environmental disease risk; ergonomic injury context" },
      { id: "caffeine_consumption", label: "Caffeine Consumption", type: "dropdown", required: false, options: [{ value: "none", label: "None" }, { value: "low", label: "Low (1 cup/day)" }, { value: "moderate", label: "Moderate (2–3 cups/day)" }, { value: "high", label: "High (4+ cups/day)" }], aiPurpose: "Anxiety, arrhythmia, and sleep quality context" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 7. Family Medical History
  // ─────────────────────────────────────────────────────────────────
  {
    id: "family_history",
    title: "Family Medical History",
    icon: "👨‍👩‍👧",
    color: "yellow",
    description: "Genetic risk overlay fed into the AI screening recommendation engine and differential diagnosis.",
    fields: [
      { id: "family_diabetes", label: "Diabetes in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Genetic risk score for diabetes; preventive screening trigger" },
      { id: "family_diabetes_relative", label: "Diabetes — Affected Relatives", type: "multiselect", required: false, options: ["Father","Mother","Sibling","Grandparent","Aunt / Uncle"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), conditional: { fieldId: "family_diabetes", value: "yes" }, aiPurpose: "Hereditary risk weighting" },
      { id: "family_hypertension", label: "Hypertension in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Cardiovascular risk stratification; hypertension onset prediction" },
      { id: "family_heart_disease", label: "Heart Disease / CAD / Heart Attack in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Framingham risk enhancement; early cardiac screening recommendations" },
      { id: "family_heart_relative", label: "Heart Disease — Affected Relatives", type: "multiselect", required: false, options: ["Father","Mother","Sibling","Grandparent","Aunt / Uncle"].map(v => ({ value: v.toLowerCase().replace(/[\s/]/g,"_"), label: v })), conditional: { fieldId: "family_heart_disease", value: "yes" }, aiPurpose: "Cardiovascular hereditary risk weighting" },
      { id: "family_cancer", label: "Cancer in Family?", type: "boolean", required: false, options: yn, aiPurpose: "BRCA/HNPCC/Lynch screening recommendations; oncology risk flag" },
      { id: "family_cancer_type", label: "Cancer — Type & Relative", type: "text", required: false, placeholder: "e.g. Breast cancer — Mother; Colorectal — Grandfather", conditional: { fieldId: "family_cancer", value: "yes" }, aiPurpose: "Specific cancer risk overlay" },
      { id: "family_mental_health", label: "Mental Health Disorders in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Hereditary mental health risk context" },
      { id: "family_mental_type", label: "Mental Health — Condition & Relative", type: "text", required: false, placeholder: "e.g. Depression — Mother; Bipolar — Uncle", conditional: { fieldId: "family_mental_health", value: "yes" }, aiPurpose: "Mental health hereditary risk" },
      { id: "family_stroke", label: "Stroke / TIA in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Cerebrovascular risk layer in AI differential" },
      { id: "family_kidney_disease", label: "Chronic Kidney Disease in Family?", type: "boolean", required: false, options: yn, aiPurpose: "Renal risk stratification; creatinine trend alerting" },
      { id: "family_genetic_diseases", label: "Known Genetic / Rare Diseases in Family", type: "textarea", required: false, placeholder: "e.g. Sickle cell anaemia — Sibling; Huntington's — Father", aiPurpose: "Rare disease differential flag; genetic counselling recommendation" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 8. Previous Medical Records & EHR
  // ─────────────────────────────────────────────────────────────────
  {
    id: "records",
    title: "Previous Records & EHR",
    icon: "📁",
    color: "indigo",
    description: "Uploaded documents are OCR-extracted and fed into the RAG pipeline for AI history summarization.",
    fields: [
      { id: "existing_ehr_id", label: "Existing EHR / Patient ID (other hospitals)", type: "text", required: false, placeholder: "e.g. QLD-HEALTH-84521", aiPurpose: "Cross-system record linkage for unified patient profile" },
      { id: "previous_hospital", label: "Previous Hospital / Clinic Name", type: "text", required: false, placeholder: "e.g. Royal Brisbane and Women's Hospital", aiPurpose: "Provenance metadata for imported records" },
      { id: "previous_doctor", label: "Previous Treating Doctor Name", type: "text", required: false, placeholder: "e.g. Dr. Sarah Chen", aiPurpose: "Care continuity; AI links prior clinical decisions to current context" },
      { id: "last_visit_date", label: "Last Visit Date (Previous Provider)", type: "date", required: false, aiPurpose: "Care gap detection; chronic disease management continuity" },
      { id: "previous_diagnoses", label: "Previous Diagnoses (Documented)", type: "textarea", required: false, placeholder: "List confirmed diagnoses from previous providers…", aiPurpose: "Confirmed diagnosis list for AI differential weighting" },
      { id: "lab_results_upload", label: "Previous Lab Results", type: "file", required: false, aiPurpose: "OCR-extracted lab values fed into RAG and trend analysis" },
      { id: "imaging_upload", label: "Previous Imaging Reports", type: "file", required: false, aiPurpose: "Radiology history context; AI flags change from prior imaging" },
      { id: "prescriptions_upload", label: "Previous Prescriptions", type: "file", required: false, aiPurpose: "Medication history extraction; adherence inference" },
      { id: "discharge_upload", label: "Discharge Summaries", type: "file", required: false, aiPurpose: "Rich clinical narrative for AI history summarization" },
      { id: "vaccination_upload", label: "Vaccination Records", type: "file", required: false, aiPurpose: "Immunization verification; gap analysis" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 9. Insurance & Hospital Info
  // ─────────────────────────────────────────────────────────────────
  {
    id: "insurance",
    title: "Insurance & Hospital Info",
    icon: "🏥",
    color: "cyan",
    description: "Enables formulary-constrained AI recommendations and preferred facility routing.",
    fields: [
      { id: "insurance_provider", label: "Insurance Provider Name", type: "text", required: false, placeholder: "e.g. Medibank Private, Bupa", aiPurpose: "Formulary-constrained drug recommendations in AI suggestions" },
      { id: "insurance_policy_number", label: "Insurance Policy Number", type: "text", required: false, placeholder: "e.g. MBK-0012345", aiPurpose: "Billing and authorization workflow integration" },
      { id: "insurance_plan_type", label: "Insurance Plan Type", type: "dropdown", required: true, options: [{ value: "public", label: "Public (Medicare / NHS)" }, { value: "private", label: "Private Health Insurance" }, { value: "employer", label: "Employer-Sponsored" }, { value: "none", label: "No Insurance" }, { value: "self_pay", label: "Self-Pay" }], aiPurpose: "Cost-aware treatment recommendations; drug substitution suggestions" },
      { id: "insurance_expiry", label: "Insurance Coverage Expiry Date", type: "date", required: false, aiPurpose: "Coverage lapse alert; triggers proactive renewal notification" },
      { id: "pcp_name", label: "Primary Care Physician (PCP) Name", type: "text", required: false, placeholder: "e.g. Dr. James O'Brien", aiPurpose: "Care team context in AI clinical display; referral routing" },
      { id: "referring_doctor", label: "Referring Doctor Name", type: "text", required: false, placeholder: "Optional — if referred", aiPurpose: "Referral context; AI surfaces referring doctor's clinical notes" },
      { id: "preferred_hospital", label: "Preferred Hospital / Clinic", type: "text", required: false, placeholder: "e.g. St Vincent's Hospital Sydney", aiPurpose: "Facility-specific formulary and protocol adherence in AI recommendations" },
      { id: "preferred_language", label: "Preferred Language", type: "dropdown", required: true, options: ["English","Arabic","Bengali","Chinese (Mandarin)","Chinese (Cantonese)","French","Hindi","Indonesian","Japanese","Korean","Malay","Portuguese","Spanish","Tamil","Turkish","Vietnamese","Other"].map(v => ({ value: v.toLowerCase().replace(/[\s()]/g,"_"), label: v })), aiPurpose: "AI response and UI language localization; translation for clinical display" },
      { id: "interpreter_required", label: "Interpreter Required?", type: "boolean", required: false, options: yn, aiPurpose: "Clinical workflow flag; real-time transcription language setting" },
      { id: "preferred_doctor", label: "Preferred Doctor / Specialist", type: "text", required: false, placeholder: "Optional", aiPurpose: "Appointment routing; continuity of care preference" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // 10. AI & Data Consent
  // ─────────────────────────────────────────────────────────────────
  {
    id: "consent",
    title: "AI & Data Consent",
    icon: "🔒",
    color: "slate",
    description: "Legally required before any AI processing begins. The AI agent is only activated after all required consents are granted.",
    fields: [
      { id: "consent_ai_diagnosis", label: "I consent to AI-Assisted Diagnosis Support", type: "boolean", required: true, options: yn, aiPurpose: "Master gate: AI agent is only activated if consent is granted" },
      { id: "consent_speech_recording", label: "I consent to Real-Time Speech Recording during consultations", type: "boolean", required: true, options: yn, aiPurpose: "Enables / disables microphone input and speech-to-text pipeline" },
      { id: "consent_transcription", label: "I consent to Real-Time Conversation Transcription", type: "boolean", required: true, options: yn, aiPurpose: "Enables / disables AI conversation analysis and ambient documentation" },
      { id: "consent_share_doctors", label: "I consent to share my data with treating doctors", type: "boolean", required: true, options: yn, aiPurpose: "Controls which clinicians the AI can surface patient data to" },
      { id: "consent_share_specialists", label: "I consent to share my data with specialist referrals", type: "boolean", required: true, options: yn, aiPurpose: "Enables data forwarding when patient is referred to a specialist" },
      { id: "consent_research", label: "I consent to anonymized use of my data for research / AI training", type: "boolean", required: true, options: yn, aiPurpose: "Governs whether patient data (de-identified) contributes to AI model improvement" },
      { id: "consent_labs", label: "I consent to share data with third-party diagnostic labs", type: "boolean", required: true, options: yn, aiPurpose: "Controls lab result data exchange with external systems" },
      { id: "consent_personal_app", label: "I consent to use the Personal Health Assistant App", type: "boolean", required: true, options: yn, aiPurpose: "Enables patient-facing AI assistant app access to their own records" },
      { id: "data_retention", label: "Data Retention Preference", type: "dropdown", required: true, options: [{ value: "1_year", label: "1 Year" }, { value: "5_years", label: "5 Years" }, { value: "10_years", label: "10 Years" }, { value: "indefinite", label: "Indefinite" }, { value: "delete_after_discharge", label: "Delete After Discharge" }], aiPurpose: "Drives automated data lifecycle management in the Global Health Data Center" },
      { id: "emergency_override_consent", label: "I grant Emergency Override — allow full record access in life-threatening emergencies", type: "boolean", required: true, options: yn, aiPurpose: "Allows AI to surface full record in a life-threatening emergency" },
      { id: "digital_signature", label: "Digital Signature", type: "signature", required: true, aiPurpose: "Binding consent record stored in the Global Health Data Center" },
    ],
  },
];

export type RegAnswers = Record<string, string | string[] | boolean | number | File[] | null>;
