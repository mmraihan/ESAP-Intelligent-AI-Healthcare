# 2. Reading a result

[← Manual index](README.md)

For anyone who sees an estimate. Read this before you act on one. The same ideas are in the
app under **How to read a result** in the left rail.

---

## 2.1 The two mistakes to avoid

1. **Reading a probability as a statement about this patient.** A mortality estimate of
   **31%** does *not* mean this patient has a 31% chance of dying. It means that of past
   admissions that looked like this one at admission, about 31% did not survive to
   discharge.
2. **Reading the colour instead of the number.** Colour only shows magnitude. Read the
   printed number and the phrase next to it.

---

## 2.2 t₀: everything is cut at admission

Every model uses **only what was known when the patient was admitted** (t₀, the admission
time). Nothing recorded later enters any estimate: no later labs, no response to treatment,
no later notes.

- The **t₀ chip** (clock icon) on each encounter shows the cut, for example
  *"t₀ 18 Sep, 14:02 · intake-only cut"*.
- On the **Timeline** tab, a line marks t₀. Everything listed there was given to the models.
- Observations recorded **after** admission are saved to the chart but never reach a model,
  and the screen tells you so when you save them.
- Re-running an assessment after correcting the intake **never moves t₀**. It gives the
  models more of the admission record, not a later one.

**Why it matters:** an estimate cannot know how the patient has done since admission. If the
patient has clearly changed, the estimate no longer describes them.

---

## 2.3 The risk gauges (M-02, M-03, M-04)

Each gauge has four parts:

| Part | Meaning |
|---|---|
| **Arc length** | The size of the estimate. It reads correctly even without colour. |
| **Number** | The estimate itself, always printed |
| **Phrase** | Where it sits against other admissions |
| **Badge** | Whether the number is calibrated (section 2.5) |

The phrases, from lowest to highest:

| Estimate | Phrase |
|---|---|
| below 2% | *lower than most admissions* |
| 2% to 8% | *below the typical admission* |
| 8% to 20% | *around the middle of admissions* |
| 20% to 45% | *above the typical admission* |
| 45% to 70% | *in the upper range of admissions* |
| 70% and above | *among the highest of admissions* |

**Why one blue colour ramp and not red/amber/green?** A traffic light trains the eye to
snap-judge ("green means ignore"), which is exactly the over-reliance ESAP is designed to
avoid. Red/green colour blindness is also common. Read the number and the phrase.

M-04 (readmission) also shows a marker when it is **above the alert threshold** your hospital
set (28% by default).

---

## 2.4 What each model's estimate covers

| Model | What it covers | What it does not |
|---|---|---|
| **M-01** Differential | Conditions that may **already be present** at admission, ranked | A prediction of what will develop |
| **M-02** Mortality | Death during **this** admission | Survival after discharge |
| **M-03** ICU | An ICU stay **at any point** during the admission | That transfer is imminent |
| **M-04** Readmission | Return within 30 days, estimated **at intake** | The discharge plan, which is what actually drives readmission |
| **M-05** Length of stay | A **range** in days at the 95% level | A single number. The range is the estimate; do not quote the midpoint alone. |

---

## 2.5 Calibration badges

| Badge | Meaning |
|---|---|
| **✓ Calibrated** | Checked against outcomes: of cases called 30%, close to 30% had the outcome. |
| **uncalibrated** | Not a fault. The **ranking** is trustworthy; the absolute percentage may be off. |
| **calibration reduced** | Some required inputs for **this patient** were missing and were filled in (imputed). The Calibrated badge is then **removed from the whole page**, not shown with a caveat. The ordering is still usable. |

A hospital cannot switch calibration badges off.

---

## 2.6 Signal completeness

The **Signal completeness** card shows how much of the intake the models received, as
*"n of 7 input groups present"*:

| Input group | Level |
|---|---|
| Demographics | required |
| Admission context | required |
| Vitals | recommended |
| Early labs | recommended |
| Prior history | recommended |
| Medications | optional |
| Admission note | optional |

**Prior history** and an **admission note** improve the estimates the most. A patient with no
coded prior history is a **cold-start** patient, and the differential (M-01) is materially
less accurate for them. The Timeline tab tells you which group your patient is in.

---

## 2.7 The Why panel

Every risk gauge has a **Why?** button, and every condition in the differential has **Why this
condition?**. Either opens a panel with four parts:

1. **How this was produced.** The method is always named:
   - **Exact linear decomposition** (M-01). Each contribution is the model's own coefficient
     times this patient's value, and together they rebuild the score exactly. A
     **Reconstruction check passed** pill confirms it.
   - **Marginal occlusion** (M-02 to M-05). Each input is taken out in turn and the case is
     re-scored. This is a faithful local approximation, not an exact breakdown, and the
     contributions do not add up to the estimate.
2. **What moved this estimate.** Each input with its value, a bar showing direction, the
   words *Raises* or *Lowers the estimate*, and the size on the log-odds scale. An input that
   was missing and filled in carries an **imputed** tag.
3. **In words** (when present). One sentence generated **from the drivers above**. It adds no
   information of its own.
4. **What this does not tell you.** The caveats for this model.

The drivers are always computed from the model itself, never written by a language model.
That is what lets you review the basis for an estimate independently.

---

## 2.8 Model status labels

| Label | Meaning |
|---|---|
| **live** | Serving normally |
| **degraded** | Serving with a known weakness, labelled wherever the model appears. **M-04 is degraded**: on patients with no prior admission it is close to chance. Use it to rank patients who *do* have admission history. |
| **Tower A only** | M-01 uses its tabular component only. The note and history components are built but not yet combined into the score. |

**Next best test** on the Results page is intentionally empty: it is designed but not built,
and a suggested test not computed from the model would read as clinical advice the software
cannot support.

---

## 2.9 Acknowledging a result

At the bottom of the Results page is the acknowledgement bar.

- **Acknowledging records that you reviewed the estimate, not that you agreed with it.** It is
  the audit trail showing a named clinician reviewed it.
- You can add a note: what you did with it, or why you disagreed.
- A **Resident**, at a hospital that requires it, sees **Submit for co-sign**. The attending
  then sees **Co-sign this review** with a **Co-sign** button; everyone else sees *"awaiting
  an attending's co-sign"*.
- **Nurses, case managers and pharmacists** do not acknowledge. They see **Escalate**, which
  flags the patient to the attending on call: an **escalated** pill on the Worklist and an
  **Escalated to …** banner on the Results page.
- Once reviewed, the bar reads *"Reviewed by name, time"*, plus *"Co-signed by name"* if there
  is one.

---

## 2.10 When to set an estimate aside

- **The intake is wrong.** Correct the intake and re-run. Do not adjust the output in your head.
- **The patient has clearly changed since admission.** Nothing after t₀ is in the estimate.
- **The model is flagged degraded** for this kind of patient.
- **Your own assessment disagrees.** You are the decision-maker. Record the disagreement in
  the acknowledgement note.

## 2.11 What is never used

**Race, insurance and marital status are never model inputs.** They are recorded only so the
fairness audit can check that the models perform evenly across groups, and they appear only
on the **Fairness audit** screen. If you ever see one on a clinical screen, report it to your
informatics team; it is a defect.

Next: [3. Physicians →](03-physicians.md)
