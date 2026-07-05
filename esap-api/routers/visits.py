import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_staff
from database import get_db
from models.patient import Patient
from models.user import User
from models.visit import AIAnalysisResult, Visit
from schemas.visit import AIResultResponse, SurveySubmitRequest, VisitResponse

router = APIRouter(prefix="/api", tags=["visits"])


@router.post("/surveys", response_model=VisitResponse, status_code=201)
def submit_survey(
    body: SurveySubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(
        Patient.patient_id == body.patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visit = Visit(
        patient_id=body.patient_id,
        visit_date=datetime.now(timezone.utc),
        visit_type=body.visit_type,
        chief_complaint=body.chief_complaint,
        symptom_description=body.symptom_description,
        onset_date=body.onset_date,
        onset_type=body.onset_type,
        duration=body.duration,
        pain_scale=body.pain_scale,
        symptom_location=body.symptom_location,
        associated_symptoms=json.dumps(body.associated_symptoms) if body.associated_symptoms else None,
        aggravating_factors=json.dumps(body.aggravating_factors) if body.aggravating_factors else None,
        relieving_factors=json.dumps(body.relieving_factors) if body.relieving_factors else None,
        previous_episodes=body.previous_episodes,
        self_treatment=body.self_treatment,
        patient_concern=body.patient_concern,
        survey_answers=json.dumps(body.survey_answers) if body.survey_answers else None,
        status="open",
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.get("/visits/{visit_id}", response_model=VisitResponse)
def get_visit(
    visit_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    visit = db.query(Visit).filter(Visit.visit_id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.get("/patients/{patient_id}/visits", response_model=list[VisitResponse])
def get_patient_visits(
    patient_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.visit_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/visits/{visit_id}/ai-result", response_model=AIResultResponse)
def get_ai_result(
    visit_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    result = db.query(AIAnalysisResult).filter(AIAnalysisResult.visit_id == visit_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="AI result not found for this visit")
    return result
