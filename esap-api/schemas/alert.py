from datetime import datetime

from pydantic import BaseModel


class HealthAlertCreateRequest(BaseModel):
    alert_type: str | None = None
    severity: str
    title: str
    detail: str | None = None
    tip: str | None = None
    source: str = "doctor"   # doctor | system | rule_engine (ai_analysis is set by the AI service, not this endpoint)


class HealthAlertResponse(BaseModel):
    alert_id: str
    patient_id: str
    alert_type: str | None
    severity: str
    title: str
    detail: str | None
    tip: str | None
    source: str
    is_dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
