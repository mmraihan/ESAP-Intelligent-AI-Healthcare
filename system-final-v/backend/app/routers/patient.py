"""Patient portal (§13): home, results, records, sharing, care team, settings.

The rule that shapes every route here: **a patient never sees a raw score**
(§13.6). `/patient/results` returns the release-gate state and, once released,
the clinician's plain-language summary — never a probability, an interval or a
model version. That is not a formatting choice: an uncontextualised mortality
probability delivered to a patient with no clinician present is a harm.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..care_team import for_patient as care_team_for
from .. import audit, db, rbac, settings_store
from ..deps import Actor, current_actor
from ..errors import ApiError
from ..security import iso, utcnow

router = APIRouter(prefix="/patient", tags=["patient"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConsentRequest(Strict):
    grantee: str = Field(min_length=1, max_length=160)
    grantee_type: str
    purpose: str = Field(min_length=1, max_length=160)
    scope: list[str] = Field(min_length=1, max_length=20)
    expires_at: str | None = None


def _me(actor: Actor) -> str:
    if actor.role != "patient":
        raise ApiError(403, "The patient portal serves the patient's own record only.")
    # Org settings → "Allow patients to see released results" was saved but
    # never enforced: turning it off is supposed to remove the portal entirely
    # for the tenant a patient account was provisioned in (§11.4.12), and
    # nothing checked it. This covers that direct case — an account whose own
    # tenant_id is the hospital that turned it off.
    org = settings_store.read("org", actor.tenant_id)["settings"]
    if org.get("patientPortalEnabled", True) is False:
        raise ApiError(403, "The patient portal is turned off for this hospital. Contact them directly.")
    return actor.user_id


@router.get("/home")
def home(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    return {
        "results": db.docs(
            "SELECT doc FROM released_results WHERE patient_id=? ORDER BY released_at DESC",
            (patient_id,),
        ),
        "consents": db.docs("SELECT doc FROM consents WHERE patient_id=?", (patient_id,)),
        "care_team": care_team_for(patient_id),
        "records": db.docs(
            "SELECT doc FROM records WHERE patient_id=? ORDER BY date DESC", (patient_id,)
        ),
    }


@router.get("/results")
def results(request: Request, actor: Actor = Depends(current_actor)):
    """Released summaries, plus the gate state for anything not yet released.

    A pending assessment is shown as pending rather than hidden: the patient is
    told a result exists and is being reviewed, which is the honest state and
    the one §13.6 requires.
    """
    patient_id = _me(actor)
    released = db.docs(
        "SELECT doc FROM released_results WHERE patient_id=? ORDER BY released_at DESC",
        (patient_id,),
    )
    audit.record(actor, "patient.read", f"patient:{patient_id}",
                 ip=request.client.host if request.client else "unknown")
    return {
        "released": released,
        "raw_scores_withheld": True,
        "gate": {
            "state": "released" if released else "awaiting_clinician_review",
            "explanation": (
                "Your care team reviews every assessment before it is shared. Until then you "
                "will see that a result exists, but not the underlying numbers."
            ),
        },
    }


@router.get("/records")
def records(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    return {"records": db.docs(
        "SELECT doc FROM records WHERE patient_id=? ORDER BY date DESC", (patient_id,)
    )}


@router.get("/care-team")
def care_team(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    return {"care_team": care_team_for(patient_id)}


@router.get("/sharing")
def sharing(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    return {"consents": db.docs("SELECT doc FROM consents WHERE patient_id=?", (patient_id,))}


@router.post("/sharing", status_code=201)
def grant_consent(body: ConsentRequest, request: Request, actor: Actor = Depends(current_actor)):
    import uuid

    patient_id = _me(actor)
    if body.grantee_type not in {"hospital", "clinician", "caregiver", "app"}:
        raise ApiError(422, "grantee_type must be hospital, clinician, caregiver or app.")

    doc = {
        "id": f"c_{uuid.uuid4().hex[:10]}", "grantee": body.grantee,
        "granteeType": body.grantee_type, "purpose": body.purpose, "scope": body.scope,
        "grantedAt": iso(utcnow()), "expiresAt": body.expires_at, "status": "active",
    }
    db.insert_doc("consents", doc, {"patient_id": patient_id, "status": "active"})
    audit.record(actor, "consent.grant", body.grantee,
                 ip=request.client.host if request.client else "unknown")
    return doc


@router.delete("/sharing/{consent_id}")
def revoke_consent(consent_id: str, request: Request, actor: Actor = Depends(current_actor)):
    """Revoke a share.

    Revocation is immediate and needs no reason — it is the patient's own
    record. It stops future access; it does not retroactively unsend what was
    already delivered, and the response says so rather than implying otherwise.
    """
    patient_id = _me(actor)
    consent = db.one_doc("SELECT doc FROM consents WHERE id=? AND patient_id=?",
                         (consent_id, patient_id))
    if consent is None:
        raise ApiError(404, "No such sharing permission on your record.")

    doc = db.patch_doc("consents", consent_id, {"status": "revoked"}, {"status": "revoked"})
    # For caregiver access, the consent is only half of it: the carer has a linked
    # account. Revoking must cut that link too, or "stop sharing" would leave the
    # carer still able to open the record — the exact failure revoke exists to prevent.
    if consent.get("granteeType") == "caregiver":
        email = (consent.get("inviteEmail") or "").strip().lower()
        links = db.document("caregiver_links") or {}
        entries = links.get(email)
        if entries:
            for e in entries:
                if e.get("consentId") == consent_id or e.get("patientId") == patient_id:
                    e["status"] = "revoked"
            links[email] = entries
            db.put_document("caregiver_links", links)
    audit.record(actor, "consent.revoke", consent["grantee"],
                 ip=request.client.host if request.client else "unknown")
    return {
        "consent": doc,
        "note": "Future access is stopped. Records already delivered under this permission are not recalled.",
    }


@router.get("/access-log")
def access_log(request: Request, actor: Actor = Depends(current_actor)):
    """Who has looked at or changed this patient's portal record, newest first."""
    patient_id = _me(actor)
    rows = db.docs(
        "SELECT doc FROM audit_events WHERE actor=? OR json_extract(doc, '$.target') LIKE ?"
        " ORDER BY at DESC LIMIT 500",
        (actor.email, f"patient:{patient_id}%"),
    )
    audit.record(actor, "patient.read", f"patient:{patient_id} access log",
                 ip=request.client.host if request.client else "unknown")
    return {"events": rows}


@router.get("/settings")
def settings_(actor: Actor = Depends(current_actor)):
    patient_id = _me(actor)
    user = db.one_doc("SELECT doc FROM users WHERE id=?", (patient_id,))
    return {
        "profile": user or {"id": patient_id, "email": actor.email},
        "permissions": rbac.matrix().get("patient", {}),
        "languages": ["en", "ar"],
    }
