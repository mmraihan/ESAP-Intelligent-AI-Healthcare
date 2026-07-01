from datetime import datetime

from pydantic import BaseModel


class FlagReview(BaseModel):
    flagId: str
    decision: str        # accept | modify | dismiss
    note: str = ""


class Prescription(BaseModel):
    drug: str
    dosage: str
    frequency: str


class DoctorDecisionRequest(BaseModel):
    visit_id: str
    patient_id: str
    flag_reviews: list[FlagReview] = []
    primary_diagnosis: str
    secondary_diagnosis: str = ""
    icd_code: str = ""
    clinical_notes: str = ""
    treatment_items: list[str] = []
    treatment_details: dict[str, str] = {}
    prescriptions: list[Prescription] = []
    follow_up: str = ""


class DoctorDecisionResponse(BaseModel):
    decision_id: str
    visit_id: str
    patient_id: str
    doctor_name: str
    primary_diagnosis: str
    secondary_diagnosis: str | None
    icd_code: str | None
    follow_up: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
