# 7. Privacy, quality and billing

[← Manual index](README.md)

Three hospital roles that watch over ESAP rather than use it on patients. All three work in
the hospital admin console, and none of them can open a chart or run a model.

| Role | Home screen | Main screens | Exports |
|---|---|---|---|
| **Compliance / Privacy Officer** | Audit log | Home, Usage & outcomes, Fairness audit, Audit log | Audit reports, usage report |
| **Quality / QI Auditor** | Usage & outcomes | Home, Usage & outcomes, Fairness audit, Audit log. Reads everything, changes nothing. | **De-identified only**, never patient data |
| **Billing Admin** | Billing | Home, Usage & outcomes, Billing. No clinical surface at all. | Statements, invoices, usage report |

Each role's left rail shows only these screens; any other admin address sends you back to
your home screen. Home shows only the cards your role can use (for example, no **Invite
staff** or invites card).

---

## Tasks

### Investigate an emergency (break-glass) access — Privacy Officer

1. **Audit log** → filter the action to `break_glass.invoke`, or start from the **Break-glass
   invocations** tile.
2. Click the event. Read the **stated justification**: it was typed by the person before
   access was granted and cannot be edited.
3. **All events by this actor** loads everything that person did; **All events on this
   target** loads everything that happened to that record.

### Produce an accounting of disclosures for one patient — Privacy Officer

**Audit log** → **Build a report** → date range → scope **a single patient**, enter the MRN →
include full detail with reasons → **Generate report**.

### Quarterly model review — QI Auditor

1. **Usage & outcomes** → read **Acknowledged within 24 h** before the volume.
2. **Model quality** tab → the leakage alarm, M-01's stratified performance, drift.
3. **Fairness audit** → each metric and each model → **Export report**.

### Explain an unexpected bill — Billing Admin

**Billing** → **Usage this cycle** → read the itemised lines (re-runs after new labs each count
as an assessment, which is the usual cause) → **Invoices** → open the invoice → **Download PDF**.

---

## 7.1 Audit log (Privacy Officer home)

Every access, every action and every denial for this hospital, including anything ESAP's own
staff did here under emergency access. It is append-only.

- **Tiles:** Events (30 days) · **Access denied** (someone tried to open something outside
  their scope) · **Break-glass invocations** (each needs review) · PHI exports.
- *Where to start an investigation:* denials and break-glass first.
- **Filters:** action, severity, outcome (**All / Success / Denied / Error**), free-text search.
- **Click an event** for the stated justification, the event details and the actor (role,
  scope at the time, source), plus **All events by this actor** and **All events on this
  target**. **Back to the recent log** returns.
- **Retention & integrity:** append-only with no delete path, covers reads as well as writes.
- **Build a report:** for a data-subject request, an incident or a board pack. Choose the date
  range, scope and detail → **Generate report**. An accounting of disclosures for a patient
  must include the reason field to be complete.
- **Export**: the export itself becomes the newest entry in the log.

---

## 7.2 Fairness audit (Privacy Officer and QI Auditor)

The **only** screen in ESAP where race, insurance and marital status appear. They are never
model inputs; they are recorded so this screen can check the models perform evenly.

- If no subgroup evaluation has been run yet, a banner says so and the charts are empty.
- **Metric:** **Discrimination** (AUROC) · **Calibration** (ECE) · **Alert rate**. **Model:**
  M-01 to M-04.
- **Tiles:** Subgroups monitored · Assessments in the audit (rolling 12 months) · Largest gap
  between any two subgroups · Models audited.
- A **gap worth investigating** banner names the weakest groups when the gap passes the
  threshold.
- Charts **by race / ethnicity** (*Other / Declined* is reported, not dropped) and **by
  insurance class**, the covariate most likely to reflect access to care rather than clinical
  risk.
- **Full subgroup table**: every group and every metric, marked *Investigate* or *Within
  tolerance*.
- **What was deliberately not done**: no synthetic oversampling (SMOTE), because it damages
  calibration.
- **Export report**: de-identified, and logged.

---

## 7.3 Usage & outcomes (QI Auditor home)

Whether people are using ESAP, and whether it is still working.

- **Export report**, and a **12 weeks / 16 weeks** window.
- **Tiles:** Assessments · Active clinicians · **Acknowledged within 24 h** · Calibration error
  (ECE).
- *Read the acknowledgement rate before the volume.* Falling acknowledgement with rising volume
  is the signature of alert fatigue.
- **Tabs:**
  - **Adoption**: assessments per week, active clinicians and acknowledgement rate, as three
    separate panels.
  - **Model quality**: the leakage alarm, **M-01 performance, stratified** (pooled versus each
    patient group), **Calibration in your population** (needs the outcomes of your own
    admissions, so it stays empty until they exist), and **Drift monitoring**: input drift
    (PSI, investigate above 0.2), ECE (action at 0.05) and Recall@20 (leakage ceiling 0.60).
  - **Outcomes**: shows **No outcome data yet** until outcomes exist. When they do, the figures
    are **associations, not attributed effects**, and the page lists what would make them
    meaningful (a staged rollout, case-mix adjustment, an endpoint chosen in advance).

> The model metrics on this screen come from the demo data set, not from the trained models'
> measured evaluation.

---

## 7.4 Billing (Billing Admin home)

- **Download statement** (top right).
- **Tiles:** Assessments this cycle (against your allowance) · Licensed beds · Seats in use ·
  This cycle's amount.
- **Tabs:**
  - **Usage this cycle**: the allowance bar and the itemised cycle. An assessment is one run
    that produced at least one model result; re-runs after new labs each count.
  - **Invoices**: click one for its lines; **Download PDF**. In this build the button saves
    the invoice as a CSV file, not a PDF.
  - **Plan & terms**: contract and current term, **Data on termination** (worth reading before
    you need it), **Change your plan** with **Compare plans**, and **Talk to your account
    team** (type your request → **Send**; it is answered by email).

Next: [8. Platform operations →](08-platform-operations.md)
