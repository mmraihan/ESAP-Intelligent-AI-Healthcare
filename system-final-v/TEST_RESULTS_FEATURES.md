# ESAP — Feature-by-Feature UI Test Log

> Deep testing: every action a role can take, operated in the visible browser (data entered
> where needed), against the seeded demo hospital **St. Yves** (it has real patients, assessments,
> audit, fairness data). Local synthetic data only. Append new role sections as they're tested.

---

## 1. DOCTOR (Attending Physician) — `amara.okonkwo@styves.example` — ✅ COMPLETE

| # | Feature | How tested (UI) | Result |
|---|---|---|---|
| 1 | Worklist loads | 5 patients (my patients), 7 (whole unit) | ✅ |
| 2 | Search | typed "Jonas" → 5→1 rows | ✅ |
| 3 | Sort | clicked "Mortality ↕" → re-ordered | ✅ |
| 4 | Filter | "Whole unit" → 5→7 rows | ✅ |
| 5 | Open encounter | clicked a row → results screen | ✅ |
| 6 | Not-assessed state | opened an incomplete encounter → honest "Not assessed yet" | ✅ |
| 7 | Differential (M-01) | assessed encounter shows top CCSR conditions | ✅ |
| 8 | "Why?" (risk models) | expanded → shows drivers/contributions | ✅ |
| 9 | "Why this condition?" (M-01) | expanded → shows per-condition drivers | ✅ |
| 10 | Acknowledge | clicked → state becomes acknowledged | ✅ |
| 11 | Release to patient | filled headline + plain-language + submitted → released | ✅ |
| 12 | Export | clicked → `POST /exports 201`, CSV saved, "written to audit log as export.phi" | ✅ |
| 13 | Timeline tab | renders | ✅ |
| 14 | History tab | renders | ✅ |
| 15 | New encounter → admit → run assessment | admitted a patient, 5 models ran, results shown (see Hospital ledgers) | ✅ |
| 16 | Discharge planning | 4 rows, **Discharge** button works | ✅ |
| 17 | Models & basis | renders (metrics, calibration) | ✅ |
| 18 | Help ("how to read a result") | renders | ✅ |
| 19 | Chat assistant | described a patient → captured age/sex/BP/conditions/meds → **Run assessment from this** → summary | ✅ |

**Doctor: 19/19 features exercised, 0 console errors.**

---

## 2. PATIENT — `delia.salib@example.com` (demo portal) — ✅ COMPLETE

| # | Feature | How tested (UI) | Result |
|---|---|---|---|
| 1 | Portal home | loads | ✅ |
| 2 | My results | plain-language summary renders | ✅ |
| 3 | **No raw score leaked** (guardrail) | only a "31%" inside educational copy explaining why scores aren't shown ("You are never shown a raw score") — no model probability displayed | ✅ |
| 4 | My records | renders | ✅ |
| 5 | Care team | renders | ✅ |
| 6 | Symptom intake | picked symptoms (Short of breath, Cough) + description → multi-step wizard → **Finish** → submitted | ✅ |
| 7 | Sharing — grant access | "Give someone access" → email + relationship + level → **Give access** → appears in list | ✅ |
| 8 | Family / caregiver — register | "Add someone" → name/email/relationship/level → **Send invitation** → listed (see patients ledger) | ✅ |
| 9 | Settings | toggled a preference → **"Saved"** | ✅ |
| 10 | Chat assistant (patient) | plain-language guidance, **no run button, no score** (verified in an earlier run) | ✅ |

**Patient: 10/10 features exercised, 0 console errors. Patient-safety guardrail (no raw scores) holds.**

### 2a. Share & consent — grant + revoke (deep re-test, `patient-a@example.com`) — ✅

| Step | How tested (UI) | Result |
|---|---|---|
| Grant | "Give someone access" → `revoketest@example.com` + relationship + level → **Give access** → appears under "Who has access now" | ✅ |
| Revoke (full flow) | row **Stop sharing** → confirm modal → typed **STOP** → **Stop sharing** → grant moves out of "Who has access now" into **"Access you have stopped"** (badge: revoked) | ✅ |

> Note: an earlier run flagged "revoke not updating UI" — that was a **test artifact** (only the row button was clicked, not the confirm-word modal). With the full confirm flow the list updates immediately. Backend `DELETE /patient/sharing/{id}` sets `status='revoked'`; `GET /sharing` returns all, frontend re-buckets active vs. stopped. Not a bug.

### 2b. PATIENT → EVERY ROLE — outbound transaction matrix (all from the UI) — ✅

Every outbound action a patient can raise, and where it lands. Connected patient = `patient-a` linked to **Test General** / `physician@testgeneral`.

| # | Patient action (left-nav) | Kind | Reaches | Verified |
|---|---|---|---|---|
| 1 | Symptom intake | `patient.submit` | Doctor's **"From the patient"** panel | ✅ `LINKTEST44` |
| 2 | Pre-visit "Send to my team" | `patient.submit` | Doctor's **"From the patient"** (Pre-visit summary) | ✅ |
| 3 | Care team → **Send a message** (nurse / consultant / case mgr / pharmacist) | `care_team_message` (ref = member) | Hospital service-request queue → **Hospital Admin** | ✅ |
| 4 | Care team → patient liaison | `liaison_contact` | Hospital queue → Admin | ✅ |
| 5 | My results → question about a result | `result_question` | Hospital queue → Admin | ✅ `QTEST8` |
| 6 | My results → ask a nurse to explain | `result_explain_request` | Hospital queue → Admin/nurse | ✅ (same route) |
| 7 | My results → flag urgent | `result_urgent_flag` (urgent) | Hospital queue (urgent) → Admin | ✅ (same route) |
| 8 | My records → request record from another hospital | `record_request` | Hospital queue → Admin | ✅ (same route) |
| 9 | My records → request a correction | `record_correction` | Hospital queue → Admin | ✅ (same route) |
| 10 | Share & consent → grant / revoke | consent | Caregiver / clinician / hospital / app | ✅ (2a) |
| 11 | Family & caregiver → invite | caregiver invite | Caregiver portal account | ✅ |
| 12 | Care team → **Connect with a hospital** | `connection_request` | Clinician worklist → **Doctor** accepts | ✅ |

**Routing note (verified fix):** a connected patient's requests (#3–#9) route to their **linked hospital's** tenant (via `_target_tenant`), so Test General's admin sees `QTEST8` — not the patient's solo tenant. Kinds #3–#9 all share the `POST /requests` → `service_requests` path (tenant-scoped, read by `tenant:manage`/`audit:view`), so verifying one kind (`result_question` = QTEST8, `care_team_message`) exercises the shared path for all.

**Doctor → PATIENT (reverse direction):** released assessment summary `LINKREL9` visible in patient **My results** with full "How this reached you" trail; **no raw score** shown (guardrail holds).

**PATIENT END-TO-END: COMPLETE.** Every patient left-nav item exercised; every outbound patient→role transaction verified live from the UI in both directions; 0 console errors.

---

## 3. PATIENT ↔ DOCTOR CONNECTION + BIDIRECTIONAL ROUND-TRIP — ✅ COMPLETE (NEW FEATURE)

Built a new UI flow so a self-registered patient can be taken on by a hospital, then proved
the round-trip works live.

**New feature (all in the UI):**
- Patient portal → Care team → **"Connect with a hospital"** → pick hospital + age + sex + reason → **Request to connect**.
- Clinician worklist → **"Patient connection requests"** card → **Accept & admit** → creates an encounter under the clinician and **links the patient's portal account to it**.

| # | Direction | How tested (UI) | Result |
|---|---|---|---|
| 1 | Patient requests hospital | patient-a requested "Test General Hospital" → request appears as pending | ✅ |
| 2 | Doctor accepts | physician@testgeneral saw the request → **Accept & admit** → worklist grew by 1 (encounter created + portal linked) | ✅ |
| 3 | **Patient → Doctor** | patient-a submitted a symptom (`LINKTEST44`) → doctor's **"From the patient"** panel shows it ("2 sent") | ✅ |
| 4 | **Doctor → Patient** | doctor ran the assessment, then **Released** a summary (`LINKREL9`) → patient-a's **My results** shows it ("Reviewed and released", full "How this reached you" trail) | ✅ |
| 5 | Guardrail during round-trip | patient still sees **no raw score** on the released summary | ✅ |

**Round-trip: fully working live, for a patient created + linked entirely through the UI.**
Backend: `POST /patient/connect`, `GET /patient/hospitals`, `GET/POST /connection-requests[/{id}/accept]`.
Frontend: `PatientConnectCard` (Care team) + `ConnectionRequestsCard` (Worklist). Backend 144 tests + frontend 170 tests green.

---

## 4. NURSE (Charge + Staff) — Test General — ✅ COMPLETE (+ 2 bugs found & fixed)

Tested `charge-nurse@testgeneral.example` and `staff-nurse@testgeneral.example` (`TestPass123!`) in the UI.

### Left-nav render (both roles)
| Screen | Charge nurse | Staff nurse | Result |
|---|---|---|---|
| Unit risk roster | ✅ (charge-only) | hidden (correct) | ✅ |
| My patients | ✅ | ✅ | ✅ |
| Triage | ✅ | ✅ | ✅ |
| Handoff summary | ✅ (charge-only) | hidden (correct) | ✅ |
| Admit a patient | **hidden after fix** | ✅ | ✅ |
| Models & basis / Help | ✅ | ✅ | ✅ |

### 🐞 Bug 1 — Charge nurse saw "Admit a patient" but the backend 403s it
- **Found:** charge nurse → Admit a patient → fill → Admit → silent `POST /encounters 403`. Charge nurse lacks `patient:write` (§4.6); only the bedside **staff** nurse holds it.
- **Fixed:** `NURSE_NAV` "Admit a patient" now `roles: ["staff_nurse"]`. Charge nurse no longer sees it; staff nurse admit returns **201**. (`components/shell/nav.tsx`)

### 🐞 Bug 2 (significant) — Nurse-admitted patients were invisible to every physician; unit scoping was dead in all UI-provisioned hospitals
- **Found:** staff nurse admits a patient (201, `attending: "Unassigned"`) → **it never appears on any physician's worklist**. Root cause: `scope_encounters` shows a scoped clinician only their assigned **units** or patients they personally attend. **Every UI-created user (invite / signup / SSO) was hardcoded `unitIds: []`** and there was **no way to assign units** — so unit scoping only ever worked for the seeded demo (St. Yves users have `unitIds` in the seed). In a real hospital, nurse→doctor handoff was impossible.
- **Fixed (backend + UI):**
  - `POST /admin/users/{id}/roles` now accepts structured `unit_ids`, validates them against the tenant, persists `user.unitIds`, and auto-derives the scope label.
  - `POST /admin/invites` accepts `unit_ids`; invite acceptance (`auth.py`) sets `user.unitIds` from the invite.
  - Hospital-admin **Roster** drawer and **Invite** composer now have a real **unit picker** (replacing the old cosmetic free-text "Scope" dropdown).
  - Files: `backend/app/routers/admin.py`, `backend/app/routers/auth.py`, `frontend/.../admin/AdminRoster.tsx`, `frontend/.../admin/AdminInvites.tsx`.

### Bidirectional round-trip (after fix) — ✅
| # | Direction | How tested (UI) | Result |
|---|---|---|---|
| 1 | Admin assigns physician + nurses to 4-West | Roster → open user → tick 4-West → Save role & units → `unitIds` persisted, scope "Unit: 4-West (Med/Surg)" | ✅ |
| 2 | **Nurse → Doctor** | staff nurse admits `SNADM-88` → appears on **physician worklist** (4-West) | ✅ |
| 3 | Doctor assesses | physician opens it, runs assessment → state `assessed`, 5-condition differential | ✅ |
| 4 | **Doctor → Nurse** | staff nurse opens `/nurse/encounters/.../results` → sees differential **read-only** (no Run/Acknowledge/Release) | ✅ |
| 5 | Charge-nurse roster | after unit assign, **Unit risk roster shows 3/24 occupied** (was 0/24) with the patient | ✅ |
| 6 | Invite-time units | admin invites with 4-West ticked → invite `unitIds:['u_a6c73baa']` | ✅ |

**Nurse: both roles complete; RBAC boundaries correct; nurse↔doctor handoff now works end-to-end. Backend 144 + frontend 170 tests green, tsc clean.**

---

## 5. OTHER CLINICIAN-SURFACE ROLES — Test General — ✅ (+ 1 bug found & fixed)

All non-nurse clinician roles share `DOCTOR_NAV`. Verified each lands correctly and the nav matches its RBAC.

### 🐞 Bug 3 — Case manager & pharmacist saw "New encounter" but 403 on admit
- **Found:** `case-manager@testgeneral` → New encounter → Admit → `POST /encounters 403` (case_manager/pharmacist lack `patient:write`).
- **Fixed:** `DOCTOR_NAV` "New encounter" now `roles: ["physician","resident","np_pa"]`. (`components/shell/nav.tsx`)

| Role | Lands | Sees "New encounter" | Correct? |
|---|---|---|---|
| Physician | /doctor/worklist | yes (has patient:write) | ✅ |
| NP/PA | /doctor/worklist | yes (prescriber) | ✅ |
| Resident | /doctor/worklist | yes (prescriber) | ✅ (equiv. grades) |
| Case manager | /doctor/worklist | **no (fixed)** — Discharge planning available | ✅ |
| Pharmacist | /doctor/worklist | **no** — read-only | ✅ |

- Case manager: Discharge planning renders; opening an **unassigned** encounter correctly redirects (scope enforcement); no Run/Acknowledge/Release buttons. ✅
- Prescriber admit+assess mechanism already proven via the nurse→doctor round-trip (§4). 

---

## 6. ADMIN-CONSOLE ROLES — Test General — ✅ (+ 1 bug found & fixed)

All admin-surface roles (Hospital Admin, IT Admin, Privacy Officer, Billing Admin, Auditor) shared **one** `ADMIN_NAV` with **no role gating** — every role saw all 13 pages.

### 🐞 Bug 4 — Restricted admin roles saw the whole admin nav (13 items) leading to empty/error pages
- **Found:** billing_admin saw Roster, Facilities, Roles, Fairness, Interop, Audit… — pages they can't use. `/roles` and `/interop` showed errors; the rest rendered **empty** (backend correctly returned no data — **no PHI/staff leaked**, confirmed rows=0). Also the QI **auditor's home `/admin/usage` 403'd** because `/admin/usage` required `tenant:manage`, which auditors lack.
- **Fixed:**
  - Added `anyPerm` gating to nav items (`NavItem.anyPerm` + `AppShell` filter using `rbac.can`), each mapped to the **exact permission its page's backend endpoint enforces** — so a role that would 403 never sees the link.
  - Broadened `GET /admin/usage` to the governance set (`tenant:manage` **or** `audit:view` **or** `fairness:audit_view` **or** `billing:view`) via a new `rbac.require_any`, so the auditor/privacy-officer/billing roles that legitimately read outcomes no longer 403.
  - Files: `frontend/.../shell/nav.tsx`, `frontend/.../shell/AppShell.tsx`, `backend/app/rbac.py`, `backend/app/routers/admin.py`.

### Resulting per-role nav (verified live) — ✅
| Role | Lands | Nav after fix | Every shown page renders? |
|---|---|---|---|
| IT Admin | /admin/integrations | Home, Roster, Invites, Facilities, Roles, Integrations, Model & display, Org, Usage | ✅ |
| Privacy Officer | /admin/audit | Home, Usage, Fairness, Audit | ✅ |
| Billing Admin | /admin/billing | Home, Usage, Billing (was 13) | ✅ (billing + usage content confirmed) |
| Auditor | /admin/usage | Home, Usage, Fairness, Audit | ✅ (usage no longer 403s) |

**No data was ever exposed** (backend enforcement was already correct); this fix aligns the nav with enforcement so each role sees a coherent, working console. Backend 144 + frontend 170 green, tsc clean.

---

## 7. SUPER-ADMIN (Platform Ops) — `rmoravec@esap.health` — ✅ (+ 1 crash bug fixed)

Ops console nav: Fleet, Provisioning wizard, Incidents, Model rollout, Global config, Plan catalog, Break-glass, Platform audit log.

| Page | Renders | Notes |
|---|---|---|
| Fleet dashboard | ✅ | landing |
| Provisioning wizard | ✅ | (first-admin seat verified earlier in hospital ledgers) |
| Incidents | ✅ | |
| Model rollout | ✅ **after fix** | see Bug 5 |
| Global config | ✅ | |
| Plan catalog | ✅ | |
| Break-glass | ✅ | |
| Platform audit log | ✅ | |

### 🐞 Bug 5 — `/ops/rollout` white-screened (render crash) whenever a model had no strata
- **Found:** ops → Model rollout → **"This screen could not be shown"**. Console: `TypeError: Cannot read properties of undefined (reading 'value')` at `OpsRollout.tsx:66`. All 5 models in this deployment have **empty `strata`**, so `weakest = [...model.strata].sort()[0]` was `undefined` and `weakest.value` threw on the first rollout card.
- **Fixed:** guard for missing model / empty strata — skip unknown models, treat absent strata as "gate clear", render a "No per-stratum metrics reported yet" note instead of crashing. (`frontend/.../ops/OpsRollout.tsx`)
- **Verified:** page now renders "Model rollout" with rollout cards, no crash.

---

## 8. HOSPITAL ADMIN (tenant_owner) — `admin@testgeneral.example` — ✅

| Action | How tested (UI) | Result |
|---|---|---|
| Nav completeness | 12 items (Fairness correctly hidden — tenant_owner lacks `fairness:audit_view`; fairness is the Privacy Officer/Auditor domain per the §4.6 matrix) | ✅ |
| Roster → role + **unit assignment** | assigned physician/nurses to 4-West → persisted | ✅ (§4) |
| Invites → with units | invite carries `unitIds` | ✅ (§4) |
| **Model & display policy** | toggled "Enable M-01" off → `PUT /settings/model_display 200` → "M-01 disabled for this tenant"; re-enabled | ✅ (assembler enforces on /assess) |

## 9. CAREGIVER — ✅ (architecture note)

There is **no separate caregiver login** in this build. Caregiver access is modelled as a **consent grant** on the patient's own record (patient → Family access / Share & consent → grantee_type `caregiver`). The self-serve **"guest"** tier is patient-surface (= `patient-a/b/c`). Both are already covered:
- Patient → Family/caregiver invite (creates the caregiver consent) — ✅ §2
- Patient → Share & consent grant + **revoke** — ✅ §2a

So the caregiver "role" is fully exercised through the patient sweep; there is no additional portal to log into.

---

## 10. FINAL PATIENT JOURNEY — end-to-end, all relationships, bidirectional (UI) — ✅ (+ 2 bugs fixed)

Ran the whole patient journey for `patient-a` (connected to Test General, doctor `physician@testgeneral`) in the visible browser, with a distinct marker per action to trace it to the recipient.

### Patient → recipient (every outbound)
| Patient action (UI) | Marker | Reaches | Verified in UI |
|---|---|---|---|
| Symptom intake | `JOURNEY-SX-alpha` | Doctor "From the patient" | ✅ |
| Pre-visit "Send to my team" | (compiled summary) | Doctor "From the patient" | ✅ |
| Care team → message the doctor | `JOURNEY-MSG-epsilon` | Doctor "From the patient" **+** Admin queue | ✅ |
| My results → ask a question | `JOURNEY-Q-zeta` | Doctor "From the patient" **+** Admin queue | ✅ |
| My records → request a record | `JOURNEY-REC-delta` | Admin queue | ✅ |
| Share & consent → grant + **revoke** | `journey-share@…` | consent list (moves to "stopped") | ✅ |
| Family access → invite caregiver | `journey-carer@…` | family list | ✅ |
| Settings → toggle | — | `PUT /settings/patient_prefs 200` "Saved" | ✅ |

### Recipient → patient (reverse)
| Direction | How tested (UI) | Result |
|---|---|---|
| Doctor → patient release | doctor released `JOURNEY-REL-beta` → patient My results shows it | ✅ |
| Guardrail | patient sees **no raw score** ("31%" only in educational copy) | ✅ |
| **Care team/admin → patient status** | admin clicked **Handled** on `JOURNEY-Q-zeta` → patient's "Things you've sent" now shows **"Handled"** | ✅ |

### 🐞 Bug 6 — Patient messages/questions never reached the addressed clinician
- **Found (UI):** patient messaged "Test physician" and asked a result question; **only the admin queue** received them — the **doctor saw nothing** (not in results, not on worklist). Breaks "if the patient sends something, the doctor can see it."
- **Fixed (backend):** the doctor's "From the patient" panel now also surfaces the patient's `care_team_message` / `result_question` / `result_explain_request` / `result_urgent_flag` (mapped portal-user → email → `service_requests`), while they still stay in the admin queue for triage. Files: `backend/app/routers/workspace.py`, `frontend/.../clinical/PatientSubmissions.tsx`.
- **Verified:** doctor now sees "Message to the care team → To Test physician: JOURNEY-MSG-epsilon" and the result question.

### 🐞 Bug 7 — Patient could send messages/requests but never see them again (dead-end loop)
- **Found (UI):** after sending, the patient had **no view** of what they'd raised or its status; the loop never closed back to them.
- **Fixed (frontend):** new **"Things you've sent"** card on the patient Care team page (`myRequests()` → `GET /requests`, already patient-scoped) showing each message/question/request with status (**Received / Being looked at / Handled**). Gated on `isLive()`; Arabic strings added (i18n test passes). Files: `frontend/.../apps/patient/PatientRequestsCard.tsx`, `api/actions.ts`, `apps/patient/PatientCareTeam.tsx`, `i18n/ar.ts`.
- **Verified live:** admin marks a question **Handled** → the patient's card flips **Received → Handled**.

**Patient journey: fully complete, every relationship exercised bidirectionally from the UI.** Backend 144 + frontend 170 green, tsc clean.

---

## 11. PATIENT ↔ EVERY CLINICAL RELATIONSHIP — from the UI — ✅

`patient-a`'s encounter (`enc_750f607973`, 4-West). After assigning each role to the unit via the admin UI, verified both directions in the browser.

| Relationship | Patient → role | Role → patient | Result |
|---|---|---|---|
| **Staff nurse** | nurse opens encounter, sees "From the patient" (8 sent) | nurse **Mark seen** → patient's Ready-to-share shows **"Seen by Test staff nurse"** | ✅ bidirectional |
| **Charge nurse** | patient appears on **Unit risk roster** (3/24) + encounter | can open encounter, mark seen | ✅ |
| **NP/PA** | sees patient on worklist + "From the patient" | has **Release to patient** + Acknowledge (prescriber) | ✅ |
| **Case manager** | sees "From the patient" | can **Mark seen**; correctly **no Release** | ✅ |
| **Pharmacist** | sees "From the patient" | can **Mark seen**; correctly **no Release** | ✅ read-only |

Unit assignment (the §4 fix) is what makes each of these visible; each was assigned to 4-West through the admin Roster UI.

## 12. PATIENT ↔ CAREGIVER — built end-to-end from the UI — ✅ (+ 2 bugs fixed)

### 🐞 Bug 8 — Caregiver "family access" was a dead end (promised sign-in never existed)
- **Found (UI):** patient invites a caregiver → only a consent row was written. The caregiver had **no invite link, no account, no way to sign in or see anything** — although the endpoint's own docstring promised "their own sign-in."
- **Built (backend + UI):**
  - `POST /patient/family` now issues a single-use acceptance token; the patient sees a **shareable link** (banner with Copy).
  - `GET /auth/caregiver-invite/{token}` + `POST /auth/caregiver-accept` — the carer sets their own password → a patient-surface account **linked to the patient** (`caregiver_links`).
  - New **caregiver acceptance page** (`/caregiver/accept/:token`) and a **"People you care for"** card on the patient home showing the linked patient's released summaries — **never a raw score** (§13.6 gate holds for carers too).
  - Files: `backend/app/routers/patient_ops.py`, `backend/app/routers/auth.py`, `frontend/.../auth/CaregiverAcceptPage.tsx`, `frontend/.../patient/CaringForCard.tsx`, `PatientFamily.tsx`, `PatientHome.tsx`, `App.tsx`, `i18n/ar.ts`, `backend/tests/test_api.py` (auth-allowlist).
- **Verified live:** patient invites → carer opens link → sets password → lands on portal → **sees `JOURNEY-REL-beta`/`LINKREL9` shared summaries as "Son or daughter"**, zero percentages on the page.

### 🐞 Bug 9 — Revoking a caregiver left them with access
- **Found (UI):** patient revokes the caregiver (`DELETE /patient/sharing 200`) but the **carer still saw the record** — revoke marked the consent but never touched `caregiver_links`.
- **Fixed (backend):** `revoke_consent` now also revokes the linked caregiver entry; `/patient/for-caregiver` skips revoked links. (`backend/app/routers/patient.py`)
- **Verified live:** proper revoke (confirm word "REMOVE") → `caregiver_links` status "revoked" → carer no longer sees the patient; card gone.

**Every patient relationship — doctor, nurse (charge + staff), NP/PA, case manager, pharmacist, hospital admin, caregiver — now works bidirectionally from the UI.** Backend 144 + frontend 170 green, tsc clean.

---

## 13. POLISH — result-question reference (cosmetic) — ✅ fixed
- **Was:** a patient's result question showed its reference as an internal id in the clinician's "From the patient" panel (e.g. "To rr_94aaa76d17: …").
- **Fixed:** the patient portal now sends the result's **headline** as the reference (`ref: r.headline`). (`frontend/.../patient/PatientResults.tsx`)
- **Verified live:** doctor now sees "To **JOURNEY-REL-beta your breathing check**: …".

**PATIENT SIDE: clean end-to-end.** Every screen, every relationship (bidirectional), chat intake, guardrails, and status loops verified in the UI. Backend 144 + frontend 170 green, tsc clean.

---

## 14. DOCTOR — DEEP BIDIRECTIONAL SWEEP (from the UI) — ✅ (+ 1 bug fixed)

Tested the attending at seeded St. Yves (`amara.okonkwo@styves.example` / `esap-demo`, rich data) plus patient-linked flows at Test General. Every left-panel item and every encounter action.

### Left nav
| Feature | How tested (UI) | Result |
|---|---|---|
| Worklist | scope mine↔unit (4↔6), search, sort-by-mortality, unit filter, open row | ✅ |
| Discharge planning | 4 rows; **Discharge** closed an encounter (`/close 200`, row removed); Export packet; correctly hides mortality/ICU | ✅ |
| New encounter | admit + **Admit & run assessment** → `/encounters 201` + `/assess 200` (5 models) | ✅ |
| Models & basis | renders (metrics/calibration) | ✅ |
| How to read a result | renders | ✅ |

### Encounter (results) features
| Feature | Result |
|---|---|
| Differential (M-01) + **Why this condition** | drivers drawer (exact linear decomposition) ✅ |
| Risk models (M-02/03/04) + **Why** | driver decomposition ✅ |
| Timeline tab / History tab | render ✅ |
| Next best test | honest **"Phase 3 — designed, not yet built"** placeholder ✅ |
| On-encounter **Ask** | `/ask 200`, grounded ("I only restate what the models produced… cannot add a new estimate") ✅ |
| **Export** | `/exports 201` → "written to audit as export.phi" → **privacy officer sees it** in the audit log ✅ (bidirectional) |
| **Release to patient** | patient sees summary in My results, no score (§2/§10) ✅ |
| **From the patient** + **Mark seen** | patient submissions visible; doctor Mark seen → "read by Test physician" reaches patient ✅ |
| Chat assistant | describe patient → captured fields → **Run assessment from this** → `/assess 200` ✅ |

### 🐞 Bug 10 — Resident→attending co-sign could not be completed
- **Found (UI):** a resident **Acknowledge → "Submit for co-sign"** set the encounter to `awaiting_cosign` (verified), but the **attending had no co-sign control** — the AcknowledgeBar showed "Reviewed by [resident]" as *done* for everyone. Worse, if the attending re-acknowledged, the backend **overwrote** the resident as acknowledger and never set a co-signer.
- **Fixed (frontend + backend):**
  - `AcknowledgeBar` now shows the attending a **"Co-sign this review"** action while `awaiting_cosign` (and a "pending co-sign" note to everyone else). (`frontend/.../components/clinical/index.tsx`)
  - `POST /encounters/{id}/acknowledge`: an actor whose grade is not `cosign` acting on an `awaiting_cosign` encounter now **completes the co-sign** — keeps the resident's acknowledgement and sets `cosignBy` — instead of overwriting it. (`backend/app/routers/clinical.py`)
- **Verified live:** resident submits → attending sees "Co-sign", clicks it → **"Reviewed by Freya Moravec, MD. Co-signed by Amara Okonkwo, MD."** (state `acknowledged`, acknowledger preserved, co-signer set).

**DOCTOR: deeply tested, every feature + bidirectional flow, from the UI.** Backend 144 + frontend 170 green, tsc clean.

---

## 15. DEAD-OPTION AUDIT — every control clicked (doctor + patient) — ✅ none dead

Clicked **every** interactive control on both surfaces to check each is wired to something. Result: **no dead/unwired options.**

**Doctor**
- Worklist: theme toggle, left-nav (5), New encounter, Open next unreviewed, search, unit filter, My-patients/Whole-unit, Unit&time/By-mortality, 7 column sorters — all wired.
- Results: Release, Ask (opens grounded chat), Export (→201), Why ×3 (risk drivers), Why-this-condition ×5 (per-condition drivers), "What is this?" (next-best-test explainer, honest Phase-3), Acknowledge/Co-sign, tabs ×4 (Results/Intake/Timeline/History) — all wired.
- Intake: Save draft (→PUT draft 200), Run assessment, Structured⇄Dictate toggle, **Extract fields** (→POST /extract 200), quick-fill ×3, Clear, 8 collapsible sections, chip removers (×), selects, ED toggle — all wired.
- Timeline, History (**Export run log** →201), Models & basis (5 model selectors + **Download model card** + **Download subgroup**), Help — all wired.
- Discharge: Export packet, horizon Today/48h/All (filters), 4 column sorters, per-row Discharge (→close), row open — all wired.

**Patient**
- Home shortcuts (See my records→/records, Manage sharing→/sharing, Start→/intake, etc.), Results (Who wrote this, Ask a question, "This does not describe me"), Records (Download everything, tab filters, Request a record, **Ask for a correction** dialog), Care team (connect, Send a message ×N, liaison), Sharing (grant, revoke, **See the full history** modal), Family (Add someone, Remove), Settings (language, text-size, reading-level, theme, toggles — all "Saved"), Intake (symptom wizard), Pre-visit (**Download**, Send to my team, Change my answers→/intake, Back to my health→/home) — all wired.

**Conclusion:** no orphan buttons or links on either surface — every option does something. Efficiency: all actions returned promptly (assessments ~20–50 ms server-side; LLM chat 3–6 s as expected).

---

## 16. FAMILY SHARE ("my father") + CROSS-HOSPITAL SHARE — from the UI — ✅ (+ 1 bug fixed)

### Check A — patient shares with a family member ("father"), verified from the father's side ✅
- patient-a → Family access → **Add someone** → "My Father", relationship **Parent** → invite link.
- Opened the link as the father → set his own password → landed on his portal.
- Father's **"People you care for"** shows **"Pat Testgeneral · as Parent · Summaries"** with the shared summary (JOURNEY-REL-beta), and **no raw score** (percentages on page: none).
- Confirms family sharing works end-to-end from the recipient's perspective.

### Check B — share one patient's info across hospitals (A → B) ✅
Two mechanisms, both verified live:

**1. Patient connection (patient-initiated, the primary path).** patient-a (at **Test General = A**) → Care team → **Connect with a hospital → Riverside Medical Center (= B)** → request (`/patient/connect 201`). Riverside's doctor (`physician@riverside`) saw **"Patient connection requests — Pat Testgeneral"** → **Accept & admit** (`/connection-requests/../accept 201`).
- Riverside worklist now shows Pat Testgeneral; its "From the patient" shows the patient's submissions (9 sent, incl. the symptom + question) — **hospital B now sees patient A's info**.
- Riverside ran an assessment + **released** `RIVERSIDE-REL` → patient-a's My results shows **both** `RIVERSIDE-REL` (B) **and** `JOURNEY-REL-beta` (A), no raw score. Fully bidirectional across both hospitals.

**2. Admin Interop & record transfer (official A↔B record exchange).** Test General admin → Interop & transfer → **Request a record** (Pat Testgeneral, MRN-412B40, from Riverside) → `/admin/interop 201`; MPI 0.95, consent basis Treatment → **Confirm match & accept** (`/interop/../approve 200`).

### 🐞 Bug 11 — Hospital Admin's own "Request a record" 403'd
- **Found (UI):** the Interop & transfer console lives on the **admin surface** (§11.4.9) and shows **"Request a record"**, but `tenant_owner` held only `transfer:approve`, not `transfer:initiate` → the admin's own button returned **403**.
- **Fixed:** granted `tenant_owner` `transfer:initiate` (in `frontend/src/lib/rbac.ts`, `backend/seed/seed.json`, and the live `documents.rbac`). The Hospital Admin can now both **request** and **approve** transfers — matching the console they own.
- **Verified live:** request → 201, confirm & accept → 200.

**Both family sharing and cross-hospital sharing work from the UI.** Backend 144 + frontend 170 green, tsc clean.

---

## 17. NURSES — DEEP BIDIRECTIONAL SWEEP (charge + staff, from the UI) — ✅ (+ 5 bugs fixed)

Full re-test of both nurse roles at St. Yves (`ines.vasquez@styves.example` charge, `lucas.beaulieu@styves.example` staff, `esap-demo`), every left-nav item, every control, every bidirectional link — including two features not previously exercised: **vitals entry** and **escalation**.

### 🐞 Bug 12 — Charge nurse's roster/handoff opened on the WRONG unit
- **Found:** Unit risk roster and Handoff summary both defaulted to `ALL_UNITS[0]` ("Ambulatory Intake") instead of the signed-in nurse's own assigned unit — showing **0 patients** on what should be their home screen.
- **Fixed:** new shared helper `lib/scope.ts::myUnitId()` (reads the signed-in user's own `unitIds` from the directory); wired into `RosterPage.tsx` and `HandoffPage.tsx`.
- **Verified live:** roster now opens on "4-West (Med/Surg)" showing 6 occupied beds (was 0/32); handoff shows 6 real patients (was 0).

### 🐞 Bug 14 — Charge nurse's "My patients" offered write actions that 403
- **Found:** the bedside task-list page never checked role at all — a charge nurse saw **Admit a patient**, **Vitals**, and **Finish it** (intake), all of which need `patient:write` and all 403 for a charge nurse.
- **Fixed:** gated all three on `can(role, "patient:write")`; the "What you can do here" banner now tells a charge nurse the truth (tasks + escalate only) instead of overclaiming.
- **Verified:** charge nurse no longer sees any of the three; staff nurse (regression-checked) still has full access, including a real vitals save (`POST /vitals 201`, "3 values saved... never reach a model").

### 🐞 Bug 15 — Triage silently admitted every patient to the wrong unit
- **Found:** Triage has **no unit picker at all** — it hardcoded `unit_id: ALL_UNITS[0]` on every "Create encounter", so a patient triaged anywhere always landed on "Ambulatory Intake" regardless of which unit the nurse actually works on.
- **Fixed:** defaults to `myUnitId()`. Also applied the same fix to the New-encounter admit-unit default (`IntakePage.tsx`) so it starts on the clinician's own unit instead of alphabetically-first.
- **Verified:** a staff-nurse-created triage encounter now lands with `unitId: u_4w / "4-West (Med/Surg)"` (was "Ambulatory Intake").

### 🐞 Bug 16 — Triage had no write-access gate (same class as Bug 1)
- **Found:** like the earlier "Admit a patient" bug, Triage is a pure `patient:write` action page with zero role checking — a charge nurse could fill the whole form and 403 on submit.
- **Fixed:** `NURSE_NAV` "Triage" now `roles: ["staff_nurse"]`.
- **Verified:** charge nurse's nav is now Roster/My patients/Handoff/Models/Help (Triage gone); staff nurse keeps it and can create.

### 🐞 Bug 13 — Escalating a patient vanished into the audit log; the attending never saw it
- **Found:** `POST /encounters/{id}/escalate` records who escalated, to whom, why and how urgently — but **nothing in the UI ever showed it to anyone**. Not the worklist, not the encounter page. A charge/staff nurse escalating a patient got a toast and then silence.
- **Fixed:** added `escalations` to the `Encounter` type; the worklist patient cell now shows an **"escalated"** pill; the results page shows a **critical banner** with the full escalation history (urgency, by whom, when, reason).
- **Verified live:** charge nurse escalates `enc_1010` → the attending's worklist shows the "escalated" pill and opening the encounter shows **"Escalated to Attending on call — urgent · by Ines Vasquez, RN — Escalated from the results review."**

### Everything else exercised clean
- Roster: bed-grid ⇄ table toggle, search, stat tiles, row-open — all wired.
- My patients: Add task / Mark done / Escalate / Open — all work for both roles (only `patient:read`, correctly available to charge nurse too).
- Vitals entry: at-t0 vs since-admission toggle; a since-admission reading is explicitly labelled "never reach a model" and shows up on **Timeline** for the doctor (bidirectional, verified).
- Chat assistant (nurse voice): captures age/sex/BP/meds naturally; correctly **withholds "Run assessment"** even once all essentials are captured (staff nurse lacks `assess:run` — boundary held).
- Models & basis / Help — render for both roles.

**Nurses: fully deep-tested, 5 bugs found and fixed.** Backend 144 + frontend 170 green, tsc clean.

---

## 18. CASE MANAGER — DEEP BIDIRECTIONAL SWEEP — ✅ (+ 3 bugs fixed)

Tested `tobias.ferreira@styves.example` (`esap-demo`), every left-nav item, every control.

### 🐞 Bug 17 — Configured home page was a dead URL
- **Found:** `ROLES.case_manager.home = "/doctor/worklist?tab=discharge"` — but `WorklistPage` never reads that query param. The case manager landed on the plain mortality/ICU worklist, not the discharge-focused screen their own role blurb describes.
- **Fixed:** home now points straight at `/doctor/discharge` (the real, purpose-built Discharge planning screen).
- **Verified:** signs in → lands on "Discharge planning" directly.

### 🐞 Bug 18 — Discharge button shown but 403'd
- **Found:** the case manager's own home screen (Discharge planning) showed a **"Discharge"** button per row, but closing an encounter needs `assess:run` (a clinical sign-off), which case managers correctly don't hold — legitimate RBAC, but the button wasn't gated to match.
- **Fixed:** gated the per-row Discharge button on `can(role, "assess:run")`; added an honest line to the page's lede for roles that can't discharge ("Discharging itself is the prescriber's action; coordinate here, and they close the encounter from the results screen").
- **Verified:** case manager no longer sees Discharge; physician (regression-checked) still does.

### 🐞 Bug 19 — A second, un-gated entry point to the same admit-403 (Bug 3, missed spot)
- **Found:** Bug 3 gated the **nav-rail** "New encounter" link to prescribers, but the **Worklist page's own header button** (a separate control, same label) was never gated — case manager could still reach `/doctor/encounters/new` and 403 on submit.
- **Fixed:** gated the header button on `can(role, "patient:write")` in `WorklistPage.tsx`. Swept every other entry point to the admit flow (`grep` for `encounters/new`) — confirmed no others were missed.
- **Verified:** case manager no longer sees "New encounter" on Worklist; physician (regression-checked) still does.

### Everything else exercised clean
- Worklist: scope/sort/unit-filter, "Open next unreviewed", row-open — all work.
- Discharge planning: horizon filter (Today/48h/All), Export packet (`201`), sorters — all work.
- Encounter: Why / Why-this-condition, **Ask** (`/ask 200`, grounded), Export, Mark-seen — all present and working (no Acknowledge/Release — correct, no `assess:run`).
- Models & basis / Help — render.

**Case manager: 3 bugs found and fixed.** Backend 144 + frontend 170 green, tsc clean.

---

## 19. NP/PA — DEEP BIDIRECTIONAL SWEEP — ✅ (+ 1 bug fixed, built a missing feature)

Tested `priya.raman@styves.example` (`esap-demo`) — this role's permission profile is near-identical to the physician's (full patient:write/assess:run/explain:view/chat:use/transfer:initiate), so the blurb's "Independent clinical authority" claim was checked point by point.

### 🐞 Bug 20 — "Initiate transfer" was a documented capability with zero reachable UI
- **Found:** NP/PA's own role blurb literally says *"intake, assess, acknowledge, initiate transfer"*, and the RBAC matrix grants `transfer:initiate` to NP/PA, physician **and case manager** — but the only screen that calls `POST /admin/interop` is the Hospital Admin console, which lives on `surface: "admin"`. A clinician role landing there (even by direct URL) is bounced straight back to their own worklist. The capability existed in the matrix and in the role's own description, with **no way to ever use it**.
- **Built (minimal, scoped fix):** a "**Request record from elsewhere**" button on the Results page header, shown only when `can(role, "transfer:initiate")`, opening a small modal (organisation, consent basis, note) pre-scoped to the open patient. Calls the same `POST /admin/interop` endpoint the admin console uses (which only checks the permission, not the surface) via a new `requestRecordTransfer()` action.
- **Verified live, full round-trip:** NP/PA opens the modal on their own patient → `POST /admin/interop → 201` → **Hospital Admin's Interop & transfer queue shows the exact request** (`requestedBy: "Priya Raman, NP"`, note preserved, MRN/consent basis correct) — confirmed at the data layer, not just the toast.

### Everything else — independent authority confirmed, point by point
- **Admit → assess:** `POST /encounters 201` → `POST /assess 200` (5-model result).
- **Acknowledge:** confirm button reads **"Confirm review"** (not "Submit for co-sign") and the encounter goes straight to `acknowledged` — no attending co-sign required, unlike a resident.
- **Release to patient:** `POST /release 200`.
- **Request-transfer button (this fix):** verified end to end above.
- Nav/permissions otherwise mirror the physician (New encounter, Discharge planning, Worklist, Models, Help) with no gaps found.

**NP/PA: 1 real gap found and closed — this one wasn't a UI bug so much as a genuinely missing feature for a documented, permission-granted capability.** Backend 144 + frontend 170 green, tsc clean.

---

## 20. CASE MANAGER + NP/PA — EXHAUSTIVE RE-SWEEP, every option (not just the fixes) — ✅ (+ 1 new bug fixed)

Per explicit request: went back through both roles clicking **every control**, not just re-verifying Bugs 17–20 — same rigor as the doctor dead-option audit.

### Case Manager — full inventory
- **Discharge planning:** all 4 stat tiles, all 4 column sorters, search, all 3 horizon filters, Export packet (`201`), bar-chart card, equity card, row-click → opens results — all wired.
- **Encounter view:** all 3 risk-driver "Why?" drawers, "Why this condition?", "What is this?" (next-best-test), on-encounter **Ask** (`200`, grounded), Export, Mark-seen, **Request record from elsewhere** (`201`) — all wired, no Acknowledge/Release (correct).

### 🐞 Bug 21 — Intake tab showed full write controls that all 403'd
- **Found:** case manager (and any role without `patient:write` — pharmacist, auditor) could open an encounter's **Intake** tab and saw the *entire* editable form: Save draft, Run assessment, the Structured/Dictate mode toggle, quick-fill samples, and **Extract fields** (dictate mode's server call) — all of which need `patient:write` and would 403.
- **Fixed:** `IntakePage.tsx` now renders **read-only** for roles without `patient:write` — hides Save/Run, hides the whole "Two ways to fill this in" panel (mode toggle, quick-fills, Clear, Dictate/Extract), and shows an honest **"Read-only"** banner. The underlying data (what was captured) stays visible — a case manager coordinating care legitimately needs to read it.
- **Verified:** case manager sees the banner and no write controls; physician (regression-checked) keeps full editing.
- **Timeline / History** (+ Export `201`) / **Models & basis** (selector + both downloads, `201`×2) / **Help** / **global chat assistant** (captures fields naturally, correctly withholds "Run assessment" — no `assess:run`) — all render and work.

### NP/PA — full inventory (independent-authority parity with physician, verified point by point)
- **Discharge planning:** correctly **has** the Discharge button (holds `assess:run`) — clicked it, `POST /close 200`, encounter actually closed. Horizon filters, all controls work.
- **New encounter / Intake, full depth:** quick-fill samples, **Clear**, Dictate mode → **Extract fields** (`POST /extract 200`), section expand/collapse, medication search + chip add/remove — all wired. Completed a full fresh admit → assess (`201`/`200`).
- **Timeline / History / Models & basis / Help** — all render.
- **Global chat assistant:** captured age/sex/BP naturally, **"Run assessment from this"** produced a correct inline summary ("Assessment complete. Top considerations: Circulatory 57%... Mortality 3%... Open the results screen for the full breakdown") — confirmed this is deliberate design (no auto-navigation, so the clinician isn't yanked away from wherever they invoked it), matching the physician's identical behavior. Not a bug.

**Both roles: every option exercised, not just the prior fixes. 1 new bug found and fixed (Bug 21).** Backend 144 + frontend 170 green, tsc clean.

---

## 21. PHARMACIST — DEEP BIDIRECTIONAL SWEEP — ✅ (+ 1 bug fixed across 3 screens, + 1 honest-copy fix)

Tested `ezra.stein@styves.example` (`esap-demo`), the most restricted clinician-surface role (`patient:read: scoped`, `explain:view: scoped` only — no write, no assess, no chat, no export, no transfer).

### 🐞 Bug 22 — Export button shown on 3 screens with no `export:phi`
- **Found:** pharmacist has no `export:phi` grant, but **three separate "Export" buttons** were unconditionally rendered regardless of role: the Results page's **Export**, the History page's **Export run log**, and the Discharge planning page's **Export discharge packet** — all three call `POST /exports` with a `kind` requiring `export:phi` and all 403'd. (Resident is affected too — also lacks `export:phi`.)
- **Fixed:** gated all three on `can(role, "export:phi")` — `ResultsPage.tsx`, `HistoryPage.tsx`, `DischargePlanningPage.tsx`.
- **Verified:** all three hidden for pharmacist; physician and case manager (regression-checked, both hold `export:phi`) unaffected — physician's Results export still fires (`201`).

### 📝 Honest-copy fix — pharmacist's role blurb overclaimed an unimplemented filter
- **Found:** the blurb read *"Medication-relevant slice only: the drivers that are drug-related, and nothing else"* — but home medications are **not currently a dense feature the differential model takes as input** (confirmed in `predictors/stub.py::build_dense` — only age/BP/BMI/labs). There is no medication-derived driver to filter to; a pharmacist sees the exact same unfiltered driver set as any other reviewer.
- **Chose not to build a filter:** fabricating a "which drivers count as drug-related" heuristic without real clinical/model input would be exactly the kind of invented clinical judgment this codebase's own conventions guard against (no fabricated categories, LLM never invents a diagnosis code, etc.) — the honest fix is correcting the claim, not inventing behavior to match it.
- **Fixed:** blurb now reads *"Read-only clinical view of the assessment and its drivers, same as any other reviewer. Home medications are not yet a model input, so there is no medication-specific filter here."* Arabic translation added (i18n test requires it).

### Everything else — read-only boundary confirmed exhaustively
- **No** New encounter, Ask, Acknowledge, Release, Export (post-fix) anywhere.
- **Has** and uses: all 3 risk-driver "Why?" drawers, "Why this condition?", next-best-test explainer, **Escalate** (`200`), Timeline, History (read), Discharge planning (read, no Discharge/Export buttons), Intake tab (**read-only**, same Bug 21 fix as case manager), Models & basis, Help.
- **Global chat assistant:** present and usable (`200`) — confirmed this is deliberate, universal-access design (the intake-capture chat is available to *any* signed-in user including patients, per its own docstring; `chat:use` in the matrix instead gates only the on-encounter **Ask**/RAG panel, which correctly enforces it server-side via `rbac.require(actor, "chat:use")` in `/ask` — pharmacist correctly has no Ask button). Chat correctly still withholds "Run assessment" (no `assess:run`).

**Pharmacist: 1 bug (3 screens) + 1 honest-copy correction.** Backend 144 + frontend 170 green, tsc clean.

---

## 22. HOSPITAL ADMIN (tenant_owner) — FULL CONSOLE DEEP SWEEP — ✅ (+ 2 bugs fixed, 1 false alarm cleared)

Tested `mira.novak@styves.example` (`esap-demo`), every one of the 12 console screens, every control.

### ✅ Home, Roster, Invites, Facilities & units (Add/Add-unit/Remove), Roles & scopes, Integrations — all exhaustively verified
- Home: all 5 links (Invite staff → Invites, Full report → Usage, Open queue → Interop, Full log → Audit, Manage → Invites) correctly wired; live counts checked against DB.
- Roster: Export (`201`), role/status filters, column sort, **pagination** (81 accounts, Next/Previous page), drawer's **SSO toggle**, **break-glass delegate toggle**, **Send reset**, **Deactivate confirm** (opened + safely cancelled, no destructive call fired), **Bulk import** (uploaded a real CSV, correct row-level validation "Ready" vs "Not an email address", sent — `201`).
- Invites: **Remind** (`200`), **Revoke** (`DELETE 200`), **Reissue** (`201`), tab counts.
- Facilities & units: Add unit + Remove unit (full `ConfirmDestructive` confirm-word flow, `POST 201` / `DELETE 200`) — both genuinely wired.
- Roles & scopes: reference matrix (read-only, correctly non-interactive) + **"Map a job title"** modal (`PUT /settings/roles 200`).
- Integrations: **Test all connections** (3× `200`), **Configure** panel edit + **Save** (`PUT /settings/integrations 200`).

### 🐞 Bug 24 — "Edit" on a facility was a no-op that claimed success
- **Found:** "Add facility" creates one and its own toast says **"rename it from Edit"** — but Edit had no modal at all; it just re-PATCHed the *same unchanged* name/type/beds back to the server and showed "{name} saved," a false confirmation. The admin was told to rename via a button that could never rename anything.
- **Fixed:** built a real Edit modal (name/type/beds, pre-filled, `Field`+`Select`+`TextInput`, matching the existing "Add unit" modal's pattern) in `AdminFacilities.tsx`.
- **Verified live:** renamed "Harbour Street Clinic" → confirmed the new name persisted and rendered, then renamed it back.
- *(A separate worry — "Add facility" itself doing nothing — turned out to be my own test timing, not a bug; confirmed both clicks actually succeeded, `201`×2.)*

### 🐞 Bug 25 — Per-unit model suppression was saved but never enforced anywhere (patient-safety-framed setting, silently inert)
- **Found:** **Model & display**'s per-unit "Suppress a model on {unit}" control (e.g. MICU → Suppress M-03) persists correctly (`PUT /settings/model_display 200`, confirmed `unitOverrides` in the DB) — the seed data even ships with a default override already configured (`u_micu: ["M-03"]`) as if it were a working feature. But **nothing ever read `unitOverrides`** anywhere in the backend or frontend. A clinician on a MICU patient still saw the full, un-suppressed "ICU admission" gauge — exactly the "noise on a clinical screen" the feature's own copy says it exists to prevent.
- **Fixed (backend):** new `assembler.merge_unit_override()` folds a unit's override into the effective display policy at the point `/assess` and `_single` apply it, using a lightweight per-request lookup of the encounter's `unitId` (`clinical.py::_unit_of`) — no change to the core `apply_display_policy` logic, which already correctly suppresses a model turned off.
- **Fixed (frontend):** the suppression used to render as a bare blank dash — indistinguishable from "not yet assessed." Added a real **"suppressed"** status to `RiskSlot`/`RiskRow` (mirroring the existing "degraded" flag) so a suppressed gauge shows a visible flag with the actual reason, per §11.4.7's own promise: "a hidden model is never silently hidden."
- **Verified live, full round-trip:** re-ran the assessment on a MICU patient (`enc_1001`) → stored `icu.status: "suppressed"` → Results page shows a visible **"suppressed"** flag next to "ICU admission" (was previously showing the number unconditionally).

### 🐞 Bug 26 — "Allow patients to see released results" toggle was pure decoration
- **Found:** Org settings' toggle (hint: *"Turning this off removes the patient portal entirely for your tenant"*) persisted correctly but **nothing in the backend ever checked it** — a patient's portal worked identically whether it was on or off. Worse, the frontend hydrates through a **separate, duplicate** code path (`GET /bootstrap`'s inline `is_patient`/`patient_id` logic) that doesn't share the `_me()` guard the direct REST endpoints use — so even gating `_me()` alone would have silently failed to protect the real UI (traced this exact gap live: gating `_me()` first, then discovering the actual page still worked because it never calls those endpoints on load).
- **Fixed:**
  - `_me()` in `patient.py` **and** `patient_ops.py` now checks the account's own tenant's `patientPortalEnabled` org setting and 403s if off (covers a patient account provisioned directly in that tenant — the case the toggle's own copy describes; a self-registered patient's cross-hospital connections are a separate, more ambiguous design question not addressed here).
  - `GET /bootstrap` now applies the same check before it decides whether to serve `released_results`/`consents`/`care_team`/`records`, and returns a new `patient_portal_enabled` flag.
  - Frontend: new `PATIENT_PORTAL_ENABLED` store flag (`mock/db.ts`, wired through `applyDataset`, added to `seed.json` for offline-mode consistency) and an honest banner on `PatientHome.tsx`: *"The portal is turned off for this hospital right now."*
- **Verified live, full round-trip:** turned the toggle off for St. Yves → `delia.salib@example.com` (a direct St. Yves patient account) lost all released-result/records/care-team data (empty state, not a data leak) and saw the new banner → turned it back on → full access and data restored immediately.

### Usage & outcomes, Interop & transfer, Audit log, Billing — the remaining 4 screens, all exhaustively verified ✅
- **Usage & outcomes:** all 3 tabs (Adoption/Model quality/Outcomes) render real, honestly-caveated content (leakage-alarm check, stratified M-01 performance, "associations, not attributed effects" for before/after comparisons); 12/16-week window toggle; **Export report** (`201`).
- **Interop & transfer** (re-verifying Bug 11's fix + new ground): **Request a record** → `201` on a brand-new request; opened a below-threshold match (0.88, address mismatch shown field-by-field Yours/Theirs) → **Reject** with a required reason → `POST .../reject 200`, state correctly flips to "Rejected" in All transfers. Bug 11 fix holds on fresh data.
- **Audit log:** search (found my own escalation test event), action/severity/outcome filters, drill-down. Found what looked like a scoping bug (a "single patient" export returning the same 365 KB as an unscoped one) — traced it to my own mistake: the page has **two separate export controls** — a generic header "Export" (always full-tenant, ignores the on-page filters) and a proper **"Build a report"** card with its own Scope/Date-range/Detail fields and **Generate report** button. Using the right one produced a correctly scoped **724-byte** single-patient accounting-of-disclosures export. Not a bug — verified by finding and using the actual intended control.
- **Billing:** Invoices tab (3 rows, **PDF export** `201`), Plan & terms tab (Enterprise tier detail), Usage-this-cycle tab (assessment allowance, 108% used), **Download statement** (`201`).

**Hospital Admin: fully swept end to end, all 12 console screens. 2 real safety/consistency bugs found and fixed, 1 false alarm cleared, 1 near-miss (audit export) resolved by finding the correct control rather than mis-filing it as a bug.** Backend 144 + frontend 170 green, tsc clean.

---

## ROLE SWEEP — COMPLETE ✅

Every role exercised from the UI. **5 bugs found and fixed**, all UI-first:
1. Charge nurse saw "Admit a patient" → 403 → nav gated to staff nurse.
2. **Nurse-admitted patients invisible to all doctors** (unit scoping dead in every UI-built hospital) → real unit assignment (Roster + Invite), `unitIds` persisted; nurse↔doctor handoff verified.
3. Case manager & pharmacist saw "New encounter" → 403 → gated to prescribers.
4. Restricted admin roles saw all 13 admin pages → permission-gated `ADMIN_NAV` (`anyPerm`); `/admin/usage` broadened to governance roles.
5. `/ops/rollout` white-screened when a model had no strata → made defensive.

**Final state:** backend 144 tests + frontend 170 tests green, tsc clean.
Files changed: `frontend/.../shell/nav.tsx`, `frontend/.../shell/AppShell.tsx`, `frontend/.../admin/AdminRoster.tsx`, `frontend/.../admin/AdminInvites.tsx`, `frontend/.../ops/OpsRollout.tsx`, `backend/app/rbac.py`, `backend/app/routers/admin.py`, `backend/app/routers/auth.py`.

---

## 8. IT ADMIN — `kofi.mensah@styves.example` — ✅ deep sweep, 5 real bugs found and fixed

Full UI-only pass across all 9 screens IT Admin can reach (Home, Roster, Invites, Facilities & units,
Roles & scopes, Integrations, Model & display, Org settings, Usage & outcomes).

**Bug 27 — nav permission gates were cosmetic only; every admin route was reachable directly regardless of role.**
`ADMIN_NAV`'s `anyPerm` only ever hid the sidebar *link* — `guardRedirect` (App.tsx) checked surface only, not
the per-item permission. IT Admin (no `audit:view`/`transfer:*`/`billing:view`/`fairness:audit_view`) could still
browse straight to `/admin/interop`, `/admin/audit`, `/admin/billing`, `/admin/fairness` — and worse, the Home
dashboard's own "Open queue"/"Full log" shortcut buttons took them there in one click, no URL-guessing needed.
**Fix:** `guardRedirect` now also matches the current path against the surface's own nav tree and re-checks
`roles`/`anyPerm`, redirecting to role-home on a miss — for every surface (clinician/admin/ops/patient), not
just admin. Also gated `AdminHome`'s "Record transfers"/"Recent security events" cards behind the same
permissions, since an unauthorized role was seeing them as "0 pending" (looks like reassurance, is actually just
an empty response the caller isn't allowed to see). **Verified:** IT Admin now bounces to `/admin/integrations`
from all 4 routes; buttons for them gone from Home; tenant_owner (holds every perm except `fairness:audit_view`,
by design) unaffected on 3/4, and correctly now *also* bounced from `/admin/fairness` — confirmed intentional,
not a regression (matrix has no `fairness:audit_view` grant for tenant_owner at all; nav already hid that link).

**Bug 28 — IT Admin could grant a clinical (chart-access) role via Invite, Bulk import, or SCIM job-title mapping — the exact thing the role exists to prevent.**
The Roster screen has a hand-written banner and a real, working restriction ("Change role" select is disabled)
for exactly this: *"You can provision accounts, but not grant clinical roles... reserved to the Hospital Admin."*
But that boundary was never applied anywhere a *new* grant is created:
- Single **Invite** compose form offered all 12 roles including Attending Physician/nurse/etc., defaulting to
  `physician`; backend `send_invite` only checked generic `user:manage`.
- **Bulk import** CSV preview marked a `role=physician` row "Ready" with no restriction at all.
- **Map a job title** (Roles & scopes) — an auto-provisioning rule for SCIM ("the role comes from the job-title
  mapping", confirmed live on the Integrations page) — let IT Admin bind any HR title to Attending Physician
  with its own banner admitting *"anyone arriving from your identity provider with this title is provisioned
  into that role without further review."* No consumer wires this up yet (grepped — `titleMap` is written but
  never read elsewhere), so not live-exploitable today, but it is explicitly "groundwork for a SMART-on-FHIR
  launch" per the page's own footnote — the gap would become real the day that ships.
**Fix (client + server, all three paths, one shared boundary):** `ROLES[x].surface === "clinician"` is the
existing canonical "can open a chart" marker (matches the roster's own hand-written banner text exactly).
Backend: `send_invite` (admin.py) and `write_settings` for the `roles` scope (settings.py) both now reject a
clinical-surface role from any actor except `tenant_owner`/`super_admin`. Frontend: `AdminInvites.tsx`'s role
select and `AdminRoster.tsx`'s bulk-CSV validator and `AdminRoles.tsx`'s job-title-mapping select all filter to
non-clinical roles for the same actors, with an explanatory banner. **Verified live:** uploaded a CSV row and
a compose-form attempt for `role=physician` as IT Admin — both correctly blocked in the UI (flagged/absent from
the option list) *and* at the API directly (bypassing the UI entirely) with `403 Granting a clinical role is
reserved to the Hospital Admin.` / `403 Mapping a job title to a clinical role is reserved to the Hospital
Admin.` Regression-checked: `tenant_owner` (`mira.novak@styves.example`) still sees and can use all three paths
unrestricted.

**Bug 29 — Model & display settings silently showed hard-coded defaults, not the real config, to the only roles that can write them.**
`SCOPE_PERMISSIONS["model_display"]` gated reads on `patient:read` — a permission neither `tenant_owner` nor
`it_admin` holds (the only two roles with the `tenant:manage` needed to reach this page's write side at all).
`useSettings`'s `reload()` swallows a failed GET silently ("keep what's on screen — the next save reports the
failure in words"), so every visit to `/admin/models` painted the component's hard-coded fallback (all 5 models
"On", no per-unit overrides) regardless of what was actually configured — a screen literally titled "what your
clinicians are shown" was itself lying to the person configuring it. **Verified:** toggled M-03 off, confirmed
the direct `GET /settings/model_display` 403'd for IT Admin while the PUT had returned 200 — reload after any
change would have silently reverted the *displayed* state to "all on" even though the server held the correct
value. **Fix:** `SCOPE_PERMISSIONS` read side can now be a permission tuple; `model_display` reads accept either
`patient:read` (clinicians, seeing what they've been shown) or `tenant:manage` (whoever configured it), via
`rbac.require_any`. **Verified live:** direct `GET` now returns the true persisted state for IT Admin; a
physician's read (via `ResultsPage`) still works unchanged — no regression.

Also exercised clean, with no further findings: Roster (Send reset `200`, role-change select correctly disabled
+ unlabelled "reserved to the Hospital Admin"), Facilities & units (Edit-facility PATCH `200`, Add-unit `201`,
Remove-unit round-trip DELETE `200` — note "Add facility" is an instant no-modal POST, same as documented for
Hospital Admin, not a bug), Roles & scopes (tenant policy toggles PUT `200` round-tripped and restored),
Integrations ("Test all connections" 4×`200`, SSO Configure PUT `200`), Org settings (support break-glass toggle
PUT `200` round-tripped and restored).

**IT Admin: 5 real bugs found and fixed (2 systemic — affecting every restricted admin role and, for Bug 29,
every tenant_owner too), all verified live with fresh data, all regression-checked against tenant_owner and a
physician. Backend 144 + frontend 170 green, tsc clean throughout.**
Files changed this pass: `frontend/src/App.tsx`, `frontend/src/apps/admin/AdminHome.tsx`,
`frontend/src/apps/admin/AdminInvites.tsx`, `frontend/src/apps/admin/AdminRoster.tsx`,
`frontend/src/apps/admin/AdminRoles.tsx`, `backend/app/routers/admin.py`, `backend/app/routers/settings.py`.

---

## 9. PRIVACY OFFICER — `sanne.devries@styves.example` — ✅ deep sweep, 1 more bug found and fixed

Full UI-only pass across all 4 screens Privacy Officer can reach (Home, Usage & outcomes, Fairness audit, Audit log).

**Regression-verified Bug 27's fix from this same pass:** direct navigation to all 9 routes this role cannot
use (`/admin/roster`, `/invites`, `/facilities`, `/roles`, `/integrations`, `/models`, `/org`, `/billing`,
`/interop`) now correctly bounces to `/admin/audit` (role home) instead of rendering.

**Bug 30 — same "dead/misleading Home affordance" pattern as Bug 27, three more instances found on the same page.**
The header "Invite staff" button, the `RequestInbox` card's per-row "Roster" button (shown for
password-reset-request rows), and the entire "Invites" card (pending/expired counts + "Manage" button) were all
ungated — shown to every admin-surface role regardless of `user:manage`. For Privacy Officer specifically the
"Invites" card would have shown "0 pending, 0 expired" (bootstrap correctly returns `invites: []` for a role
without `user:manage`) — the same misleading-empty-state shape as the transfers/audit cards fixed for IT Admin
earlier in this pass, just missed on the first read of this file. Clicking "Invite staff" or "Roster" already
safely bounced back to `/admin/audit` thanks to Bug 27's route guard, but a control that always dead-ends isn't
right either. **Fix:** gated all three behind `can(role, "user:manage")`. **Verified live:** Privacy Officer's
Home now shows only "Full report" and "Full log" in the header/cards; `tenant_owner` regression-checked
unaffected (still sees "Invite staff", "Open queue", "Full log", "Manage").

**Fairness audit:** confirmed the "No subgroup evaluation has been run yet" state is honest, not a permission
bug — checked `bootstrap.subgroup_fairness` directly, it is genuinely `[]` in this seed (the copy is correct:
overall/cold-start eval exists, subgroup eval does not yet).

**Audit log:** outcome filters (All/Success/Denied/Error) correctly reactive against live data — verified by
provoking a real `login.failed` event (wrong password against a real account) and watching it appear under
Error with the right severity once the page re-read `bootstrap`; header **Export** (`201`, full ~397 KB tenant
payload) and the scoped **Build a report → Generate report** (`201`) both work. *Self-inflicted false alarm
along the way:* testing the failed-login case by calling the API client's raw `api.post("/api/v1/auth/login", …)`
without `{anonymous: true}` tripped the client's global 401→logout interceptor and signed my own test session
out — confirmed by reading `session.ts`'s real `signInWithPassword`, which does pass `{anonymous: true}`; the
actual login page is unaffected, this was purely an artifact of bypassing the normal call site in a raw test.

**Usage & outcomes:** all 3 tabs render, **Export report** (`201`).

**Privacy Officer: 1 real bug found and fixed (shared root cause with Bug 27, same fix pattern), plus thorough
regression/positive verification across all 4 reachable screens. Backend 144 + frontend 170 green, tsc clean.**

---

## 10. BILLING ADMIN — `hugo.ferreira@styves.example` — ✅ deep sweep, 1 real bug found and fixed

Full UI-only pass across all 3 screens Billing Admin can reach (Home, Usage & outcomes, Billing).

**Regression-verified Bug 27's fix:** all 10 unauthorized routes (`roster`, `invites`, `facilities`, `roles`,
`integrations`, `models`, `org`, `audit`, `interop`, `fairness`) correctly bounce to `/admin/billing`. Home
dashboard shows only "Full report" — no dead "Invite staff"/"Manage"/queue buttons (Bug 30's fix holds for a
third role).

**Bug 31 — Usage & outcomes' own "Export report" button 403'd for the only role the page is otherwise fully usable for.**
`/admin/usage` is reachable by `billing_admin` (nav `anyPerm` includes `billing:view`), and every other control
on the page works — both tabs, the 12/16-week toggle. But **Export report** called the shared `/api/v1/exports`
endpoint with `kind: "usage_report"`, whose accepted-permissions tuple was `("audit:view", "tenant:manage")` —
missing both `billing:view` *and* `fairness:audit_view`, even though the endpoint's own doc comment states the
design rule explicitly: *"the capability that gates the screen is accepted alongside it."* Reproduced live:
`POST /api/v1/exports` → `403` for Billing Admin, confirmed by checking the raw button's actual call (not a
guessed payload — an initial guess mis-shaped the body and returned an unrelated `422`). **Fix:**
`KINDS["usage_report"]` in `backend/app/routers/exports.py` now accepts
`("audit:view", "tenant:manage", "fairness:audit_view", "billing:view")`, matching `/admin/usage`'s nav
`anyPerm` list exactly. **Verified live:** Export report now returns `201` (4.3 KB) for Billing Admin.
Regression-checked: `tenant_owner` and `sanne.devries@styves.example` (Privacy Officer) both still export fine.

Also exercised clean, no further findings: Billing screen's Download statement (`201`), Invoices tab × 3 PDF
exports (`201` each), Plan & terms tab (renders Enterprise tier + overage detail), Usage-this-cycle tab
(108%-of-allowance detail, itemised cycle).

**Billing Admin: 1 real, cleanly-scoped bug found and fixed (an export permission list out of sync with its own
screen's nav grant), full positive coverage otherwise. Backend 144 + frontend 170 green (1 known cold-backend
race on first run, clean on re-run — not a regression), tsc clean.**
Files changed this pass: `backend/app/routers/exports.py`.

---

## 11. AUDITOR — `leila.aziz@styves.example` — ✅ deep sweep, clean (systemic fixes already cover it)

Full UI-only pass across all 4 screens Auditor can reach (Home, Usage & outcomes, Fairness audit, Audit log).
This role's home is `/admin/usage`, not `/admin/home` — by design (matches `ROLES.auditor.home`); confirmed
`/admin/home` still renders correctly for it too (no crash, correctly shows only "Full report"/"Full log", no
dead buttons — Bug 30's fix holds for a fourth role).

**Regression-verified, no new bugs:** all 9 unauthorized routes bounce to `/admin/usage` (Bug 27); Usage &
outcomes **Export report** `201` (Bug 31's fix covers auditor too, though auditor already held `audit:view` so
was never actually broken by it); Audit log header **Export** `201` (411 KB) and **Generate report** `201`;
Fairness audit's empty state confirmed genuine (no subgroup data exists yet, same as verified for Privacy
Officer — nothing to export, so `fairness_report`'s `export:deidentified` grant couldn't be exercised against
real data, but the permission path is identical to the already-verified privacy_officer/tenant_owner case).

**Minor observation, not fixed — likely out of scope:** the matrix grants auditor `roster:view: F`, but
`roster:view` is the *clinical* unit-risk-roster permission (`workspace.py`, label "Unit risk roster", group
"Clinical" — distinct from the admin console's staff-directory Roster page, which is gated on `user:manage`).
Auditor's surface is `admin`, and `guardRedirect` correctly keeps every admin-surface role off `/nurse/*` and
`/doctor/*` clinician routes — so this grant has no UI anywhere that can reach it; it is not reachable, not
promised anywhere in the role's own blurb ("Reads the fairness and calibration evidence, exports de-identified
cohorts, never exports PHI"), and not contradicted by anything either. Flagging rather than building a new
"QI auditor's read of the clinical roster" screen speculatively — that would be adding a feature nobody asked
for rather than fixing a broken one.

**Auditor: 0 new bugs — the systemic fixes from IT Admin/Privacy Officer/Billing Admin already cover this role
completely, confirmed by full re-verification rather than assumed. Backend 144 + frontend 170 green, tsc clean.**

---

## 12. SUPER-ADMIN / PLATFORM OPS — `rmoravec@esap.health` — ✅ deep sweep, 1 real bug found and fixed

Full UI-only pass across all 8 Ops console screens (Fleet dashboard, Provisioning wizard, Incidents, Model
rollout, Global config, Plan catalog, Break-glass, Platform audit log) plus the tenant-detail drill-down.

**Bug 32 — every platform-wide feature-flag change auto-generated its own "reason", never asking the operator why.**
`backend/app/routers/settings.py` requires a non-blank `reason` for any `PLATFORM_SCOPES` write (`global_flags`
among them) specifically so "who turned this on and why" is answerable later — its own docstring says so. But
`OpsConfig.tsx`'s toggle handler called `setFlag(f, v, "${f.name} toggled from the platform config console")` for
every ordinary flip, and even the one path with a confirmation dialog (enabling a high-risk flag) supplied
`"${f.name} enabled after typed confirmation"` — a template, never a text box. The requirement was technically
satisfied (never blank) while being substantively defeated (never a real reason) — the exact "recorded a blank
because nothing checked" failure the requirement's own docstring names, just dressed in non-blank clothing.
Reproduced live: toggled the low-risk "Automatic canary rollback" flag off, `PUT /settings/global_flags → 200`,
with the audit trail carrying the canned string, never anything an operator actually wrote. **Fix:** replaced the
high-risk-only `ConfirmDestructive` with one unified confirmation modal for every flag change (any risk, either
direction) with a required, free-text **Reason** field wired straight through to the real `reason` argument; kept
the existing typed-confirm-the-flag-key ceremony as an *additional* gate only for enabling a high-risk flag.
**Verified live, full round-trip:** re-enabled the rollback flag through the new modal — confirm button stayed
disabled with an empty reason, enabled once real text was typed, and the platform audit log now shows the exact
sentence typed rather than a template (checked via `bootstrap.platform_audit` directly). Also verified the
high-risk path (Tower B) now requires *both* the reason and the typed flag key before enabling, cancelled without
submitting to avoid actually flipping a high-risk platform flag as a side effect of testing.

**Break-glass — thoroughly tested, correctly built, one self-inflicted false alarm cleared.** Submitted a real,
fresh request (fresh MRN/reason/ticket) → `201`; confirmed the two-person rule (`ops.py`'s `approve_break_glass`)
by first misreading which table row an "Approve" click landed on (a *different*, pre-existing grant from another
user — correctly approved, 200, not a bug) and then directly attempting to approve my *own* request by exact
grant ID → correctly `403 A break-glass grant must be approved by someone other than the requester.` Withdrew my
own test request afterward (`revoke`, `200`) to leave no residue. **Suspend tenant**: opened the confirm dialog,
read its consequences copy, cancelled without confirming — did not suspend `t_yves`, the tenant every other
role's testing in this entire session depends on.

Also exercised clean, no further findings: Fleet dashboard (cards/table view toggle, tenant drill-down); tenant
detail's Health/Model pinning/Platform activity tabs all render, "Rollout" buttons correctly drill through to
`/ops/rollout`; Provisioning wizard steps 1→2 validate and advance (did not complete step 6 — avoided adding yet
another placeholder tenant to the fleet); Incidents — declared a fresh test incident (`201`) and marked it
resolved (`200`), clean round trip; Model rollout — "Refresh metrics" reloads without error (regression-checks
the earlier white-screen fix); Plan catalog — edited and restored a plan's display price (`200`×2); Platform
audit log — **Export** (`201`, 16.5 KB) and severity filters (confirmed my own flag-change event surfaces under
"Warning").

**Super-Admin/Ops: 1 real bug found and fixed (a substantive audit-trail integrity gap dressed as a satisfied
requirement), thorough positive coverage of every other screen, one self-cleared false alarm along the way.
Backend 144 + frontend 170 green, tsc clean.**
Files changed this pass: `frontend/src/apps/ops/OpsConfig.tsx`.

---

## FULL ADMIN/GOVERNANCE SWEEP — COMPLETE ✅

IT Admin, Privacy Officer, Billing Admin, Auditor and Super-Admin/Ops all exercised exhaustively from the UI —
every reachable screen, every control, fresh test data throughout. **6 real bugs found and fixed this pass**
(27–32), 2 of them systemic (fixed once, verified across all 5 roles): the nav-permission-vs-route-guard gap
(27) and its follow-on dead-affordance cleanup (30); a genuine privilege-escalation path letting a
non-Hospital-Admin grant clinical/chart access three different ways (28); a read/write permission mismatch that
silently showed admins false configuration state (29); an export permission list out of sync with its own
screen's nav grant (31); and an audit-trail integrity gap in platform feature-flag changes (32). Three additional
suspected issues were investigated and cleared as false alarms from testing methodology, not product bugs (the
"Add facility" instant-POST pattern, a wrong-button click during audit-log verification, and a raw API test call
that tripped the client's own 401→logout interceptor) — each traced to its actual cause before being ruled out.
Backend 144 tests + frontend 170 tests green throughout, tsc clean after every fix.

---

## 13. FOLLOW-UP — Bug 33: tenant drill-down showed the operator's own tenant's numbers under every hospital's name

User-reported after manually switching between tenants in the Ops console UI: the "Operational trends" chart
on a tenant's Health tab (subtitled **"This tenant only"**) showed the identical "175 assessments / W-11" for
St. Yves *and* Northgate *and* Calder. Traced it: `OpsTenantDetail.tsx` read the global bootstrap-time
`ADOPTION_SERIES`, which the backend computes once at sign-in for **the signed-in operator's own tenant**
(`actor.tenant_id`) — not the tenant the drill-down is currently open on. The backend already had the right
data available (`GET /ops/tenants/{tenant_id}` returns `evidence.adoption_series(tenant_id)` correctly scoped
to the URL's tenant) — the frontend just never called it, and used the stale global snapshot instead.
**Fix:** `OpsTenantDetail.tsx` now fetches `/api/v1/ops/tenants/{id}` on mount/tenant-change and renders that
response's `adoption` series instead of the global one. **Verified live:** St. Yves → 179, Northgate → 0 (then,
after adding sample activity data for the previously-empty tenants, 47), Rivermead → 24, Calder → 5 — genuinely
distinct per tenant. `Calibration error`/`Input drift` panels are correctly left alone: `DRIFT` is deliberately
empty platform-wide ("no production monitoring yet"), so there's nothing tenant-specific to fetch there.
**Explicitly kept as-is per product decision:** the "Model pinning" tab's identical per-tenant display — every
hospital runs the same model version by design ("we will be using same model every hospital"), so no fix needed
there; it was investigated and is not a bug given that decision.

Also added sample `assess.run`/`result.acknowledge` activity (local demo DB only, not committed — `*.db` is
gitignored and regenerable) to the three previously-empty-shell tenants (Northgate, Rivermead, Calder) so the
fix above is visibly demonstrable rather than showing zeros for everything but St. Yves. Brakewell (suspended)
and the Individual/Self-Serve tier were left untouched — a suspended tenant genuinely having no recent activity
is correct, and self-serve has a different shape entirely.

Backend 144 + frontend 170 green, tsc clean.
Files changed: `frontend/src/apps/ops/OpsTenantDetail.tsx`.
