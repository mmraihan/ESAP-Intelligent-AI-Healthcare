# 11. Glossary, FAQ and troubleshooting

[← Manual index](README.md)

## Glossary

| Term | Meaning |
|---|---|
| **t₀** | The admission time. Every model input is cut at this instant, and nothing after it is used. |
| **Intake** | The admission record the models run on: demographics, admission context, vitals, early labs, prior history, medications, admission note |
| **Encounter** | One hospital admission of one patient |
| **Assessment / run** | One execution of M-01 to M-05 on an encounter. Re-running after new admission-time information adds a run against the same t₀. It is also the billing unit. |
| **CCSR** | Clinical Classifications Software Refined: the ~502-category condition taxonomy M-01 scores |
| **Differential** | M-01's ranked list of conditions that may already be present at admission |
| **Presence probability** | The chance a condition is already present at admission, not a prediction that it will develop |
| **AUROC** | How well a model separates patients with and without the outcome (0.5 is chance, 1.0 is perfect) |
| **AUPRC** | Area under the precision-recall curve; useful for rare outcomes |
| **Recall@20** | The share of a patient's actual conditions that appear in M-01's top 20 |
| **Calibration** | Whether probabilities mean what they say: of cases called 30%, about 30% had the outcome |
| **ECE** | Expected calibration error. Lower is better; 0.05 is the action threshold. |
| **Coverage** | For M-05, the measured share of patients whose actual stay fell inside the predicted range |
| **Imputed** | A missing input filled in with an estimated value. It still moves the estimate, so it is labelled. |
| **Calibration reduced** | A case where required inputs were imputed; the Calibrated badge is removed for that patient |
| **Signal completeness** | How much of the intake the models received |
| **Cold start** | A patient with no coded prior history; M-01 is materially less accurate for them |
| **Stratum / stratified** | A patient subgroup, and metrics reported per subgroup rather than pooled |
| **Degraded** | A model serving with a known, labelled weakness. M-04 is degraded on first-admission patients. |
| **Tower A / B / C** | M-01's tabular, note and history components. Only Tower A is in use ("Tower A only"). |
| **Why panel** | The explanation panel showing the computed drivers of an estimate |
| **Exact linear / marginal occlusion** | The two explanation methods: an exact breakdown (M-01), or remove-and-rescore (M-02 to M-05) |
| **Leakage alarm** | Fires if an admission-only metric is implausibly good, suggesting later information leaked in |
| **Negative control** | A test run to confirm a strong result is not caused by leakage |
| **PSI** | Population stability index: how far current admissions have drifted from the training population. Investigate above 0.2. |
| **Acknowledge** | Record that a named clinician reviewed an estimate. Not agreement. |
| **Co-sign** | A senior signature on a resident's acknowledgement |
| **Escalate** | Flag a patient to the attending on call. It shows on their Worklist and the patient's Results page. |
| **Suppressed** | A model your hospital has switched off for a unit. The gauge shows the flag and the reason instead of a number. |
| **Intake assistant** | The chat panel (bottom-right) that turns plain-language descriptions into intake fields |
| **Audit covariates** | Race, insurance and marital status. Recorded for the fairness audit only, never model inputs. |
| **Tenant** | One customer organisation (a hospital or health system) and its walled-off data |
| **Break-glass** | A time-limited, justified emergency access to one patient record |
| **Match (MPI) score** | How closely two identity records match. Below the threshold, a person must confirm. |
| **ADT** | HL7v2 admit / transfer / discharge messages. An admission message creates an encounter and sets t₀. |
| **SMART on FHIR** | Opening ESAP inside the EHR with the patient already selected |
| **SCIM** | Automatic account creation and removal from the hospital's identity system |
| **Canary** | Serving a new model version to a small share of traffic before full rollout |
| **Promotion gate** | The rule that a version advances only when every patient group clears its bar |

---

## FAQ

**Why can't I sort my worklist by risk by default?**
A worklist that reorders itself around a model score lets the software decide who is seen
first. Risk sorting is one click away but never the default. The Charge Nurse's roster is the
exception, because allocating staff is a ranking job.

**Why are the gauges blue rather than red, amber and green?**
A traffic light invites snap judgements from colour alone, and red/green colour blindness is
common. Read the number and the phrase.

**The estimate changed. Did the model change its mind?**
No. Open the **History** tab: each run lists what was added and the model versions used. The
t₀ cut never moves.

**I entered vitals but the estimate did not move.**
Either they were recorded as **Since admission** (chart only, never used by a model), or the
assessment has not been run again yet. Values recorded **At or before admission** fill any blank
field on the intake, and reach the models when a physician or NP/PA next runs the assessment.
They never overwrite a value already on the intake.

**Why is there no Calibrated badge on this patient?**
Either the model is uncalibrated here, or this patient's case has **calibration reduced**
because required inputs were imputed. Adding prior history or an admission note usually helps
most.

**Why is M-04 shown at all if it is weak?**
It is useful for ranking patients who *have* a prior admission. It is labelled degraded
everywhere, and a Hospital Admin can switch it off.

**Can the Ask panel give me a new estimate?**
No. It only restates what is on the latest stored assessment: the estimates, percentiles and the
drivers the model returned, with the source named under each answer. For the full breakdown of
any one estimate, use **Why?**.

**I am a nurse. Why can't I acknowledge, or run the assessment?**
Acknowledgement is the physician's signature and the audit trail depends on it. Running the
models is also a physician / NP / PA action. You can admit a patient and capture the intake
(Staff Nurse), and escalate.

**I escalated a patient. How do I know the attending saw it?**
The escalation is shown to them on their Worklist (an **escalated** pill) and at the top of the
patient's Results page. There is no "resolved" confirmation in this build, so follow up in
person for anything urgent.

**How do I switch to another role in the demo?**
Click your name → **Sign out**, then sign in as another account, or use the **Demo — sign in
as any role** card on the sign-in page. There is no role switcher inside the app.

**Where did a button go?**
ESAP only shows the buttons your role can use. If a colleague sees **Export**, **Ask**, **New
encounter** or **Discharge** and you do not, your role does not have that right (see
[chapter 10](10-permissions-reference.md)).

**Can an administrator see patient charts?**
No. Admin roles have no clinical surface. The Privacy Officer sees *who accessed what*, not the
chart.

**Can ESAP staff see our patients?**
Not by default. The only path is break-glass: one named patient, a reason, a ticket, and a time
limit that cannot be extended. It appears in your audit log, and your hospital can switch it
off entirely in **Org settings**.

**Will a patient ever see "31% mortality"?**
No. Patients see only summaries a named clinician has read and released.

**Are these the real trained models?**
It depends on how the server was started; see [About this build](README.md#about-this-build).
The **History** tab's model-version badge tells you: `stub-1.0.0` means the stand-in.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| **Cannot reach the ESAP server** | The server is not running or not reachable. Start it (below), then **Try again**. |
| Sent back to the sign-in page | Your session ended (role change, password reset, or a demo reset). Sign in again. |
| A message that your role lacks a capability | The server refused the action for your role. See [chapter 10](10-permissions-reference.md). |
| You typed a screen's address and landed on your home screen | Your role cannot use that screen. |
| A charge nurse's roster or handoff shows no patients | Their account has no assigned unit. A Hospital Admin sets **Assigned units** in **Roster**. |
| A nurse-admitted patient does not appear for a physician | The physician is not assigned to that unit. Check both accounts' **Assigned units** in **Roster**. |
| The intake assistant replies briefly and mechanically | The AI language service is not reachable. Field capture still works. |
| A worklist or roster is empty | Normal for admin roles, patients, the Super-Admin before break-glass, and new individual accounts. |
| **This screen could not be shown** | Click **Try again** or use the left rail. Report the screen and what you clicked. |
| The frontend opened on port 5176 or 5177 | Fine; use the address `npm run dev` printed. |

---

## Running and resetting the demo

These steps are for whoever runs the demo server. Everything is under
`system/system-final-v/`.

**Start it:**

```bash
# terminal 1: backend
cd system/system-final-v/backend
.venv/Scripts/activate                 # Windows (Mac/Linux: source .venv/bin/activate)
python -m app.seed --reset             # (re)creates the demo database
uvicorn app.main:app --port 8000       # check http://localhost:8000/readyz says "ok"

# terminal 2: frontend
cd system/system-final-v/frontend
npm run dev                            # normally http://localhost:5175
```

### Resetting the demo

Stop the backend (Ctrl+C), run `python -m app.seed --reset`, start it again. All demo data goes
back to the starting state and everyone is signed out. Do this before showing the system to
anyone.

### Serving the trained models

In `backend/.env` set:

```
MODEL_MODE=real
ESAP_EXPORTS_DIR=../../../ml-pipeline/model_exports
```

This needs the trained model files and their `serving_reference.json` in that folder (both are
MIMIC-derived and stay on the machine under the PhysioNet data use agreement), and the exact
library versions the models were saved with (`pip install -r requirements-real.txt`). Then run
`python -m app.seed --reset` so the demo patients are scored by the real models, and restart
the backend. `/readyz` returns an error, rather than falling back to the stand-in, if anything
is missing or mismatched.
