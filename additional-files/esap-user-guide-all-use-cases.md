# ESAP Intelligent AI Healthcare — User Guide (All Use Cases)

**Platform:** ESAP Healthcare AI  
**Frontend:** `http://localhost:3000`  
**Backend API / Swagger:** `http://localhost:8000/docs`  
**Last updated:** July 2026

---

## Who Uses This System

| Role | Who | What they do |
|---|---|---|
| **Admin / Staff** | Clinic intake staff, administrators | Register patients, manage visits, create appointments and alerts |
| **Doctor** | Clinicians, specialists | Review AI analysis, submit clinical decisions, close visits |
| **Patient** | End patients | View personal health dashboard, medications, alerts, appointments |

---

## System Credentials

| Role | Email | Password |
|---|---|---|
| Admin / Staff | `admin@esap.health` | `Admin@Esap2026` |
| Doctor | `doctor@esap.health` | `Doctor@Esap2026` |

---

## All Pages at a Glance

| URL | Page | Role |
|---|---|---|
| `http://localhost:3000` | Home — entry hub | All |
| `http://localhost:3000/login` | Staff login | Admin / Doctor |
| `http://localhost:3000/register` | Patient registration wizard | Staff (no login required) |
| `http://localhost:3000/survey` | Healthcare survey → AI pipeline | Doctor / Staff |
| `http://localhost:3000/patient` | Personal health app | Patient (demo) |

---

## Full System Pipeline

```
Phase 1         Phase 2         Phase 3              Phase 4           Phase 5
[Survey] ──► [AI Analysis] ──► [Clinical Dashboard] ──► [Doctor Review] ──► [RLHF Feedback]

Phase 6                          Phase 7
[Patient Registration] ────────► [Patient Health App]
```

---

## Use Case 1 — Staff: Login to the System

**Role:** Admin or Doctor  
**Start:** `http://localhost:3000/login`

### Steps

1. Open `http://localhost:3000` — the home hub loads
2. The navbar shows **Sign In** — click it, or go directly to `/login`
3. Enter credentials:
   - **Admin:** `admin@esap.health` / `Admin@Esap2026`
   - **Doctor:** `doctor@esap.health` / `Doctor@Esap2026`
4. Click **Sign In**
5. On success: you are redirected to the previous page (or home)
6. The navbar now shows: **role badge** (Admin / Doctor) + **full name** + **Logout** button

### What changes after login

- Survey flow becomes accessible (patient select dropdown appears)
- Auth token is stored in localStorage (`esap_access_token`)
- Token auto-refreshes every 60 minutes using refresh token
- Logout revokes the token and redirects back to `/login`

---

## Use Case 2 — Staff: Register a New Patient (Phase 6)

**Role:** No login required  
**Start:** `http://localhost:3000/register` or click **Full Patient Registration** on home

### Goal
Create a complete patient profile in the database. The patient gets a unique **ESAP-XXXXXXXX** ID.

### Workflow

```
Home → /register → Fill 10 Sections → Review → Submit → Patient Created (ESAP ID shown)
```

### Section-by-Section Guide

| # | Section | Required Fields | Example Data |
|---|---|---|---|
| 1 | **Identity** | Full name, DOB, biological sex | `Mohammed Ali`, `1985-03-20`, Male |
| 2 | **Contact** | Phone, address, emergency contact | `+8801611223344`, Dhaka, wife |
| 3 | **Medical History** | Chronic conditions, past surgeries, vaccinations | Asthma, Hernia repair 2018, COVID-19 |
| 4 | **Allergies** | Substance, type, severity | Penicillin — drug — severe |
| 5 | **Medications** | Drug name, dosage, frequency | Salbutamol 100mcg, as needed |
| 6 | **Family History** | Condition, affected relatives | Asthma — Father, Brother |
| 7 | **Lifestyle** | Smoking, exercise, sleep, stress | Never, 3x/week, 7hrs, level 4 |
| 8 | **Consent** | AI toggles, data sharing | AI diagnosis ON, share with doctors ON |
| 9 | **Insurance** | Provider, policy number, plan | Pragati, PRA-2024-11223, individual |
| 10 | **Intake Detail** | Current meds text, previous hospital | Salbutamol PRN, DMCH |

### Navigation Tips

- Use the **left section nav** to jump between sections directly
- Sections do not need to be filled in order
- Required fields are marked with `*`
- Add multiple entries in allergies, medications, family history with the **+ Add** button

### Completion

After clicking **Submit Registration**:
- **Review screen** shows all entered data — verify before submitting
- On success: **Registration Complete** screen shows:
  - `patient_id` (UUID — save this for API use)
  - `external_id` (ESAP-XXXXXXXX — this is the human-readable ID)
- Patient is now searchable in the survey patient dropdown

---

## Use Case 3 — Doctor/Staff: Run the Full Survey Pipeline (Phases 1–5)

**Role:** Doctor or Staff (must be logged in)  
**Start:** `http://localhost:3000/survey` or click **Healthcare Survey** on home

### Goal
Complete the full ESAP AI pipeline: survey answers → AI analysis → clinical dashboard → doctor decision → RLHF feedback → record closed.

### Workflow

```
Login → Select Patient → 8 Survey Questions → AI Processing → Clinical Dashboard
→ Doctor Review → RLHF Feedback → Record Updated → Done
```

---

### Step 1 — Login

If not logged in, you are automatically redirected to `/login`.

Use **Doctor** credentials for full access to the decision form:
- Email: `doctor@esap.health`
- Password: `Doctor@Esap2026`

---

### Step 2 — Select a Patient

A dropdown appears with all registered patients.

**Pre-loaded dummy patients:**

| Patient | ESAP ID | Best for testing |
|---|---|---|
| Sarah Ahmed | ESAP-C19622B6 | Moderate risk — diabetes, hypertension, headache |
| Rafiq Hossain | ESAP-16508835 | High/critical risk — COPD, cardiac history, chest pain |

Select a patient and click **Continue**.

---

### Step 3 — Answer the 8 Survey Questions

Navigate with **Next →** / **← Back**. Required questions (`*`) block progression if unanswered.

**Low-risk answer set (use for Sarah — headache follow-up):**

| Question | Answer |
|---|---|
| Current pain / discomfort | 2 / 10 |
| Primary symptom | Mild headache |
| Symptom duration | 1–2 days |
| Previous episodes | Yes, but resolved |
| Medications taken | Paracetamol — helped |
| Aggravating factors | Stress |
| Concern level | Low |
| Additional notes | Improving |

**High-risk answer set (use for Rafiq — cardiac concern):**

| Question | Answer |
|---|---|
| Current pain / discomfort | 9 / 10 |
| Primary symptom | Chest tightness, shortness of breath |
| Symptom duration | 3+ days |
| Previous episodes | Yes, multiple |
| Medications taken | None — not helping |
| Aggravating factors | Physical activity |
| Concern level | Very worried |
| Additional notes | Pressure in chest |

On the last question, **Submit →** sends the survey to the API (creates a visit record).

---

### Step 4 — AI Processing Screen (Phase 2)

A **"Processing…"** animation plays while the AI analysis runs.

> Current implementation: `lib/analyze.ts` runs rule-based scoring in the browser.  
> Phase 2 real LLM pipeline is not yet wired — this is the placeholder animation.

---

### Step 5 — Clinical Dashboard (Phase 3)

The dashboard displays the AI analysis result.

| Component | What to look at |
|---|---|
| **Risk Badge** | Low / Moderate / High — colour coded |
| **Risk Flags** | Critical (red), Warning (amber), Info (blue) |
| **Recommendations** | Urgent / Soon / Routine care items |
| **AI Tab** | Full AI reasoning and confidence breakdown |
| **Doctor Tab** | Click this to open the decision form |

---

### Step 6 — Doctor Decision Form (Phase 4)

Click the **Doctor** tab on the dashboard.

Fill in all fields:

| Field | Example |
|---|---|
| **Primary Diagnosis** | `Hypertensive headache` |
| **Secondary Diagnosis** | `Poorly controlled Type 2 Diabetes` |
| **ICD Code** | `I10, E11.9` |
| **Clinical Notes** | `BP 160/100 on exam. Headache most likely hypertensive in origin. No neuro deficits.` |
| **Treatment Items** | `Increase Amlodipine dose`, `Salt restriction`, `Daily BP log` |
| **Prescriptions** | Drug: `Amlodipine` · Dosage: `10mg` · Frequency: `once daily` |
| **Follow-up** | `Review in 1 week with BP log and glucose readings` |
| **Flag Reviews** | For each AI flag: Accept / Modify / Dismiss |

Click **Submit Decision**.

> This calls `POST /api/decisions`. The visit status changes from `open` → `closed`.

---

### Step 7 — RLHF Feedback Loop (Phase 5)

A **"Feedback Processing…"** animation simulates the RLHF training pipeline:
- The doctor's flag decisions (accept/modify/dismiss) are stored as `AIFeedback` rows
- These will train the next version of the AI model

---

### Step 8 — Record Updated

**Record Updated** confirmation screen shows:
- The submitted diagnosis and prescription
- The AI flags that were reviewed
- Visit is now closed

Click **Start New Survey** to begin another patient's pipeline.

---

## Use Case 4 — Patient: Personal Health App (Phase 7)

**Role:** Patient (demo mode — no login required)  
**Start:** `http://localhost:3000/patient` or click **Personal Health App** on home

### Goal
View a patient-facing health dashboard with AI-generated health insights.

### Tabs

| Tab | What it shows |
|---|---|
| **Overview** | Health metrics: BP, BMI, sleep, stress, exercise, hydration |
| **AI Chat** | Conversational AI health assistant — type questions, get answers |
| **Medications** | Current medications, dosage, frequency, adherence status |
| **Alerts** | Active health alerts with severity, detail, and tips |
| **Appointments** | Upcoming and past appointments with status |

### Health Metrics (Demo Patient)

| Metric | Value | Status |
|---|---|---|
| Blood Pressure | 128/82 mmHg | Warning (slightly elevated) |
| BMI | 25.2 kg/m² | Borderline overweight |
| Sleep | 6.5 hrs/night | Warning (below 7-9 target) |
| Stress Level | 7/10 | Warning (high) |
| Exercise | 2x/week | Warning (below WHO 5x target) |
| Hydration | 1.5 L/day | OK |

### AI Chat (Demo)

Type health questions and receive contextual answers. Examples:
- `"Why is my blood pressure high?"`
- `"What should I do about my stress level?"`
- `"When is my next appointment?"`
- `"Am I taking my medications correctly?"`

### Active Alerts (Demo)

| Alert | Severity |
|---|---|
| Blood Pressure Slightly Elevated | Warning |
| High Stress Level Detected | Warning |
| Annual Flu Vaccine Due | Info |
| Sleep Below Recommended | Info |
| Exercise Frequency Below Target | Info |

> **Note:** Phase 7 is demo/static — data is hardcoded. Live API integration for per-patient data is planned for the next release.

---

## Use Case 5 — Admin: Manage Appointments via API

**Role:** Admin or Staff  
**Tool:** Swagger UI at `http://localhost:8000/docs`

### Create an Appointment

```
POST /api/appointments
```
```json
{
  "patient_id": "9b1fd4ce-7e55-48e4-8caf-60ce7e777da8",
  "doctor_id": "2e0b2aa3-b2e2-4a96-8faf-bf5aff1ccde4",
  "appointment_date": "2026-07-15T10:00:00",
  "appointment_type": "follow-up",
  "notes": "Review BP and discuss RLHF-updated treatment plan",
  "linked_visit_id": "b5916bcd-bad7-48f4-b401-039e4ea90bfd"
}
```

### Update Appointment Status

```
PUT /api/appointments/{appointment_id}
```
```json
{
  "status": "completed",
  "notes": "Patient attended. BP was 145/95."
}
```

**Valid status values:** `scheduled` · `completed` · `cancelled` · `no_show`

### List Appointments for a Patient

```
GET /api/patients/{patient_id}/appointments
```

---

## Use Case 6 — Admin: Manage Health Alerts via API

**Role:** Admin or Staff  
**Tool:** Swagger UI at `http://localhost:8000/docs`

### Create an Alert

```
POST /api/patients/{patient_id}/alerts
```
```json
{
  "alert_type": "cardiovascular",
  "severity": "critical",
  "title": "Suspected Acute Cardiac Event",
  "detail": "Patient reports chest tightness, shortness of breath, and pain radiating to left arm.",
  "tip": "Immediate cardiology referral. Do not delay.",
  "source": "doctor"
}
```

**Alert types:** `cardiovascular` · `medication` · `allergy` · `diabetes` · `fall_risk` · `mental_health`  
**Severity:** `low` · `medium` · `high` · `critical`  
**Source:** `doctor` · `system` · `rule_engine`

### Dismiss an Alert

```
POST /api/alerts/{alert_id}/dismiss
```

### List Active Alerts

```
GET /api/patients/{patient_id}/alerts
```

---

## Use Case 7 — Doctor: View AI Analysis and Patient History via API

**Role:** Doctor or Staff  
**Tool:** Swagger UI at `http://localhost:8000/docs`

### Get AI Result for a Visit

```
GET /api/visits/{visit_id}/ai-result
```

Returns the stored `AIAnalysisResult` row for that visit — risk score, flags, recommendations.

### Get Full Patient Profile

```
GET /api/patients/{patient_id}/full
```

Returns everything in one response: contact, medical history, allergies, medications, family history, lifestyle, consent, insurance, intake detail.

### List All Visits for a Patient

```
GET /api/patients/{patient_id}/visits
```

### Get a Specific Decision

```
GET /api/decisions/visit/{visit_id}
```

---

## Existing Dummy Patients (Pre-loaded in DB)

### Patient 1 — Sarah Ahmed

| Field | Value |
|---|---|
| `patient_id` | `9b1fd4ce-7e55-48e4-8caf-60ce7e777da8` |
| `external_id` | `ESAP-C19622B6` |
| DOB / Sex / Blood | 1990-05-15 · Female · B+ |
| Conditions | Type 2 Diabetes, Hypertension |
| Allergies | Penicillin (moderate), Shellfish (mild) |
| Medications | Metformin 500mg BD, Amlodipine 5mg OD |
| Open Visit ID | `b5916bcd-bad7-48f4-b401-039e4ea90bfd` |
| Visit | Persistent headache & dizziness — pain 7/10 |

### Patient 2 — Rafiq Hossain

| Field | Value |
|---|---|
| `patient_id` | `4b6ced12-44a1-4688-a842-daece83a7303` |
| `external_id` | `ESAP-16508835` |
| DOB / Sex / Blood | 1975-11-22 · Male · O+ |
| Conditions | COPD, Ischemic Heart Disease (post-MI 2019) |
| Allergies | Aspirin (high — GI bleeding) |
| Medications | Clopidogrel 75mg, Atorvastatin 40mg, Bisoprolol 5mg |
| Open Visit ID | `26682d5e-1010-455e-869f-7433728cabbb` |
| Visit | Chest tightness + shortness of breath |
| Alert | **CRITICAL** — Suspected Acute Cardiac Event |

---

## Full End-to-End Scenario (New Patient, Full Pipeline)

This scenario walks through the entire system from registration to closed visit.

### Actors
- **Intake Staff** registers the patient
- **Doctor** runs the survey and submits a decision

---

### Act 1 — Staff Registers the Patient

1. Go to `http://localhost:3000/register`
2. Fill all 10 sections (see Use Case 2 above)
3. Submit → note the new `ESAP-XXXXXXXX` ID
4. Patient is now available in the survey dropdown

---

### Act 2 — Staff or Doctor Logs In

1. Go to `http://localhost:3000/login`
2. Log in as `doctor@esap.health` / `Doctor@Esap2026`
3. Navbar shows **Doctor** badge and name

---

### Act 3 — Doctor Runs the Survey

1. Go to `http://localhost:3000/survey`
2. Select the newly registered patient
3. Answer all 8 questions with clinical detail
4. Submit → visit is created, AI processing begins

---

### Act 4 — Doctor Reviews the Clinical Dashboard

1. AI Processing screen plays
2. Clinical Dashboard loads with risk analysis
3. Doctor reviews: risk badge, flags, recommendations
4. Doctor switches to **Doctor** tab

---

### Act 5 — Doctor Submits the Decision

1. Fill in: diagnosis, ICD code, clinical notes, prescriptions, treatment items, follow-up
2. Review each AI flag: Accept / Modify / Dismiss
3. Click **Submit Decision**
4. RLHF feedback loop animation plays
5. **Record Updated** screen confirms: visit is now `closed`

---

### Act 6 — Admin Creates a Follow-up Appointment (optional)

1. Open Swagger: `http://localhost:8000/docs`
2. Authenticate with admin token
3. `POST /api/appointments` with patient_id, doctor_id, date, type: `follow-up`

---

### Act 7 — Admin Creates an Alert (optional)

1. In Swagger: `POST /api/patients/{patient_id}/alerts`
2. Set severity, alert type, title, detail, tip
3. Alert appears in the patient's record

---

## Role Permission Summary

| Action | Admin | Doctor | Staff | No Login |
|---|---|---|---|---|
| Login | Yes | Yes | Yes | — |
| Register patient | Yes | — | Yes | Yes |
| List patients | Yes | — | Yes | — |
| Submit survey | Yes | Yes | Yes | — |
| View clinical dashboard | Yes | Yes | Yes | — |
| Submit doctor decision | — | Yes | — | — |
| Create appointment | Yes | — | Yes | — |
| Create alert | Yes | — | Yes | — |
| View patient alerts | Yes | Yes | Yes | — |
| Dismiss alert | Yes | Yes | Yes | — |
| View patient full profile | Yes | Yes | Yes | — |
| View personal health app | — | — | — | Yes (demo) |

---

## Common Issues

| Problem | Likely cause | Fix |
|---|---|---|
| Login fails | Wrong password | Use `Admin@Esap2026` or `Doctor@Esap2026` |
| Empty patient dropdown in survey | No patients in DB | Register a patient via `/register` first |
| Survey submit fails (401) | Token expired or not logged in | Log out and log back in |
| Survey submit fails (network error) | API not running | Start backend: `python -m uvicorn main:app --port 8000 --reload` |
| No patients showing after registration | DB connection issue | Check `http://localhost:8000/health` |
| Decision form not appearing | Viewing as admin (not doctor) | Log in as `doctor@esap.health` — decision requires Doctor role |
| `source: ai_analysis` alert rejected | Blocked by API | Use `doctor`, `system`, or `rule_engine` as source |
| Port 3000 in use | Another process | Next.js auto-uses 3001 — check terminal for URL |
| White screen / JS error | Frontend crash | Open browser DevTools (F12) → Console tab |
