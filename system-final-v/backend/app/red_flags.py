"""Emergency red-flag screening for what a patient types.

The intake form has always warned about chest pain and breathing trouble; the
assistant did not, so the same symptoms got a safety message on one path and a
"could you tell me your sex?" on the other. This screen runs on every patient
message and every submitted symptom form.

It is a rule list on purpose. It has to work when the language model is down,
answer the same way every time, and be readable by the clinician who reviews it.
When in doubt it warns: only a directly negated phrase ("no chest pain") is
skipped, because a needless emergency message costs far less than a missed one.

It decides whether to show safety advice and nothing else. It is not a triage
score, and it never reaches a model or a patient's record as a finding.
"""

from __future__ import annotations

import re

#: The wording the form shows too. `test_qa_p1.py` holds the two copies together.
EMERGENCY_MESSAGE = (
    "Chest pain, trouble breathing or signs of a stroke that are happening right now need "
    "someone to look at you straight away. Press your call bell, or if you are at home, call "
    "emergency services on 997. You can come back to this afterwards."
)
EMERGENCY_MESSAGE_AR = (
    "ألم الصدر أو صعوبة التنفس أو علامات السكتة الدماغية التي تحدث الآن تحتاج إلى من يفحصك فورًا. "
    "اضغط زر الاستدعاء، وإذا كنت في المنزل فاتصل بالإسعاف على الرقم 997. يمكنك العودة إلى هذا لاحقًا."
)

_NO_ANSWER = (
    "I can't tell you what is causing this or give you a risk score. "
    "Only a clinician who can examine you can do that."
)
_NO_ANSWER_AR = "لا يمكنني أن أخبرك بسبب ما تشعر به أو أن أعطيك درجة خطورة، فهذا يحتاج إلى طبيب يفحصك."
_NOTED_AR = "لقد دوّنت ما ذكرته."

_PRONOUN = r"(?:my\s+|the\s+|his\s+|her\s+|their\s+)?"
_CANNOT = r"(?:can't|cant|cannot|can\s+not|couldn't|unable\s+to)"
_WEAK = r"(?:numb|numbness|weak|weakness|paraly[sz]ed|paralysis)"

_EN_RULES: list[tuple[str, list[str]]] = [
    ("Chest pain", [
        r"\bchest\s+(?:pains?|pressure|tightness|discomfort|aches?|hurts?|hurting)\b",
        rf"\b(?:pain|pressure|tightness|discomfort|ache)\s+in\s+{_PRONOUN}chest\b",
        r"\b(?:tight|heavy|crushing)\s+chest\b",
        r"\bchest\s+(?:is|feels)\s+(?:very\s+|really\s+|so\s+)?(?:tight|heavy|sore)\b",
        r"\bheart\s+attack\b",
    ]),
    ("Trouble breathing", [
        r"\bshort(?:ness)?\s+of\s+breath\b",
        r"\bout\s+of\s+breath\b",
        r"\bbreathless(?:ness)?\b",
        r"\b(?:trouble|difficulty|problems?|struggling|hard|difficult)\s+(?:with\s+|to\s+|in\s+)?breath(?:e|ing)\b",
        rf"\b{_CANNOT}\s+(?:breathe?|catch\s+{_PRONOUN}breath)\b",
        r"\bgasping\b",
        r"\bchoking\b",
    ]),
    ("Possible stroke signs", [
        r"\bstroke\b",
        r"\b(?:face|mouth|smile)\s+(?:is\s+|has\s+)?(?:drooping|droopy|drooped|droops)\b",
        r"\b(?:drooping|droopy)\s+(?:face|mouth|smile)\b",
        r"\bslurr(?:ed|ing)\b",
        rf"\b(?:{_CANNOT}|trouble|difficulty)\s+(?:speak|speaking|talk|talking)\b",
        rf"\bsudden(?:ly)?\s+(?:\w+\s+)?(?:{_WEAK}|confused|confusion)\b",
        rf"\b{_WEAK}\b[^.?!]{{0,30}}\bone\s+side\b",
        rf"\bone\s+side\b[^.?!]{{0,30}}\b(?:{_WEAK}|droop\w*)\b",
    ]),
]

#: Recorded alongside a red flag. Not emergencies on their own, so never a trigger.
_EN_ASSOCIATED: list[tuple[str, list[str]]] = [
    ("Arm pain", [
        r"\barms?\s+(?:pains?|hurts?|hurting|aches?|aching)\b",
        rf"\bpain\s+(?:in|down)\s+{_PRONOUN}(?:left\s+|right\s+)?arm\b",
    ]),
    ("Jaw pain", [
        r"\bjaw\s+(?:pains?|hurts?|hurting|aches?|aching)\b",
        rf"\bpain\s+in\s+{_PRONOUN}jaw\b",
    ]),
]

_EN_NEGATED = re.compile(
    r"(?:\bno|\bwithout|\bdenies|\bdeny|\bdon't\s+have|\bdont\s+have|\bdo\s+not\s+have"
    r"|\bhaven't\s+had|\bhave\s+not\s+had|\bnever\s+had|\bnot\s+having)\s+(?:any\s+)?$"
)

# Arabic patterns are written against `_normalise_ar` output: no diacritics,
# one alef, ى as ي and ة as ه — people type all of these variants.
_AR_RULES: list[tuple[str, list[str]]] = [
    ("Chest pain", [
        r"(?:الم|وجع|ضغط|ضيق)\s+(?:في\s+|ب)?(?:ال)?صدر",
        r"(?:نوبه|جلطه|ازمه)\s+قلبيه",
    ]),
    ("Trouble breathing", [
        r"ضيق\s+(?:في\s+)?(?:ال)?(?:تنفس|نفس)",
        r"صعوبه\s+(?:في\s+)?(?:ال)?تنفس",
        r"(?:لا\s+استطيع|ما\s+اقدر|مو\s+قادر|ما\s+قادر)\s+(?:ان\s+)?(?:ا)?تنفس",
        r"اختناق",
    ]),
    ("Possible stroke signs", [
        r"جلطه",
        r"سكته\s+دماغيه",
        r"(?:تدلي|ارتخاء|ميلان)\s+(?:في\s+)?(?:ال)?(?:وجه|فم)",
        r"(?:خدر|تنميل|ضعف|شلل)\s+(?:في\s+)?(?:جانب|جهه|نصف|طرف)",
        r"صعوبه\s+(?:في\s+)?(?:ال)?(?:كلام|نطق)",
        r"ثقل\s+(?:في\s+)?(?:ال)?لسان",
    ]),
]

_AR_ASSOCIATED: list[tuple[str, list[str]]] = [
    ("Arm pain", [r"(?:الم|وجع)\s+(?:في\s+|ب)?(?:ال)?(?:ذراع|يد)"]),
    ("Jaw pain", [r"(?:الم|وجع)\s+(?:في\s+|ب)?(?:ال)?فك"]),
]

_AR_NEGATED = re.compile(r"(?:لا\s+يوجد|ليس\s+لدي|بدون|ما\s+عندي|مافي|لا\s+اعاني\s+من)\s+$")

_ARABIC_SCRIPT = re.compile(r"[؀-ۿ]")


def _normalise_ar(text: str) -> str:
    text = re.sub(r"[ً-ْ]", "", text)
    return text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه")


def _hits(text: str, rules: list[tuple[str, list[str]]], negated: re.Pattern | None) -> list[str]:
    found: list[str] = []
    for label, patterns in rules:
        for pattern in patterns:
            if any(negated is None or not negated.search(text[:m.start()])
                   for m in re.finditer(pattern, text)):
                found.append(label)
                break
    return found


def screen(text: str) -> list[str]:
    """Labels for what this message raises, or an empty list if nothing does.

    Associated symptoms are included only when a red flag fired, so they are
    captured with it rather than triggering the message themselves.
    """
    english = text.replace("’", "'").lower()
    arabic = _normalise_ar(text)
    flags = list(dict.fromkeys(_hits(english, _EN_RULES, _EN_NEGATED) + _hits(arabic, _AR_RULES, _AR_NEGATED)))
    if not flags:
        return []
    return flags + [a for a in dict.fromkeys(_hits(english, _EN_ASSOCIATED, _EN_NEGATED)
                                             + _hits(arabic, _AR_ASSOCIATED, _AR_NEGATED)) if a not in flags]


def reply(message: str, captured: list[str], lang: str | None) -> str:
    """The full assistant reply. No model writes any part of this."""
    if lang == "ar" or _ARABIC_SCRIPT.search(message):
        return f"{EMERGENCY_MESSAGE_AR} {_NO_ANSWER_AR} {_NOTED_AR}"
    return f"{EMERGENCY_MESSAGE} {_NO_ANSWER} I noted: {'; '.join(captured)}."
