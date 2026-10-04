# 8. Platform operations (ESAP staff)

[← Manual index](README.md)

**Applies to:** Super-Admin (Platform), a member of ESAP's own staff.
**Home screen:** Fleet dashboard
**Left rail:** Fleet dashboard · Provisioning wizard · Incidents · *Platform:* Model rollout ·
Global config · Plan catalog · *Governance:* Break-glass · Platform audit log

The ops console runs the **whole fleet of hospitals (tenants)**. It shows each hospital's
operational state and **no patient data from any of them**. In production it is not reachable
from the public internet. The top bar has a **hospital switcher** (other roles are fixed to
their own hospital).

> **Zero standing access to patient data.** You can create, suspend and configure hospitals.
> You cannot open a patient record. The only route to one is **break-glass** (section 8.6): one
> named patient, a written reason, a ticket and a clock that cannot be extended.

---

## Tasks

### Onboard a hospital

**Fleet dashboard** → **Provision a tenant** → complete the six steps → **Create tenant**. The
hospital starts in *pending* state, and its first administrator is invited.

### Look into a hospital with problems

**Fleet dashboard** → **Needs attention** → click the hospital → **Health** tab → open the
incident → **Publish update** for the hospital's IT lead.

### Advance or pull a model version

- **Model rollout** → check the promotion gate is **Clear** → move the traffic slider, or
  **Promote to 100%**.
- To pull a bad version: **Roll back** → type the version string to confirm.

### Look at one patient record for a support case

**Break-glass** → **Request access** → fill in every field → wait for a second operator to
approve it → **Start** on your approved grant → do the work → end the access from the banner as
soon as you are done.

---

## 8.1 Fleet dashboard

- **Tiles:** Tenants · Beds under contract · Assessments (30 d) · Open incidents.
- **Stale-refresh banner**: hospitals whose nightly data refresh has not completed in over 24
  hours. Assessments keep running on an older snapshot, which is worse than an outage because
  a clinician cannot see it.
- **Cards / Table** and **All tenants / Needs attention**. Click a hospital for its detail.
- **Isolation tiers in the fleet**: what each hospital's data boundary is, from shared schema
  with row-level security (a policy, not a wall) up to a dedicated VPC.

## 8.2 Provisioning wizard

Nothing is created until the last step. **Continue** and **Back** move between steps.

| Step | Fields | Notes |
|---|---|---|
| **Organisation** | Legal name, tenant slug, primary contact email | The slug becomes their console address and appears in every audit record; it cannot change once data exists. |
| **Deployment** | Mode, isolation tier, region / data residency | These are migrations, not settings. EU residency switches on the GDPR workflows. |
| **Plan** | Tier, licensed beds, included assessments per cycle | Set the allowance with headroom; a surprise overage bill gets a clinical tool switched off. |
| **First administrator** | Name, email | The only account ESAP creates directly. This account can grant clinical roles. |
| **Integrations** | Single sign-on, HL7v2 ADT, FHIR R4 read, TEFCA / QHIN | The hospital configures the endpoints itself afterwards. |
| **Review & create** | Summary | **Create tenant** |

## 8.3 Tenant detail

Everything operational about one hospital, and nothing clinical.

- **Buttons:** **Request access** (opens Break-glass), **Suspend** or **Reinstate**.
- **Banners:** *This tenant is suspended*; *Data refresh is stale*.
- **Tiles:** Beds · Seats in use · Assessments (30 d) · Open incidents.
- **Tabs:** **Overview** (deployment and plan) · **Health** (weekly assessments for **this
  hospital only**, calibration error, input drift, incidents) · **Model pinning** (which
  version this hospital receives; a pinned hospital gets no canary traffic; every hospital
  runs the same version unless pinned) · **Platform activity** (what ESAP staff did here).
- Calibration error and input drift are empty for every hospital: there is no production
  monitoring yet.

**Suspending a hospital:** click **Suspend**, read the consequences, then type the **tenant
slug**. Every user loses access at their next request; running assessments finish and no new
ones start; **nothing is deleted**; the suspension and your identity go to the platform audit
log.

## 8.4 Model rollout

- **Refresh metrics** reloads from the server.
- **Tiles:** In canary · Held below full · At full rollout · Rolled back (90 d).
- **One card per rollout:** model, version, stage, a **traffic slider** (locked when the gate
  is blocked), the **promotion gate** with each patient group's metric, **Promote to 100%**
  (only when the gate is clear) and **Roll back**.
- **The promotion gate:** a version advances only when **every** reported patient group clears
  the bar, not just the pooled number.
- **Canary watch:** calibration error (automatic rollback above 0.05), Recall@20 (leakage
  ceiling) and input drift.
- **Rollback history**, kept visible on purpose.

**Rolling back:** **Roll back** → type the version to confirm. Assessments already produced
keep the version that made them.

## 8.5 Global config

A flag here changes behaviour for **every hospital at once**.

- **Feature flags:** each with its risk level. **Every** change, on or off, opens a dialog
  (*Enable / Disable a flag platform-wide*) that needs a written **Reason**: *"a written reason
  is not optional for a platform-wide change."* The confirm button stays disabled until you
  type one, and your exact words go to the platform audit log. Turning on a **high-risk** flag
  also needs you to type the flag's key.
- **Taxonomy & versions:** the CCSR condition taxonomy and ICD-10-CM edition (read-only here,
  because changing them means retraining), the platform versions, and the compute available.
- **Subprocessors:** the register published to every hospital's privacy officer. **Start a
  subprocessor review** → vendor, what it would do, whether it would process patient data →
  **Open review**. Nothing goes live until the review completes and customers have had notice.

## 8.6 Break-glass

The only route from this console to a patient record. The friction is deliberate.

- **Tiles:** Active now · Awaiting approval · Used this quarter · Median length requested.
- **Grants table:** who asked, hospital and patient, ticket, reason, duration, approver, status.
- **Awaiting your approval:** other people's requests (never your own). **Approve** or **Deny**.
- **Row actions:** **Start** (your own approved grant), **Revoke** (any active grant) and
  **Withdraw** (your own pending request).

**Requesting access:**

1. **Request access**.
2. Fill in every field: **Tenant**, **Patient reference** (an MRN or encounter ID; the grant
   covers this one record only), **Reason** (at least a sentence, written for a compliance
   reviewer who was not there), **Ticket reference**, **Duration** (it cannot be extended; if
   you run out, request again).
3. Click **Request n-minute access**. The request is filed as **pending approval**; nothing
   is unlocked yet.
4. Another operator approves it. Then click **Start** on your grant. The elevation takes the
   grant's ticket and reason, and cannot outlast the grant. A banner with a live countdown
   appears at the top of every screen, and everything you do is logged with your reason.
5. End it as soon as you are done with **End elevated access** in the banner.

> The demo has a single platform account, so a request you file here cannot be approved by a
> second person. To walk the flow, approve the seeded request from *D. Petrov*, or **Start**
> the seeded active grant.
>
> **In this build** the ops console never shows clinical screens, even during a started grant,
> so there is no screen for reading the patient itself. The request, approval, timer and audit
> trail all work.

The request is logged whether or not it is approved, and the hospital's own privacy officer
can see it. **A hospital can disable ESAP break-glass entirely** in its Org settings.

## 8.7 Platform audit log

Every action ESAP staff have taken across the fleet: the log an external auditor reads.

- **Tiles:** Events (90 days) · Critical severity · Break-glass actions · Cross-tenant reads.
- **Filters:** hospital, severity (**All / Notice / Warning / Critical**), search.
- **Click an event** for the stated justification and the **Mirrored to the tenant** note:
  every entry that touches a hospital also appears in that hospital's own audit log.
- It cannot be edited or pruned by anyone. **Export** is itself logged.

## 8.8 Incidents

- **Tiles:** Open · Critical · Inference p95 (target 900 ms) · Tenants affected.
- **Serving latency** charts: assessment latency and volume per day.
- **Declare incident** (top right): title, component, severity, affected hospital (or
  platform-wide) and what is happening. It opens in the *open* state and is logged.
- **Incident cards:** **Open** (a panel where you write an update for the hospital's IT lead
  and **Publish update**, or set it to mitigating / **Resolve**), **Go to tenant**, **Mark
  resolved**.
- **The failure modes that do not page anyone:** a stalled admission feed, a stale data
  refresh, calibration drift, a silently degraded model. Check them even when the board is
  green.

## 8.9 Plan catalog

Editing a plan **never reprices an existing hospital**; changes apply to new contracts and
renewals.

- **Tiles:** Plans defined · Tenants on a hospital plan · Self-serve seats · Approx. monthly
  recurring.
- **Hospital plans / Individual / self-serve.**
- **Edit** a plan: display price, unit, who it is for, and the **Impact** list of hospitals on
  it → **Save plan**. **New plan**: plan code (cannot change later), display name, pricing →
  **Create plan**.
- **What each plan actually gates**, and **What is never gated**: calibration and its badge,
  the Why panel, the degraded label, the "decision support, not diagnosis" line, and the
  performance figures by patient group. A safety feature behind a paywall is not a safety
  feature.

Next: [9. Patients and carers →](09-patients-and-carers.md)
