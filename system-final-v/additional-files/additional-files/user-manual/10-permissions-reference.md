# 10. Who can do what

[← Manual index](README.md)

The server enforces these rules on every request, and the screens follow them: the left rail
and buttons only show what your role can use, and a screen your role cannot use sends you back
to your home screen if you type its address. If an action does reach the server without
permission, it is refused and the message names the missing permission (for example *"Role
'staff_nurse' has no 'assess:run' capability."*). Hospital
Admins can see the same matrix in the app under **Roles & scopes**, and anyone can open it at
`/design/permissions`.

## Grades

| Symbol | Meaning |
|---|---|
| ● | Full access at the role's reach |
| ◐ | Scoped: assigned patients, own unit, or own record only |
| △ | Allowed, but a second approver must sign |
| ⚡ | Break-glass only: time-limited, justified and reviewed |
| ○ | No access |

## Clinical roles

| Capability | Attending | Resident | NP / PA | Charge RN | Staff RN | Case mgr | Pharmacist |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| View patient | ◐ | △ | ◐ | ◐ | ◐ | ◐ | ◐ |
| Create / edit intake | ● | ● | ● | ○ | ◐ | ○ | ○ |
| Run M-01 – M-05 | ● | ● | ● | ○ | ○ | ○ | ○ |
| Why / explanations | ● | ● | ● | ◐ | ◐ | ◐ | ◐ |
| Unit risk roster | ◐ | ◐ | ◐ | ● | ○ | ◐ | ○ |
| Ask (chat) | ● | ● | ● | ○ | ○ | ● | ○ |
| Export patient data | ◐ | ○ | ◐ | ○ | ○ | ◐ | ○ |
| Invoke break-glass | ● | ● | ● | ● | ● | ○ | ○ |
| Delegate own permissions | ● | ○ | ● | ● | ○ | ● | ○ |
| Start a record transfer | ● | ○ | ● | ○ | ○ | ● | ○ |
| Approve an inbound transfer | ○ | ○ | ○ | ○ | ○ | △ | ○ |

**Acknowledging a result** needs *Run M-01 – M-05*, so only Attendings, Residents and NP/PAs
acknowledge; everyone else escalates. A Resident's acknowledgement goes for co-sign when the
hospital's policy requires it.

**Releasing a summary to the patient** is open to the same roles that acknowledge. **Sending a
shift handoff** needs *Unit risk roster*, so it is the Charge Nurse's job (physicians and the
case manager can too, for their own scope). **Exporting** a handoff or discharge packet is a
patient-data export and needs *Export patient data*.

## Hospital and platform roles

| Capability | Hospital Admin | IT Admin | Privacy Officer | Billing Admin | QI Auditor | Super-Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| View patient | ○ | ○ | ○ | ○ | ◐ | ⚡ |
| Why / explanations | ○ | ○ | ○ | ○ | ● | ○ |
| Unit risk roster | ○ | ○ | ○ | ○ | ● | ○ |
| Fairness / audit covariates | ○ | ○ | ● | ○ | ● | ● |
| Audit log (own hospital) | ◐ | ○ | ● | ○ | ● | ● |
| Audit log (all hospitals) | ○ | ○ | ○ | ○ | ○ | ● |
| Export de-identified data | ○ | ○ | ○ | ○ | ● | ○ |
| Start a record transfer | ● | ○ | ○ | ○ | ○ | ○ |
| Approve an inbound transfer | △ | ○ | ○ | ○ | ○ | ○ |
| Manage users | ● | ◐ | ○ | ○ | ○ | ● |
| Manage hospital configuration | ● | ● | ○ | ○ | ○ | ● |
| Create / suspend a hospital | ○ | ○ | ○ | ○ | ○ | ● |
| Billing | ● | ○ | ○ | ● | ○ | ○ |
| Model / feature-flag admin | ○ | ○ | ○ | ○ | ○ | ● |

The IT Admin's *Manage users* is scoped: they can provision and suspend accounts but **cannot
grant or change clinical roles** (by invite, bulk import, job-title mapping or role change),
cannot change the role of a Hospital Admin or Privacy Officer or promote anyone to those roles
from the Roster, and cannot make anyone a break-glass delegate.

## Patient roles

| Capability | Patient / Caregiver | Individual / Guest |
|---|:-:|:-:|
| View own record | ◐ | ◐ |
| Create / edit own information | ○ | ◐ |
| Run an assessment on own information | ○ | ◐ |
| Explanations (plain language) | ◐ | ◐ |
| Intake assistant (describe your health in a chat) | ◐ | ◐ |
| Ask panel about a clinical assessment | ○ | ○ |
| Download own data | ◐ | ◐ |
| Start a record transfer | ● | ○ |
| Billing (own plan) | ◐ | ◐ |

Patients only ever see summaries a clinician has read and released, never a raw score. The clinicians' **Ask** panel is not available in the portal and the server refuses it for patients, because it quotes the model's numbers. To ask about a result, use **Ask a question about it** on the Results page, which goes to the care team.

## What no role can do

- Feed race, insurance or marital status into a model.
- See another hospital's data (ESAP staff only through audited break-glass).
- Use anything recorded after t₀ in an estimate.
- Silence the leakage alarm, switch off calibration badges, or hide the degraded label.

---

## Demo accounts

Password for every account: **`esap-demo`**. To change role, sign out and sign in as another
account, or use the **Demo — sign in as any role** card on the sign-in page. A carer signs in
with the account they set up from the patient's invitation link (chapter 9).

| Role | Name | Email | Reach in the demo |
|---|---|---|---|
| Attending Physician | Dr. Amara Okonkwo | `amara.okonkwo@styves.example` | 4-West |
| Resident / Fellow | Dr. Tobias Lindqvist | `tobias.lindqvist@styves.example` | Whole hospital |
| Nurse Practitioner / PA | Priya Raman, NP | `priya.raman@styves.example` | 4-West |
| Charge Nurse | Ines Vasquez, RN | `ines.vasquez@styves.example` | 4-West |
| Staff / Bedside Nurse | Lucas Beaulieu, RN | `lucas.beaulieu@styves.example` | 4-West |
| Case Manager | Noor Haddad, RN | `noor.haddad@styves.example` | Whole hospital |
| Clinical Pharmacist | Ezra Stein, PharmD | `ezra.stein@styves.example` | Whole hospital |
| Hospital Admin | Dr. Mira Novak | `mira.novak@styves.example` | Admin console, no patients |
| IT Admin | Kofi Mensah | `kofi.mensah@styves.example` | Admin console, no patients |
| Privacy Officer | Sanne de Vries | `sanne.devries@styves.example` | Audit log, no patients |
| Billing Admin | Hugo Ferreira | `hugo.ferreira@styves.example` | Billing, no patients |
| QI Auditor | Leila Aziz | `leila.aziz@styves.example` | Whole hospital, read-only |
| Super-Admin (Platform) | R. Moravec | `rmoravec@esap.health` | All hospitals, no patients until break-glass |
| Patient | Delia Salib | `delia.salib@example.com` | Her own portal |

Next: [11. Glossary, FAQ and troubleshooting →](11-glossary-faq-troubleshooting.md)
