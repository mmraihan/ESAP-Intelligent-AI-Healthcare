# ESAP backend — the API behind `system-final-v/frontend`

FastAPI + SQLite. Serves all four surfaces of `system/PRODUCT_BLUEPRINT.md` — the clinician
workspace, the hospital admin console, the platform ops console and the patient portal —
plus the clinical contract in `system/API_CONTRACT.md`.

> **Requires Python 3.10+.** The code uses PEP 604 unions (`str | None`). On Python 3.9 the
> app will not start (pydantic v2 cannot evaluate the annotations) and every UI flow — sign-in
> included — appears broken because the frontend falls back to offline mode. `requirements.txt`
> pins `eval_type_backport` so it also runs on 3.9, but 3.10+ is the intended runtime.

```bash
cd system/system-final-v/backend
python -m venv .venv && .venv/Scripts/activate      # Windows; POSIX: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed --reset                          # build esap.db from seed/seed.json
uvicorn app.main:app --reload --port 8000
```

Then start the frontend (`cd ../frontend && npm run dev`) and sign in at
<http://localhost:5175/login>. Interactive API docs are at <http://localhost:8000/docs>.

**Every demo account uses the password `esap-demo`.** They are synthetic identities in a
synthetic tenant; the constant is printed at seed time rather than hidden, so nobody
mistakes it for a secret. Some accounts to try:

| Email | Role | Lands on |
|---|---|---|
| `amara.okonkwo@styves.example` | Attending physician | `/doctor/worklist` |
| `ines.vasquez@styves.example` | Charge nurse | `/nurse/roster` |
| `mira.novak@styves.example` | Tenant owner (CMIO) | `/admin` |
| `sanne.devries@styves.example` | Privacy officer | `/admin/audit` |
| `rmoravec@esap.health` | Platform super-admin | `/ops/fleet` |
| `delia.salib@example.com` | Patient | `/patient` |

```bash
pytest                          # 119 tests, in-process: guardrails, the contract, access regressions, UI wiring
python tools/api_sweep.py       # ~196 checks against a RUNNING server (a few depend on seed state)
```

`pytest` exercises the app in-process. `tools/api_sweep.py` exercises a *deployment* —
real HTTP, real CORS, real uvicorn, the database that host is actually using — so it
answers "is the API up and behaving", which an in-process test cannot. It calls every
route with a role that should reach it and again with one that should not, and exits
non-zero on any failure, so it works as a post-deploy smoke gate.

---

## Where the data comes from

`seed/seed.json` **is** the demo dataset. It was produced once by a seeded generator
(mulberry32, seed `20260922`) that has since been retired; the JSON is now the source of
truth, and the frontend loads the same file as its offline fixture. Edit the JSON, then
sync the two copies:

```bash
cd ../frontend && npm run seed:dump
```

That re-exports the dataset through `frontend/src/mock/db.ts`, refreshes the §4.6 matrix from
`frontend/src/lib/rbac.ts`, and writes identical JSON to `frontend/src/mock/seed.json` and
`backend/seed/seed.json`. The round trip is lossless, so running it on unchanged data
changes nothing. One dataset, two consumers — never port it to Python, which would create
a second copy that drifts on the first edit to either side.

Every directory email is unique (a test enforces it): sign-in, session revocation and the
worklist scope all resolve a person by email, so two people sharing one address means one
of them is silently someone else.

The §4.6 permission matrix travels in that file too, exported from `frontend/src/lib/rbac.ts`.
The UI grades what it *renders*; the server grades what it *answers*, from the same matrix.
A screen that forgets to hide a control still gets a 403.

Everything is synthetic. No MIMIC-IV records, no PHI, no credentials. `*.db` and `.env` are
gitignored (PhysioNet DUA, guardrail 2).

## Storage

SQLite via stdlib `sqlite3` — no ORM. Each entity table holds the scalar columns the API
filters on plus a `doc` JSON column with the full object; responses return `doc` verbatim,
so what the client receives is exactly the shape its TypeScript declares. Adding a filter is
a column, not a renegotiation of the contract.

## Models

`MODEL_MODE=stub` (default) serves `app/predictors/stub.py`. It is **not** the trained
model, and every response says so — `ModelOutcome.status == "stub"` with a `reason`, and the
registry never reports a stub as `live`.

Two things about the stub are deliberate:

- **It is a real linear model.** Each outcome is a weighted sum of named intake features
  through a logistic link, so the `exact-linear` explanation it returns is *true of the thing
  that produced the number* — contributions plus intercept rebuild the logit, and
  `reconstruction_ok` is the self-check. A fabricated rationale would be worse than none: it
  teaches a clinician to trust an explanation nothing generated.
- **Missingness is modelled, not imputed away.** A missing dense feature gets a population
  stand-in and is flagged, which drives `calibration_validity="reduced"` and the §3.1 badge
  hard-suppress, so the UI exercises that path too.

### Real mode

`MODEL_MODE=real` serves the trained bundles in `ESAP_EXPORTS_DIR` through
`app/predictors/real.py`: M-01 Tower A (459 per-label logistic regressions + calibrators),
M-02 mortality, M-03 ICU and M-04 readmission (gradient-boosted trees + isotonic), and M-05
length of stay (quantile trees + split-conformal). Every feature is rebuilt from the column
names the bundle carries, exactly as the training scripts built them.

```bash
pip install -r requirements-real.txt          # sklearn 1.9.0 / numpy 2.5.1 / scipy 1.17.1, pinned
python tools/build_model_reference.py         # once per bundle set; needs the ml-pipeline DB
# .env:  MODEL_MODE=real   ESAP_EXPORTS_DIR=../../../ml-pipeline/model_exports
python -m app.seed --reset                    # seeded assessments now come from the real models
```

`tools/build_model_reference.py` writes `serving_reference.json` next to the bundles
(gitignored, MIMIC-derived): the train-split lab winsorisation bounds and M-01 imputation
medians the bundles did not save, the test-split risk distribution that
`population_percentile` is read against, M-04's top-decile threshold and M-05's measured
coverage. It proves itself before writing: rebuilt feature names equal the bundle's, the
rebuilt test AUROC / MAE matches the metrics file of record, M-01's rebuilt train block
reproduces the saved scaler's mean exactly, and the serving adapter reproduces the training
path's predictions on sampled test admissions.

It never falls back to the stub. `/readyz` returns 503 when a bundle or the reference file is
missing, when the reference was built for a different bundle (sha256), or when the running
scikit-learn / numpy / scipy differs from the versions the bundles were pickled under.
`model_version` is the bundle's training date plus a sha256 prefix of the file.

Explanations: M-01 is `exact-linear` on each label's log-odds (contributions + intercept
rebuild the logit before the calibrator). The tree models use `marginal-occlusion`: the change
in the estimate when one recorded input is taken out — honest about a non-additive model, and
not summing to the estimate.

## Layout

```
app/
  main.py          FastAPI app, CORS, request ids, /healthz + /readyz
  config.py        env-driven settings; no defaulted secrets
  db.py            sqlite schema + doc helpers
  seed.py          seed.json -> sqlite; demo credentials
  security.py      pbkdf2 hashing, opaque server-side session tokens
  rbac.py          the §4.6 matrix, enforced
  deps.py          current_actor, tenant_scope
  audit.py         access-audit writes (reason mandatory on break-glass / PHI export)
  errors.py        the §5 error envelope
  catalogs.py      lab / CCSR / med / enum vocabularies
  assembler.py     five ModelOutcomes -> one AssessResponse; the §3.1 suppress
  predictors/      stub.py (default) | real.py (the trained bundles, MODEL_MODE=real)
  schemas/         IntakeRequest / AssessResponse, extra="forbid"
  routers/         auth, bootstrap, clinical, catalog, admin, ops, patient
tests/             guardrails first, then the contract
tools/api_sweep.py live smoke sweep against a running server
seed/seed.json     the demo dataset (source of truth; synced with the frontend's copy)
```

## Endpoints

`GET /healthz` and `GET /readyz` are the only open routes — they are for load balancers and
say nothing about the deployment's contents. Everything under `/api/v1` needs a session,
including `meta` and `auth/roles`; the exceptions are `auth/login`, `auth/signup` and the two
invite routes, which is how a session is obtained in the first place.

| Group | Routes |
|---|---|
| Auth | `auth/login` `auth/signup` `auth/session` `auth/logout` `auth/invite/{token}` `auth/invite/accept` `auth/elevate` `auth/roles` |
| Boot | `bootstrap` — the whole permission-filtered dataset in one call |
| Clinical | `assess` `predict/{differential,mortality,icu,readmission,los}` `explain` `encounters` `encounters/{id}` `encounters/{id}/assessments` `encounters/{id}/acknowledge` `encounters/{id}/release` `extract` `assess/from-text` `cases/{hadm_id}/prefill` |
| Catalog | `schema/labs` `schema/ccsr` `schema/vocab/meds` `schema/enums` `models` `models/cards` `models/{id}` |
| Admin | `admin/{org,facilities,units,users,invites,audit,fairness,usage,billing,interop,models}` · `admin/facilities/{id}` + `/units` · `admin/invites/{id}/remind` · `admin/users/{id}/password-reset` · `admin/integrations/{key}/test` · `admin/interop/{id}/{approve,reject}` |
| Ops | `ops/{fleet,tenants,incidents,rollout,break-glass,plans,config,audit}` · `ops/incidents/{id}/{state,update}` · `ops/break-glass/{id}/{approve,deny,revoke}` |
| Patient | `patient/{home,results,records,care-team,sharing,settings}` · `patient/{intake,previsit,family,submissions}` |
| Settings | `settings/{scope}` — GET and PUT, one pair for every settings screen |
| Exports | `exports` — every Download / Export / Generate report button |

## Settings and exports

Two endpoints carry most of the product's write surface, because the alternative
was forty near-identical ones.

**`/api/v1/settings/{scope}`** backs every settings screen — org profile, integrations,
model display policy, local role titles, global flags, the plan catalogue and patient
preferences. Each scope declares the permission it needs and its defaults live in
`settings_store.py`, so a new settings tab is a default plus a permission, not a new
route or a migration. Writes are a patch, not a replace, so two people editing different
tabs of the same scope do not overwrite each other. A platform-wide flag additionally
requires a written reason: it changes behaviour for every hospital at once.

**`/api/v1/exports`** backs every download. What matters about an export is not which
screen it came from but whether it carries patient data — that decides the permission and
whether a written reason is mandatory. The audit row is written *before* the payload is
returned, so an export that failed to log is an export that did not happen. The payload is
assembled from the caller's own scope, so exporting cannot widen access.

## The rules this API enforces

These are product guarantees, not implementation preferences. `tests/test_guardrails.py`
holds each one as an executable check — if one fails, the right response is to stop, not to
adjust the assertion.

1. **Audit covariates are never model inputs.** Race, insurance and marital status live on a
   sibling of `features`, so putting one inside the feature block is a 422 rather than a
   reviewer's job to catch. Two cases differing only in covariates score identically, and no
   covariate appears in any clinical response.
2. **Everything is cut at t₀ = admission.** `frame=discharge` is refused on an intake case
   rather than guessed, because guessing post-t₀ fields is the time-travel bug itself.
3. **The §3.1 calibration hard-suppress.** One imputed dense feature makes the case
   `calibration_validity="reduced"`, which forces `calibrated=false` on *every* differential
   row whatever that label's own method says. Never badge "calibrated" over a known
   calibrator mismatch. M-02…M-05 keep native missingness and are not suppressed; M-05 has
   its own rule (`tail_coverage_reduced`) for the under-covered tails.
4. **A patient never sees a raw score.** `/patient/results` returns the release gate and the
   clinician's plain-language summary. `rawScoreWithheld` is hardcoded true on release, so
   no caller can opt into sending a probability to a patient.
5. **Access is graded, and it fails closed.** A `scoped` role is filtered server-side, and a
   caller whose scope cannot be established gets an empty list, not the whole ward. Listing
   and fetching agree, so an out-of-scope patient cannot be opened by guessing an id.
6. **Platform staff hold no standing patient access.** `super_admin`'s `patient:read` is
   break-glass: reaching a record needs a reasoned, ticketed, time-boxed elevation that is
   audited before it is usable, and a grant cannot be self-approved.
7. **Stub mode is declared, never dressed up.** No endpoint reports a stub as live.
8. **Safety features are never gated by plan.** `ops/config.safety_features_by_plan` is empty
   and stays empty.
9. **Missing data is never an error.** Empty labs, all-null vitals and no prior history are
   valid; only absent `admission_age`/`is_female` is a 422.
10. **An unconfirmed extraction never becomes a silent prediction.** `/assess/from-text`
    returns nothing scored until the clinician confirms, and unconfirmed history taints every
    differential row it reaches.

## Known gaps

Stated rather than implied:

- **Real mode serves Tower A only for M-01.** Towers B (notes) and C (code sequence) are
  PoC-scale and not served; M-04's discharge frame needs post-t0 fields and is refused.
- **Real-mode inputs are narrower than the models.** Intake accepts the 28-lab catalogue
  (the models read up to 100 labs) and matches medications to the MIMIC vocabulary by name;
  anything unmatched is listed in `unmatched_meds`, never guessed.
- **No subgroup fairness audit or drift monitoring runs on served predictions yet.**
- **Extraction (`/extract`, `/assess/from-text`) is a stub** that maps nothing. It already
  enforces the rule that matters — a draft is never auto-submitted, and any prior condition
  or lab value is `needs_confirmation` regardless of confidence.
- **Prefill needs the MIMIC-derived `ml.*` tables**, which this deployment does not mount.
  It is gated behind auth *and* a non-production flag and returns 503.
- **Tower B / Tower C / fusion are stubs** in the registry, which is the truth: the UI
  reports "Tower A only" everywhere.
- **SSO, SCIM and MFA are modelled, not integrated.** The screens and the session flow exist;
  there is no IdP. Sign-in is password-only, so the patient-settings controls for password
  change, two-factor enrolment and account closure have no endpoint behind them.
- **There is no messaging.** "Message your care team", "ask your nurse" and the care-team
  contact controls on the patient portal have no backend; a clinician-patient message store
  is a feature, not a missing route.
- **Integration connection tests cannot pass.** There is no EHR to dial, so a configured
  endpoint reports `unverified` rather than healthy. A test that always went green would be
  exactly the check people trust when the feed has actually stopped.
- **One deployable, not three.** §11.1 wants the clinical, admin and ops bundles separated.
  The routers are already split on those lines, so this is a build-config change; until then
  the tenant wall is `deps.tenant_scope` and `rbac.require`, not network separation.
- **PBKDF2, not argon2id.** Fine for synthetic demo credentials; swap `security.hash_password`
  for a real deployment. Nothing else reads the hash format.
