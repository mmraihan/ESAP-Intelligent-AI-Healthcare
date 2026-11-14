# ESAP — Role Directory & Testing Guide

One doc: who to sign in as, what each role should be able to do, and how to test all of it.
For the detailed, screen-by-screen history of what has already been tested and fixed, see
[`TEST_RESULTS_FEATURES.md`](./TEST_RESULTS_FEATURES.md) in this same folder.

---

## 1. Quick start

Paths below are relative to `system-final-v/` in this repository.

```bash
# Backend: from backend/
.venv\Scripts\activate          # Windows (source .venv/bin/activate on Linux/macOS)
uvicorn app.main:app --port 8000 --log-level warning
# No --reload in normal use: restart it by hand after any backend .py change.

# Frontend: from frontend/
npx vite --port 5175 --host localhost
```

Sign in at **http://localhost:5175/login**. Every account in §2 uses the same demo password:

```
esap-demo
```

**Sign-in is password only.** Two-factor sign-in (authenticator codes) was removed on
14 Nov 2026: no account is asked for a code, admins are not made to set one up, and the
`/auth/mfa/*` API routes no longer exist.

**One-click demo sign-in** lives on an unlisted page, `/demo-role` (production:
https://care.esap.ai/demo-role). It exists only when `VITE_DEMO_ACCESS_PATH` is set: production
sets it in `frontend/.env.production`; for local use, put `VITE_DEMO_ACCESS_PATH=/demo-role` in
`frontend/.env.local`. The backend side is `ESAP_DEMO_PICKER` (on by default, and on in
production). The picker lists:

| Group | Roles | How it signs in |
|---|---|---|
| Clinical workspace | Physician, Resident, Charge Nurse, Staff Nurse, Case Manager | One click (shared demo password) |
| Platform ops console | Super-Admin | Opens `/login` with the email filled in; type `esap-demo` |
| Patient portal | Patient | One click |

NP/PA, Pharmacist and the five hospital admin roles are **not** on the picker: sign in to them on
`/login` with the email from §2 and `esap-demo`.

The account menu (click your name, top-right) shows who you are and signs you out; it does not
switch roles. To test a different role, sign out and sign in as another account.

---

## 2. Every role: email, password, what it's for

All in tenant **St. Yves Medical Center** (`t_yves`). The same accounts exist locally (seed) and
on production.

| Role (code) | Label | Email | Password | Home screen | Surface | On `/demo-role` |
|---|---|---|---|---|---|---|
| `physician` | Attending Physician | `amara.okonkwo@styves.example` | `esap-demo` | `/doctor/worklist` | clinician | one click |
| `resident` | Resident / Fellow | `tobias.lindqvist@styves.example` | `esap-demo` | `/doctor/worklist` | clinician | one click |
| `np_pa` | Nurse Practitioner / PA | `priya.raman@styves.example` | `esap-demo` | `/doctor/worklist` | clinician | no |
| `charge_nurse` | Charge Nurse | `ines.vasquez@styves.example` | `esap-demo` | `/nurse/roster` | clinician | one click |
| `staff_nurse` | Staff / Bedside Nurse | `lucas.beaulieu@styves.example` | `esap-demo` | `/nurse/my-patients` | clinician | one click |
| `case_manager` | Care Coordinator / Case Manager | `noor.haddad@styves.example` | `esap-demo` | `/doctor/discharge` | clinician | one click |
| `pharmacist` | Clinical Pharmacist | `ezra.stein@styves.example` | `esap-demo` | `/doctor/worklist` | clinician | no |
| `tenant_owner` | Hospital Admin | `mira.novak@styves.example` | `esap-demo` | `/admin/home` | admin | no |
| `it_admin` | IT Admin | `kofi.mensah@styves.example` | `esap-demo` | `/admin/integrations` | admin | no |
| `privacy_officer` | Compliance / Privacy Officer | `sanne.devries@styves.example` | `esap-demo` | `/admin/audit` | admin | no |
| `billing_admin` | Billing Admin | `hugo.ferreira@styves.example` | `esap-demo` | `/admin/billing` | admin | no |
| `auditor` | Quality / QI Auditor | `leila.aziz@styves.example` | `esap-demo` | `/admin/usage` | admin | no |
| `super_admin` | Super-Admin (Platform) | `rmoravec@esap.health` | `esap-demo` | `/ops/fleet` | ops | typed password |
| `patient` | Patient / Caregiver | `delia.salib@example.com` | `esap-demo` | `/patient/home` | patient | one click |
| `guest` | Individual / Guest | *(sign up fresh at `/signup`)* | — | `/patient/home` | patient | no |

These are the **canonical** one-per-role accounts (`demo_identity` in the seed). The seed also has
many more accounts per clinical role, used to test unit-scoped visibility (e.g. a second NP/PA on a
different unit). Open **Roster** as an admin role to browse them.

**Passwords on production (since 14 Nov 2026).** Only the 14 accounts in the table above use
`esap-demo`. Every other production account, including the extra seeded staff and any account a
real person signed up with, has its own password. On a fresh local seed every account uses
`esap-demo`.

> **Warning:** with two-factor sign-in gone and `esap-demo` in the public site code, anyone can
> sign in to production as the admin and Super-Admin accounts above. Don't put real data behind
> them.

---

## 3. What each role can actually do (the permission model)

Every capability is graded, not just on/off:

| Symbol | Grade | Meaning |
|---|---|---|
| **F** | full | Standing, unrestricted access to that capability |
| **S** | scoped | Only their own record / assigned patients / assigned unit |
| **C** | cosign | Allowed, but the action needs a second approver |
| **B** | breakglass | No standing access — only inside a live, time-boxed, audited elevation |
| — | none | Cannot do this at all; the control is not even shown |

The frontend hides a control the backend would reject (`can(role, perm)` gates in
`frontend/src/lib/rbac.ts`), and the backend enforces the same table independently
(`backend/app/rbac.py`, seeded from the same source) — a UI bug never becomes a security hole,
it's just a broken button. **This is the thing to test**: does the UI's decision to show/hide a
control actually match what the backend allows?

### Clinician-surface roles (can open a chart)

| Role | patient:read | patient:write | assess:run | explain:view | roster:view | export:phi | transfer:initiate |
|---|---|---|---|---|---|---|---|
| Attending Physician | S | F | F | F | S | S | F |
| Resident / Fellow | C | F | F | F | S | — | — |
| NP / PA | S | F | F | F | S | S | F |
| Charge Nurse | S | — | — | S | F | — | — |
| Staff / Bedside Nurse | S | S | — | S | — | — | — |
| Case Manager | S | — | — | S | S | S | F (cosign to approve) |
| Clinical Pharmacist | S | — | — | S | — | — | — |

Resident's `patient:read` at **cosign** means their acknowledgements route to an attending for
co-sign when the tenant has that policy on (toggle: Roles & scopes → "Require attending co-sign
on resident acknowledgements").

### Admin-surface roles (console only, never opens a chart)

| Role | user:manage | tenant:manage | billing:view | audit:view | fairness:audit_view | roster:view | export:deidentified |
|---|---|---|---|---|---|---|---|
| Hospital Admin (`tenant_owner`) | F | F | F | S | — | — | — |
| IT Admin | S | F | — | — | — | — | — |
| Privacy Officer | — | — | — | F | F | — | — |
| Billing Admin | — | — | F | — | — | — | — |
| Auditor | — | — | — | F | F | F | F |

Hospital Admin also holds `transfer:initiate` (F) and `transfer:approve` (C). The Auditor's matrix
row also has `patient:read` (S) and `explain:view` (F), so it can read the fairness and calibration
evidence. It still has no clinical workspace and cannot export PHI.

IT Admin's whole reason for existing: `tenant:manage: F` (provisions accounts, wires SSO/ADT,
configures the org) but **no path to grant a clinical (chart-access) role** — that's reserved
to Hospital Admin alone, enforced both in the UI (roster, invite, bulk-import, job-title
mapping all restrict the role picker) and the backend (`send_invite`, the `roles` settings
scope). If you ever see an admin role other than `tenant_owner`/`super_admin` grant a
physician/nurse/etc. role anywhere — UI dropdown, bulk CSV, SCIM job-title mapping — that is a
regression of Bug 28 (see the ledger).

### Platform (ops) role

`super_admin` holds `patient:read` at **breakglass** only — zero standing access to any
hospital's patient data. The only way in is `/ops/break-glass`: request → a *different* person
approves (self-approval is blocked, backend-enforced) → time-boxed grant → auto-expires.
Everything else (`user:manage`, `tenant:manage`, `tenant:create`, `audit:view`,
`audit:cross_tenant`, `model:admin`, `fairness:audit_view`) is full, platform-wide.

### Patient / guest

`patient` sees only clinician-*released* content — plain language, never a raw model score,
never anything before a clinician has read and signed off on it. `guest` is the same rights on
exactly one self-serve seat (no hospital behind them).

---

## 4. How to test a role, end to end

This is the checklist that found every bug logged in `TEST_RESULTS_FEATURES.md`. Repeat it for
every role being tested, and repeat it in full on every re-test — don't just re-check the
specific thing that was fixed last time; something else may have moved.

1. **Sign in fresh.** Sign out first, or clear the site's cookies and storage (the session is an
   HttpOnly cookie, so a session from another role can mask what you're testing). Then sign in
   with that role's email and password from §2.
2. **Confirm the nav matches the matrix above.** Every link on the left rail should correspond
   to a permission this role actually holds (§3). If a link is visible, clicking it must not 403.
3. **Confirm every *hidden* link is also blocked by direct URL**, not just missing from the
   nav. Type the route straight into the address bar for 3–4 screens this role should *not*
   reach. It must bounce to the role's own home, never render even briefly.
4. **Click every button, toggle, and form on every reachable screen.** For each one, open the
   browser's network tab (or equivalent) and check the *actual* HTTP call and status code — not
   just whether something visually happened. A silent no-op is as much a bug as a 403.
5. **Test the write paths with fresh data**, not the same fixture every time — a new invite
   email, a new note, a new export scope. Re-using the same test row hides "works once, breaks
   on the second try" bugs.
6. **Check permission boundaries specifically**: pick one action this role should be able to
   do and one closely-related action it should *not* (e.g. IT Admin can invite people but not
   into a clinical role). Try the one that should fail — confirm it's actually blocked, both in
   the UI (control absent/disabled) and, ideally, by calling the API directly to bypass the UI
   (open devtools, import the app's own API client, call the endpoint with the wrong role's
   session). A control being hidden is not the same as the server enforcing it.
7. **Regression-check one unrelated role** after any fix — the role that should be *unaffected*
   by the change. Confirm it still has full, unimpaired access to whatever you just restricted
   for someone else.
8. **Run both test suites** after any code change:
   ```bash
   # Backend: from backend/ (venv active)
   python -m pytest tests/ -q

   # Frontend: from frontend/
   npm run build      # type check + production build
   npm test           # vitest
   ```
   On 14 Nov 2026: backend 357 passed; frontend 203 passed, 9 skipped; build OK.
   Restart the backend (`pkill -f "uvicorn app.main:app"`, then re-run it) after *any* backend
   `.py` change — it does not run with `--reload`. The frontend dev server hot-reloads on its
   own.
9. **Update the ledger.** Append what you tested and found to `TEST_RESULTS_FEATURES.md` in
   this same format, whether or not you found a bug — a clean pass is worth recording too.

### Known bug shapes to specifically watch for

These are the patterns that have shown up repeatedly across roles — check for them by default
on any new screen:

- **Ungated action**: a button/control shown to a role whose backend endpoint requires a
  permission the role doesn't hold → 403 on click. Fix pattern: wrap it in
  `can(role, "<permission>") && <Button>`.
- **Misleading empty state**: a card/list that's empty not because there's nothing to show, but
  because the role isn't allowed to see it (bootstrap silently returns `[]`). Looks like
  reassurance ("nothing pending!"), is actually just data you're not authorized to read. Fix:
  hide the whole card for roles that lack the permission, don't let it render as false calm.
- **Cosmetic-only gating**: a nav item hidden by permission, but the *route* itself has no
  matching guard — reachable by direct URL or by an unrelated button that doesn't consult the
  nav config at all.
- **Silently inert setting**: a toggle/setting that persists to the backend (200 OK, visible in
  the DB) but nothing anywhere actually reads or enforces it.
- **Fake-satisfied requirement**: a safety check (e.g. "a written reason is required") that's
  technically non-blank but is auto-generated by the client rather than actually collected from
  the human operator — passes validation, defeats the point.
- **Wrong scope of "real" data**: a screen that claims to show data "for this tenant" / "for
  this patient" but actually reads a global or differently-scoped snapshot that happens to look
  plausible. Always check by switching context (tenant, patient, unit) and confirming the
  numbers actually change.

---

## 5. Where things live

- `frontend/src/lib/rbac.ts` — the permission matrix (`MATRIX`) and role metadata (`ROLES`),
  source of truth for the frontend.
- `backend/app/rbac.py` — server-side enforcement, reading the same matrix from the seeded
  `documents.rbac` (kept in sync with `rbac.ts` via `npm run seed:dump`).
- `backend/seed/seed.json` / `frontend/src/mock/seed.json` — the actual seeded accounts,
  tenants, encounters, etc. `demo_identity` in there is the table in §2.
- `frontend/src/components/shell/nav.tsx` — which nav items exist per surface, and which
  permission (`anyPerm`) gates each one.
- `frontend/src/apps/auth/DemoAccessPage.tsx` — the `/demo-role` picker (which roles are
  listed, which are one click and which are private).
- `frontend/src/App.tsx` — the route guard (`guardRedirect`) that keeps a role off both the
  wrong surface *and* a same-surface screen it lacks the permission for.
- `TEST_RESULTS_FEATURES.md` — the full, ongoing log of what's been tested and every bug found
  and fixed, role by role.
