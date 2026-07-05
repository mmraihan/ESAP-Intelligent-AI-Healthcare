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
    preferred_time: str | None = None


class ContactResponse(ContactIn):
    contact_id: str
    patient_id: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicalHistoryIn(BaseModel):
    chronic_conditions: list[str] | None = None
    past_surgeries: list[dict] | None = None
    past_hospitalizations: str | None = None
    serious_infections: list[str] | None = None
    cancer_history: bool = False
    cancer_details: str | None = None
    cardiovascular_history: list[str] | None = None
    mental_health_history: list[str] | None = None
    pregnancy_status: str | None = None
    gestational_age_weeks: int | None = None
    disability_status: list[str] | None = None
    vaccinations: list[str] | None = None
    genetic_conditions: str | None = None


class MedicalHistoryResponse(BaseModel):
    history_id: str
    patient_id: str
    chronic_conditions: str | None
    past_surgeries: str | None
    past_hospitalizations: str | None
    serious_infections: str | None
    cancer_history: bool
    cancer_details: str | None
    cardiovascular_history: str | None
    mental_health_history: str | None
    pregnancy_status: str | None
    gestational_age_weeks: int | None
    disability_status: str | None
    vaccinations: str | None
    genetic_conditions: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class AllergyIn(BaseModel):
    allergy_type: str
    substance: str
    reaction_type: str | None = None
    severity: str | None = None
    confirmed_by: str | None = None


class AllergyResponse(AllergyIn):
    allergy_id: str
    patient_id: str
    is_active: bool
    recorded_at: datetime

    model_config = {"from_attributes": True}




class LifestyleIn(BaseModel):
    smoking_status: str | None = None
    cigarettes_per_day: int | None = None
    alcohol_consumption: str | None = None
    exercise_frequency: str | None = None
    exercise_type: list[str] | None = None
    diet_type: str | None = None
    water_intake: str | None = None
    sleep_hours: float | None = None
    stress_level: int | None = None
    occupation: str | None = None
    work_environment: str | None = None
    caffeine_consumption: str | None = None


class LifestyleResponse(BaseModel):
    lifestyle_id: str
    patient_id: str
    smoking_status: str | None
    cigarettes_per_day: int | None
    alcohol_consumption: str | None
    exercise_frequency: str | None
    exercise_type: str | None
    diet_type: str | None
    water_intake: str | None
    sleep_hours: float | None
    stress_level: int | None
    occupation: str | None
    work_environment: str | None
    caffeine_consumption: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConsentIn(BaseModel):
    ai_diagnosis: bool = False
    speech_recording: bool = False
    transcription: bool = False
    share_with_doctors: bool = False
    share_with_specialists: bool = False
    research_training: bool = False
    lab_sharing: bool = False
    personal_app: bool = False
    emergency_override: bool = False
    signature_data: str | None = None
    data_retention: str | None = None


class ConsentResponse(ConsentIn):
    consent_id: str
    patient_id: str
    consent_form_version: str
    signed_at: datetime
    revoked_at: datetime | None

    model_config = {"from_attributes": True}


class IntakeDetailIn(BaseModel):
    current_medications_text: str | None = None
    otc_medications_text: str | None = None
    supplements_text: str | None = None
    medication_adherence: str | None = None
    drug_allergies_text: str | None = None
    food_allergies_text: str | None = None
    environmental_allergies_text: str | None = None
    allergy_reaction_type: str | None = None
    previous_anaphylaxis: bool = False
    latex_allergy: bool = False
    existing_ehr_id: str | None = None
    previous_hospital: str | None = None
    previous_doctor: str | None = None
    last_visit_date: date | None = None
    previous_diagnoses: str | None = None


class IntakeDetailResponse(IntakeDetailIn):
    intake_id: str
    patient_id: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicationIn(BaseModel):
    drug_name: str
    dosage: str | None = None
    frequency: str | None = None
    prescribed_by: str | None = None
    medication_type: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class MedicationResponse(MedicationIn):
    medication_id: str
    patient_id: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FamilyHistoryIn(BaseModel):
    condition: str
    affected_relatives: list[str] | None = None
    additional_details: str | None = None


class FamilyHistoryResponse(BaseModel):
    family_history_id: str
    patient_id: str
    condition: str
    additional_details: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class InsuranceIn(BaseModel):
    insurance_provider: str | None = None
    policy_number: str | None = None
    plan_type: str | None = None
    coverage_expiry: date | None = None
    pcp_name: str | None = None
    referring_doctor: str | None = None
    preferred_hospital: str | None = None
    preferred_language: str | None = None
    interpreter_required: bool = False
    preferred_doctor: str | None = None


class InsuranceResponse(InsuranceIn):
    insurance_id: str
    patient_id: str
    updated_at: datetime

    model_config = {"from_attributes": True}


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
    ethnicity: list[str] | None = None
    marital_status: str | None = None
    education_level: str | None = None
    religion: str | None = None

    contact: ContactIn | None = None
    medical_history: MedicalHistoryIn | None = None
    allergies: list[AllergyIn] | None = None
    lifestyle: LifestyleIn | None = None
    consent: ConsentIn | None = None
    medications: list[MedicationIn] | None = None
    family_history: list[FamilyHistoryIn] | None = None
    insurance: InsuranceIn | None = None
    intake_detail: IntakeDetailIn | None = None


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
    ethnicity: str | None       # raw JSON string — frontend parses this
    marital_status: str | None


class PatientFullProfile(PatientDetail):
    contact: ContactResponse | None = None
    medical_history: MedicalHistoryResponse | None = None
    allergies: list[AllergyResponse] = []
    medications: list[MedicationResponse] = []
    family_history: list[FamilyHistoryResponse] = []
    lifestyle: LifestyleResponse | None = None
    consent: ConsentResponse | None = None
    insurance: InsuranceResponse | None = None
    intake_detail: IntakeDetailResponse | None = None
