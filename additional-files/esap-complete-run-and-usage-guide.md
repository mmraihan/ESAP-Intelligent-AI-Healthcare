# ESAP Healthcare Platform — Complete Run & Usage Guide

**Backend:** Python 3.12 · FastAPI · PostgreSQL · JWT Auth  
**Frontend:** Next.js 16 (Turbopack) · React 19 · Tailwind CSS  
**Backend URL:** `http://localhost:8000`  
**Frontend URL:** `http://localhost:3000`  
**API Docs (Swagger):** `http://localhost:8000/docs`  
**Date:** July 2026

---

## Table of Contents

### Part 1 — Setup & Running
1. [Prerequisites](#1-prerequisites)
2. [Start the Backend (API)](#2-start-the-backend-api)
3. [Start the Frontend](#3-start-the-frontend)
4. [Both Servers at a Glance](#4-both-servers-at-a-glance)

### Part 2 — Credentials & Dummy Data
5. [System Credentials](#5-system-credentials)
6. [Existing Dummy Patients in DB](#6-existing-dummy-patients-in-db)

### Part 3 — Frontend Testing Walkthrough
7. [Frontend Pages Overview](#7-frontend-pages-overview)
8. [Path A — Healthcare Survey Flow](#8-path-a--healthcare-survey-flow)
9. [Path B — Full Patient Registration](#9-path-b--full-patient-registration)
10. [Path C — Personal Health App](#10-path-c--personal-health-app)
11. [What Each Page Tests](#11-what-each-page-tests)
12. [Known Frontend Limitations](#12-known-frontend-limitations)

### Part 4 — API Testing Walkthrough (Swagger / Postman)
13. [System Workflow — First to Last](#13-system-workflow--first-to-last)
14. [API Step 1 — Login & Get Token](#14-api-step-1--login--get-token)
15. [API Step 2 — Register a Patient](#15-api-step-2--register-a-patient)
16. [API Step 3 — Submit a Visit / Survey](#16-api-step-3--submit-a-visit--survey)
17. [API Step 4 — Create an Appointment](#17-api-step-4--create-an-appointment)
18. [API Step 5 — Create a Health Alert](#18-api-step-5--create-a-health-alert)
19. [API Step 6 — Doctor Submits a Decision](#19-api-step-6--doctor-submits-a-decision)
20. [API Step 7 — View Full Patient Profile](#20-api-step-7--view-full-patient-profile)

### Part 5 — Reference
21. [All API Endpoints Reference](#21-all-api-endpoints-reference)
22. [Environment Configuration](#22-environment-configuration)
23. [Common Errors & Fixes](#23-common-errors--fixes)

---

## 1. Prerequisites

| Requirement | Version | Used For |
|---|---|---|
| Python | 3.12+ | Backend API |
| pip | latest | Python packages |
| Node.js | 18+ | Frontend |
| npm | latest | Frontend packages |
| PostgreSQL DB | Running | `176.9.16.194:5434` |

---

## 2. Start the Backend (API)

> **Always start the backend before the frontend.**

### Step 1 — Open a terminal in the API folder

```powershell
cd "f:\Office-Empowering-Energy\ESAP-API\ESAP-Intelligent-AI-Healthcare\esap-api"
```

### Step 2 — Install dependencies (first time only)

```powershell
pip install -r requirements.txt
```

### Step 3 — Seed the database (first time only)

```powershell
python seed.py
```

Expected output:
```
Tables verified.
  CREATED  admin@esap.health  [admin]
  CREATED  doctor@esap.health  [doctor]
```

> If it says `SKIP`, users already exist — that is fine.

### Step 4 — Start the API server

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Successful startup:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
[OK] Database connected, tables verified
```

> `--reload` auto-restarts the server on any `.py` file change.

### API Quick Links

| URL | Purpose |
|---|---|
| `http://localhost:8000/docs` | Swagger UI — interactive API testing |
| `http://localhost:8000/redoc` | ReDoc — clean API reference |
| `http://localhost:8000/health` | DB health check |

### Stop the backend
Press `Ctrl + C` in the terminal.

---

## 3. Start the Frontend

> Open a **second terminal** — keep the backend terminal running.

### Step 1 — Navigate to the frontend folder

```powershell
cd "f:\Office-Empowering-Energy\ESAP-API\ESAP-Intelligent-AI-Healthcare\survey-demo"
```

### Step 2 — Install dependencies (first time only)

```powershell
npm install
```

### Step 3 — Start the dev server

```powershell
npm run dev
```

Expected output:
```
▲ Next.js 16.2.6 (Turbopack)
- Local:   http://localhost:3000
✓ Ready in 494ms
```

### Step 4 — Open the browser

```
http://localhost:3000
```

> If port 3000 is busy, Next.js auto-uses 3001 — check the terminal output for the exact URL.

### Stop the frontend
Press `Ctrl + C` in the terminal.

---

## 4. Both Servers at a Glance

| Server | Folder | Start Command | URL |
|---|---|---|---|
| **Backend (API)** | `esap-api/` | `python -m uvicorn main:app --port 8000 --reload` | `http://localhost:8000` |
| **Frontend** | `survey-demo/` | `npm run dev` | `http://localhost:3000` |
| **API Docs** | — | — | `http://localhost:8000/docs` |

---

## 5. System Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin / Staff** | `admin@esap.health` | `Admin@Esap2026` | Register patients, manage visits, appointments, alerts |
| **Doctor** | `doctor@esap.health` | `Doctor@Esap2026` | Submit clinical decisions, review AI flags |

> The frontend login page pre-fills `doctor@esap.health` — just enter the password.

---

## 6. Existing Dummy Patients in DB

Two patients are already registered with full profiles, visits, and an alert:

### Patient 1 — Sarah Ahmed

| Field | Value |
|---|---|
| `patient_id` | `9b1fd4ce-7e55-48e4-8caf-60ce7e777da8` |
| `external_id` | `ESAP-C19622B6` |
| DOB / Sex / Blood | 1990-05-15 · Female · B+ |
| Conditions | Type 2 Diabetes, Hypertension |
| Allergies | Penicillin (drug, moderate), Shellfish (food, mild) |
| Medications | Metformin 500mg BD, Amlodipine 5mg OD |
| Visit ID | `b5916bcd-bad7-48f4-b401-039e4ea90bfd` |
| Visit | Persistent headache & dizziness — pain 7/10 — status: `open` |

### Patient 2 — Rafiq Hossain

| Field | Value |
|---|---|
| `patient_id` | `4b6ced12-44a1-4688-a842-daece83a7303` |
| `external_id` | `ESAP-16508835` |
| DOB / Sex / Blood | 1975-11-22 · Male · O+ |
| Conditions | COPD, Ischemic Heart Disease (post-MI 2019) |
| Allergies | Aspirin (drug, high — GI bleeding) |
| Medications | Clopidogrel 75mg, Atorvastatin 40mg, Bisoprolol 5mg |
| Visit ID | `26682d5e-1010-455e-869f-7433728cabbb` |
| Visit | Chest tightness + shortness of breath — status: `open` |
| Alert | **CRITICAL** — Suspected Acute Cardiac Event |

---

## 7. Frontend Pages Overview

| URL | Page | What it does |
|---|---|---|
| `http://localhost:3000` | **Home** | Landing — entry to all 3 flows |
| `http://localhost:3000/survey` | **Healthcare Survey** | 8-question survey → AI dashboard → Doctor decision |
| `http://localhost:3000/register` | **Patient Registration** | 10-section full intake form |
| `http://localhost:3000/patient` | **Personal Health App** | Patient-facing health dashboard |
| `http://localhost:3000/login` | **Staff Login** | Doctor / Admin sign-in |

### Navigation Map

```
http://localhost:3000  (Home)
  │
  ├── /survey ──────► Login → Select Patient → 8 Questions → AI Processing
  │                   → Clinical Dashboard → Doctor Review → RLHF Feedback → Done
  │
  ├── /register ────► 10-section wizard → Review → Submit → Done
  │
  ├── /patient ─────► Patient health dashboard (AI chat, meds, alerts)
  │
  └── /login ───────► Staff sign-in → redirect to previous page
```

---

## 8. Path A — Healthcare Survey Flow

**Goal:** Full pipeline — survey → AI → clinical dashboard → doctor decision → RLHF feedback

---

### A1 — Open the Survey

Go to `http://localhost:3000` → click the **Healthcare Survey** card  
Or directly: `http://localhost:3000/survey`

---

### A2 — Login (prompted automatically)

If not logged in, you are redirected to `/login`.

| Field | Value |
|---|---|
| Email | `doctor@esap.health` |
| Password | `Doctor@Esap2026` |

Click **Sign In**.

---

### A3 — Select a Patient

Pick one of the dummy patients from the dropdown:

| Patient | ESAP ID | Best for |
|---|---|---|
| Sarah Ahmed | ESAP-C19622B6 | Testing moderate risk (headache, hypertension) |
| Rafiq Hossain | ESAP-16508835 | Testing high/critical risk (cardiac history) |

Click **Continue**.

---

### A4 — Answer the 8 Survey Questions

Navigate with **Next** / **Back**. Required questions block progression.

**For LOW risk answers:**

| Question type | Example answer |
|---|---|
| Pain / discomfort level | `1–2 / 10` |
| Symptoms | None |
| Duration | Less than 1 day |
| Previous episodes | No |
| Medications taken | No |
| Concern level | Low |

**For HIGH risk answers (use for Rafiq):**

| Question type | Example answer |
|---|---|
| Pain / discomfort level | `8–10 / 10` |
| Symptoms | Chest pain, shortness of breath |
| Duration | More than 3 days |
| Previous episodes | Yes |
| Self-treatment | Yes, not helping |
| Concern level | Very worried |

---

### A5 — AI Processing Screen

A **"Processing…"** animation plays after the last question.

> The AI engine is `lib/analyze.ts` running in the browser — rule-based scoring, not an LLM yet. The real AI pipeline (Phase 2) is not wired up.

---

### A6 — Clinical Dashboard

The AI result screen shows:

| Component | What to check |
|---|---|
| **Risk Badge** | Low / Moderate / High |
| **Risk Flags** | Critical (🚨), Warning (⚠️), Info (ℹ️) |
| **Recommendations** | Urgent / Soon / Routine action items |
| **AI Tab** | AI analysis view |
| **Doctor Tab** | Click to open the Doctor Review form |

---

### A7 — Doctor Decision (on the Dashboard)

Click the **Doctor tab**. Fill in:

| Field | Example |
|---|---|
| Primary Diagnosis | `Hypertensive headache` |
| Secondary Diagnosis | `Poorly controlled Type 2 Diabetes` |
| ICD Code | `I10, E11.9` |
| Clinical Notes | `BP 160/100. Headache most likely hypertensive in origin.` |
| Treatment items | `Increase Amlodipine dose`, `Salt restriction` |
| Prescriptions | Drug: `Amlodipine` · Dosage: `10mg` · Frequency: `once daily` |
| Follow-up | `Review in 1 week` |
| Flag Reviews | For each AI flag: **Accept / Modify / Dismiss** |

Click **Submit Decision**.

---

### A8 → A9 — RLHF Feedback → Record Updated

- **Feedback Processing** screen simulates RLHF training loop
- **Record Updated** confirms: visit closed, decision saved, feedback stored
- Click **Start New Survey** to repeat

---

## 9. Path B — Full Patient Registration

**Goal:** Register a new patient through the 10-section intake form

---

### B1 — Open Registration

`http://localhost:3000` → click **Full Patient Registration**  
Or: `http://localhost:3000/register`

> No login required — registration is open for intake staff.

---

### B2 — Complete all 10 Sections

Use the **left section nav** to jump between sections.

| # | Section | Key Fields | Example Data |
|---|---|---|---|
| 1 | **Identity** | Name, DOB, sex, blood group, height, weight | `Mohammed Ali`, `1985-03-20`, Male, A+, 175cm, 78kg |
| 2 | **Contact** | Phone, email, address, emergency contact | `+8801611223344`, Dhaka |
| 3 | **Medical History** | Chronic conditions, surgeries, vaccinations | `Asthma`, Hernia repair 2018, COVID-19 vaccine |
| 4 | **Allergies** | Drug / food / environmental, severity | Sulfa — severe — anaphylaxis |
| 5 | **Medications** | Current prescriptions & OTC | Salbutamol 100mcg inhaler, as needed |
| 6 | **Family History** | Conditions in relatives | Asthma — Father, Brother |
| 7 | **Lifestyle** | Smoking, alcohol, exercise, diet, sleep | Never, 3x/week, 7hrs sleep, stress level 4 |
| 8 | **Consent** | AI toggles, data sharing | Toggle ON: AI diagnosis, share with doctors |
| 9 | **Insurance** | Provider, policy, plan | Pragati Insurance, PRA-2024-11223, individual |
| 10 | **Intake Detail** | Current meds text, previous hospital | Salbutamol PRN, DMCH |

---

### B3 — Review & Submit

- **Review screen** shows all entered data before submission
- Click **Submit Registration**
- On success: Registration Complete screen with new **ESAP-XXXXXXXX ID** and UUID

---

## 10. Path C — Personal Health App

**Goal:** View the patient-facing health dashboard

`http://localhost:3000` → click **Personal Health App**  
Or: `http://localhost:3000/patient`

| Section | Content |
|---|---|
| Health Overview | Key health metrics summary |
| AI Chat Assistant | Conversational health assistant |
| Medication Tracker | Current medications and schedule |
| Health Alerts | Active alerts (shows Rafiq's critical cardiac alert) |
| Appointments | Upcoming appointments |

> This is a demo/static view — Phase 7 API integration is not complete yet.

---

## 11. What Each Page Tests

| Page / Action | API call verified |
|---|---|
| `/login` | `POST /api/auth/login`, token stored in localStorage |
| `/survey` — patient select | `GET /api/patients` |
| `/survey` — submit answers | `POST /api/surveys` (creates visit) |
| `/survey` — clinical dashboard | Browser-side `analyzeAnswers()` (no API call) |
| `/survey` — doctor decision | `POST /api/decisions` |
| `/register` — submit | `POST /api/patients` (full profile with all sub-records) |
| `/patient` | Static demo (no live API calls yet) |

---

## 12. Known Frontend Limitations

| Limitation | Detail |
|---|---|
| AI is rule-based, not LLM | `lib/analyze.ts` scores answers with hardcoded rules — no real LLM until Phase 2 is wired |
| Patient app is static | `/patient` is a demo UI — doesn't fetch live data per patient |
| No doctor picker | Survey uses whoever is logged in — no doctor selection screen |
| No visit history UI | No screen to browse past visits for a patient |
| No alert management UI | Alerts exist in the API but no frontend screen to create/dismiss them |
| Registration is open | `/register` doesn't require login — intentional for demo phase |

---

## 13. System Workflow — First to Last

```
[Admin / Staff logs in]
         │
         ▼
[Register Patient]  ──────────────────────────►  Patient gets ESAP-XXXXXXXX ID
         │
         ▼
[Patient submits Survey]  ─────────────────────►  Visit created (status: open)
         │
         ▼
[Create Appointment]  (optional — link to visit)
         │
         ▼
[Create Health Alert]  (optional — flag urgent issue)
         │
         ▼
[Doctor logs in]
         │
         ▼
[Doctor submits Decision]  ────────────────────►  Visit status → "closed"
         │
         ▼
[View Full Patient Profile]  ──────────────────►  Complete record
```

---

## 14. API Step 1 — Login & Get Token

Every protected endpoint requires a **Bearer token**.

### Endpoint
```
POST /api/auth/login
```

### Request
```json
{
  "email": "admin@esap.health",
  "password": "Admin@Esap2026"
}
```

### Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "GC2l0xBe2geuvnWLn-z7UwCJ...",
  "token_type": "bearer",
  "role": "admin",
  "full_name": "ESAP Administrator",
  "user_id": "2e0b2aa3-b2e2-4a96-8faf-bf5aff1ccde4"
}
```

### How to use token in Swagger UI
1. Open `http://localhost:8000/docs`
2. Click **Authorize** (lock icon, top right)
3. Enter: `Bearer <your_access_token>`
4. Click **Authorize** → **Close**

### Other auth endpoints

| Method | Endpoint | Purpose | Body |
|---|---|---|---|
| POST | `/api/auth/login` | Get tokens | `{email, password}` |
| POST | `/api/auth/refresh` | Refresh access token | `{refresh_token}` |
| POST | `/api/auth/logout` | Revoke refresh token | `{refresh_token}` |
| GET | `/api/auth/me` | Current user info | — |

---

## 15. API Step 2 — Register a Patient

> **Role:** Admin or Staff

```
POST /api/patients
```

### Minimal (required fields only)
```json
{
  "full_name": "Sarah Ahmed",
  "date_of_birth": "1990-05-15",
  "biological_sex": "female"
}
```

### Full request (all sections)
```json
{
  "full_name": "Sarah Ahmed",
  "preferred_name": "Sara",
  "date_of_birth": "1990-05-15",
  "biological_sex": "female",
  "gender_identity": "Woman",
  "blood_group": "B+",
  "height_cm": 162.0,
  "weight_kg": 58.5,
  "nationality": "Bangladeshi",
  "ethnicity": ["Bengali"],
  "marital_status": "married",
  "education_level": "bachelor",
  "religion": "Islam",

  "contact": {
    "primary_phone": "+8801712345678",
    "secondary_phone": "+8801812345678",
    "email": "sarah.ahmed@example.com",
    "address_street": "12 Dhanmondi Road 7",
    "address_city": "Dhaka",
    "address_country": "Bangladesh",
    "postal_code": "1209",
    "emergency_name": "Karim Ahmed",
    "emergency_phone": "+8801912345678",
    "emergency_relation": "Husband",
    "preferred_method": "phone",
    "preferred_time": "morning"
  },

  "medical_history": {
    "chronic_conditions": ["Type 2 Diabetes", "Hypertension"],
    "past_surgeries": [{"procedure": "Appendectomy", "year": 2015, "hospital": "DMCH"}],
    "past_hospitalizations": "1 time (2015, DMCH)",
    "serious_infections": ["Typhoid (2018)"],
    "cancer_history": false,
    "cardiovascular_history": ["Mild hypertension"],
    "mental_health_history": [],
    "pregnancy_status": "not_pregnant",
    "vaccinations": ["COVID-19", "Hepatitis B", "MMR"],
    "genetic_conditions": null
  },

  "allergies": [
    {"allergy_type": "drug", "substance": "Penicillin", "reaction_type": "rash", "severity": "moderate", "confirmed_by": "Dr. Rahman"},
    {"allergy_type": "food", "substance": "Shellfish", "reaction_type": "hives", "severity": "mild"}
  ],

  "medications": [
    {"drug_name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "prescribed_by": "Dr. Islam", "medication_type": "prescription", "start_date": "2023-01-10"},
    {"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "once daily", "prescribed_by": "Dr. Islam", "medication_type": "prescription", "start_date": "2022-06-01"}
  ],

  "family_history": [
    {"condition": "Type 2 Diabetes", "affected_relatives": ["Father", "Paternal Grandmother"], "additional_details": "Both diagnosed in their 50s"},
    {"condition": "Hypertension", "affected_relatives": ["Mother"]}
  ],

  "lifestyle": {
    "smoking_status": "never",
    "alcohol_consumption": "never",
    "exercise_frequency": "3x per week",
    "exercise_type": ["walking", "yoga"],
    "diet_type": "balanced",
    "water_intake": "2L/day",
    "sleep_hours": 7.0,
    "stress_level": 5,
    "occupation": "Teacher",
    "work_environment": "indoor",
    "caffeine_consumption": "moderate"
  },

  "consent": {
    "ai_diagnosis": true,
    "speech_recording": false,
    "transcription": true,
    "share_with_doctors": true,
    "share_with_specialists": true,
    "research_training": false,
    "lab_sharing": true,
    "personal_app": true,
    "emergency_override": true,
    "data_retention": "5 years"
  },

  "insurance": {
    "insurance_provider": "Green Delta Insurance",
    "policy_number": "GDI-2024-78901",
    "plan_type": "family",
    "coverage_expiry": "2025-12-31",
    "pcp_name": "Dr. Islam",
    "preferred_hospital": "Square Hospital",
    "preferred_language": "Bengali",
    "interpreter_required": false
  },

  "intake_detail": {
    "current_medications_text": "Metformin 500mg BD, Amlodipine 5mg OD",
    "otc_medications_text": "Paracetamol occasionally",
    "supplements_text": "Vitamin D 1000IU",
    "medication_adherence": "good",
    "drug_allergies_text": "Penicillin - rash",
    "food_allergies_text": "Shellfish - hives",
    "previous_anaphylaxis": false,
    "latex_allergy": false,
    "previous_hospital": "DMCH",
    "previous_doctor": "Dr. Islam",
    "last_visit_date": "2024-11-20",
    "previous_diagnoses": "T2DM, Hypertension"
  }
}
```

### Response — save the `patient_id`
```json
{
  "patient_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "external_id": "ESAP-A1B2C3D4",
  "full_name": "Sarah Ahmed",
  "date_of_birth": "1990-05-15",
  "biological_sex": "female",
  "created_at": "2026-07-06T10:30:00Z"
}
```

---

## 16. API Step 3 — Submit a Visit / Survey

> **Role:** Any authenticated user

```
POST /api/surveys
```

```json
{
  "patient_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "visit_type": "survey",
  "chief_complaint": "Persistent headache and dizziness",
  "symptom_description": "Throbbing headache on the right side, worse in the morning.",
  "onset_date": "2026-07-01",
  "onset_type": "gradual",
  "duration": "5 days",
  "pain_scale": 7,
  "symptom_location": "Right temporal region",
  "associated_symptoms": ["Nausea", "Blurred vision", "Fatigue"],
  "aggravating_factors": ["Bright light", "Noise"],
  "relieving_factors": ["Rest", "Dark room"],
  "previous_episodes": true,
  "self_treatment": "Paracetamol 500mg - partial relief",
  "patient_concern": "Worried about blood pressure",
  "survey_answers": {
    "pain_type": "throbbing",
    "frequency": "daily",
    "triggers": ["stress", "light"]
  }
}
```

### Response — save the `visit_id`
```json
{
  "visit_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "patient_id": "f47ac10b-...",
  "visit_type": "survey",
  "chief_complaint": "Persistent headache and dizziness",
  "status": "open",
  "created_at": "2026-07-06T10:45:00Z"
}
```

---

## 17. API Step 4 — Create an Appointment

> **Role:** Admin or Staff

```
POST /api/appointments
```

```json
{
  "patient_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "doctor_id": "2e0b2aa3-b2e2-4a96-8faf-bf5aff1ccde4",
  "appointment_date": "2026-07-10T09:00:00",
  "appointment_type": "follow-up",
  "notes": "Review BP and headache. Consider neurology referral.",
  "linked_visit_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

> `doctor_id` = `user_id` from the doctor's login response. Leave `null` if unassigned.

**Valid appointment status values:** `scheduled` · `completed` · `cancelled` · `no_show`

Update status:
```
PUT /api/appointments/{appointment_id}
Body: { "status": "completed", "notes": "BP was 145/95." }
```

---

## 18. API Step 5 — Create a Health Alert

> **Role:** Admin or Staff

```
POST /api/patients/{patient_id}/alerts
```

```json
{
  "alert_type": "cardiovascular",
  "severity": "high",
  "title": "Elevated Blood Pressure",
  "detail": "BP reading 160/100 mmHg — above normal range.",
  "tip": "Immediate BP medication review. Consider cardiology referral.",
  "source": "doctor"
}
```

| Field | Valid values |
|---|---|
| `severity` | `low` · `medium` · `high` · `critical` |
| `source` | `doctor` · `system` · `rule_engine` |
| `alert_type` | `cardiovascular` · `medication` · `allergy` · `diabetes` · `fall_risk` · `mental_health` |

Dismiss an alert:
```
POST /api/alerts/{alert_id}/dismiss
```

---

## 19. API Step 6 — Doctor Submits a Decision

> **Role:** Doctor only — log in as `doctor@esap.health`

```
POST /api/decisions
```

```json
{
  "visit_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "patient_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "primary_diagnosis": "Hypertensive headache with vascular component",
  "secondary_diagnosis": "Poorly controlled Type 2 Diabetes",
  "icd_code": "I10, E11.9",
  "clinical_notes": "BP on exam: 160/100. Headache most likely hypertensive in origin. No neuro deficits.",
  "treatment_items": [
    "Increase antihypertensive dosage",
    "Strict dietary salt restriction",
    "Blood glucose monitoring twice daily"
  ],
  "treatment_details": {
    "Increase antihypertensive dosage": "Increase Amlodipine from 5mg to 10mg OD"
  },
  "prescriptions": [
    {"drug": "Amlodipine", "dosage": "10mg", "frequency": "once daily"},
    {"drug": "Paracetamol", "dosage": "500mg", "frequency": "as needed, max 4/day"}
  ],
  "follow_up": "Review in 1 week. Bring BP log and glucose readings.",
  "flag_reviews": []
}
```

> `flag_reviews` items format: `{ "flagId": "flag-001", "decision": "accept", "note": "Agreed" }`  
> `decision` values: `accept` · `modify` · `dismiss`

After this, the visit `status` changes from `open` → `closed`.

---

## 20. API Step 7 — View Full Patient Profile

```
GET /api/patients/{patient_id}/full
```

Returns everything in one response: contact, medical history, allergies, medications, family history, lifestyle, consent, insurance, intake detail.

---

## 21. All API Endpoints Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login, get tokens |
| POST | `/api/auth/refresh` | None | Refresh access token |
| POST | `/api/auth/logout` | None | Revoke refresh token |
| GET | `/api/auth/me` | Any | Current user info |

### Patients
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/patients` | Staff | Register new patient |
| GET | `/api/patients` | Staff | List patients (`?search=&skip=0&limit=50`) |
| GET | `/api/patients/{id}` | Staff | Get patient |
| PUT | `/api/patients/{id}` | Staff | Update patient |
| DELETE | `/api/patients/{id}` | Staff | Soft-delete patient |
| GET | `/api/patients/{id}/full` | Staff | Full profile (all sub-records) |
| PUT | `/api/patients/{id}/contact` | Staff | Upsert contact |
| GET | `/api/patients/{id}/contact` | Staff | Get contact |
| PUT | `/api/patients/{id}/medical-history` | Staff | Upsert medical history |
| GET | `/api/patients/{id}/medical-history` | Staff | Get medical history |
| PUT | `/api/patients/{id}/lifestyle` | Staff | Upsert lifestyle |
| GET | `/api/patients/{id}/lifestyle` | Staff | Get lifestyle |
| PUT | `/api/patients/{id}/consent` | Staff | Upsert consent |
| GET | `/api/patients/{id}/consent` | Staff | Get consent |
| PUT | `/api/patients/{id}/insurance` | Staff | Upsert insurance |
| GET | `/api/patients/{id}/insurance` | Staff | Get insurance |
| PUT | `/api/patients/{id}/intake-detail` | Staff | Upsert intake detail |
| GET | `/api/patients/{id}/intake-detail` | Staff | Get intake detail |
| POST | `/api/patients/{id}/medications` | Staff | Add medication |
| GET | `/api/patients/{id}/medications` | Staff | List medications |
| PUT | `/api/patients/{id}/medications/{med_id}` | Staff | Deactivate medication |
| POST | `/api/patients/{id}/family-history` | Staff | Add family history entry |
| GET | `/api/patients/{id}/family-history` | Staff | List family history |

### Visits & Surveys
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/surveys` | Any | Submit survey / visit |
| GET | `/api/visits/{id}` | Staff | Get visit |
| GET | `/api/patients/{id}/visits` | Staff | List patient visits |
| GET | `/api/visits/{id}/ai-result` | Staff | Get AI analysis result |

### Decisions
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/decisions` | Doctor | Submit decision |
| GET | `/api/decisions/{id}` | Any | Get decision by ID |
| GET | `/api/decisions/visit/{visit_id}` | Any | Get decision by visit |

### Appointments
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments` | Staff | Create appointment |
| GET | `/api/patients/{id}/appointments` | Staff | List appointments |
| PUT | `/api/appointments/{id}` | Staff | Update appointment |

### Alerts
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/patients/{id}/alerts` | Staff | Create alert |
| GET | `/api/patients/{id}/alerts` | Any | List active alerts |
| POST | `/api/alerts/{id}/dismiss` | Any | Dismiss alert |

### System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | DB connection health check |

---

## 22. Environment Configuration

### Backend — `esap-api/.env`

```env
DB_HOST=176.9.16.194
DB_PORT=5434
DB_NAME=ESAP-Healthcare
DB_USER=postgres
DB_PASSWORD=pg1234

JWT_SECRET_KEY=change-this-to-a-long-random-secret-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

FRONTEND_ORIGIN=http://localhost:3000
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend — `survey-demo/` (no .env needed)

The frontend defaults to `http://localhost:8000` for API calls.  
To override, create `survey-demo/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 23. Common Errors & Fixes

### Backend Errors

| Error | Code | Cause | Fix |
|---|---|---|---|
| `Invalid email or password` | 401 | Wrong credentials | Check email/password. Run `python seed.py` first. |
| `Not authenticated` | 401 | No Bearer token | Add `Authorization: Bearer <token>` header |
| `Token expired` | 401 | 60 min access token expired | Call `/api/auth/refresh` |
| `Insufficient permissions` | 403 | Wrong role for endpoint | Doctor routes need doctor token |
| `Patient not found` | 404 | Wrong `patient_id` | Use UUID from registration response |
| `Visit not found` | 404 | Wrong `visit_id` | Use UUID from survey response |
| `Cannot reach SQL Server` | 500 | DB unreachable at startup | Check network / VPN to `176.9.16.194:5434` |
| `Address already in use` | — | Port 8000 taken | Add `--port 8001` to the uvicorn command |
| `ai_analysis alerts blocked` | 400 | Wrong `source` field | Use `doctor`, `system`, or `rule_engine` |
| `ModuleNotFoundError` | — | Missing Python package | Run `pip install -r requirements.txt` |

### Frontend Errors

| Error | Cause | Fix |
|---|---|---|
| "Login failed" | Wrong password or API is down | Use `Doctor@Esap2026`. Check `http://localhost:8000/health`. |
| Blank patient dropdown | No patients in DB | Register via `/register` or Swagger `POST /api/patients` |
| "Request failed (401)" | Token expired | Log out and log back in |
| Page loads but no data | API not running | Start API: `python -m uvicorn main:app --port 8000 --reload` |
| Port 3000 in use | Another process | Next.js auto-uses 3001 — check terminal for URL |
| White screen / crash | JS error | Open browser DevTools (F12) → Console tab |
| `npm run dev` fails | Missing node_modules | Run `npm install` in `survey-demo/` first |
