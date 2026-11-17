"""The system emails ESAP sends, one function each, in English or Arabic.

All of them go out from no-reply@ through `mailer.send`. Account mail asks for
replies at the support address (care@esap.ai); payment mail asks for them at
the billing address (billing@esap.ai). Links point at ESAP_PUBLIC_URL, the
website, never the API. No clinical content ever goes into these messages.

`lang` is "en" or "ar": the language the person was using on the website when
the email was triggered, or the one saved on their account. Staff invitations
stay English, like the clinical consoles they lead to.

Every function is safe to call from a background task: it never raises, so a
mail server outage cannot undo the action that triggered the email.

The Arabic is a machine-assisted draft, like the website's (i18n/ar-site.ts),
and needs review by a native speaker before launch.
"""

from __future__ import annotations

import logging

from . import mailer
from .config import settings

log = logging.getLogger("esap.mail")


def _safe(fn):
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception:  # noqa: BLE001 - an email must never break the request that sent it
            log.exception("could not build or send %s", fn.__name__)
            return None
    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


def lang_of(value: str | None) -> str:
    return "ar" if (value or "").strip().lower() == "ar" else "en"


def _hello(name: str | None, lang: str) -> str:
    name = (name or "").strip()
    if lang == "ar":
        return f"مرحبًا {name}،\n\n" if name else "مرحبًا،\n\n"
    return f"Hello {name},\n\n" if name else "Hello,\n\n"


def _money(amount_usd: float | None) -> str:
    return f"US${amount_usd:,.2f}" if amount_usd is not None else "—"


# --- account -------------------------------------------------------------------


@_safe
def signup_confirmation(email: str, name: str | None, role_label: str, patient: bool,
                        verify_link: str, lang: str = "en") -> dict:
    """Sent once an account has been created from the sign-up page. Carries the
    link that confirms the address belongs to the person who signed up."""
    url = settings().public_url
    hours = VERIFY_TTL_HOURS
    if lang == "ar":
        where = (f"بوابة المريض: {url}/patient/home" if patient
                 else f"سجّل الدخول لبدء تقييم: {url}/login")
        plan = "" if patient else "\nحسابك على الخطة المجانية، ويمكنك الترقية من صفحة الأسعار في أي وقت.\n"
        body = (_hello(name, lang)
                + f"تم إنشاء حسابك في ESAP Clinical AI للعنوان {email}.\n"
                + plan
                + f"\nأكّد بريدك الإلكتروني من هذا الرابط (يعمل لمدة {hours} ساعة):\n{verify_link}\n\n"
                + f"{where}\n\n"
                "إذا لم تنشئ هذا الحساب، راسلنا وسنغلقه.")
        subject = "حسابك في ESAP Clinical AI جاهز — أكّد بريدك الإلكتروني"
    else:
        where = (f"Your patient portal: {url}/patient/home" if patient
                 else f"Sign in to start an assessment: {url}/login")
        plan = "" if patient else "\nYour account is on the Free plan. You can upgrade on the pricing page at any time.\n"
        body = (_hello(name, lang)
                + f"Your ESAP Clinical AI account has been created for {email} ({role_label}).\n"
                + plan
                + f"\nPlease confirm your email address (the link works for {hours} hours):\n{verify_link}\n\n"
                + f"{where}\n\n"
                "If you did not sign up, write to us and we will close the account.")
        subject = "Your ESAP Clinical AI account is ready — please confirm your email"
    return mailer.send(email, subject, body, secret=verify_link, lang=lang)


#: How long an email confirmation link works.
VERIFY_TTL_HOURS = 48


@_safe
def email_verification(email: str, name: str | None, verify_link: str, lang: str = "en") -> dict:
    """A fresh confirmation link, asked for from the account page."""
    if lang == "ar":
        subject = "أكّد بريدك الإلكتروني في ESAP Clinical AI"
        body = (_hello(name, lang)
                + f"أكّد أن {email} هو بريدك الإلكتروني من هذا الرابط (يعمل لمدة {VERIFY_TTL_HOURS} ساعة):\n"
                f"{verify_link}\n\nإذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.")
    else:
        subject = "Confirm your email for ESAP Clinical AI"
        body = (_hello(name, lang)
                + f"Confirm that {email} is your email address (the link works for {VERIFY_TTL_HOURS} hours):\n"
                f"{verify_link}\n\nIf you did not ask for this, you can ignore this email.")
    return mailer.send(email, subject, body, secret=verify_link, lang=lang)


@_safe
def password_reset(email: str, link: str, minutes: int, lang: str = "en") -> dict:
    if lang == "ar":
        subject = "إعادة تعيين كلمة مرور ESAP"
        body = ("طلب أحدهم إعادة تعيين كلمة المرور لهذا الحساب في ESAP.\n\n"
                f"اختر كلمة مرور جديدة من هنا (يعمل الرابط لمدة {minutes} دقيقة):\n{link}\n\n"
                "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة، فكلمة مرورك لم تتغيّر.")
    else:
        subject = "Reset your ESAP password"
        body = ("Someone asked to reset the password for this ESAP account.\n\n"
                f"Choose a new password here (the link works for {minutes} minutes):\n{link}\n\n"
                "If you did not ask for this, you can ignore this email. Your password has not changed.")
    return mailer.send(email, subject, body, secret=link, lang=lang)


# --- invitations -----------------------------------------------------------------


@_safe
def staff_invite(email: str, token: str, hospital: str, role_label: str, invited_by: str,
                 expires_at: str | None, reminder: bool = False) -> dict:
    """A hospital admin invited someone to join their hospital's workspace."""
    link = f"{settings().public_url}/invite/{token}"
    expiry = f" The link works until {expires_at[:10]}." if expires_at else ""
    lead = "A reminder: you" if reminder else "You"
    return mailer.send(
        email, f"{'Reminder: ' if reminder else ''}You're invited to {hospital} on ESAP Clinical AI",
        _hello(None, "en")
        + f"{lead} have been invited by {invited_by} to join {hospital} on ESAP Clinical AI "
        f"as {role_label}.\n\nAccept the invitation and choose your password here:{expiry}\n{link}\n\n"
        "If you were not expecting this, you can ignore this email.",
        secret=link)


@_safe
def caregiver_invite(email: str, token: str, carer_name: str | None, patient_name: str | None,
                     relationship: str, lang: str = "en") -> dict:
    """A patient gave a family member or carer access to their portal."""
    link = f"{settings().public_url}/caregiver/accept/{token}"
    named = (patient_name or "").strip()
    if lang == "ar":
        who = named or "أحد المرضى"
        subject = f"منحك {who} صلاحية الوصول في ESAP Clinical AI"
        body = (_hello(carer_name, lang)
                + f"أضافك {who} بصفة ({relationship}) في ESAP Clinical AI لتتابع ملخصات رعايته.\n\n"
                f"أنشئ تسجيل الدخول الخاص بك من هنا (يُستخدم الرابط مرة واحدة):\n{link}\n\n"
                "إذا كنت لا تعرف هذا الشخص، تجاهل هذه الرسالة ولن يُشارك معك أي شيء.")
    else:
        who = named or "A patient"
        subject = f"{who} has given you access on ESAP Clinical AI"
        body = (_hello(carer_name, lang)
                + f"{who} has added you as their {relationship.lower()} on ESAP Clinical AI, "
                "so you can follow their care summaries.\n\n"
                f"Set up your own sign-in here (the link can be used once):\n{link}\n\n"
                f"If you don't know {named or 'this person'}, ignore this email and nothing will be shared with you.")
    return mailer.send(email, subject, body, secret=link, lang=lang)


# --- payments ----------------------------------------------------------------------


def _where_to_manage(hospital: bool, lang: str) -> str:
    if lang == "ar":
        if hospital:
            return f"الفواتير والإيصالات وبيانات البطاقة في «إدارة المدفوعات» ضمن الفوترة: {settings().public_url}/admin/billing"
        return "الفواتير والإيصالات وبيانات البطاقة في بوابة العملاء المرفقة بالإيصال الذي أرسله إليك مزوّد الدفع Polar."
    if hospital:
        return (f"Invoices, receipts and card details are under Manage payments in Billing: "
                f"{settings().public_url}/admin/billing")
    return ("Invoices, receipts and card details are in the customer portal linked from the receipt "
            "our payment provider, Polar, emailed you.")


@_safe
def payment_received(email: str, name: str | None, plan: str, amount_usd: float | None,
                     invoice_number: str | None, period: str | None, lines: list[dict] | None,
                     hospital: bool, lang: str = "en") -> dict | None:
    """Payment success, with the invoice details. Polar also sends its own
    receipt; ESAP_PAYMENT_RECEIPTS=false leaves the receipt to Polar alone."""
    cfg = settings()
    if not cfg.send_payment_receipts:
        return None
    items = "\n".join(f"  {ln.get('label')} × {ln.get('qty')}: {_money(ln.get('amountUsd'))}"
                      for ln in (lines or [])) or f"  ESAP Clinical AI {plan}: {_money(amount_usd)}"
    if lang == "ar":
        subject = f"تم استلام الدفعة{f' — الفاتورة {invoice_number}' if invoice_number else ''}"
        body = (_hello(name, lang)
                + f"شكرًا لك. استلمنا دفعتك لخطة ESAP Clinical AI {plan.title()}.\n\n"
                f"الفاتورة: {invoice_number or '—'}\n"
                + (f"الفترة: {period}\n" if period else "")
                + f"{items}\nالمبلغ المدفوع: {_money(amount_usd)}\n\n"
                + _where_to_manage(hospital, lang) + "\n\n"
                f"لأسئلة الفوترة: {cfg.billing_email}")
    else:
        subject = f"Payment received{f' — invoice {invoice_number}' if invoice_number else ''}"
        body = (_hello(name, lang)
                + f"Thank you. We received your payment for ESAP Clinical AI {plan.title()}.\n\n"
                f"Invoice: {invoice_number or '—'}\n"
                + (f"Period: {period}\n" if period else "")
                + f"{items}\nTotal paid: {_money(amount_usd)}\n\n"
                + _where_to_manage(hospital, lang) + "\n\n"
                f"Billing questions: {cfg.billing_email}")
    return mailer.send(email, subject, body, reply_to=cfg.billing_email, lang=lang)


@_safe
def payment_failed(email: str, name: str | None, plan: str, hospital: bool, lang: str = "en") -> dict:
    """A renewal charge failed and Polar is retrying it."""
    cfg = settings()
    if lang == "ar":
        subject = "لم تكتمل دفعتك في ESAP"
        body = (_hello(name, lang)
                + f"تعذّر تحصيل آخر دفعة لخطة ESAP Clinical AI {plan.title()}. "
                "يبقى وصولك مفعّلًا بينما يعيد مزوّد الدفع المحاولة خلال الأيام القليلة القادمة.\n\n"
                "حتى لا تفقد الوصول، حدّث بطاقتك. " + _where_to_manage(hospital, lang) + "\n\n"
                f"إذا كنت تعتقد أن هذا خطأ، راسلنا على {cfg.billing_email}.")
    else:
        subject = "Your ESAP payment didn't go through"
        body = (_hello(name, lang)
                + f"We couldn't take the latest payment for your ESAP Clinical AI {plan.title()} plan. "
                "Your access stays on while the payment provider retries the card over the next few days.\n\n"
                "To avoid losing access, update your card. " + _where_to_manage(hospital, lang) + "\n\n"
                f"If you think this is a mistake, write to {cfg.billing_email}.")
    return mailer.send(email, subject, body, reply_to=cfg.billing_email, lang=lang)
