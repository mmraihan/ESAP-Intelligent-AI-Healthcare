# ESAP Intelligent AI Healthcare — Patient Registration Survey

**Purpose:** Collect a comprehensive health profile at first registration to power the AI agent pipeline:
RAG-based clinical reasoning · symptom correlation · history summarization · doctor interface display · real-time speech analysis · Global Health Data Center storage

**Survey Sections:** 10 | **Total Fields:** ~120

---

## 1. Personal & Demographics

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Full Legal Name | text | Required | Patient identity anchor across all records and AI queries |
| Preferred Name / Nickname | text | Optional | Personalization in the patient-facing app and doctor UI |
| Date of Birth | date | Required | Age calculation; age-specific risk models and drug dosage thresholds |
| Age (auto-calculated) | number | Auto | Rapid filtering in clinical decision rules (pediatric / adult / geriatric) |
| Biological Sex | dropdown (Male / Female / Intersex) | Required | Sex-specific disease risk, medication metabolism, lab reference ranges |
| Gender Identity | dropdown + free text | Optional | Inclusive care; relevant for hormone-related history and mental health context |
| Nationality | dropdown | Required | Population-level epidemiological risk baselines in the AI model |
| Ethnicity / Race | multi-select | Optional | Genetic disease predisposition (e.g., sickle cell, Tay-Sachs, BRCA prevalence) |
| Blood Group | dropdown (A+/A−/B+/B−/AB+/AB−/O+/O−) | Required | Emergency transfusion decisions; surfaced immediately in critical alerts |
| Height (cm) | number | Required | BMI calculation; drug dosage weight-based rules |
| Weight (kg) | number | Required | BMI calculation; obesity-related risk stratification |
| BMI (auto-calculated) | number | Auto | Metabolic syndrome screening, surgical risk scoring |
| Marital Status | dropdown | Optional | Psychosocial context for mental health and chronic disease compliance |
| Number of Dependents / Children | number | Optional | Family stress load; postpartum risk screening for female patients |
| Highest Education Level | dropdown | Optional | Health literacy estimation; simplifies AI-generated patient explanations |
| Religion | text | Optional | Dietary restrictions (e.g., halal, kosher); blood transfusion consent flags |
| Profile Photo | file-upload | Optional | Visual identity confirmation in the doctor UI |

---

## 2. Contact & Emergency Info

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Primary Phone Number | text | Required | Appointment reminders; AI-driven follow-up alerts and medication reminders |
| Secondary Phone Number | text | Optional | Fallback for critical AI-triggered health alerts |
| Email Address | text | Required | Secure delivery of AI-generated health summaries and lab results |
| Home Address — Street | text | Required | Geographic disease cluster detection; nearest facility routing |
| Home Address — City | text | Required | Regional disease prevalence overlay in risk models |
| Home Address — Country | text | Required | Country-specific clinical guidelines and formulary references |
| Postal / ZIP Code | text | Required | Granular epidemiological data; environmental exposure risk (air quality, water) |
| Emergency Contact — Full Name | text | Required | Critical alert routing when patient is unresponsive |
| Emergency Contact — Relationship | dropdown (Spouse / Parent / Sibling / Child / Friend / Guardian / Other) | Required | Context for medical decision-making authority |
| Emergency Contact — Phone | text | Required | Immediate escalation by the AI alert system |
| Emergency Contact — Email | text | Optional | Secondary alert channel |
| Legal Guardian (if minor or incapacitated) | text | Conditional | Consent verification; AI flags if patient is under 18 or has declared incapacity |
| Preferred Contact Method | dropdown (Phone / SMS / Email / WhatsApp) | Required | AI notification routing preference |
| Preferred Contact Time | dropdown (Morning / Afternoon / Evening / Any) | Optional | Smart scheduling for AI-driven reminders |

---

## 3. Current Symptoms & Chief Complaint

*Collected at registration if the patient is presenting with a complaint; repeated and updated at every visit.*

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Chief Complaint (primary reason for visit) | text | Required | Entry point for AI symptom-matching and differential generation |
| Symptom Description (free text) | text | Required | NLP extraction of symptom entities for RAG retrieval |
| Symptom Onset Date | date | Required | Acuity calculation; acute vs. chronic classification |
| Onset Type | dropdown (Sudden / Gradual / Intermittent) | Required | Triage prioritization; sudden onset triggers critical-alert rules |
| Symptom Duration | text (e.g., "3 days", "2 weeks") | Required | Urgency scoring; pattern matching against historical visit durations |
| Pain Scale | scale (0–10) | Required | Quantified severity for AI severity scoring and trend tracking across visits |
| Primary Symptom Location (body) | dropdown + body-map selector | Required | Anatomical context for differential diagnosis retrieval |
| Symptom Radiation / Spread | text | Optional | Referred pain patterns (e.g., cardiac, renal colic) flagged in AI alerts |
| Aggravating Factors | multi-select + free text | Optional | Contextual modifiers fed into RAG symptom correlation |
| Relieving Factors | multi-select + free text | Optional | Self-care patterns; medication effectiveness inference |
| Associated Symptoms | multi-select (curated list + free text) | Optional | Symptom cluster matching for syndrome identification |
| Symptom Frequency (if intermittent) | dropdown (Daily / Weekly / Monthly / Irregular) | Optional | Chronic pattern detection; episode frequency trending |
| Previous Episodes of Same Symptom | boolean | Optional | Recurrence flag links AI to prior visit notes and outcomes |
| Self-Treatment Attempted | text | Optional | Medication interaction check; OTC drug surfacing in clinical display |
| Patient's Own Assessment / Concern | text | Optional | Patient perspective preserved in AI summary for the doctor |

---

## 4. Medical History

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Chronic / Long-term Conditions | multi-select + free text (Diabetes / Hypertension / Asthma / COPD / CAD / CKD / Epilepsy / Thyroid / Other) | Required | Persistent context loaded into every AI session for this patient |
| Date of Chronic Condition Diagnosis | date (per condition) | Optional | Disease duration; complication risk timeline modeling |
| Past Surgeries / Procedures | text (name + date + hospital) | Optional | Surgical history context; post-op complication risk in AI assessment |
| Past Hospitalizations | text (reason + date + duration + hospital) | Optional | Severity history; readmission risk scoring |
| History of Serious Infections | multi-select (TB / HIV / Hepatitis / Malaria / COVID-19 / Other) | Optional | Immunocompromised status; drug interaction and precaution flags |
| History of Cancer | boolean + text (type + stage + year) | Optional | Oncology history context; recurrence monitoring triggers |
| Autoimmune Conditions | multi-select + free text | Optional | Immunosuppressant interactions; symptom overlap disambiguation |
| Neurological History | multi-select (Stroke / TIA / Migraine / Seizures / Parkinson's / Other) | Optional | Neurological risk layer in differential diagnosis |
| Cardiovascular History | multi-select (MI / Heart Failure / Arrhythmia / DVT / PE / Other) | Optional | Cardiac risk scoring (Framingham, GRACE) augmentation |
| Mental Health History | multi-select (Depression / Anxiety / Bipolar / PTSD / Schizophrenia / OCD / Other) | Optional | Mental health context for holistic AI summary; medication interaction flags |
| Reproductive / Obstetric History (if applicable) | text (pregnancies / deliveries / miscarriages / complications) | Optional | Pregnancy-related risk; hormone-sensitive condition context |
| Current Pregnancy Status | dropdown (Not Applicable / Not Pregnant / Pregnant / Possibly Pregnant) | Conditional | Contraindicated medication suppression; obstetric triage rules |
| Gestational Age (if pregnant) | number (weeks) | Conditional | Trimester-specific drug safety; fetal development context |
| Disability Status | multi-select (Physical / Cognitive / Sensory / None) | Optional | Accessibility flags in UI; care plan adaptation |
| Immunization / Vaccination Record | multi-select + date (COVID-19 / Flu / Hepatitis B / MMR / etc.) | Optional | Preventive care gap analysis; infection risk assessment |
| Genetic / Hereditary Conditions Diagnosed | text | Optional | Genetic risk overlay on family history correlations |
| Previous Adverse Drug Reactions (non-allergy) | text (drug + reaction) | Optional | Distinct from allergies; pharmacovigilance context |

---

## 5. Medications & Allergies

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Current Prescription Medications | text (drug name + dosage + frequency + prescribing doctor) | Required | Drug interaction checking; contraindication alerts in AI clinical display |
| Current OTC / Self-Prescribed Medications | text (drug name + dosage) | Optional | Complete polypharmacy picture for interaction engine |
| Current Supplements / Herbal / Traditional Remedies | text | Optional | Herb-drug interactions (e.g., St. John's Wort); surfaced in AI alerts |
| Medication Adherence | dropdown (Always / Usually / Sometimes / Rarely / Never) | Optional | Compliance risk factor; AI follow-up prompt trigger |
| Drug Allergies | text (drug name + reaction type + severity) | Required | Hard block in any AI drug recommendation; displayed prominently on doctor UI |
| Food Allergies | text (food + reaction type) | Optional | Nutritional advice context; anaphylaxis risk flagging |
| Environmental Allergies | text (trigger + reaction) | Optional | Allergy load context; anti-histamine interaction awareness |
| Allergy Reaction Type | dropdown (Rash / Anaphylaxis / GI Distress / Swelling / Respiratory / Unknown) | Required (if allergy present) | Severity-based alerting logic in AI clinical display |
| Allergy Confirmed By | dropdown (Self-reported / Allergy Test / Doctor Confirmed) | Required (if allergy present) | Confidence weighting in AI allergy alerts |
| Previous Anaphylaxis Episode | boolean | Optional | High-priority flag; epi-pen prescription reminder |
| Contrast Dye / Latex Allergy | boolean + type | Optional | Pre-procedure safety flags for imaging and surgical workflows |

---

## 6. Lifestyle & Habits

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Smoking Status | dropdown (Never / Former / Current) | Required | Cardiovascular, pulmonary, and oncological risk stratification |
| Cigarettes Per Day (if current) | number | Conditional | Pack-year calculation; COPD and lung cancer risk modeling |
| Years Smoked | number | Conditional | Cumulative exposure for cancer screening recommendations |
| Alcohol Consumption | dropdown (None / Occasional / Moderate / Heavy / Former) | Required | Liver function context; drug metabolism (CYP450); withdrawal risk |
| Alcohol Units Per Week (if applicable) | number | Optional | AUDIT score estimation; addiction flag |
| Recreational Drug Use | dropdown (None / Past / Current — type free text) | Optional | Drug interaction and withdrawal risk context |
| Exercise Frequency | dropdown (None / 1–2x/week / 3–4x/week / 5+/week / Daily) | Required | Cardiovascular fitness baseline; rehab and recovery AI planning |
| Exercise Type | multi-select (Walking / Running / Gym / Swimming / Yoga / Sports / Other) | Optional | Injury context; orthopedic and cardio risk refinement |
| Diet Type | dropdown (Omnivore / Vegetarian / Vegan / Keto / Gluten-Free / Diabetic / Other) | Required | Nutritional deficiency risk; dietary-drug interactions |
| Average Daily Water Intake | dropdown (< 1L / 1–2L / 2–3L / > 3L) | Optional | Dehydration and kidney stone risk; medication absorption context |
| Average Sleep Hours Per Night | number | Required | Sleep disorder screening; chronic disease and mental health correlation |
| Sleep Quality | scale (1–10) | Optional | Fatigue and burnout risk; mental health signal for AI |
| Stress Level (self-assessed) | scale (1–10) | Required | Mental health triage; cortisol-related condition risk |
| Occupation / Job Title | text | Required | Occupational hazard exposure (chemicals, dust, radiation, sedentary risk) |
| Work Environment | dropdown (Office / Outdoor / Industrial / Healthcare / Remote / Student / Unemployed / Retired) | Optional | Environmental disease risk; ergonomic injury context |
| Average Screen Time Per Day | number (hours) | Optional | Digital eye strain, sedentary lifestyle, and sleep hygiene context |
| Caffeine Consumption | dropdown (None / Low / Moderate / High) | Optional | Anxiety, arrhythmia, and sleep quality context |

---

## 7. Family Medical History

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Diabetes (Type 1 or 2) | boolean + dropdown (Father / Mother / Sibling / Grandparent / Aunt/Uncle / Multiple) | Optional | Genetic risk score for diabetes; preventive screening trigger |
| Hypertension | boolean + relative dropdown | Optional | Cardiovascular risk stratification; hypertension onset prediction |
| Heart Disease / CAD / MI | boolean + relative dropdown + age of onset | Optional | Framingham risk enhancement; early cardiac screening recommendations |
| Stroke / TIA | boolean + relative dropdown | Optional | Cerebrovascular risk layer in AI differential |
| Cancer (type + relative) | boolean + text (type) + relative dropdown | Optional | BRCA/HNPCC/Lynch screening recommendations; oncology risk flag |
| Mental Health Disorders | boolean + text (type) + relative dropdown | Optional | Hereditary mental health risk context for AI mental health assessment |
| Autoimmune Diseases | boolean + text (type) + relative dropdown | Optional | Autoimmune predisposition; triggers expanded autoimmune testing suggestions |
| Chronic Kidney Disease | boolean + relative dropdown | Optional | Renal risk stratification; creatinine trend alerting |
| Thyroid Disorders | boolean + relative dropdown | Optional | Thyroid screening recommendation trigger |
| Obesity | boolean + relative dropdown | Optional | Metabolic syndrome risk; weight management program flag |
| Genetic / Rare Diseases | text (name + relative) | Optional | Rare disease differential flag; genetic counseling recommendation |
| Known Family Genetic Testing Done | boolean + text (results summary) | Optional | Pre-existing genetic data integration into AI risk model |
| Age of Death of Relatives (if applicable) | text (relative + age + cause) | Optional | Longevity and disease trajectory modeling |

---

## 8. Previous Medical Records & EHR

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Existing EHR / Patient ID (other hospitals) | text | Optional | Cross-system record linkage for unified patient profile |
| Previous Hospital / Clinic Name | text | Optional | Provenance metadata for imported records |
| Previous Treating Doctor Name | text | Optional | Care continuity; AI links prior clinical decisions to current context |
| Last Visit Date (previous provider) | date | Optional | Care gap detection; chronic disease management continuity |
| Reason for Previous Visit | text | Optional | Historical chief complaint timeline for pattern detection |
| Previous Diagnoses (documented) | text | Optional | Confirmed diagnosis list for AI differential weighting |
| Previous Lab Results (upload) | file-upload (PDF / image) | Optional | OCR-extracted lab values fed into RAG and trend analysis |
| Previous Imaging Reports (upload) | file-upload (PDF / DICOM) | Optional | Radiology history context; AI flags change from prior imaging |
| Previous Prescriptions (upload) | file-upload (PDF / image) | Optional | Medication history extraction; adherence inference |
| Previous Discharge Summaries (upload) | file-upload (PDF) | Optional | Rich clinical narrative for AI history summarization |
| Vaccination Records (upload) | file-upload (PDF / image) | Optional | Immunization verification; gap analysis |
| Specialist Referral Letters (upload) | file-upload (PDF) | Optional | Multi-specialty context integration |
| Wearable / Remote Monitoring Data (upload or link) | file-upload / API link | Optional | Continuous biosignal data (HR, SpO2, glucose) for AI trend analysis |

---

## 9. Insurance & Hospital Info

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Insurance Provider Name | text | Optional | Formulary-constrained drug recommendations in AI suggestions |
| Insurance Policy Number | text | Optional | Billing and authorization workflow integration |
| Insurance Plan Type | dropdown (Public / Private / Employer / None / Self-Pay) | Required | Cost-aware treatment recommendations; drug substitution suggestions |
| Insurance Coverage Expiry Date | date | Optional | Coverage lapse alert; triggers proactive renewal notification |
| Primary Care Physician (PCP) Name | text | Optional | Care team context in AI clinical display; referral routing |
| Referring Doctor Name | text | Optional | Referral context; AI surfaces referring doctor's clinical notes |
| Preferred Hospital / Clinic | text | Optional | Facility-specific formulary and protocol adherence in AI recommendations |
| Patient Hospital ID (this facility) | text | Auto-generated | Primary key for all records in this system's data center |
| Preferred Language | dropdown | Required | AI response and UI language localization; translation for clinical display |
| Secondary Language | dropdown | Optional | Fallback for multilingual patient communication |
| Interpreter Required | boolean | Optional | Clinical workflow flag; real-time transcription language setting |
| Preferred Doctor / Specialist | text | Optional | Appointment routing; continuity of care preference |

---

## 10. AI & Data Consent

*Legally required before any AI processing begins. All fields Required.*

| Field Name | Data Type | Required/Optional | AI Purpose |
|---|---|---|---|
| Consent to AI-Assisted Diagnosis Support | boolean (Yes / No) | Required | Master gate: AI agent is only activated if consent is granted |
| Consent to Real-Time Speech Recording | boolean (Yes / No) | Required | Enables / disables microphone input and speech-to-text pipeline during consultations |
| Consent to Real-Time Conversation Transcription | boolean (Yes / No) | Required | Enables / disables AI conversation analysis and ambient documentation feature |
| Consent to Share Data with Treating Doctors | boolean (Yes / No) | Required | Controls which clinicians the AI can surface patient data to |
| Consent to Share Data with Specialist Referrals | boolean (Yes / No) | Required | Enables data forwarding when patient is referred to a specialist |
| Consent to Anonymized Research / Model Training | boolean (Yes / No) | Required | Governs whether patient data (de-identified) contributes to global AI model improvement |
| Consent to Share with Third-Party Diagnostic Labs | boolean (Yes / No) | Required | Controls lab result data exchange with external systems |
| Consent to Use Personal Health Assistant App | boolean (Yes / No) | Required | Enables patient-facing AI assistant app access to their own records |
| Data Retention Preference | dropdown (1 year / 5 years / 10 years / Indefinite / Delete after discharge) | Required | Drives automated data lifecycle management in the Global Health Data Center |
| Right to Be Forgotten Request Mechanism | boolean (acknowledged) | Required | GDPR/HIPAA compliance; patient acknowledges the right and how to exercise it |
| Emergency Override Consent | boolean (Yes / No) | Required | Allows AI to surface full record in a life-threatening emergency even without active doctor consent grant |
| Consent Form Version | text (auto) | Auto | Tracks which version of the consent form was signed for legal audit |
| Consent Date & Timestamp | date + time (auto) | Auto | Legal timestamp of consent; required for regulatory compliance |
| Digital Signature | file-upload / e-signature | Required | Binding consent record stored in the data center |
| Guardian Signature (if applicable) | file-upload / e-signature | Conditional | Required if patient is a minor or legally incapacitated |

---

## Registration vs. Follow-up Visit

### Collected ONCE at Registration — Stable Fields
These fields form the permanent patient profile in the Global Health Data Center. They are presented to the doctor at every visit as the patient's baseline context.

| Section | Fields Collected Once |
|---|---|
| Personal & Demographics | Full name, DOB, biological sex, blood group, height, nationality, ethnicity, education, religion |
| Contact & Emergency | All contact and emergency contact fields |
| Medical History | Chronic conditions, surgeries, hospitalizations, cancer history, genetic conditions, mental health history, vaccination record |
| Medications & Allergies | Drug allergies, food allergies, allergy reaction type — these are stable unless updated |
| Family Medical History | All family history fields |
| Previous Medical Records | All uploaded documents and prior EHR links |
| Insurance & Hospital | Insurance provider, policy number, patient hospital ID, preferred language, preferred doctor |
| AI & Data Consent | All consent fields (re-confirmed only if consent policy version changes) |

---

### Updated at EVERY Visit — Dynamic Fields
These fields are re-collected or refreshed at each encounter and are versioned with a visit timestamp. They are the primary inputs to the AI agent's real-time processing pipeline.

| Section | Fields Updated Per Visit |
|---|---|
| Personal & Demographics | Weight (BMI recalculated), pregnancy status, gestational age |
| Current Symptoms & Chief Complaint | All fields — chief complaint, pain scale, symptom onset, duration, location, associated symptoms, self-treatment |
| Medications & Allergies | Current medications (dosage / frequency may change), OTC medications, supplements, adherence status |
| Lifestyle & Habits | Smoking status, alcohol, stress level, sleep hours — can change between visits |
| AI & Data Consent | Speech recording consent (re-confirmed per session for real-time transcription) |

---

### Flagged for Periodic Review (Not Every Visit)
These fields should be reviewed if more than a defined interval has passed (e.g., 6–12 months).

| Field | Review Trigger |
|---|---|
| Height / Weight / BMI | Every visit if under 18; every 6 months for adults |
| Chronic condition status | Every 6 months or when a new related symptom appears |
| Medication list | Every visit if any new prescription exists; otherwise every 6 months |
| Family history | Annually or when a close relative receives a new major diagnosis |
| Insurance details | On expiry date or annually |
| Wearable / remote monitoring data | Continuous sync if API-linked; manual upload encouraged each visit |

---

## AI Pipeline Mapping

```
FIELD CATEGORY                  → AI PIPELINE TARGET
──────────────────────────────────────────────────────────────────
Demographics + Blood Group      → Emergency alert engine, drug dosing rules
Chronic Conditions + History    → RAG context window (permanent patient profile)
Current Symptoms                → Symptom correlation agent, triage scoring
Medications + Allergies         → Drug interaction engine, contraindication suppression
Lifestyle + Habits              → Risk stratification model, preventive care engine
Family History                  → Genetic risk overlay, screening recommendation engine
Previous Records (uploads)      → OCR extraction → RAG ingestion → history summarizer
Speech Consent                  → Real-time ASR pipeline (Whisper / Deepgram)
                                  → Conversation analysis agent
                                  → Ambient clinical note generation
All structured fields           → Global Health Data Center (versioned, timestamped)
Doctor corrections (per visit)  → Feedback loop → model fine-tuning / RLHF pipeline
```




ConnectionString Route: Healthcare-MIMIC-IV


 "data source=176.9.16.194,1433; initial catalog=Healthcare-MIMIC-IV; User Id=sa; Password=Esap.12.Three; MultipleActiveResultSets=True; Application Name=EntityFramework; TrustServerCertificate=True; Encrypt=False"