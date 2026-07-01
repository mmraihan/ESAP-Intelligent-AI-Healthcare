from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SurveySubmitRequest(BaseModel):
    patient_id: str
    chief_complaint: str | None = None
    pain_scale: int | None = None
    symptom_description: str | None = None
    associated_symptoms: list[str] | None = None
    aggravating_factors: list[str] | None = None
    relieving_factors: list[str] | None = None
    previous_episodes: bool | None = None
    patient_concern: str | None = None
    survey_answers: dict[str, Any] | None = None   # full raw answers blob


class VisitResponse(BaseModel):
    visit_id: str
    patient_id: str
    visit_date: datetime
    visit_type: str
    chief_complaint: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AIResultResponse(BaseModel):
    result_id: str
    visit_id: str
    risk_score: int | None
    risk_level: str | None
    flags: str | None       # raw JSON string — frontend parses this
    summary: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
