import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    external_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    preferred_name: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    biological_sex: Mapped[str] = mapped_column(String(20), nullable=False)
    gender_identity: Mapped[str | None] = mapped_column(String(100))
    blood_group: Mapped[str | None] = mapped_column(String(5))
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 1))
    nationality: Mapped[str | None] = mapped_column(String(100))
    ethnicity: Mapped[str | None] = mapped_column(Text)
    marital_status: Mapped[str | None] = mapped_column(String(20))
    education_level: Mapped[str | None] = mapped_column(String(100))
    religion: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PatientContact(Base):
    __tablename__ = "patient_contacts"

    contact_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    primary_phone: Mapped[str | None] = mapped_column(String(30))
    secondary_phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    address_street: Mapped[str | None] = mapped_column(String(300))
    address_city: Mapped[str | None] = mapped_column(String(100))
    address_country: Mapped[str | None] = mapped_column(String(100))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    emergency_name: Mapped[str | None] = mapped_column(String(200))
    emergency_phone: Mapped[str | None] = mapped_column(String(30))
    emergency_relation: Mapped[str | None] = mapped_column(String(50))
    preferred_method: Mapped[str | None] = mapped_column(String(20))
    preferred_time: Mapped[str | None] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MedicalHistory(Base):
    __tablename__ = "medical_history"

    history_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text)
    past_surgeries: Mapped[str | None] = mapped_column(Text)
    past_hospitalizations: Mapped[str | None] = mapped_column(Text)
    serious_infections: Mapped[str | None] = mapped_column(Text)   # JSON list
    cancer_history: Mapped[bool] = mapped_column(Boolean, default=False)
    cancer_details: Mapped[str | None] = mapped_column(String(500))
    cardiovascular_history: Mapped[str | None] = mapped_column(Text)
    mental_health_history: Mapped[str | None] = mapped_column(Text)
    pregnancy_status: Mapped[str | None] = mapped_column(String(30))
    gestational_age_weeks: Mapped[int | None] = mapped_column(SmallInteger)
    disability_status: Mapped[str | None] = mapped_column(Text)   # JSON list
    vaccinations: Mapped[str | None] = mapped_column(Text)
    genetic_conditions: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Allergy(Base):
    __tablename__ = "allergies"

    allergy_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    allergy_type: Mapped[str] = mapped_column(String(20), nullable=False)
    substance: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    reaction_type: Mapped[str | None] = mapped_column(String(50))
    severity: Mapped[str | None] = mapped_column(String(20))
    confirmed_by: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lifestyle(Base):
    __tablename__ = "lifestyle"

    lifestyle_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    smoking_status: Mapped[str | None] = mapped_column(String(20))
    alcohol_consumption: Mapped[str | None] = mapped_column(String(30))
    exercise_frequency: Mapped[str | None] = mapped_column(String(30))
    diet_type: Mapped[str | None] = mapped_column(String(50))
    cigarettes_per_day: Mapped[int | None] = mapped_column(SmallInteger)
    exercise_type: Mapped[str | None] = mapped_column(Text)   # JSON list
    water_intake: Mapped[str | None] = mapped_column(String(20))
    sleep_hours: Mapped[float | None] = mapped_column(Numeric(3, 1))
    stress_level: Mapped[int | None] = mapped_column()
    occupation: Mapped[str | None] = mapped_column(String(200))
    work_environment: Mapped[str | None] = mapped_column(String(50))
    caffeine_consumption: Mapped[str | None] = mapped_column(String(20))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Consent(Base):
    __tablename__ = "consent"

    consent_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    ai_diagnosis: Mapped[bool] = mapped_column(Boolean, default=False)
    speech_recording: Mapped[bool] = mapped_column(Boolean, default=False)
    transcription: Mapped[bool] = mapped_column(Boolean, default=False)
    share_with_doctors: Mapped[bool] = mapped_column(Boolean, default=False)
    share_with_specialists: Mapped[bool] = mapped_column(Boolean, default=False)
    research_training: Mapped[bool] = mapped_column(Boolean, default=False)
    lab_sharing: Mapped[bool] = mapped_column(Boolean, default=False)
    personal_app: Mapped[bool] = mapped_column(Boolean, default=False)
    emergency_override: Mapped[bool] = mapped_column(Boolean, default=False)
    signature_data: Mapped[str | None] = mapped_column(Text)   # base64 canvas PNG
    data_retention: Mapped[str | None] = mapped_column(String(30))
    consent_form_version: Mapped[str] = mapped_column(String(10), default="1.0")
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Medication(Base):
    __tablename__ = "medications"

    medication_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    dosage: Mapped[str | None] = mapped_column(String(100))
    frequency: Mapped[str | None] = mapped_column(String(100))
    prescribed_by: Mapped[str | None] = mapped_column(String(200))
    medication_type: Mapped[str | None] = mapped_column(String(20))   # prescription | otc | supplement | herbal
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FamilyHistory(Base):
    __tablename__ = "family_history"

    family_history_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    condition: Mapped[str] = mapped_column(String(200), nullable=False)
    affected_relatives: Mapped[str | None] = mapped_column(Text)   # JSON array: ["father","mother"]
    additional_details: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InsuranceInfo(Base):
    __tablename__ = "insurance_info"

    insurance_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    insurance_provider: Mapped[str | None] = mapped_column(String(200))
    policy_number: Mapped[str | None] = mapped_column(String(100))
    plan_type: Mapped[str | None] = mapped_column(String(30))
    coverage_expiry: Mapped[date | None] = mapped_column(Date)
    pcp_name: Mapped[str | None] = mapped_column(String(200))
    referring_doctor: Mapped[str | None] = mapped_column(String(200))
    preferred_hospital: Mapped[str | None] = mapped_column(String(200))
    preferred_language: Mapped[str | None] = mapped_column(String(50))
    interpreter_required: Mapped[bool] = mapped_column(Boolean, default=False)
    preferred_doctor: Mapped[str | None] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IntakeDetail(Base):
    __tablename__ = "intake_details"

    intake_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    current_medications_text: Mapped[str | None] = mapped_column(Text)
    otc_medications_text: Mapped[str | None] = mapped_column(Text)
    supplements_text: Mapped[str | None] = mapped_column(Text)
    medication_adherence: Mapped[str | None] = mapped_column(String(20))
    drug_allergies_text: Mapped[str | None] = mapped_column(Text)
    food_allergies_text: Mapped[str | None] = mapped_column(Text)
    environmental_allergies_text: Mapped[str | None] = mapped_column(Text)
    allergy_reaction_type: Mapped[str | None] = mapped_column(String(50))
    previous_anaphylaxis: Mapped[bool] = mapped_column(Boolean, default=False)
    latex_allergy: Mapped[bool] = mapped_column(Boolean, default=False)
    existing_ehr_id: Mapped[str | None] = mapped_column(String(50))
    previous_hospital: Mapped[str | None] = mapped_column(String(200))
    previous_doctor: Mapped[str | None] = mapped_column(String(200))
    last_visit_date: Mapped[date | None] = mapped_column(Date)
    previous_diagnoses: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
