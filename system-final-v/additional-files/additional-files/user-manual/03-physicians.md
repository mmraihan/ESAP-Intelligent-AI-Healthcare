# 3. Physicians: attending, resident, NP/PA

[← Manual index](README.md)

**Applies to:** Attending Physician · Resident / Fellow · Nurse Practitioner / PA · a clinician
with an individual (self-serve) account
**Home screen:** Worklist
**Left rail:** Worklist · Discharge planning · New encounter · *Reference:* Models & basis ·
How to read a result

| Role | What is different |
|---|---|
| **Attending Physician** | The primary decision-maker. Runs assessments, reads every Why panel, acknowledges, and co-signs residents' reviews. |
| **Resident / Fellow** | The full clinical workspace, but if your hospital requires it, your acknowledgement goes to an attending for **co-sign**. You cannot export patient data or start a record transfer. |
| **Nurse Practitioner / PA** | Independent authority on your assigned patients: intake, assess, acknowledge, start a record transfer. |
| **Individual clinician** | A self-serve account with the same screens, limited to your own cases. It starts empty: there are no hospital units or patients. |

---

## Tasks

### Admit a new patient and get the estimates

1. Worklist → **New encounter**.
2. Fill in the **Patient** card: full name, MRN, unit, bed.
3. Fill in **Demographics** (age, sex) and **Admission context** (admission type, location,
   *Arrived via the emergency department*). These two sections are all the models need to
   run.
4. Add anything else you have: vitals, early labs, prior conditions, medications, an
   admission note. Prior history and a note help the most.
5. Click **Admit & run assessment**. Admitting stamps t₀ on the server, then all five models
   run and the Results page opens.

> **Trying it out?** On the intake, the **Load a sample patient** card fills the whole form
> with one click: **Cardiac · 68M**, **Respiratory · 74F** or **Cold-start · 45F** (no prior
> history). **Clear** empties it again.

### Review a patient and sign off

1. Worklist → click the patient's row, or **Open next unreviewed**.
2. Check the calibration badge and the **Signal completeness** card.
3. Open **Why?** on anything that surprises you.
4. Click **Acknowledge**, add a note if you disagree or acted on it, then **Confirm review**.
   Residents under a co-sign policy click **Submit for co-sign** instead.

### Correct the intake and re-run

1. Open the patient → **Intake** tab. The form opens on exactly what the last assessment was
   given.
2. Make your corrections. **Save draft** keeps them on the encounter without running
   anything.
3. **Run assessment**. A new run is added against the **same** t₀.

### See why an estimate changed

Open the patient → **History** tab → click a run. **What changed in run #n** lists the inputs
added, removed or changed, and says whether a model version also changed.

### Co-sign a resident's review (attending)

The **Awaiting co-sign** tile on your Worklist counts residents' acknowledgements routed to
you, and those patients show **Awaiting co-sign** in the Status column.

1. Open the patient. At the bottom, the bar reads **Co-sign this review** — *"Acknowledged by
   (resident). Your co-sign closes it."*
2. Review the estimates, then click **Co-sign**.
3. The bar then reads *"Reviewed by (resident). Co-signed by (you)."* The resident's
   acknowledgement is kept; your name is added as co-signer.

Anyone else who opens the patient meanwhile sees *"Acknowledged by (resident) — awaiting an
attending's co-sign."*

### Someone escalated a patient to you

When a nurse, case manager or pharmacist clicks **Escalate**, the patient shows a red
**escalated** pill under their name on your Worklist. Open the patient: a red banner at the
top of the Results page reads **Escalated to Attending on call**, with each escalation's
urgency, who raised it, how long ago and why. Go and see the patient. (There is no "resolve"
button in this build; the banner stays on the encounter as a record.)

### Take on a patient who asked to connect

Patients who registered themselves can ask your hospital to take them on. When any are
waiting, a **Patient connection requests** card appears on your Worklist, with the patient's
age, sex and reason. **Accept & admit** creates an encounter under you and links their portal
account to it, so what they send reaches you and what you release reaches them.

### Ask another hospital for this patient's record (attending, NP/PA)

Open the patient → **Request record from elsewhere** (Results header) → **Organisation
holding the record**, **Consent basis** (Treatment · Patient request · Continuity of care) and
an optional **Note for the other organisation** → send. It goes to the Hospital Admin's
**Interop & transfer** queue and needs an identity-match confirmation before anything arrives.
Residents do not have this button.

---

## 3.1 Worklist

Your open patients with the admission-time estimates alongside.

**Tiles:** On your list · Assessed, not yet reviewed · Awaiting assessment · Awaiting co-sign.

**Columns:** Patient (name, MRN, age and sex) · Location (unit, bed, time since admission) ·
Top condition (M-01, with how many more) · Mortality · ICU · Readmit · LOS · Status (with the
calibration badge).

**Status values:** Intake in progress · Awaiting assessment · Assessed · Reviewed · Awaiting
co-sign.

| Control | Use |
|---|---|
| Search box | Name, MRN, unit or chief complaint |
| **All units** | Show one unit only |
| **My patients / Whole unit** | Your patients, or everyone on the unit |
| **Unit & time / By mortality estimate** | Sort order |
| Column headers | Sort by that column |
| **New encounter** | Admit a patient |
| **Open next unreviewed** | Opens the first patient in the current list |

Under a patient's name, a red **escalated** pill means someone asked you to look (see
*Someone escalated a patient to you*). A **Patient connection requests** card appears above
the list when self-registered patients are waiting to be taken on.

> **Why risk-sorting is not the default:** a worklist that reorders itself around a model
> score lets the software choose who is seen first. The default is the clinical order: unit,
> then admission time.

---

## 3.2 Intake (New encounter, and the Intake tab)

The admission record every model runs on. Everything on it is knowable at the moment of
admission; there is deliberately no field for anything later.

**Two ways to fill it in** (toggle at the top):

- **Structured form**: the sections below.
- **Dictate / describe**: type or paste a description, then **Extract fields**. The
  extractor is meant to propose fields with a confidence each, for you to **Confirm** one by
  one. **In this build it proposes nothing** and asks follow-up questions instead; use the
  structured form.

**Sections** (click a header to open or close it):

| Section | Level | Contents |
|---|---|---|
| **Demographics** | required | Age at admission, sex. The only demographic inputs any model receives. |
| **Admission context** | required | Admission type, admission location, *Arrived via the emergency department* |
| **Presenting vitals** | recommended | Systolic and diastolic BP, heart rate, respiratory rate, temperature, SpO₂, weight, height. Leave blank rather than guess. |
| **Early labs** | recommended | Creatinine, potassium, sodium, haemoglobin, white blood cells, lactate, albumin, urea nitrogen, each with its reference range. Only results drawn at or before admission. |
| **Prior history** | recommended | **Search a condition or CCSR code** (type at least two letters, click a suggestion), prior admissions in the last 12 months, Charlson comorbidity index. With no conditions it says *"scored as a cold-start patient"*. |
| **Medications on admission** | optional | **Search the formulary** and click to add. What the patient was already taking on arrival. |
| **Admission note** | optional | Chief complaint, history of present illness, past medical history, physical examination |
| **Audit covariates** | never a model input | Race / ethnicity, insurance, marital status. Recorded for the fairness audit only, and only when the patient is first admitted. |

**Right-hand cards:** **Signal completeness** (updates as you type) and **What happens when
you run this**: freeze at t₀ → score all five models → calibrate, or suppress calibration if
required inputs were imputed → compute the drivers → write the run to the audit log with your
name.

**Buttons:** **Save draft** (kept on the encounter; the next person to open the intake sees
*"Draft saved by name"*) and **Run assessment** / **Admit & run assessment**.

---

## 3.3 Results

The screen the product exists for.

**Header:** name, age and sex, MRN, unit and bed, admission type (and *via ED*), chief
complaint, the **t₀ chip**, and these buttons:

- **Release to patient** (once assessed, for roles that acknowledge): write a plain-language
  summary for the patient portal. See *Releasing a summary* below.
- **Ask** opens a question panel (see below). Shown to roles that may use it (attending,
  resident, NP/PA, case manager).
- **Request record from elsewhere** (attending, NP/PA, case manager): ask another
  organisation for this patient's record (see *Tasks*).
- **Export** saves the encounter summary as a file and records a patient-data export in the
  audit log. Shown only to roles with export rights (attending, NP/PA, case manager; not
  residents).

A **Released to patient** badge shows once a summary has been released.

**Tabs:** Results · Intake · Timeline · History (with the number of runs).

If nothing has been assessed yet you see **Not assessed yet** and **Go to intake**.

If anyone has escalated this patient, a red **Escalated to …** banner sits above everything
else.

**On the page, top to bottom:**

1. A **Calibration is reduced for this case** banner, when it applies.
2. The run line: when it was assessed, *run n of n*, and **Tower A only**.
3. The **risk row**: gauges for M-02 mortality, M-03 ICU and M-04 readmission, each with
   **Why?**. M-04 carries a **degraded** flag and an alert-threshold marker. A model your
   hospital has switched off for this patient's unit shows a **suppressed** flag with the
   reason, instead of a number (for example ICU admission on an ICU ward).
4. An **M-04 is serving degraded** banner when readmission is above your hospital's alert
   threshold.
5. **Likely concurrent conditions (M-01):** the top conditions ranked by presence
   probability, each with its CCSR code, family, a phrase and **Why this condition?**.
   Conditions touched by unconfirmed free-text extraction carry **unconfirmed**. If some
   categories could not be scored, the footnote says how many.
6. **Next best test**: intentionally empty; **What is this?** explains why.
7. **Expected length of stay (M-05):** a range such as **4–8 days** at the 95% level, with a
   band on a day scale and the measured coverage. *Low signal* appears when few inputs were
   available.
8. **Signal completeness** and **How to read this**.
9. The **acknowledgement bar** (chapter 2, section 2.9).
10. **From the patient**: what the patient sent from the portal, marked *Patient-reported ·
    not used by any model*:
    - **Symptom reports** and **pre-visit summaries**. **Read** opens the full text; **Mark
      seen** records your name, and the patient's portal then shows *Seen by* you.
    - **Messages**, **questions about a result** and **urgent flags**, shown with who they
      were addressed to (*To …*), an **urgent** pill when flagged, and their status (**open**,
      **in progress** or **handled**). These are read-only here: the Hospital Admin's request
      queue marks them handled. Talk to the patient directly if one needs an answer.
    Nothing here changes an estimate: it was sent after t₀ and is in the patient's own words.
    If it matters clinically, add it to the **Intake** and run the assessment again. You only
    see this for patients in your scope, and each read is logged.

### Ask

A side panel for questions about this assessment. It never produces a new estimate and has no
knowledge of its own: the server reads every answer off this encounter's **latest stored
assessment**, the same numbers and drivers as the cards and the **Why?** panel. Each answer
names its source underneath.

It recognises questions about mortality, ICU, readmission (the estimate, its percentile and the
top three drivers the model returned), length of stay, the differential, calibration (with the
model registry's ECE) and missing inputs. A question it cannot place gets a summary of the
three risk estimates and the stay. Each question is logged as `explanation.view`.

### Releasing a summary to the patient

1. **Release to patient** → write a **Headline** and the summary **In plain language**
   (both required). Optionally add *What this means for you* and *Questions you might want to
   ask*, one per line.
2. **Release**. The patient sees it under **Results** in their portal.

The patient receives your words only. No probability, percentile or model output is ever sent
to the portal, whatever you type, and the release is logged as `result.release`.

---

## 3.4 Timeline

- A banner states the **t₀ line**.
- **Coded prior history:** the prior conditions the models were given, each with its CCSR code
  and family, plus the number of admissions in the last 12 months. Dates, facilities and
  lengths of stay for each past admission need an EHR connection; none is connected, so they
  are not shown.
- **Medications on admission:** what the patient was taking at t₀.
- **What the models actually saw:** number of prior conditions, prior admissions, Charlson
  index, whether there was an admission note, and the patient's cohort (**Has prior
  history** or **Cold start**) with how well M-01 performs for that group.

---

## 3.5 History

Every assessment run on this encounter, newest first, all against the same t₀.

- **Columns:** Run · When · Triggered by (*Initial assessment* or *Re-run*, and who) ·
  Mortality · ICU · Readmission (each with the change from the previous run in percentage
  points) · LOS · Calibration.
- **Click a run** to see **What changed in run #n**: inputs added, removed or changed; the
  model versions used; and how far the mortality estimate moved.
- **Export run log** downloads the runs as a file and records the export in the audit log
  (shown only to roles with export rights).

> An estimate that moves between runs is not the model changing its mind. It is the model
> being given more of the admission record.

---

## 3.6 Discharge planning

Available to physicians as well. Described in
[chapter 5](05-case-manager-and-pharmacist.md#51-discharge-planning).

## 3.7 Models & basis

What each model is and how well it performs, including where it performs worse. Pick a model
from the tabs (**M-01 … M-05**).

| Card | Contents |
|---|---|
| **Model card** | Outcome, status, version, three headline metrics, the components in use, training data, cohort size, last evaluated |
| **Performance by subgroup** | The metric for each patient group, with a warning when two groups differ by more than 0.1 |
| **Leakage alarm** | Clear or firing. If an admission-only metric is implausibly high, the alarm fires and the number is not to be trusted until a check called a negative control has been recorded. It cannot be silenced from any screen. |
| **Calibration** | The expected calibration error (ECE). For M-05, **coverage** against the nominal 95%. |
| **Monitoring** | Weekly calibration error (action threshold 0.05) and input drift (investigate above 0.2) |
| **What this model is not** | Standing caveats |
| **All five models at a glance** | A comparison table; click a row to switch model |

> The figures on these cards come from the demo data set, not from the trained models'
> measured evaluation.

**Downloads:** **Download the M-0x model card** saves the selected model's card as a Markdown
document; **Download subgroup performance (CSV)** saves the per-subgroup metrics for all five
models. Both are built from the public evidence, contain no patient data, and are not logged.
The fairness audit by race, insurance and marital status is on the admin **Fairness audit**
screen, for the roles allowed to see it.

## 3.8 How to read a result

The in-app version of [chapter 2](02-reading-a-result.md).

Next: [4. Nurses →](04-nurses.md)
