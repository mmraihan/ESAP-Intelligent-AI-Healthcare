from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_staff
from database import get_db
from models.alert import HealthAlert
from models.patient import Patient
from models.user import User
from schemas.alert import HealthAlertCreateRequest, HealthAlertResponse

router = APIRouter(prefix="/api", tags=["alerts"])


@router.post("/patients/{patient_id}/alerts", response_model=HealthAlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    patient_id: str,
    body: HealthAlertCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if body.source == "ai_analysis":
        raise HTTPException(status_code=400, detail="ai_analysis alerts are created by the AI service, not this endpoint")

    alert = HealthAlert(patient_id=patient_id, **body.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get("/patients/{patient_id}/alerts", response_model=list[HealthAlertResponse])
def list_alerts(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(HealthAlert)
        .filter(HealthAlert.patient_id == patient_id, HealthAlert.is_dismissed == False)
        .order_by(HealthAlert.created_at.desc())
        .all()
    )


@router.post("/alerts/{alert_id}/dismiss", response_model=HealthAlertResponse)
def dismiss_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    alert = db.query(HealthAlert).filter(HealthAlert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_dismissed = True
    alert.dismissed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert
