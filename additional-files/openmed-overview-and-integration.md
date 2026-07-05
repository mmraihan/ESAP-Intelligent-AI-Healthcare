# OpenMed — Local-First Healthcare AI: Overview, Integration & Analysis

**Version:** 1.6.0+  
**License:** Apache-2.0  
**GitHub:** [maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed)  
**PyPI:** [openmed](https://pypi.org/project/openmed/)  
**Docs:** [openmed.life/docs](https://openmed.life/docs/)  
**HuggingFace:** [huggingface.co/OpenMed](https://huggingface.co/OpenMed)  
**Date Noted:** July 2026 | GitHub Trending #1 Repository of the Day

---

## Table of Contents

1. [What is OpenMed?](#1-what-is-openmed)
2. [Core Features](#2-core-features)
3. [How It Works (Architecture)](#3-how-it-works-architecture)
4. [Installation](#4-installation)
5. [Integration Guide for ESAP](#5-integration-guide-for-esap)
6. [Code Examples](#6-code-examples)
7. [Platform Support](#7-platform-support)
8. [Pros](#8-pros)
9. [Cons & Limitations](#9-cons--limitations)
10. [HIPAA & Compliance](#10-hipaa--compliance)
11. [Comparison with Cloud Alternatives](#11-comparison-with-cloud-alternatives)
12. [Recommended Use Cases in ESAP](#12-recommended-use-cases-in-esap)

---

## 1. What is OpenMed?

OpenMed is an **open-source, local-first healthcare AI toolkit** that runs 100% on-device — no cloud, no vendor lock-in, no patient data leaving your network.

It provides:
- **Clinical Named Entity Recognition (NER):** Extracts diseases, drugs, genes, anatomy, chemicals, oncology markers from unstructured clinical text
- **HIPAA PII De-identification:** Detects and redacts all 18 Safe Harbor identifiers (names, DOBs, addresses, MRNs, billing IDs, etc.)
- **1,000+ Specialized Medical Models** via HuggingFace, running entirely on your own hardware
- **Multi-language support:** 12 languages with 55+ PII entity types
- **Apple MLX acceleration** for on-device inference on iPhone, iPad, Mac

The key principle: **structured clinical insight from unstructured text, in one line of Python, entirely offline.**

---

## 2. Core Features

| Feature | Details |
|---|---|
| Clinical NER | Diseases, drugs, genes, anatomy, chemicals, oncology |
| PII De-identification | 18 HIPAA Safe Harbor identifiers, configurable confidence thresholds |
| De-id Methods | Masking, format-preserving fake replacement, cryptographic hashing, date shifting |
| Languages | 12 languages (English, French, Spanish, German, etc.) |
| Models | 1,000+ transformer models fine-tuned on biomedical corpora |
| Runtime | Python (CPU/GPU), Apple MLX (M-series chips), Swift (iOS/macOS) |
| Deployment | pip package, Dockerized FastAPI service, Swift Package (OpenMedKit) |
| Audit | Policy-aware de-identification, signed audit reports, fail-closed release gates |
| License | Apache-2.0 — fully open source |
| Cardiology | v1.6.0 adds zero-shot cardiology labels |

---

## 3. How It Works (Architecture)

```
Clinical Text (EHR note, discharge summary, lab report)
        │
        ▼
┌───────────────────────────┐
│   OpenMed Python Runtime  │
│  ┌─────────────────────┐  │
│  │  Tokenizer + Model  │  │  ← HuggingFace Transformers or Apple MLX
│  │  (runs 100% local)  │  │
│  └─────────────────────┘  │
│  ┌─────────────────────┐  │
│  │   NER Pipeline      │  │  ← Entity extraction
│  │   PII Pipeline      │  │  ← De-identification
│  └─────────────────────┘  │
└───────────────────────────┘
        │
        ▼
Structured JSON Output (entities, redacted text, audit log)
        │
        ▼
   Your Application / Database / API
```

**No data ever leaves the machine.** Models are downloaded once and cached locally.

---

## 4. Installation

### Basic (Python, CPU)
```bash
pip install openmed
```

### With HuggingFace model support
```bash
pip install "openmed[hf]"
```

### With built-in FastAPI service
```bash
pip install "openmed[hf,service]"
```

### Run as standalone FastAPI service
```bash
uvicorn openmed.service.app:app --host 0.0.0.0 --port 8080
```

### Docker
```bash
docker pull openmed/openmed
docker run -p 8080:8080 openmed/openmed
```

---

## 5. Integration Guide for ESAP

ESAP runs Python FastAPI + .NET 8 on a MIMIC-IV dataset. OpenMed fits into the **AI Processing Pipeline (Phase 2)** and the **EHR Integration layer (Phase 6)**.

### Where to plug it in

```
ESAP Architecture with OpenMed
───────────────────────────────

[EHR / MIMIC-IV Raw Notes]
        │
        ▼
[esap-api / Python FastAPI]
        │
        ├──► OpenMed NER  ──────────► Extract: diagnoses, drugs, anatomy
        │
        ├──► OpenMed PII De-id ─────► Redact PHI before storage / LLM input
        │
        ▼
[Structured Clinical Data → SQL Server / Neo4j]
        │
        ▼
[.NET 8 API → Clinical Dashboard / Doctor Decision API]
```

### Recommended integration points

| ESAP Layer | OpenMed Role |
|---|---|
| EHR text ingestion | PII de-identification before storing raw notes |
| Patient registration pipeline | Extract & validate clinical entities from uploaded docs |
| AI Processing Pipeline | NER to structure unstructured discharge summaries / lab reports |
| RLHF Feedback Loop | Provide clean, structured text as LLM input (reduces hallucination) |
| Clinical Dashboard | Surface extracted entities for doctor review |

---

## 6. Code Examples

### Basic NER — Extract clinical entities
```python
from openmed import analyze_text

result = analyze_text(
    "Patient presents with Type 2 Diabetes and hypertension. Prescribed Metformin 500mg."
)

print(result)
# {
#   "entities": [
#     {"text": "Type 2 Diabetes", "label": "DISEASE", "start": 22, "end": 37},
#     {"text": "hypertension",    "label": "DISEASE", "start": 42, "end": 54},
#     {"text": "Metformin 500mg", "label": "DRUG",    "start": 67, "end": 82}
#   ]
# }
```

### PII De-identification
```python
from openmed import deidentify

note = "John Smith, DOB 01/15/1980, MRN 123456, admitted for chest pain."

result = deidentify(note, method="mask")
print(result["redacted"])
# "[NAME], DOB [DATE], MRN [ID], admitted for chest pain."

result_fake = deidentify(note, method="replace")
print(result_fake["redacted"])
# "Robert Johnson, DOB 03/22/1975, MRN 789012, admitted for chest pain."
```

### Choosing a specific model
```python
from openmed import analyze_text

result = analyze_text(
    text="BRCA1 mutation detected. Stage III adenocarcinoma.",
    model_name="OpenMed/OpenMed-NER-Oncology-Large",
    confidence_threshold=0.85
)
```

### FastAPI integration in ESAP
```python
# esap-api/routers/clinical_nlp.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openmed import analyze_text, deidentify

router = APIRouter(prefix="/clinical", tags=["Clinical NLP"])

class ClinicalTextRequest(BaseModel):
    text: str
    confidence_threshold: float = 0.80

class DeidentifyRequest(BaseModel):
    text: str
    method: str = "mask"  # mask | replace | hash | date_shift

@router.post("/ner")
async def extract_entities(req: ClinicalTextRequest):
    try:
        result = analyze_text(req.text, confidence_threshold=req.confidence_threshold)
        return {"status": "ok", "entities": result["entities"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deidentify")
async def deidentify_note(req: DeidentifyRequest):
    try:
        result = deidentify(req.text, method=req.method)
        return {
            "status": "ok",
            "redacted_text": result["redacted"],
            "pii_found": result.get("entities", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Register the router in your app
```python
# esap-api/main.py
from routers.clinical_nlp import router as clinical_router
app.include_router(clinical_router)
```

### Batch processing MIMIC-IV notes
```python
from openmed import analyze_text, deidentify
import pandas as pd

df = pd.read_csv("mimic_notes.csv")  # column: "text"

df["entities"]      = df["text"].apply(lambda t: analyze_text(t)["entities"])
df["redacted_text"] = df["text"].apply(lambda t: deidentify(t)["redacted"])

df.to_csv("mimic_notes_processed.csv", index=False)
```

---

## 7. Platform Support

| Platform | Method | Acceleration |
|---|---|---|
| Python (any OS) | `pip install openmed` | CPU / CUDA GPU |
| Docker | `docker run openmed/openmed` | CPU / GPU |
| Apple Mac (M1/M2/M3/M4) | `pip install openmed` | Apple MLX (native) |
| iPhone / iPad | Swift Package (OpenMedKit) | Apple Neural Engine |
| macOS App (Swift) | OpenMedKit | Apple Neural Engine |
| Air-gapped servers | Local model cache | CPU / GPU |

---

## 8. Pros

### Privacy & Compliance
- **Zero data exfiltration** — models and inference run entirely on your hardware
- **HIPAA Safe Harbor** compliant out of the box (all 18 identifiers)
- Suitable for air-gapped hospital environments
- Signed audit reports for every de-identification operation
- Fail-closed release gates prevent accidental PHI leakage

### Technical
- **One-liner API** — `analyze_text()` and `deidentify()` cover 90% of use cases
- 1,000+ pre-trained biomedical models on HuggingFace — no training required
- 12 language support — useful for multilingual clinical notes
- Apple MLX makes it fast on any M-series Mac at zero cloud cost
- Ships as pip package, Docker, or Swift — fits any stack
- Apache-2.0 license — use freely in commercial products

### Operational
- No recurring cloud API costs
- No rate limits or throttling
- Works offline / in disconnected environments
- Reduces LLM hallucination by providing structured entity context as input
- Active open-source community, 6+ months of production usage

---

## 9. Cons & Limitations

### Performance
- **First inference is slow** — model weights download once (~100MB–1GB per model) and are cached
- CPU inference is significantly slower than GPU; large models may take 1–5 seconds per note on CPU
- Batch processing large MIMIC-IV datasets requires a GPU or Apple M-series chip for reasonable throughput

### Hardware
- Apple MLX acceleration only available on M1/M2/M3/M4 Macs — Intel Macs use CPU fallback
- Running 1,000+ models simultaneously is impractical — you select one model per task
- On low-RAM machines (<8GB) large models may cause OOM errors

### Ecosystem
- Newer library (< 1 year old) — production hardening still in progress
- Smaller community vs. established alternatives (AWS Comprehend Medical, Google Healthcare NLP)
- Limited out-of-box support for structured EHR formats (FHIR, HL7) — you integrate text extraction yourself
- iOS/Swift support (OpenMedKit) is newer and has fewer examples

### Model Quality
- Accuracy varies by domain — oncology and general medicine NER are strongest
- Rare disease entities or highly specialized sub-specialties may have lower recall
- Zero-shot cardiology labels (v1.6.0) are new and may need validation before clinical use
- Confidence thresholds need tuning per use case — default may be too permissive

### Regulatory
- Not an FDA-cleared medical device — cannot be used for autonomous clinical decision-making
- Requires clinical validation before deployment in live patient care workflows
- Audit trail features (signed reports) are useful but not a substitute for a full compliance program

---

## 10. HIPAA & Compliance

OpenMed v1.6.0 supports all **18 HIPAA Safe Harbor identifiers**:

| # | Identifier | Example |
|---|---|---|
| 1 | Names | "John Smith" |
| 2 | Geographic data | "123 Main St, Boston MA" |
| 3 | Dates (except year) | "01/15/1980" |
| 4 | Phone numbers | "(617) 555-1234" |
| 5 | Fax numbers | |
| 6 | Email addresses | |
| 7 | SSN | "123-45-6789" |
| 8 | Medical record numbers | "MRN: 987654" |
| 9 | Health plan beneficiary numbers | |
| 10 | Account numbers | |
| 11 | Certificate/license numbers | |
| 12 | Vehicle identifiers | |
| 13 | Device identifiers | |
| 14 | Web URLs | |
| 15 | IP addresses | |
| 16 | Biometric identifiers | |
| 17 | Full-face photos | |
| 18 | Any unique identifying number | |

**De-identification methods:**
- `mask` — Replace with `[NAME]`, `[DATE]`, etc.
- `replace` — Substitute with realistic fake values (format-preserving)
- `hash` — Cryptographic hash (SHA-256) — reversible with key
- `date_shift` — Shift dates by a consistent random offset (preserves temporal relationships)

---

## 11. Comparison with Cloud Alternatives

| Feature | OpenMed | AWS Comprehend Medical | Google Healthcare NLP | Azure Text Analytics Health |
|---|---|---|---|---|
| Data leaves network | No | Yes | Yes | Yes |
| HIPAA compliance | Built-in | BAA required | BAA required | BAA required |
| Cost | Free (compute only) | Pay-per-API-call | Pay-per-API-call | Pay-per-API-call |
| Offline / air-gapped | Yes | No | No | No |
| Languages | 12 | English only | English + some | English + some |
| Models | 1,000+ | AWS-managed | Google-managed | Microsoft-managed |
| Customizable | Yes (HuggingFace) | Limited | Limited | Limited |
| Apple MLX | Yes | No | No | No |
| Open source | Yes (Apache-2.0) | No | No | No |
| Vendor lock-in | None | AWS | GCP | Azure |
| Setup complexity | Medium | Low | Low | Low |
| Latency (first call) | High (model load) | Low | Low | Low |
| Latency (subsequent) | Low | Low | Low | Low |

---

## 12. Recommended Use Cases in ESAP

Given ESAP's stack (Python FastAPI, .NET 8, MIMIC-IV, SQL Server, Neo4j), here is where OpenMed adds the most value:

### High Priority
1. **PHI scrubbing before MIMIC-IV data enters the pipeline** — even though MIMIC-IV is de-identified, any re-identified or real patient data fed into ESAP must be scrubbed before hitting the DB or any LLM
2. **EHR note structuring** — convert free-text discharge summaries into structured entities (diagnoses, medications, procedures) for the knowledge graph (Neo4j)
3. **Pre-processing for RLHF** — clean, entity-tagged text makes better LLM prompts and reduces hallucination

### Medium Priority
4. **Patient document upload pipeline** — de-identify uploaded clinical documents before storage
5. **Clinical Dashboard enrichment** — surface NER entities alongside raw notes for doctor review
6. **Drug/diagnosis normalization** — map extracted entity strings to standard codes (ICD-10, RxNorm) using extracted entities as input

### Lower Priority (validate first)
7. **Cardiology zero-shot labels** — useful for triage flagging, but validate against ground truth before clinical use
8. **Multilingual notes** — relevant if patient population includes non-English speakers

---

## Sources

- [OpenMed Official Site](https://openmed.life/)
- [GitHub — maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed)
- [PyPI — openmed](https://pypi.org/project/openmed/)
- [OpenMed Documentation](https://openmed.life/docs/)
- [HuggingFace — OpenMed Models](https://huggingface.co/OpenMed)
- [Medium — OpenMed: Running Medical NLP Locally](https://medium.com/@sawanrai777/openmed-running-medical-nlp-locally-without-sending-patient-data-to-the-cloud-71a04d26a9d2)
- [OpenMed Six Months Review — HuggingFace Blog](https://huggingface.co/blog/MaziyarPanahi/openmed-year-in-review-2025)
- [AIToolly — OpenMed Overview](https://aitoolly.com/ai-news/article/2026-06-14-openmed-a-new-open-source-and-local-first-medical-ai-project-debuts-on-github-for-healthcare-innovat)
- [Efficient Coder — Local Medical AI with OpenMed](https://www.xugj520.cn/en/archives/local-medical-ai-openmed-2.html)
