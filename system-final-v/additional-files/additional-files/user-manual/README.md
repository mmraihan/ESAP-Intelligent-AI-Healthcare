# ESAP Clinical AI: User Manual

This manual is for the people who use ESAP day to day. Find your job in the table below and
read your chapter; every chapter starts with the tasks you will actually do, then describes
each screen.

New to the project and just want to get it running and look around? Read
[`../ESAP-START-HERE-user-guide.md`](../ESAP-START-HERE-user-guide.md) first. It is the
15-minute setup and guided tour. This manual is the reference you come back to.

---

## What ESAP does

When a patient is **admitted**, ESAP uses only what is known at that moment to estimate five
things:

| Model | Question it answers |
|---|---|
| **M-01** Differential diagnosis | Which of ~502 condition categories (CCSR) may already be present at admission? |
| **M-02** In-hospital mortality | How often did similar admissions not survive to discharge? |
| **M-03** ICU admission | How often did similar admissions need intensive care during the stay? |
| **M-04** 30-day readmission | How often did similar patients come back within 30 days? *(labelled **degraded**)* |
| **M-05** Length of stay | How long did similar admissions stay? *(a range, not one number)* |

> **Decision support, not diagnosis.** Every estimate describes a population of similar past
> admissions. A clinician reads it, reviews why it came out that way, and makes the decision.

---

## Chapters

| # | Chapter | Read it if you are… |
|---|---|---|
| 0 | [How the system works: an overview](00-how-the-system-works.md) | Everyone: the workflow diagrams, read this first |
| 1 | [Signing in and finding your way](01-signing-in-and-navigation.md) | Everyone |
| 2 | [Reading a result](02-reading-a-result.md) | Anyone who sees an estimate |
| 3 | [Physicians: attending, resident, NP/PA](03-physicians.md) | Attending Physician, Resident / Fellow, Nurse Practitioner / PA, individual clinician |
| 4 | [Nurses: charge and bedside](04-nurses.md) | Charge Nurse, Staff / Bedside Nurse |
| 5 | [Case manager and pharmacist](05-case-manager-and-pharmacist.md) | Care Coordinator / Case Manager, Clinical Pharmacist |
| 6 | [Hospital Admin and IT Admin](06-hospital-admin-and-it-admin.md) | Hospital Admin, IT Admin |
| 7 | [Privacy, quality and billing](07-privacy-quality-and-billing.md) | Compliance / Privacy Officer, Quality / QI Auditor, Billing Admin |
| 8 | [Platform operations (ESAP staff)](08-platform-operations.md) | Super-Admin (Platform) |
| 9 | [Patients and carers](09-patients-and-carers.md) | Patient / Caregiver, Individual / Guest |
| 10 | [Who can do what](10-permissions-reference.md) | Anyone who needs the exact rules |
| 11 | [Glossary, FAQ and troubleshooting](11-glossary-faq-troubleshooting.md) | Everyone |

---

## Roles at a glance

ESAP has **15 roles** on **four surfaces**. After signing in, each role lands on its own home
screen.

| Surface | Role | Lands on | Chapter |
|---|---|---|---|
| Clinical workspace | Attending Physician | Worklist | [3](03-physicians.md) |
| | Resident / Fellow | Worklist | [3](03-physicians.md) |
| | Nurse Practitioner / PA | Worklist | [3](03-physicians.md) |
| | Charge Nurse | Unit risk roster | [4](04-nurses.md) |
| | Staff / Bedside Nurse | My patients | [4](04-nurses.md) |
| | Care Coordinator / Case Manager | Discharge planning | [5](05-case-manager-and-pharmacist.md) |
| | Clinical Pharmacist | Worklist | [5](05-case-manager-and-pharmacist.md) |
| Hospital admin console | Hospital Admin | Home | [6](06-hospital-admin-and-it-admin.md) |
| | IT Admin | Integrations | [6](06-hospital-admin-and-it-admin.md) |
| | Compliance / Privacy Officer | Audit log | [7](07-privacy-quality-and-billing.md) |
| | Quality / QI Auditor | Usage & outcomes | [7](07-privacy-quality-and-billing.md) |
| | Billing Admin | Billing | [7](07-privacy-quality-and-billing.md) |
| Platform ops console | Super-Admin (Platform) | Fleet dashboard | [8](08-platform-operations.md) |
| Patient portal | Patient / Caregiver | My health | [9](09-patients-and-carers.md) |
| | Individual / Guest (self-serve) | My health | [9](09-patients-and-carers.md) |

The **server** decides what each role may see and do. The screens follow the same rules: the
left rail and the buttons only show what your role can use, and typing the address of a screen
your role cannot use sends you back to your home screen. If a control ever does reach the
server without permission, the action is refused and the message says so.

---

## About this build

Read this once, because it explains most "why doesn't this work?" moments.

- **All data is synthetic.** No real patients and no MIMIC records. The demo hospital is
  **St. Yves Medical Center**.
- **Everything you do is saved** on the ESAP server and written to the audit log. Every
  **Export** / **Download** button saves a file to your computer (CSV for tables, JSON
  otherwise; the one exception is a patient's **Download everything (PDF)**, which saves a
  printable PDF) and, when it carries patient data, is logged as `export.phi` first. An
  administrator can reset the demo to its starting state
  ([chapter 11](11-glossary-faq-troubleshooting.md#resetting-the-demo)).
- **Where the estimates come from depends on how the server was started.**
  - In **stub mode** (the default) the numbers come from a simple stand-in model. They are
    consistent and correctly shaped, but they are **not** the trained models.
  - In **real mode** they come from the trained M-01 to M-05 models.
  - To tell which you are looking at, open any patient → **History** tab → click a run. The
    model-version badge reads `stub-1.0.0` in stub mode, and a training date plus a code
    (for example `2026-08-27+sha256.…`) in real mode.
- **An intake assistant is on every signed-in screen** (the chat button, bottom corner). You
  can describe a patient, or yourself, in plain words and it fills in the intake for you. See
  [chapter 1, section 1.4](01-signing-in-and-navigation.md#14-the-intake-assistant).
- **The model cards show demonstration figures.** The headline metrics on **Models & basis**,
  **Model & display** and **Usage & outcomes** come from the demo data set. They are not the
  trained models' measured results, which are recorded in `ml-pipeline/models/*/results.md`.

### What this build does not do yet

These are known gaps. The manual describes the screens as they are, and each chapter repeats
the ones that affect that role.

| Where | What happens |
|---|---|
| Intake → **Dictate / describe** | The extractor proposes no fields yet. It asks follow-up questions instead; use the structured form. |
| Triage → **Provisional read** | Calculated on the screen from age, ED arrival and respiratory rate. It is not produced by the trained models. |
| Results → **Next best test** | Intentionally empty. It is designed but not built. |
| Timeline | Shows the coded history the models were given. Dates, facilities and lengths of stay for past admissions need an EHR connection, and none is connected. |
| Email | No email service is connected. Invite links (staff and family carers) are shown on screen to pass on yourself. Patient messages, record requests and password-reset requests arrive in **Requests waiting on the hospital** on the Hospital Admin home ([chapter 6](06-hospital-admin-and-it-admin.md#61-home)), where they are marked handled. A patient's messages and result questions also appear, read-only, in the doctor's **From the patient** panel. |
| Single sign-on | No hospital identity provider is connected. Everyone signs in with email and password. |
| Escalations | An escalation shows on the attending's Worklist and Results page, but there is no "resolve" step yet: the flag stays on the encounter. |
| Break-glass (platform) | The demo has one platform account, so a request it files can never be approved by a second person. To see the full flow, approve the seeded request from *D. Petrov*, or **Start** the seeded active grant. The ops console has no screen for reading the patient during a grant. |
| Integrations | No real hospital systems are connected, so connection tests report *unverified* or *not configured*. |
