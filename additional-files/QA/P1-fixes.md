# Clinical AI QA report: P1 fixes

**Date:** 9 Nov 2026
**Source:** Clinical AI QA Test Report, 8 Nov 2026
**Code location:** `system/system-final-v`
**Status:** Fixed in the working copy on branch `raihan`. Not committed and not deployed, so production still has the old behaviour.

## Summary

| Issue | Severity | Item | Status |
|---|---|---|---|
| 1 | High | Remove and rotate the shared demo password, turn off the public demo-accounts list | Not changed, by decision (see below) |
| 2 | High | Security page and FAQ claim controls that are not built | Fixed |
| 4 | High | Placeholder models labelled as calibrated | Fixed |
| 5 | High | Solo clinician cannot admit a patient | Fixed |
| 6 | High | Non-admins receive all users' names and emails | Fixed |
| 19 | High | Patient assistant ignores red flags | Fixed |
| 20 | High | Intake form pre-sets answers | Fixed |

**Issue 1:** `/demo-role` and the shared demo login stay in place on purpose, because this code will move to another production repo. The password and the demo-accounts list were not touched.

## Fixes

### Issue 19: Patient assistant red flags

- Every patient chat message is checked for chest pain, breathing trouble and stroke signs, in English and Arabic.
- A match shows the same emergency message as the intake form, including 997, then captures the symptoms.
- The check is rule-based and does not depend on the LLM.
- The assistant says it cannot explain the cause or give a risk score.
- The intake form now also shows the warning when these symptoms are only typed as free text.

**Files:** `backend/app/red_flags.py` (new), `backend/app/routers/chat.py`, `backend/app/routers/patient_ops.py`, `frontend/src/components/shell/ChatAssistant.tsx`, `frontend/src/apps/patient/PatientIntake.tsx`, `frontend/src/i18n/ar.ts`, `frontend/src/styles/premium.css`

**Retest:** Patient portal > Assistant > send "I am 55 and have chest pain and my left arm hurts. Am I having a heart attack? What is my risk score?" Expect the emergency message with 997, and Age 55, Chest pain and Arm pain captured.

### Issue 20: Intake form answers

- Duration, getting worse and had-this-before all start blank.
- Skipped questions show "Not answered" to the patient and the clinician.
- Skipped medicines also show "Not answered".

**Files:** `frontend/src/apps/patient/PatientIntake.tsx`, `frontend/src/apps/patient/PatientPreVisit.tsx`, `frontend/src/components/clinical/PatientSubmissions.tsx`, `backend/app/routers/patient_ops.py`, `frontend/src/i18n/ar.ts`

**Retest:** "Tell us how you feel" > pick one symptom > press Next on every step > Finish > open "Ready to share". Expect "Not answered" for each skipped question and no invented answers.

### Issue 4: Placeholder models

- A "Placeholder model, not for clinical use" banner shows on every clinical screen while placeholder models are running.
- Estimates are labelled "AI-generated".
- Placeholder models never send `calibrated: true`.
- Results saved earlier are corrected when the backend starts, and an encounter with no assessment is no longer marked calibrated. Results from trained models keep their calibrated state.
- Metrics that were never computed no longer show as 0.000 on the Evidence, Models and admin model screens.
- The length-of-stay card no longer quotes a measured coverage figure for a placeholder.

**Files:** `backend/app/predictors/stub.py`, `backend/app/assembler.py`, `backend/app/seed.py`, `backend/app/main.py`, `backend/app/routers/bootstrap.py`, `frontend/src/lib/evidence.ts` (new), `frontend/src/components/ui/domain.tsx`, `frontend/src/components/ui/charts.tsx`, `frontend/src/components/clinical/index.tsx`, `frontend/src/components/shell/AppShell.tsx`, `frontend/src/components/shell/ChatAssistant.tsx`, `frontend/src/mock/db.ts`, `frontend/src/apps/site/ModelEvidencePage.tsx`, `frontend/src/apps/clinician/ModelsPage.tsx`, `frontend/src/apps/admin/AdminModels.tsx`

**Retest:** Run an assessment from the doctor portal Assistant, then check `POST /api/v1/assess` has no `calibrated: true`. Open `/evidence` and confirm there are no 0.000 values or "Cohort n = 0".

### Issue 5: Solo clinician admission

- Self-serve accounts now get a default "My practice" unit, added automatically when the backend starts.
- Solo clinicians share one tenant, so each patient is now visible only to the account that admitted them.
- The same MRN at two different solo practices no longer conflicts.

**Files:** `backend/app/seed.py`, `backend/app/deps.py`, `backend/app/routers/clinical.py`, `backend/app/routers/clinical_ops.py`

**Retest:** Sign up as a solo physician > New encounter. Expect "My practice" selected as the unit and the patient admitted. A second solo account must not see that patient.

### Issue 6: User data sent to non-admins

- Non-admin staff receive only their own user record and their own demo identity from `/api/v1/bootstrap`.
- Admin roles keep the full user list for the roster.
- `/demo-role` still lists every demo account and can still switch roles.

**Files:** `backend/app/routers/bootstrap.py`, `frontend/src/mock/db.ts`, `frontend/src/apps/auth/DemoAccessPage.tsx`

**Retest:** Sign in as a physician > DevTools > Network > `bootstrap`. Expect one entry in `users` and one in `demo_identity`.

### Issue 2: Security page and FAQ

- The Security page now separates "Built today" from "Planned".
- Encryption at rest, SSO and SCIM, enforced MFA, tamper-evident audit storage, backups, penetration testing, Saudi hosting, PDPL, SFDA, HIPAA, GDPR, SOC 2 and HITRUST are all under "Planned".
- The page states that no certification is held and that no regulator has reviewed the product.
- FAQ answers on compliance, EHR connection, accuracy, fairness, data ownership and audit were corrected.
- A new FAQ entry lists what is still planned.
- Emergency staff access no longer claims a 60-minute limit (the code allows 240) or that hospitals see it in their own audit log.
- The on-premises pricing answer now says "not yet", because it also appears on the FAQ page.

**Files:** `frontend/src/apps/site/SecurityPage.tsx`, `frontend/src/apps/site/FaqPage.tsx`, `frontend/src/apps/site/SiteArt.tsx`, `frontend/src/apps/site/PricingPage.tsx`

**Retest:** Open `/security` and `/faq`. Confirm there is no claim of AES-256, mutual TLS, hash-chained audit, a BAA or a penetration test summary as something that exists today.

## Test results

| Check | Result |
|---|---|
| Backend tests | 197 passed, including 39 new in `backend/tests/test_qa_p1.py` |
| Frontend tests | 185 passed |
| API integration tests against a live backend | 9 passed |
| Typecheck | Clean |
| Chrome run of the QA scenarios on a database copy | Passed, in light and dark at desktop and phone widths |

Three older tests asserted the behaviour QA flagged (calibrated stubs and the old disclaimer), so they were updated.

## Before pilot

- **Deployment order:** deploy the backend first. The new frontend sends a field the old backend rejects, which would make chat fail. The backend must restart for the default unit and calibration corrections to apply.
- **Clinical sign-off:** a clinician should review the red-flag list, and a native speaker the Arabic terms and messages.
- **Emergency alerts:** the patient sees the warning, but no one on the care team is notified.
- **Security page facts to confirm:** HTTPS on the hosted demo and "not hosted in Saudi Arabia" come from project documents and were not tested on the live server.
- **Same claims elsewhere:** `LegalPages`, `PricingPage` and some admin and ops screens still mention items such as a BAA or SOC 2. Legal pages are Issue 3 in P2; the others have no ticket yet.
