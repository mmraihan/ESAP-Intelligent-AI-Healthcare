"""Outgoing email: password resets, sign-up, invitations and payment notices.

Every message is written to `mail_outbox` first. When ESAP_SMTP_HOST is set it
is also sent over SMTP (STARTTLS, or implicit TLS on port 465); without it the
message stays in the outbox only. Never put clinical content in an email.

All system mail comes from ESAP_MAIL_FROM (no-reply@esap.ai). Nobody reads that
mailbox, so every message carries a Reply-To and a footer naming where to
write instead: care@esap.ai for account help, billing@esap.ai for payments.

A secret in the message (a reset or invitation link) is passed as `secret`. It
goes into the email itself and nowhere else: the outbox row and the log keep
"[link withheld]" in its place, so a database copy, a backup or a log file
cannot be used to take over an account. A local dev server with no mail service
can set ESAP_MAIL_LOG_SECRETS=true to log the full message instead.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr

from . import db
from .config import settings
from .security import iso, utcnow

log = logging.getLogger("esap.mail")


_WITHHELD = "[link withheld]"

#: Reserved domains (RFC 2606/6761). Demo and test accounts use them; mail to
#: them can only bounce, and bounces hurt the sending domain's reputation.
_RESERVED_TLDS = (".example", ".test", ".invalid", ".localhost", ".local")
_RESERVED_DOMAINS = ("example.com", "example.net", "example.org")


def deliverable(email: str | None) -> bool:
    domain = (email or "").rpartition("@")[2].strip().lower()
    return bool(domain) and not domain.endswith(_RESERVED_TLDS) and domain not in _RESERVED_DOMAINS


def _footer(reply_to: str, lang: str = "en") -> str:
    if lang == "ar":
        return ("\n\n--\nESAP Clinical AI · care.esap.ai\n"
                f"هذا العنوان لا يستقبل الردود. لأي سؤال راسلنا على {reply_to}.")
    return ("\n\n--\nESAP Clinical AI · care.esap.ai\n"
            f"This address does not take replies. Questions? Write to {reply_to}.")


def _smtp_send(msg: EmailMessage) -> None:
    cfg = settings()
    context = ssl.create_default_context()
    if cfg.smtp_port == 465:
        smtp: smtplib.SMTP = smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, timeout=10, context=context)
    else:
        smtp = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=10)
    with smtp:
        if cfg.smtp_port != 465:
            smtp.starttls(context=context)
        if cfg.smtp_user:
            smtp.login(cfg.smtp_user, cfg.smtp_password or "")
        smtp.send_message(msg)


def send(to: str, subject: str, body: str, secret: str | None = None,
         reply_to: str | None = None, lang: str = "en") -> dict:
    cfg = settings()
    reply_to = reply_to or cfg.support_email
    body = body + _footer(reply_to, lang)
    stored = body.replace(secret, _WITHHELD) if secret else body
    doc = {"id": f"mail_{uuid.uuid4().hex[:10]}", "to": to, "subject": subject, "body": stored,
           "from": cfg.mail_from, "replyTo": reply_to, "lang": lang,
           "createdAt": iso(utcnow()), "status": "queued"}
    if not deliverable(to):
        doc["status"] = "undeliverable"
        log.info("mail to reserved address %s not sent: %s", to, subject)
    elif cfg.smtp_host:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = cfg.mail_from, to, subject
        msg["Reply-To"] = reply_to
        msg["Date"] = formatdate(localtime=False)
        sender_domain = parseaddr(cfg.mail_from)[1].rpartition("@")[2] or None
        msg["Message-ID"] = make_msgid(domain=sender_domain)
        msg.set_content(body)
        try:
            _smtp_send(msg)
            doc["status"] = "sent"
        except (OSError, smtplib.SMTPException) as exc:
            doc["status"] = "failed"
            doc["error"] = type(exc).__name__
            log.warning("mail to %s failed: %s", to, type(exc).__name__)
    else:
        doc["status"] = "outbox_only"
        dev_log = os.environ.get("ESAP_MAIL_LOG_SECRETS", "").strip().lower() in {"1", "true", "yes", "on"}
        log.info("mail (no SMTP configured) to=%s subject=%s\n%s", to, subject, body if dev_log else stored)
    conn = db.connect()
    conn.execute("INSERT INTO mail_outbox (id, to_addr, created_at, status, doc) VALUES (?,?,?,?,?)",
                 (doc["id"], to, doc["createdAt"], doc["status"], json.dumps(doc)))
    conn.commit()
    return doc
