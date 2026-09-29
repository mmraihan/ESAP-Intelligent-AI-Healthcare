"""Clinical workspace, part three: the shift handoff and the assessment chat.

Both used to live only in the browser. The handoff "sent" by calling the PHI
export endpoint, which a charge nurse may not use, and then reported success
anyway; the chat answered from fixed templates that named drivers the model had
not produced. Each now has a server behind it.

* **Handoffs** are a hand-over inside the care team, not an export. They are
  stored against the unit and read back by whoever takes the next shift.
* **Ask** answers only from the stored assessment for this encounter — the
  probabilities, percentiles, drivers and caveats the models returned. It has
  no language model and no knowledge of its own, so every sentence it returns
  can be traced to a field on the response it cites.
"""

from __future__ import annotations

import json
import re
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import audit, db, rbac
from ..catalogs import ccsr_name
from ..deps import Actor, current_actor, display_name, tenant_scope
from ..errors import ApiError
from ..security import iso, utcnow
from .clinical import _encounter_or_404, _in_scope, scope_encounters

router = APIRouter(tags=["clinical"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HandoffRequest(Strict):
    unit_id: str = Field(min_length=1, max_length=64)
    #: encounter id -> the outgoing nurse's note. Blank notes are allowed.
    notes: dict[str, str] = Field(default_factory=dict)
    #: Encounters on the watch list the outgoing nurse confirmed have a plan.
    checked: list[str] = Field(default_factory=list)
    summary: str | None = Field(None, max_length=2000)


class AskRequest(Strict):
    question: str = Field(min_length=1, max_length=500)


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _visible(actor: Actor, tenant_id: str) -> list[dict]:
    grade = rbac.grade(actor.role, "patient:read")
    return scope_encounters(actor, db.docs("SELECT doc FROM encounters WHERE tenant_id=?", (tenant_id,)), grade)


# --- handoffs -----------------------------------------------------------------


@router.post("/handoffs", status_code=201)
def send_handoff(
    body: HandoffRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """File the outgoing shift's account of a unit for the incoming shift.

    The snapshot is taken server-side from the encounters this caller can see,
    so the handoff cannot name a patient the sender could not read. A note
    against an encounter outside that set is refused rather than dropped: a
    hand-over that silently lost a patient's note is worse than one that failed.
    """
    rbac.require(actor, "roster:view")
    rbac.require(actor, "patient:read")
    on_unit = [e for e in _visible(actor, tenant_id)
               if e.get("unitId") == body.unit_id and e.get("state") != "closed"]
    if not on_unit:
        raise ApiError(403, "You have no patients on that unit to hand over.")
    ids = {e["id"] for e in on_unit}
    stray = sorted((set(body.notes) | set(body.checked)) - ids)
    if stray:
        raise ApiError(403, "The handoff names a patient who is not on this unit or not in your scope.",
                       detail={"encounters": stray})

    patients = []
    for e in sorted(on_unit, key=lambda e: -(e["risks"].get("icu") or 0)):
        note = (body.notes.get(e["id"]) or "").strip()
        patients.append({
            "encounterId": e["id"], "name": e["patient"]["name"], "mrn": e["patient"]["mrn"],
            "bed": e.get("bed", ""), "chiefComplaint": e.get("chiefComplaint", ""),
            "note": note or "No concerns raised at handoff.", "noteWritten": bool(note),
            "planConfirmed": e["id"] in body.checked,
            "risks": {k: e["risks"].get(k) for k in ("icu", "mortality", "readmission", "losLow", "losHigh")},
        })

    doc = {
        "id": f"ho_{uuid.uuid4().hex[:10]}", "unitId": body.unit_id,
        "unitName": on_unit[0].get("unitName", body.unit_id),
        "sentAt": iso(utcnow()), "sentBy": display_name(actor), "sentByEmail": actor.email,
        "summary": (body.summary or "").strip() or None, "patients": patients,
        "notesWritten": sum(p["noteWritten"] for p in patients),
    }
    db.insert_doc("handoffs", doc, {"tenant_id": tenant_id, "unit_id": body.unit_id,
                                    "created_at": doc["sentAt"]})
    audit.record(actor, "handoff.send", f"{doc['unitName']} · {len(patients)} patients",
                 tenant_id=tenant_id, ip=_ip(request))
    return doc


@router.get("/handoffs")
def list_handoffs(
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
    unit_id: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Recent handoffs for the units this caller can see, newest first."""
    rbac.require(actor, "roster:view")
    rbac.require(actor, "patient:read")
    units = {e.get("unitId") for e in _visible(actor, tenant_id)}
    sql, params = "SELECT doc FROM handoffs WHERE tenant_id=?", [tenant_id]
    if unit_id:
        sql += " AND unit_id=?"
        params.append(unit_id)
    rows = db.docs(sql + " ORDER BY created_at DESC LIMIT 200", params)
    return {"handoffs": [h for h in rows if h["unitId"] in units][:limit]}


# --- ask ----------------------------------------------------------------------

OUTCOMES = {
    "mortality": ("M-02", "In-hospital mortality", "death during this admission, not survival after discharge"),
    "icu": ("M-03", "ICU admission", "an ICU stay at any point in the admission, not that transfer is imminent"),
    "readmission": ("M-04", "30-day readmission", "return within 30 days, estimated at intake rather than at discharge"),
}

INTENTS: list[tuple[str, re.Pattern]] = [
    ("mortality", re.compile(r"mortal|death|\bdie|dying|surviv", re.I)),
    ("icu", re.compile(r"\bicu\b|intensive|critical care", re.I)),
    ("readmission", re.compile(r"readmi|come back|return|30.?day", re.I)),
    ("los", re.compile(r"length|\blos\b|how long|stay|discharge|days", re.I)),
    ("differential", re.compile(r"diagnos|differential|condition|ccsr|disease", re.I)),
    ("calibration", re.compile(r"calibrat|trust|reliab|\bece\b|accura", re.I)),
    ("coverage", re.compile(r"missing|input|complete|signal|imput|data", re.I)),
]


def _pct(p: float | None) -> str:
    return "—" if p is None else f"{p * 100:.0f}%"


def _drivers(explanation: dict | None, n: int = 3) -> str | None:
    if not explanation or not explanation.get("top_contributors"):
        return None
    parts = []
    for c in explanation["top_contributors"][:n]:
        verb = "raises" if c["direction"] == "increases" else "lowers"
        tag = " (imputed)" if c.get("from_missing") else ""
        parts.append(f"{c['human_label']} = {c['value_display']}{tag} {verb} it")
    return "; ".join(parts)


def _outcome(resp: dict, key: str) -> tuple[str, str]:
    model_id, label, covers = OUTCOMES[key]
    out = resp.get(key) or {}
    source = f"{label} · {model_id}"
    result = out.get("result")
    if not result:
        why = out.get("error") or out.get("reason") or "no result was returned"
        return f"{model_id} produced no estimate for this admission: {why}.", source
    text = (f"The {label.lower()} estimate is {_pct(result['probability'])}, around the "
            f"{result['population_percentile']}th percentile of admissions. It covers {covers}.")
    drivers = _drivers(out.get("explanation"))
    if drivers:
        method = (out.get("explanation") or {}).get("method", "")
        text += f" What moved it most ({method}): {drivers}."
    if key == "readmission" and result.get("top_decile_flag"):
        text += " It is in the top decile, which is the alert budget for this model."
    if out.get("status") == "degraded":
        text += f" {model_id} is serving degraded — {out.get('reason') or 'see the model card'}."
    elif out.get("status") == "stub":
        text += " This came from the stub model, not the trained one."
    return text, source


def _los(resp: dict) -> tuple[str, str]:
    out = resp.get("los") or {}
    r = out.get("result")
    if not r:
        return f"M-05 produced no length-of-stay estimate: {out.get('error') or out.get('reason') or 'no result'}.", "Length of stay · M-05"
    text = (f"The length-of-stay estimate is {r['interval_low']:.1f}–{r['interval_high']:.1f} days at the "
            f"{r['level'] * 100:.0f}% level (measured coverage {r['coverage'] * 100:.0f}%). The interval is the "
            "estimate; quoting the midpoint alone overstates the precision.")
    if r.get("tail_coverage_reduced"):
        text += " Coverage is reduced in the long-stay tail, so the upper end may be too short."
    if r.get("low_signal"):
        text += " The intake is thin, so the interval is wider than usual."
    return text, "Length of stay · M-05"


def _differential(resp: dict) -> tuple[str, str]:
    out = resp.get("differential") or {}
    r = out.get("result") or {}
    items = r.get("items") or []
    if not items:
        return "M-01 returned no differential for this admission.", "Differential · M-01"
    top = ", ".join(f"{ccsr_name(i['ccsr'])} {_pct(i['probability'])}" for i in items[:5])
    text = (f"The highest-ranked conditions likely present at admission are: {top}. These are "
            "concurrent conditions, not predictions of what will develop.")
    unconfirmed = [ccsr_name(i["ccsr"]) for i in items if i.get("from_unconfirmed_extraction")]
    if unconfirmed:
        text += f" Unconfirmed extracted history touched: {', '.join(unconfirmed[:3])}."
    if r.get("fusion_status") == "tower_a_only":
        text += " Only the tabular tower (A) contributed; the note and history towers are not fused yet."
    return text, "Differential · M-01"


def _calibration(resp: dict) -> tuple[str, str]:
    cov = resp.get("feature_coverage") or {}
    cards = {m["id"]: m for m in (db.document("models") or [])}
    if cov.get("calibration_validity") == "reduced":
        text = ("Calibration is reduced for this case: required inputs were imputed. The ranking is "
                "still usable; the absolute probabilities are not.")
    else:
        text = "This case has full calibration validity."
    eces = [f"{mid} {cards[mid]['ece']:.3f}" for mid in ("M-02", "M-03", "M-04")
            if mid in cards and isinstance(cards[mid].get("ece"), (int, float))]
    if eces:
        text += f" Expected calibration error from the model registry: {', '.join(eces)}."
    return text, "Calibration badge · model registry"


def _coverage(resp: dict) -> tuple[str, str]:
    cov = resp.get("feature_coverage") or {}
    have = [n for k, n in (("has_vitals", "vitals"), ("has_labs", "early labs"),
                           ("has_prior_history", "prior history"), ("has_notes", "an admission note")) if cov.get(k)]
    lack = [n for k, n in (("has_vitals", "vitals"), ("has_labs", "early labs"),
                           ("has_prior_history", "prior history"), ("has_notes", "an admission note")) if not cov.get(k)]
    text = (f"The models received {', '.join(have) or 'demographics and admission context only'}"
            f" ({cov.get('n_labs_present', 0)} labs, {cov.get('n_prior_ccsr', 0)} prior conditions).")
    if lack:
        text += f" Missing: {', '.join(lack)}."
    if not cov.get("has_prior_history"):
        text += " With no coded prior history this is a cold-start patient, and M-01 and M-04 are materially weaker."
    warnings = resp.get("warnings") or []
    if warnings:
        text += f" Warnings on this run: {'; '.join(warnings[:3])}."
    return text, "Signal completeness"


def _answer(question: str, resp: dict) -> list[tuple[str, str]]:
    hits = [name for name, rx in INTENTS if rx.search(question)]
    if not hits and re.search(r"why|driver|because|reason|explain", question, re.I):
        hits = ["mortality", "icu", "readmission"]
    if not hits:
        hits = ["mortality", "icu", "readmission", "los"]
    parts = []
    for name in hits[:4]:
        if name in OUTCOMES:
            parts.append(_outcome(resp, name))
        else:
            parts.append({"los": _los, "differential": _differential,
                          "calibration": _calibration, "coverage": _coverage}[name](resp))
    return parts


@router.post("/encounters/{encounter_id}/ask")
def ask(
    encounter_id: str,
    body: AskRequest,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Answer a question about this encounter's latest assessment, from it alone.

    A patient is refused: the portal shows the clinician's released summary,
    and a raw score must never reach a patient (§13.6), however it is asked for.
    """
    if actor.role == "patient":
        raise ApiError(403, "The assessment chat is for the care team. Your released summary is under Results.")
    rbac.require(actor, "chat:use")
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)

    row = db.connect().execute(
        "SELECT id, created_at, response FROM assessments WHERE encounter_id=?"
        " ORDER BY created_at DESC LIMIT 1", (encounter_id,)).fetchone()
    if row is None:
        return {"answer": "No assessment has run on this encounter yet, so there is nothing to explain. "
                          "Complete the intake and run the assessment first.",
                "sources": [], "assessment_id": None, "grounded": True}

    parts = _answer(body.question, json.loads(row["response"]))
    audit.record(actor, "explanation.view", f"{enc['patient']['mrn']} · {encounter_id} · ask",
                 tenant_id=tenant_id, ip=_ip(request))
    return {
        "answer": " ".join(text for text, _ in parts),
        "sources": [src for _, src in parts],
        "assessment_id": row["id"],
        "assessed_at": row["created_at"],
        "grounded": True,
    }


# --- what the patient sent ----------------------------------------------------


#: Roles that care for patients. Everyone else with patient:read (the QI
#: auditor, platform staff under break-glass) reads, but does not respond.
CARE_ROLES = {"physician", "resident", "np_pa", "charge_nurse", "staff_nurse",
              "case_manager", "pharmacist"}


def _portal_id(enc: dict) -> str:
    """The portal account that speaks for this encounter's patient.

    The same link `release` uses in the other direction: what a clinician
    releases lands in this portal, and what this portal sends lands here.
    """
    patient_id = enc["patient"]["id"]
    return (db.document("portal_links") or {}).get(patient_id, patient_id)


@router.get("/encounters/{encounter_id}/patient-submissions")
def patient_submissions(
    encounter_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Symptom reports and pre-visit summaries the patient sent from the portal.

    Read-only context for the care team. None of it is ever scored: it is the
    patient's own wording, sent after t0, and unreviewed — a reason to look,
    not a model input. The clinician decides whether anything in it belongs on
    the intake.
    """
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    portal = _portal_id(enc)
    submissions = list(db.document(f"patient_submissions:{portal}") or [])
    submissions.extend(_patient_messages(portal))
    submissions.sort(key=lambda s: s.get("submittedAt", ""), reverse=True)
    audit.record(actor, "patient.read", f"{enc['patient']['mrn']} · patient submissions",
                 tenant_id=tenant_id, ip=_ip(request))
    return {"submissions": submissions, "portal_linked": portal != enc["patient"]["id"]}


#: Message-style requests a patient raises that are clinical context for the
#: treating team — as opposed to admin tasks like a records request. These are
#: surfaced to the care team here AND stay in the admin queue for triage.
_PATIENT_MESSAGE_KINDS = (
    "care_team_message", "result_question", "result_explain_request", "result_urgent_flag",
)

_MESSAGE_LABEL = {
    "care_team_message": "Message to the care team",
    "result_question": "Question about a result",
    "result_explain_request": "Asked a nurse to explain a result",
    "result_urgent_flag": "Flagged a result as urgent",
}


def _patient_messages(portal_user_id: str) -> list[dict]:
    """The patient's care-team messages/questions, shaped like a submission.

    Care-team messages land in `service_requests` (keyed by the requester's
    email); the "From the patient" panel is keyed by the portal user id. Map one
    to the other so a message a patient addresses to their clinician actually
    reaches that clinician, not only the admin queue.
    """
    puser = db.one_doc("SELECT doc FROM users WHERE id=?", (portal_user_id,))
    email = (puser or {}).get("email")
    if not email:
        return []
    placeholders = ",".join("?" for _ in _PATIENT_MESSAGE_KINDS)
    rows = db.docs(
        f"SELECT doc FROM service_requests WHERE requester=? AND kind IN ({placeholders})",
        (email, *_PATIENT_MESSAGE_KINDS),
    )
    out: list[dict] = []
    for r in rows:
        out.append({
            "id": r["id"],
            "kind": "message",
            "messageKind": r.get("kind"),
            "messageLabel": _MESSAGE_LABEL.get(r.get("kind", ""), r.get("label", "Message")),
            "submittedAt": r.get("requestedAt"),
            "describe": r.get("detail"),
            "ref": r.get("ref"),
            "urgent": bool(r.get("urgent")),
            "requestStatus": r.get("status", "open"),
        })
    return out


@router.post("/encounters/{encounter_id}/patient-submissions/{submission_id}/seen")
def mark_submission_seen(
    encounter_id: str,
    submission_id: str,
    request: Request,
    actor: Actor = Depends(current_actor),
    tenant_id: str = Depends(tenant_scope),
):
    """Record that a named clinician read it, so the patient sees more than "Sent".

    Idempotent: the first reader is kept. "Seen" is a statement about who
    picked it up, and a later reader does not change that. Only someone caring
    for the patient can say it: a QI auditor may read the record, but "Seen by"
    an auditor would tell the patient their care team had looked when it had not.
    """
    if actor.role not in CARE_ROLES:
        raise ApiError(403, "Only a member of the care team can mark a patient's message as seen.")
    grade = rbac.require(actor, "patient:read")
    enc = _in_scope(actor, _encounter_or_404(encounter_id, tenant_id), grade)
    key = f"patient_submissions:{_portal_id(enc)}"
    submissions = db.document(key) or []
    target = next((s for s in submissions if s["id"] == submission_id), None)
    if target is None:
        raise ApiError(404, "No such submission for this patient.")
    if not target.get("seenAt"):
        target.update({"seenAt": iso(utcnow()), "seenBy": display_name(actor),
                       "seenByRole": rbac.roles().get(actor.role, {}).get("label", actor.role)})
        db.put_document(key, submissions)
        audit.record(actor, "patient.submission_seen", f"{enc['patient']['mrn']} · {submission_id}",
                     tenant_id=tenant_id, ip=_ip(request))
    return target
