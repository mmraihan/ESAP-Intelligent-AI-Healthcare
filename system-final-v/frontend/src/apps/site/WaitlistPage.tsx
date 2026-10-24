/**
 * Early-access waitlist (public, no sign-in).
 *
 * The one public form that writes to the server without a session. It asks
 * only for what the sales team needs to get back to someone, says plainly who
 * will contact them and why, and grants nothing — joining is not an account.
 * Entries land in the ops console's Waitlist queue (/ops/waitlist).
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SiteLayout } from "./SiteLayout";
import { WaitlistPath } from "./SiteArt";
import { ApiError, NetworkError } from "@/api/client";
import { joinWaitlist } from "@/api/desk";
import { Select } from "@/components/ui/primitives";
import { AlertIcon, CheckIcon, ClockIcon, MailIcon, ShieldIcon, UsersIcon } from "@/components/ui/icons";

const ORG_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "health_system", label: "Health system / group" },
  { value: "clinic", label: "Clinic or practice" },
  { value: "individual", label: "Individual clinician" },
  { value: "other", label: "Other" },
];

const POINTS = [
  { icon: <ClockIcon size={18} />, title: "Early access, in sign-up order", text: "Pilot seats open in the order people join. Your place is fixed the moment you submit." },
  { icon: <UsersIcon size={18} />, title: "A person gets back to you", text: "Someone from our team contacts you to understand your setting before any pilot starts." },
  { icon: <ShieldIcon size={18} />, title: "Contact details only", text: "We never ask for patient information here. Do not include any in your message." },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function WaitlistPage() {
  const [form, setForm] = useState({
    name: "", email: "", organization: "", org_type: "hospital", job_title: "",
    phone: "", country: "", beds: "", message: "", website: "",
  });
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ position: number | null } | null>(null);

  const set = (k: keyof typeof form) => (e: { currentTarget: { value: string } }) =>
    setForm({ ...form, [k]: e.currentTarget.value });

  const nameBad = !form.name.trim();
  const emailBad = !EMAIL_RE.test(form.email.trim());
  const orgBad = form.org_type !== "individual" && !form.organization.trim();
  const valid = !nameBad && !emailBad && !orgBad && consent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const beds = Number.parseInt(form.beds, 10);
      const r = await joinWaitlist({
        name: form.name.trim(), email: form.email.trim(),
        organization: form.organization.trim() || null, org_type: form.org_type,
        job_title: form.job_title.trim() || null, phone: form.phone.trim() || null,
        country: form.country.trim() || null, beds: Number.isFinite(beds) ? beds : null,
        message: form.message.trim() || null, contact_consent: consent,
        website: form.website || null,
      });
      setDone({ position: r.position });
    } catch (err) {
      setError(err instanceof ApiError ? err.message
        : err instanceof NetworkError ? "We could not reach our server. Please try again in a moment."
        : "Something went wrong. Nothing was sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SiteLayout>
      <section className="hero wl-hero">
        <div className="wl-grid">
          <div className="wl-intro">
            <span className="hero-eyebrow">Early access</span>
            <h1>Join the ESAP waitlist.</h1>
            <p className="hero-lede">
              We are opening pilot places to hospitals and clinicians in stages. Leave your details and our
              team will contact you when a place is ready for your setting.
            </p>
            <ul className="wl-points">
              {POINTS.map((p) => (
                <li key={p.title}>
                  <span className="wl-point-icon" aria-hidden="true">{p.icon}</span>
                  <span>
                    <strong>{p.title}</strong>
                    <span>{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="wl-fine">
              Decision support, not diagnosis. Want to try it on your own cases now?{" "}
              <Link to="/signup" className="auth-link is-inline">Create a free individual seat</Link>.
            </p>
            <WaitlistPath />
          </div>

          <div className="card wl-card">
            {done ? (
              <div className="wl-done" role="status">
                <span className="wl-done-icon" aria-hidden="true"><CheckIcon size={22} /></span>
                <h2>You are on the list.</h2>
                {done.position !== null && (
                  <p className="wl-position">
                    Your place: <strong className="tnum">#{done.position}</strong>
                  </p>
                )}
                <p className="auth-sub">
                  We have your details. Someone from our team will contact you at the email you gave. There is
                  nothing else you need to do.
                </p>
                <Link to="/product" className="pub-btn pub-btn-outline">Back to the product page</Link>
              </div>
            ) : (
              <form className="wl-form" onSubmit={submit} noValidate>
                <div>
                  <h2 className="auth-title">Request early access</h2>
                  <p className="auth-sub">Fields marked * are required. It takes under a minute.</p>
                </div>

                <div className="auth-row-2">
                  <label className="auth-field">
                    <span className="auth-label">Full name <em aria-hidden="true">*</em></span>
                    <input className="input auth-input is-plain" autoComplete="name" value={form.name}
                      onChange={set("name")} aria-invalid={touched && nameBad} required />
                    {touched && nameBad && <span className="auth-hint is-error" role="alert"><AlertIcon size={13} /> Tell us your name.</span>}
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">Work email <em aria-hidden="true">*</em></span>
                    <input className="input auth-input is-plain" type="email" autoComplete="email" value={form.email}
                      onChange={set("email")} aria-invalid={touched && emailBad} required />
                    {touched && emailBad && <span className="auth-hint is-error" role="alert"><AlertIcon size={13} /> That does not look like an email address.</span>}
                  </label>
                </div>

                <div className="auth-row-2">
                  <label className="auth-field">
                    <span className="auth-label">You are joining as</span>
                    <Select value={form.org_type} onChange={set("org_type")}>
                      {ORG_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">
                      Organization {form.org_type !== "individual" && <em aria-hidden="true">*</em>}
                    </span>
                    <input className="input auth-input is-plain" autoComplete="organization" value={form.organization}
                      onChange={set("organization")} aria-invalid={touched && orgBad} />
                    {touched && orgBad && <span className="auth-hint is-error" role="alert"><AlertIcon size={13} /> Which hospital or clinic?</span>}
                  </label>
                </div>

                <div className="auth-row-2">
                  <label className="auth-field">
                    <span className="auth-label">Job title</span>
                    <input className="input auth-input is-plain" autoComplete="organization-title" placeholder="Optional"
                      value={form.job_title} onChange={set("job_title")} />
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">Phone</span>
                    <input className="input auth-input is-plain" type="tel" autoComplete="tel" placeholder="Optional"
                      value={form.phone} onChange={set("phone")} />
                  </label>
                </div>

                <div className="auth-row-2">
                  <label className="auth-field">
                    <span className="auth-label">Country</span>
                    <input className="input auth-input is-plain" autoComplete="country-name" placeholder="Optional"
                      value={form.country} onChange={set("country")} />
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">Beds (approx.)</span>
                    <input className="input auth-input is-plain" inputMode="numeric" placeholder="Optional"
                      value={form.beds} onChange={(e) => setForm({ ...form, beds: e.currentTarget.value.replace(/\D/g, "").slice(0, 6) })} />
                  </label>
                </div>

                <label className="auth-field">
                  <span className="auth-label">What would you like to use ESAP for?</span>
                  <textarea className="input auth-input is-plain wl-textarea" rows={3} maxLength={2000} placeholder="Optional. Please do not include patient information."
                    value={form.message} onChange={set("message")} />
                </label>

                {/* Honeypot: off-screen and out of the tab order, so only bots fill it. */}
                <label className="wl-hp" aria-hidden="true">
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
                </label>

                <label className="wl-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.currentTarget.checked)} />
                  <span>
                    I agree that the ESAP team may contact me by email or phone about early access. You can ask
                    us to remove your details at any time.
                  </span>
                </label>
                {touched && !consent && (
                  <span className="auth-hint is-error" role="alert"><AlertIcon size={13} /> Please agree so our team can reach you.</span>
                )}

                {error && <p className="auth-hint is-error" role="alert"><AlertIcon size={13} /> {error}</p>}

                <button type="submit" className="pub-btn pub-btn-primary wl-submit" disabled={sending}>
                  <MailIcon size={16} /> {sending ? "Sending…" : "Join the waitlist"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
