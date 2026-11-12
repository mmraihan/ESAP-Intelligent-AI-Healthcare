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
# Covers every lab in the intake catalog (QA issue 16: potassium and others were
# silently dropped). Longest names are tried first, so "white blood cell" wins
# over "wbc" and "pco2" is not read as "po2".
LAB_LEXICON: dict[str, str] = {
    "creatinine": "50912", "creat": "50912", "cr": "50912",
    "urea nitrogen": "51006", "urea": "51006", "bun": "51006",
    "sodium": "50983", "na": "50983",
    "potassium": "50971", "k": "50971",
    "bicarbonate": "50882", "bicarb": "50882", "hco3": "50882",
    "chloride": "50902", "cl": "50902",
    "glucose": "50931", "blood sugar": "50931",
    "calcium": "50893", "ca": "50893",
    "hemoglobin": "51222", "haemoglobin": "51222", "hgb": "51222", "hb": "51222",
    "hematocrit": "51221", "haematocrit": "51221", "hct": "51221",
    "white blood cell": "51301", "white cell count": "51301", "wbc": "51301",
    "platelets": "51265", "platelet count": "51265", "plt": "51265",
    "mcv": "51250",
    "ph": "50820",
    "pco2": "50818", "po2": "50821",
    "lactate": "50813", "lactic acid": "50813",
}

# Bedside observations the current models do not take as inputs. They are
# still captured, written into the chart notes and labelled as not used by the
# models, so nothing the clinician typed is silently dropped (QA issue 16).
_OBS = (
    ("Heart rate", "HR", re.compile(r"\b(?:hr|heart rate|pulse|p)\s*(?:of|is|=|:)?\s*(\d{2,3})\b(?!\s*/)", re.I), "", 20, 250),
    ("Respiratory rate", "RR", re.compile(r"\b(?:rr|resp(?:iratory)? rate|resps?)\s*(?:of|is|=|:)?\s*(\d{1,2})\b", re.I), "", 4, 70),
    ("SpO2", "SpO2", re.compile(r"\b(?:spo2|sp02|sats?|o2 sats?|oxygen saturation|saturation)\s*(?:of|is|=|:)?\s*(\d{2,3})\s*%?", re.I), "%", 50, 100),
    ("Temperature", "T", re.compile(r"\b(?:temp(?:erature)?|t)\s*(?:of|is|=|:)?\s*(\d{2,3}(?:\.\d)?)\s*(?:°\s*)?(c|f)?\b", re.I), " °C", 30, 110),
)

# Presenting symptoms, kept as words in the chief complaint. Never coded.
SYMPTOMS = (
    "shortness of breath", "short of breath", "breathlessness", "chest pain", "palpitations",
    "fever", "cough", "abdominal pain", "nausea", "vomiting", "diarrhoea", "diarrhea", "headache",
    "confusion", "dizziness", "syncope", "fall", "weakness", "swelling", "leg swelling", "fatigue",
    "bleeding", "seizure", "back pain", "rash",
)

_DURATION = re.compile(r"\b(\d{1,3})\s*(minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?)\b", re.I)
_NUMBER = re.compile(r"\d+(?:\.\d+)?")

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
# Patient voice: "I'm 54", "I am 54". Not when a unit follows ("I'm 80 kg").
_AGE3 = re.compile(r"\bi(?:'|’| a)m\s+(\d{1,3})\b(?!\s*(?:kg|kilo|lb|cm|mm|%|/))", re.I)
# Clinical shorthand "68M", "72F", "pt 54 m": only at the start of a clause or
# after "pt"/"patient", so "walked 5 m" is not read as a five-year-old male.
_AGE_SEX = re.compile(r"(?:^|[,;.(]\s*|\b(?:pt|patient)\s+)(\d{1,3})\s*(?:yo\s*|y/o\s*)?([mf])\b", re.I)
_BP = re.compile(r"\b(\d{2,3})\s*/\s*(\d{2,3})\b")
_WEIGHT = re.compile(r"\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilograms?)\b", re.I)
_HEIGHT = re.compile(r"\b(\d{2,3})\s*(?:cm|centimet)", re.I)
_BMI = re.compile(r"\bbmi\s*(?:of|is|=|:)?\s*(\d{2}(?:\.\d)?)\b", re.I)


def _find_age(text: str) -> int | None:
    for rx in (_AGE, _AGE2, _AGE3, _AGE_SEX):
        m = rx.search(text)
        if m:
            v = int(m.group(1))
            if 0 <= v <= 120:
                return v
    return None


def _find_sex(text: str) -> int | None:
    # A lone "m"/"f" only counts when it is not the tail of a contraction:
    # "I'm" used to read as male because the apostrophe is a word boundary.
    m = _AGE_SEX.search(text.strip())
    if m and 0 <= int(m.group(1)) <= 120:
        return 1 if m.group(2).lower() == "f" else 0
    t = f" {text.lower().replace('’', chr(39))} "
    if re.search(r"\b(female|woman|lady|she|her|(?<!')f)\b", t) and not re.search(r"\b(male|man|he|his)\b", t):
        return 1
    if re.search(r"\b(male|man|gentleman|he|his|(?<!')m)\b", t) and not re.search(r"\b(female|woman|she|her)\b", t):
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

    # Bedside observations the models do not use: captured into the chart note.
    used: list[tuple[int, int]] = []
    observed: list[str] = []
    for label, short, rx, unit, lo, hi in _OBS:
        m = rx.search(text)
        if not m:
            continue
        value = float(m.group(1))
        if label == "Temperature" and (m.group(2) or "").lower() == "f":
            value = round((value - 32) * 5 / 9, 1)
        if not (lo <= value <= hi) or (label == "Temperature" and not 30 <= value <= 45):
            continue
        shown = f"{value:g}{unit}"
        observed.append(f"{short} {shown}")
        captured.append(f"{label} {shown} (recorded, not used by the models)")
        used.append(m.span(1))
    if observed:
        notes["physical_exam"] = "Vitals: " + ", ".join(observed)

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
    for name in sorted(LAB_LEXICON, key=len, reverse=True):
        itemid = LAB_LEXICON[name]
        if itemid in labs:
            continue
        # Short abbreviations ("k", "na", "cr") must be followed closely by the value.
        gap = "{0,3}" if len(name) <= 3 else "{0,12}"
        # Linking words are allowed before the value: "creatinine of 2.1",
        # "lactate is 4.2", "potassium was 6.1".
        m = re.search(rf"\b{re.escape(name)}\b\+?(?:\s*(?:of|is|was|at|level|levels|=|:)\b)*"
                      rf"[^0-9a-z-]{gap}(\d+(?:\.\d+)?)", low)
        if m and not any(a <= m.start(1) < b for a, b in used):
            labs[itemid] = float(m.group(1))
            captured.append(f"Lab {name}: {m.group(1)}")
            used.append(m.span(1))
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

    # Symptoms and how long: words in the chief complaint, never a code.
    found_sx = [sx for sx in SYMPTOMS if re.search(rf"\b{re.escape(sx)}\b", low)]
    found_sx = [sx for sx in found_sx if not any(sx != o and sx in o for o in found_sx)]
    for sx in found_sx:
        captured.append(f"Symptom: {sx}")
    dur = _DURATION.search(text)
    if dur:
        captured.append(f"Duration: {dur.group(1)} {dur.group(2)}")
        used.append(dur.span(1))
    if found_sx:
        notes["chief_complaint"] = (", ".join(found_sx) + (f" for {dur.group(0)}" if dur else ""))[:300]

    # The whole message always goes to the history of presenting illness, so
    # nothing the clinician typed is lost (it used to be skipped once age, sex
    # and three items were captured, which dropped the symptom).
    if len(text.strip()) > 3:
        notes["hpi"] = text.strip()[:2000]
    if notes:
        delta["notes"] = notes

    return {"delta": delta, "captured": captured, "needs_confirmation": needs,
            "not_captured": _not_captured(text, used, vit, age)}


def _not_captured(text: str, used: list[tuple[int, int]], vit: dict, age: int | None) -> list[str]:
    """Numbers in the message that nothing above mapped, with the word before
    each, e.g. "troponin 0.4". Shown to the clinician before an assessment."""
    spans = list(used)
    for rx in (_AGE, _AGE2, _AGE3, _AGE_SEX, _BP, _WEIGHT, _HEIGHT, _BMI):
        for m in rx.finditer(text):
            spans.append(m.span())
    low = text.lower()
    for phrase in DX_LEXICON:
        for m in re.finditer(rf"\b{re.escape(phrase)}\b", low):
            spans.append(m.span())
    out: list[str] = []
    for m in _NUMBER.finditer(text):
        if any(a <= m.start() < b for a, b in spans):
            continue
        if m.start() > 0 and text[m.start() - 1].isalpha():
            continue  # part of a name such as SpO2 or pCO2
        before = text[max(0, m.start() - 24):m.start()]
        word = re.findall(r"[A-Za-z][A-Za-z0-9+]*", before)
        label = f"{word[-1]} {m.group(0)}" if word else m.group(0)
        if label not in out:
            out.append(label)
    return out[:10]


#: Free-text notes that build up over a conversation. A new turn adds to them
#: instead of replacing what earlier turns recorded.
_APPEND_TEXT = {"hpi": ("\n", 2000), "chief_complaint": ("; ", 300), "physical_exam": ("; ", 1000)}


def merge(draft: dict, delta: dict) -> dict:
    """Deep-merge a delta into the running draft (dicts recurse; lists union;
    running notes append; other scalars replace)."""
    out = {k: v for k, v in (draft or {}).items()}
    for key, val in (delta or {}).items():
        earlier = out.get(key)
        if key in _APPEND_TEXT and isinstance(val, str) and isinstance(earlier, str) and earlier.strip():
            sep, cap = _APPEND_TEXT[key]
            out[key] = earlier if val in earlier else f"{earlier}{sep}{val}"[:cap]
        elif isinstance(val, dict) and isinstance(out.get(key), dict):
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
