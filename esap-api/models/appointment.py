import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    doctor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    appointment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    appointment_type: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled|confirmed|completed|cancelled|no_show
    notes: Mapped[str | None] = mapped_column(String(500))
    linked_visit_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
