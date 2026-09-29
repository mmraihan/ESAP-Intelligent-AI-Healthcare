# ESAP — Test Results & Account Ledger

> Living log of test runs. Append new runs at the top. **Local synthetic demo accounts only** (local SQLite, no real PHI). Do not reuse these passwords anywhere real.

---

## Run 1 — Cold start → hospital → all roles (2026-09-27)

**Environment:** frontend http://localhost:5175 · backend http://localhost:8000 · DB reset & reseeded.
**Method:** Super-Admin (seeded) → provisioned a hospital via `/ops/provision` (all fields) → accepted the first-admin invite in the browser → Hospital Admin invited every role → each accepted and signed in. Verified landing page per role.

### Platform

| Account | Email | Password | Role | Signs in → | Result |
|---|---|---|---|---|---|
| Super-Admin (seeded) | `rmoravec@esap.health` | `esap-demo` | super_admin | `/ops/fleet` | ✅ PASS |

### Hospital created

| Field | Value |
|---|---|
| Name | Test General Hospital |
| Slug | `test-general-hospital` |
| Tenant id | `t_d98e0cfe` |
| Plan | Professional |
| Beds | 300 · Assessment allowance 12,000/cycle |
| Deployment | Multi-tenant SaaS · Schema per tenant · US East |
| Integrations | SSO + ADT + FHIR on, TEFCA off |
| Status | pending (until first clinical activity) |
| Result | ✅ PASS — provisioned, first-admin invite link issued |

### Accounts created in this hospital

| Account | Email | Password | Role (confirmed) | Signs in → | Result |
|---|---|---|---|---|---|
| Hospital Admin | `admin@testgeneral.example` | `TestPass123!` | tenant_owner | `/admin/home` | ✅ PASS |
| physician | `physician@testgeneral.example` | `TestPass123!` | physician | `/doctor/worklist` | ✅ PASS |
| resident | `resident@testgeneral.example` | `TestPass123!` | resident | `/doctor/worklist` | ✅ PASS |
| np_pa | `np-pa@testgeneral.example` | `TestPass123!` | np_pa | `/doctor/worklist` | ✅ PASS |
| charge_nurse | `charge-nurse@testgeneral.example` | `TestPass123!` | charge_nurse | `/nurse/roster` | ✅ PASS |
| staff_nurse | `staff-nurse@testgeneral.example` | `TestPass123!` | staff_nurse | `/nurse/my-patients` | ✅ PASS |
| case_manager | `case-manager@testgeneral.example` | `TestPass123!` | case_manager | `/doctor/worklist?tab=discharge` | ✅ PASS |
| pharmacist | `pharmacist@testgeneral.example` | `TestPass123!` | pharmacist | `/doctor/worklist` | ✅ PASS |
| it_admin | `it-admin@testgeneral.example` | `TestPass123!` | it_admin | `/admin/integrations` | ✅ PASS |
| privacy_officer | `privacy-officer@testgeneral.example` | `TestPass123!` | privacy_officer | `/admin/audit` | ✅ PASS |
| billing_admin | `billing-admin@testgeneral.example` | `TestPass123!` | billing_admin | `/admin/billing` | ✅ PASS |
| auditor | `auditor@testgeneral.example` | `TestPass123!` | auditor | `/admin/usage` | ✅ PASS |

### Negative / guardrail checks

| Check | Expected | Actual | Result |
|---|---|---|---|
| Hospital Admin invites `super_admin` | refused (platform-only) | HTTP 403 | ✅ PASS |

**Run 1 summary:** 13/13 accounts created & signed in · 1 hospital provisioned · 1 guardrail check passed. **All green.**

---

## Run 2 — Full invite flow through the real UI (2026-09-27)

**Why:** Run 1 created the 11 staff roles by calling the backend from the browser console.
Run 2 proves the same works by **clicking through the actual frontend screens** end to end.

**Steps (all in a visible browser):** signed in as the Hospital Admin → `/admin/invites` →
**Invite someone** modal → filled email + selected **Charge Nurse** + scope → **Send invite** →
the **"Acceptance links" banner** showed the link → opened it → **acceptance page** (confirm
email → set name + password) → **Go to sign in** → signed in.

| Account | Email | Password | Role | Signs in → | Result |
|---|---|---|---|---|---|
| Charge Nurse (via UI) | `ui-nurse3@testgeneral.example` | `TestPass123!` | charge_nurse | `/nurse/roster` | ✅ PASS |

**Bug found & fixed during this run:** the invite send returned 201 but the "Acceptance
links" banner did **not** appear — `actAndRefresh()` re-hydrated and remounted the page,
wiping the local `links` state before it rendered (same class of bug as the provision screen).
Fixed in `src/apps/admin/AdminInvites.tsx`: record the link into module state **before**
re-hydrating. Re-verified: banner now shows the link. ✅

**Run 2 summary:** full frontend invite → accept → sign-in path verified for a staff role;
1 UI bug found and fixed. **All green.**

---

## Run 3 — Set up a unit + admit a patient (UI, 2026-09-27)

All in the visible browser.
1. **Hospital Admin** (`admin@testgeneral.example`) → `/admin/facilities` → **Add facility** → **Add unit** → created **4-West (Med/Surg)** (Medicine, 24 beds).
2. **Physician** (`physician@testgeneral.example`) → **New encounter** → prefilled a demo profile → set name + MRN + unit → **Admit & run assessment**.

| Patient | MRN | Unit | Encounter | Assessment | Result |
|---|---|---|---|---|---|
| Alpha Patient A (68 M) | MRN-900001 | 4-West (Med/Surg) | `enc_906cae3da1` | M-01 differential + M-02/03/04 gauges (Calibrated) + M-05 LOS, 7/7 signal | ✅ PASS |

**Run 3 summary:** first tenant-scoped patient admitted and assessed for this hospital, entirely via the UI, 0 console errors. ✅

---

## Run 4 — (add your next run here)

_Template: environment, what you did, and a table of accounts/results._

