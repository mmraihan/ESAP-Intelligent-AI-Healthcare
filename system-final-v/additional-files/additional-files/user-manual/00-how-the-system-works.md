# 0. How the system works: an overview

[← Manual index](README.md)

A picture of the whole system before you read the role chapters: what the parts are, how a
patient moves through it, and how information flows between people. Each section names the
chapter with the details.

> The diagrams are written in Mermaid. They display as diagrams on GitHub and in the VS Code
> Markdown preview (Ctrl+Shift+V). A plain-text summary follows each one.

---

## 0.1 The parts of the system

```mermaid
flowchart LR
    subgraph Browser["Browser (http://localhost:5175)"]
        UI["ESAP web app<br/>4 surfaces: clinical · admin · ops · patient<br/>+ intake assistant chat"]
    end

    subgraph Server["ESAP server (http://localhost:8000)"]
        API["API<br/>checks every request against<br/>the role permission rules"]
        MODELS["Five models M-01 to M-05<br/>(real mode: trained files<br/>stub mode: stand-in)"]
        AUDIT["Audit log"]
    end

    DB[("SQLite database<br/>backend/esap.db")]
    SEED["seed.json<br/>(synthetic demo data)"]
    FILES["Trained model files<br/>ml-pipeline/model_exports/"]
    LLM["Optional AI language service<br/>(helps the intake assistant)"]

    UI -- "sign-in, screens, actions" --> API
    API --> MODELS
    API --> AUDIT
    API <--> DB
    AUDIT --> DB
    SEED -. "fills it on reset" .-> DB
    FILES -. "loaded at start (real mode)" .-> MODELS
    API -. "if configured" .-> LLM
```

- **The web app** is what everyone uses. It only shows the screens and buttons a role can use.
- **The server** decides everything: who may see or do what, running the models, saving, and
  writing every action to the **audit log**.
- **All data** lives in one SQLite file, `backend/esap.db`, filled with synthetic patients
  from `seed.json` when the demo is reset. No real patients, no MIMIC records.
- **The models** are the trained M-01 to M-05 files in real mode, or a stand-in in stub mode
  ([About this build](README.md#about-this-build)).
- **The AI language service** is optional. It only makes the intake assistant's replies more
  natural; if it is down, the assistant still works.

---

## 0.2 The four surfaces and who uses them

```mermaid
flowchart TB
    subgraph C["Clinical workspace"]
        C1["Attending · Resident · NP/PA"]
        C2["Charge Nurse · Staff Nurse"]
        C3["Case Manager · Pharmacist"]
    end
    subgraph A["Hospital admin console (never shows a chart)"]
        A1["Hospital Admin · IT Admin"]
        A2["Privacy Officer · QI Auditor · Billing Admin"]
    end
    subgraph O["Platform ops console (ESAP staff, no patient data)"]
        O1["Super-Admin"]
    end
    subgraph P["Patient portal"]
        P1["Patient · Carer · Individual"]
    end
    O1 -- "creates hospitals" --> A1
    A1 -- "invites staff, sets roles and units" --> C
    C -- "releases plain-language summaries" --> P1
    P1 -- "messages, symptom reports, questions" --> C
```

- **Ops** creates each hospital. The **Hospital Admin** then invites staff and gives each one a
  role and units.
- **Clinicians** assess patients and release summaries to the **patient portal**. Patients
  send information back.
- Details: roles at a glance in the [README](README.md#roles-at-a-glance); exact permissions
  in [chapter 10](10-permissions-reference.md).

---

## 0.3 Setting up a hospital (once)

```mermaid
sequenceDiagram
    actor Ops as Super-Admin (ESAP)
    actor HA as Hospital Admin
    actor IT as IT Admin
    actor Staff as New staff member
    participant S as ESAP server

    Ops->>S: Provisioning wizard → Create tenant
    S-->>HA: Invite link for the first administrator
    HA->>S: Accept invite, set password
    HA->>S: Facilities & units → add wards
    HA->>S: Invites → email, role, Assigned units
    S-->>HA: Acceptance link (no email service: pass it on yourself)
    HA-->>Staff: Sends the link
    Staff->>S: Opens link, sets password (works once, 7 days)
    IT->>S: Integrations, Model & display, Org settings
    Note over HA,IT: Only the Hospital Admin can grant clinical roles
```

1. ESAP staff create the hospital; its first administrator gets an invite
   ([chapter 8](08-platform-operations.md)).
2. The Hospital Admin adds units, then invites staff with a role and **Assigned units**. Units
   decide which patients a unit-scoped clinician sees ([chapter 6](06-hospital-admin-and-it-admin.md)).
3. The IT Admin configures integrations and settings, and can provision non-clinical accounts.

---

## 0.4 The core workflow: from admission to a reviewed result

This is what the product exists for.

```mermaid
flowchart TD
    A["Patient arrives"] --> B{"Who admits?"}
    B -- "Staff Nurse<br/>(Admit a patient / Triage)" --> C["Intake captured<br/>Admit patient<br/>→ Awaiting assessment"]
    B -- "Attending / Resident / NP/PA<br/>(New encounter)" --> D["Intake captured<br/>Admit & run assessment"]
    C --> E["Physician or NP/PA opens the intake<br/>→ Run assessment"]
    D --> F
    E --> F["t₀ stamped at admission<br/>Nothing recorded later can enter an estimate"]
    F --> G["Five models run<br/>M-01 differential · M-02 mortality · M-03 ICU<br/>M-04 readmission · M-05 length of stay"]
    G --> H["Calibrated, explained (Why?),<br/>hospital display rules applied<br/>(e.g. a model suppressed on a unit)"]
    H --> I["Results page"]
    I --> J{"Who reviews?"}
    J -- "Attending / NP/PA" --> K["Acknowledge → Confirm review<br/>(reviewed, not agreed)"]
    J -- "Resident, co-sign policy on" --> L["Submit for co-sign"] --> M["Attending: Co-sign"] --> K
    J -- "Nurse / Case Manager / Pharmacist" --> N["Escalate to the attending<br/>(see 0.5)"]
    K --> O["Optional: Release to patient<br/>plain-language summary, never a score"]
    O --> P["Patient portal → My results"]
    I -. "new information" .-> Q["Intake tab → correct → Run assessment<br/>(same t₀, new run in History)"]
    Q --> G
```

- **Admit:** a Staff Nurse captures the intake but cannot run the models; the patient waits as
  *Awaiting assessment*. A physician or NP/PA can admit and assess in one step
  ([chapter 3](03-physicians.md), [chapter 4](04-nurses.md)).
- **t₀:** the admission time is fixed. Everything the models use was known at that moment.
- **Assess:** all five models run together. Each result is calibrated, explained, and shown
  according to your hospital's **Model & display** settings.
- **Review:** acknowledging records that a named clinician reviewed it. Residents may need an
  attending's co-sign. Other roles escalate instead ([chapter 2](02-reading-a-result.md)).
- **Share:** the clinician can release a summary in their own words to the patient portal.
- **Re-run:** new information goes on the Intake tab; a new run is added against the same t₀,
  and **History** shows what changed.

---

## 0.5 Escalation: asking the attending to look

```mermaid
sequenceDiagram
    actor N as Nurse / Case Manager / Pharmacist
    participant S as ESAP server
    actor Dr as Attending

    N->>S: Escalate (patient card or Results page)
    S->>S: Saved on the encounter + audit log
    S-->>Dr: Worklist: red "escalated" pill on the patient
    Dr->>S: Opens the patient
    S-->>Dr: Banner "Escalated to Attending on call"<br/>urgency · who · when · why
    Note over N,Dr: No "resolve" step in this build:<br/>follow up in person
```

---

## 0.6 Patient ↔ care team communication

```mermaid
flowchart LR
    subgraph Portal["Patient portal"]
        P1["Tell us how you feel<br/>Ready to share"]
        P2["Care team → Send a message<br/>My results → Ask a question /<br/>This does not describe me"]
        P3["Things you've sent<br/>Received → Being looked at → Handled"]
        P4["My results<br/>(released summaries)"]
    end
    subgraph Clinical["Doctor's Results page"]
        D1["From the patient<br/>symptom reports · pre-visit summaries<br/>(Mark seen)"]
        D2["From the patient<br/>messages · questions · urgent flags<br/>(read-only, with status)"]
        D3["Release to patient"]
    end
    subgraph Admin["Hospital Admin home"]
        H1["Requests waiting on the hospital<br/>→ Handled"]
    end

    P1 --> D1
    P2 --> D2
    P2 --> H1
    H1 -- "status" --> P3
    D1 -. "Seen by (name)" .-> P1
    D3 --> P4
```

- **Symptom reports and pre-visit summaries** go to the doctor's **From the patient** panel;
  **Mark seen** tells the patient who read it.
- **Messages, result questions and urgent flags** appear in the doctor's panel (read-only) and
  in the Hospital Admin's request queue, which marks them **Handled**. The patient follows the
  status under **Things you've sent**.
- **Released summaries** are the only clinical content a patient sees. They never show a
  score, and nothing a patient sends ever changes an estimate.
- Details: [chapter 9](09-patients-and-carers.md), [chapter 3, section 3.3](03-physicians.md#33-results).

---

## 0.7 A self-registered patient joins a hospital

```mermaid
sequenceDiagram
    actor Pt as Patient (own account)
    participant S as ESAP server
    actor Dr as Attending / Resident / NP/PA

    Pt->>S: Care team → Connect with a hospital<br/>hospital · age · sex · reason
    S-->>Dr: Worklist: "Patient connection requests"
    Dr->>S: Accept & admit
    S->>S: Creates an encounter under the clinician<br/>and links the patient's portal account
    Note over Pt,Dr: From now on: what the patient sends reaches this team,<br/>and what the team releases reaches the patient
```

---

## 0.8 A family member or carer gets access

```mermaid
sequenceDiagram
    actor Pt as Patient
    participant S as ESAP server
    actor Carer as Carer

    Pt->>S: Family access → Add someone → Send invitation
    S-->>Pt: Link (Copy link: no email service)
    Pt-->>Carer: Sends the link
    Carer->>S: Opens link → name + password → Set up my access
    S-->>Carer: Home page: "People you care for"<br/>released summaries only, never a score
    Pt->>S: Remove (type REMOVE)
    S-->>Carer: Access ends immediately
```

---

## 0.9 Records between hospitals

```mermaid
flowchart LR
    R1["Clinician: Request record from elsewhere<br/>(attending · NP/PA · case manager)"] --> Q
    R2["Hospital Admin: Request a record"] --> Q
    IN["Record arriving from another hospital"] --> Q
    Q["Interop & transfer queue<br/>(Hospital Admin)"] --> M{"Identity match<br/>+ consent basis"}
    M -- "Reason + Confirm match & accept" --> ACC["Record received"]
    M -- "Reject" --> REJ["Nothing received"]
```

Every transfer needs a consent basis and a human identity check; below the match threshold a
person must always decide. How far transfers can reach depends on the hospital's plan
([chapter 6, section 6.9](06-hospital-admin-and-it-admin.md#69-interop--record-transfer-hospital-admin)).

---

## 0.10 Emergency access by ESAP staff (break-glass)

```mermaid
sequenceDiagram
    actor Op as Super-Admin
    participant S as ESAP server
    actor Op2 as A second operator

    Op->>S: Break-glass → Request access<br/>one patient · reason · ticket · duration
    S-->>Op2: Awaiting your approval
    Op2->>S: Approve (never your own request)
    Op->>S: Start
    S-->>Op: Countdown banner on every screen<br/>everything logged with the reason
    Note over Op,S: Ends automatically when the clock runs out,<br/>or early with "End elevated access"
```

ESAP staff have no standing access to any patient. A hospital can switch this route off in
**Org settings** ([chapter 8, section 8.6](08-platform-operations.md#86-break-glass)).

---

## 0.11 The rules the whole system follows

| Rule | What it means for you |
|---|---|
| **Admission-time cut (t₀)** | Only what was known at admission reaches a model. Later results are saved to the chart but never used. |
| **Decision support, not diagnosis** | Every estimate describes similar past admissions. A clinician reads it and decides. |
| **Calibrated and explained** | Each number has a calibration badge and a **Why?** panel computed from the model itself. |
| **Fairness** | Race, insurance and marital status are recorded only for the fairness audit, never used by a model. |
| **Role-based access** | You see only what your role needs; the server enforces it on every request. |
| **Everything is audited** | Views, changes, exports and refusals all go to the audit log. |
| **Patients never see a score** | The portal shows only summaries a clinician wrote and released. |

Next: [1. Signing in and finding your way →](01-signing-in-and-navigation.md)
