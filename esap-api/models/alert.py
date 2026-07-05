import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class HealthAlert(Base):
    __tablename__ = "health_alerts"

    alert_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    patient_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    alert_type: Mapped[str | None] = mapped_column(String(50))
    severity: Mapped[str] = mapped_column(String(20), nullable=False)   # info | warning | critical
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    tip: Mapped[str | None] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(30), nullable=False)     # doctor | system | rule_engine | ai_analysis
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
