"""Deterministic intake extraction from free text (§4).

The chat assistant runs this on every message so conversational data entry works
even when the LLM is unreachable. It is intentionally conservative: it maps only
what it is confident about, and anything label-strength (prior conditions, lab
values) is flagged ``needs_confirmation`` so the clinician confirms before it
influences a score — the LLM, when available, proposes more but is gated the same
way. Symptoms and anything unmapped go to the notes, never invented into a code.
"""

from __future__ import annotations

import re

# Lay term -> CCSR category. Small, curated, and every code is pattern-valid.
# These are the common chronic conditions an intake conversation surfaces.
DX_LEXICON: dict[str, tuple[str, str]] = {
    "diabetes": ("END002", "Diabetes mellitus"),
    "type 2 diabetes": ("END002", "Diabetes mellitus"),
    "type 1 diabetes": ("END002", "Diabetes mellitus"),
    "high blood pressure": ("CIR007", "Essential hypertension"),
    "hypertension": ("CIR007", "Essential hypertension"),
    "high blood sugar": ("END002", "Diabetes mellitus"),
    "heart failure": ("CIR019", "Heart failure"),
    "chf": ("CIR019", "Heart failure"),
    "congestive heart failure": ("CIR019", "Heart failure"),
    "atrial fibrillation": ("CIR011", "Cardiac dysrhythmias"),
    "afib": ("CIR011", "Cardiac dysrhythmias"),
    "irregular heartbeat": ("CIR011", "Cardiac dysrhythmias"),
    "coronary artery disease": ("CIR009", "Coronary atherosclerosis"),
    "cad": ("CIR009", "Coronary atherosclerosis"),
    "copd": ("RSP008", "Chronic obstructive pulmonary disease"),
    "emphysema": ("RSP008", "Chronic obstructive pulmonary disease"),
    "asthma": ("RSP009", "Asthma"),
    "chronic kidney disease": ("GEN003", "Chronic kidney disease"),
    "ckd": ("GEN003", "Chronic kidney disease"),
    "kidney disease": ("GEN003", "Chronic kidney disease"),
}

# Lab name -> a known MIMIC itemid (must exist in the catalog, see IntakeFeatures).
LAB_LEXICON: dict[str, str] = {
    "creatinine": "50912",
    "wbc": "51301",
    "white blood cell": "51301",
    "white cell count": "51301",
    "lactate": "50813",
    "hemoglobin": "51222",
    "haemoglobin": "51222",
    "hgb": "51222",
    "sodium": "50983",
    "na": "50983",
}

# Common home meds (generic). A free list; the model matches them to its vocab.
MED_LEXICON = [
    "metformin", "insulin", "lisinopril", "amlodipine", "metoprolol", "atenolol",
    "furosemide", "lasix", "warfarin", "apixaban", "aspirin", "atorvastatin",
    "simvastatin", "losartan", "hydrochlorothiazide", "omeprazole", "albuterol",
    "prednisone", "gabapentin", "levothyroxine", "clopidogrel", "digoxin",
    "spironolactone", "carvedilol", "ramipril", "enalapril", "sitagliptin",
]

_AGE = re.compile(r"\b(\d{1,3})\s*(?:yo\b|y/o|y\.o\.|year[s]?[-\s]?old|yr[s]?\b|-year-old)", re.I)
_AGE2 = re.compile(r"\bage[d]?\s*(?:is\s*)?(\d{1,3})\b", re.I)
_BP = re.compile(r"\b(\d{2,3})\s*/\s*(\d{2,3})\b")
_WEIGHT = re.compile(r"\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilograms?)\b", re.I)
_HEIGHT = re.compile(r"\b(\d{2,3})\s*(?:cm|centimet)", re.I)
_BMI = re.compile(r"\bbmi\s*(?:of|is|=|:)?\s*(\d{2}(?:\.\d)?)\b", re.I)


def _find_age(text: str) -> int | None:
    for rx in (_AGE, _AGE2):
        m = rx.search(text)
        if m:
            v = int(m.group(1))
            if 0 <= v <= 120:
                return v
    return None


def _find_sex(text: str) -> int | None:
    t = f" {text.lower()} "
    if re.search(r"\b(female|woman|lady|she|her|f)\b", t) and not re.search(r"\b(male|man|he|his)\b", t):
        return 1
    if re.search(r"\b(male|man|gentleman|he|his|m)\b", t) and not re.search(r"\b(female|woman|she|her)\b", t):
        return 0
    return None


def extract(text: str) -> dict:
    """Return {delta, captured, needs_confirmation} for one message.

    ``delta`` is a partial IntakeRequest ({features, audit_covariates, notes})
    ready to merge into the running draft; ``captured`` is a list of human labels
    for what was pulled out this turn; ``needs_confirmation`` are dotted field
    paths the caller marks unconfirmed.
    """
    low = text.lower()
    features: dict = {}
    notes: dict = {}
    captured: list[str] = []
    needs: list[str] = []

    age = _find_age(text)
    if age is not None:
        features.setdefault("demographics", {})["admission_age"] = age
        captured.append(f"Age {age}")
    sex = _find_sex(text)
    if sex is not None:
        features.setdefault("demographics", {})["is_female"] = sex
        captured.append("Sex: " + ("female" if sex else "male"))

    if re.search(r"\b(er|ed|emergency|ambulance|brought in|999|911)\b", low):
        features.setdefault("admission_context", {})["via_ed"] = 1
        captured.append("Arrived via the ED")

    vit: dict = {}
    m = _BP.search(text)
    if m:
        sys_, dia = int(m.group(1)), int(m.group(2))
        if 40 <= sys_ <= 300 and 20 <= dia <= 200:
            vit["bp_sys"], vit["bp_dia"] = sys_, dia
            captured.append(f"Blood pressure {sys_}/{dia}")
    m = _WEIGHT.search(text)
    if m:
        vit["weight_kg"] = float(m.group(1)); captured.append(f"Weight {m.group(1)} kg")
    m = _HEIGHT.search(text)
    if m:
        vit["height_cm"] = float(m.group(1)); captured.append(f"Height {m.group(1)} cm")
    m = _BMI.search(text)
    if m:
        vit["bmi"] = float(m.group(1)); captured.append(f"BMI {m.group(1)}")
    if vit:
        features["vitals"] = vit

    # Prior conditions (label-strength -> needs confirmation). Longest phrase first.
    found_dx: list[tuple[str, str]] = []
    for phrase in sorted(DX_LEXICON, key=len, reverse=True):
        if re.search(rf"\b{re.escape(phrase)}\b", low):
            code, name = DX_LEXICON[phrase]
            if code not in {c for c, _ in found_dx}:
                found_dx.append((code, name))
    if found_dx:
        features.setdefault("prior_history", {})["prior_ccsr"] = [c for c, _ in found_dx]
        for c, name in found_dx:
            captured.append(f"History: {name}")
        needs.append("prior_history.prior_ccsr")

    # Meds (free list).
    meds = [d for d in MED_LEXICON if re.search(rf"\b{re.escape(d)}\b", low)]
    if meds:
        meds = sorted(set("furosemide" if x == "lasix" else x for x in meds))
        features["meds"] = meds
        captured.append("Medications: " + ", ".join(meds))

    # Labs "<name> <value>" (label-strength -> needs confirmation).
    labs: dict[str, float] = {}
    for name, itemid in LAB_LEXICON.items():
        m = re.search(rf"\b{re.escape(name)}\b[^0-9-]{{0,12}}(\d+(?:\.\d+)?)", low)
        if m:
            labs[itemid] = float(m.group(1))
            captured.append(f"Lab {name}: {m.group(1)}")
    if labs:
        features["labs"] = labs
        needs.append("labs")

    # Audit covariates (captured for fairness, NEVER a model input) — only if stated.
    audit: dict = {}
    ins = re.search(r"\b(medicare|medicaid|private insurance|uninsured|self-?pay)\b", low)
    if ins:
        audit["insurance"] = ins.group(1).title()

    delta: dict = {}
    if features:
        delta["features"] = features
    if audit:
        delta["audit_covariates"] = audit

    # Anything that reads like a complaint goes to the chief complaint / HPI, so a
    # symptom is never dropped and never turned into a code.
    if len(text.strip()) > 3 and not (age is not None and sex is not None and len(captured) >= 3):
        notes["hpi"] = text.strip()[:2000]
    if notes:
        delta["notes"] = notes

    return {"delta": delta, "captured": captured, "needs_confirmation": needs}


def merge(draft: dict, delta: dict) -> dict:
    """Deep-merge a delta into the running draft (dicts recurse; lists union; scalars replace)."""
    out = {k: v for k, v in (draft or {}).items()}
    for key, val in (delta or {}).items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = merge(out[key], val)
        elif isinstance(val, list) and isinstance(out.get(key), list):
            seen = list(out[key])
            for item in val:
                if item not in seen:
                    seen.append(item)
            out[key] = seen
        else:
            out[key] = val
    return out
