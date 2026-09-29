# ESAP — Test Results: Patients & Caregivers (self-registration)

> Done **100% through the frontend UI** in the visible browser. Local synthetic demo accounts
> only (local SQLite, no real PHI); do not reuse these passwords anywhere real.

---

## Important: how patients & caregivers relate to hospitals

- A **patient self-registers** on the signup screen ("I am a patient or a carer") and lands in
  the **individual / self-serve tier** — they are **not** attached to a specific hospital tenant.
  (To be *a hospital's* patient, a clinician admits them via **New encounter**; that is a
  separate flow.)
- A **caregiver** does not create a password login. The patient registers them in the portal's
  **Family access** screen ("Add someone"): name, email, relationship, and access level. That
  creates a **consent grant** on the patient's record (attributable proxy access), which is the
  product's intended, safer alternative to password-sharing.

So the three patient/caregiver pairs below are labelled A/B/C to line up with the three test
hospitals, but the patients themselves are individual-tier accounts (by design).

---

## Run P1 — 3 patients + 3 caregivers, all via the UI (2026-09-27)

**Patient flow (each):** `/signup` → "I am a patient or a carer" → Continue → name + email +
password → **Create account** → landed on `/welcome`; sign-in later confirmed → `/patient/home`.

**Caregiver flow (each):** signed in as the patient → `/patient/family` → **Add someone** →
name + email + relationship + access level → **Send invitation** → caregiver appears in the list.

| # | Patient (login) | Password | Patient sign-in → | Caregiver registered (family access) | Result |
|---|---|---|---|---|---|
| A | `patient-a@example.com` | `TestPass123!` | `/patient/home` | Carer A Family · `caregiver-a@example.com` | ✅ PASS |
| B | `patient-b@example.com` | `TestPass123!` | `/patient/home` | Carer B Family · `caregiver-b@example.com` | ✅ PASS |
| C | `patient-c@example.com` | `TestPass123!` | `/patient/home` | Carer C Family · `caregiver-c@example.com` | ✅ PASS |

### Verified in the UI
- All 3 patients **registered** through the signup screen and **signed in** on the login screen (→ `/patient/home`, 0 console errors).
- All 3 caregivers **registered** through the patient portal's Family-access form; each appears in the patient's family list after sending.

**Run P1 summary:** 3 patients + 3 caregivers created entirely through the frontend UI. **All green. ✅**

---

## Run P2 — (add your next run here)
