import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Numeric, String, Text, func
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
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MedicalHistory(Base):
    __tablename__ = "medical_history"

    history_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text)
    past_surgeries: Mapped[str | None] = mapped_column(Text)
    cancer_history: Mapped[bool] = mapped_column(Boolean, default=False)
    cardiovascular_history: Mapped[str | None] = mapped_column(Text)
    mental_health_history: Mapped[str | None] = mapped_column(Text)
    vaccinations: Mapped[str | None] = mapped_column(Text)
    pregnancy_status: Mapped[str | None] = mapped_column(String(30))
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
    sleep_hours: Mapped[float | None] = mapped_column(Numeric(3, 1))
    stress_level: Mapped[int | None] = mapped_column()
    occupation: Mapped[str | None] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Consent(Base):
    __tablename__ = "consent"

    consent_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    ai_diagnosis: Mapped[bool] = mapped_column(Boolean, default=False)
    speech_recording: Mapped[bool] = mapped_column(Boolean, default=False)
    share_with_doctors: Mapped[bool] = mapped_column(Boolean, default=False)
    research_training: Mapped[bool] = mapped_column(Boolean, default=False)
    data_retention: Mapped[str | None] = mapped_column(String(30))
    consent_form_version: Mapped[str] = mapped_column(String(10), default="1.0")
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
