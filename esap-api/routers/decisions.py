import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_doctor
from database import get_db
from models.doctor_decision import DoctorDecision
from models.user import User
from models.visit import AIFeedback, Visit
from schemas.doctor_decision import DoctorDecisionRequest, DoctorDecisionResponse

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.post("", response_model=DoctorDecisionResponse, status_code=status.HTTP_201_CREATED)
def submit_decision(
    body: DoctorDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor),
):
    visit = db.query(Visit).filter(Visit.visit_id == body.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    decision = DoctorDecision(
        visit_id=body.visit_id,
        patient_id=body.patient_id,
        doctor_id=current_user.user_id,
        doctor_name=current_user.full_name,
        primary_diagnosis=body.primary_diagnosis,
        secondary_diagnosis=body.secondary_diagnosis or None,
        icd_code=body.icd_code or None,
        clinical_notes=body.clinical_notes or None,
        treatment_items=json.dumps(body.treatment_items),
        treatment_details=json.dumps(body.treatment_details),
        prescriptions=json.dumps([p.model_dump() for p in body.prescriptions]),
        follow_up=body.follow_up or None,
        flag_reviews=json.dumps([f.model_dump() for f in body.flag_reviews]),
    )
    db.add(decision)

    # store individual flag reviews as AIFeedback rows (for RLHF pipeline)
    for fr in body.flag_reviews:
        db.add(AIFeedback(
            visit_id=body.visit_id,
            result_id="",     # placeholder until AI service is wired up in Phase 2
            doctor_id=current_user.user_id,
            flag_id=fr.flagId,
            decision=fr.decision,
            doctor_note=fr.note,
        ))

    # mark visit as closed
    visit.status = "closed"
    visit.doctor_id = current_user.user_id

    db.commit()
    db.refresh(decision)
    return decision


@router.get("/{decision_id}", response_model=DoctorDecisionResponse)
def get_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    decision = db.query(DoctorDecision).filter(DoctorDecision.decision_id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.get("/visit/{visit_id}", response_model=DoctorDecisionResponse)
def get_decision_by_visit(
    visit_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    decision = db.query(DoctorDecision).filter(DoctorDecision.visit_id == visit_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="No decision found for this visit")
    return decision
