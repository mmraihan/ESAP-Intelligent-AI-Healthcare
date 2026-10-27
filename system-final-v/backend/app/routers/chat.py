"""Conversational intake assistant (§4). Any signed-in user — clinician, patient
or caregiver — can enter intake data by chatting instead of filling the form.

The route is deterministic first: every message is parsed by ``chat_extract`` so
data entry works with the LLM down. When the LLM is reachable it writes a natural,
role-appropriate reply and may enrich a few safe scalar fields — it never invents a
diagnosis code (those come only from the gated lexicon and are marked
needs_confirmation). Running an assessment from the captured draft stays gated by
``assess:run``, so a patient can describe their history but cannot score it.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .. import chat_extract, llm, rbac
from ..deps import Actor, current_actor

router = APIRouter(tags=["chat"])


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatTurn(Strict):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(Strict):
    message: str = Field(min_length=1, max_length=4000)
    draft: dict = Field(default_factory=dict)
    history: list[ChatTurn] = Field(default_factory=list, max_length=40)


ESSENTIALS = [
    ("features.demographics.admission_age", "the patient's age", "how old you are"),
    ("features.demographics.is_female", "the patient's recorded sex", "your sex"),
]


def _get(d: dict, path: str):
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _missing(draft: dict, patient_voice: bool) -> list[str]:
    out = []
    for path, clinical, lay in ESSENTIALS:
        if _get(draft, path) is None:
            out.append(lay if patient_voice else clinical)
    return out


def _llm_reply(message: str, captured: list[str], missing: list[str], patient_voice: bool) -> str | None:
    if not llm.available():
        return None
    who = ("a patient or caregiver, so use plain, warm, non-technical language and never quote a risk score"
           if patient_voice else "a clinician, so be concise and use clinical shorthand")
    system = (
        "You are ESAP's intake assistant. You help enter admission information by conversation. "
        f"You are talking to {who}. Keep the reply to 1-3 short sentences. "
        "Acknowledge what was just captured, then ask ONE clear next question for a missing item. "
        "Never provide a diagnosis or a risk number; you only collect information. No markdown headers."
    )
    ctx = ("Captured so far this message: " + ("; ".join(captured) if captured else "nothing new") + ". "
           + ("Still needed: " + ", ".join(missing) + "." if missing else "All essentials are present."))
    try:
        return llm.chat([
            {"role": "system", "content": system},
            {"role": "user", "content": f"{ctx}\n\nUser said: {message}"},
        ]).strip() or None
    except llm.LLMError:
        return None


def _template_reply(captured: list[str], missing: list[str], patient_voice: bool, ready: bool) -> str:
    bits = []
    if captured:
        bits.append(("Got it — I noted " if patient_voice else "Captured: ") + "; ".join(captured) + ".")
    elif not ready:
        bits.append("I couldn't pick anything out of that yet." if patient_voice
                    else "No structured fields found in that message.")
    if missing:
        q = missing[0]
        bits.append((f"Could you tell me {q}?" if patient_voice else f"Please provide {q}."))
    elif ready:
        bits.append("That's the essentials captured. You can add symptoms, home medications, or history, "
                    "or run the assessment when you're ready."
                    if not patient_voice else
                    "Thanks — I have the basics. You can keep adding anything else about how you're feeling.")
    return " ".join(bits) or "Tell me about the patient — age, sex, and what brought them in."


@router.post("/chat")
def chat(body: ChatRequest, actor: Actor = Depends(current_actor)):
    patient_voice = actor.role in {"patient", "guest"}

    result = chat_extract.extract(body.message)
    draft = chat_extract.merge(body.draft or {}, result["delta"])
    captured = list(result["captured"])
    needs = set(result["needs_confirmation"])

    # Optional LLM enrichment of SAFE scalar fields only (never codes/labs), so a
    # phrasing the lexicon missed still lands. Deterministic values always win.
    if llm.available():
        try:
            safe = llm.extract_json(
                body.message,
                instructions=("Extract ONLY these if explicitly stated: admission_age (int), "
                              "is_female (1 female / 0 male), bp_sys, bp_dia, weight_kg (numbers), "
                              "chief_complaint (short string). Omit anything not stated, or use null. "
                              "No diagnoses."),
                # null, not 0, for age and sex: with a 0 in the hint the model echoed
                # is_female=0 for messages that never said the patient's sex.
                schema_hint={"admission_age": None, "is_female": None, "bp_sys": 0, "bp_dia": 0,
                             "weight_kg": 0.0, "chief_complaint": ""},
            )
            demo = draft.setdefault("features", {}).setdefault("demographics", {})
            age = safe.get("admission_age")
            if isinstance(age, int) and not isinstance(age, bool) and age > 0 and "admission_age" not in demo:
                demo["admission_age"] = max(0, min(120, safe["admission_age"])); captured.append("Age (assistant)")
            if safe.get("is_female") in (0, 1) and "is_female" not in demo:
                demo["is_female"] = safe["is_female"]; captured.append("Sex (assistant)")
            vit = draft["features"].setdefault("vitals", {})
            # The schema hint's zeros invite the model to echo 0 for "not stated";
            # a 0 kg weight or 0 mmHg pressure is never a real reading.
            for k in ("bp_sys", "bp_dia", "weight_kg"):
                v = safe.get(k)
                if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0 and k not in vit:
                    vit[k] = safe[k]
            cc = safe.get("chief_complaint")
            if isinstance(cc, str) and cc.strip() and not _get(draft, "features.notes"):
                draft["features"].setdefault("notes", {})["chief_complaint"] = cc.strip()[:300]
        except llm.LLMError:
            pass

    missing = _missing(draft, patient_voice)
    ready = not missing  # age + sex present

    reply = _llm_reply(body.message, captured, missing, patient_voice) \
        or _template_reply(captured, missing, patient_voice, ready)

    return {
        "reply": reply,
        "draft": draft,
        "captured": captured,
        "needs_confirmation": sorted(needs),
        "ready": ready,
        "can_run_assessment": ready and rbac.can(actor.role, "assess:run"),
        "llm_used": llm.available(),
    }
