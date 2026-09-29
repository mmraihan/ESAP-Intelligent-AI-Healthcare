# ESAP — Test & Demo Plan

**App:** http://localhost:5175 · **API:** http://localhost:8000 · **Demo password:** `esap-demo`
Every role has a one-click button on the login screen, so you rarely type credentials.

---

## 0. The roles you have (14)

| # | Role | Console / surface | What they do | How to sign in |
|---|---|---|---|---|
| 1 | **Attending Physician** | Clinician | Runs assessments, reads Why panels, acknowledges, discharges | role button |
| 2 | **Resident / Fellow** | Clinician | Same workspace; acknowledgements route to attending co-sign | role button |
| 3 | **NP / PA** | Clinician | Full clinical workspace | (invite) |
| 4 | **Charge Nurse** | Clinician (nurse) | Whole-unit roster, triage, handoff | role button |
| 5 | **Staff / Bedside Nurse** | Clinician (nurse) | Captures intake & vitals, escalates | role button |
| 6 | **Case Manager** | Clinician | Discharge planning, LOS/readmission | role button |
| 7 | **Pharmacist** | Clinician | Reads patient + explanations | (invite) |
| 8 | **Hospital Admin (tenant_owner)** | Admin | Roster, invites, units, model policy, interop, billing | role button |
| 9 | **IT Admin** | Admin | Integrations / SSO / provisioning (never clinical roles) | role button |
| 10 | **Compliance / Privacy Officer** | Admin | Audit log + fairness (cannot open a chart) | role button |
| 11 | **Billing Admin** | Admin | Plan / usage / invoices only | role button |
| 12 | **Quality / QI Auditor** | Admin | Fairness/calibration evidence, de-identified exports | role button |
| 13 | **Super-Admin (Platform)** | Ops | Provisions hospitals, fleet, break-glass; **zero standing PHI** | role button |
| 14 | **Patient / Caregiver** | Patient | Plain-language results, sharing, chat — **never a raw score** | role button |

> **Who creates what:** Super-Admin creates **hospitals**. Hospital Admin creates **staff of any role except super_admin**. Clinicians create **patients** (by admitting an encounter into their hospital).

---

## Part 1 — End-to-end test script

Run the scenarios in order; each builds on the last. Tick the checkbox as you go.

### Scenario 0 — Platform: create a hospital
Sign in as **Super-Admin**.
- [ ] `/ops/fleet` — see all tenants (hospitals).
- [ ] `/ops/provision` — **create a new hospital** (name, slug, plan, region, seats). Confirm it appears in the fleet.
- [ ] `/ops/tenants/:id` — open it; try **suspend** then **activate**.
- [ ] Confirm Super-Admin **cannot open a patient chart** without break-glass (`/ops/break-glass` → request → approve → the countdown banner appears).
- [ ] `/ops/audit` — the break-glass action is logged.

### Scenario 1 — Hospital Admin onboards staff (create every role)
Sign in as **Hospital Admin**.
- [ ] `/admin/home` — overview loads.
- [ ] `/admin/invites` → **send an invite** for each role: physician, resident, np_pa, charge_nurse, staff_nurse, case_manager, pharmacist, it_admin, privacy_officer, billing_admin, auditor. (super_admin is **refused** — platform only.)
- [ ] Copy an invite link → open `/invite/<token>` → set a password → you're signed in as that new user.
- [ ] `/admin/roster` — the new user appears; try a **role change** and a **suspend** (with reason).
- [ ] `/admin/facilities` — add a facility / unit.
- [ ] `/admin/roles` — review the RBAC matrix.

### Scenario 2 — Clinician: admit a patient (assign to this hospital) → assess → discharge
Sign in as **Attending Physician**.
- [ ] `/doctor/worklist` → **New encounter** → enter the patient (name, MRN, demographics). *This admits the patient into your hospital (tenant).* 
- [ ] Fill intake (or use the **chat assistant** — see Scenario 6) → **Run assessment**.
- [ ] `/…/results` — 5 model gauges + **Why** panels; M-04 shows **degraded**; calibration badge honesty.
- [ ] `/…/timeline`, `/…/history` tabs.
- [ ] **Acknowledge** the result.
- [ ] `/doctor/discharge` → **Discharge** button → encounter closes.

### Scenario 3 — Nurse flows (two surfaces)
- [ ] **Charge Nurse**: `/nurse/roster` (unit ranked), `/nurse/triage`, `/nurse/handoff`.
- [ ] **Staff Nurse**: `/nurse/my-patients`, capture intake → `/…/vitals`, read-only results (nurse **escalates**, does not acknowledge).

### Scenario 4 — Resident co-sign
- [ ] As **Resident**, assess & **acknowledge** an encounter → it goes to **awaiting co-sign**.
- [ ] As **Attending**, **Discharge/close** that encounter → it records your **co-sign** (a resident cannot close it themselves).

### Scenario 5 — Patient / Caregiver portal
Sign in as **Patient**.
- [ ] `/patient/home` → results (plain language, **no probability**), records.
- [ ] `/patient/sharing` → **grant** a consent to share, then **revoke** it.
- [ ] `/patient/care-team`, `/patient/family`, `/patient/settings` → switch language to **Arabic (RTL)**.
- [ ] Use the **chat assistant** to describe symptoms (Scenario 6) — no "Run assessment" button for a patient.

### Scenario 6 — Chat assistant (all roles)
On any screen, click **Assistant** (bottom-right).
- [ ] As a **clinician**: type "72 yo man with COPD and afib, on furosemide, BP 138/84" → see captured chips → **Run assessment from this** → summary appears.
- [ ] As a **patient**: type "I'm 60, female, I have asthma, BP 130/85" → plain-language reply, captured chips, **no run button, no score**.
- [ ] Confirm extracted **history/labs are flagged for confirmation**.

### Scenario 7 — Cross-hospital transfer (A → B)
Sign in as **Hospital Admin** (a role with `transfer:initiate`).
- [ ] `/admin/interop` → **request a record** from another hospital.
  - [ ] With a **bare name** → lands in **`mpi_review`** (low match score).
  - [ ] With **full name + MRN** → **ready** (high score).
  - [ ] Blank consent basis → **refused**.
  - [ ] Counterparty that is another ESAP tenant → **ESAP fast path**; an external EHR → **TEFCA** (needs a Professional+ plan).
- [ ] **Approve** a transfer (consent-gated) → state becomes approved.
- [ ] `/admin/audit` — the transfer request + decision are logged.

### Scenario 8 — Security & guardrails (the differentiators)
- [ ] **Route guards**: while signed out, type `/admin/home` → bounced to `/login`. As Hospital Admin, type `/ops/fleet` → bounced to your admin home.
- [ ] **Model policy**: Admin → `/admin/models` → disable a model / suppress a CCSR category → run an assessment as a clinician → it's **gone**.
- [ ] **Plan entitlements**: a Free-tier account never gets M-01 (differential).
- [ ] **MFA**: enrol via API (`/auth/mfa/enroll` → `/auth/mfa/activate`) → next login shows the **code step**.
- [ ] **SSO**: Admin → Integrations → enable SSO for a domain → `POST /auth/sso/dev-login` → session auto-provisioned.
- [ ] **Fairness firewall**: race/insurance never change a score (Admin → `/admin/fairness`).
- [ ] **Sign out** from a workspace → lands on `/login`.

---

## Part 2 — The presentation

**Audience:** clinical leadership / hospital buyer / investors. **Length:** ~15–20 min + live demo.
**Through-line:** *"Calibrated, explainable decision support at the moment of admission — built multi-hospital, safe by construction."*

### Slide outline
1. **Title** — ESAP Intelligent AI Healthcare · one line: intake-time decision support, not diagnosis.
2. **The problem** — risk answers arrive at discharge, too late to change anything; and black-box scores erode trust.
3. **What ESAP does** — 5 models at admission (differential, mortality, ICU, readmission, LOS), each **calibrated + explained**.
4. **Live demo #1 — a clinician's minute** *(see script below)*.
5. **The product, not just the model** — four consoles (clinician / admin / patient / platform), one design system.
6. **Multi-hospital by design** — Super-Admin provisions hospitals; per-tenant isolation; plans/entitlements.
7. **Live demo #2 — onboard a hospital + a doctor** (Scenario 0 + 1, abbreviated).
8. **The patient side** — plain-language results, consent/sharing, Arabic RTL, chat.
9. **Cross-hospital records (A → B)** — MPI match + consent gate + audit. *(demo the mpi_review vs ready difference)*.
10. **Chat assistant** — anyone enters data by talking; LLM + deterministic; run assessment from chat.
11. **Safe by construction** — route guards, RBAC, MFA/SSO, break-glass, audit log, fairness firewall, "decision support not diagnosis," calibration honesty (M-04 degraded shown on purpose).
12. **What's live vs. roadmap** — be honest (the landing page already lists this): towers B/C fusion, Postgres/RLS, billing.
13. **Ask / next step** — pilot offer.

### Live-demo script (5 minutes, rehearse this exact path)
1. Land on the public site → "here's what's live and what isn't" (honesty slide, built in).
2. Sign in as **Attending Physician** → open the **chat assistant** → type one sentence → **Run assessment** → open **results** → expand a **Why** panel → point at the **degraded** M-04 badge.
3. **Acknowledge** → **Discharge**.
4. Switch to **Hospital Admin** → `/admin/models` → suppress a category → back to a clinician → show it's gone (proves policy is enforced, not cosmetic).
5. **Hospital Admin** → `/admin/interop` → request a transfer with a bare name (→ mpi_review) then full name+MRN (→ ready) → approve → show the **audit log** row.
6. Switch to **Super-Admin** → `/ops/fleet` → `/ops/provision` a hospital → mention **zero standing PHI / break-glass**.
7. Sign in as **Patient** → results with **no score** → sharing toggle → Arabic.

### Making the deck
- Fastest: I can generate a **styled HTML slide deck** (an artifact you can present full-screen and share a link to) from this outline — say the word.
- Or export screenshots from each screen (I can capture them headless) and drop into PowerPoint/Google Slides.

---

## Part 3 — Coverage checklist (tick to sign off)

| Capability | Tested |
|---|---|
| Create hospital (super-admin) | ☐ |
| Suspend / activate hospital | ☐ |
| Invite + accept — every role | ☐ |
| Role change / suspend user | ☐ |
| Admit patient (assign to hospital) | ☐ |
| Intake → assess → results → Why panels | ☐ |
| Acknowledge + resident co-sign | ☐ |
| Discharge / close | ☐ |
| Nurse roster / triage / handoff / vitals | ☐ |
| Case-manager discharge planning | ☐ |
| Patient portal (no scores) + sharing/consent | ☐ |
| Chat assistant — clinician (run assessment) | ☐ |
| Chat assistant — patient (guided, no score) | ☐ |
| Cross-hospital transfer (MPI + consent) | ☐ |
| Model disable / CCSR suppression enforced | ☐ |
| Plan entitlements (Free ≠ Enterprise) | ☐ |
| Route guards (logged-out / wrong-role) | ☐ |
| MFA enrol + login challenge | ☐ |
| SSO discover + dev-login | ☐ |
| Break-glass + audit | ☐ |
| Fairness firewall | ☐ |
| Sign in / sign out | ☐ |
