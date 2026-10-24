# system-final-v — Missing & Incomplete Features

**Date:** 2026-10-22
**Scope:** `system/system-final-v/` (backend + frontend) compared with `system/PRODUCT_BLUEPRINT.md`.
**Method:** I started from the gap lists in `REVIEW_AGAINST_BLUEPRINT.md` (2026-09-26), `backend/README.md` and
`frontend/README.md`, then re-checked each item against the **current code** (routes, modules, UI). Several items on those
older lists have since been built. They are listed in §4 so nobody re-opens them.
Tests were **not** run for this review. It is a code read only.

Legend: **Missing** = nothing built · **Partial** = some of it exists but it is not usable end to end · **Stub** = it exists but
does nothing real, and says so.

---

## 1. Summary

| # | Feature | Status | Priority | Blueprint |
|---|---|---|---|---|
| 1 | MFA enrolment screen (backend ready, no UI) | Partial | High | §10.10 |
| 2 | MFA **mandatory** for admin/clinical roles | Missing | High | §10.10, §15.2.3 |
| 3 | SSO login in the UI (backend ready, UI says "not connected") | Partial | High | §10.8 |
| 4 | Production OIDC token verification (`_verify_oidc` returns `None`) | Stub | Critical (for real hospitals) | §10.8 |
| 5 | SAML SSO | Missing | Medium | §10.8 |
| 6 | SCIM provisioning | Missing (config card only) | Medium | §10.9 |
| 7 | Postgres + Row-Level Security in use | Partial (SQL + config seam only; `db.py` is SQLite-only) | High | §5, §6, §15.2.3 |
| 8 | Billing / metering / Stripe checkout | Missing | High (commercial) | §16.10, §17.12 |
| 9 | Usage quotas (assessments/month, seats) | Missing | Medium | §17 |
| 10 | Real EHR / FHIR / TEFCA interop (XCPD/XCA, FHIR `$match`) | Missing | Medium | §7.6 |
| 11 | Real probabilistic MPI | Stub (deterministic score) | Medium | §7.3 |
| 12 | HL7v2 ADT feed | Missing (UI card only) | Medium | §7.7 |
| 13 | Integration connection tests (they always report `unverified`) | Stub | Low | §11.4.6 |
| 14 | Model rollout ring / per-tenant pinning used by serving | Partial (records only) | Medium | §9.4.7 |
| 15 | Drift monitoring on served predictions | Missing (empty doc) | High (clinical safety) | §18 |
| 16 | Subgroup fairness audit on **served** predictions | Missing | High (clinical safety) | §15.9, §18.3 |
| 17 | M-01 Tower B (notes) and Tower C (code sequence) served | Missing | High (accuracy) | §18 |
| 18 | Tower A+B+C fusion | Missing | High (accuracy) | §18 |
| 19 | Next-best-test (§12.7 / §18.5) | Missing (reserved empty panel) | Low (Phase 3) | §12.7, §18.5 |
| 20 | Narrative extraction (`/extract`, `/assess/from-text`) | Stub (maps nothing) | Medium | §4, API_CONTRACT |
| 21 | Real-mode intake covers only 28 of ~100 labs | Partial | Medium | §18 |
| 22 | M-04 discharge frame | Missing (refused by design, needs post-t0 data) | Low | §18 |
| 23 | Case prefill from `ml.*` tables | Partial (returns 503 here) | Low | §8 |
| 24 | Roles: Lab Technician, Radiologist, Front-Desk/Registration, Medical Coder | Missing | Medium | §3.13–§3.17 |
| 25 | Clinical delegation (beyond break-glass delegate) | Partial | Low | §4.9 |
| 26 | Email delivery (invites, password reset, notifications) | Missing | High (onboarding) | §10.4, §10.5 |
| 27 | Live refresh across sessions | Missing | Low | §11.9 |
| 28 | Three separate deployables (clinical / admin / ops) | Missing | Medium (prod security) | §11.1 |
| 29 | argon2id password hashing (PBKDF2 used now) | Missing | Medium (before prod) | §10.11 |
| 30 | PHI field-level encryption / data-residency enforcement | Missing | High (before prod) | §5.8, §6.5 |
| 31 | Arabic for the clinician, admin and ops consoles | Missing (by scope) | Low | §13.5 |
| 32 | Ops telemetry feed (GPU contention, queue depth) | Missing | Low | §11.5 |

---

## 2. Details by area

### 2.1 Identity & access
1. **MFA enrolment UI.** The backend has `/auth/mfa/enroll`, `/activate`, `/disable`, `/verify` and `/status`.
   `LoginPage.tsx` handles the TOTP challenge step. **No screen lets a user enrol**: no QR or otpauth display and no
   activate/disable. `PatientSettings.tsx` has no two-factor section either. The result is that nobody can turn MFA on from the app.
2. **MFA is optional for everyone.** Nothing in `routers/auth.py` requires enrolment for admin, platform or clinical roles. The blueprint
   says it is mandatory for them.
3. **SSO in the UI.** The backend has `/auth/sso/discover`, `/auth/sso/callback`, `/auth/sso/dev-login` and JIT provisioning
   (`app/sso.py`). The frontend never calls them. `LoginPage.tsx` and `InviteAcceptPage.tsx` still say
   "Hospital single sign-on is not connected".
4. **Production OIDC.** `sso._verify_oidc()` is an unimplemented hook that returns `None`. The only working path is the
   HMAC dev issuer (`ESAP_SSO_DEV=true`). Real RS256/JWKS verification is needed before a real IdP can sign anyone in.
5. **SAML.** There is no backend code. It is mentioned only in UI copy.
6. **SCIM.** It is only a settings card in `AdminIntegrations.tsx`. There is no `/scim/v2` endpoint and no automated deprovisioning.
7. **Password hashing.** PBKDF2-SHA256 is used, and the code itself says to swap in argon2id for real deployments (`security.py`).
8. **Missing roles.** The blueprint's Lab Technician (§3.13), Radiologist (§3.15), Front-Desk/Registration (§3.16) and
   Medical Coder/Biller (§3.17) do not exist in `frontend/src/lib/rbac.ts`, the permission matrix or the routes. There is a
   Billing Admin role, but it is not the coder persona.
9. **Delegation (§4.9).** Only the "break-glass delegate" flag on a user exists. There is no general
   delegation, such as an attending delegating co-sign or an absence cover.

### 2.2 Tenancy, data & security infrastructure
10. **Postgres + RLS.** `db_postgres_rls.sql`, `POSTGRES_RLS.md` and `config.uses_postgres` exist, but `app/db.py` imports only
    `sqlite3`. Setting `DATABASE_URL` does nothing. Tenant isolation is enforced only in the app layer.
11. **PHI encryption and data residency.** There is no field-level encryption of PHI columns and no per-tenant residency enforcement in the
    backend. Residency appears only as display text in the UI.
12. **Three deployables.** The clinical, admin and ops consoles ship as one bundle on one host. The ops console is not
    separated from public DNS.

### 2.3 Commercial
13. **Billing and metering.** `/admin/billing` is read-only display. There is no Stripe integration, no checkout at signup and no usage
    events. `entitlements.py` states that metering is out of scope.
14. **Quotas.** Plans gate *features* (which models, interop reach, admin console, SSO). They do not gate *volume*
    (assessments per month, seats).

### 2.4 Interoperability
15. **External transfer (Path B).** There is no FHIR, XCPD/XCA or TEFCA client. Transfers are ESAP-internal records approved by an admin.
16. **MPI.** `admin._mpi_score()` is a deterministic stand-in. The code says it is "not a real probabilistic MPI".
    The 0.92 auto-match and `mpi_review` flow is wired around it.
17. **HL7v2 ADT.** There is a UI card but no listener or parser.
18. **Integration tests** (`/admin/integrations/{key}/test`) cannot pass, because there is no EHR to connect to. This is deliberate and honest.

### 2.5 Models & clinical AI
19. **Tower B, Tower C and fusion** for M-01 are stubs in the registry. The UI shows "Tower A only" everywhere.
20. **Drift monitoring.** The `drift` document is written as `[]` (`evidence.py`). Nothing computes drift on live traffic.
21. **Fairness on served predictions.** `/admin/fairness` shows evaluation-time strata. No subgroup audit runs on
    production predictions (backend README, "Known gaps").
22. **Rollout is not used by serving.** `/ops/rollout` appends records (`stage`, `trafficPct`), but `assembler` and the
    predictors never read them. There is no canary routing and no per-tenant version pinning.
23. **Extraction.** `/extract` and `/assess/from-text` are stubs that map nothing. The chat route uses an LLM
    (`app/llm.py`) when one is configured, but structured narrative→intake extraction is not built.
24. **Narrow real-mode inputs.** Intake takes a 28-lab catalogue, while the models read up to 100 labs. Medications are matched by
    name, and anything unmatched is reported back.
25. **M-04 discharge frame.** It is refused because it needs post-admission data. That is correct under the t0 rule, but the blueprint's
    discharge-time readmission view is therefore not available.
26. **Next-best-test.** `ResultsPage.tsx` renders a reserved empty panel on purpose. This is Phase 3.
27. **Prefill.** It needs the `ml.*` tables mounted. Without them it returns 503 and is non-production only.

### 2.6 Communication & UX
28. **Email delivery.** There is no SMTP or email provider anywhere in the backend. Invites, caregiver invites and password
    resets depend on someone copying the link or token by hand.
29. **Live updates.** Screens re-fetch after their own writes only. A change made in another session needs a reload.
    There is no websocket or polling.
30. **Arabic** covers the patient portal and auth screens only. The clinician, admin and ops consoles are English-only, by scope.
31. **Ops telemetry.** `OpsIncidents.tsx` notes that GPU contention and queue depth "need a telemetry feed, which is not
    connected".

---

## 3. Stale documentation to fix

- `frontend/src/apps/design/CoveragePage.tsx` (`NOT_BUILT`) still says *"This build is frontend-only… All data comes from
  src/mock/db.ts"* and *"Real authentication… is backend work"*. Both are out of date, since there is a real backend with password login,
  MFA challenge and SSO endpoints.
- The `backend/README.md` "Known gaps" section still says sign-in is password-only and that patient password change and account
  closure have no endpoint. Both now exist: `/auth/password`, and the `account_closure` request kind.
- `REVIEW_AGAINST_BLUEPRINT.md` §3/§4 list items that are now done (see §4 below).

---

## 4. Previously reported as missing — now built (do not re-open)

| Item | Where it is now |
|---|---|
| Tenant `model_display` policy applied to `/assess` | `assembler.py` (policy + unit override), called from `routers/clinical.py` |
| Plan entitlement enforcement | `app/entitlements.py` + `assembler.apply_entitlements` |
| Encounter close/discharge | `POST /encounters/{id}/close`, `/doctor/discharge` |
| Global 401 → sign-out | `frontend/src/api/client.ts`, `lib/session.ts` |
| MFA TOTP at login (challenge step) | `/auth/mfa/*`, `LoginPage.tsx` |
| SSO backend (OIDC relying party + JIT provisioning) | `app/sso.py`, `/auth/sso/*` |
| NPI verification at solo signup | `app/npi.py` (Luhn + optional NPPES lookup) |
| MPI score + consent states on transfers | `routers/admin.py` (`mpi_review`, `consent_pending`) |
| Patient password change / account closure | `PatientSettings.tsx` → `/auth/password`, `/requests` |
| Patient → care-team messages (one-way request queue, **not** two-way threaded messaging; no clinician reply or inbox thread) | `PatientCareTeam.tsx`, `routers/requests.py` (`care_team_message`) |
| Waitlist, support desk, announcements, ops user directory | `routers/waitlist.py`, `support.py`, `ops_people.py` + Ops screens (uncommitted) |

---

## 5. Suggested order

1. **Quick wins (small):** the MFA enrolment screen (#1), wiring SSO into the login UI (#3), and fixing the stale docs (§3).
2. **Before any real hospital pilot:** production OIDC (#4), mandatory MFA (#2), email delivery (#26), argon2id (#29),
   PHI encryption (#30), and Postgres+RLS actually used (#7).
3. **Clinical safety:** drift (#15) and served-prediction fairness monitoring (#16), plus rollout used by serving (#14).
4. **Accuracy:** Towers B/C + fusion (#17, #18), wider lab intake (#21), real extraction (#20).
5. **Commercial and interop:** billing/quotas (#8, #9), FHIR/TEFCA + real MPI + ADT (#10–#12), and the missing roles (#24).
