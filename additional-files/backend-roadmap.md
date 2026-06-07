# ESAP Intelligent AI Healthcare — Backend Roadmap (Detailed)

**Project:** ESAP Intelligent AI Healthcare Platform  
**Stack:** .NET 8 / ASP.NET Core · SQL Server · Python FastAPI · Next.js  
**Database:** `Healthcare-MIMIC-IV` @ `176.9.16.194,1433`  
**Date:** June 2026 | **Status:** Planning → Active Development

---

## Table of Contents

1. [Full System Architecture](#1-full-system-architecture)
2. [Phase 1 — Foundation, DB Schema & Core API](#2-phase-1--foundation-db-schema--core-api)
3. [Phase 2 — AI Processing Pipeline](#3-phase-2--ai-processing-pipeline)
4. [Phase 3 — Clinical Dashboard & Doctor Decision API](#4-phase-3--clinical-dashboard--doctor-decision-api)
5. [Phase 4 — Full Registration API & Document Pipeline](#5-phase-4--full-registration-api--document-pipeline)
6. [Phase 5 — RLHF Feedback Loop & Model Improvement](#6-phase-5--rlhf-feedback-loop--model-improvement)
7. [Phase 6 — EHR Integration & Extended Features](#7-phase-6--ehr-integration--extended-features)
8. [Phase 7 — Patient App Backend](#8-phase-7--patient-app-backend)
9. [Cross-Cutting: Security, Performance, Observability](#9-cross-cutting-security-performance-observability)
10. [Infrastructure & DevOps](#10-infrastructure--devops)
11. [Testing Strategy](#11-testing-strategy)
12. [Timeline & Milestones](#12-timeline--milestones)

---

## 1. Full System Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                         CLIENTS                                  ║
║  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐ ║
║  │ Next.js Web App │  │ Doctor Tablet UI │  │Patient Mobile   │ ║
║  │ (survey-demo)   │  │ (React/Tailwind) │  │App (React Native│ ║
║  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘ ║
╚═══════════╪═════════════════════╪════════════════════╪══════════╝
            │ HTTPS/TLS 1.3       │                    │
            │ REST + SSE          │                    │
╔═══════════▼═════════════════════▼════════════════════▼══════════╗
║                      API GATEWAY                                 ║
║           ASP.NET Core 8  ·  JWT Auth  ·  Rate Limiting          ║
║           CORS  ·  Request Logging  ·  Health Checks             ║
╚════╤══════════════╤════════════════╤═══════════╤═════════════════╝
     │              │                │           │
╔════▼════╗  ╔══════▼══════╗  ╔══════▼═══╗ ╔════▼═══════════╗
║ Patient  ║  ║ Survey &    ║  ║ Doctor   ║ ║ AI Orchestrator║
║ Service  ║  ║ Registration║  ║ Decision ║ ║ Service        ║
║ (C#)     ║  ║ Service (C#)║  ║ (C#)     ║ ║ (Python 3.12)  ║
╚════╤════╝  ╚══════╤══════╝  ╚══════╤═══╝ ╚════╤═══════════╝
     │              │                │           │
╔════▼══════════════▼════════════════▼═══════════▼═════════════════╗
║            SQL SERVER — Healthcare-MIMIC-IV                       ║
║   Patients · Visits · Medications · Allergies · Consent          ║
║   Appointments · Decisions · AIResults · Feedback · AuditLog     ║
╚══════════════════════════════════════════════════════════════════╝
          │                  │                   │
    ╔═════▼═════╗      ╔═════▼══════╗      ╔═════▼══════╗
    ║   Redis   ║      ║  Qdrant    ║      ║Azure Blob  ║
    ║  Cache +  ║      ║ Vector DB  ║      ║ Storage    ║
    ║  Queue    ║      ║ (RAG)      ║      ║ (Files)    ║
    ╚═══════════╝      ╚════════════╝      ╚════════════╝
```

### Solution Structure

```
ESAP/
├── ESAP.API/                        ← ASP.NET Core 8 Web API
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── PatientsController.cs
│   │   ├── VisitsController.cs
│   │   ├── DoctorController.cs
│   │   ├── AIController.cs
│   │   ├── DocumentsController.cs
│   │   └── PatientAppController.cs
│   ├── Services/
│   │   ├── Interfaces/
│   │   │   ├── IPatientService.cs
│   │   │   ├── IVisitService.cs
│   │   │   ├── IDoctorService.cs
│   │   │   ├── IAIService.cs
│   │   │   └── IDocumentService.cs
│   │   ├── PatientService.cs
│   │   ├── VisitService.cs
│   │   ├── DoctorService.cs
│   │   ├── AIService.cs              ← calls Python AI microservice
│   │   ├── DocumentService.cs
│   │   └── DrugInteractionService.cs
│   ├── Models/                       ← EF Core entity classes
│   │   ├── Patient.cs
│   │   ├── PatientContact.cs
│   │   ├── MedicalHistory.cs
│   │   ├── Medication.cs
│   │   ├── Allergy.cs
│   │   ├── Lifestyle.cs
│   │   ├── FamilyHistory.cs
│   │   ├── Visit.cs
│   │   ├── DoctorDecision.cs
│   │   ├── AIAnalysisResult.cs
│   │   ├── AIFeedback.cs
│   │   ├── Consent.cs
│   │   ├── PatientDocument.cs
│   │   ├── Appointment.cs
│   │   ├── SpeechSession.cs
│   │   └── AuditLog.cs
│   ├── DTOs/                         ← Request / Response objects
│   │   ├── Auth/
│   │   ├── Patient/
│   │   ├── Visit/
│   │   ├── Doctor/
│   │   └── AI/
│   ├── Data/
│   │   ├── AppDbContext.cs
│   │   └── Migrations/
│   ├── Middleware/
│   │   ├── ExceptionMiddleware.cs
│   │   ├── AuditMiddleware.cs
│   │   └── RequestLoggingMiddleware.cs
│   ├── Validators/                   ← FluentValidation
│   ├── Mappings/                     ← AutoMapper profiles
│   ├── Background/                   ← Hangfire jobs
│   │   ├── OcrProcessingJob.cs
│   │   ├── RlhfExportJob.cs
│   │   └── AlertEngineJob.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Program.cs
│
├── ESAP.AI/                          ← Python FastAPI AI service
│   ├── main.py
│   ├── routers/
│   │   ├── analyze.py
│   │   ├── summarize.py
│   │   ├── rag.py
│   │   └── speech.py
│   ├── services/
│   │   ├── claude_client.py
│   │   ├── embedder.py
│   │   ├── vector_store.py
│   │   ├── ocr_service.py
│   │   └── whisper_service.py
│   ├── prompts/
│   │   ├── symptom_analysis.txt
│   │   ├── history_summary.txt
│   │   ├── risk_scoring.txt
│   │   └── conversation_analysis.txt
│   ├── models/
│   │   └── schemas.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── ESAP.Tests/                       ← xUnit test project
│   ├── Unit/
│   ├── Integration/
│   └── Fixtures/
│
├── docker-compose.yml
├── docker-compose.override.yml
└── .github/workflows/ci.yml
```

---

## 2. Phase 1 — Foundation, DB Schema & Core API

**Goal:** Working REST API, auth, patient CRUD, all database tables  
**Timeline:** Weeks 1–4

---

### 2.1 Project Bootstrap

```bash
# Create solution
dotnet new sln -n ESAP
dotnet new webapi -n ESAP.API --use-controllers
dotnet new xunit -n ESAP.Tests
dotnet sln add ESAP.API ESAP.Tests

# Add NuGet packages
cd ESAP.API
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
dotnet add package FluentValidation.AspNetCore
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package StackExchange.Redis
dotnet add package Hangfire.AspNetCore
dotnet add package Hangfire.SqlServer
dotnet add package AspNetCoreRateLimit
dotnet add package Swashbuckle.AspNetCore
dotnet add package BCrypt.Net-Next
```

---

### 2.2 `appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "data source=176.9.16.194,1433; initial catalog=Healthcare-MIMIC-IV; User Id=sa; Password=Esap.12.Three; MultipleActiveResultSets=True; Application Name=EntityFramework; TrustServerCertificate=True; Encrypt=False",
    "Redis": "localhost:6379"
  },
  "Jwt": {
    "Key": "CHANGE_THIS_IN_PRODUCTION_USE_AZURE_KEY_VAULT",
    "Issuer": "esap-api",
    "Audience": "esap-clients",
    "AccessTokenExpiryMinutes": 15,
    "RefreshTokenExpiryDays": 30
  },
  "AI": {
    "ServiceUrl": "http://localhost:8000",
    "AnthropicApiKey": "SET_VIA_ENVIRONMENT_VARIABLE"
  },
  "Storage": {
    "AzureBlobConnectionString": "SET_VIA_ENVIRONMENT_VARIABLE",
    "ContainerName": "esap-documents"
  },
  "Qdrant": {
    "Host": "localhost",
    "Port": 6333
  },
  "RateLimit": {
    "GeneralRules": [
      { "Endpoint": "*", "Period": "1m", "Limit": 100 }
    ]
  }
}
```

---

### 2.3 `Program.cs`

```csharp
using ESAP.API.Data;
using ESAP.API.Middleware;
using ESAP.API.Services;
using FluentValidation;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using StackExchange.Redis;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/esap-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();
builder.Host.UseSerilog();

// ── Database ─────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Redis ─────────────────────────────────────────────────────────
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!));

// ── Auth ─────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt => {
        opt.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization(opt => {
    opt.AddPolicy("DoctorOnly",  p => p.RequireRole("doctor", "admin"));
    opt.AddPolicy("PatientOnly", p => p.RequireRole("patient"));
    opt.AddPolicy("StaffOnly",   p => p.RequireRole("doctor", "nurse", "admin"));
});

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IVisitService, VisitService>();
builder.Services.AddScoped<IDoctorService, DoctorService>();
builder.Services.AddScoped<IAIService, AIService>();
builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddScoped<IDrugInteractionService, DrugInteractionService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddHttpClient<IAIService, AIService>(c =>
    c.BaseAddress = new Uri(builder.Configuration["AI:ServiceUrl"]!));

// ── AutoMapper + FluentValidation ────────────────────────────────
builder.Services.AddAutoMapper(typeof(Program));
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// ── Hangfire ──────────────────────────────────────────────────────
builder.Services.AddHangfire(config =>
    config.UseSqlServerStorage(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddHangfireServer();

// ── CORS ──────────────────────────────────────────────────────────
builder.Services.AddCors(opt => opt.AddPolicy("Frontend", p =>
    p.WithOrigins("http://localhost:3000", "https://esap.health")
     .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// ── Swagger ───────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new() { Title = "ESAP Healthcare API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new() {
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer", BearerFormat = "JWT"
    });
});

builder.Services.AddControllers();
builder.Services.AddHealthChecks()
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")!)
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!);

var app = builder.Build();

// ── Middleware pipeline ───────────────────────────────────────────
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<AuditMiddleware>();
app.UseSerilogRequestLogging();
app.UseSwagger(); app.UseSwaggerUI();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");
app.UseHangfireDashboard("/hangfire");

// ── Recurring jobs ────────────────────────────────────────────────
RecurringJob.AddOrUpdate<RlhfExportJob>("rlhf-export", j => j.Execute(), Cron.Hourly);
RecurringJob.AddOrUpdate<AlertEngineJob>("alert-engine", j => j.Execute(), Cron.Daily);

app.Run();
```

---

### 2.4 Database Schema — Complete SQL

```sql
-- ═══════════════════════════════════════════════════════════════
-- ESAP Healthcare-MIMIC-IV — Full Schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Staff / Users table (doctors, nurses, admins)
CREATE TABLE Users (
    UserId          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Email           VARCHAR(255) UNIQUE NOT NULL,
    PasswordHash    NVARCHAR(500) NOT NULL,
    FullName        NVARCHAR(200) NOT NULL,
    Role            VARCHAR(20) NOT NULL CHECK (Role IN ('admin','doctor','nurse','patient')),
    Specialty       NVARCHAR(100),
    LicenseNumber   VARCHAR(50),
    HospitalId      VARCHAR(50),
    IsActive        BIT DEFAULT 1,
    LastLoginAt     DATETIME2,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

-- 2. Patients
CREATE TABLE Patients (
    PatientId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ExternalId      VARCHAR(20)   UNIQUE NOT NULL,     -- ESAP-XXXXXXXX
    UserId          UNIQUEIDENTIFIER REFERENCES Users(UserId) NULL,
    FullName        NVARCHAR(200) NOT NULL,
    PreferredName   NVARCHAR(100),
    DateOfBirth     DATE          NOT NULL,
    BiologicalSex   VARCHAR(20)   NOT NULL,
    GenderIdentity  NVARCHAR(100),
    BloodGroup      VARCHAR(5),
    HeightCm        DECIMAL(5,1),
    WeightKg        DECIMAL(5,1),
    Nationality     NVARCHAR(100),
    Ethnicity       NVARCHAR(MAX),        -- JSON array
    MaritalStatus   VARCHAR(20),
    EducationLevel  NVARCHAR(100),
    Religion        NVARCHAR(100),
    ProfilePhotoUrl NVARCHAR(500),
    IsActive        BIT DEFAULT 1,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt       DATETIME2 DEFAULT GETUTCDATE()
);
-- Computed BMI column (SQL Server 2022+)
ALTER TABLE Patients ADD BMI AS (
    CASE WHEN HeightCm > 0 AND WeightKg > 0
    THEN ROUND(WeightKg / POWER(HeightCm / 100.0, 2), 1) END
);
CREATE INDEX IX_Patients_ExternalId ON Patients(ExternalId);
CREATE INDEX IX_Patients_FullName   ON Patients(FullName);

-- 3. Patient Contacts
CREATE TABLE PatientContacts (
    ContactId           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId) ON DELETE CASCADE,
    PrimaryPhone        VARCHAR(30),
    SecondaryPhone      VARCHAR(30),
    Email               VARCHAR(255),
    AddressStreet       NVARCHAR(300),
    AddressCity         NVARCHAR(100),
    AddressCountry      NVARCHAR(100),
    PostalCode          VARCHAR(20),
    EmergencyName       NVARCHAR(200),
    EmergencyPhone      VARCHAR(30),
    EmergencyEmail      VARCHAR(255),
    EmergencyRelation   VARCHAR(50),
    LegalGuardian       NVARCHAR(200),
    PreferredMethod     VARCHAR(20),
    PreferredTime       VARCHAR(20),
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);
CREATE UNIQUE INDEX IX_PatientContacts_PatientId ON PatientContacts(PatientId);

-- 4. Medical History
CREATE TABLE MedicalHistory (
    HistoryId               UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId               UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId) ON DELETE CASCADE,
    ChronicConditions       NVARCHAR(MAX),   -- JSON: ["diabetes_type_2","hypertension"]
    ChronicDiagnosisDates   NVARCHAR(MAX),   -- JSON: {"diabetes_type_2":"2020-03-01"}
    PastSurgeries           NVARCHAR(MAX),   -- JSON array of {name, date, hospital}
    PastHospitalizations    NVARCHAR(MAX),   -- JSON array
    SeriousInfections       NVARCHAR(MAX),   -- JSON array
    CancerHistory           BIT DEFAULT 0,
    CancerDetails           NVARCHAR(500),
    AutoimmuneConditions    NVARCHAR(MAX),   -- JSON array
    NeurologicalHistory     NVARCHAR(MAX),   -- JSON array
    CardiovascularHistory   NVARCHAR(MAX),   -- JSON array
    MentalHealthHistory     NVARCHAR(MAX),   -- JSON array
    ObstetricHistory        NVARCHAR(MAX),
    PregnancyStatus         VARCHAR(30),
    GestationalAgeWeeks     TINYINT,
    DisabilityStatus        NVARCHAR(MAX),   -- JSON array
    Vaccinations            NVARCHAR(MAX),   -- JSON array
    GeneticConditions       NVARCHAR(500),
    UpdatedAt               DATETIME2 DEFAULT GETUTCDATE()
);
CREATE UNIQUE INDEX IX_MedicalHistory_PatientId ON MedicalHistory(PatientId);

-- 5. Medications
CREATE TABLE Medications (
    MedicationId    UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    DrugName        NVARCHAR(200) NOT NULL,
    Dosage          VARCHAR(100),
    Frequency       VARCHAR(100),
    PrescribedBy    NVARCHAR(200),
    MedicationType  VARCHAR(20) CHECK (MedicationType IN ('prescription','otc','supplement','herbal')),
    IsActive        BIT DEFAULT 1,
    StartDate       DATE,
    EndDate         DATE,
    Notes           NVARCHAR(500),
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Medications_PatientId ON Medications(PatientId);
CREATE INDEX IX_Medications_DrugName  ON Medications(DrugName);

-- 6. Allergies
CREATE TABLE Allergies (
    AllergyId       UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    AllergyType     VARCHAR(20) NOT NULL CHECK (AllergyType IN ('drug','food','environmental','latex','contrast')),
    Substance       NVARCHAR(200) NOT NULL,
    ReactionType    VARCHAR(50),
    Severity        VARCHAR(20) CHECK (Severity IN ('mild','moderate','severe','anaphylaxis','unknown')),
    ConfirmedBy     VARCHAR(30) CHECK (ConfirmedBy IN ('self_reported','allergy_test','doctor_confirmed')),
    PreviousAnaphylaxis BIT DEFAULT 0,
    IsActive        BIT DEFAULT 1,
    RecordedAt      DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Allergies_PatientId ON Allergies(PatientId);
CREATE INDEX IX_Allergies_Substance ON Allergies(Substance);   -- for drug interaction checks

-- 7. Lifestyle
CREATE TABLE Lifestyle (
    LifestyleId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    SmokingStatus       VARCHAR(20),
    CigarettesPerDay    TINYINT,
    YearsSmoked         TINYINT,
    AlcoholConsumption  VARCHAR(30),
    AlcoholUnitsPerWeek TINYINT,
    RecreationalDrugs   NVARCHAR(200),
    ExerciseFrequency   VARCHAR(30),
    ExerciseTypes       NVARCHAR(MAX),   -- JSON array
    DietType            VARCHAR(50),
    WaterIntake         VARCHAR(10),
    SleepHours          DECIMAL(3,1),
    SleepQuality        TINYINT,
    StressLevel         TINYINT,
    Occupation          NVARCHAR(200),
    WorkEnvironment     VARCHAR(50),
    ScreenTimeHours     TINYINT,
    CaffeineConsumption VARCHAR(20),
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);
CREATE UNIQUE INDEX IX_Lifestyle_PatientId ON Lifestyle(PatientId);

-- 8. Family History
CREATE TABLE FamilyHistory (
    FamilyHistoryId     UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    Condition           NVARCHAR(200) NOT NULL,
    AffectedRelatives   NVARCHAR(MAX),   -- JSON array: ["father","mother"]
    AdditionalDetails   NVARCHAR(500),
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_FamilyHistory_PatientId ON FamilyHistory(PatientId);

-- 9. Insurance & Hospital Info
CREATE TABLE InsuranceInfo (
    InsuranceId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    InsuranceProvider   NVARCHAR(200),
    PolicyNumber        VARCHAR(100),
    PlanType            VARCHAR(30),
    CoverageExpiry      DATE,
    PCPName             NVARCHAR(200),
    ReferringDoctor     NVARCHAR(200),
    PreferredHospital   NVARCHAR(200),
    PreferredLanguage   VARCHAR(50),
    SecondaryLanguage   VARCHAR(50),
    InterpreterRequired BIT DEFAULT 0,
    PreferredDoctor     NVARCHAR(200),
    UpdatedAt           DATETIME2 DEFAULT GETUTCDATE()
);
CREATE UNIQUE INDEX IX_InsuranceInfo_PatientId ON InsuranceInfo(PatientId);

-- 10. Consent
CREATE TABLE Consent (
    ConsentId               UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId               UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    AIDiagnosis             BIT NOT NULL DEFAULT 0,
    SpeechRecording         BIT NOT NULL DEFAULT 0,
    Transcription           BIT NOT NULL DEFAULT 0,
    ShareWithDoctors        BIT NOT NULL DEFAULT 0,
    ShareWithSpecialists    BIT NOT NULL DEFAULT 0,
    ResearchTraining        BIT NOT NULL DEFAULT 0,
    LabSharing              BIT NOT NULL DEFAULT 0,
    PersonalApp             BIT NOT NULL DEFAULT 0,
    DataRetention           VARCHAR(30),
    EmergencyOverride       BIT NOT NULL DEFAULT 0,
    SignatureData           NVARCHAR(MAX),   -- base64 canvas PNG
    ConsentFormVersion      VARCHAR(10) DEFAULT '1.0',
    SignedAt                DATETIME2 DEFAULT GETUTCDATE(),
    ExpiresAt               DATETIME2,
    RevokedAt               DATETIME2 NULL,
    RevokedReason           NVARCHAR(500) NULL
);
CREATE INDEX IX_Consent_PatientId ON Consent(PatientId);

-- 11. Visits
CREATE TABLE Visits (
    VisitId             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    DoctorId            UNIQUEIDENTIFIER REFERENCES Users(UserId) NULL,
    VisitDate           DATETIME2 NOT NULL,
    VisitType           VARCHAR(30) CHECK (VisitType IN ('registration','survey','consultation','follow_up','emergency')),
    ChiefComplaint      NVARCHAR(500),
    SymptomDescription  NVARCHAR(MAX),
    OnsetDate           DATE,
    OnsetType           VARCHAR(20),
    Duration            VARCHAR(100),
    PainScale           TINYINT CHECK (PainScale BETWEEN 0 AND 10),
    SymptomLocation     VARCHAR(100),
    SymptomRadiation    NVARCHAR(300),
    AssociatedSymptoms  NVARCHAR(MAX),   -- JSON array
    AggravatingFactors  NVARCHAR(MAX),   -- JSON array
    RelievingFactors    NVARCHAR(MAX),   -- JSON array
    SymptomFrequency    VARCHAR(30),
    PreviousEpisodes    BIT,
    SelfTreatment       NVARCHAR(500),
    PatientConcern      NVARCHAR(MAX),
    Status              VARCHAR(20) DEFAULT 'open' CHECK (Status IN ('open','ai_processed','under_review','closed')),
    CreatedAt           DATETIME2 DEFAULT GETUTCDATE(),
    ClosedAt            DATETIME2 NULL
);
CREATE INDEX IX_Visits_PatientId  ON Visits(PatientId);
CREATE INDEX IX_Visits_VisitDate  ON Visits(VisitDate DESC);
CREATE INDEX IX_Visits_DoctorId   ON Visits(DoctorId);
CREATE INDEX IX_Visits_Status     ON Visits(Status);

-- 12. AI Analysis Results
CREATE TABLE AIAnalysisResults (
    ResultId        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId         UNIQUEIDENTIFIER NOT NULL REFERENCES Visits(VisitId),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    RiskScore       TINYINT CHECK (RiskScore BETWEEN 0 AND 100),
    RiskLevel       VARCHAR(20) CHECK (RiskLevel IN ('low','moderate','high','critical')),
    ProfileLabel    NVARCHAR(300),
    Summary         NVARCHAR(MAX),
    Flags           NVARCHAR(MAX),           -- JSON array of RiskFlag objects
    Recommendations NVARCHAR(MAX),           -- JSON array of Recommendation objects
    CompletionPct   TINYINT,
    ModelVersion    VARCHAR(30),
    PromptTokens    INT,
    CompletionTokens INT,
    GeneratedAt     DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_AIResults_VisitId    ON AIAnalysisResults(VisitId);
CREATE INDEX IX_AIResults_PatientId  ON AIAnalysisResults(PatientId);

-- 13. Doctor Decisions
CREATE TABLE DoctorDecisions (
    DecisionId          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId             UNIQUEIDENTIFIER NOT NULL REFERENCES Visits(VisitId),
    AIResultId          UNIQUEIDENTIFIER REFERENCES AIAnalysisResults(ResultId) NULL,
    DoctorId            UNIQUEIDENTIFIER REFERENCES Users(UserId) NULL,
    DoctorName          NVARCHAR(200) NOT NULL,
    FlagReviews         NVARCHAR(MAX),   -- JSON: [{flagId, decision, note}]
    PrimaryDiagnosis    NVARCHAR(300) NOT NULL,
    SecondaryDiagnosis  NVARCHAR(300),
    IcdCode             VARCHAR(20),
    ClinicalNotes       NVARCHAR(MAX) NOT NULL,
    TreatmentPlan       NVARCHAR(MAX),   -- JSON array of treatment items
    TreatmentDetails    NVARCHAR(MAX),   -- JSON: {labs:"...", imaging:"..."}
    Prescriptions       NVARCHAR(MAX),   -- JSON: [{drug, dosage, frequency}]
    FollowUpSchedule    VARCHAR(50),
    SubmittedAt         DATETIME2 DEFAULT GETUTCDATE(),
    IsAmended           BIT DEFAULT 0,
    AmendedAt           DATETIME2 NULL
);
CREATE INDEX IX_Decisions_VisitId ON DoctorDecisions(VisitId);

-- 14. AI Feedback (RLHF)
CREATE TABLE AIFeedback (
    FeedbackId          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ResultId            UNIQUEIDENTIFIER NOT NULL REFERENCES AIAnalysisResults(ResultId),
    DecisionId          UNIQUEIDENTIFIER NOT NULL REFERENCES DoctorDecisions(DecisionId),
    VisitId             UNIQUEIDENTIFIER NOT NULL REFERENCES Visits(VisitId),
    FlagReviews         NVARCHAR(MAX),   -- doctor's accept/modify/dismiss per flag
    DiagnosisDelta      NVARCHAR(MAX),   -- diff: AI suggestion vs doctor decision
    QualityScore        DECIMAL(3,2),    -- 0.00 to 1.00, computed by scoring service
    UsedForTraining     BIT DEFAULT 0,
    TrainingBatchId     VARCHAR(50) NULL,
    CreatedAt           DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_AIFeedback_ResultId ON AIFeedback(ResultId);
CREATE INDEX IX_AIFeedback_Training ON AIFeedback(UsedForTraining, CreatedAt);

-- 15. Patient Documents (EHR uploads)
CREATE TABLE PatientDocuments (
    DocumentId      UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    DocumentType    VARCHAR(50) CHECK (DocumentType IN ('lab_result','imaging','prescription','discharge','vaccination','referral','wearable_data','other')),
    OriginalFileName NVARCHAR(300),
    BlobUrl         NVARCHAR(1000),
    FileSize        BIGINT,
    MimeType        VARCHAR(100),
    OcrText         NVARCHAR(MAX),           -- extracted text for RAG indexing
    QdrantChunkIds  NVARCHAR(MAX),           -- JSON array of vector IDs
    IsProcessed     BIT DEFAULT 0,
    ProcessedAt     DATETIME2 NULL,
    UploadedAt      DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Documents_PatientId  ON PatientDocuments(PatientId);
CREATE INDEX IX_Documents_Processed  ON PatientDocuments(IsProcessed);

-- 16. Appointments
CREATE TABLE Appointments (
    AppointmentId   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    DoctorId        UNIQUEIDENTIFIER REFERENCES Users(UserId) NULL,
    AppointmentDate DATETIME2 NOT NULL,
    AppointmentType VARCHAR(50),
    Status          VARCHAR(20) DEFAULT 'scheduled' CHECK (Status IN ('scheduled','confirmed','completed','cancelled','no_show')),
    Notes           NVARCHAR(500),
    LinkedVisitId   UNIQUEIDENTIFIER REFERENCES Visits(VisitId) NULL,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Appointments_PatientId ON Appointments(PatientId);
CREATE INDEX IX_Appointments_Date      ON Appointments(AppointmentDate);

-- 17. Speech Sessions (real-time transcription)
CREATE TABLE SpeechSessions (
    SessionId           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VisitId             UNIQUEIDENTIFIER NOT NULL REFERENCES Visits(VisitId),
    PatientId           UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    AudioBlobUrl        NVARCHAR(1000),
    TranscriptRaw       NVARCHAR(MAX),       -- raw Whisper output
    TranscriptClean     NVARCHAR(MAX),       -- de-identified, formatted
    ClinicalEntities    NVARCHAR(MAX),       -- JSON: extracted symptoms, medications, etc.
    SpeakerLabels       NVARCHAR(MAX),       -- JSON: {doctor:"...", patient:"..."}
    DurationSeconds     INT,
    LanguageDetected    VARCHAR(10),
    StartedAt           DATETIME2,
    EndedAt             DATETIME2
);
CREATE INDEX IX_Speech_VisitId ON SpeechSessions(VisitId);

-- 18. Medication Adherence Log
CREATE TABLE MedicationAdherence (
    AdherenceId     UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    MedicationId    UNIQUEIDENTIFIER NOT NULL REFERENCES Medications(MedicationId),
    LogDate         DATE NOT NULL,
    Taken           BIT NOT NULL,
    Notes           NVARCHAR(200),
    LoggedAt        DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Adherence_Patient_Date ON MedicationAdherence(PatientId, LogDate DESC);

-- 19. Health Alerts
CREATE TABLE HealthAlerts (
    AlertId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PatientId       UNIQUEIDENTIFIER NOT NULL REFERENCES Patients(PatientId),
    AlertType       VARCHAR(50),
    Severity        VARCHAR(20) CHECK (Severity IN ('info','warning','critical')),
    Title           NVARCHAR(200) NOT NULL,
    Detail          NVARCHAR(MAX),
    Tip             NVARCHAR(500),
    Source          VARCHAR(30) CHECK (Source IN ('ai_analysis','doctor','system','rule_engine')),
    IsDismissed     BIT DEFAULT 0,
    DismissedAt     DATETIME2 NULL,
    ExpiresAt       DATETIME2 NULL,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_Alerts_PatientId ON HealthAlerts(PatientId, IsDismissed);

-- 20. Audit Log (HIPAA requirement)
CREATE TABLE AuditLog (
    AuditId         BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId          UNIQUEIDENTIFIER NULL,
    PatientId       UNIQUEIDENTIFIER NULL,
    Action          VARCHAR(20) NOT NULL,   -- CREATE / READ / UPDATE / DELETE
    Resource        VARCHAR(100) NOT NULL,  -- "Patient", "Visit", "AIResult", etc.
    ResourceId      VARCHAR(50),
    OldValues       NVARCHAR(MAX),          -- JSON snapshot before change
    NewValues       NVARCHAR(MAX),          -- JSON snapshot after change
    IpAddress       VARCHAR(45),
    UserAgent       NVARCHAR(500),
    Timestamp       DATETIME2 DEFAULT GETUTCDATE()
);
CREATE INDEX IX_AuditLog_PatientId  ON AuditLog(PatientId, Timestamp DESC);
CREATE INDEX IX_AuditLog_UserId     ON AuditLog(UserId, Timestamp DESC);
CREATE INDEX IX_AuditLog_Timestamp  ON AuditLog(Timestamp DESC);

-- 21. Refresh Tokens
CREATE TABLE RefreshTokens (
    TokenId         UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER NOT NULL REFERENCES Users(UserId),
    Token           NVARCHAR(500) UNIQUE NOT NULL,
    ExpiresAt       DATETIME2 NOT NULL,
    IsRevoked       BIT DEFAULT 0,
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE(),
    RevokedAt       DATETIME2 NULL,
    ReplacedByToken NVARCHAR(500) NULL
);
CREATE INDEX IX_RefreshTokens_Token  ON RefreshTokens(Token);
CREATE INDEX IX_RefreshTokens_UserId ON RefreshTokens(UserId);
```

---

### 2.5 EF Core Entity Models (C#)

```csharp
// Models/Patient.cs
public class Patient
{
    public Guid PatientId { get; set; } = Guid.NewGuid();
    public string ExternalId { get; set; } = null!;
    public Guid? UserId { get; set; }
    public string FullName { get; set; } = null!;
    public string? PreferredName { get; set; }
    public DateOnly DateOfBirth { get; set; }
    public string BiologicalSex { get; set; } = null!;
    public string? BloodGroup { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? WeightKg { get; set; }
    public string? Nationality { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User? User { get; set; }
    public PatientContact? Contact { get; set; }
    public MedicalHistory? MedicalHistory { get; set; }
    public ICollection<Medication> Medications { get; set; } = [];
    public ICollection<Allergy> Allergies { get; set; } = [];
    public Lifestyle? Lifestyle { get; set; }
    public ICollection<FamilyHistory> FamilyHistory { get; set; } = [];
    public InsuranceInfo? InsuranceInfo { get; set; }
    public Consent? Consent { get; set; }
    public ICollection<Visit> Visits { get; set; } = [];
    public ICollection<PatientDocument> Documents { get; set; } = [];
    public ICollection<Appointment> Appointments { get; set; } = [];
    public ICollection<HealthAlert> HealthAlerts { get; set; } = [];
}
```

```csharp
// Data/AppDbContext.cs
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientContact> PatientContacts => Set<PatientContact>();
    public DbSet<MedicalHistory> MedicalHistories => Set<MedicalHistory>();
    public DbSet<Medication> Medications => Set<Medication>();
    public DbSet<Allergy> Allergies => Set<Allergy>();
    public DbSet<Lifestyle> Lifestyles => Set<Lifestyle>();
    public DbSet<FamilyHistory> FamilyHistories => Set<FamilyHistory>();
    public DbSet<InsuranceInfo> InsuranceInfos => Set<InsuranceInfo>();
    public DbSet<Consent> Consents => Set<Consent>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<AIAnalysisResult> AIResults => Set<AIAnalysisResult>();
    public DbSet<DoctorDecision> DoctorDecisions => Set<DoctorDecision>();
    public DbSet<AIFeedback> AIFeedbacks => Set<AIFeedback>();
    public DbSet<PatientDocument> PatientDocuments => Set<PatientDocument>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<SpeechSession> SpeechSessions => Set<SpeechSession>();
    public DbSet<MedicationAdherence> MedicationAdherences => Set<MedicationAdherence>();
    public DbSet<HealthAlert> HealthAlerts => Set<HealthAlert>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Patient>().Property(p => p.ExternalId).IsRequired().HasMaxLength(20);
        mb.Entity<Patient>().HasIndex(p => p.ExternalId).IsUnique();
        mb.Entity<Patient>().HasOne(p => p.Contact).WithOne(c => c.Patient)
            .HasForeignKey<PatientContact>(c => c.PatientId);
        // ... remaining fluent configuration
    }
}
```

---

### 2.6 Auth Controller & JWT Service

```csharp
// Controllers/AuthController.cs
[ApiController]
[Route("api/auth")]
public class AuthController(ITokenService tokenService, AppDbContext db) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email && u.IsActive);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid credentials" });

        var (accessToken, refreshToken) = await tokenService.GenerateTokenPairAsync(user);

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new {
            accessToken,
            refreshToken,
            expiresIn = 900,  // 15 min
            user = new { user.UserId, user.FullName, user.Role, user.Email }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
    {
        var result = await tokenService.RefreshAsync(req.RefreshToken);
        if (result is null) return Unauthorized(new { message = "Invalid or expired refresh token" });
        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req)
    {
        await tokenService.RevokeAsync(req.RefreshToken);
        return NoContent();
    }
}
```

```csharp
// Services/TokenService.cs
public class TokenService(IConfiguration config, AppDbContext db) : ITokenService
{
    public async Task<(string access, string refresh)> GenerateTokenPairAsync(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("name", user.FullName),
        };

        var access = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(
                int.Parse(config["Jwt:AccessTokenExpiryMinutes"]!)),
            signingCredentials: creds);

        var refresh = new RefreshToken {
            UserId    = user.UserId,
            Token     = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
            ExpiresAt = DateTime.UtcNow.AddDays(
                int.Parse(config["Jwt:RefreshTokenExpiryDays"]!))
        };
        db.RefreshTokens.Add(refresh);
        await db.SaveChangesAsync();

        return (new JwtSecurityTokenHandler().WriteToken(access), refresh.Token);
    }
}
```

---

### 2.7 Patients Controller

```csharp
// Controllers/PatientsController.cs
[ApiController]
[Route("api/patients")]
[Authorize]
public class PatientsController(IPatientService svc, IAIService ai) : ControllerBase
{
    // POST /api/patients  — full registration submit
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePatientRequest req)
    {
        var result = await svc.CreateAsync(req);
        // Async: trigger RAG index build if AI consent granted
        if (req.Consent?.AIDiagnosis == true)
            BackgroundJob.Enqueue<RagIndexJob>(j => j.BuildAsync(result.PatientId));
        return CreatedAtAction(nameof(GetById), new { id = result.PatientId }, result);
    }

    // GET /api/patients/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var patient = await svc.GetFullProfileAsync(id);
        return patient is null ? NotFound() : Ok(patient);
    }

    // GET /api/patients/{id}/summary  — compact AI-ready summary
    [HttpGet("{id:guid}/summary")]
    public async Task<IActionResult> Summary(Guid id)
    {
        var summary = await svc.GetAISummaryAsync(id);
        return summary is null ? NotFound() : Ok(summary);
    }

    // GET /api/patients?search=john&cursor=xxx&limit=20
    [HttpGet]
    [Authorize(Policy = "StaffOnly")]
    public async Task<IActionResult> List([FromQuery] PatientListRequest req)
        => Ok(await svc.ListAsync(req));

    // PUT /api/patients/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePatientRequest req)
    {
        await svc.UpdateAsync(id, req);
        return NoContent();
    }

    // DELETE /api/patients/{id}  — GDPR soft delete
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "DoctorOnly")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await svc.SoftDeleteAsync(id);
        return NoContent();
    }

    // GET /api/patients/{id}/visits
    [HttpGet("{id:guid}/visits")]
    public async Task<IActionResult> Visits(Guid id)
        => Ok(await svc.GetVisitHistoryAsync(id));

    // POST/PUT section endpoints
    [HttpPut("{id:guid}/contact")]
    public async Task<IActionResult> UpsertContact(Guid id, [FromBody] ContactRequest req)
        => Ok(await svc.UpsertContactAsync(id, req));

    [HttpPut("{id:guid}/medical-history")]
    public async Task<IActionResult> UpsertMedicalHistory(Guid id, [FromBody] MedicalHistoryRequest req)
        => Ok(await svc.UpsertMedicalHistoryAsync(id, req));

    [HttpPut("{id:guid}/medications")]
    public async Task<IActionResult> UpsertMedications(Guid id, [FromBody] MedicationsRequest req)
    {
        var result = await svc.UpsertMedicationsAsync(id, req);
        // Trigger drug interaction check
        BackgroundJob.Enqueue<DrugInteractionJob>(j => j.CheckAsync(id));
        return Ok(result);
    }

    [HttpPut("{id:guid}/lifestyle")]
    public async Task<IActionResult> UpsertLifestyle(Guid id, [FromBody] LifestyleRequest req)
        => Ok(await svc.UpsertLifestyleAsync(id, req));

    [HttpPut("{id:guid}/consent")]
    public async Task<IActionResult> UpsertConsent(Guid id, [FromBody] ConsentRequest req)
        => Ok(await svc.UpsertConsentAsync(id, req));
}
```

---

### 2.8 Global Exception Middleware

```csharp
// Middleware/ExceptionMiddleware.cs
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            ctx.Response.StatusCode = ex switch {
                ValidationException  => 422,
                UnauthorizedAccessException => 401,
                KeyNotFoundException => 404,
                _ => 500
            };
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new {
                status  = ctx.Response.StatusCode,
                message = ex is ValidationException v
                          ? v.Errors.Select(e => e.ErrorMessage)
                          : ex.Message,
                traceId = ctx.TraceIdentifier
            });
        }
    }
}
```

---

### 2.9 Standard API Response Format

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "requestId": "uuid", "timestamp": "2026-06-02T10:00:00Z" }
}

// Paginated list
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJpZCI6IjEyMyJ9",
    "hasMore": true,
    "total": 142
  }
}

// Error (422 Validation)
{
  "success": false,
  "status": 422,
  "errors": [
    { "field": "fullName", "message": "Full name is required" },
    { "field": "dateOfBirth", "message": "Date of birth must be in the past" }
  ],
  "traceId": "00-abc123-01"
}

// Error (500)
{
  "success": false,
  "status": 500,
  "message": "An unexpected error occurred",
  "traceId": "00-abc123-01"
}
```

---

## 3. Phase 2 — AI Processing Pipeline

**Goal:** LLM integration, RAG system, symptom analysis  
**Timeline:** Weeks 5–10

---

### 3.1 Python FastAPI Service — Full Structure

```python
# ESAP.AI/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, summarize, rag, speech
import logging

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="ESAP AI Service", version="1.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5000"],  # .NET API only
    allow_methods=["POST","GET"],
    allow_headers=["*"])

app.include_router(analyze.router,   prefix="/analyze",   tags=["Analysis"])
app.include_router(summarize.router, prefix="/summarize", tags=["Summary"])
app.include_router(rag.router,       prefix="/rag",       tags=["RAG"])
app.include_router(speech.router,    prefix="/speech",    tags=["Speech"])

@app.get("/health")
def health(): return {"status": "ok"}
```

```python
# ESAP.AI/services/claude_client.py
import anthropic
import os
from models.schemas import PatientContext

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT_BASE = """You are ESAP, a clinical AI assistant embedded in a hospital's 
electronic health record system. You assist doctors by analyzing patient data and generating 
structured clinical insights. You are NOT a replacement for clinical judgment.

Rules:
- Always output valid JSON matching the provided schema
- Flag critical findings with severity "critical"  
- If data is insufficient, state confidence level
- Never fabricate clinical data — only analyze what is provided
- Flag potential drug interactions from the medication list
"""

def analyze_visit(patient: PatientContext, symptoms: dict) -> dict:
    """Run full clinical analysis with prompt caching on patient profile."""
    
    # Build the patient profile block (will be cached)
    patient_profile = f"""
## Patient Profile (Registered Data)
- Name: {patient.full_name}, Age: {patient.age}, Sex: {patient.biological_sex}
- Blood Group: {patient.blood_group}, BMI: {patient.bmi}
- Chronic Conditions: {', '.join(patient.chronic_conditions)}
- Active Medications: {_format_medications(patient.medications)}
- Known Allergies: {_format_allergies(patient.allergies)}
- Lifestyle: Sleep {patient.sleep_hours}h, Stress {patient.stress_level}/10, 
  Smoking: {patient.smoking_status}, Exercise: {patient.exercise_frequency}
- Family History: {_format_family_history(patient.family_history)}
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=[
            # Cache the base system prompt (stable across all patients)
            {"type": "text", "text": SYSTEM_PROMPT_BASE,
             "cache_control": {"type": "ephemeral"}},
            # Cache the patient profile (stable within a session)
            {"type": "text", "text": patient_profile,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": f"""
Analyze this patient visit and return a JSON object with this exact schema:
{{
  "riskScore": <0-100>,
  "riskLevel": "<low|moderate|high|critical>",
  "profileLabel": "<one-line patient characterization>",
  "summary": "<3-5 sentence clinical narrative>",
  "completionPct": <0-100>,
  "flags": [
    {{"id": "<slug>", "label": "<title>", "severity": "<info|warning|critical>",
      "detail": "<explanation>", "evidence": ["<source1>"]}}
  ],
  "recommendations": [
    {{"id": "<slug>", "title": "<action>", "description": "<detail>",
      "priority": "<routine|soon|urgent>", "icon": "<emoji>"}}
  ]
}}

Current Visit Data:
Chief Complaint: {symptoms.get('chief_complaint')}
Description: {symptoms.get('description')}
Onset: {symptoms.get('onset_type')} — {symptoms.get('duration')}
Pain Scale: {symptoms.get('pain_scale')}/10
Location: {symptoms.get('location')}
Associated Symptoms: {symptoms.get('associated_symptoms')}
Self-Treatment: {symptoms.get('self_treatment')}

RAG Context (relevant historical records):
{symptoms.get('rag_context', 'No prior records available')}
"""
        }]
    )
    
    import json
    return json.loads(response.content[0].text)
```

```python
# ESAP.AI/services/embedder.py
from sentence_transformers import SentenceTransformer
import numpy as np

_model = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        # medical-specific model — better than generic MiniLM for clinical text
        _model = SentenceTransformer("NeuML/pubmedbert-base-embeddings")
    return _model

def embed(texts: list[str]) -> list[list[float]]:
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()

def embed_single(text: str) -> list[float]:
    return embed([text])[0]
```

```python
# ESAP.AI/services/vector_store.py
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from services.embedder import embed_single, embed
import uuid, os

client = QdrantClient(
    host=os.getenv("QDRANT_HOST", "localhost"),
    port=int(os.getenv("QDRANT_PORT", "6333"))
)

COLLECTION = "esap_patient_documents"
VECTOR_SIZE = 768  # PubMedBERT output dim

def ensure_collection():
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(COLLECTION, vectors_config=VectorParams(
            size=VECTOR_SIZE, distance=Distance.COSINE))

def index_document(patient_id: str, doc_id: str, text: str, metadata: dict) -> list[str]:
    """Chunk, embed and store a patient document. Returns list of chunk IDs."""
    ensure_collection()
    chunks = _chunk_text(text, size=512, overlap=50)
    vectors = embed(chunks)
    
    points = []
    chunk_ids = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        point_id = str(uuid.uuid4())
        chunk_ids.append(point_id)
        points.append(PointStruct(
            id=point_id,
            vector=vector,
            payload={
                "patient_id": patient_id,
                "doc_id":     doc_id,
                "chunk_idx":  i,
                "text":       chunk,
                **metadata
            }
        ))
    client.upsert(collection_name=COLLECTION, points=points)
    return chunk_ids

def search(patient_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Retrieve top-K relevant chunks for a specific patient."""
    ensure_collection()
    query_vec = embed_single(query)
    results = client.search(
        collection_name=COLLECTION,
        query_vector=query_vec,
        limit=top_k,
        query_filter=Filter(must=[
            FieldCondition(key="patient_id", match=MatchValue(value=patient_id))
        ])
    )
    return [{"text": r.payload["text"], "score": r.score, 
             "doc_type": r.payload.get("doc_type")} for r in results]

def _chunk_text(text: str, size: int, overlap: int) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i:i+size]))
        i += size - overlap
    return chunks
```

```python
# ESAP.AI/routers/analyze.py
from fastapi import APIRouter, HTTPException
from models.schemas import AnalyzeRequest, AnalysisResponse
from services.claude_client import analyze_visit
from services.vector_store import search
import httpx, os

router = APIRouter()

@router.post("/{visit_id}", response_model=AnalysisResponse)
async def analyze(visit_id: str, req: AnalyzeRequest):
    """Full clinical AI analysis for a visit. Called by .NET API."""
    
    # 1. Retrieve RAG context from patient's vector store
    symptom_query = f"{req.chief_complaint} {req.symptom_description}"
    rag_chunks = search(req.patient_id, symptom_query, top_k=5)
    rag_context = "\n\n".join([f"[{c['doc_type']}] {c['text']}" 
                                for c in rag_chunks])
    
    # 2. Build symptoms dict
    symptoms = {
        "chief_complaint": req.chief_complaint,
        "description":     req.symptom_description,
        "onset_type":      req.onset_type,
        "duration":        req.duration,
        "pain_scale":      req.pain_scale,
        "location":        req.symptom_location,
        "associated_symptoms": req.associated_symptoms,
        "self_treatment":  req.self_treatment,
        "rag_context":     rag_context,
    }
    
    # 3. Call Claude with prompt caching
    try:
        result = analyze_visit(req.patient_context, symptoms)
        result["visitId"] = visit_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
```

```python
# ESAP.AI/services/whisper_service.py
import whisper
import tempfile, os

_model = None

def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("medium.en")  # medical English
    return _model

def transcribe_audio(audio_bytes: bytes, language: str = "en") -> dict:
    """Transcribe consultation audio. Returns transcript + detected language."""
    model = get_model()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        result = model.transcribe(tmp_path, language=language, 
                                   word_timestamps=True)
        return {
            "text":     result["text"],
            "language": result["language"],
            "segments": result["segments"]   # timestamps per sentence
        }
    finally:
        os.unlink(tmp_path)
```

---

### 3.2 AI Service — .NET Side

```csharp
// Services/AIService.cs
public class AIService(HttpClient http, AppDbContext db) : IAIService
{
    public async Task<AIAnalysisResult> AnalyzeVisitAsync(Guid visitId)
    {
        var visit   = await db.Visits.Include(v => v.Patient).FirstOrDefaultAsync(v => v.VisitId == visitId)
                      ?? throw new KeyNotFoundException($"Visit {visitId} not found");
        var patient = await BuildPatientContextAsync(visit.PatientId);

        var payload = new {
            visit_id           = visitId,
            patient_id         = visit.PatientId,
            patient_context    = patient,
            chief_complaint    = visit.ChiefComplaint,
            symptom_description= visit.SymptomDescription,
            onset_type         = visit.OnsetType,
            duration           = visit.Duration,
            pain_scale         = visit.PainScale,
            symptom_location   = visit.SymptomLocation,
            associated_symptoms= visit.AssociatedSymptoms,
            self_treatment     = visit.SelfTreatment,
        };

        var response = await http.PostAsJsonAsync($"/analyze/{visitId}", payload);
        response.EnsureSuccessStatusCode();

        var aiResult = await response.Content.ReadFromJsonAsync<AIAnalysisResult>()
                       ?? throw new Exception("Empty AI response");
        aiResult.VisitId   = visitId;
        aiResult.PatientId = visit.PatientId;

        // Update visit status
        visit.Status = "ai_processed";
        db.AIResults.Add(aiResult);
        await db.SaveChangesAsync();

        // Generate health alerts
        await GenerateAlertsFromFlagsAsync(aiResult);

        return aiResult;
    }

    private async Task<object> BuildPatientContextAsync(Guid patientId)
    {
        var p = await db.Patients
            .Include(p => p.MedicalHistory)
            .Include(p => p.Medications.Where(m => m.IsActive))
            .Include(p => p.Allergies.Where(a => a.IsActive))
            .Include(p => p.Lifestyle)
            .Include(p => p.FamilyHistory)
            .FirstOrDefaultAsync(p => p.PatientId == patientId)
            ?? throw new KeyNotFoundException();

        return new {
            patient_id        = patientId,
            full_name         = p.FullName,
            age               = DateTime.Today.Year - p.DateOfBirth.Year,
            biological_sex    = p.BiologicalSex,
            blood_group       = p.BloodGroup,
            bmi               = p.WeightKg / Math.Pow((double)(p.HeightCm / 100), 2),
            chronic_conditions= JsonSerializer.Deserialize<string[]>(
                                    p.MedicalHistory?.ChronicConditions ?? "[]"),
            medications       = p.Medications.Select(m => new {
                                    m.DrugName, m.Dosage, m.Frequency }),
            allergies         = p.Allergies.Select(a => new {
                                    a.Substance, a.Severity, a.ReactionType }),
            sleep_hours       = p.Lifestyle?.SleepHours,
            stress_level      = p.Lifestyle?.StressLevel,
            smoking_status    = p.Lifestyle?.SmokingStatus,
            exercise_frequency= p.Lifestyle?.ExerciseFrequency,
            family_history    = p.FamilyHistory.Select(f => new {
                                    f.Condition, f.AffectedRelatives }),
        };
    }
}
```

---

## 4. Phase 3 — Clinical Dashboard & Doctor Decision API

**Goal:** Doctor interface endpoints, flag review, diagnosis submission  
**Timeline:** Weeks 9–12

---

### 4.1 Doctor Controller

```csharp
// Controllers/DoctorController.cs
[ApiController]
[Route("api/doctor")]
[Authorize(Policy = "DoctorOnly")]
public class DoctorController(IDoctorService svc) : ControllerBase
{
    // GET /api/doctor/queue  — today's patients
    [HttpGet("queue")]
    public async Task<IActionResult> Queue()
        => Ok(await svc.GetTodayQueueAsync());

    // GET /api/doctor/patient/{id}/brief  — AI pre-visit brief
    [HttpGet("patient/{patientId:guid}/brief")]
    public async Task<IActionResult> Brief(Guid patientId)
        => Ok(await svc.GetPreVisitBriefAsync(patientId));

    // POST /api/doctor/decisions
    [HttpPost("decisions")]
    public async Task<IActionResult> SubmitDecision([FromBody] DoctorDecisionRequest req)
    {
        var decision = await svc.SubmitDecisionAsync(req);
        // Async: capture RLHF feedback delta
        BackgroundJob.Enqueue<RlhfCaptureJob>(j => j.CaptureAsync(decision.DecisionId));
        return CreatedAtAction(nameof(GetDecision), new { id = decision.DecisionId }, decision);
    }

    // GET /api/doctor/decisions/{id}
    [HttpGet("decisions/{id:guid}")]
    public async Task<IActionResult> GetDecision(Guid id)
        => Ok(await svc.GetDecisionAsync(id));

    // PUT /api/doctor/decisions/{id}  — amend
    [HttpPut("decisions/{id:guid}")]
    public async Task<IActionResult> AmendDecision(Guid id, [FromBody] DoctorDecisionRequest req)
        => Ok(await svc.AmendDecisionAsync(id, req));
}
```

### 4.2 RLHF Capture Logic

```csharp
// Background/RlhfCaptureJob.cs
public class RlhfCaptureJob(AppDbContext db)
{
    public async Task CaptureAsync(Guid decisionId)
    {
        var decision = await db.DoctorDecisions
            .Include(d => d.Visit).ThenInclude(v => v.AIResults)
            .FirstOrDefaultAsync(d => d.DecisionId == decisionId);
        if (decision is null) return;

        var aiResult = decision.Visit.AIResults.OrderByDescending(r => r.GeneratedAt).First();

        // Compute quality score: higher if doctor accepted all AI flags & diagnosis was similar
        var flagReviews = JsonSerializer.Deserialize<List<FlagReviewDto>>(decision.FlagReviews ?? "[]")!;
        var acceptedCount = flagReviews.Count(f => f.Decision == "accept");
        var qualityScore  = flagReviews.Count > 0
            ? (double)acceptedCount / flagReviews.Count * 0.7 + 0.3
            : 0.5;

        // Build the diagnosis delta
        var aiFlags = JsonSerializer.Deserialize<List<AiFlagDto>>(aiResult.Flags ?? "[]")!;
        var delta = new {
            ai_risk_level  = aiResult.RiskLevel,
            doctor_diagnosis = decision.PrimaryDiagnosis,
            ai_flags_count = aiFlags.Count,
            accepted       = flagReviews.Count(f => f.Decision == "accept"),
            modified       = flagReviews.Count(f => f.Decision == "modify"),
            dismissed      = flagReviews.Count(f => f.Decision == "dismiss"),
        };

        db.AIFeedbacks.Add(new AIFeedback {
            ResultId       = aiResult.ResultId,
            DecisionId     = decision.DecisionId,
            VisitId        = decision.VisitId,
            FlagReviews    = decision.FlagReviews,
            DiagnosisDelta = JsonSerializer.Serialize(delta),
            QualityScore   = (decimal)qualityScore,
        });
        await db.SaveChangesAsync();
    }
}
```

---

## 5. Phase 4 — Full Registration API & Document Pipeline

**Goal:** 10-section wizard API, document upload, OCR, drug checks  
**Timeline:** Weeks 11–14

---

### 5.1 Registration Flow — Full Transaction

```csharp
// Services/PatientService.cs (CreateAsync)
public async Task<PatientProfileDto> CreateAsync(CreatePatientRequest req)
{
    await using var tx = await db.Database.BeginTransactionAsync();
    try
    {
        // Generate unique external ID
        var externalId = $"ESAP-{GenerateShortId()}";

        // 1. Core patient record
        var patient = mapper.Map<Patient>(req);
        patient.ExternalId = externalId;
        db.Patients.Add(patient);
        await db.SaveChangesAsync();

        // 2. All sections in the same transaction
        if (req.Contact   is not null) await UpsertContactAsync(patient.PatientId, req.Contact);
        if (req.History   is not null) await UpsertMedicalHistoryAsync(patient.PatientId, req.History);
        if (req.Medications is not null) await UpsertMedicationsAsync(patient.PatientId, req.Medications);
        if (req.Allergies is not null) await UpsertAllergiesAsync(patient.PatientId, req.Allergies);
        if (req.Lifestyle is not null) await UpsertLifestyleAsync(patient.PatientId, req.Lifestyle);
        if (req.Family    is not null) await UpsertFamilyHistoryAsync(patient.PatientId, req.Family);
        if (req.Insurance is not null) await UpsertInsuranceAsync(patient.PatientId, req.Insurance);
        if (req.Consent   is not null) await UpsertConsentAsync(patient.PatientId, req.Consent);

        await tx.CommitAsync();

        return mapper.Map<PatientProfileDto>(patient);
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}

private static string GenerateShortId()
{
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var bytes = RandomNumberGenerator.GetBytes(8);
    return new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
}
```

---

### 5.2 Document Upload Controller

```csharp
// Controllers/DocumentsController.cs
[ApiController]
[Route("api/patients/{patientId:guid}/documents")]
[Authorize]
public class DocumentsController(IDocumentService svc) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(20 * 1024 * 1024)]  // 20 MB
    public async Task<IActionResult> Upload(Guid patientId, 
        [FromForm] IFormFileCollection files, [FromForm] string documentType)
    {
        var results = new List<DocumentUploadResult>();
        foreach (var file in files)
        {
            // Validate: only PDF, JPG, PNG, DICOM
            var allowed = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".dcm" };
            var ext = Path.GetExtension(file.FileName).ToLower();
            if (!allowed.Contains(ext))
                return BadRequest($"File type {ext} not allowed");

            var result = await svc.UploadAsync(patientId, file, documentType);
            results.Add(result);

            // Queue OCR + RAG indexing (async, non-blocking)
            BackgroundJob.Enqueue<OcrProcessingJob>(
                j => j.ProcessAsync(result.DocumentId));
        }
        return Ok(results);
    }
}
```

```csharp
// Background/OcrProcessingJob.cs
public class OcrProcessingJob(AppDbContext db, IAIService ai, IBlobService blob)
{
    public async Task ProcessAsync(Guid documentId)
    {
        var doc = await db.PatientDocuments.FindAsync(documentId);
        if (doc is null || doc.IsProcessed) return;

        // 1. Download from blob
        var bytes = await blob.DownloadAsync(doc.BlobUrl);

        // 2. Extract text via Python AI service
        var ocrText = await ai.ExtractTextAsync(bytes, doc.MimeType);
        if (string.IsNullOrWhiteSpace(ocrText)) { doc.IsProcessed = true; await db.SaveChangesAsync(); return; }

        // 3. Store OCR text
        doc.OcrText = ocrText;

        // 4. Index into Qdrant
        var chunkIds = await ai.IndexDocumentAsync(
            doc.PatientId.ToString(), documentId.ToString(), ocrText,
            new { doc_type = doc.DocumentType, file_name = doc.OriginalFileName });
        doc.QdrantChunkIds = JsonSerializer.Serialize(chunkIds);

        // 5. Mark as processed
        doc.IsProcessed  = true;
        doc.ProcessedAt  = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
}
```

---

### 5.3 Drug Interaction Check

```csharp
// Services/DrugInteractionService.cs
public class DrugInteractionService(AppDbContext db, HttpClient http) : IDrugInteractionService
{
    // Uses the RxNorm API (free, public)
    private const string RxNormBase = "https://rxnav.nlm.nih.gov/REST";

    public async Task<List<DrugInteractionDto>> CheckAsync(Guid patientId)
    {
        var meds = await db.Medications
            .Where(m => m.PatientId == patientId && m.IsActive)
            .ToListAsync();

        if (meds.Count < 2) return [];

        // 1. Resolve drug names to RxCUI codes
        var rxcuis = new List<string>();
        foreach (var med in meds)
        {
            var response = await http.GetFromJsonAsync<RxNormSearchResult>(
                $"{RxNormBase}/rxcui.json?name={Uri.EscapeDataString(med.DrugName)}&search=1");
            var cui = response?.IdGroup?.RxNormId?.FirstOrDefault();
            if (cui is not null) rxcuis.Add(cui);
        }

        if (rxcuis.Count < 2) return [];

        // 2. Check interactions
        var cuiList = string.Join("+", rxcuis);
        var interactions = await http.GetFromJsonAsync<RxNormInteractionResult>(
            $"{RxNormBase}/interaction/list.json?rxcuis={cuiList}");

        return interactions?.FullInteractionTypeGroup
            ?.SelectMany(g => g.FullInteractionType)
            ?.Select(i => new DrugInteractionDto {
                Drug1       = i.MinConceptItem[0].Name,
                Drug2       = i.MinConceptItem[1].Name,
                Severity    = i.InteractionPair[0].Severity,
                Description = i.InteractionPair[0].Description,
            })
            ?.ToList() ?? [];
    }
}
```

---

## 6. Phase 5 — RLHF Feedback Loop & Model Improvement

**Goal:** Continuous learning pipeline, training data export  
**Timeline:** Weeks 13–16

---

### 6.1 RLHF Export Job

```csharp
// Background/RlhfExportJob.cs
public class RlhfExportJob(AppDbContext db, IBlobService blob, ILogger<RlhfExportJob> log)
{
    public async Task Execute()
    {
        var batch = await db.AIFeedbacks
            .Include(f => f.Result)
            .Include(f => f.Decision)
            .Where(f => !f.UsedForTraining && f.QualityScore >= 0.7m)
            .Take(500)
            .ToListAsync();

        if (!batch.Any()) return;

        var batchId   = $"batch_{DateTime.UtcNow:yyyyMMdd_HHmmss}";
        var sb        = new StringBuilder();

        foreach (var fb in batch)
        {
            // Compose a training record in JSONL format
            var record = new {
                prompt = new {
                    patient_context = fb.Result.PatientId,
                    visit_symptoms  = fb.Result.VisitId,
                },
                ai_output = new {
                    risk_score   = fb.Result.RiskScore,
                    risk_level   = fb.Result.RiskLevel,
                    summary      = fb.Result.Summary,
                    flags        = JsonSerializer.Deserialize<object>(fb.Result.Flags ?? "[]"),
                },
                human_correction = new {
                    flag_reviews   = JsonSerializer.Deserialize<object>(fb.FlagReviews ?? "[]"),
                    diagnosis      = fb.Decision.PrimaryDiagnosis,
                    icd_code       = fb.Decision.IcdCode,
                    clinical_notes = fb.Decision.ClinicalNotes,
                    delta          = JsonSerializer.Deserialize<object>(fb.DiagnosisDelta ?? "{}"),
                },
                quality_score = fb.QualityScore,
                timestamp     = fb.CreatedAt,
            };
            sb.AppendLine(JsonSerializer.Serialize(record));
        }

        // Upload JSONL to blob storage
        var blobName = $"training-data/{DateTime.UtcNow:yyyy-MM-dd}/{batchId}.jsonl";
        await blob.UploadTextAsync(blobName, sb.ToString());

        // Mark as used
        var ids = batch.Select(f => f.FeedbackId).ToList();
        await db.AIFeedbacks
            .Where(f => ids.Contains(f.FeedbackId))
            .ExecuteUpdateAsync(s => s
                .SetProperty(f => f.UsedForTraining, true)
                .SetProperty(f => f.TrainingBatchId, batchId));

        log.LogInformation("RLHF export: {Count} records → {Blob}", batch.Count, blobName);
    }
}
```

### 6.2 Prompt Improvement Workflow

| Stage | Records Needed | Action |
|---|---|---|
| **Level 1 — Prompt tuning** | 10+ | Manually review top dismissals, improve system prompt |
| **Level 2 — Few-shot examples** | 50+ | Add corrected examples to Claude system prompt |
| **Level 3 — RAG enhancement** | 100+ | Re-embed docs with improved chunking strategy |
| **Level 4 — Fine-tuning** | 1,000+ | Submit JSONL to Anthropic fine-tune API |
| **Level 5 — Custom model** | 10,000+ | Domain-specific model training |

---

## 7. Phase 6 — EHR Integration & Extended Features

**Goal:** HL7 FHIR R4, multi-language, bulk onboarding  
**Timeline:** Weeks 15–18

---

### 7.1 FHIR R4 Endpoints

```csharp
// Controllers/FhirController.cs
[ApiController]
[Route("api/fhir/R4")]
[Authorize(Policy = "StaffOnly")]
public class FhirController(IFhirService fhir) : ControllerBase
{
    // Import a Patient resource from external EHR
    [HttpPost("Patient")]
    public async Task<IActionResult> ImportPatient([FromBody] JsonElement fhirPatient)
        => Ok(await fhir.ImportPatientResourceAsync(fhirPatient));

    // Export a patient as FHIR Patient resource
    [HttpGet("Patient/{esapId}")]
    public async Task<IActionResult> ExportPatient(string esapId)
        => Ok(await fhir.ExportPatientResourceAsync(esapId));

    // Import MedicationRequest bundle
    [HttpPost("Bundle")]
    public async Task<IActionResult> ImportBundle([FromBody] JsonElement bundle)
        => Ok(await fhir.ImportBundleAsync(bundle));
}
```

**FHIR Resource Mapping:**

| FHIR Resource | ESAP Table | Key Fields |
|---|---|---|
| `Patient` | `Patients` | name, birthDate, gender, identifier |
| `Condition` | `MedicalHistory` | code (ICD-10), onsetDateTime, subject |
| `MedicationRequest` | `Medications` | medicationCodeableConcept, dosage |
| `AllergyIntolerance` | `Allergies` | code, reaction.severity, verificationStatus |
| `Observation` | `Visits` | code (LOINC), valueQuantity (labs/vitals) |
| `DocumentReference` | `PatientDocuments` | type, content.attachment, subject |
| `Appointment` | `Appointments` | start, participant, serviceType |

---

### 7.2 Multi-Language Middleware

```csharp
// Middleware/LanguageMiddleware.cs
public class LanguageMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        // Auto-detect from Accept-Language header or patient preference
        var lang = ctx.Request.Headers["Accept-Language"].FirstOrDefault()?.Split(',')[0]
                   ?? "en";
        ctx.Items["Language"] = lang;
        Thread.CurrentThread.CurrentCulture = new CultureInfo(lang);
        Thread.CurrentThread.CurrentUICulture = new CultureInfo(lang);
        await next(ctx);
    }
}
```

---

## 8. Phase 7 — Patient App Backend

**Goal:** Patient-scoped API, AI chat streaming, alerts, adherence  
**Timeline:** Weeks 17–20

---

### 8.1 Patient App Controller

```csharp
// Controllers/PatientAppController.cs
[ApiController]
[Route("api/patient-app")]
[Authorize(Policy = "PatientOnly")]
public class PatientAppController(IPatientAppService svc, IAIService ai) : ControllerBase
{
    private Guid CurrentPatientId =>
        Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
        => Ok(await svc.GetProfileSummaryAsync(CurrentPatientId));

    [HttpGet("health-metrics")]
    public async Task<IActionResult> HealthMetrics()
        => Ok(await svc.GetHealthMetricsAsync(CurrentPatientId));

    [HttpGet("medications")]
    public async Task<IActionResult> Medications()
        => Ok(await svc.GetMedicationsAsync(CurrentPatientId));

    [HttpPut("medications/{id:guid}/adherence")]
    public async Task<IActionResult> LogAdherence(Guid id, [FromBody] AdherenceRequest req)
    {
        await svc.LogAdherenceAsync(CurrentPatientId, id, req.Taken);
        return NoContent();
    }

    [HttpGet("alerts")]
    public async Task<IActionResult> Alerts()
        => Ok(await svc.GetActiveAlertsAsync(CurrentPatientId));

    [HttpPost("alerts/{id:guid}/dismiss")]
    public async Task<IActionResult> DismissAlert(Guid id)
    {
        await svc.DismissAlertAsync(CurrentPatientId, id);
        return NoContent();
    }

    [HttpGet("appointments")]
    public async Task<IActionResult> Appointments()
        => Ok(await svc.GetAppointmentsAsync(CurrentPatientId));

    // ── Streaming AI Chat (Server-Sent Events) ────────────────────
    [HttpPost("chat")]
    public async Task Chat([FromBody] ChatRequest req, CancellationToken ct)
    {
        Response.ContentType  = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        var patientSummary = await svc.GetCondensedSummaryAsync(CurrentPatientId);

        await foreach (var chunk in ai.StreamChatAsync(patientSummary, req.Message, ct))
        {
            await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { chunk })}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
        await Response.WriteAsync($"data: {JsonSerializer.Serialize(new { done = true })}\n\n", ct);
    }
}
```

```csharp
// Services/AIService.cs — Streaming chat
public async IAsyncEnumerable<string> StreamChatAsync(
    string patientSummary, string message,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    // Note: using Anthropic .NET SDK streaming
    var stream = await anthropicClient.Messages.StreamAsync(new MessageCreateParams {
        Model    = "claude-haiku-4-5-20251001",   // fast for chat
        MaxTokens = 1024,
        System   = [
            new SystemBlock { 
                Text = $"You are ESAP, the patient's personal AI health assistant. Patient profile:\n{patientSummary}",
                CacheControl = new CacheControl { Type = CacheControlType.Ephemeral }
            }
        ],
        Messages = [new MessageParam { Role = "user", Content = message }]
    }, ct);

    await foreach (var evt in stream.WithCancellation(ct))
    {
        if (evt is ContentBlockDeltaEvent delta && delta.Delta is TextDelta text)
            yield return text.Text;
    }
}
```

---

## 9. Cross-Cutting: Security, Performance, Observability

---

### 9.1 HIPAA & GDPR Compliance

```csharp
// Middleware/AuditMiddleware.cs
public class AuditMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> PHI_PATHS = [
        "/api/patients", "/api/visits", "/api/doctor"
    ];

    public async Task InvokeAsync(HttpContext ctx, IAuditService audit)
    {
        var isPhi = PHI_PATHS.Any(p => ctx.Request.Path.StartsWithSegments(p));
        if (!isPhi) { await next(ctx); return; }

        // Capture request body for audit
        ctx.Request.EnableBuffering();
        var requestBody = await new StreamReader(ctx.Request.Body).ReadToEndAsync();
        ctx.Request.Body.Position = 0;

        await next(ctx);

        // Log to AuditLog table
        await audit.LogAsync(new AuditEntry {
            UserId     = ctx.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value,
            Action     = ctx.Request.Method switch {
                "POST" => "CREATE", "PUT" or "PATCH" => "UPDATE",
                "DELETE" => "DELETE", _ => "READ"
            },
            Resource   = ctx.Request.Path,
            IpAddress  = ctx.Connection.RemoteIpAddress?.ToString(),
            UserAgent  = ctx.Request.Headers.UserAgent,
            Timestamp  = DateTime.UtcNow,
        });
    }
}
```

### 9.2 Redis Caching Strategy

```csharp
// Services/CacheService.cs
public class CacheService(IConnectionMultiplexer redis)
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<T?> GetOrSetAsync<T>(string key, Func<Task<T>> factory, 
        TimeSpan? ttl = null) where T : class
    {
        var cached = await _db.StringGetAsync(key);
        if (cached.HasValue)
            return JsonSerializer.Deserialize<T>(cached!);

        var value = await factory();
        await _db.StringSetAsync(key, JsonSerializer.Serialize(value), ttl ?? TimeSpan.FromMinutes(5));
        return value;
    }

    // Patient profile  : 5 min TTL (changes rarely within a session)
    public string PatientKey(Guid id)    => $"patient:{id}";
    // AI analysis result: 30 min TTL  (immutable once generated)
    public string AIResultKey(Guid id)   => $"ai_result:{id}";
    // Doctor queue      : 1 min TTL   (changes frequently)
    public string DoctorQueueKey(Guid id)=> $"doctor_queue:{id}:{DateTime.UtcNow:yyyyMMddHH}";
}
```

### 9.3 Performance Indexes & Query Optimizations

```sql
-- High-frequency query optimization

-- Doctor queue: visits opened today awaiting review
CREATE INDEX IX_Visits_Status_Date ON Visits(Status, VisitDate)
    INCLUDE (PatientId, DoctorId, ChiefComplaint);

-- AI analysis lookup by visit
CREATE INDEX IX_AIResults_VisitId_Date ON AIAnalysisResults(VisitId, GeneratedAt DESC)
    INCLUDE (RiskScore, RiskLevel, Summary);

-- Allergy lookup for drug interaction check
CREATE INDEX IX_Allergies_PatientId_Type ON Allergies(PatientId, AllergyType)
    WHERE IsActive = 1;

-- Active medications for patient
CREATE INDEX IX_Meds_PatientId_Active ON Medications(PatientId)
    WHERE IsActive = 1;

-- Unprocessed documents for OCR worker
CREATE INDEX IX_Docs_Unprocessed ON PatientDocuments(IsProcessed, UploadedAt)
    WHERE IsProcessed = 0;

-- Unexported RLHF feedback
CREATE INDEX IX_Feedback_Export ON AIFeedback(UsedForTraining, QualityScore, CreatedAt)
    WHERE UsedForTraining = 0;

-- Audit log access pattern
CREATE INDEX IX_Audit_Patient_Ts ON AuditLog(PatientId, Timestamp DESC);
```

---

## 10. Infrastructure & DevOps

---

### 10.1 `docker-compose.yml`

```yaml
version: "3.9"
services:

  esap-api:
    build: ./ESAP.API
    ports: ["5000:8080"]
    environment:
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__DefaultConnection: "${SQL_CONNECTION}"
      ConnectionStrings__Redis: "redis:6379"
      AI__ServiceUrl: "http://esap-ai:8000"
      Jwt__Key: "${JWT_SECRET}"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
    depends_on: [redis, qdrant]

  esap-ai:
    build: ./ESAP.AI
    ports: ["8000:8000"]
    environment:
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
      QDRANT_HOST: "qdrant"
      QDRANT_PORT: "6333"
    volumes:
      - whisper-models:/root/.cache/whisper
    depends_on: [qdrant]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis-data:/data]
    command: redis-server --appendonly yes

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333", "6334:6334"]
    volumes: [qdrant-data:/qdrant/storage]

volumes:
  redis-data:
  qdrant-data:
  whisper-models:
```

### 10.2 `.env` (development)

```bash
# Database — NEVER commit real credentials
SQL_CONNECTION="data source=176.9.16.194,1433; initial catalog=Healthcare-MIMIC-IV; User Id=sa; Password=Esap.12.Three; MultipleActiveResultSets=True; TrustServerCertificate=True; Encrypt=False"

# Secrets
JWT_SECRET="generate-a-256-bit-random-key-here"
ANTHROPIC_API_KEY="sk-ant-..."

# Azure (production)
AZURE_BLOB_CONNECTION=""
AZURE_KEY_VAULT_URL=""
```

### 10.3 GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: ESAP CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: "8.0.x" }
      - run: dotnet restore ESAP.API
      - run: dotnet build  ESAP.API --no-restore
      - run: dotnet test   ESAP.Tests --no-build --verbosity normal
      - run: dotnet publish ESAP.API -c Release -o ./publish

  build-ai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r ESAP.AI/requirements.txt
      - run: pytest ESAP.AI/tests/ -v

  docker:
    needs: [build-api, build-ai]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          docker build -t ghcr.io/esap/api:${{ github.sha }} ./ESAP.API
          docker build -t ghcr.io/esap/ai:${{ github.sha }}  ./ESAP.AI
          docker push ghcr.io/esap/api:${{ github.sha }}
          docker push ghcr.io/esap/ai:${{ github.sha }}
```

---

## 11. Testing Strategy

---

### 11.1 Unit Tests

```csharp
// ESAP.Tests/Unit/PatientServiceTests.cs
public class PatientServiceTests
{
    [Fact]
    public async Task CreateAsync_ValidRequest_ReturnsPatientWithExternalId()
    {
        // Arrange
        var db  = TestDbContextFactory.Create();
        var svc = new PatientService(db, new TestMapper());
        var req = new CreatePatientRequest {
            FullName      = "Jane Smith",
            DateOfBirth   = new DateOnly(1990, 5, 15),
            BiologicalSex = "female",
            BloodGroup    = "A+",
        };

        // Act
        var result = await svc.CreateAsync(req);

        // Assert
        result.ExternalId.Should().StartWith("ESAP-");
        result.FullName.Should().Be("Jane Smith");
        db.Patients.Should().HaveCount(1);
    }

    [Fact]
    public async Task CreateAsync_MissingRequiredField_ThrowsValidationException()
    {
        var db  = TestDbContextFactory.Create();
        var svc = new PatientService(db, new TestMapper());
        var req = new CreatePatientRequest { /* missing FullName */ };

        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
    }
}
```

### 11.2 Integration Tests

```csharp
// ESAP.Tests/Integration/PatientApiTests.cs
public class PatientApiTests(WebApplicationFactory<Program> factory) 
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task POST_patients_Returns201_WithValidData()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GetTestToken("doctor"));

        var payload = new {
            fullName      = "Test Patient",
            dateOfBirth   = "1985-03-20",
            biologicalSex = "male",
            bloodGroup    = "B+"
        };

        var response = await client.PostAsJsonAsync("/api/patients", payload);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<PatientProfileDto>();
        body!.ExternalId.Should().StartWith("ESAP-");
    }

    [Fact]
    public async Task POST_patients_Returns401_WhenUnauthenticated()
    {
        var client   = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/patients", new { });
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
```

### 11.3 Test Coverage Targets

| Layer | Target | Tool |
|---|---|---|
| Service layer | > 85% | xUnit + Moq |
| Controller layer | > 70% | Integration tests |
| AI prompts | Manual | Prompt evaluation notebook |
| DB migrations | 100% | Always run migrations in CI |
| API contracts | 100% | OpenAPI schema validation |

---

## 12. Timeline & Milestones

```
WEEK  1   ┤ Project setup, .NET solution, DB connection, migrations
WEEK  2   ┤ Auth (login/JWT/refresh), Users table, role middleware
WEEK  3   ┤ Patients CRUD, PatientContact, MedicalHistory sections
WEEK  4   ┤ Medications, Allergies, Lifestyle, FamilyHistory, Consent
───────── ┤ CHECKPOINT: Registration form fully backed (Phase 1 ✓)
WEEK  5   ┤ Python AI service scaffold, FastAPI, Claude API integration
WEEK  6   ┤ Embedder (PubMedBERT), Qdrant setup, chunk + index pipeline
WEEK  7   ┤ Symptom analysis endpoint, RAG retrieval wired up
WEEK  8   ┤ History summarization, risk scoring, AI result persistence
───────── ┤ CHECKPOINT: AI analysis returns real results (Phase 2 ✓)
WEEK  9   ┤ Doctor queue endpoint, pre-visit brief, AI brief assembly
WEEK 10   ┤ Doctor decision submit, flag review, treatment plan storage
WEEK 11   ┤ RLHF capture job, feedback delta computation, quality score
WEEK 12   ┤ Clinical dashboard endpoints wired to Next.js frontend
───────── ┤ CHECKPOINT: Full doctor workflow live (Phase 3 ✓)
WEEK 13   ┤ Document upload (multipart), blob storage, OCR background job
WEEK 14   ┤ Qdrant indexing from OCR text, drug interaction (RxNorm)
───────── ┤ CHECKPOINT: Registration + document pipeline (Phase 4 ✓)
WEEK 15   ┤ RLHF hourly export job, JSONL format, blob upload
WEEK 16   ┤ Quality scoring, training batch management
───────── ┤ CHECKPOINT: Feedback loop running (Phase 5 ✓)
WEEK 17   ┤ FHIR R4 Patient + Condition import, resource mapping
WEEK 18   ┤ Multi-language middleware, bulk registration endpoint
───────── ┤ CHECKPOINT: EHR integration (Phase 6 ✓)
WEEK 19   ┤ Patient app API: profile, metrics, medications, adherence
WEEK 20   ┤ SSE streaming chat (Claude Haiku), alert engine job
───────── ┤ CHECKPOINT: Patient app fully backed (Phase 7 ✓)
WEEK 21   ┤ Security audit, penetration test, OWASP checklist
WEEK 22   ┤ Load testing (k6), production hardening, Azure deployment
───────── ┤ PRODUCTION LAUNCH ✓
```

---

## Immediate Next Steps (Start Today)

```bash
# 1. Create .NET solution
dotnet new sln -n ESAP
dotnet new webapi -n ESAP.API --use-controllers
dotnet sln add ESAP.API

# 2. Add packages
cd ESAP.API && dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer

# 3. Configure DB connection in appsettings.json
#    Use the Healthcare-MIMIC-IV connection string above

# 4. Add AppDbContext.cs and run first migration
dotnet ef migrations add InitialCreate
dotnet ef database update

# 5. Scaffold Auth controller, test login returns JWT

# 6. Scaffold Patients controller, test POST /api/patients

# 7. Create Python venv for AI service
cd ../ESAP.AI && python -m venv venv && pip install fastapi anthropic
#    Test: uvicorn main:app --reload
#    Verify /analyze/{visitId} returns mock analysis

# 8. Wire Next.js survey-demo → /api/patients POST on registration submit
```

---

## 13. Python AI Service — Full Stack Detail

This section documents every file in `ESAP.AI/` with complete, runnable code.

---

### 13.1 Full Directory Structure

```
ESAP.AI/
├── main.py                        ← FastAPI app entry point
├── config.py                      ← Pydantic settings (env vars)
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── .env.example
│
├── routers/
│   ├── __init__.py
│   ├── analyze.py                 ← POST /analyze/{visit_id}
│   ├── summarize.py               ← POST /summarize/{patient_id}
│   ├── rag.py                     ← POST /rag/index, POST /rag/search
│   ├── speech.py                  ← POST /speech/transcribe, /speech/analyze
│   └── chat.py                    ← POST /chat (streaming SSE)
│
├── services/
│   ├── __init__.py
│   ├── claude_client.py           ← Anthropic SDK wrapper + prompt caching
│   ├── embedder.py                ← PubMedBERT sentence embeddings
│   ├── vector_store.py            ← Qdrant CRUD + search
│   ├── ocr_service.py             ← PDF/image → text (Tesseract + PyMuPDF)
│   ├── whisper_service.py         ← Audio → transcript (Whisper)
│   └── drug_checker.py            ← RxNorm API drug interaction check
│
├── models/
│   ├── __init__.py
│   └── schemas.py                 ← All Pydantic request/response models
│
├── prompts/
│   ├── symptom_analysis.txt       ← Full system prompt for visit analysis
│   ├── history_summary.txt        ← Patient history summarization prompt
│   ├── risk_scoring.txt           ← Risk stratification prompt
│   ├── conversation_analysis.txt  ← Speech session analysis prompt
│   └── patient_chat.txt           ← Personal health assistant prompt
│
├── middleware/
│   ├── __init__.py
│   └── auth.py                    ← API key verification (internal service auth)
│
├── utils/
│   ├── __init__.py
│   └── text_utils.py              ← Chunking, cleaning, de-identification
│
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_analyze.py
    ├── test_rag.py
    ├── test_summarize.py
    ├── test_speech.py
    └── test_schemas.py
```

---

### 13.2 `requirements.txt`

```txt
# ── Web framework ────────────────────────────────────────────────
fastapi==0.115.0
uvicorn[standard]==0.30.6
gunicorn==22.0.0
python-multipart==0.0.9

# ── Anthropic Claude SDK ─────────────────────────────────────────
anthropic==0.40.0

# ── Embeddings & NLP ─────────────────────────────────────────────
sentence-transformers==3.3.1
torch==2.5.1
transformers==4.46.3
numpy==1.26.4

# ── Vector database ───────────────────────────────────────────────
qdrant-client==1.12.1

# ── OCR & document processing ────────────────────────────────────
pytesseract==0.3.13
Pillow==11.0.0
PyMuPDF==1.24.13          # fitz — fast PDF text extraction

# ── Speech transcription ─────────────────────────────────────────
openai-whisper==20231117
soundfile==0.12.1
ffmpeg-python==0.2.0

# ── HTTP client ───────────────────────────────────────────────────
httpx==0.27.2

# ── Validation & settings ────────────────────────────────────────
pydantic==2.10.0
pydantic-settings==2.6.1

# ── Logging ───────────────────────────────────────────────────────
structlog==24.4.0

# ── SQL Server (direct DB access from Python if needed) ──────────
pyodbc==5.2.0
sqlalchemy==2.0.36
```

```txt
# requirements-dev.txt
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-cov==6.0.0
httpx==0.27.2            # async test client
fakeredis==2.26.1
respx==0.21.1            # mock httpx calls
```

---

### 13.3 `.env.example`

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Internal API key — .NET calls this to authenticate with Python service
INTERNAL_API_KEY=change-this-to-a-strong-secret

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=esap_patient_documents

# Whisper model size: tiny | base | small | medium | large
WHISPER_MODEL=medium.en

# Embedding model
EMBEDDING_MODEL=NeuML/pubmedbert-base-embeddings

# SQL Server (read-only replica for Python — optional)
SQL_SERVER=176.9.16.194,1433
SQL_DATABASE=Healthcare-MIMIC-IV
SQL_USER=sa
SQL_PASSWORD=Esap.12.Three

# Logging level
LOG_LEVEL=INFO

# Environment
ENVIRONMENT=development
```

---

### 13.4 `config.py`

```python
# ESAP.AI/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic
    anthropic_api_key: str

    # Internal auth
    internal_api_key: str = "dev-secret"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "esap_patient_documents"

    # Models
    whisper_model: str = "medium.en"
    embedding_model: str = "NeuML/pubmedbert-base-embeddings"
    embedding_dim: int = 768         # PubMedBERT output dimension

    # Claude models per use case
    claude_analysis_model: str  = "claude-sonnet-4-6"
    claude_summary_model: str   = "claude-sonnet-4-6"
    claude_chat_model: str      = "claude-haiku-4-5-20251001"
    claude_max_tokens: int      = 2048
    claude_chat_max_tokens: int = 1024

    # SQL Server (optional — Python direct access)
    sql_server: str   = "176.9.16.194,1433"
    sql_database: str = "Healthcare-MIMIC-IV"
    sql_user: str     = "sa"
    sql_password: str = ""

    # App
    log_level: str    = "INFO"
    environment: str  = "development"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

### 13.5 `main.py` — Complete Entry Point

```python
# ESAP.AI/main.py
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routers import analyze, summarize, rag, speech, chat
from services.embedder import warm_up_embedder
from services.vector_store import ensure_collection
from services.whisper_service import warm_up_whisper

log = structlog.get_logger()
settings = get_settings()

# ── Lifespan: warm up heavy models on startup ─────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("esap_ai.startup", env=settings.environment)
    warm_up_embedder()        # load PubMedBERT into memory
    ensure_collection()       # create Qdrant collection if missing
    if settings.environment != "test":
        warm_up_whisper()     # load Whisper model (~500 MB)
    log.info("esap_ai.ready")
    yield
    log.info("esap_ai.shutdown")

app = FastAPI(
    title="ESAP AI Service",
    version="1.0.0",
    description="Clinical AI microservice — analysis, RAG, speech, chat",
    lifespan=lifespan,
)

# ── CORS: only allow the .NET API ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://esap-api:8080"],
    allow_methods=["GET", "POST"],
    allow_headers=["X-Internal-Key", "Content-Type"],
)

# ── Routers ────────────────────────────────────────────────────────
app.include_router(analyze.router,   prefix="/analyze",   tags=["Analysis"])
app.include_router(summarize.router, prefix="/summarize", tags=["Summary"])
app.include_router(rag.router,       prefix="/rag",       tags=["RAG"])
app.include_router(speech.router,    prefix="/speech",    tags=["Speech"])
app.include_router(chat.router,      prefix="/chat",      tags=["Chat"])

# ── Global error handler ──────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_error", path=str(request.url), error=str(exc))
    return JSONResponse(status_code=500,
        content={"success": False, "message": str(exc)})

# ── Health check ──────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "esap-ai", "version": "1.0.0"}
```

---

### 13.6 `middleware/auth.py` — Internal API Key Guard

```python
# ESAP.AI/middleware/auth.py
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from config import get_settings

_header = APIKeyHeader(name="X-Internal-Key", auto_error=False)

def require_internal_key(key: str = Security(_header)) -> str:
    """Dependency — verifies the request is from the .NET API, not the public."""
    settings = get_settings()
    if not key or key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal API key"
        )
    return key
```

---

### 13.7 `models/schemas.py` — All Pydantic Models

```python
# ESAP.AI/models/schemas.py
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

# ─── Shared sub-models ────────────────────────────────────────────

class MedicationItem(BaseModel):
    drug_name:  str
    dosage:     Optional[str] = None
    frequency:  Optional[str] = None

class AllergyItem(BaseModel):
    substance:     str
    severity:      Optional[str] = None
    reaction_type: Optional[str] = None

class FamilyHistoryItem(BaseModel):
    condition:         str
    affected_relatives: list[str] = []

class PatientContext(BaseModel):
    """Compact patient profile passed from .NET to Python for every AI call."""
    patient_id:          str
    full_name:           str
    age:                 int
    biological_sex:      str
    blood_group:         Optional[str]  = None
    bmi:                 Optional[float]= None
    chronic_conditions:  list[str]      = []
    medications:         list[MedicationItem] = []
    allergies:           list[AllergyItem]    = []
    sleep_hours:         Optional[float] = None
    stress_level:        Optional[int]   = None
    smoking_status:      Optional[str]   = None
    alcohol_consumption: Optional[str]   = None
    exercise_frequency:  Optional[str]   = None
    diet_type:           Optional[str]   = None
    family_history:      list[FamilyHistoryItem] = []
    mental_health_history: list[str]     = []
    cancer_history:      bool            = False
    pregnancy_status:    Optional[str]   = None

# ─── Analysis ────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    patient_id:          str
    patient_context:     PatientContext
    chief_complaint:     str
    symptom_description: Optional[str]  = None
    onset_type:          Optional[str]  = None
    duration:            Optional[str]  = None
    pain_scale:          Optional[int]  = Field(None, ge=0, le=10)
    symptom_location:    Optional[str]  = None
    associated_symptoms: list[str]      = []
    aggravating_factors: list[str]      = []
    relieving_factors:   list[str]      = []
    self_treatment:      Optional[str]  = None

class RiskFlag(BaseModel):
    id:       str
    label:    str
    severity: Literal["info", "warning", "critical"]
    detail:   str
    evidence: list[str] = []

class Recommendation(BaseModel):
    id:          str
    title:       str
    description: str
    priority:    Literal["routine", "soon", "urgent"]
    icon:        str = "💡"

class AnalysisResponse(BaseModel):
    visit_id:       str
    risk_score:     int     = Field(..., ge=0, le=100)
    risk_level:     Literal["low", "moderate", "high", "critical"]
    profile_label:  str
    summary:        str
    completion_pct: int
    flags:          list[RiskFlag]
    recommendations: list[Recommendation]
    model_version:  str
    prompt_tokens:  int = 0
    output_tokens:  int = 0
    generated_at:   datetime = Field(default_factory=datetime.utcnow)

# ─── Summarization ───────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    patient_context: PatientContext
    include_visits:  bool = True
    max_visits:      int  = 10

class SummaryResponse(BaseModel):
    patient_id:       str
    one_liner:        str            # single sentence for quick display
    detailed_summary: str            # 3-5 paragraphs for doctor brief
    key_conditions:   list[str]
    active_alerts:    list[str]
    last_visit_note:  Optional[str]  = None
    generated_at:     datetime       = Field(default_factory=datetime.utcnow)

# ─── RAG ─────────────────────────────────────────────────────────

class IndexDocumentRequest(BaseModel):
    patient_id:    str
    doc_id:        str
    text:          str
    doc_type:      str  = "unknown"
    file_name:     Optional[str] = None
    uploaded_at:   Optional[str] = None

class IndexDocumentResponse(BaseModel):
    doc_id:      str
    chunk_count: int
    chunk_ids:   list[str]

class SearchRequest(BaseModel):
    patient_id: str
    query:      str
    top_k:      int = Field(5, ge=1, le=20)

class SearchChunk(BaseModel):
    text:     str
    score:    float
    doc_type: str
    doc_id:   str

class SearchResponse(BaseModel):
    query:   str
    chunks:  list[SearchChunk]
    context: str              # pre-formatted string for injection into Claude

# ─── Speech ──────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    session_id:       str
    transcript_raw:   str
    transcript_clean: str
    language:         str
    duration_seconds: float
    segments:         list[dict] = []

class SpeechAnalysisRequest(BaseModel):
    session_id:   str
    patient_id:   str
    transcript:   str
    patient_context: PatientContext

class ClinicalEntity(BaseModel):
    type:  Literal["symptom","medication","diagnosis","allergy","procedure","vital"]
    value: str
    context: Optional[str] = None

class SpeechAnalysisResponse(BaseModel):
    session_id:        str
    clinical_entities: list[ClinicalEntity]
    doctor_concerns:   list[str]
    patient_concerns:  list[str]
    suggested_flags:   list[RiskFlag]
    ambient_note:      str            # auto-generated SOAP-style clinical note
    generated_at:      datetime = Field(default_factory=datetime.utcnow)

# ─── Chat ────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    patient_id:      str
    patient_context: PatientContext
    message:         str
    history:         list[ChatMessage] = []   # last N turns for context
```

---

### 13.8 `services/claude_client.py` — Full Implementation

```python
# ESAP.AI/services/claude_client.py
import json, anthropic, structlog
from pathlib import Path
from config import get_settings
from models.schemas import (
    PatientContext, AnalysisResponse, SummaryResponse,
    SpeechAnalysisResponse
)

log      = structlog.get_logger()
settings = get_settings()
_client  = None

def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client

def _load_prompt(name: str) -> str:
    return (Path(__file__).parent.parent / "prompts" / name).read_text()

# ── System prompt blocks ──────────────────────────────────────────

_BASE_SYSTEM = _load_prompt("symptom_analysis.txt")
_SUMMARY_SYSTEM = _load_prompt("history_summary.txt")
_SPEECH_SYSTEM  = _load_prompt("conversation_analysis.txt")
_CHAT_SYSTEM    = _load_prompt("patient_chat.txt")

def _build_patient_block(p: PatientContext) -> str:
    meds     = ", ".join(f"{m.drug_name} {m.dosage or ''}" for m in p.medications) or "None"
    allergies= ", ".join(f"{a.substance} ({a.severity})" for a in p.allergies) or "None"
    fh       = "; ".join(f"{f.condition} ({', '.join(f.affected_relatives)})"
                         for f in p.family_history) or "None reported"
    return f"""
## Registered Patient Profile
- ID: {p.patient_id}
- Name: {p.full_name} | Age: {p.age} | Sex: {p.biological_sex}
- Blood Group: {p.blood_group or 'Unknown'} | BMI: {p.bmi or 'Unknown'}
- Chronic Conditions: {', '.join(p.chronic_conditions) or 'None'}
- Active Medications: {meds}
- Known Allergies: {allergies}
- Mental Health History: {', '.join(p.mental_health_history) or 'None'}
- Cancer History: {'Yes' if p.cancer_history else 'No'}
- Pregnancy Status: {p.pregnancy_status or 'N/A'}
- Sleep: {p.sleep_hours or 'Unknown'} hrs | Stress: {p.stress_level or 'Unknown'}/10
- Smoking: {p.smoking_status or 'Unknown'} | Alcohol: {p.alcohol_consumption or 'Unknown'}
- Exercise: {p.exercise_frequency or 'Unknown'} | Diet: {p.diet_type or 'Unknown'}
- Family History: {fh}
""".strip()

# ── Visit Analysis ────────────────────────────────────────────────

def analyze_visit(
    visit_id: str,
    patient: PatientContext,
    symptoms: dict,
    rag_context: str
) -> AnalysisResponse:
    patient_block = _build_patient_block(patient)

    user_message = f"""
Analyze this patient visit. Return ONLY a valid JSON object matching this exact schema:
{{
  "risk_score": <integer 0-100>,
  "risk_level": "<low|moderate|high|critical>",
  "profile_label": "<one-line characterization>",
  "summary": "<3-5 sentence clinical narrative>",
  "completion_pct": <integer 0-100>,
  "flags": [
    {{
      "id": "<slug>",
      "label": "<short title>",
      "severity": "<info|warning|critical>",
      "detail": "<explanation with clinical reasoning>",
      "evidence": ["<source1>", "<source2>"]
    }}
  ],
  "recommendations": [
    {{
      "id": "<slug>",
      "title": "<action title>",
      "description": "<actionable detail>",
      "priority": "<routine|soon|urgent>",
      "icon": "<single emoji>"
    }}
  ]
}}

## Current Visit
- Chief Complaint: {symptoms.get('chief_complaint', 'Not provided')}
- Description: {symptoms.get('symptom_description', '')}
- Onset: {symptoms.get('onset_type', '')} — started {symptoms.get('duration', 'unknown')} ago
- Pain Scale: {symptoms.get('pain_scale', 'Not rated')}/10
- Location: {symptoms.get('symptom_location', '')}
- Associated: {', '.join(symptoms.get('associated_symptoms', []))}
- Aggravated by: {', '.join(symptoms.get('aggravating_factors', []))}
- Relieved by: {', '.join(symptoms.get('relieving_factors', []))}
- Self-treatment: {symptoms.get('self_treatment', 'None')}

## Retrieved Historical Context (RAG)
{rag_context or 'No prior records available for this patient.'}
"""

    client = get_client()
    resp = client.messages.create(
        model=settings.claude_analysis_model,
        max_tokens=settings.claude_max_tokens,
        system=[
            # Block 1: stable base system prompt → cached across all patients
            {"type": "text", "text": _BASE_SYSTEM,
             "cache_control": {"type": "ephemeral"}},
            # Block 2: patient-specific profile → cached within a session
            {"type": "text", "text": patient_block,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user_message}]
    )

    raw = resp.content[0].text.strip()
    # Strip markdown code fences if model wraps response
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)
    data["visit_id"]      = visit_id
    data["model_version"] = settings.claude_analysis_model
    data["prompt_tokens"] = resp.usage.input_tokens
    data["output_tokens"] = resp.usage.output_tokens

    log.info("claude.analyze", visit_id=visit_id,
             risk=data["risk_level"], flags=len(data["flags"]),
             cached_tokens=getattr(resp.usage, "cache_read_input_tokens", 0))

    return AnalysisResponse(**data)

# ── History Summarization ─────────────────────────────────────────

def summarize_patient(patient: PatientContext, visit_notes: str) -> SummaryResponse:
    patient_block = _build_patient_block(patient)

    user_message = f"""
Summarize this patient's medical history. Return ONLY valid JSON:
{{
  "one_liner": "<single sentence for quick display>",
  "detailed_summary": "<3-5 paragraphs covering history, risks, and active concerns>",
  "key_conditions": ["<condition1>", "<condition2>"],
  "active_alerts": ["<alert1>", "<alert2>"],
  "last_visit_note": "<brief summary of most recent visit if available>"
}}

## Recent Visit Notes
{visit_notes or 'No visit notes available.'}
"""
    client = get_client()
    resp = client.messages.create(
        model=settings.claude_summary_model,
        max_tokens=settings.claude_max_tokens,
        system=[
            {"type": "text", "text": _SUMMARY_SYSTEM,
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": patient_block,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user_message}]
    )
    raw  = resp.content[0].text.strip()
    if raw.startswith("```"): raw = raw.split("```")[1].lstrip("json").strip()
    data = json.loads(raw)
    data["patient_id"] = patient.patient_id
    return SummaryResponse(**data)

# ── Speech / Conversation Analysis ───────────────────────────────

def analyze_conversation(
    session_id: str,
    patient: PatientContext,
    transcript: str
) -> SpeechAnalysisResponse:
    patient_block = _build_patient_block(patient)

    user_message = f"""
Analyze this doctor-patient consultation transcript.
Return ONLY valid JSON:
{{
  "clinical_entities": [
    {{"type": "<symptom|medication|diagnosis|allergy|procedure|vital>",
      "value": "<extracted value>",
      "context": "<sentence where it appeared>"}}
  ],
  "doctor_concerns": ["<concern1>"],
  "patient_concerns": ["<concern1>"],
  "suggested_flags": [
    {{"id":"<slug>","label":"<title>","severity":"<info|warning|critical>",
      "detail":"<reason>","evidence":["transcript"]}}
  ],
  "ambient_note": "<SOAP-format clinical note auto-generated from conversation>"
}}

## Transcript
{transcript}
"""
    client = get_client()
    resp = client.messages.create(
        model=settings.claude_analysis_model,
        max_tokens=settings.claude_max_tokens,
        system=[
            {"type": "text", "text": _SPEECH_SYSTEM,
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": patient_block,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": user_message}]
    )
    raw  = resp.content[0].text.strip()
    if raw.startswith("```"): raw = raw.split("```")[1].lstrip("json").strip()
    data = json.loads(raw)
    data["session_id"] = session_id
    return SpeechAnalysisResponse(**data)

# ── Patient Chat (streaming) ──────────────────────────────────────

def stream_chat(
    patient: PatientContext,
    message: str,
    history: list[dict]
):
    """Yields text chunks as a generator for SSE streaming."""
    patient_block = _build_patient_block(patient)

    messages = [{"role": m["role"], "content": m["content"]}
                for m in history[-6:]]   # last 6 turns
    messages.append({"role": "user", "content": message})

    client = get_client()
    with client.messages.stream(
        model=settings.claude_chat_model,
        max_tokens=settings.claude_chat_max_tokens,
        system=[
            {"type": "text", "text": _CHAT_SYSTEM,
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": patient_block,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
```

---

### 13.9 `services/embedder.py`

```python
# ESAP.AI/services/embedder.py
import numpy as np
import structlog
from sentence_transformers import SentenceTransformer
from config import get_settings

log      = structlog.get_logger()
settings = get_settings()
_model: SentenceTransformer | None = None

def warm_up_embedder():
    global _model
    log.info("embedder.loading", model=settings.embedding_model)
    _model = SentenceTransformer(settings.embedding_model)
    # Warm-up pass so first real call is fast
    _model.encode(["ESAP Healthcare warm-up"], normalize_embeddings=True)
    log.info("embedder.ready", dim=settings.embedding_dim)

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        warm_up_embedder()
    return _model

def embed(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns L2-normalized float vectors."""
    if not texts:
        return []
    model  = get_model()
    vecs   = model.encode(texts, normalize_embeddings=True, batch_size=32,
                          show_progress_bar=False)
    return vecs.tolist()

def embed_single(text: str) -> list[float]:
    return embed([text])[0]
```

---

### 13.10 `services/vector_store.py`

```python
# ESAP.AI/services/vector_store.py
import uuid, structlog
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue, SearchRequest as QSearchRequest
)
from config import get_settings
from services.embedder import embed, embed_single
from utils.text_utils import chunk_text

log      = structlog.get_logger()
settings = get_settings()
_client: QdrantClient | None = None

def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(host=settings.qdrant_host,
                               port=settings.qdrant_port)
    return _client

def ensure_collection():
    """Create the Qdrant collection if it does not exist."""
    c = get_client()
    names = [col.name for col in c.get_collections().collections]
    if settings.qdrant_collection not in names:
        c.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dim,
                distance=Distance.COSINE,
            )
        )
        log.info("vector_store.collection_created",
                 name=settings.qdrant_collection)

def index_document(
    patient_id: str,
    doc_id: str,
    text: str,
    doc_type: str  = "unknown",
    file_name: str = "",
) -> list[str]:
    """
    Chunk text → embed → upsert into Qdrant.
    Returns list of chunk point IDs for storage in PatientDocuments.QdrantChunkIds.
    """
    ensure_collection()
    chunks    = chunk_text(text, size=512, overlap=50)
    if not chunks:
        return []

    vectors   = embed(chunks)
    chunk_ids = []
    points    = []

    for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
        pid = str(uuid.uuid4())
        chunk_ids.append(pid)
        points.append(PointStruct(
            id=pid,
            vector=vec,
            payload={
                "patient_id": patient_id,
                "doc_id":     doc_id,
                "doc_type":   doc_type,
                "file_name":  file_name,
                "chunk_idx":  idx,
                "text":       chunk,
            }
        ))

    get_client().upsert(collection_name=settings.qdrant_collection, points=points)
    log.info("vector_store.indexed", patient_id=patient_id,
             doc_id=doc_id, chunks=len(chunks))
    return chunk_ids

def search(patient_id: str, query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve top-K semantically relevant chunks for a specific patient.
    Always filtered to the patient's own documents.
    """
    ensure_collection()
    query_vec = embed_single(query)

    results = get_client().search(
        collection_name=settings.qdrant_collection,
        query_vector=query_vec,
        limit=top_k,
        query_filter=Filter(must=[
            FieldCondition(key="patient_id",
                           match=MatchValue(value=patient_id))
        ])
    )
    return [
        {
            "text":     r.payload["text"],
            "score":    round(r.score, 4),
            "doc_type": r.payload.get("doc_type", "unknown"),
            "doc_id":   r.payload.get("doc_id", ""),
        }
        for r in results
    ]

def delete_patient_documents(patient_id: str):
    """GDPR: remove all vectors belonging to a patient."""
    get_client().delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(must=[
            FieldCondition(key="patient_id",
                           match=MatchValue(value=patient_id))
        ])
    )
    log.info("vector_store.deleted_patient", patient_id=patient_id)
```

---

### 13.11 `services/ocr_service.py`

```python
# ESAP.AI/services/ocr_service.py
import io, structlog
import pytesseract
import fitz          # PyMuPDF
from PIL import Image
from utils.text_utils import clean_ocr_text

log = structlog.get_logger()

def extract_text(file_bytes: bytes, mime_type: str) -> str:
    """
    Extract plain text from a PDF, JPG, or PNG upload.
    Uses PyMuPDF for PDFs (fast, handles scanned PDFs with embedded text),
    and Tesseract for image-only files.
    """
    try:
        if mime_type == "application/pdf" or file_bytes[:4] == b"%PDF":
            return _extract_pdf(file_bytes)
        else:
            return _extract_image(file_bytes)
    except Exception as e:
        log.error("ocr.error", mime=mime_type, error=str(e))
        return ""

def _extract_pdf(pdf_bytes: bytes) -> str:
    doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text("text")
        if len(text.strip()) < 50:
            # Scanned page — render at 300 DPI and OCR
            mat  = fitz.Matrix(300/72, 300/72)
            pix  = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
            img  = Image.frombytes("L", (pix.width, pix.height), pix.samples)
            text = pytesseract.image_to_string(img, config="--psm 6")
        pages.append(text)
    raw = "\n\n".join(pages)
    return clean_ocr_text(raw)

def _extract_image(img_bytes: bytes) -> str:
    img  = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    raw  = pytesseract.image_to_string(img, config="--psm 6")
    return clean_ocr_text(raw)
```

---

### 13.12 `services/whisper_service.py`

```python
# ESAP.AI/services/whisper_service.py
import io, os, tempfile, structlog
import whisper
import soundfile as sf
from config import get_settings

log      = structlog.get_logger()
settings = get_settings()
_model   = None

def warm_up_whisper():
    global _model
    log.info("whisper.loading", model=settings.whisper_model)
    _model = whisper.load_model(settings.whisper_model)
    log.info("whisper.ready")

def get_model():
    global _model
    if _model is None:
        warm_up_whisper()
    return _model

def transcribe(
    audio_bytes: bytes,
    language: str | None = None,
    diarize: bool = False,
) -> dict:
    """
    Transcribe audio bytes (WAV/MP3/M4A/WebM).
    Returns: {text, language, segments, duration_seconds}
    """
    model = get_model()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        # Normalise to WAV so Whisper can read it reliably
        try:
            data, sr = sf.read(io.BytesIO(audio_bytes))
            sf.write(tmp.name, data, sr, subtype="PCM_16")
        except Exception:
            tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        options = {
            "language": language,
            "word_timestamps": True,
            "verbose": False,
            "fp16": False,           # CPU-safe
        }
        result = model.transcribe(tmp_path, **options)

        # Basic speaker-turn heuristic:
        # segments > 3 sec gap → assume speaker change
        labeled = _label_speakers(result["segments"])

        return {
            "text":             result["text"].strip(),
            "language":         result["language"],
            "segments":         labeled,
            "duration_seconds": _get_duration(tmp_path),
        }
    finally:
        os.unlink(tmp_path)

def _get_duration(path: str) -> float:
    try:
        data, sr = sf.read(path)
        return len(data) / sr
    except Exception:
        return 0.0

def _label_speakers(segments: list[dict]) -> list[dict]:
    """
    Naive diarization: alternate speaker label on long pauses (>2 s).
    Production should use pyannote-audio for real diarization.
    """
    labeled    = []
    current    = "Doctor"
    prev_end   = 0.0
    for seg in segments:
        if seg["start"] - prev_end > 2.0:
            current = "Patient" if current == "Doctor" else "Doctor"
        labeled.append({**seg, "speaker": current})
        prev_end = seg["end"]
    return labeled
```

---

### 13.13 `services/drug_checker.py`

```python
# ESAP.AI/services/drug_checker.py
import httpx, structlog
from models.schemas import MedicationItem

log = structlog.get_logger()
RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"

async def get_interactions(medications: list[MedicationItem]) -> list[dict]:
    """
    Check drug-drug interactions via the public RxNorm API.
    Returns list of {drug1, drug2, severity, description}.
    """
    if len(medications) < 2:
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        rxcuis = await _resolve_rxcuis(client, medications)
        if len(rxcuis) < 2:
            return []
        return await _check_interactions(client, rxcuis)

async def _resolve_rxcuis(
    client: httpx.AsyncClient,
    meds: list[MedicationItem]
) -> list[str]:
    cuis = []
    for med in meds:
        try:
            r = await client.get(
                f"{RXNORM_BASE}/rxcui.json",
                params={"name": med.drug_name, "search": "1"}
            )
            ids = r.json().get("idGroup", {}).get("rxnormId", [])
            if ids:
                cuis.append(ids[0])
        except Exception as e:
            log.warning("rxnorm.resolve_failed", drug=med.drug_name, error=str(e))
    return cuis

async def _check_interactions(
    client: httpx.AsyncClient,
    rxcuis: list[str]
) -> list[dict]:
    try:
        r = await client.get(
            f"{RXNORM_BASE}/interaction/list.json",
            params={"rxcuis": " ".join(rxcuis)}
        )
        groups = r.json().get("fullInteractionTypeGroup", [])
        results = []
        for grp in groups:
            for itype in grp.get("fullInteractionType", []):
                items = itype.get("minConceptItem", [])
                pairs = itype.get("interactionPair", [])
                if len(items) >= 2 and pairs:
                    results.append({
                        "drug1":       items[0]["name"],
                        "drug2":       items[1]["name"],
                        "severity":    pairs[0].get("severity", "unknown"),
                        "description": pairs[0].get("description", ""),
                    })
        return results
    except Exception as e:
        log.error("rxnorm.interaction_check_failed", error=str(e))
        return []
```

---

### 13.14 `utils/text_utils.py`

```python
# ESAP.AI/utils/text_utils.py
import re

def chunk_text(text: str, size: int = 512, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping word-boundary chunks.
    size: target words per chunk. overlap: words shared between chunks.
    """
    words  = text.split()
    chunks = []
    i      = 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if chunk:
            chunks.append(chunk)
        i += size - overlap
    return chunks

def clean_ocr_text(text: str) -> str:
    """Remove OCR artefacts, normalize whitespace, strip control chars."""
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E -￿]", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def deidentify(text: str) -> str:
    """
    Minimal PHI scrubbing before storing transcripts.
    Production should use AWS Comprehend Medical or Azure Text Analytics for Health.
    """
    # Phone numbers
    text = re.sub(r"\b(\+?\d[\d\s\-().]{7,15}\d)\b", "[PHONE]", text)
    # Medicare / SSN-style numbers
    text = re.sub(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b", "[ID]", text)
    # Dates: leave year only — e.g. "March 15, 1985" → "1985"
    text = re.sub(
        r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|"
        r"Dec(?:ember)?)\s+\d{1,2},?\s+(\d{4})\b",
        r"\2", text, flags=re.IGNORECASE
    )
    return text

def format_rag_context(chunks: list[dict]) -> str:
    """Format retrieved RAG chunks into a clean string for Claude injection."""
    if not chunks:
        return "No prior records retrieved."
    lines = []
    for i, c in enumerate(chunks, 1):
        lines.append(f"[Record {i} — {c['doc_type'].replace('_',' ').title()}"
                     f" (relevance {c['score']:.2f})]\n{c['text']}")
    return "\n\n---\n\n".join(lines)
```

---

### 13.15 Complete Router Implementations

```python
# ESAP.AI/routers/analyze.py
from fastapi import APIRouter, Depends
from models.schemas import AnalyzeRequest, AnalysisResponse
from services.claude_client import analyze_visit
from services.vector_store import search
from utils.text_utils import format_rag_context
from middleware.auth import require_internal_key

router = APIRouter()

@router.post("/{visit_id}", response_model=AnalysisResponse)
async def analyze(
    visit_id: str,
    req: AnalyzeRequest,
    _: str = Depends(require_internal_key),
):
    # 1. Build search query from chief complaint + description
    query = f"{req.chief_complaint} {req.symptom_description or ''}".strip()

    # 2. Retrieve relevant historical records from Qdrant
    chunks      = search(req.patient_id, query, top_k=5)
    rag_context = format_rag_context(chunks)

    # 3. Call Claude with prompt caching
    symptoms = req.model_dump(
        include={
            "chief_complaint","symptom_description","onset_type","duration",
            "pain_scale","symptom_location","associated_symptoms",
            "aggravating_factors","relieving_factors","self_treatment"
        }
    )
    return analyze_visit(visit_id, req.patient_context, symptoms, rag_context)
```

```python
# ESAP.AI/routers/summarize.py
from fastapi import APIRouter, Depends
from models.schemas import SummarizeRequest, SummaryResponse
from services.claude_client import summarize_patient
from middleware.auth import require_internal_key

router = APIRouter()

@router.post("/{patient_id}", response_model=SummaryResponse)
async def summarize(
    patient_id: str,
    req: SummarizeRequest,
    _: str = Depends(require_internal_key),
):
    # Visit notes are assembled by the .NET API and passed in the request
    visit_notes = req.patient_context.model_dump_json(indent=2)
    return summarize_patient(req.patient_context, visit_notes)
```

```python
# ESAP.AI/routers/rag.py
from fastapi import APIRouter, Depends
from models.schemas import (
    IndexDocumentRequest, IndexDocumentResponse,
    SearchRequest, SearchResponse, SearchChunk
)
from services.vector_store import index_document, search, delete_patient_documents
from utils.text_utils import format_rag_context
from middleware.auth import require_internal_key

router = APIRouter()

@router.post("/index", response_model=IndexDocumentResponse)
async def index(
    req: IndexDocumentRequest,
    _: str = Depends(require_internal_key),
):
    ids = index_document(
        patient_id=req.patient_id,
        doc_id=req.doc_id,
        text=req.text,
        doc_type=req.doc_type,
        file_name=req.file_name or "",
    )
    return IndexDocumentResponse(
        doc_id=req.doc_id,
        chunk_count=len(ids),
        chunk_ids=ids,
    )

@router.post("/search", response_model=SearchResponse)
async def rag_search(
    req: SearchRequest,
    _: str = Depends(require_internal_key),
):
    chunks  = search(req.patient_id, req.query, req.top_k)
    context = format_rag_context(chunks)
    return SearchResponse(
        query=req.query,
        chunks=[SearchChunk(**c) for c in chunks],
        context=context,
    )

@router.delete("/patient/{patient_id}")
async def delete_vectors(
    patient_id: str,
    _: str = Depends(require_internal_key),
):
    """GDPR erasure — remove all vectors for a patient."""
    delete_patient_documents(patient_id)
    return {"deleted": patient_id}
```

```python
# ESAP.AI/routers/speech.py
from fastapi import APIRouter, Depends, UploadFile, File, Form
from models.schemas import (
    TranscribeResponse, SpeechAnalysisRequest, SpeechAnalysisResponse
)
from services.whisper_service import transcribe
from services.claude_client import analyze_conversation
from utils.text_utils import deidentify
from middleware.auth import require_internal_key
import uuid

router = APIRouter()

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("en"),
    _: str = Depends(require_internal_key),
):
    audio_bytes = await audio.read()
    result      = transcribe(audio_bytes, language=language)
    clean       = deidentify(result["text"])

    return TranscribeResponse(
        session_id       = str(uuid.uuid4()),
        transcript_raw   = result["text"],
        transcript_clean = clean,
        language         = result["language"],
        duration_seconds = result["duration_seconds"],
        segments         = result["segments"],
    )

@router.post("/analyze", response_model=SpeechAnalysisResponse)
async def analyze_speech(
    req: SpeechAnalysisRequest,
    _: str = Depends(require_internal_key),
):
    return analyze_conversation(
        req.session_id, req.patient_context, req.transcript
    )
```

```python
# ESAP.AI/routers/chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest
from services.claude_client import stream_chat
from middleware.auth import require_internal_key
import json, uuid

router = APIRouter()

@router.post("")
async def chat(
    req: ChatRequest,
    _: str = Depends(require_internal_key),
):
    """
    Streaming SSE endpoint.
    .NET reads via IAsyncEnumerable / SSE; Next.js reads via EventSource.
    """
    message_id = str(uuid.uuid4())

    def event_generator():
        try:
            for chunk in stream_chat(
                req.patient_context,
                req.message,
                [m.model_dump() for m in req.history],
            ):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True, 'messageId': message_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering":"no",
        }
    )
```

---

### 13.16 Prompt Templates

```txt
# prompts/symptom_analysis.txt
You are ESAP Clinical AI, embedded in a hospital electronic health record system.
Your role is to assist doctors by analyzing patient data and generating structured
clinical insights. You are NOT a replacement for clinical judgment.

Core rules:
1. Output ONLY valid JSON — no markdown, no prose outside the JSON object.
2. Flag critical findings immediately with severity "critical".
3. Base all analysis strictly on provided data — never hallucinate clinical facts.
4. Check for drug-allergy conflicts in the medications + allergies data.
5. Consider patient age, sex, BMI, and lifestyle in every risk calculation.
6. Differentiate between correlation (flag as "info") and strong clinical concern ("warning"/"critical").
7. Recommendations must be actionable and specific, not generic.
8. risk_score: 0-30 = low, 31-60 = moderate, 61-80 = high, 81-100 = critical.
9. completion_pct: percentage of survey fields that had data provided (estimate).
```

```txt
# prompts/history_summary.txt
You are ESAP Clinical AI producing a patient history summary for a doctor's
pre-visit brief. Be concise, clinically precise, and prioritize actionable findings.

Rules:
1. Output ONLY valid JSON.
2. one_liner: max 20 words, clinically precise (e.g. "38yo male, HTN stage 1, high stress, poor sleep").
3. detailed_summary: 3 paragraphs — (1) demographics + chronic conditions,
   (2) medications + allergies + risks, (3) family history + lifestyle factors.
4. key_conditions: ICD-10 style condition names.
5. active_alerts: issues needing doctor attention at this visit.
```

```txt
# prompts/conversation_analysis.txt
You are ESAP Clinical AI analyzing a doctor-patient consultation transcript.
Extract structured clinical data and generate an ambient documentation note.

Rules:
1. Output ONLY valid JSON.
2. Extract every mentioned symptom, medication, diagnosis, allergy, procedure, and vital sign.
3. Separate doctor_concerns (clinical red flags raised by doctor) from
   patient_concerns (things the patient explicitly worried about).
4. ambient_note must follow SOAP format:
   S (Subjective) — patient's reported symptoms and concerns
   O (Objective)  — any vitals or observations mentioned
   A (Assessment) — differential or working diagnosis mentioned
   P (Plan)       — treatments, referrals, follow-up discussed
5. Only include information explicitly present in the transcript.
```

```txt
# prompts/patient_chat.txt
You are ESAP Health Assistant — the patient's personal AI health companion.
You have access to the patient's registered health profile shown below.

Personality: warm, clear, non-alarming. Explain medical concepts simply.
Always recommend consulting their doctor for diagnosis or treatment changes.

Rules:
1. Never diagnose. Offer information and guidance, not diagnoses.
2. If a symptom sounds potentially serious (chest pain, stroke signs, severe pain),
   immediately say "Please call emergency services or go to an emergency room."
3. Reference the patient's specific profile data in responses (their actual medications,
   conditions, vitals) — don't give generic answers.
4. Keep responses concise — 3-5 sentences for simple questions, more for complex topics.
5. Use plain language. No medical jargon without immediate explanation.
```

---

### 13.17 `Dockerfile`

```dockerfile
# ESAP.AI/Dockerfile
FROM python:3.12-slim

# System deps for Tesseract, FFmpeg, and soundfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Pre-download models at build time so container starts fast
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('NeuML/pubmedbert-base-embeddings')"

EXPOSE 8000

# Production: gunicorn with uvicorn workers
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-"]
```

---

### 13.18 Tests

```python
# ESAP.AI/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
from config import get_settings

TEST_KEY = "test-internal-key"

@pytest.fixture(autouse=True)
def override_settings(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY",   TEST_KEY)
    monkeypatch.setenv("ANTHROPIC_API_KEY",  "test-key")
    monkeypatch.setenv("ENVIRONMENT",        "test")

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"X-Internal-Key": TEST_KEY}

@pytest.fixture
def sample_patient():
    return {
        "patient_id": "test-001",
        "full_name": "Jane Smith",
        "age": 38,
        "biological_sex": "female",
        "blood_group": "A+",
        "bmi": 24.5,
        "chronic_conditions": ["hypertension"],
        "medications": [{"drug_name": "Amlodipine", "dosage": "5mg", "frequency": "once daily"}],
        "allergies": [{"substance": "Penicillin", "severity": "severe", "reaction_type": "anaphylaxis"}],
        "sleep_hours": 6.5,
        "stress_level": 7,
        "smoking_status": "never",
        "exercise_frequency": "2x_week",
        "family_history": [],
        "mental_health_history": [],
        "cancer_history": False,
    }
```

```python
# ESAP.AI/tests/test_analyze.py
import pytest
from unittest.mock import patch, MagicMock
from models.schemas import AnalysisResponse

MOCK_ANALYSIS = {
    "visit_id":      "visit-001",
    "risk_score":    65,
    "risk_level":    "moderate",
    "profile_label": "38yo hypertensive female, high stress",
    "summary":       "Patient presents with elevated stress and fatigue.",
    "completion_pct":80,
    "flags": [
        {"id": "bp", "label": "Elevated BP", "severity": "warning",
         "detail": "Hypertension noted", "evidence": ["history"]}
    ],
    "recommendations": [
        {"id": "r1", "title": "DASH Diet", "description": "Reduce sodium",
         "priority": "soon", "icon": "🥗"}
    ],
    "model_version":  "claude-sonnet-4-6",
    "prompt_tokens":  500,
    "output_tokens":  300,
}

def test_analyze_returns_200(client, auth_headers, sample_patient):
    with patch("routers.analyze.analyze_visit",
               return_value=AnalysisResponse(**MOCK_ANALYSIS)), \
         patch("routers.analyze.search", return_value=[]):
        resp = client.post(
            "/analyze/visit-001",
            json={
                "patient_id":          "test-001",
                "patient_context":     sample_patient,
                "chief_complaint":     "Persistent headache for 3 days",
                "symptom_description": "Dull, throbbing headache",
                "pain_scale":          6,
            },
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["risk_level"] == "moderate"
    assert len(body["flags"]) == 1

def test_analyze_rejects_missing_auth(client, sample_patient):
    resp = client.post(
        "/analyze/visit-001",
        json={"patient_id": "test-001",
              "patient_context": sample_patient,
              "chief_complaint": "headache"},
    )
    assert resp.status_code == 401

def test_analyze_rejects_invalid_pain_scale(client, auth_headers, sample_patient):
    resp = client.post(
        "/analyze/visit-001",
        json={"patient_id": "test-001",
              "patient_context": sample_patient,
              "chief_complaint": "headache",
              "pain_scale": 15},   # invalid — must be 0-10
        headers=auth_headers,
    )
    assert resp.status_code == 422
```

```python
# ESAP.AI/tests/test_rag.py
import pytest
from unittest.mock import patch

def test_index_document(client, auth_headers):
    with patch("routers.rag.index_document", return_value=["id1", "id2", "id3"]):
        resp = client.post(
            "/rag/index",
            json={
                "patient_id": "p-001",
                "doc_id":     "doc-001",
                "text":       "Patient has a history of hypertension since 2020.",
                "doc_type":   "discharge",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["chunk_count"] == 3
    assert len(body["chunk_ids"]) == 3

def test_search_returns_chunks(client, auth_headers):
    mock_chunks = [
        {"text": "Patient has hypertension.", "score": 0.92,
         "doc_type": "discharge", "doc_id": "doc-001"},
    ]
    with patch("routers.rag.search", return_value=mock_chunks):
        resp = client.post(
            "/rag/search",
            json={"patient_id": "p-001", "query": "blood pressure", "top_k": 3},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["chunks"]) == 1
    assert body["chunks"][0]["score"] == 0.92
    assert "Patient has hypertension" in body["context"]

def test_delete_vectors(client, auth_headers):
    with patch("routers.rag.delete_patient_documents"):
        resp = client.delete("/rag/patient/p-001", headers=auth_headers)
    assert resp.status_code == 200
```

```python
# ESAP.AI/tests/test_schemas.py
from models.schemas import AnalyzeRequest, PatientContext
import pytest

def test_patient_context_defaults():
    p = PatientContext(patient_id="1", full_name="Test", age=30,
                       biological_sex="male")
    assert p.medications == []
    assert p.allergies   == []
    assert p.cancer_history is False

def test_analyze_request_pain_scale_validation():
    with pytest.raises(Exception):
        AnalyzeRequest(
            patient_id="1",
            patient_context=PatientContext(
                patient_id="1", full_name="X", age=30, biological_sex="male"),
            chief_complaint="test",
            pain_scale=15,    # invalid
        )
```

---

### 13.19 Run Locally

```bash
# 1. Create and activate venv
cd ESAP.AI
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 3. Copy env file
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY and INTERNAL_API_KEY

# 4. Start Qdrant (Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# 5. Start the service
uvicorn main:app --reload --port 8000

# 6. View interactive API docs
open http://localhost:8000/docs

# 7. Run tests
pytest tests/ -v --cov=. --cov-report=term-missing

# 8. Production start
gunicorn main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers 2 \
  --bind 0.0.0.0:8000 \
  --timeout 120
```

---

### 13.20 Python Stack Summary

| Component | Library | Purpose |
|---|---|---|
| Web framework | FastAPI 0.115 | Async REST + SSE streaming |
| LLM | `anthropic` 0.40 | Claude API with prompt caching |
| Embeddings | `sentence-transformers` | PubMedBERT — medical-domain vectors |
| Vector DB | `qdrant-client` | Per-patient RAG retrieval |
| OCR | `pytesseract` + `PyMuPDF` | PDF/image text extraction |
| Speech-to-text | `openai-whisper` | Self-hosted, HIPAA-safe ASR |
| Drug checks | `httpx` → RxNorm API | Free public drug interaction API |
| Validation | `pydantic v2` | Request/response schemas |
| Settings | `pydantic-settings` | Typed env var management |
| Auth | Custom API key header | Internal service authentication |
| Logging | `structlog` | Structured JSON logs |
| Testing | `pytest` + `httpx` | Async test client + mocking |
| Container | Gunicorn + Uvicorn | Production WSGI/ASGI server |
