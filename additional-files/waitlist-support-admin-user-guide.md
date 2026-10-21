# ESAP Clinical AI — Waitlist, Support & Super Admin: User Guide

> Written 2026-10-20. Covers the features added to the web app in `system/system-final-v`:
> the public waitlist, the sales queue, the all-users directory, super admin accounts,
> support tickets and announcements.

---

## 1. Who uses what

| Person | Where | What they do |
|---|---|---|
| **Visitor** (not signed in) | `/waitlist` | Joins the early-access waitlist |
| **Sales team** | `/ops/waitlist` | Contacts people on the waitlist and tracks progress |
| **Super admin** | `/ops/...` (super admin dashboard) | Sees all users, adds super admins, answers support tickets, posts announcements |
| **Any signed-in user** (doctor, nurse, hospital admin, patient) | `/support` | Opens support tickets and chats with the technical team |

> Sales team members sign in with a **super admin account**. There is no separate "sales" role yet.

---

## 2. Starting the app (for testing)

**Backend** (from `system/system-final-v/backend`):

```bash
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

**Frontend** (from `system/system-final-v/frontend`):

```bash
npm run dev
```

Open the address the frontend prints (e.g. `http://localhost:5173`).

**Demo super admin:** `rmoravec@esap.health` / password `esap-demo`

---

## 3. Waitlist — for visitors

1. Go to **`/waitlist`** (also in the top menu: **Waitlist**).
2. Fill in:
   - **Required:** full name, work email, organization (not needed if joining as an individual).
   - **Optional:** job title, phone, country, number of beds, and a message.
3. Tick the box agreeing that the team may contact you.
4. Click **Join the waitlist**.
5. You see **"You are on the list"** and your place number (e.g. **#12**).

Good to know:
- Joining again with the same email does not create a second entry. You keep your original place.
- **Do not put patient information in the message.**
- To stop spam, one visitor can add at most 5 new sign-ups in 10 minutes. Fixing a mistake on the form (for example a missed consent tick or an empty organization) and re-submitting your own email do not count toward this.
- If you see **"Too many sign-ups from this address"**, wait a few minutes and try again.

---

## 4. Waitlist — for the sales team

Sign in as a super admin and open **Growth & support → Waitlist** (`/ops/waitlist`).

**The list**
- People are listed in the order they joined (**#** column).
- The tiles at the top show: total on the list, new (not contacted yet), contacted/qualified, converted.
- Use the **search box** (name, email, organization, owner) or the **status filter** (All, New, Contacted, Qualified, Converted, Declined).

**Working a lead:** click a person's row to open their details.
1. **Contact them:** click **Email …** (opens your email app) or **Call …**.
2. **Status:** set it to New → Contacted → Qualified → Converted (or Declined).
3. **Owner:** type the salesperson's name, or click **Me**.
4. **Log a contact:** write what was said and the next step.
5. Click **Save**. The note is saved with your name and the time under **Contact log**.

**Other actions**
- **Export CSV:** downloads the whole list for a spreadsheet. Every export is recorded in the audit log.
- **Public form:** opens the `/waitlist` page.
- **Remove:** deletes a person permanently, for when someone asks to be removed. You must type their email to confirm.

---

## 5. Super admin — all users

Open **Growth & support → All users** (`/ops/users`).

- Shows **every account** on the platform: all hospitals, self-signup clinicians, patients and super admins.
- Tiles: total accounts, clinicians, patients, super admins.
- Filter by **role** or **tenant** (hospital), or search by name/email.
- Shows account details only: no patient records.

### Adding another super admin

1. Click **Add super admin**.
2. Enter name, email, a temporary password (at least 12 characters) and a **reason**.
3. Click **Create account**.
4. Send the password to the person **separately** from the email address (e.g. by phone).

Creating a super admin is recorded in the platform audit log as a **critical** event.

### Creating the very first super admin (new server)

On a fresh database there are no demo accounts. From `system/system-final-v/backend`:

```bash
python tools/create_super_admin.py --email ops@yourcompany.com --name "Your Name"
```

It asks for the password (at least 12 characters, typed twice). Then sign in at `/login`.

---

## 6. Support — for every user

Every signed-in user has **Help & support** at the bottom of the left menu (`/support`).

**Open a ticket**
1. Click **New ticket**.
2. Fill in the **subject**, **topic** (sign-in, something broken, data/results, EHR integration, billing, feature request, other), **urgency** (low, normal, high, urgent) and **what happened**.
3. Click **Open ticket**.

**Follow a ticket**
- Your tickets appear in a list. The **Next step** column says whether support or you should reply next.
- Click a ticket to see the conversation and reply.
- Click **Close ticket** when it is solved. A closed ticket cannot be replied to; open a new one if the problem comes back.

**Do not include patient names, record numbers or other patient details in a ticket.**

---

## 7. Support — for super admins

Open **Growth & support → Support tickets** (`/ops/support`).

- Shows **every ticket from every user and hospital**.
- Tickets **waiting on support** are listed first, then by urgency, then oldest first.
- Tiles: open tickets, waiting on support, high/urgent, all time.
- Filter by **Active**, by status or **All**, or search by subject, person, hospital or ticket id.

**Answering a ticket**
1. Click the ticket.
2. Type your reply and click **Send**. The ticket is assigned to you and moves to **In progress**.
3. Change the status at the bottom: Open, In progress, Waiting on user, Resolved, Closed.

If the user replies to a ticket that is "Waiting on user" or "Resolved", it goes back to **In progress** automatically.

If a ticket contains patient information, tell the user and do not copy it anywhere.

---

## 8. Announcements

### For super admins

Open **Growth & support → Announcements** (`/ops/announcements`).

1. Click **New announcement**.
2. Fill in:
   - **Title** and **Message**.
   - **Audience:** Everyone, Clinicians, Hospital admins, Patients or Platform staff.
   - **Kind:** Information, Planned maintenance or Known problem.
   - **Expires** (optional): the time it disappears automatically.
3. Click **Publish**.

On each announcement you can:
- switch **Published** off to hide it (and on to show it again)
- click the **bin icon** to delete it

The badge shows **Showing**, **Hidden** or **Expired**.

### What users see

- The announcement appears as a bar at the **top of every screen** for its audience.
- Information notices are teal; maintenance and known problems are amber with a warning icon.
- Users can close it with **×**. It stays closed on that browser, but a new or re-titled announcement shows again.
- Users see announcements on their next page load.

---

## 9. Quick reference — pages

| Page | Address | Who |
|---|---|---|
| Join the waitlist | `/waitlist` | Anyone |
| Help & support | `/support` | Any signed-in user |
| Waitlist queue | `/ops/waitlist` | Super admin / sales |
| All users | `/ops/users` | Super admin |
| Support tickets | `/ops/support` | Super admin |
| Announcements | `/ops/announcements` | Super admin |

## 10. Privacy and records

- The waitlist holds **contact details only**: never patient data.
- Super admins can see account details and support tickets, but get **no access to patient records**.
- These actions are written to the **platform audit log** (`/ops/audit`):
  - joining the waitlist, and every waitlist update, export and removal
  - opening, replying to and changing the status of a ticket
  - publishing, editing and deleting announcements
  - creating a super admin

## 11. Known limits

- **No sales role:** the sales team uses super admin accounts, which can also see the rest of the super admin dashboard.
- **Spam limit resets:** the waitlist's per-visitor limit is kept in server memory and resets when the server restarts.
- **Behind a proxy, set `ESAP_TRUSTED_PROXIES`:** if the API runs behind a reverse proxy or load balancer, list the proxy IPs in `ESAP_TRUSTED_PROXIES` (backend `.env`). Without it, all visitors look like the proxy and share one limit of 5 sign-ups per 10 minutes for the whole site.
- **Support page in English only:** patients using Arabic see it in English; only the menu link is translated.
- **No email alerts:** new tickets or waitlist sign-ups do not send emails. Check the dashboard.
