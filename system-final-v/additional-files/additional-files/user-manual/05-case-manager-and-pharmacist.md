# 5. Case manager and pharmacist

[← Manual index](README.md)

Both roles use the clinical workspace, with the physicians' left rail minus **New encounter**
(**Worklist · Discharge planning · Models & basis · How to read a result**), and each has a
narrower job. Neither can edit an intake, run an assessment or acknowledge a result; both
**escalate** instead. Buttons for actions your role cannot take are not shown, and the
**Intake** tab opens **Read-only** (*"Your role can review what was captured at intake but
not edit it or run a new assessment."*).

| Role | Focus | What the server allows |
|---|---|---|
| **Care Coordinator / Case Manager** | Discharge planning: M-04 readmission and M-05 length of stay drive the day | View your caseload and explanations · the Ask panel · export patient data for your caseload · start a record transfer · approve an inbound transfer with a second approver · delegate your permissions |
| **Clinical Pharmacist** | The medication-relevant view of each patient | View assigned patients and their explanations. Nothing else. |

---

## Care Coordinator / Case Manager

**Signs in to:** **Discharge planning**, your main screen. The Worklist is one click away in
the left rail.

### Tasks

**Plan the day**

1. **Discharge planning** → **Today** to see who is likely to leave.
2. Switch to **Next 48 h** and start arrangements early; discharge takes days to set up.
3. Look at the **top decile readmission** flags, and check **no prior record** before trusting
   M-04 for that patient (see the banner below).
4. Open a patient → **Timeline** for their coded history and admission medications.

**Something is wrong with a patient's estimate:** open the patient → **Escalate**. The
attending sees it on their Worklist and Results page.

**Ready to go home:** the prescriber (attending, resident or NP/PA) closes the encounter.
You have no **Discharge** button: *"Discharging itself is the prescriber's action; coordinate
here, and they close the encounter from the results screen."*

**Need a record from another hospital:** open the patient → **Request record from
elsewhere** (see [chapter 3, Tasks](03-physicians.md#tasks)).
It goes to the Hospital Admin's transfer queue.

### 5.1 Discharge planning

Same patients, different question: *who is going to be hard to send home, and when?*
**Mortality and ICU estimates are not shown here**; they are not this role's decision.

**Tiles:**

- **Likely to leave within 48 h**, from the lower bound of the M-05 range.
- **Top-decile readmission risk**, above the 28% alert threshold.
- **Possible long stays**, where the upper bound is beyond 10 days.
- **Caseload**.

**Horizon:** **Today** · **Next 48 h** (default) · **All**.

**Columns:** Patient (name, MRN, unit) · Admitted · Expected stay (M-05 range) · 30-day
readmission · **Planning flags**: *top decile readmission*, *long stay possible*, *no prior
record*, *calibration reduced*.

Search with the search box; click a row to open that patient's Results. Physicians, residents
and NP/PAs who open this screen also get a **Discharge** button on each row.

**Other panels:**

- **M-04 is serving degraded — read it as a weak signal.** On patients with no prior admission
  it is close to chance. It is useful for ranking people *with* admission history, and should
  **not on its own** justify a care-management referral for someone without one.
- **Where the readmission risk sits**: your caseload ranked by readmission estimate. The
  ranking is reliable even where the absolute calibration is not. Use it to order your day,
  not to quote a number to a patient.
- **A note on equity.** Readmission models are the most prone to encoding access-to-care
  differences as clinical risk. When you use this list to allocate a scarce resource, the
  privacy officer can see who was flagged and who was referred.

**Export discharge packet** (top right) saves the patients currently listed, for the horizon
you chose, as a CSV: name, MRN, unit and bed, admission time, attending, the M-05 stay range,
the intake readmission estimate and whether a prior record exists. It carries patient data, so
it is logged as `export.phi` with the horizon as the reason.

### 5.2 Other screens

- **Results** for any patient on your caseload, with **Escalate** at the bottom. **Ask**
  answers length-of-stay questions (chapter 3, section 3.3).
- **Timeline** for the coded prior history and admission medications.
- **Models & basis** → the **M-04** and **M-05** tabs for performance by patient group and
  interval coverage.

---

## Clinical Pharmacist

**Signs in to:** the Worklist.

### What you can do

- **Worklist**: browse your patients and their estimates.
- **Results**: read the estimates and open **Why?** / **Why this condition?** to see the
  drivers. You see the same drivers as any other reviewer: home medications are not yet a
  model input, so there is no medication-specific view.
- **Timeline**: **Medications on admission**, the list the patient was taking at t₀.
- **Models & basis** and **How to read a result**.

### What you cannot do

- Edit an intake, save vitals or run an assessment.
- **Acknowledge** a result; the bar shows **Escalate** instead.
- **Export** patient data or use **Ask**. Neither button is shown to your role (on Results,
  History or Discharge planning).

> Medication changes made during this admission are not in any estimate. The admission
> medication list is what the patient was taking at t₀.

Next: [6. Hospital Admin and IT Admin →](06-hospital-admin-and-it-admin.md)
