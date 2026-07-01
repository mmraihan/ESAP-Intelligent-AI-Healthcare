import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Visit(Base):
    __tablename__ = "visits"

    visit_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    doctor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    visit_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    visit_type: Mapped[str] = mapped_column(String(30), default="survey")
    chief_complaint: Mapped[str | None] = mapped_column(String(500))
    symptom_description: Mapped[str | None] = mapped_column(Text)
    pain_scale: Mapped[int | None] = mapped_column(SmallInteger)
    associated_symptoms: Mapped[str | None] = mapped_column(Text)
    aggravating_factors: Mapped[str | None] = mapped_column(Text)
    relieving_factors: Mapped[str | None] = mapped_column(Text)
    previous_episodes: Mapped[bool | None] = mapped_column(Boolean)
    patient_concern: Mapped[str | None] = mapped_column(Text)
    survey_answers: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIAnalysisResult(Base):
    __tablename__ = "ai_analysis_results"

    result_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    visit_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    risk_score: Mapped[int | None] = mapped_column(Integer)
    risk_level: Mapped[str | None] = mapped_column(String(20))
    flags: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    model_used: Mapped[str | None] = mapped_column(String(100))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    feedback_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    visit_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    result_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    flag_id: Mapped[str] = mapped_column(String(100), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    doctor_note: Mapped[str | None] = mapped_column(Text)
    exported_to_rlhf: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
