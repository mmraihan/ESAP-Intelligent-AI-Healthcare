# ESAP — Front-End Testing Runbook (from an empty database)

Everything here is done **in the browser** at **http://localhost:5175**. It walks a real
cold start: seed the platform super-admin → create hospitals → seat each hospital's admin →
that admin creates every role → verify each one can sign in.

> **First, two corrections to the mental model:**
> 1. **There is no "super-admin per hospital."** Super-Admin is a *platform* role (creates
>    hospitals, has zero standing access to patient data). The top role *inside* a hospital
>    is **Hospital Admin (`tenant_owner`)**.
> 2. **Hospitals are created by the Super-Admin** in the Ops console (`/ops/provision`).
>    Provisioning now also **seats the hospital's first admin** (it creates a `tenant_owner`
>    invite and shows you the link). That admin then invites everyone else.

---

## 0. Start-up (the "seed a super-admin" step)

The backend **auto-seeds on an empty DB**: on first start it creates the platform
super-admin + a few demo hospitals with their staff. So you don't hand-create the first
super-admin — starting the server *is* that step.

```bash
# Backend (from system/system-final-v/backend), Python 3.10+ recommended
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed --reset            # empty DB -> seeded platform + demo hospitals
uvicorn app.main:app --reload --port 8000
# Frontend (from system/system-final-v/frontend)
npm install && npm run dev             # http://localhost:5175
```

**Seeded Super-Admin:** `rmoravec@esap.health` / `esap-demo` (or the **Super-Admin** button on the login page).

> To rehearse a *truly* empty start (no demo hospitals), that "super-admin only" bootstrap
> isn't built yet — ask and I'll add it. For testing, the seeded data is the fast path.

---

## 1. Who creates whom (the authority map)

| Thing | Created by | Where (frontend) | Self-register? |
|---|---|---|---|
| **Hospital** | Super-Admin | `/ops/provision` | — |
| **Hospital Admin** (`tenant_owner`) | Super-Admin (at provision) **or** another Hospital Admin | provision card / `/admin/invites` | ❌ |
| **IT Admin, Privacy Officer, Billing Admin, Auditor** | Hospital Admin | `/admin/invites` | ❌ |
| **Doctor, Resident, NP/PA, Charge Nurse, Staff Nurse, Case Manager, Pharmacist** | Hospital Admin (to join a hospital) | `/admin/invites` | ✅ only as a *solo/individual* account (not a hospital) |
| **Patient** | self, or a clinician admitting them | signup / New encounter | ✅ as an individual |
| **Caregiver** | the patient grants access | patient portal → sharing/family | ❌ |
| **Super-Admin** | seed / platform bootstrap | — | ❌ |

---

## 2. Create a hospital (Super-Admin) — VERIFIED ✅

1. Log in with the **Super-Admin** button.
2. Go to **`/ops/provision`** (Ops console → Provision).
3. Wizard:
   - **Step 1 Organisation:** legal name (slug auto-fills), primary contact email.
   - **Step 4 First administrator:** the admin's **name + email** (this seats the first Hospital Admin).
   - **Step 6 Review & create → Create tenant.**
4. A **"First administrator invite"** card appears with a link like
   `http://localhost:5175/invite/inv_…`. **Copy it.**
5. `/ops/fleet` — the new hospital appears (status *pending* until first activity).

Repeat for a **second hospital** (e.g. "Hospital A" and "Hospital B") so you can test
cross-hospital transfer later.

---

## 3. Create the Hospital Admin (accept the invite) — VERIFIED ✅

1. Open the invite link from step 2 (new tab / paste in the address bar).
2. **Confirm email** → **set a password + name** → finish.
3. Go to sign in → log in with that email + the password you set.
4. ✅ You land on **`/admin/home`** as **Hospital Admin**.

---

## 4. Hospital Admin creates every other role

As the Hospital Admin:

1. Go to **`/admin/invites`** → **Compose** an invite: pick a **role**, enter an **email**, send.
2. An **"Acceptance links"** banner shows the invite link — **copy it**.
3. Open the link → confirm email → set password → finish → sign in.
4. ✅ Confirm the new user lands on the **expected home** (table below).

Do this for each role you want to test. (Nurses, pharmacist, NP/PA, case manager, IT admin,
privacy officer, billing admin, auditor — and a second Hospital Admin if you want two.)

> `super_admin` is **refused** here by design (platform-only) — that's a correct negative test.

### Expected landing per role (verify each)

| Role | Signs in → lands on |
|---|---|
| Super-Admin | `/ops/fleet` |
| Hospital Admin (`tenant_owner`) | `/admin/home` |
| IT Admin | `/admin/integrations` |
| Privacy / Compliance Officer | `/admin/audit` |
| Billing Admin | `/admin/billing` |
| Quality / QI Auditor | `/admin/usage` |
| Physician / Resident / NP-PA / Pharmacist | `/doctor/worklist` |
| Charge Nurse | `/nurse/roster` |
| Staff Nurse | `/nurse/my-patients` |
| Case Manager | `/doctor/worklist?tab=discharge` |
| Patient | `/patient/home` |

---

## 5. Create patients & assign them to a hospital

A patient becomes **a hospital's patient** when a clinician admits them:

1. Sign in as a **Physician** (in that hospital).
2. `/doctor/worklist` → **New encounter** → enter the patient (name, MRN, demographics).
   *This assigns the patient to your hospital.*
3. Fill intake (or use the **Assistant** chat) → **Run assessment** → results.

A patient can **separately self-register** an individual portal account (login → "I am a
patient"), but that is the *individual* tier — it does not join a hospital. To be enrolled
in a hospital, the hospital admits them (above) or receives their record by transfer (§6).

---

## 6. Share a patient from Hospital A → Hospital B

As a **Hospital Admin** (a role with `transfer:initiate`):

1. `/admin/interop` → **request a record** from the other hospital.
   - Bare name → lands in **`mpi_review`** (low identity match).
   - Full name + MRN → **ready**.
   - Blank consent basis → **refused**.
2. **Approve** (consent-gated) → the transfer is approved and written to `/admin/audit`.

---

## 7. Shortcut: the seeded hospital (skip creation)

If you just want to test the *consoles* without building a hospital, every seeded role has a
one-click button on the login page (all use `esap-demo`). Use those to jump straight into any
console. Use §2–§4 when you specifically want to prove **creation + first sign-in** works.

---

## 8. Sign-off checklist

| Step | ✓ |
|---|---|
| Super-Admin signs in | ☐ |
| Create Hospital A (with first-admin email) → invite link shown | ☐ |
| Create Hospital B | ☐ |
| Accept admin invite → Hospital Admin signs in → `/admin/home` | ☐ |
| Invite + accept + sign-in: Physician | ☐ |
| … Resident (co-sign path) | ☐ |
| … Charge Nurse | ☐ |
| … Staff Nurse | ☐ |
| … Case Manager | ☐ |
| … Pharmacist / NP-PA | ☐ |
| … IT Admin | ☐ |
| … Privacy Officer | ☐ |
| … Billing Admin | ☐ |
| … Auditor | ☐ |
| super_admin invite refused (negative test) | ☐ |
| Admit a patient (assigned to hospital) | ☐ |
| Patient self-registers (individual) | ☐ |
| Transfer A → B (MPI + consent + audit) | ☐ |
| Chat assistant enters data + runs assessment | ☐ |
