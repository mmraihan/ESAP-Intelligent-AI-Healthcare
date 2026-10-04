# 4. Nurses: charge and bedside

[← Manual index](README.md)

| Role | Home screen | Reach |
|---|---|---|
| **Charge Nurse** | Unit risk roster | The whole unit. Sees every patient's risk ranking to allocate staff and run the shift handoff. |
| **Staff / Bedside Nurse** | My patients | Your assigned patients. Captures the admission record the models run on, and reads the risk summaries. |

**Left rail:**

| Item | Charge Nurse | Staff Nurse |
|---|:-:|:-:|
| Unit risk roster | ✓ | – |
| My patients | ✓ | ✓ |
| Triage | – | ✓ |
| Handoff summary | ✓ | – |
| Admit a patient | – | ✓ |
| Models & basis · How to read a result | ✓ | ✓ |

**What nurses do not do:** acknowledge a result. That is the attending's signature, and the
audit trail depends on it being theirs. Nurses **escalate** instead.

### What each nurse role can do

The screens only show what your role can do, and the server enforces the same rules:

| Action | Charge Nurse | Staff Nurse |
|---|:-:|:-:|
| See risk estimates and summaries | ✓ | ✓ |
| Escalate to the attending | ✓ | ✓ |
| Admit a patient, Triage (create the encounter) | – | ✓ |
| Save an intake draft | – | ✓ |
| Record vitals | – | ✓ |
| Add and tick tasks | ✓ | ✓ |
| **Run the assessment** (the five models) | – | – |
| Send the handoff | ✓ | – (no Handoff screen) |
| Export the handoff (patient data) | refused | – |

So for the Staff Nurse the intake button reads **Admit patient** (or **Save intake** on an
existing patient) rather than *Admit & run assessment*. The patient is admitted and what you
captured is saved on the encounter as a draft; the patient waits as **Awaiting assessment**
until a physician or NP/PA opens the intake and runs the models from it.

---

## Tasks

### Start of shift (charge nurse)

1. **Unit risk roster** → check the **Watch list** tile (ICU estimate above 40%).
2. Switch to **Table** to see who is assigned to whom, and rebalance.
3. Remember the ranking tells you **where to look first, not who is sick**.

### Start of shift (staff nurse)

1. **My patients** → work down each patient's task list.
2. Deal with **Intake incomplete** patients first: no estimate exists for them.

### Admit a patient (staff nurse)

1. **Admit a patient** → fill in the **Patient** card (name, MRN, unit, bed), then
   **Demographics** and **Admission context**. Add vitals, history and medications if you
   have them.
2. **Admit patient**. The patient is admitted with what you captured; a physician or NP/PA
   runs the assessment (see above).
3. To keep working on an existing patient's intake without running anything, use **Save
   draft**. The next person who opens it sees *"Draft saved by your name"*.

### Record observations

1. Patient card → **Vitals**.
2. Choose **When were these taken?**
   - **At or before admission**: inside the t₀ cut. They fill any blank field on the intake
     and reach the models the next time the assessment is run.
   - **Since admission**: saved to the chart only and never used by any model.
3. Enter what you measured, leave the rest blank, then **Save n values**.

Every value you enter is stored: blood pressure, heart rate, respiratory rate, temperature,
SpO₂, weight, height and each lab. A value outside the possible range is refused with the
server's message, so check the red error before saving.

### Something does not look right

Open the patient → **Escalate** (on the patient card in **My patients**, or at the bottom of
the Results page). It is recorded against the patient: the attending sees a red **escalated**
pill on their Worklist, and the Results page shows an **Escalated to Attending on call**
banner with the urgency, your name, the time and the reason. There is no "resolve" step in
this build, so follow up in person.

### End of shift (charge nurse)

**Unit risk roster** → **Build handoff** → tick off each patient in **Flagged to watch** once
they have a plan → write a note under each patient → **Send to next shift**.

**Send to next shift** files the handoff on the server against the unit, with your notes and
which watch-list patients you confirmed. The incoming charge nurse sees it at the top of the
same screen as **Last handoff for this unit**. It is logged as `handoff.send`.

**Export** is different: it saves the unit's patient data as a file, which needs patient-data
export rights. The Charge Nurse role does not have them, so the server refuses it and the
message says so.

---

## 4.1 Unit risk roster (Charge Nurse)

Every patient on the unit, ranked by the ICU estimate, the one most relevant to staffing.
This is the one screen where ranking by a model score *is* the job.

**Tiles:** Occupied beds (of total) · Watch list (ICU above 40%) · Not yet assessed · Mean
expected stay (lower bound of the M-05 ranges).

**Controls:**

- **Unit**: opens on your own assigned unit; switch it here.
- **Bed grid / Table**:
  - **Bed grid**: one card per bed with bed number, a **watch** flag, name, age and sex,
    time since admission, complaint, ICU and mortality bars, a phrase, the calibration badge
    and the assigned nurse.
  - **Table**: bed, patient, ICU, mortality, stay and assigned nurse, with a search box.
- Click a card or row to open that patient's **Results** (read-only).
- **Build handoff** opens the Handoff summary.

An account with no units (a self-serve account) sees **No units in this account**.

---

## 4.2 My patients

The patients assigned to you this shift, led by what each still needs.

**Tiles:** Assigned to you · Open tasks · Needs watching (ICU above 40%) · Intake incomplete.

**Each patient card shows:**

- Name, bed, age and sex, unit, time since admission and complaint.
- ICU, mortality and readmission bars. If the intake is incomplete: **No estimate yet** with a
  **Finish it** link.
- A **task list**, kept on the server. Tick a task to mark it done, or tick again to reopen
  it; who ticked it is recorded and shown. ESAP suggests tasks from the chart (*Prior history
  missing — ask on the ward round*, *Intake incomplete — no estimate yet*, *High ICU estimate
  — flag on handoff*); **Add a task for this patient** adds your own.
- The calibration badge and the buttons **Vitals**, **Escalate** and **Open**.

A **What you can do here** banner at the top states your rights. The Staff Nurse can record
vitals and labs, complete an intake and escalate. The Charge Nurse's version of this screen
has no **Admit a patient**, **Vitals** or **Finish it**: *"You can add and complete tasks, and
escalate. Recording vitals, completing an intake and acknowledging a result belong to the
bedside nurse and the attending."*

---

## 4.3 Admit a patient / intake

The same intake form physicians use (see
[chapter 3, section 3.2](03-physicians.md#32-intake-new-encounter-and-the-intake-tab)), framed for
first capture. **Early labs** and **Medications** start collapsed. Everything on it is
knowable at the moment of admission; there is no field for anything later, by design.

---

## 4.4 Vitals & labs fast entry

Built for a bedside cart: keyboard-first, large targets, **Tab** moves between fields.

- **When were these taken?** is the most important choice on the screen (see *Record
  observations* above).
- **Vitals:** systolic and diastolic BP, heart rate, respiratory rate, temperature, SpO₂,
  weight, height. A ✓ means within the usual range, a ⚠ means *outside the usual range*, and a
  red error means *outside the possible range* (probably a typo).
- **Labs:** creatinine, potassium, sodium, haemoglobin, white blood cells, lactate, albumin,
  urea nitrogen, magnesium, glucose, each with its reference range.
- Badges at the bottom show how many values you entered and whether they are inside the t₀ cut.
- **Back to results** returns to the read-only Results.

All of these are stored when you save (see *Record observations* above).

---

## 4.5 Triage (Staff Nurse)

For the emergency department or admitting unit: capture the minimum, get a provisional read,
keep adding.

1. **Minimum viable intake:** Age, Sex, Admission type, the *Arrived via the emergency
   department* toggle, and a one-sentence **Presenting complaint**.
2. **Presenting vitals:** two or more unlock a provisional read.
3. **Signal completeness** tracks four checks: age / sex / admission type · at least two
   vitals · a presenting complaint of more than about 20 characters · prior history.
4. Until the minimum is met you see **No estimate yet — this is deliberate.** A number built
   on two fields would look far more certain than it is.
5. Once met, **Provisional read** shows ICU and mortality gauges marked **provisional** and
   **uncalibrated**, for ordering only.

> **In this build the provisional read is a simple calculation on the screen** (age, ED arrival
> and respiratory rate). It is not produced by the trained models.

6. **Create encounter** admits the patient under an automatic MRN on **your own unit** and
   opens the full intake.

**In the department now** lists open patients who arrived via the ED. Click one to open their
Results.

---

## 4.6 Handoff summary (Charge Nurse)

A shift-change brief built from the unit's current state, which you then write.

**Header:** unit, your name and the time. Buttons **Export** (a patient-data file; refused for
the Charge Nurse role) and **Send to next shift** (see *End of shift* above).

**Last handoff for this unit** appears at the top when one has been filed: who sent it, when,
and each patient with a note or a confirmed plan.

**Tiles:** Patients on unit · Flagged to watch (ICU above 40%) · No estimate available ·
Reviewed by the attending.

**Sections:**

1. **Flagged to watch**: the highest ICU estimates. Tick each patient once you have confirmed
   there is a plan.
2. **Patient-by-patient**: each patient's bed, details, complaint and ICU / mortality / stay
   figures, with a box for your note (plan, family situation, outstanding jobs). Anything
   left blank prints as *"no concerns raised at handoff"*.
3. **Loose ends to mention**: patients with an incomplete intake (no estimate exists) and
   patients with no prior history (lower differential accuracy).

It opens on your own assigned unit; use the **Unit** dropdown to switch.

> The estimates are context lines, never the headline. A handoff is a human account of the
> unit.

---

## 4.7 Read-only Results

The same Results page physicians see
([chapter 3, section 3.3](03-physicians.md#33-results)), without **Release to patient**,
**Ask** or **Export**. The **Intake** tab opens with a **Read-only** banner for the Charge
Nurse. The acknowledgement bar
reads *"Your role reads these estimates but does not sign them off. If something here does not
match the patient in front of you, escalate to the attending."* Click **Escalate**.

Next: [5. Case manager and pharmacist →](05-case-manager-and-pharmacist.md)
