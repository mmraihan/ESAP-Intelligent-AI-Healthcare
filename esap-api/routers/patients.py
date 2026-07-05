import json
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_doctor, require_staff
from database import get_db
from models.patient import (
    Allergy,
    Consent,
    FamilyHistory,
    InsuranceInfo,
    IntakeDetail,
    Lifestyle,
    MedicalHistory,
    Medication,
    Patient,
    PatientContact,
)
from models.user import User
from schemas.patient import (
    ContactIn,
    ContactResponse,
    ConsentIn,
    ConsentResponse,
    FamilyHistoryIn,
    FamilyHistoryResponse,
    InsuranceIn,
    InsuranceResponse,
    IntakeDetailIn,
    IntakeDetailResponse,
    LifestyleIn,
    LifestyleResponse,
    MedicalHistoryIn,
    MedicalHistoryResponse,
    MedicationIn,
    MedicationResponse,
    PatientCreateRequest,
    PatientDetail,
    PatientFullProfile,
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
    try:
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
            ethnicity=json.dumps(body.ethnicity) if body.ethnicity else None,
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
                preferred_time=c.preferred_time,
            ))

        if body.medical_history:
            mh = body.medical_history
            db.add(MedicalHistory(
                patient_id=patient.patient_id,
                chronic_conditions=json.dumps(mh.chronic_conditions) if mh.chronic_conditions else None,
                past_surgeries=json.dumps(mh.past_surgeries) if mh.past_surgeries else None,
                past_hospitalizations=mh.past_hospitalizations,
                serious_infections=json.dumps(mh.serious_infections) if mh.serious_infections else None,
                cancer_history=mh.cancer_history,
                cancer_details=mh.cancer_details,
                cardiovascular_history=json.dumps(mh.cardiovascular_history) if mh.cardiovascular_history else None,
                mental_health_history=json.dumps(mh.mental_health_history) if mh.mental_health_history else None,
                pregnancy_status=mh.pregnancy_status,
                gestational_age_weeks=mh.gestational_age_weeks,
                disability_status=json.dumps(mh.disability_status) if mh.disability_status else None,
                vaccinations=json.dumps(mh.vaccinations) if mh.vaccinations else None,
                genetic_conditions=mh.genetic_conditions,
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
                cigarettes_per_day=ls.cigarettes_per_day,
                alcohol_consumption=ls.alcohol_consumption,
                exercise_frequency=ls.exercise_frequency,
                exercise_type=json.dumps(ls.exercise_type) if ls.exercise_type else None,
                diet_type=ls.diet_type,
                water_intake=ls.water_intake,
                sleep_hours=ls.sleep_hours,
                stress_level=ls.stress_level,
                occupation=ls.occupation,
                work_environment=ls.work_environment,
                caffeine_consumption=ls.caffeine_consumption,
            ))

        if body.consent:
            co = body.consent
            db.add(Consent(
                patient_id=patient.patient_id,
                ai_diagnosis=co.ai_diagnosis,
                speech_recording=co.speech_recording,
                transcription=co.transcription,
                share_with_doctors=co.share_with_doctors,
                share_with_specialists=co.share_with_specialists,
                research_training=co.research_training,
                lab_sharing=co.lab_sharing,
                personal_app=co.personal_app,
                emergency_override=co.emergency_override,
                signature_data=co.signature_data,
                data_retention=co.data_retention,
            ))

        if body.medications:
            for m in body.medications:
                db.add(Medication(
                    patient_id=patient.patient_id,
                    drug_name=m.drug_name,
                    dosage=m.dosage,
                    frequency=m.frequency,
                    prescribed_by=m.prescribed_by,
                    medication_type=m.medication_type,
                    start_date=m.start_date,
                    end_date=m.end_date,
                    notes=m.notes,
                ))

        if body.family_history:
            for f in body.family_history:
                db.add(FamilyHistory(
                    patient_id=patient.patient_id,
                    condition=f.condition,
                    affected_relatives=json.dumps(f.affected_relatives) if f.affected_relatives else None,
                    additional_details=f.additional_details,
                ))

        if body.insurance:
            ins = body.insurance
            db.add(InsuranceInfo(
                patient_id=patient.patient_id,
                insurance_provider=ins.insurance_provider,
                policy_number=ins.policy_number,
                plan_type=ins.plan_type,
                coverage_expiry=ins.coverage_expiry,
                pcp_name=ins.pcp_name,
                referring_doctor=ins.referring_doctor,
                preferred_hospital=ins.preferred_hospital,
                preferred_language=ins.preferred_language,
                interpreter_required=ins.interpreter_required,
                preferred_doctor=ins.preferred_doctor,
            ))

        if body.intake_detail:
            idt = body.intake_detail
            db.add(IntakeDetail(
                patient_id=patient.patient_id,
                current_medications_text=idt.current_medications_text,
                otc_medications_text=idt.otc_medications_text,
                supplements_text=idt.supplements_text,
                medication_adherence=idt.medication_adherence,
                drug_allergies_text=idt.drug_allergies_text,
                food_allergies_text=idt.food_allergies_text,
                environmental_allergies_text=idt.environmental_allergies_text,
                allergy_reaction_type=idt.allergy_reaction_type,
                previous_anaphylaxis=idt.previous_anaphylaxis,
                latex_allergy=idt.latex_allergy,
                existing_ehr_id=idt.existing_ehr_id,
                previous_hospital=idt.previous_hospital,
                previous_doctor=idt.previous_doctor,
                last_visit_date=idt.last_visit_date,
                previous_diagnoses=idt.previous_diagnoses,
            ))

        db.commit()
    except Exception:
        db.rollback()
        raise

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


def _get_active_patient(patient_id: str, db: Session) -> Patient:
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id, Patient.is_active == True
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/{patient_id}/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def add_medication(
    patient_id: str,
    body: MedicationIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    medication = Medication(patient_id=patient_id, **body.model_dump())
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


@router.get("/{patient_id}/medications", response_model=list[MedicationResponse])
def list_medications(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return (
        db.query(Medication)
        .filter(Medication.patient_id == patient_id)
        .order_by(Medication.created_at.desc())
        .all()
    )


@router.put("/{patient_id}/medications/{medication_id}", response_model=MedicationResponse)
def deactivate_medication(
    patient_id: str,
    medication_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    medication = db.query(Medication).filter(
        Medication.medication_id == medication_id, Medication.patient_id == patient_id
    ).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    medication.is_active = False
    db.commit()
    db.refresh(medication)
    return medication


@router.post("/{patient_id}/family-history", response_model=FamilyHistoryResponse, status_code=status.HTTP_201_CREATED)
def add_family_history(
    patient_id: str,
    body: FamilyHistoryIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    entry = FamilyHistory(
        patient_id=patient_id,
        condition=body.condition,
        affected_relatives=json.dumps(body.affected_relatives) if body.affected_relatives else None,
        additional_details=body.additional_details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{patient_id}/family-history", response_model=list[FamilyHistoryResponse])
def list_family_history(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return db.query(FamilyHistory).filter(FamilyHistory.patient_id == patient_id).all()


@router.put("/{patient_id}/insurance", response_model=InsuranceResponse)
def upsert_insurance(
    patient_id: str,
    body: InsuranceIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    insurance = db.query(InsuranceInfo).filter(InsuranceInfo.patient_id == patient_id).first()
    if not insurance:
        insurance = InsuranceInfo(patient_id=patient_id)
        db.add(insurance)

    for field, value in body.model_dump().items():
        setattr(insurance, field, value)

    db.commit()
    db.refresh(insurance)
    return insurance


@router.get("/{patient_id}/insurance", response_model=InsuranceResponse)
def get_insurance(
    patient_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    insurance = db.query(InsuranceInfo).filter(InsuranceInfo.patient_id == patient_id).first()
    if not insurance:
        raise HTTPException(status_code=404, detail="No insurance info on file")
    return insurance


def _upsert_one_to_one(model, patient_id: str, body: BaseModel, db: Session):
    row = db.query(model).filter(model.patient_id == patient_id).first()
    if not row:
        row = model(patient_id=patient_id)
        db.add(row)
    for field, value in body.model_dump().items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def _get_one_to_one(model, patient_id: str, db: Session, not_found_detail: str):
    row = db.query(model).filter(model.patient_id == patient_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return row


@router.put("/{patient_id}/contact", response_model=ContactResponse)
def upsert_contact(
    patient_id: str,
    body: ContactIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    return _upsert_one_to_one(PatientContact, patient_id, body, db)


@router.get("/{patient_id}/contact", response_model=ContactResponse)
def get_contact(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    return _get_one_to_one(PatientContact, patient_id, db, "No contact info on file")


@router.put("/{patient_id}/medical-history", response_model=MedicalHistoryResponse)
def upsert_medical_history(
    patient_id: str,
    body: MedicalHistoryIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    row = db.query(MedicalHistory).filter(MedicalHistory.patient_id == patient_id).first()
    if not row:
        row = MedicalHistory(patient_id=patient_id)
        db.add(row)
    row.chronic_conditions = json.dumps(body.chronic_conditions) if body.chronic_conditions else None
    row.past_surgeries = json.dumps(body.past_surgeries) if body.past_surgeries else None
    row.past_hospitalizations = body.past_hospitalizations
    row.serious_infections = json.dumps(body.serious_infections) if body.serious_infections else None
    row.cancer_history = body.cancer_history
    row.cancer_details = body.cancer_details
    row.cardiovascular_history = json.dumps(body.cardiovascular_history) if body.cardiovascular_history else None
    row.mental_health_history = json.dumps(body.mental_health_history) if body.mental_health_history else None
    row.pregnancy_status = body.pregnancy_status
    row.gestational_age_weeks = body.gestational_age_weeks
    row.disability_status = json.dumps(body.disability_status) if body.disability_status else None
    row.vaccinations = json.dumps(body.vaccinations) if body.vaccinations else None
    row.genetic_conditions = body.genetic_conditions
    db.commit()
    db.refresh(row)
    return row


@router.get("/{patient_id}/medical-history", response_model=MedicalHistoryResponse)
def get_medical_history(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    return _get_one_to_one(MedicalHistory, patient_id, db, "No medical history on file")


@router.put("/{patient_id}/lifestyle", response_model=LifestyleResponse)
def upsert_lifestyle(
    patient_id: str,
    body: LifestyleIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    row = db.query(Lifestyle).filter(Lifestyle.patient_id == patient_id).first()
    if not row:
        row = Lifestyle(patient_id=patient_id)
        db.add(row)
    row.smoking_status = body.smoking_status
    row.cigarettes_per_day = body.cigarettes_per_day
    row.alcohol_consumption = body.alcohol_consumption
    row.exercise_frequency = body.exercise_frequency
    row.exercise_type = json.dumps(body.exercise_type) if body.exercise_type else None
    row.diet_type = body.diet_type
    row.water_intake = body.water_intake
    row.sleep_hours = body.sleep_hours
    row.stress_level = body.stress_level
    row.occupation = body.occupation
    row.work_environment = body.work_environment
    row.caffeine_consumption = body.caffeine_consumption
    db.commit()
    db.refresh(row)
    return row


@router.get("/{patient_id}/lifestyle", response_model=LifestyleResponse)
def get_lifestyle(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    return _get_one_to_one(Lifestyle, patient_id, db, "No lifestyle info on file")


@router.put("/{patient_id}/consent", response_model=ConsentResponse)
def upsert_consent(
    patient_id: str,
    body: ConsentIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    return _upsert_one_to_one(Consent, patient_id, body, db)


@router.get("/{patient_id}/consent", response_model=ConsentResponse)
def get_consent(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    return _get_one_to_one(Consent, patient_id, db, "No consent on file")


@router.put("/{patient_id}/intake-detail", response_model=IntakeDetailResponse)
def upsert_intake_detail(
    patient_id: str,
    body: IntakeDetailIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    _get_active_patient(patient_id, db)
    return _upsert_one_to_one(IntakeDetail, patient_id, body, db)


@router.get("/{patient_id}/intake-detail", response_model=IntakeDetailResponse)
def get_intake_detail(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    return _get_one_to_one(IntakeDetail, patient_id, db, "No intake detail on file")


@router.get("/{patient_id}/full", response_model=PatientFullProfile)
def get_full_profile(patient_id: str, db: Session = Depends(get_db), _: User = Depends(require_staff)):
    patient = _get_active_patient(patient_id, db)
    return PatientFullProfile(
        **PatientDetail.model_validate(patient, from_attributes=True).model_dump(),
        contact=db.query(PatientContact).filter(PatientContact.patient_id == patient_id).first(),
        medical_history=db.query(MedicalHistory).filter(MedicalHistory.patient_id == patient_id).first(),
        allergies=db.query(Allergy).filter(Allergy.patient_id == patient_id).all(),
        medications=db.query(Medication).filter(Medication.patient_id == patient_id).all(),
        family_history=db.query(FamilyHistory).filter(FamilyHistory.patient_id == patient_id).all(),
        lifestyle=db.query(Lifestyle).filter(Lifestyle.patient_id == patient_id).first(),
        consent=db.query(Consent).filter(Consent.patient_id == patient_id).first(),
        insurance=db.query(InsuranceInfo).filter(InsuranceInfo.patient_id == patient_id).first(),
        intake_detail=db.query(IntakeDetail).filter(IntakeDetail.patient_id == patient_id).first(),
    )
