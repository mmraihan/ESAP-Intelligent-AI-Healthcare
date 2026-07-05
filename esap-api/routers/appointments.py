from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import require_staff
from database import get_db
from models.appointment import Appointment
from models.patient import Patient
from models.user import User
from schemas.appointment import AppointmentCreateRequest, AppointmentResponse, AppointmentUpdateRequest

router = APIRouter(prefix="/api", tags=["appointments"])


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = db.query(Patient).filter(
        Patient.patient_id == body.patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    appointment = Appointment(**body.model_dump())
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/patients/{patient_id}/appointments", response_model=list[AppointmentResponse])
def list_patient_appointments(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id)
        .order_by(Appointment.appointment_date.desc())
        .all()
    )


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: str,
    body: AppointmentUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    appointment = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)
    return appointment
