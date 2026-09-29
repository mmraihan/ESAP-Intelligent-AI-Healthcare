# ESAP — Test Results: Hospital C (Summit Care Hospital)

> **Final acceptance run. 100% through the frontend UI in a visible browser — no API/curl
> was used for anything, including verification.** Local synthetic demo accounts only (local
> SQLite, no real PHI); do not reuse these passwords anywhere real.

---

## Run C1 — Cold creation + all roles + role cross-checks, entirely in the UI (2026-09-27)

**Environment:** frontend http://localhost:5175 · visible (headed) Chromium · every action below
was a real click/type on the actual screens.

**Method:**
1. **Super-Admin** signs in → `/ops/provision` wizard, all 6 steps filled.
2. Provision shows the **first-admin invite link** → **acceptance page** (confirm email → set
   password) → Hospital Admin created → signs in.
3. Hospital Admin → **`/admin/invites` composer** → sent all 11 role invites → each acceptance
   link opened on the **acceptance page** and completed.
4. **Every one of the 12 accounts signed in through the login screen** and landed on the
   correct home (0 console errors).
5. **Role cross-checks:** signed-in-as-wrong-surface and signed-out navigations were attempted
   and correctly blocked.

### Hospital created (via the provision wizard)

| Field | Value |
|---|---|
| Name | Summit Care Hospital |
| Slug | `summit-care-hospital` |
| Plan | Professional |
| Beds | 220 · Assessment allowance 9,000/cycle |
| Deployment | Multi-tenant SaaS · Schema per tenant · US East |
| Integrations | SSO + ADT + FHIR on, TEFCA off |
| Created by | Super-Admin (`rmoravec@esap.health` / `esap-demo`) |
| Tenant id | assigned automatically (visible in Ops → Fleet) |
| Result | ✅ PASS |

### Accounts — all 12, each UI sign-in confirmed (password `TestPass123!`)

| Account | Email | Role (confirmed) | UI sign-in → | Result |
|---|---|---|---|---|
| Hospital Admin | `admin@summit.example` | tenant_owner | `/admin/home` | ✅ PASS |
| Attending Physician | `physician@summit.example` | physician | `/doctor/worklist` | ✅ PASS |
| Resident / Fellow | `resident@summit.example` | resident | `/doctor/worklist` | ✅ PASS |
| NP / PA | `np-pa@summit.example` | np_pa | `/doctor/worklist` | ✅ PASS |
| Charge Nurse | `charge-nurse@summit.example` | charge_nurse | `/nurse/roster` | ✅ PASS |
| Staff / Bedside Nurse | `staff-nurse@summit.example` | staff_nurse | `/nurse/my-patients` | ✅ PASS |
| Case Manager | `case-mgr@summit.example` | case_manager | `/doctor/worklist?tab=discharge` | ✅ PASS |
| Clinical Pharmacist | `pharmacist@summit.example` | pharmacist | `/doctor/worklist` | ✅ PASS |
| IT Admin | `it-admin@summit.example` | it_admin | `/admin/integrations` | ✅ PASS |
| Privacy Officer | `privacy@summit.example` | privacy_officer | `/admin/audit` | ✅ PASS |
| Billing Admin | `billing@summit.example` | billing_admin | `/admin/billing` | ✅ PASS |
| Quality / QI Auditor | `auditor@summit.example` | auditor | `/admin/usage` | ✅ PASS |

### Role cross-checks ("tricking the roles") — all in the UI

| Signed in as | Tried to open | Result | Verdict |
|---|---|---|---|
| Auditor (admin surface) | `/doctor/worklist` (clinician) | bounced → `/admin/usage` | ✅ blocked |
| Auditor | `/ops/fleet` (platform) | bounced → `/admin/usage` | ✅ blocked |
| Staff Nurse (clinician) | `/admin/home` (admin) | bounced → `/nurse/my-patients` | ✅ blocked |
| Staff Nurse | `/ops/fleet` (platform) | bounced → `/nurse/my-patients` | ✅ blocked |
| Logged out | `/admin/home` | redirected → `/login?next=/admin/home` | ✅ blocked |

> Route guards are **surface-level** (clinician / admin / ops / patient). Within a surface,
> fine-grained data access is enforced by the backend (e.g. an auditor opening `/admin/billing`
> sees the shell but the billing data itself is permission-gated server-side).

### Summary
**1 hospital + 12 accounts (admin + all 11 roles) created and signed in entirely through the
UI; 5 role cross-checks blocked correctly. No API/curl used anywhere. All green. ✅**

---

## Run C2 — Set up a unit + admit a patient (UI, 2026-09-27)

All in the visible browser.
1. **Hospital Admin** (`admin@summit.example`) → `/admin/facilities` → Add facility → Add unit → **4-West (Med/Surg)**.
2. **Physician** (`physician@summit.example`) → New encounter → demo profile → name + MRN + unit → **Admit & run assessment**.

| Patient | MRN | Unit | Encounter | Result |
|---|---|---|---|---|
| Gamma Patient C (45 F) | MRN-900003 | 4-West (Med/Surg) | `enc_6182f6b891` | ✅ PASS (differential + risk gauges + LOS, 0 errors) |

**Run C2 summary:** tenant-scoped patient admitted + assessed for Summit Care, via the UI. ✅

---

## Run C3 — (add your next run here)
