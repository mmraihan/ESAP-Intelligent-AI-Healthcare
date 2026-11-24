# Issue 17: setting up email sending (password reset and other emails)

*Updated 22 Nov 2026. This is a plan only. Nothing has been changed yet.*

## 1. What the problem is

The website already **writes** every email: password reset, sign-up confirmation, email verification, staff and caregiver invitations, and payment received or failed. They exist in English and Arabic.

The server has **no mailbox login to send them with**. Each email is only saved in the database (table `mail_outbox`), so nobody receives it.

**The code is ready. Nothing needs to change in it.**
- All emails are wired in: `app/routers/auth.py`, `admin.py`, `patient_ops.py`, `billing.py`.
- The sending code is finished in `app/mailer.py`. Port 465 = SSL; port 587 = STARTTLS.
- All 20 email tests pass (`tests/test_email_flows.py`, run on 22 Nov).
- Production has had this code since 17 Nov (commit 80cc99f). The server needs settings only.

```
User clicks "Forgot password"
        │
        ▼
ESAP backend builds the email ──► saves a copy in mail_outbox (always)
        │
        ▼  (only when ESAP_SMTP_HOST is set)  ◄── the missing part
Mail server (no-reply@esap.ai) ──► user's inbox
```

## 2. Sender

| Address | Purpose |
|---|---|
| **no-reply@esap.ai** | Sends all system emails, shown as "ESAP Clinical AI". Nobody reads it |
| care@esap.ai | Where replies to account emails go (reset, sign-up, invites) |
| billing@esap.ai | Where replies to payment emails go |

## 3. Message to the manager (sent)

> For #17: sender **no-reply@esap.ai** ("ESAP Clinical AI"). Replies go to care@esap.ai and billing@esap.ai. The code is ready.
> Please:
> 1. Create the **no-reply@esap.ai** mailbox (and make sure care@ and billing@ exist).
> 2. Add DNS TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:care@esap.ai`
> 3. Share the SMTP host, port, username and password.
>
> Then I'll set it up on the server and test.

**What esap.ai already has:** SPF and DKIM are in place. DMARC is missing, so it's step 2.

## 4. Waiting for the manager

| Setting | Value |
|---|---|
| SMTP host | *(waiting)* |
| SMTP port | *(waiting, usually 465 or 587)* |
| Username | *(waiting, usually `no-reply@esap.ai`)* |
| Password | *(don't write it in this file)* |
| DMARC record added | *(waiting)* |
| care@ / billing@ exist | *(waiting)* |

## 5. Server steps (once the details arrive)

Server: `esap-prod-01` (`ssh netcup`), folder `/home/mubasshir/esap-backend`.

1. **Back up the settings file**
   ```bash
   cp .env .env.bak-$(date +%Y%m%d-%H%M%S)-pre-smtp
   ```
2. **Check that the server can reach the mail server**
   ```bash
   nc -vz <SMTP host> <port>
   ```
   "succeeded" = OK. If it's blocked, ask netcup to open outgoing port 465/587.
3. **Add to `.env`**
   ```
   ESAP_SMTP_HOST=<SMTP host>
   ESAP_SMTP_PORT=<port>
   ESAP_SMTP_USER=no-reply@esap.ai
   ESAP_SMTP_PASSWORD=<password>
   ESAP_MAIL_FROM=ESAP Clinical AI <no-reply@esap.ai>
   ESAP_SUPPORT_EMAIL=care@esap.ai
   ESAP_BILLING_EMAIL=billing@esap.ai
   ```
   `ESAP_PUBLIC_URL=https://care.esap.ai` is already set. The email links use it.
4. **Restart the backend**
   ```bash
   sudo -n systemctl restart esap-backend
   curl -s https://esap-api.159-195-83-232.sslip.io/readyz
   ```
5. **Test with a real email address**
   - On care.esap.ai, request **Forgot password** for a patient or solo account → the email arrives (check spam too) → the link sets a new password.
   - Sign up a new patient → the "Confirm your email" mail arrives → the link works.
   - Check the log: `journalctl -u esap-backend --since "10 min ago" | grep esap.mail`
     - `sent` = OK.
     - `SMTPAuthenticationError` = wrong password.
     - `SMTPConnectError` = port blocked.
6. **Optional:** send one email to https://www.mail-tester.com and aim for 9/10 or higher.

**Rollback:** restore the backed-up `.env` and restart. Emails go back to being saved without being sent. Nothing else changes.

## 6. Notes

- Made-up addresses (`.example`, `example.com`) are skipped on purpose. Demo and QA accounts never get mail, so **test with a real address**.
- Hospital staff don't get reset emails. Their hospital admin resets them. Only **patients and solo clinicians** reset their own password.
- The reset link is never stored in the database or the log.
- A native speaker should read the Arabic email texts before launch.
- When delivery works, mark QA Issue 17 ✅ and close finding E3.
