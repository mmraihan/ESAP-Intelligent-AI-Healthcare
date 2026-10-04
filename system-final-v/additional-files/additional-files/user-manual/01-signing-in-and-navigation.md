# 1. Signing in and finding your way

[← Manual index](README.md)

For everyone. How to get in, how to get an account, and how the screen is laid out.

---

## 1.1 Signing in

Open the ESAP address your hospital gave you (in the demo, **http://localhost:5175**). You land
on the **public website**: **Product · Evidence · Security · Pricing** along the top. Click
**Sign in**.

The sign-in page offers these ways in:

| Option | When to use it |
|---|---|
| **Explore the demo as an attending physician** | One click signs you in as the demo attending. Under it the page says *"Hospital single sign-on is not connected here yet"*: no hospital login system is connected in this build. |
| **Email and password** (under *or sign in with a password*) | How everyone signs in in this build: demo accounts, invited staff and self-serve accounts. |
| **Demo — sign in as any role** | A card lower on the page, in the demonstration build only. Click a role to sign in as that role. NP/PA and Clinical Pharmacist are not on the card; sign in with their email. |

After signing in you go straight to your role's home screen (see the
[roles table](README.md#roles-at-a-glance)).

**Two-step sign-in.** If your account has two-step sign-in (an authenticator app) turned on,
the page then asks you to *"Enter the 6-digit code from your authenticator app to finish
signing in."* Type the code and click **Verify and sign in**, or **Use a different account**
to go back. The demo accounts do not use it.

> **Demo accounts.** Every demo account uses the password **`esap-demo`**. The accounts are
> listed in [chapter 10](10-permissions-reference.md#demo-accounts).
>
> **Switching role:** there is no role switcher inside the app. Click your name → **Sign out**,
> then sign in again as another account (or pick another role on the sign-in page's demo card).

**Forgotten your password?** Type your email address in the box above, then click the link.
With no email service connected, the request goes to your Hospital Admin's request queue, and
they send you a reset link from the roster (chapter 6). The page gives the same answer whether
or not the address has an account, so it cannot be used to discover who works here.

---

## 1.2 Getting an account

There are three routes, depending on who you are.

### A hospital invited you

1. Your Hospital Admin sends you an invitation link. (With no email service connected, they
   pass the link to you themselves.)
2. Open the link. Confirm the email address it was sent to.
3. Choose your name and a password of **at least 12 characters**, typed twice.
4. You are signed in with the role and scope the admin chose. The link works **once** and
   expires after **7 days**. If it has expired, ask the admin to **Reissue** it.

### You are a clinician working on your own

1. On the sign-in page click **I am a solo clinician — create an individual account** (or go
   to `/signup`).
2. Choose **clinician**, enter your name, email, clinical role, an optional **Registration or
   licence number**, and a password of at least 12 characters. A 10-digit US NPI is checked
   for a valid check digit; any other licence number is recorded as typed.
3. Read and accept **the attestation**. It confirms you have the clinical training to
   interpret a risk estimate. This is required because a raw risk score read by someone
   without that training can do harm.
4. **Create account**. Your account is real, and it starts **empty**: a personal account has
   no hospital patients, units or records.

### You are a patient

Your hospital normally gives you portal access. You can also create your own account from
`/signup` by choosing **patient**. See [chapter 9](09-patients-and-carers.md).

---

## 1.3 The screen layout

The same layout is used everywhere.

- **Top bar:** the ESAP logo (returns to your home screen), the surface you are in, the
  hospital name, your **role badge**, a **theme toggle** (light / dark / system) and your
  name. In the patient portal there is also a **language toggle** (English / العربية).
  ESAP platform staff get a **hospital switcher** in place of the hospital name; everyone
  else is fixed to their own hospital.
- **Your name** (with your role under it) opens the **account menu**: your email address and
  **Sign out**. That is all it contains.
- **Left rail:** only the screens your role can use. On a phone, open it with **☰**. At the
  bottom is the line **"Decision support, not diagnosis."** It is on every screen on purpose.
  Above that line, every role (patients included) also has a **Design system** link. It is a
  reference area for the people building ESAP (**Design system**, **Permissions matrix**,
  **Blueprint coverage**) and changes nothing; click the ESAP logo to get back to your home
  screen.
- **Intake assistant:** a chat button in the bottom-right corner (see 1.4).
- **Messages:** after an action, a short message at the bottom of the screen says what the
  server did, or why it refused.

---

## 1.4 The intake assistant

A chat panel available on every signed-in screen, to everyone, including patients and carers.
Click the chat button in the bottom-right corner (*Open the intake assistant*).

- **Clinicians:** describe the patient in plain words (age, sex, presentation, history, home
  medicines, vital signs). The assistant turns what you type into intake fields and lists them
  under **Captured so far**. Prior conditions and lab values it picks up are flagged for you to
  confirm. When the basics are in, roles that can run assessments get **Run assessment from
  this**, and the answer appears in the chat (*"Open the results screen for the full breakdown
  and the Why panels"*). That quick run is not attached to any patient's encounter; to record
  an assessment on a patient, use the intake form.
- **Patients and carers:** it takes down your details for a visit (*"Tell me what's going
  on…"*). A clinician reviews everything, and you are never shown a score.
- It works even when the AI language service is unavailable: fields are still picked out, the
  replies are just simpler. The AI never invents a diagnosis code.

Close it with the **×** (*Close assistant*).

---

## 1.5 When something goes wrong

| What you see | What it means |
|---|---|
| A full page saying **Cannot reach the ESAP server** | The server is down or unreachable. Nothing can be shown or saved until it is back. Click **Try again** once it is running. |
| **This screen could not be shown** | A single screen failed. Click **Try again**, or use the left rail to go elsewhere. Report which screen and what you clicked. |
| **This screen does not exist** | The address is wrong. Use **Back to your workspace**. |
| You are sent back to the sign-in page | Your session ended, for example because an admin changed your role or reset your password, or the demo was reset. Sign in again. |
| You typed a screen's address and landed on your home screen instead | Your role cannot use that screen, so ESAP sends you home. |
| A message saying your role cannot do something | The server refused the action for your role. See [chapter 10](10-permissions-reference.md). |

Next: [2. Reading a result →](02-reading-a-result.md)
