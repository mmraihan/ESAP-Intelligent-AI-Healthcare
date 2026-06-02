# ESAP Intelligent AI Healthcare — Backend Roadmap

**Project:** ESAP Intelligent AI Healthcare Platform  
**Stack target:** .NET 8 / ASP.NET Core · SQL Server · Python AI services · Next.js frontend  
**Date:** June 2026  
**Status:** Planning → Active Development

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│  Next.js Web App · Doctor Tablet UI · Patient Mobile App        │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ HTTPS / REST + WebSocket      │
┌───────────────▼──────────────────────────────▼──────────────────┐
│                    API GATEWAY (Phase 1)                        │
│           ASP.NET Core · JWT Auth · Rate Limiting               │
└───┬──────────────┬───────────────┬───────────┬──────────────────┘
    │              │               │           │
┌───▼───┐   ┌──────▼────┐  ┌──────▼───┐ ┌────▼──────────┐
│Patient│   │Survey &   │  │Doctor    │ │AI Orchestrator│
│Service│   │Registration│  │Decision  │ │Service        │
│       │   │Service    │  │Service   │ │(Python)       │
└───┬───┘   └──────┬────┘  └──────┬───┘ └────┬──────────┘
    │              │               │           │
┌───▼───────────────▼───────────────▼──────────▼──────────────────┐
│                 SQL SERVER — Healthcare-MIMIC-IV                 │
│          Patients · Visits · Records · Consent · Feedback       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
         ┌────▼────┐   ┌──────▼─────┐  ┌──────▼──────┐
         │ Redis   │   │ Vector DB  │  │  Blob Store │
         │ Cache   │   │ (Qdrant /  │  │  (Azure /   │
         │ Session │   │  Pinecone) │  │   S3) Files │
         └─────────┘   └────────────┘  └─────────────┘
```

---

## Phase 1 — Foundation & Core API
**Goal:** Working REST API, patient registration, auth, database schema  
**Timeline:** Weeks 1–4

### 1.1 Project Setup

- [ ] ASP.NET Core 8 Web API project (`ESAP.API`)
- [ ] Solution structure:
  ```
  ESAP.API/
  ├── Controllers/
  ├── Services/
  ├── Models/
  ├── DTOs/
  ├── Data/          ← EF Core DbContext
  ├── Middleware/
  └── Program.cs
  ```
- [ ] NuGet packages:
  - `Microsoft.EntityFrameworkCore.SqlServer`
  - `Microsoft.AspNetCore.Authentication.JwtBearer`
  - `AutoMapper`
  - `FluentValidation`
  - `Serilog.AspNetCore`
  - `StackExchange.Redis`

### 1.2 Database Schema (SQL Server — `Healthcare-MIMIC-IV`)

> Connection string used in project:
> `data source=176.9.16.194,1433; initial catalog=Healthcare-MIMIC-IV; User Id=sa; TrustServerCertificate=True`

```sql
-- Core tables

CREATE TABLE Patients (
    PatientId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ExternalId      VARCHAR(20) UNIQUE NOT NULL,   -- e.g. ESAP-4K8J2M9
    FullName        NVARCHAR(200) NOT NULL,
    PreferredName   NVARCHAR(100),
    DateOfBirth     DATE NOT NULL,
    BiologicalSex   VARCHAR(20) NOT NULL,
    BloodGroup      VARCHAR(5),
    HeightCm        DECIMAL(5,1),
    WeightKg        DECIMAL(5,1),
    BMI             AS (WeightKg / POWER(HeightCm / 100.0, 2)),  -- computed
    Nationality     NVARCHAR(100),
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt       DATETIME2 DEFAULT GETUTCDATE(),
    IsActive        BIT DEFAULT 1
);

CREATE TABLE PatientContacts (
    ContactId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    PrimaryPhone    VARCHAR(30),
    Email           VARCHAR(200),
    AddressStreet   NVARCHAR(300),
    AddressCity     NVARCHAR(100),
    AddressCountry  NVARCHAR(100),
    PostalCode      VARCHAR(20),
    EmergencyName   NVARCHAR(200),
    EmergencyPhone  VARCHAR(30),
    EmergencyRel    VARCHAR(50),
    PreferredMethod VARCHAR(20),
    PreferredTime   VARCHAR(20)
);

CREATE TABLE MedicalHistory (
    HistoryId           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    ChronicConditions   NVARCHAR(MAX),   -- JSON array
    PastSurgeries       NVARCHAR(MAX),
    MentalHealthHistory NVARCHAR(MAX),   -- JSON array
    PregnancyStatus     VARCHAR(30),
    DisabilityStatus    NVARCHAR(MAX),   -- JSON array
    Vaccinations        NVARCHAR(MAX),   -- JSON array
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE Medications (
    MedicationId    UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    DrugName        NVARCHAR(200) NOT NULL,
    Dosage          VARCHAR(100),
    Frequency       VARCHAR(100),
    PrescribedBy    NVARCHAR(200),
    IsActive        BIT DEFAULT 1,
    StartDate       DATE,
    EndDate         DATE
);

CREATE TABLE Allergies (
    AllergyId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    AllergyType     VARCHAR(20),         -- drug / food / environmental
    Substance       NVARCHAR(200),
    ReactionType    VARCHAR(50),
    Severity        VARCHAR(20),
    ConfirmedBy     VARCHAR(30),
    IsActive        BIT DEFAULT 1
);

CREATE TABLE Lifestyle (
    LifestyleId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    SmokingStatus       VARCHAR(20),
    AlcoholConsumption  VARCHAR(30),
    ExerciseFrequency   VARCHAR(30),
    DietType            VARCHAR(50),
    SleepHours          DECIMAL(3,1),
    StressLevel         TINYINT,
    Occupation          NVARCHAR(200),
    WorkEnvironment     VARCHAR(50),
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE FamilyHistory (
    FamilyHistoryId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    Condition       NVARCHAR(200),
    AffectedRelative VARCHAR(50),
    Notes           NVARCHAR(500),
    UpdatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE Visits (
    VisitId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    VisitDate       DATETIME2 NOT NULL,
    VisitType       VARCHAR(30),          -- registration / consultation / follow-up
    ChiefComplaint  NVARCHAR(500),
    PainScale       TINYINT,
    OnsetDate       DATE,
    OnsetType       VARCHAR(20),
    Duration        VARCHAR(100),
    SymptomLocation VARCHAR(100),
    AssociatedSymptoms NVARCHAR(MAX),     -- JSON array
    DoctorId        UNIQUEIDENTIFIER,
    Status          VARCHAR(20) DEFAULT 'open',
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE DoctorDecisions (
    DecisionId          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId             UNIQUEIDENTIFIER REFERENCES Visits(VisitId),
    DoctorId            UNIQUEIDENTIFIER,
    DoctorName          NVARCHAR(200),
    PrimaryDiagnosis    NVARCHAR(300),
    SecondaryDiagnosis  NVARCHAR(300),
    IcdCode             VARCHAR(20),
    ClinicalNotes       NVARCHAR(MAX),
    TreatmentPlan       NVARCHAR(MAX),    -- JSON
    Prescriptions       NVARCHAR(MAX),    -- JSON array
    FollowUpSchedule    VARCHAR(50),
    SubmittedAt         DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE AIAnalysisResults (
    ResultId        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId         UNIQUEIDENTIFIER REFERENCES Visits(VisitId),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    RiskScore       TINYINT,
    RiskLevel       VARCHAR(20),
    Summary         NVARCHAR(MAX),
    Flags           NVARCHAR(MAX),        -- JSON array
    Recommendations NVARCHAR(MAX),        -- JSON array
    ModelVersion    VARCHAR(20),
    GeneratedAt     DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE AIFeedback (
    FeedbackId      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResultId        UNIQUEIDENTIFIER REFERENCES AIAnalysisResults(ResultId),
    VisitId         UNIQUEIDENTIFIER REFERENCES Visits(VisitId),
    FlagReviews     NVARCHAR(MAX),        -- JSON: accept/modify/dismiss per flag
    DoctorCorrection NVARCHAR(MAX),       -- JSON diff
    UsedForTraining BIT DEFAULT 0,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE Consent (
    ConsentId           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    AIDiagnosis         BIT NOT NULL DEFAULT 0,
    SpeechRecording     BIT NOT NULL DEFAULT 0,
    Transcription       BIT NOT NULL DEFAULT 0,
    ShareWithDoctors    BIT NOT NULL DEFAULT 0,
    ShareWithSpecialists BIT NOT NULL DEFAULT 0,
    ResearchTraining    BIT NOT NULL DEFAULT 0,
    LabSharing          BIT NOT NULL DEFAULT 0,
    PersonalApp         BIT NOT NULL DEFAULT 0,
    DataRetention       VARCHAR(30),
    EmergencyOverride   BIT NOT NULL DEFAULT 0,
    SignatureData       NVARCHAR(MAX),    -- base64 canvas data
    ConsentVersion      VARCHAR(10),
    SignedAt            DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE PatientDocuments (
    DocumentId      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    DocumentType    VARCHAR(50),          -- lab_result / imaging / prescription / discharge
    FileName        NVARCHAR(300),
    BlobUrl         NVARCHAR(1000),
    OcrText         NVARCHAR(MAX),        -- extracted text for RAG
    UploadedAt      DATETIME2 DEFAULT GETUTCDATE(),
    IsProcessed     BIT DEFAULT 0
);

CREATE TABLE Appointments (
    AppointmentId   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    DoctorId        UNIQUEIDENTIFIER,
    AppointmentDate DATETIME2,
    AppointmentType VARCHAR(50),
    Status          VARCHAR(20) DEFAULT 'scheduled',
    Notes           NVARCHAR(500),
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

CREATE TABLE SpeechSessions (
    SessionId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId         UNIQUEIDENTIFIER REFERENCES Visits(VisitId),
    PatientId       UNIQUEIDENTIFIER REFERENCES Patients(PatientId),
    AudioBlobUrl    NVARCHAR(1000),
    TranscriptRaw   NVARCHAR(MAX),
    TranscriptClean NVARCHAR(MAX),
    AIAnalysis      NVARCHAR(MAX),        -- extracted clinical entities
    DurationSeconds INT,
    StartedAt       DATETIME2,
    EndedAt         DATETIME2
);
```

### 1.3 REST API Endpoints — Phase 1

#### Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create staff / doctor account |
| POST | `/api/auth/login` | Return JWT + refresh token |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Invalidate session |

#### Patients (`/api/patients`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/patients` | Create new patient (full registration) |
| GET | `/api/patients/{id}` | Get full patient profile |
| PUT | `/api/patients/{id}` | Update patient demographics |
| GET | `/api/patients/{id}/summary` | AI-friendly compact summary |
| GET | `/api/patients` | List / search patients (paginated) |
| DELETE | `/api/patients/{id}` | Soft delete (GDPR right to erasure) |

#### Registration Sections (`/api/patients/{id}/...`)
| Method | Endpoint | Description |
|---|---|---|
| POST/PUT | `/api/patients/{id}/contact` | Contact & emergency info |
| POST/PUT | `/api/patients/{id}/medical-history` | Medical history |
| POST/PUT | `/api/patients/{id}/medications` | Medications list |
| POST/PUT | `/api/patients/{id}/allergies` | Allergies |
| POST/PUT | `/api/patients/{id}/lifestyle` | Lifestyle & habits |
| POST/PUT | `/api/patients/{id}/family-history` | Family medical history |
| POST/PUT | `/api/patients/{id}/consent` | AI & data consent |
| POST | `/api/patients/{id}/documents` | Upload EHR documents |

#### Visits (`/api/visits`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/visits` | Open a new visit (check-in) |
| GET | `/api/visits/{id}` | Get visit details |
| PUT | `/api/visits/{id}` | Update symptom data |
| GET | `/api/patients/{id}/visits` | Visit history for a patient |
| POST | `/api/visits/{id}/close` | Close visit after encounter |

---

## Phase 2 — AI Processing Pipeline
**Goal:** LLM integration, RAG system, symptom analysis  
**Timeline:** Weeks 5–10

### 2.1 Python AI Service (`ESAP.AI`)

Standalone FastAPI microservice called by the .NET API.

```
ESAP.AI/
├── main.py
├── routers/
│   ├── analyze.py       ← symptom analysis
│   ├── rag.py           ← RAG queries
│   ├── summary.py       ← history summarization
│   └── speech.py        ← transcription + analysis
├── services/
│   ├── llm_client.py    ← Anthropic Claude API
│   ├── embedder.py      ← text → vector embeddings
│   ├── vector_store.py  ← Qdrant client
│   └── ocr.py           ← document OCR (Tesseract / Azure)
├── prompts/
│   ├── symptom_analysis.txt
│   ├── history_summary.txt
│   └── conversation_analysis.txt
└── requirements.txt
```

**Key packages:**
```
anthropic>=0.30
fastapi
qdrant-client
sentence-transformers
openai-whisper
pytesseract
httpx
pydantic
```

### 2.2 LLM Strategy

| Use case | Model | Approach |
|---|---|---|
| Symptom analysis | `claude-sonnet-4-6` | RAG + patient context injection |
| History summarization | `claude-sonnet-4-6` | Structured output (JSON) |
| Conversation analysis | `claude-sonnet-4-6` | Streaming, tool use |
| Patient chat (app) | `claude-haiku-4-5` | Fast, low cost |
| Risk scoring | Rules + `claude-haiku-4-5` | Hybrid: deterministic rules + LLM narrative |

**Prompt caching:** Enable `cache_control: {"type": "ephemeral"}` on the patient profile system prompt — it's large (entire history) and constant within a session. Reduces cost by ~90% on repeated queries.

### 2.3 RAG Pipeline

```
Patient Documents (PDF/image)
        │
        ▼
    OCR Extraction
        │
        ▼
   Chunk Text (512 tokens, 50 overlap)
        │
        ▼
   Embed (sentence-transformers/all-MiniLM-L6-v2)
        │
        ▼
   Store in Qdrant (collection per patient)
        │
        ◄──── Query: "current symptoms + chief complaint"
        │
        ▼
   Top-K relevant chunks retrieved
        │
        ▼
   Inject into Claude prompt as context
        │
        ▼
   Structured clinical analysis returned
```

### 2.4 AI API Endpoints

#### Analysis (`/api/ai`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/analyze/{visitId}` | Run full AI analysis on a visit |
| GET | `/api/ai/results/{visitId}` | Retrieve stored analysis result |
| POST | `/api/ai/summarize/{patientId}` | Generate patient history summary |
| POST | `/api/ai/risk-score/{patientId}` | Compute risk score from profile |
| GET | `/api/ai/flags/{visitId}` | Get clinical flags for a visit |

**Analysis request/response:**
```json
// POST /api/ai/analyze/{visitId}
// Request (auto-assembled from DB, no body needed)

// Response
{
  "visitId": "uuid",
  "riskScore": 67,
  "riskLevel": "moderate",
  "profileLabel": "Hypertensive, high-stress, sleep-deprived adult",
  "summary": "Patient presents with...",
  "flags": [
    {
      "id": "bp_elevated",
      "label": "Blood Pressure Elevated",
      "severity": "warning",
      "detail": "128/82 mmHg...",
      "evidence": ["survey_q3", "medical_history"]
    }
  ],
  "recommendations": [
    {
      "id": "rec_01",
      "title": "DASH Diet",
      "description": "Reduce sodium...",
      "priority": "soon",
      "icon": "🥗"
    }
  ],
  "modelVersion": "claude-sonnet-4-6",
  "generatedAt": "2026-06-02T10:30:00Z"
}
```

---

## Phase 3 — Clinical Dashboard & Doctor Decision API
**Goal:** Doctor-facing endpoints, feedback submission, RLHF data collection  
**Timeline:** Weeks 9–12

### 3.1 Doctor Endpoints

#### Doctor Interface (`/api/doctor`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/doctor/queue` | Active patients awaiting review (today) |
| GET | `/api/doctor/patient/{id}/brief` | Pre-visit AI brief (history + flags) |
| POST | `/api/doctor/decisions` | Submit doctor decision (diagnosis + treatment) |
| GET | `/api/doctor/decisions/{visitId}` | Retrieve a decision |
| PUT | `/api/doctor/decisions/{id}` | Amend a decision |

**Doctor decision request:**
```json
// POST /api/doctor/decisions
{
  "visitId": "uuid",
  "doctorId": "uuid",
  "doctorName": "Dr. James O'Brien",
  "flagReviews": [
    { "flagId": "bp_elevated", "decision": "accept", "note": "" },
    { "flagId": "stress_high", "decision": "modify", "note": "Patient reports situational stress only" }
  ],
  "primaryDiagnosis": "Hypertension Stage 1",
  "secondaryDiagnosis": "Anxiety NOS",
  "icdCode": "I10",
  "clinicalNotes": "Patient presented with...",
  "treatmentItems": ["lifestyle", "medication", "followup"],
  "prescriptions": [
    { "drug": "Amlodipine", "dosage": "5mg", "frequency": "Once daily" }
  ],
  "followUp": "1 Month"
}
```

### 3.2 RLHF Feedback Collection

Every submitted `DoctorDecision` is automatically:
1. Saved to `AIFeedback` table with the delta between AI output and doctor correction
2. Queued in Redis for batch processing
3. Periodically exported as JSONL training data

```json
// RLHF training record format
{
  "prompt": "[patient context + symptoms]",
  "ai_response": "[original AI analysis JSON]",
  "human_correction": {
    "accepted_flags": ["bp_elevated"],
    "dismissed_flags": ["stress_high"],
    "diagnosis_correction": "Hypertension Stage 1",
    "notes": "Doctor note..."
  },
  "quality_score": 0.85,
  "timestamp": "2026-06-02T10:30:00Z"
}
```

---

## Phase 4 — Full Patient Registration API
**Goal:** Complete all 10-section registration form backend, document upload, consent management  
**Timeline:** Weeks 11–14

### 4.1 Registration Flow

```
POST /api/patients (section 1–9 data)
        │
        ├── Validate all required fields (FluentValidation)
        ├── Save to SQL Server (transaction across all tables)
        ├── Generate ExternalId (ESAP-XXXXXXXX)
        ├── Trigger document OCR jobs (async)
        └── POST /api/patients/{id}/consent (section 10)
                │
                ├── Store consent record with timestamp
                ├── Activate AI pipeline if AIDiagnosis = true
                └── Build initial RAG index (async job)
```

### 4.2 Document Upload & OCR

```
POST /api/patients/{id}/documents
        │
        ├── Accept multipart/form-data
        ├── Virus scan (ClamAV or Azure Defender)
        ├── Upload to Azure Blob Storage / S3
        ├── Queue OCR job (background worker)
        │
        └── Background OCR Worker:
                ├── Download blob
                ├── Tesseract OCR (PDF/image) or Azure Form Recognizer
                ├── Chunk extracted text
                ├── Embed and store in Qdrant (patient's collection)
                └── Mark document as IsProcessed = 1
```

### 4.3 Drug Interaction Check

On any `POST /api/patients/{id}/medications`:
1. Pull all active medications for patient
2. Query against drug interaction database (RxNorm API or local DB)
3. Return severity-ranked interaction list
4. Store critical interactions as AI flags

---

## Phase 5 — RLHF Feedback Loop & Model Improvement
**Goal:** Feedback pipeline, model fine-tuning infrastructure, data exports  
**Timeline:** Weeks 13–16

### 5.1 Feedback Pipeline

```
Doctor submits correction
        │
        ▼
AIFeedback record saved
        │
        ▼
Redis queue: "rlhf-feedback"
        │
        ▼
Background Worker (hourly batch):
    ├── Pull feedback records from queue
    ├── Format as JSONL training pairs
    ├── Quality filter (score > 0.7)
    ├── Export to Azure Blob (training-data/YYYY-MM-DD.jsonl)
    └── Mark UsedForTraining = 1
```

### 5.2 Fine-Tuning Strategy

| Approach | Tool | When |
|---|---|---|
| **Prompt engineering** (immediate) | Claude system prompt | Now — zero infra cost |
| **RAG improvement** | Qdrant re-indexing | As data grows |
| **Fine-tuning** (future) | Anthropic fine-tune API | After 1,000+ feedback records |

---

## Phase 6 — Full Patient Registration (Extended)
**Timeline:** Weeks 15–18

Already covered in Phase 1–4 DB schema. Phase 6 adds:

- [ ] Patient portal authentication (separate JWT scope)
- [ ] Patient self-service profile updates
- [ ] Multi-language support (translation middleware)
- [ ] Bulk registration for hospital onboarding
- [ ] HL7 FHIR R4 import/export for EHR integration

### 6.1 FHIR Integration

```
External EHR (Epic / Cerner / MyHR)
        │ HL7 FHIR R4 REST
        ▼
ESAP FHIR Adapter (C# library):
    ├── Patient resource → Patients table
    ├── Condition resource → MedicalHistory
    ├── MedicationRequest → Medications
    ├── AllergyIntolerance → Allergies
    └── DocumentReference → PatientDocuments
```

---

## Phase 7 — Patient App Backend
**Timeline:** Weeks 17–20

### 7.1 Patient App API (`/api/patient-app`)

All routes require `patient` JWT scope (separate from `doctor` scope).

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/patient-app/profile` | Patient's own profile summary |
| GET | `/api/patient-app/health-metrics` | Latest vitals + trends |
| GET | `/api/patient-app/medications` | Active medications |
| PUT | `/api/patient-app/medications/{id}/adherence` | Log daily adherence |
| GET | `/api/patient-app/alerts` | Active health alerts |
| POST | `/api/patient-app/alerts/{id}/dismiss` | Dismiss an alert |
| GET | `/api/patient-app/appointments` | Upcoming appointments |
| POST | `/api/patient-app/appointments` | Request new appointment |
| POST | `/api/patient-app/chat` | AI health assistant (streaming) |
| GET | `/api/patient-app/records` | Uploaded documents list |

### 7.2 AI Chat Streaming

```
POST /api/patient-app/chat
Content-Type: application/json

{
  "message": "What should I know about my blood pressure?"
}

// Server-Sent Events response stream:
data: {"chunk": "Based on your profile, "}
data: {"chunk": "your blood pressure reading..."}
data: {"done": true, "messageId": "uuid"}
```

Implementation:
- Inject patient's condensed profile into Claude system prompt
- Enable prompt caching on the profile block
- Stream response via `IAsyncEnumerable` + SSE in ASP.NET Core

---

## Cross-Cutting Concerns

### Security & Compliance

| Requirement | Implementation |
|---|---|
| HIPAA data at rest | SQL Server Transparent Data Encryption (TDE) |
| HIPAA data in transit | TLS 1.3 mandatory, HSTS |
| GDPR right to erasure | Soft delete + scheduled purge job |
| PHI audit log | Every read/write to patient data logged to `AuditLog` table |
| JWT auth | Short-lived access tokens (15 min) + long-lived refresh tokens |
| Role-based access | `patient` · `doctor` · `nurse` · `admin` JWT claims |
| API rate limiting | `AspNetCoreRateLimit` — 100 req/min per IP |
| Input sanitization | FluentValidation + parameterized EF Core queries (no raw SQL) |
| Secret management | Azure Key Vault / environment variables — never hardcoded |

### Performance

| Concern | Solution |
|---|---|
| Patient profile lookups | Redis cache with 5-min TTL |
| AI analysis latency | Async job queue (Hangfire / Azure Service Bus) — don't block HTTP |
| Document OCR | Background worker, not in request pipeline |
| Large result sets | Cursor-based pagination (`/patients?cursor=xxx&limit=20`) |
| Vector search | Qdrant HNSW index — sub-10ms similarity search |
| DB query performance | Index on `Patients.ExternalId`, `Visits.PatientId`, `Visits.VisitDate` |

### Observability

- **Logging:** Serilog → structured JSON → Azure Log Analytics
- **Metrics:** Prometheus + Grafana (request rate, AI latency, error rate)
- **Tracing:** OpenTelemetry → distributed traces across .NET + Python services
- **Alerts:** Alert if AI latency > 5s, error rate > 1%, DB connection pool > 80%

---

## Technology Stack Summary

| Layer | Technology | Reason |
|---|---|---|
| API framework | ASP.NET Core 8 | Existing .NET stack, high performance |
| ORM | Entity Framework Core 8 | Type-safe, migrations |
| Database | SQL Server (`Healthcare-MIMIC-IV`) | Existing infrastructure |
| Cache | Redis | Session, rate limiting, job queue |
| AI / LLM | Anthropic Claude API | Best medical reasoning, prompt caching |
| AI service | Python FastAPI | Native ML ecosystem |
| Embeddings | `sentence-transformers` | Local, fast, HIPAA-safe |
| Vector DB | Qdrant (self-hosted) | Open-source, HIPAA-safe, fast |
| Document OCR | Tesseract + Azure Form Recognizer | Accuracy on medical docs |
| Speech-to-text | OpenAI Whisper (self-hosted) | HIPAA-safe, no data leaves infra |
| File storage | Azure Blob Storage / S3 | Scalable, encrypted, HIPAA BAA available |
| Background jobs | Hangfire | Simple, SQL Server backed |
| API gateway | YARP or AWS API Gateway | Rate limiting, auth, routing |
| Auth | JWT + ASP.NET Core Identity | Standard, auditable |
| Containerization | Docker + Docker Compose | Dev environment consistency |
| CI/CD | GitHub Actions | Automated build + deploy |

---

## Development Milestones

```
Week  1–4   ████████  Phase 1: DB schema, CRUD API, Auth
Week  5–8   ████████  Phase 2: Python AI service, Claude integration, RAG
Week  9–12  ████████  Phase 3: Clinical Dashboard API, Doctor Decision, RLHF capture
Week 11–14  ████████  Phase 4: Full Registration API, Document OCR, Drug checks
Week 13–16  ████████  Phase 5: RLHF pipeline, Feedback exports, Fine-tune prep
Week 15–18  ████████  Phase 6: FHIR integration, Multi-language, Bulk onboarding
Week 17–20  ████████  Phase 7: Patient App API, Chat streaming, Alerts engine
Week 19–22  ████████  QA, Security audit, Load testing, Production hardening
```

---

## Immediate Next Steps

1. **Create .NET 8 Web API project** with EF Core + SQL Server connection string
2. **Run initial migrations** to create all Phase 1 tables
3. **Implement `/api/auth`** (JWT login) — required before any other endpoint
4. **Wire up `/api/patients` POST** — unblocks frontend registration form
5. **Set up Python AI service** skeleton with `/analyze` stub returning mock data
6. **Connect frontend survey-demo** to real API endpoints (replace mock data)
