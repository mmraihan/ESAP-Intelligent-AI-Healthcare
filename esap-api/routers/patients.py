import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_doctor, require_staff
from database import get_db
from models.patient import Allergy, Consent, Lifestyle, MedicalHistory, Patient, PatientContact
from models.user import User
from schemas.patient import (
    PatientCreateRequest,
    PatientDetail,
    PatientSummary,
    PatientUpdateRequest,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _generate_external_id(db: Session) -> str:
    while True:
        eid = f"ESAP-{uuid.uuid4().hex[:8].upper()}"
        if not db.query(Patient).filter(Patient.external_id == eid).first():
            return eid


@router.post("", response_model=PatientDetail, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = Patient(
        external_id=_generate_external_id(db),
        full_name=body.full_name,
        preferred_name=body.preferred_name,
        date_of_birth=body.date_of_birth,
        biological_sex=body.biological_sex,
        gender_identity=body.gender_identity,
        blood_group=body.blood_group,
        height_cm=body.height_cm,
        weight_kg=body.weight_kg,
        nationality=body.nationality,
        marital_status=body.marital_status,
        education_level=body.education_level,
        religion=body.religion,
    )
    db.add(patient)
    db.flush()   # get patient_id before inserting child records

    if body.contact:
        c = body.contact
        db.add(PatientContact(
            patient_id=patient.patient_id,
            primary_phone=c.primary_phone,
            secondary_phone=c.secondary_phone,
            email=c.email,
            address_street=c.address_street,
            address_city=c.address_city,
            address_country=c.address_country,
            postal_code=c.postal_code,
            emergency_name=c.emergency_name,
            emergency_phone=c.emergency_phone,
            emergency_relation=c.emergency_relation,
            preferred_method=c.preferred_method,
        ))

    if body.medical_history:
        mh = body.medical_history
        db.add(MedicalHistory(
            patient_id=patient.patient_id,
            chronic_conditions=json.dumps(mh.chronic_conditions) if mh.chronic_conditions else None,
            past_surgeries=json.dumps(mh.past_surgeries) if mh.past_surgeries else None,
            cancer_history=mh.cancer_history,
            cardiovascular_history=json.dumps(mh.cardiovascular_history) if mh.cardiovascular_history else None,
            mental_health_history=json.dumps(mh.mental_health_history) if mh.mental_health_history else None,
            vaccinations=json.dumps(mh.vaccinations) if mh.vaccinations else None,
            pregnancy_status=mh.pregnancy_status,
        ))

    if body.allergies:
        for a in body.allergies:
            db.add(Allergy(
                patient_id=patient.patient_id,
                allergy_type=a.allergy_type,
                substance=a.substance,
                reaction_type=a.reaction_type,
                severity=a.severity,
                confirmed_by=a.confirmed_by,
            ))

    if body.lifestyle:
        ls = body.lifestyle
        db.add(Lifestyle(
            patient_id=patient.patient_id,
            smoking_status=ls.smoking_status,
            alcohol_consumption=ls.alcohol_consumption,
            exercise_frequency=ls.exercise_frequency,
            diet_type=ls.diet_type,
            sleep_hours=ls.sleep_hours,
            stress_level=ls.stress_level,
            occupation=ls.occupation,
        ))

    if body.consent:
        co = body.consent
        db.add(Consent(
            patient_id=patient.patient_id,
            ai_diagnosis=co.ai_diagnosis,
            speech_recording=co.speech_recording,
            share_with_doctors=co.share_with_doctors,
            research_training=co.research_training,
            data_retention=co.data_retention,
        ))

    db.commit()
    db.refresh(patient)
    return patient


@router.get("", response_model=list[PatientSummary])
def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    q = db.query(Patient).filter(Patient.is_active == True)
    if search:
        q = q.filter(Patient.full_name.ilike(f"%{search}%"))
    return q.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=PatientDetail)
def update_patient(
    patient_id: str,
    body: PatientUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.is_active = False
    db.commit()
