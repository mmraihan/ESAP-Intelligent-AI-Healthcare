from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr


class ContactIn(BaseModel):
    primary_phone: str | None = None
    secondary_phone: str | None = None
    email: EmailStr | None = None
    address_street: str | None = None
    address_city: str | None = None
    address_country: str | None = None
    postal_code: str | None = None
    emergency_name: str | None = None
    emergency_phone: str | None = None
    emergency_relation: str | None = None
    preferred_method: str | None = None


class MedicalHistoryIn(BaseModel):
    chronic_conditions: list[str] | None = None
    past_surgeries: list[dict] | None = None
    cancer_history: bool = False
    cardiovascular_history: list[str] | None = None
    mental_health_history: list[str] | None = None
    vaccinations: list[str] | None = None
    pregnancy_status: str | None = None


class AllergyIn(BaseModel):
    allergy_type: str
    substance: str
    reaction_type: str | None = None
    severity: str | None = None
    confirmed_by: str | None = None


class LifestyleIn(BaseModel):
    smoking_status: str | None = None
    alcohol_consumption: str | None = None
    exercise_frequency: str | None = None
    diet_type: str | None = None
    sleep_hours: float | None = None
    stress_level: int | None = None
    occupation: str | None = None


class ConsentIn(BaseModel):
    ai_diagnosis: bool = False
    speech_recording: bool = False
    share_with_doctors: bool = False
    research_training: bool = False
    data_retention: str | None = None


class PatientCreateRequest(BaseModel):
    full_name: str
    preferred_name: str | None = None
    date_of_birth: date
    biological_sex: str
    gender_identity: str | None = None
    blood_group: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    nationality: str | None = None
    marital_status: str | None = None
    education_level: str | None = None
    religion: str | None = None

    contact: ContactIn | None = None
    medical_history: MedicalHistoryIn | None = None
    allergies: list[AllergyIn] | None = None
    lifestyle: LifestyleIn | None = None
    consent: ConsentIn | None = None


class PatientUpdateRequest(BaseModel):
    full_name: str | None = None
    preferred_name: str | None = None
    blood_group: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    marital_status: str | None = None


class PatientSummary(BaseModel):
    patient_id: str
    external_id: str
    full_name: str
    date_of_birth: date
    biological_sex: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientDetail(PatientSummary):
    preferred_name: str | None
    blood_group: str | None
    height_cm: float | None
    weight_kg: float | None
    nationality: str | None
    marital_status: str | None
