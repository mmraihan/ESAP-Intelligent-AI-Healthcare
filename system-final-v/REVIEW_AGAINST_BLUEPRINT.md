# system-final-v — Review Against the Product Blueprint

**Date:** 2026-09-26
**Scope:** `system/system-final-v/` (FastAPI+SQLite backend, React+Vite+TS frontend) reviewed against `system/PRODUCT_BLUEPRINT.md`.
**Method:** three independent reviewers (frontend engineer, backend engineer, product manager, Sonnet) read the blueprint sections and the actual code; findings verified by running the toolchain and driving the live app in a headless browser.

> **Framing note (unchanged):** this product is clinical **decision support, not diagnosis**; race/insurance/marital are audit covariates only; the trained model artifacts and MIMIC-derived data stay out of the repo per the PhysioNet DUA.

---

## 1. Headline verdict

The build is **materially more mature than the blueprint's own "today" baseline** — it already has graded RBAC, revocable server-side sessions, two-person break-glass, mandatory-reason audit logging, the calibration-honesty hard-suppress rule, a tested cross-tenant isolation suite, and a genuine (non-stub) 5-model serving path with faithful explanations. It is **not a facade**: the core clinician loop (worklist → intake → assess → results → acknowledge/co-sign) reads and writes through the real API.

The problems were concentrated in **runtime/boot, a few browser-side flows, and the expected target-state gaps** (MFA, SSO, entitlements, Postgres/RLS, real interop). The single reason "nothing worked" for you was a **backend boot blocker**: it crashed on startup, so the frontend fell into offline mode and every flow looked dead.

**Toolchain status (after fixes):** backend **115 pytest tests pass**; frontend **`tsc` clean + 170 vitest tests pass**; both servers run (`:8000` / `:5175`); demo login verified end to end.

---

## 2. What was broken — and is now fixed (verified in-browser)

| # | Broken flow | Root cause | Fix | Verified |
|---|---|---|---|---|
| 1 | **Sign-in did nothing** | Backend crashed on startup: code uses PEP 604 `str \| None` (Python 3.10+), but only Python 3.9.6 is installed and pydantic v2 can't evaluate it → backend down → frontend offline → login throws. | Added `eval_type_backport` to `backend/requirements.txt` (pydantic's own recommended shim). | Backend boots; `POST /auth/login` → 200 → worklist renders. |
| 2 | **Sign-out crashed the screen** | After logout the app routes to `/` → `LandingPage` read `m01.headline[2].value`, but on any machine without the (gitignored) trained-metrics files every model card is served "not ready" with a 1-entry headline → `undefined.value` throws. | `LandingPage.tsx` now reads the value by label with a fallback + defensive guards. | Sign-out → token cleared → `/` renders, 0 errors. |
| 3 | **No route guards** — any signed-out or wrong-role user could open `/admin/*`, `/ops/*`, etc. | `App.tsx` checked `authenticated` only on the `/` redirect; the surface wrappers rendered unconditionally (blueprint §11.6 requires per-route role/tenant checks). | Added `guardRedirect()` to all four surface wrappers: unauthenticated → `/login?next=…`; wrong surface → the user's own home. | Logged-out `/admin/home` → `/login`; admin → `/ops/fleet` bounces to `/admin/home`. |
| 4 | **Fake "hospital SSO" button** | The primary login CTA silently did a demo physician login while claiming to be single sign-on. | Relabelled to "Explore the demo as an attending physician" + honest note "Hospital single sign-on is not connected here yet" (with Arabic translation). | Button text + note render on `/login`. |

**Important run note for anyone deploying this:** the backend **requires Python 3.10+** (or the shim added above). On 3.9 it will not start and the whole UI appears broken. This belongs in the README.

A reviewer over-flagged the `headline[0]`/`strata[1]` accesses in `ModelEvidencePage`, `AdminModels`, and `ModelsPage` as crash risks; I **verified in-browser they do not crash** (headline always has ≥1 entry; `strata[1]` is gated behind `status==="degraded"`, which only occurs in the live branch that fills 2 strata). Left unchanged to avoid needless churn.

---

## 3. Proposed vs Built vs Missing (by area)

### Built and genuinely wired
- **Graded RBAC** (full/scoped/cosign/breakglass/none) enforced server-side on every route (`rbac.py`, tested in `test_access_regressions.py`). — §4.6/§4.7
- **Auth**: password login, self-serve signup (individual tenant only), invite-by-secret-token acceptance, logout, password change, forgot-password-to-admin-queue. Sessions are server-side opaque tokens, revoked on suspend/role-change/password-change. — §10
- **Break-glass elevation**: mandatory reason+ticket, TTL, two-person approve/deny/revoke, always audited. — §4.8/§9.2
- **5-model serving (non-stub)**: Tower-A logistic + calibrators (M-01), HGB (M-02/03/04), quantile+conformal (M-05), with exact-linear/occlusion explanations and a reconstruction self-check. — §18
- **Calibration-honesty hard-suppress** and the **fairness firewall** (audit covariates structurally separate; a spy test asserts byte-identical predictions with/without them). — §15.9/§18.3
- **Audit logging**, **exports-as-a-record** (PHI vs de-identified gating, reason required), **patient raw-score withholding** (enforced server-side, tested). — §9.4.8/§8.8/§15.3.3
- **Clinician loop**, **acknowledge/co-sign** (server decides co-sign), **per-encounter assessment history**, **scoped Arabic RTL i18n** with build-time coverage enforcement.

### Partial / diverging
- **Per-tenant model config** (disable a model, suppress a CCSR category, alert thresholds): fully persisted via `PUT /settings/model_display`, but **`assembler.assess()` never reads it** → a tenant's suppression has **no effect on `/assess`**. (Safety-relevant.) — §18.2
- **Cross-hospital interop/transfer**: two-button admin approve/reject only — **no MPI match scoring, no FHIR `$match`/XCPD/XCA, no consent gate**, `mpiScore` stays null. — §7
- **Model rollout/registry**: the ops rollout console appends records, but serving never consults rollout ring / threshold overrides / per-tenant enablement. — §9.4.7
- **Auth hardening**: `mfa` is a display string with no enroll/verify/challenge and **no enforcement at login for any role**; SSO/SCIM are inert config cards. — §10.9
- **Session expiry mid-use**: a 401 surfaces only as a per-action toast; the store still says `authenticated:true` (no global 401 → sign-out interceptor). — §10.11
- **Solo signup**: collects a **free-text licence** ("not verified") rather than NPPES/NPI validation. — §10.7

### Missing (proposed, not built)
| Importance | Feature | Blueprint |
|---|---|---|
| critical | Real SSO (OIDC/SAML) login | §10.8 |
| high | MFA enrollment/verification, mandatory for admin/clinical roles | §10.9/§15.2.3 |
| high | Client-side route guards *(now added — see §2)* | §11.6 |
| high | Encounter **close/discharge** endpoint (`closed` state is relied on everywhere but unreachable) | §4.6/§8.4 |
| high | Plan-based **entitlement enforcement** (Free == Enterprise once logged in) | §17 |
| high | **Postgres control plane + RLS** / schema-/DB-per-tenant isolation tiers | §5/§6/§15.2.3 |
| high | **Billing/metering** (Stripe usage events, checkout on signup) | §16.10/§17.12 |
| medium | MPI matching + consent gate for A→B transfer | §7.3/§7.5 |

---

## 4. Remaining broken/incomplete flows — prioritized backlog

These are **not yet fixed** (larger than a browser-side patch). Ranked by value/effort:

1. **Enforce `model_display` in `assess()`** *(medium, safety)* — thread `tenant_id` into `assess`, drop disabled models, filter suppressed CCSR items. A hospital ethics-committee suppression currently does nothing.
2. **Encounter close/discharge endpoint** *(medium)* — add `POST /encounters/{id}/close` with the attending co-sign gate; unblocks the `closed` state the rest of the code already expects.
3. **Global 401 → sign-out** *(small)* — intercept 401 in `api/client.ts` to clear the session instead of leaving a stale signed-in shell.
4. **MFA at invite-accept / login** *(large)* — real TOTP enroll + challenge; blueprint calls it mandatory.
5. **Plan entitlements** *(large)* — a plan→features table consulted by clinical routes + signup checkout.
6. **Real SSO, Postgres/RLS, MPI+consent, Stripe** *(each large, target-state)* — match the blueprint roadmap phases.

---

## 5. Recommendation

The four fixes in §2 make the app **usable end to end** for a demo/pilot: sign-in, sign-out, role-appropriate navigation, and honest auth affordances all work, with green tests. The §4 backlog is where the "product" work remains; items 1–3 are small/medium and high-value, items 4–6 are genuine feature builds that should be scheduled against the blueprint roadmap rather than patched ad hoc.
