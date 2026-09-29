# ESAP — Role Directory & Testing Guide

One doc: who to sign in as, what each role should be able to do, and how to test all of it.
For the detailed, screen-by-screen history of what has already been tested and fixed, see
[`TEST_RESULTS_FEATURES.md`](./TEST_RESULTS_FEATURES.md) in this same folder.

---

## 1. Quick start

```bash
# Backend — from system/system-final-v/backend
source .venv/bin/activate
uvicorn app.main:app --port 8000 --log-level warning
# no --reload in normal use: restart manually after any backend .py change
#   pkill -f "uvicorn app.main:app"; then re-run the line above

# Frontend — from system/system-final-v/frontend
npx vite --port 5175 --host localhost
```

Sign in at **http://localhost:5175/login**. Every seeded account below uses the same demo
password unless noted otherwise:

```
esap-demo
```

The account menu (click your name, top-right) no longer lets you switch roles from inside
the app — that was removed. To test a different role, sign out and sign back in with a
different email from the table below, or use the role picker on the **public login page**
(that one is a logged-out convenience for exploring the demo and is intentionally kept).

---

## 2. Every role — email, password, what it's for

All in tenant **St. Yves Medical Center** (`t_yves`) unless marked otherwise.

| Role (code) | Label | Email | Password | Home screen | Surface |
|---|---|---|---|---|---|
| `physician` | Attending Physician | `amara.okonkwo@styves.example` | `esap-demo` | `/doctor/worklist` | clinician |
| `resident` | Resident / Fellow | `tobias.lindqvist@styves.example` | `esap-demo` | `/doctor/worklist` | clinician |
| `np_pa` | Nurse Practitioner / PA | `priya.raman@styves.example` | `esap-demo` | `/doctor/worklist` | clinician |
| `charge_nurse` | Charge Nurse | `ines.vasquez@styves.example` | `esap-demo` | `/nurse/roster` | clinician |
| `staff_nurse` | Staff / Bedside Nurse | `lucas.beaulieu@styves.example` | `esap-demo` | `/nurse/my-patients` | clinician |
| `case_manager` | Care Coordinator / Case Manager | `noor.haddad@styves.example` | `esap-demo` | `/doctor/discharge` | clinician |
| `pharmacist` | Clinical Pharmacist | `ezra.stein@styves.example` | `esap-demo` | `/doctor/worklist` | clinician |
| `tenant_owner` | Hospital Admin | `mira.novak@styves.example` | `esap-demo` | `/admin/home` | admin |
| `it_admin` | IT Admin | `kofi.mensah@styves.example` | `esap-demo` | `/admin/integrations` | admin |
| `privacy_officer` | Compliance / Privacy Officer | `sanne.devries@styves.example` | `esap-demo` | `/admin/audit` | admin |
| `billing_admin` | Billing Admin | `hugo.ferreira@styves.example` | `esap-demo` | `/admin/billing` | admin |
| `auditor` | Quality / QI Auditor | `leila.aziz@styves.example` | `esap-demo` | `/admin/usage` | admin |
| `super_admin` | Super-Admin (Platform) | `rmoravec@esap.health` | `esap-demo` | `/ops/fleet` | ops |
| `patient` | Patient / Caregiver | `delia.salib@example.com` | `esap-demo` | `/patient/home` | patient |
| `guest` | Individual / Self-serve | *(sign up fresh, or use the public "Individual" demo picker)* | — | `/patient/home` | patient |

These are the **canonical** one-per-role accounts (the same list the public login page's demo
picker uses). The seed also has many more accounts per clinical role (used to test unit-scoped
visibility, e.g. a second NP/PA assigned to a different unit) — open **Roster** as any admin role
to browse the full staff directory and pick a specific unit/scope if a test needs one.

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

| Role | user:manage | tenant:manage | billing:view | audit:view | fairness:audit_view |
|---|---|---|---|---|---|
| Hospital Admin (`tenant_owner`) | F | F | F | S | — |
| IT Admin | S | F | — | — | — |
| Privacy Officer | — | — | — | F | F |
| Billing Admin | — | — | F | — | — |
| Auditor | — | — | — | F | F |

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

1. **Sign in fresh.** Clear `localStorage`/`sessionStorage` first (a stale token from another
   role can mask what you're actually testing) and sign in with that role's real credentials.
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
   # Backend — from system/system-final-v/backend
   source .venv/bin/activate && python -m pytest tests/ -q

   # Frontend — from system/system-final-v/frontend
   npx tsc --noEmit && npx vitest run --no-file-parallelism
   ```
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
  tenants, encounters, etc. `demo_identity` in there is the exact table in §2.
- `frontend/src/components/shell/nav.tsx` — which nav items exist per surface, and which
  permission (`anyPerm`) gates each one.
- `frontend/src/App.tsx` — the route guard (`guardRedirect`) that keeps a role off both the
  wrong surface *and* a same-surface screen it lacks the permission for.
- `TEST_RESULTS_FEATURES.md` — the full, ongoing log of what's been tested and every bug found
  and fixed, role by role.
