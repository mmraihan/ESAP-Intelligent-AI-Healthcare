# 6. Hospital Admin and IT Admin

[← Manual index](README.md)

The **hospital admin console** runs one hospital (a *tenant*). It never shows a patient chart.

| Role | Home screen | Reach | Main jobs |
|---|---|---|---|
| **Hospital Admin** (contract signatory / CMIO office) | Home | One hospital, all facilities | Staff accounts and roles, units, what the models show, hospital policies, record transfers, billing. **The only role that can grant clinical roles.** |
| **IT Admin** (integration lead) | Integrations | One hospital, configuration only | Integrations, provisioning accounts. **Cannot grant or change clinical roles** (physician, resident, NP/PA, nurses, case manager, pharmacist), by invite, bulk import, job-title mapping or role change. |

**Left rail.** Each admin role sees only the screens it can use; typing the address of any
other screen sends you back to your home screen.

| Screen | Hospital Admin | IT Admin | Privacy Officer | Billing Admin | QI Auditor |
|---|:-:|:-:|:-:|:-:|:-:|
| Home | ✓ | ✓ | ✓ | ✓ | ✓ |
| Roster · Invites · Roles & scopes | ✓ | ✓ | – | – | – |
| Facilities & units · Integrations · Model & display · Org settings | ✓ | ✓ | – | – | – |
| Usage & outcomes | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fairness audit | – | – | ✓ | – | ✓ |
| Interop & transfer | ✓ | – | – | – | – |
| Audit log | ✓ | – | ✓ | – | ✓ |
| Billing | ✓ | – | – | ✓ | – |

The governance screens are covered in [chapter 7](07-privacy-quality-and-billing.md).

---

## Tasks

### Bring a new clinician on board (Hospital Admin)

1. **Invites** → **Invite someone**.
2. Enter the **email address** (paste several, one per line, for a batch; you see a preview
   first), the **Role**, their **Assigned units** (pick from your hospital's units) and
   their **Local job title**.
   The role is the most consequential field: it decides whether this person can open a chart.
   The units decide which patients a unit-scoped nurse, attending or NP/PA can see, so set
   them: someone with no units only sees patients they personally attend.
3. **Send invite**. With no email service connected, an **Acceptance links** box shows the
   link. Pass it to the person yourself; it works once and expires in 7 days.
4. Track it on the **Pending** tab. **Remind** if needed, **Revoke** to kill the link at once,
   or **Reissue** an expired one (this creates a new link; the old one never works again).

### Onboard many people at once

**Roster** → **Bulk import** → choose a CSV with the columns `email, role, unit, local_title`,
for example `new.doctor@styves.example, physician, 4-West`. You always see a checked preview
first, and **Send N invites** sends only the valid rows. For an IT Admin, a row with a
clinical role is marked *"Clinical role — reserved to the Hospital Admin"* and not sent.

### Invite as an IT Admin

The **Role** list on the invite form offers only the administrative roles (Hospital Admin,
IT Admin, Privacy Officer, Billing Admin, QI Auditor), with the note **Clinical roles are not
offered here**: *"A role that can open a chart — physician, nurse, case manager, pharmacist —
is granted by the Hospital Admin."*

### Change someone's role or units (Hospital Admin)

**Roster** → click the person → change **Role** and **Assigned units** → **Save role &
units**. The
person is signed out immediately, so a removed permission stops working straight away. The
change is written to the audit log with your name.

### Reset a password or remove access

- **Roster** → the person → **Send reset**. Their existing sessions end at once.
- **Deactivate** asks you to type their name to confirm. Their session ends at their next
  request (possibly mid-shift), their past acknowledgements keep their name, and their
  patients stay assigned until you reassign them.

### Turn on co-sign for residents

**Roles & scopes** → *Tenant policy* → **Require attending co-sign on resident
acknowledgements**. Residents then see **Submit for co-sign** instead of **Confirm review**.

### Hide a model, or change what clinicians see

**Model & display** → switch a model off for the whole hospital, suppress it on one unit, set
how many conditions the differential shows, or suppress a condition category (**Add**, with a
reason). A per-unit suppression applies to the next assessment run on that unit: the gauge
then shows a **suppressed** flag instead of a number.

### Bring the admission feed live (IT Admin)

**Integrations** → **HL7v2 ADT feed** → **Configure** → turn on **Derive t₀ from the admit
timestamp** and **Alert if no message is received for 60 minutes** → **Save** → **Test**.

---

## 6.1 Home

*Is anything wrong in my hospital's deployment today?*

- **Banners:** a model is serving degraded (**Review** opens Model & display); *Calibration
  error is trending up* (**See the trend** opens Usage & outcomes).
- **Tiles:** Assessments this month (the metered unit on your plan) · Active clinicians ·
  **Needs your decision** (transfer reviews and expired invites) · Calibration error (ECE).
- **Adoption:** assessments per week, and the share **Acknowledged within 24 h** against a 70%
  target. High usage with a low acknowledgement rate is a warning sign, not a success.
- **Record transfers** awaiting a decision → **Open queue** (roles that work transfers only).
- **Denied access and break-glass use** → **Full log** (roles that can read the audit log
  only).
- **Requests waiting on the hospital**: patient messages, record requests and corrections,
  urgent result flags and **password reset requests** from the sign-in page. **Handled**
  closes one (logged). For a password reset, **Roster** takes you to the person, where
  **Send reset** issues the link.
- **Invites** → **Manage**, and **Invite staff** in the header (roles that manage users only).

Other admin roles see a shorter Home with only the cards their role can use.

---

## 6.2 Roster

Everyone with access, their role, and how far it reaches.

- **Tiles:** Total accounts · Clinical roles (can open a chart) · Administrative (no clinical
  surface) · Signing in with SSO.
- **Table:** name and email, role, local title, scope, sign-in method, last active, status.
  Search, and filter by **role** and **status**.
- **Click a person** to open their panel:
  - **Role & scope**: role, scope, local title, HL7 role mapping, dates.
  - **Change role**: **Role** and **Assigned units**, then **Save role & units**. For anyone
    other than the Hospital Admin these are disabled (*"Reserved to the Hospital Admin"*).
  - **Security**: **Single sign-on** and **Break-glass delegate** (lets this person approve
    another clinician's emergency access request; only the Hospital Admin can turn it on).
  - **Send reset** and **Deactivate**.
- **Bulk import**, **Export** (recorded in the audit log) and **Invite** at the top.

IT Admins see the banner *"You can provision accounts, but not grant clinical roles."*

---

## 6.3 Invites

An invite is a credential in transit.

- **Tiles:** Pending · Expired (past the 7-day window) · Revoked · Accepted.
- **Tabs:** Pending · Expired · Revoked · All.
- **Row actions:** **Remind** and **Revoke** on pending invites; **Reissue** on expired ones.
- **Acceptance links**: the links from invites you sent this session, to pass on yourself.
- **How an invite becomes an account**: choose role and scope → a single-use 7-day link →
  the person confirms their email and sets a password (or uses single sign-on) → they appear
  on the roster, and the grant is in the audit log.

---

## 6.4 Facilities & units

The structure every scope points at: *Unit: 4-West* on a nurse's account means a row here.

- **Tiles:** Facilities · Units · Licensed beds · Current occupancy.
- **One card per facility**, listing its units with service line, beds, an occupancy bar and
  the unit's model policy (for example *M-03 suppressed*).
- **Add unit**: name (the name staff actually say on the ward), service line, bed count (0
  for a non-bedded unit) → **Create unit**.
- **Remove** a unit: typed confirmation. Accounts scoped to that unit lose access (the system
  fails closed); open encounters stay in the record, and audit entries keep the unit name.

- **Add facility** immediately creates one named *"New facility (year)"*, with no form. Rename
  it straight away with **Edit**.
- **Edit** on a facility opens a form: **Facility name**, **Type** and **Licensed beds** →
  save.

---

## 6.5 Roles & scopes

- **The permissions matrix**, switchable between **Clinical roles** and **Administrative**. It
  is drawn from the same rules the server enforces, so it cannot drift from real behaviour.
  Grades: ● full · ◐ scoped · △ needs a second approver · ⚡ break-glass only · ○ none.
- **Local job titles**: how your titles map to ESAP roles and HL7 role codes, with headcounts.
  **Map a job title** → your title, ESAP role, default scope → **Save mapping**. New starters
  with that title are then provisioned automatically, so map conservatively. An IT Admin can
  only map titles to administrative roles (*Clinical roles are not offered here*).
- **Tenant policy:**
  - **Require attending co-sign on resident acknowledgements**.
  - **Break-glass requires a second approver**.
  - **Allow delegation of clinical scope** (a physician hands their roster to a covering peer).
  - **Nurses may see risk summaries**.
- **Roles in use here** and **What no role can do**: feed race, insurance or marital status
  into a model; see another hospital's data; use anything after t₀; silence the leakage alarm.

---

## 6.6 Integrations (IT Admin home)

Each integration shows **what it is doing now**, not just whether it was configured.

| Integration | What it does |
|---|---|
| **Single sign-on** (OIDC / SAML) | Staff sign in with their hospital identity |
| **SCIM provisioning** | Accounts are created and deactivated automatically |
| **SMART on FHIR launch** | ESAP opens inside the EHR with the patient in context |
| **HL7v2 ADT feed** | An admission message (A01) creates an encounter and **sets t₀ from the admit timestamp**; A02 updates the location, A03 closes it |
| **FHIR R4 read API** | Reads problem lists, medications and labs |
| **Outbound webhooks** | Sends ESAP's own events (for example, a result acknowledged) to your systems |

- **Tiles:** Configured · Not yet configured · Last connection test · Last ETL refresh.
- **Configure** opens a form:
  - **SSO:** protocol, issuer URL, client ID, client secret (write-only), **Require SSO for all
    clinical roles**.
  - **ADT:** listener host and port, message types, **Derive t₀ from the admit timestamp**
    (strongly recommended), **Alert if no message is received for 60 minutes** (a stalled feed
    is silent otherwise).
  - **Others:** endpoint URL, authentication, **Verify TLS certificate chain**.
- **Test** (on configured integrations) and **Test all connections** report what the server
  actually found. No real hospital systems are connected in this build, so expect
  *unverified* or *not configured*.
- ESAP **reads** from your systems and never writes to the EHR; the only thing it sends out
  is its own webhook events.

---

## 6.7 Model & display

What runs, where it appears, and what clinicians see.

> **Three things you cannot turn off:** the calibration badge, the degraded-model label, and
> the "Decision support, not diagnosis" line.

- **Which models run in this tenant**: one switch per model (M-01 to M-05), with version,
  headline metric and calibration. Turning one off removes it from every clinical screen here.
- **Per-unit overrides**: suppress a model on one unit (most often M-03 in the ICU, where
  everyone is already in intensive care). Clinicians are told it is suppressed by hospital
  policy; it is never silently missing.
- **Differential display:** how many conditions to show (the model always scores all ~502),
  **Show the CCSR family swatch**, **Show unscored-category count**, **Flag conditions from
  unconfirmed extraction**.
- **Suppressed categories:** condition categories never shown in this hospital. **Add** →
  condition category and a required reason → **Suppress**. This hides the category from the
  display only; the model is unchanged.
- **Alert thresholds:** the M-04 readmission flag. Set it from your care-management capacity,
  not from the model.
- **Model version pinning:** Enterprise plans only, arranged with your account team.

---

## 6.8 Org settings

- **Tenant profile:** organisation name, primary contact, time zone → **Save profile**. The
  tenant slug is fixed; changing it goes through your account team.
- **Branding (light touch by design):** an accent colour for buttons and links only, and **Show
  the hospital name in the top bar**. The risk colours, condition colours, status colours and
  calibration badge can never be recoloured. A logo is supplied through your account team.
- **Deployment** (contractual, read-only): mode, isolation tier, region, data residency,
  encryption.
- **Privacy & retention:**
  - **Assessment retention** period.
  - **Allow patients to see released results**. Turning it off switches the patient portal
    off for your hospital's patient accounts: they lose their released results, records and
    care team, and their home page says *"The portal is turned off for this hospital right
    now."* Turning it back on restores everything at once.
  - **Allow de-identified data in aggregate benchmarking**.
  - **Allow ESAP support to request break-glass access**. Off means nobody at ESAP can ever be
    granted access to a chart here.

---

## 6.9 Interop & record transfer (Hospital Admin)

Records moving in and out of the hospital. Each one carries a **consent basis** and a
**patient-match score**, and neither is optional.

**Accept an inbound record:**

1. **Interop & transfer** → **Needs a decision** tab → click the transfer.
2. Read **Identity match**: the match score and a field-by-field comparison. Records below the
   match threshold always need a human decision; merging two different people's records is the
   worst outcome the system can produce.
3. Read **What would be received**.
4. Under **Your decision**, type the **Reason** (required: it is the record of why two
   identities were judged to be the same person) and choose the **Accept scope**.
5. **Confirm match & accept**, or **Reject**. Your name goes in the audit log.

Clinicians can also start a request from a patient's Results page (**Request record from
elsewhere**); those arrive in this same queue with the clinician's name and note.

**Ask another hospital for a record:** **Request a record** → the patient (name, age, sex as
your record has them), your MRN, the organisation holding the record, and an optional note →
**Send request**. Nothing is received until they answer and someone here confirms the match.

> **Your plan sets how far transfers reach.** Free and Pro plans have no cross-organisation
> transfer (*"Cross-organisation record transfer is not included in your plan"*); Pilot and
> Essential allow ESAP-to-ESAP transfers; Professional and Enterprise add TEFCA / external EHR
> transfers. The Free plan also runs only M-02, M-03 and M-05.

**Screen reference:** tiles *Awaiting a decision · Below the match threshold · Delivered this
month · Rejected*; tabs **Needs a decision** and **All transfers**; and two explainers, **The
two paths** (a fast structured path between ESAP hospitals, and the national TEFCA network)
and **What a transfer never does** (move a record without a consent basis, link on name and
date of birth alone, or reopen the t₀ cut).

Next: [7. Privacy, quality and billing →](07-privacy-quality-and-billing.md)
