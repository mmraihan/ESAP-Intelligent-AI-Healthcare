# ESAP — Test Results: Hospital B (Riverside Medical Center)

> Second hospital, created and populated **entirely through the browser UI** (no API shortcuts
> for creation). **Local synthetic demo accounts only** (local SQLite, no real PHI) — do not
> reuse these passwords anywhere real. Append later runs at the bottom.

---

## Run B1 — Create Hospital B + its roles, all in the browser (2026-09-27)

**Environment:** frontend http://localhost:5175 · backend http://localhost:8000 · visible (headed) browser.

**Method (every creation step done by clicking the real screens):**
1. Signed in as **Super-Admin** → `/ops/provision` wizard (all 6 steps, all fields).
2. Provision returned the **first-admin invite link** → opened the **acceptance page** → set password → Hospital Admin created → signed in.
3. As the Hospital Admin → `/admin/invites` **Invite someone** form → sent one invite per role → **Acceptance links banner** → opened each link → acceptance page → set password.
4. Verified each account authenticates with the correct role, landing page, and tenant.

### Hospital created

| Field | Value |
|---|---|
| Name | Riverside Medical Center |
| Slug | `riverside-medical-center` |
| Tenant id | `t_116a30b9` |
| Plan | Professional |
| Beds | 180 · Assessment allowance 8,000/cycle |
| Deployment | Multi-tenant SaaS · Schema per tenant · US East |
| Integrations | SSO + ADT + FHIR on, TEFCA off |
| Created by | Super-Admin (`rmoravec@esap.health` / `esap-demo`) |
| Result | ✅ PASS — provisioned via the wizard, first-admin invite issued |

### Accounts created in this hospital — ALL 12 (all `TestPass123!`, tenant `t_116a30b9`)

Every row: invite **sent via the `/admin/invites` composer**, accepted on the **acceptance page**,
and the **sign-in confirmed by an actual UI login** (landed on the screen shown, 0 console errors).

| Account | Email | Password | Role (confirmed) | UI sign-in → | Result |
|---|---|---|---|---|---|
| Hospital Admin | `admin@riverside.example` | `TestPass123!` | tenant_owner | `/admin/home` | ✅ PASS |
| Attending Physician | `physician@riverside.example` | `TestPass123!` | physician | `/doctor/worklist` | ✅ PASS |
| Resident / Fellow | `resident@riverside.example` | `TestPass123!` | resident | `/doctor/worklist` | ✅ PASS |
| NP / PA | `np-pa@riverside.example` | `TestPass123!` | np_pa | `/doctor/worklist` | ✅ PASS |
| Charge Nurse | `charge-nurse@riverside.example` | `TestPass123!` | charge_nurse | `/nurse/roster` | ✅ PASS |
| Staff / Bedside Nurse | `staff-nurse@riverside.example` | `TestPass123!` | staff_nurse | `/nurse/my-patients` | ✅ PASS |
| Case Manager | `case-mgr@riverside.example` | `TestPass123!` | case_manager | `/doctor/worklist?tab=discharge` | ✅ PASS |
| Clinical Pharmacist | `pharmacist@riverside.example` | `TestPass123!` | pharmacist | `/doctor/worklist` | ✅ PASS |
| IT Admin | `it-admin@riverside.example` | `TestPass123!` | it_admin | `/admin/integrations` | ✅ PASS |
| Privacy Officer | `privacy@riverside.example` | `TestPass123!` | privacy_officer | `/admin/audit` | ✅ PASS |
| Billing Admin | `billing@riverside.example` | `TestPass123!` | billing_admin | `/admin/billing` | ✅ PASS |
| Quality / QI Auditor | `auditor@riverside.example` | `TestPass123!` | auditor | `/admin/usage` | ✅ PASS |

### How it was verified (all in the browser)
- **Hospital creation** — Super-Admin, provision wizard (all 6 steps).
- **First admin** — provision invite link → acceptance page → set password → signed in.
- **All 11 staff roles** — each invite sent through the `/admin/invites` composer → acceptance-link banner → acceptance page → set password.
- **Sign-in** — every one of the 12 accounts confirmed by a real **UI login** (visible browser), landing on the correct screen with 0 console errors.

### Notes
- Every account is scoped to tenant `t_116a30b9` (Riverside) — separate from Hospital A (`t_d98e0cfe`), confirming roster-level tenant isolation.
- The visible (headed) browser crashed once mid-run and was reconnected; all sign-ins were re-run and confirmed in the visible browser.
- Not yet done for this hospital: admit a patient, A→B transfer.

**Run B1 summary:** 1 hospital + **12 accounts (admin + all 11 roles)** created and signed in **through the browser UI**, each on the correct screen. **All green.**

---

## Run B2 — Set up a unit + admit a patient (UI, 2026-09-27)

All in the visible browser.
1. **Hospital Admin** (`admin@riverside.example`) → `/admin/facilities` → Add facility → Add unit → **4-West (Med/Surg)**.
2. **Physician** (`physician@riverside.example`) → New encounter → demo profile → name + MRN + unit → **Admit & run assessment**.

| Patient | MRN | Unit | Encounter | Result |
|---|---|---|---|---|
| Beta Patient B (74 F) | MRN-900002 | 4-West (Med/Surg) | `enc_0575aff183` | ✅ PASS (differential + risk gauges + LOS, 0 errors) |

**Run B2 summary:** tenant-scoped patient admitted + assessed for Riverside, via the UI. ✅

---

## Run B3 — (add your next run here)
