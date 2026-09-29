# ESAP Intelligent AI Healthcare — complete product UI

The full front end for `system/PRODUCT_BLUEPRINT.md`: four surfaces, 69 routes, one
design system, light / dark / system themes. It talks to the backend in
[`../backend`](../backend/README.md) when one is running, and falls back to a bundled
fixture when there is not.

```bash
cd system/system-final-v/frontend
npm install
npm run dev        # http://localhost:5175
npm run build      # typecheck + production bundle
npm test           # 69 routes, full Arabic coverage, live API contract (93 tests)
npm run seed:dump  # sync the shared demo dataset to the backend (see "Data")
```

For the live system, start the API first — see [`../backend/README.md`](../backend/README.md):

```bash
cd ../backend && uvicorn app.main:app --reload --port 8000
```

Sign in at `/login` with any demo account and the password `esap-demo`
(`amara.okonkwo@styves.example` is an attending physician). Point the client at a
different host with `VITE_API_BASE`.

**With no backend it still runs offline**, on the bundled fixture: every screen renders,
nothing is saved. Which one you are looking at is stated in the identity menu, because a
demo that silently falls back to fixtures looks identical to a working system right up
until someone asks why their edit did not save.

---

## What is in here

| Surface | Routes | Blueprint |
|---|---|---|
| Public site & auth | `/product` `/evidence` `/security` `/pricing` `/login` `/signup` `/invite/:token` | §10, §15, §16, §17 |
| Clinician workspace | `/doctor/*` `/nurse/*` `/models` `/help` | §12 |
| Hospital admin console | `/admin/*` — 13 screens | §11.4 |
| Platform ops console | `/ops/*` — 9 screens | §11.5 |
| Patient portal | `/patient/*` + `/welcome` — screens P0–P10 | §13 |
| Design system & coverage | `/design` `/design/permissions` `/design/coverage` | §14, §4.6 |

`/design/coverage` is the live index: every blueprint screen, the route that implements
it, and an explicit list of what a frontend-only build cannot cover. Start a client
walkthrough there.

## Seeing all of it

The top-right identity menu switches role. Each role lands on its own home and sees only
its own console, so switching to *Charge Nurse* gives you the nurse rail, and *Super-Admin*
gives you the ops console.

**This switcher is a demo affordance.** §11.1 requires three separate deployables in
production — a guest-reachable clinical app, a tenant-walled admin console, and an ops
console that is not on public DNS. The route groups in `src/App.tsx` map 1:1 onto that
split, so separating them is a build-config change rather than a rewrite.

## Themes

Light, dark and system are all first-class. `system` is the default and follows the OS
live; an explicit choice always wins and persists. The toggle is in every top bar, and on
`/patient/settings` for the patient surface.

The mechanism is the three-layer token pattern from §14.3: tokens on `:root`, redefined
under `@media (prefers-color-scheme: dark)` guarded by `:not([data-theme="light"])`, and
again under `[data-theme="dark"]`. A pre-paint script in `index.html` applies the stored
choice before first render, so a dark-mode user never sees a white flash.

Open `/design` and switch the theme — every swatch on that page is the live token.

## Languages — English and Arabic

Two languages only. Arabic is complete on the surfaces where the language is chosen
(§13.5): the patient portal (P0–P10), sign-in, sign-up and invite acceptance, plus the
shell around them. Choosing العربية switches the page immediately to right-to-left.

- **Where to switch:** the EN | العربية toggle in the patient top bar and on the auth
  pages, the language cards on `/welcome`, or `/patient/settings`.
- **Scope boundary:** the clinical, admin and ops consoles stay English and left-to-right
  whatever the patient-side preference, so a stored Arabic choice never flips a
  clinician's workstation. Extending Arabic to them means wrapping their strings in `t()`
  and adding entries — the infrastructure already handles them.
- **How it works:** English strings are the keys (`t("Share & consent")`), `src/i18n/ar.ts`
  maps them to Arabic, and `**bold**` / `{placeholder}` markers live inside each
  translation so Arabic word order is respected. Layout mirrors through CSS logical
  properties (`margin-inline-start`, not `margin-left`); charts, codes and identifiers
  stay left-to-right on purpose. Dates use the Gregorian calendar with Western digits.
- **Guard:** `src/i18n.test.tsx` fails if any key on a localised screen lacks an Arabic
  entry, if a translation drops a placeholder, or if any localised route rendered in
  Arabic still shows an English word other than a person's name or a fixed acronym.

## Layout

```
src/
  theme/ThemeProvider.tsx   light / dark / system
  lib/
    rbac.ts                 16 roles, the §4.6 permission matrix, graded access
    session.ts              demo session + break-glass elevation state
    format.ts               tabular numbers, the sequential ramp, percentile phrases
    ccsrFamilies.ts         validated categorical palette for condition families
  mock/
    db.ts                   the whole demo dataset, seeded so it is identical every run
    types.ts                platform domain types (§5, §6, §7, §9, §17)
    clinical-types.ts       clinical contract, transcribed from API_CONTRACT.md
  components/
    ui/                     primitives, DataTable, overlays, charts, domain tags
    clinical/               gauges, differential, Why drawer, acknowledge bar, chat
    shell/                  AppShell, nav trees, theme toggle
  apps/
    site/ auth/ clinician/ admin/ ops/ patient/ design/
  styles/
    tokens.css              design tokens + base (shared with system/frontend)
    app.css screens.css     component and screen layers
```

## The rules this UI encodes

These are product guarantees from the blueprint, not styling preferences. They are the
things to avoid "fixing":

1. **The risk ramp is one blue hue, never a stoplight** (§14.3.2). A stoplight trains
   snap-judgement, which is the over-reliance the non-device-CDS posture exists to
   prevent, and red/green is the most common colour-vision confusion. Magnitude is
   carried by arc length and a printed number; colour only reinforces.
2. **Colour never carries meaning alone** (§14.3.3). Every coloured state pairs with an
   icon, a label, a position or a length.
3. **Audit covariates are never model inputs.** Race, insurance and marital status appear
   on exactly one screen — `/admin/fairness` — and never on a clinical surface.
4. **Everything is cut at t₀ = admission.** The t₀ chip, the timeline rule and the vitals
   entry screen's timing control all exist to make that visible.
5. **Calibration state is always shown**, and `calibration reduced` hard-suppresses the
   Calibrated badge rather than qualifying it.
6. **A patient never sees a raw score** (§13.6). `/patient/results` shows the release gate
   explicitly, so a patient knows a result exists and is being reviewed.
7. **The leakage alarm cannot be silenced** from any screen. It can be explained and
   resolved with a negative control; it cannot be dismissed.
8. **No dual-axis charts.** Metrics on different scales render as small multiples sharing
   one x-axis.
9. **Safety features are never gated by plan.** Calibration, the Why panel, the degraded
   label and the stratified evidence are identical on the free tier and on enterprise.

## Data

All synthetic, originally generated from a fixed seed (`mulberry32`, seed `20260922`) so a
demo shows the same numbers every time. No MIMIC-IV data, no real patient information and no
credential appears anywhere in this build. Names, MRNs and dates are invented.

The generator has been retired: `src/mock/seed.json` is now the source of truth. Edit it,
then run `npm run seed:dump`, which re-exports it through `src/mock/db.ts` (losslessly),
refreshes the §4.6 permission matrix from `src/lib/rbac.ts`, and writes the same JSON to
`src/mock/seed.json` (this build's offline fixture) and `../backend/seed/seed.json` (what the
API loads into SQLite). One dataset, two consumers, so the offline demo and the live system
cannot drift apart, and the server enforces the exact grades this UI renders.

Writes go through `src/api/actions.ts`, which every screen shares: `act()` runs a mutation
and returns a sentence for the toast, `actAndRefresh()` also re-pulls the store so the
table under the button agrees with what just happened, and a control that cannot reach the
API says so rather than claiming success. Failures show the server's own words — "That
patient is outside your assigned scope" and "Session expired" call for different actions.

`src/mock/db.ts` is now a **store** rather than a generator: the same export names, filled
at boot either from `GET /api/v1/bootstrap` or from the fixture. No screen changed. The
clinical response shapes in `mock/clinical-types.ts` are transcribed from `API_CONTRACT.md`
field-for-field, and `src/api/integration.test.ts` checks the server's payloads against them
whenever the API is up.

## Tests

`npm test` renders all 69 route/role combinations and fails on any thrown error or any
`console.error`. It is shallow by design: with no backend, "does every screen mount
against the data contract" is the failure mode worth catching automatically.

## Known gaps

Stated rather than implied — the same list is on `/design/coverage`:

- The three-bundle split of §11.1 (route groups map onto it; the split itself is not done).
- SSO and SCIM — the screens and flows exist, the IdP integration does not. Sign-in is
  password-only against the backend.
- Predictions are served by the backend's **stub** predictor, which declares itself as such
  on every response. Wiring the trained artifacts is `backend/app/predictors/real.py`.
- Next-best-test (§18.5) renders an empty reserved panel on purpose.
- Tower B / Tower C fusion — the UI reports "Tower A only" everywhere, which is the truth.
- Four screens still have controls with no backend behind them, because the feature does
  not exist rather than the wiring being missing: patient password change, two-factor
  enrolment and account closure (no identity provider), and "message your care team" on
  the patient results and care-team screens (no messaging store). The design-system page's
  buttons are deliberate UI demos.
- Screens re-hydrate after their own writes, but not on someone else's; reload to see a
  change another session made.
