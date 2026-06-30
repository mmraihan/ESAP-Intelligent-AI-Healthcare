# EHR Sync — What It Is & What Happens Without It

**Context:** ESAP Intelligent AI Healthcare Platform
**Source:** Pipeline UI (`survey-demo/components/RecordUpdated.tsx`, `Dashboard.tsx`) + `project-analysis.md` architecture
**Date:** June 2026

---

## 1. Where EHR Sync Sits in the Pipeline

The doctor-facing pipeline (visible in `RecordUpdated.tsx` and `Dashboard.tsx`) is:

```
Survey → AI Analysis → Doctor Review → EHR Sync → Feedback Loop
```

EHR Sync currently exists only as a UI placeholder (`done: false, next: true`) — nothing is actually wired up yet.

It corresponds to two directions in the broader system architecture (`project-analysis.md` §4):

1. **Pull side** — `Hospital Systems/EHR → pulls existing records + new data → Global Health Care Data Center`. This is how ESAP gets a patient's prior diagnoses, allergies, and medications *before* the AI ever analyzes anything.
2. **Push side** — after a doctor reviews and finalizes the AI's draft diagnosis/treatment plan, that decision needs to go back into the hospital's actual EHR (Epic, Cerner, etc.) as the official chart entry.

---

## 2. Concrete Use Case: What Breaks Without It

**Scenario:** A patient fills out the ESAP survey. The AI flags a possible drug interaction with a new prescription. The doctor reviews it, agrees, and finalizes the treatment plan inside ESAP.

Without EHR Sync, here's what happens next:

| Who | What they see | Consequence |
|---|---|---|
| **Hospital pharmacy system** | Nothing — pharmacy dispensing connects to the hospital's EHR, not to ESAP's database | The approved prescription never reaches the pharmacist. Either the patient doesn't get the medication, or the doctor manually re-enters the same prescription a second time into Epic/Cerner |
| **Next clinician** (ER, specialist, different hospital) | The official EHR chart — ESAP's visit, diagnosis, and the AI-flagged interaction don't exist there | They work from an incomplete history. The exact interaction the AI caught could be missed by the next clinician because it's invisible outside ESAP |
| **Billing/insurance** | Claims generated from the certified EHR's coded diagnosis (ICD-10), not from ESAP | The encounter may never get billed correctly, or gets billed as a duplicate/incomplete visit |
| **Compliance/audit** (Joint Commission, HIPAA record-keeping, 21st Century Cures Act information-blocking rules) | The hospital's legal medical record is the certified EHR, not ESAP | A clinical decision that only lives in ESAP is, legally, not part of the patient's chart — documentation gap during audits, potential liability |
| **ESAP's own closed-loop vision** (`project-analysis.md` §2, point 4: "doctors correct the AI → corrections improve the AI") | The Feedback Loop step depends on the record being finalized/synced first | The loop stays open — ESAP becomes a side tool used *alongside* the real EHR, not embedded in the actual workflow |

---

## 3. The Bigger-Picture Risk

`project-analysis.md` already flags this under risks: **"EHR integration complexity — each hospital system (Epic, Cerner, etc.) has different APIs and data formats."**

This is typically the single biggest reason hospitals decline to pilot a clinical AI tool — if it can't read from and write back to their EHR of record, it isn't a clinical tool, it's a sandbox that creates *double documentation* work for doctors (the opposite of the efficiency gain ESAP is meant to deliver).

**Bottom line:** Skipping EHR Sync doesn't just leave a UI box unchecked. It caps ESAP at being a standalone decision-support demo rather than something a hospital could actually adopt into a real care pathway.

---

## 4. Where This Is Planned

Backend implementation for this is scoped in `backend-roadmap.md` §7 ("Phase 6 — EHR Integration & Extended Features", Weeks 15–18): HL7 FHIR R4 endpoints (`Patient`, `Bundle`/`MedicationRequest` import/export) mapping ESAP's internal tables to standard FHIR resources.
