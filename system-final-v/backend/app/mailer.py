"""Outgoing email: password reset links and similar account notices.

Every message is written to `mail_outbox` first. When ESAP_SMTP_HOST is set it
is also sent over SMTP (STARTTLS); without it the message stays in the outbox
only. Never put clinical content in an email.

A secret in the message (a reset link) is passed as `secret`. It goes into the
email itself and nowhere else: the outbox row and the log keep "[link withheld]"
in its place, so a database copy, a backup or a log file cannot be used to take
over an account. A local dev server with no mail service can set
ESAP_MAIL_LOG_SECRETS=true to log the full message instead.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import ssl
import uuid
from email.message import EmailMessage

from . import db
from .config import settings
from .security import iso, utcnow

log = logging.getLogger("esap.mail")


_WITHHELD = "[link withheld]"


def send(to: str, subject: str, body: str, secret: str | None = None) -> dict:
    cfg = settings()
    stored = body.replace(secret, _WITHHELD) if secret else body
    doc = {"id": f"mail_{uuid.uuid4().hex[:10]}", "to": to, "subject": subject, "body": stored,
           "createdAt": iso(utcnow()), "status": "queued"}
    if cfg.smtp_host:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = cfg.mail_from, to, subject
        msg.set_content(body)
        try:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=10) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if cfg.smtp_user:
                    smtp.login(cfg.smtp_user, cfg.smtp_password or "")
                smtp.send_message(msg)
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
