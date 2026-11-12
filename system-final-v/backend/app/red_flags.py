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
_LIMB = r"(?:left\s+|right\s+)?(?:arm|leg|hand|foot)"
_ADVERB = r"(?:very\s+|really\s+|so\s+|suddenly\s+|completely\s+|totally\s+|just\s+)?"

_EN_RULES: list[tuple[str, list[str]]] = [
    ("Chest pain", [
        r"\bchest\s+(?:is\s+|keeps\s+|has\s+been\s+|started\s+)?"
        r"(?:pains?|pressure|tightness|heaviness|discomfort|aches?|aching|hurts?|hurting)\b",
        rf"\b(?:pains?|pressure|tightness|heaviness|discomfort|aches?|squeezing)\s+"
        rf"(?:in|on|across|around|over)\s+{_PRONOUN}chest\b",
        r"\b(?:tight|heavy|crushing)\s+chest\b",
        r"\bchest\s+(?:is|feels)\s+(?:very\s+|really\s+|so\s+)?(?:tight|heavy|sore)\b",
        r"\bheart\s+attack\b",
    ]),
    ("Trouble breathing", [
        r"\bshort(?:ness)?\s+of\s+(?:breath|air)\b",
        r"\bout\s+of\s+breath\b",
        r"\bbreathless(?:ness)?\b",
        r"\b(?:trouble|difficulty|difficulties|problems?|issues?|struggling|struggle|hard\s+time|tough\s+time|hard|difficult)"
        r"\s+(?:with\s+|to\s+|in\s+)?breath(?:e|ing)\b",
        r"\bbreathing\s+(?:trouble|troubles|problems?|issues?|difficulty|difficulties)\b",
        # Up to two filler words ("really", "a bit"), but never a negation:
        # "breathing is not bad today" is reassurance, not a red flag.
        r"\bbreathing\s+(?:is|has\s+been|feels|got|became|is\s+getting)\s+"
        r"(?:(?!(?:not|no|never|hardly|barely|isn't|isnt)\b)\w+\s+){0,2}"
        r"(?:difficult|hard|bad|worse|laboured|labored|shallow)\b",
        rf"\b{_CANNOT}\s+(?:breathe?|(?:catch|get)\s+{_PRONOUN}breath|get\s+(?:enough\s+|any\s+)?air)\b",
        rf"\bstruggling\s+(?:for|to\s+get)\s+(?:air|{_PRONOUN}breath)\b",
        r"\bwheez(?:e|es|ing)\b",
        r"\bgasping\b",
        r"\bchoking\b",
    ]),
    ("Possible stroke signs", [
        r"\bstroke\b",
        rf"\b(?:face|mouth|smile)\s+(?:is\s+|has\s+|went\s+|feels\s+|looks\s+)?{_ADVERB}"
        r"(?:drooping|droopy|drooped|droops|numb|lopsided|crooked|slack|twisted)\b",
        r"\b(?:drooping|droopy)\s+(?:face|mouth|smile)\b",
        r"\bslurr(?:ed|ing)\b",
        r"\bspeech\s+(?:is\s+|has\s+been\s+|sounds\s+)?(?:garbled|strange|weird|gone)\b",
        rf"\b(?:{_CANNOT}|trouble|difficulty)\s+(?:speak|speaking|talk|talking)\b",
        r"\bwords\s+(?:won't|wont|will\s+not|aren't|are\s+not)\s+com(?:e|ing)\s+out\b",
        rf"\bsudden(?:ly)?\s+(?:\w+\s+)?(?:{_WEAK}|confused|confusion)\b",
        rf"\b{_WEAK}\b[^.?!]{{0,30}}\bone\s+side\b",
        rf"\bone\s+side\b[^.?!]{{0,30}}\b(?:{_WEAK}|droop\w*)\b",
        rf"\b(?:half|side)\s+of\s+{_PRONOUN}(?:face|body)\b[^.?!]{{0,30}}\b(?:{_WEAK}|droop\w*)\b",
        rf"\b{_WEAK}\b[^.?!]{{0,30}}\b(?:half|side)\s+of\s+{_PRONOUN}(?:face|body)\b",
        rf"\b{_CANNOT}\s+(?:move|feel|lift|raise)\s+{_PRONOUN}(?:{_LIMB}|face|side)\b",
        rf"\b{_LIMB}\s+(?:is|went|has\s+gone|feels|has\s+become)\s+{_ADVERB}(?:{_WEAK}|dead|limp)\b",
        rf"\b{_WEAK}\s+in\s+{_PRONOUN}(?:{_LIMB}|face)\b",
        rf"\bsudden(?:ly)?\s+(?:{_CANNOT}\s+see|blind|lost\s+{_PRONOUN}(?:vision|sight)|(?:vision|sight)\s+loss|double\s+vision)\b",
        rf"\b(?:lost|losing)\s+{_PRONOUN}(?:vision|sight)\b",
        r"\b(?:worst|thunderclap)\s+headache\b",
        r"\bsudden\s+(?:severe|bad|terrible)\s+headache\b",
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

_EN_STRONG_NEG = (r"(?:\bno|\bwithout|\bdenies|\bdenied|\bdeny|\bdon't\s+have|\bdont\s+have|\bdo\s+not\s+have"
                  r"|\bhaven't\s+had|\bhave\s+not\s+had|\bnever\s+had|\bnot\s+having|\bhas\s+no|\bhave\s+no)")
_ARTICLE = r"(?:any\s+|a\s+|an\s+)?"
_EN_NEGATED = re.compile(
    # "no chest pain", "never had a stroke", "I am not short of breath"
    rf"(?:{_EN_STRONG_NEG}|\bnot)\s+{_ARTICLE}$"
    # "no chest pain or shortness of breath": a strong negation carries across
    # or/nor over at most three words. Never across "idea/sure/whether/if", so
    # "no idea if it's heartburn or chest pain" still raises the flag.
    rf"|{_EN_STRONG_NEG}\s+{_ARTICLE}"
    r"(?:(?!(?:idea|sure|clue|if|whether|know|but|now|then)\b)[a-z']+\s+){1,3}(?:or|nor)\s+" + _ARTICLE + "$"
)

# Arabic patterns are written against `_normalise_ar` output: no diacritics,
# one alef, ى as ي and ة as ه — people type all of these variants.
_AR_CANNOT = r"(?:لا\s+استطيع|لا\s+اقدر|ما\s+اقدر|ماقدر|مو\s+قادر|ما\s+قادر|ما\s+استطيع)"

_AR_RULES: list[tuple[str, list[str]]] = [
    ("Chest pain", [
        r"(?:الم|وجع|ضغط|ضيق|ضيقه|كتمه|ثقل)\s+(?:في\s+|ب)?(?:ال)?صدر",
        r"صدري\s+(?:يوجعني|يالمني|ضايق|ضيق|مكتوم)",
        r"يوجعني\s+صدري",
        r"(?:نوبه|جلطه|ازمه)\s+قلبيه",
    ]),
    ("Trouble breathing", [
        r"(?:ضيق|ضيقه)\s+(?:في\s+|ب)?(?:ال)?(?:تنفس|نفس)",
        r"صعوبه\s+(?:في\s+|ب)?(?:ال)?تنفس",
        rf"{_AR_CANNOT}\s+(?:ان\s+)?(?:ا)?تنفس",
        r"نفسي\s+(?:ضايق|ضيق|مقطوع|يضيق)",
        r"اختناق",
    ]),
    ("Possible stroke signs", [
        r"جلطه",
        r"سكته\s+دماغيه",
        r"(?:تدلي|ارتخاء|ميلان)\s+(?:في\s+|ب)?(?:ال)?(?:وجه|فم)",
        r"(?:وجهي|فمي)\s+(?:مايل|مائل|معوج|متدلي|مرتخي|منمل|خدران)",
        r"(?:خدر|تنميل|ضعف|شلل)\s+(?:في\s+|ب)?(?:ال)?(?:جانب|جهه|نصف|طرف|وجه|يد|ذراع|رجل|ساق)",
        r"صعوبه\s+(?:في\s+|ب)?(?:ال)?(?:كلام|نطق)",
        rf"{_AR_CANNOT}\s+(?:ان\s+)?(?:ا)?(?:تكلم|نطق)",
        rf"{_AR_CANNOT}\s+(?:ان\s+)?(?:ا)?حرك",
        r"ثقل\s+(?:في\s+|ب)?(?:ال)?لسان",
        r"(?:لساني|كلامي)\s+ثقيل",
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
