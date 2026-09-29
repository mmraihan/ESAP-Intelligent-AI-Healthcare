"""Reference catalogs served by `GET /api/v1/schema/*`.

These are the vocabularies intake validates against: a lab itemid the catalog
does not list is a 422, and a CCSR code the catalog does not list cannot be
returned in a differential by the stub. Kept small and explicit here rather
than pulled from MIMIC, and nothing in this file is MIMIC-derived data
(guardrail 2: no DUA material in the repo).

The trained M-01 ranks 459 CCSR categories, most of them outside this short
catalogue. Their names come from `data/ccsr_names.json`, AHRQ's public CCSR
category list, through `ccsr_name()` — never from a guess.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

# itemid, label, units, ref_low, ref_high, panel — the common intake panel.
LABS: list[dict] = [
    {"itemid": "50912", "label": "Creatinine", "units": "mg/dL", "ref_low": 0.5, "ref_high": 1.2, "panel": "BMP"},
    {"itemid": "51006", "label": "Urea nitrogen", "units": "mg/dL", "ref_low": 7, "ref_high": 20, "panel": "BMP"},
    {"itemid": "50983", "label": "Sodium", "units": "mEq/L", "ref_low": 135, "ref_high": 145, "panel": "BMP"},
    {"itemid": "50971", "label": "Potassium", "units": "mEq/L", "ref_low": 3.5, "ref_high": 5.1, "panel": "BMP"},
    {"itemid": "50882", "label": "Bicarbonate", "units": "mEq/L", "ref_low": 22, "ref_high": 29, "panel": "BMP"},
    {"itemid": "50902", "label": "Chloride", "units": "mEq/L", "ref_low": 98, "ref_high": 107, "panel": "BMP"},
    {"itemid": "50931", "label": "Glucose", "units": "mg/dL", "ref_low": 70, "ref_high": 100, "panel": "BMP"},
    {"itemid": "50893", "label": "Calcium, total", "units": "mg/dL", "ref_low": 8.5, "ref_high": 10.2, "panel": "BMP"},
    {"itemid": "51222", "label": "Hemoglobin", "units": "g/dL", "ref_low": 12.0, "ref_high": 17.0, "panel": "CBC"},
    {"itemid": "51221", "label": "Hematocrit", "units": "%", "ref_low": 36, "ref_high": 50, "panel": "CBC"},
    {"itemid": "51301", "label": "White blood cells", "units": "K/uL", "ref_low": 4.0, "ref_high": 11.0, "panel": "CBC"},
    {"itemid": "51265", "label": "Platelet count", "units": "K/uL", "ref_low": 150, "ref_high": 400, "panel": "CBC"},
    {"itemid": "51250", "label": "MCV", "units": "fL", "ref_low": 80, "ref_high": 100, "panel": "CBC"},
    {"itemid": "50820", "label": "pH", "units": None, "ref_low": 7.35, "ref_high": 7.45, "panel": "ABG"},
    {"itemid": "50821", "label": "pO2", "units": "mm Hg", "ref_low": 80, "ref_high": 100, "panel": "ABG"},
    {"itemid": "50818", "label": "pCO2", "units": "mm Hg", "ref_low": 35, "ref_high": 45, "panel": "ABG"},
    {"itemid": "50813", "label": "Lactate", "units": "mmol/L", "ref_low": 0.5, "ref_high": 2.0, "panel": "ABG"},
    {"itemid": "50861", "label": "ALT", "units": "IU/L", "ref_low": 7, "ref_high": 55, "panel": "LFT"},
    {"itemid": "50878", "label": "AST", "units": "IU/L", "ref_low": 8, "ref_high": 48, "panel": "LFT"},
    {"itemid": "50885", "label": "Bilirubin, total", "units": "mg/dL", "ref_low": 0.1, "ref_high": 1.2, "panel": "LFT"},
    {"itemid": "50862", "label": "Albumin", "units": "g/dL", "ref_low": 3.5, "ref_high": 5.0, "panel": "LFT"},
    {"itemid": "51237", "label": "INR(PT)", "units": None, "ref_low": 0.9, "ref_high": 1.1, "panel": "Coag"},
    {"itemid": "51275", "label": "PTT", "units": "sec", "ref_low": 25, "ref_high": 35, "panel": "Coag"},
    {"itemid": "50960", "label": "Magnesium", "units": "mg/dL", "ref_low": 1.7, "ref_high": 2.2, "panel": "BMP"},
    {"itemid": "50970", "label": "Phosphate", "units": "mg/dL", "ref_low": 2.5, "ref_high": 4.5, "panel": "BMP"},
    {"itemid": "50963", "label": "NT-proBNP", "units": "pg/mL", "ref_low": 0, "ref_high": 125, "panel": "Cardiac"},
    {"itemid": "51003", "label": "Troponin T", "units": "ng/mL", "ref_low": 0, "ref_high": 0.01, "panel": "Cardiac"},
    {"itemid": "50889", "label": "C-reactive protein", "units": "mg/L", "ref_low": 0, "ref_high": 5, "panel": "Inflam"},
]

# ccsr, family, description, lay term. Matches the families the UI colours.
CCSR: list[dict] = [
    {"ccsr": "CIR019", "family": "Circulatory", "description": "Heart failure", "lay": "heart failure"},
    {"ccsr": "CIR009", "family": "Circulatory", "description": "Acute myocardial infarction", "lay": "heart attack"},
    {"ccsr": "CIR008", "family": "Circulatory", "description": "Hypertension with complications and secondary hypertension", "lay": "high blood pressure affecting organs"},
    {"ccsr": "CIR017", "family": "Circulatory", "description": "Cardiac dysrhythmias", "lay": "irregular heartbeat"},
    {"ccsr": "RSP002", "family": "Respiratory", "description": "Pneumonia (except that caused by tuberculosis)", "lay": "chest infection"},
    {"ccsr": "RSP008", "family": "Respiratory", "description": "Chronic obstructive pulmonary disease and bronchiectasis", "lay": "chronic lung disease"},
    {"ccsr": "RSP009", "family": "Respiratory", "description": "Asthma", "lay": "asthma"},
    {"ccsr": "RSP012", "family": "Respiratory", "description": "Respiratory failure; insufficiency; arrest", "lay": "breathing failure"},
    {"ccsr": "END003", "family": "Endocrine", "description": "Diabetes mellitus with complication", "lay": "diabetes"},
    {"ccsr": "END011", "family": "Endocrine", "description": "Fluid and electrolyte disorders", "lay": "salt or fluid imbalance"},
    {"ccsr": "END001", "family": "Endocrine", "description": "Thyroid disorders", "lay": "thyroid problem"},
    {"ccsr": "GEN002", "family": "Genitourinary", "description": "Acute and unspecified renal failure", "lay": "sudden kidney problem"},
    {"ccsr": "GEN003", "family": "Genitourinary", "description": "Chronic kidney disease", "lay": "long-term kidney disease"},
    {"ccsr": "INF002", "family": "Infectious", "description": "Septicemia", "lay": "severe infection"},
    {"ccsr": "GEN004", "family": "Genitourinary", "description": "Urinary tract infections", "lay": "urine infection"},
    {"ccsr": "DIG021", "family": "Digestive", "description": "Gastrointestinal hemorrhage", "lay": "bleeding in the gut"},
    {"ccsr": "DIG019", "family": "Digestive", "description": "Other specified and unspecified liver disease", "lay": "liver disease"},
    {"ccsr": "CIR020", "family": "Circulatory", "description": "Cerebral infarction", "lay": "stroke"},
    {"ccsr": "NVS011", "family": "Nervous", "description": "Neurocognitive disorders", "lay": "confusion or memory problems"},
    {"ccsr": "BLD001", "family": "Blood", "description": "Nutritional anemia", "lay": "anaemia from low iron or vitamins"},
    {"ccsr": "MUS006", "family": "Musculoskeletal", "description": "Osteoarthritis", "lay": "joint wear"},
    {"ccsr": "INJ006", "family": "Injury", "description": "Fracture of the neck of the femur (hip), initial encounter", "lay": "broken hip"},
    {"ccsr": "MBD002", "family": "Mental/Behavioural", "description": "Depressive disorders", "lay": "depression"},
    {"ccsr": "NEO070", "family": "Neoplasms", "description": "Secondary malignancies", "lay": "cancer that has spread"},
]

MEDS: list[str] = [
    "aspirin", "atorvastatin", "amlodipine", "amoxicillin", "apixaban", "azithromycin",
    "bisoprolol", "budesonide", "bumetanide", "carvedilol", "ceftriaxone", "clopidogrel",
    "dexamethasone", "digoxin", "diltiazem", "enoxaparin", "furosemide", "gabapentin",
    "heparin", "hydralazine", "insulin glargine", "ipratropium", "labetalol", "levofloxacin",
    "levothyroxine", "lisinopril", "losartan", "metformin", "methylprednisolone", "metoprolol",
    "metronidazole", "morphine", "omeprazole", "ondansetron", "oxycodone", "pantoprazole",
    "piperacillin-tazobactam", "prednisone", "rivaroxaban", "salbutamol", "sertraline",
    "spironolactone", "tamsulosin", "tiotropium", "vancomycin", "warfarin",
]

ADMISSION_TYPES = [
    "EW EMER.", "URGENT", "ELECTIVE", "OBSERVATION ADMIT", "DIRECT EMER.",
    "SURGICAL SAME DAY ADMISSION", "DIRECT OBSERVATION", "EU OBSERVATION", "AMBULATORY OBSERVATION",
]

ADMISSION_LOCATIONS = [
    "EMERGENCY ROOM", "PHYSICIAN REFERRAL", "TRANSFER FROM HOSPITAL",
    "CLINIC REFERRAL", "WALK-IN/SELF REFERRAL", "TRANSFER FROM SKILLED NURSING FACILITY",
    "PROCEDURE SITE", "INTERNAL TRANSFER TO OR FROM PSYCH", "INFORMATION NOT AVAILABLE",
]


@lru_cache(maxsize=1)
def known_lab_itemids() -> frozenset[str]:
    return frozenset(lab["itemid"] for lab in LABS)


@lru_cache(maxsize=1)
def ccsr_index() -> dict[str, dict]:
    return {c["ccsr"]: c for c in CCSR}


@lru_cache(maxsize=1)
def _ahrq_names() -> dict[str, str]:
    path = Path(__file__).with_name("data") / "ccsr_names.json"
    return json.loads(path.read_text(encoding="utf-8"))["names"]


# CCSR body-system prefixes, for codes outside the catalogue.
CCSR_FAMILY = {
    "BLD": "Blood", "CIR": "Circulatory", "DEN": "Dental", "DIG": "Digestive", "EAR": "Ear",
    "END": "Endocrine", "EXT": "External cause", "EYE": "Eye",
    "FAC": "Factors influencing health status", "GEN": "Genitourinary", "INF": "Infectious",
    "INJ": "Injury", "MAL": "Congenital", "MBD": "Mental/Behavioural", "MUS": "Musculoskeletal",
    "NEO": "Neoplasms", "NVS": "Nervous", "PNL": "Perinatal", "PRG": "Pregnancy",
    "RSP": "Respiratory", "SKN": "Skin", "SYM": "Symptoms and signs",
}


def ccsr_name(code: str) -> str:
    """The catalogue description, else AHRQ's official name, else the code itself."""
    meta = ccsr_index().get(code)
    if meta:
        return meta["description"]
    return _ahrq_names().get(code, code)


def ccsr_family(code: str) -> str:
    meta = ccsr_index().get(code)
    if meta:
        return meta["family"]
    return CCSR_FAMILY.get(code[:3], code[:3])


def lab_label(itemid: str) -> str:
    for lab in LABS:
        if lab["itemid"] == itemid:
            return lab["label"]
    return f"itemid {itemid}"
