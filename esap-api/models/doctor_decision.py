import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class DoctorDecision(Base):
    __tablename__ = "doctor_decisions"

    decision_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    visit_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    doctor_name: Mapped[str] = mapped_column(String(200), nullable=False)

    primary_diagnosis: Mapped[str] = mapped_column(String(500), nullable=False)
    secondary_diagnosis: Mapped[str | None] = mapped_column(String(500))
    icd_code: Mapped[str | None] = mapped_column(String(20))
    clinical_notes: Mapped[str | None] = mapped_column(Text)

    treatment_items: Mapped[str | None] = mapped_column(Text)
    treatment_details: Mapped[str | None] = mapped_column(Text)
    prescriptions: Mapped[str | None] = mapped_column(Text)
    follow_up: Mapped[str | None] = mapped_column(String(100))
    flag_reviews: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
