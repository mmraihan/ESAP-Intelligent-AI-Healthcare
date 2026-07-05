from datetime import datetime

from pydantic import BaseModel


class AppointmentCreateRequest(BaseModel):
    patient_id: str
    doctor_id: str | None = None
    appointment_date: datetime
    appointment_type: str | None = None
    notes: str | None = None
    linked_visit_id: str | None = None


class AppointmentUpdateRequest(BaseModel):
    status: str | None = None
    appointment_date: datetime | None = None
    notes: str | None = None


class AppointmentResponse(BaseModel):
    appointment_id: str
    patient_id: str
    doctor_id: str | None
    appointment_date: datetime
    appointment_type: str | None
    status: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
