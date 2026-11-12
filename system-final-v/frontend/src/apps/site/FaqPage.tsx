/**
 * Frequently asked questions (public, /faq).
 *
 * Grouped by who is asking, searchable, and every answer has its own link
 * (/faq#<id>) so support can send a person straight to it. Answers are written
 * to the same rules as the product: decision support, not diagnosis; numbers
 * on the demo are illustrative; patients never see a raw score. The billing
 * answers come from the Pricing page so the two cannot drift apart.
 *
 * English and Arabic (QA issue 14). Questions and answers are English keys,
 * translated at render; answers with links render through tl() so the link
 * sits where the Arabic sentence needs it. Search runs on the translated text.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cx, EmptyState } from "@/components/ui/primitives";
import { ChevronDown, LinkIcon, MailIcon, SearchIcon, SparkIcon, XIcon } from "@/components/ui/icons";
import { t, tl } from "@/i18n";
import { SiteLayout } from "./SiteLayout";
import { FaqArt } from "./SiteArt";
import { PRICING_FAQ } from "./PricingPage";

type Category = "product" | "accuracy" | "privacy" | "patients" | "billing" | "demo";
type Item = { id: string; cat: Category; q: string; a: () => ReactNode; text: string };

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "product", label: "Product & clinical use" },
  { value: "accuracy", label: "Models & accuracy" },
  { value: "privacy", label: "Privacy & security" },
  { value: "patients", label: "Patients & carers" },
  { value: "billing", label: "Plans & billing" },
  { value: "demo", label: "This demo" },
];

/** `text` is the plain-text answer used for search; `a` overrides it when the answer needs links. */
const RAW: { id: string; cat: Category; q: string; text: string; a?: () => ReactNode }[] = [
  // Product & clinical use
  {
    id: "what-is-esap", cat: "product",
    q: "What does ESAP Clinical AI actually do?",
    text: "At the moment a patient is admitted, ESAP Clinical AI estimates five things from what is known at that point: a ranked differential diagnosis, in-hospital mortality, ICU admission, 30-day readmission and length of stay. Each estimate comes with the factors that drove it, its calibration state and its known limitations.",
  },
  {
    id: "does-it-diagnose", cat: "product",
    q: "Does ESAP Clinical AI diagnose patients or tell me what to do?",
    text: "No. ESAP Clinical AI is clinical decision support. It shows how likely outcomes are and why, so that a qualified clinician can weigh that alongside their own assessment. It never issues an instruction such as \"start antibiotics\", and it never ranks a worklist by risk by default.",
  },
  {
    id: "admission-only", cat: "product",
    q: "Why does it only use information from admission?",
    text: "Because that is when the decision is being made. A model that quietly uses results from later in the stay looks impressive in testing but cannot help at the bedside — and it learns from the treatment it is supposed to inform. Every input is cut at the admission time.",
  },
  {
    id: "who-is-it-for", cat: "product",
    q: "Who is ESAP Clinical AI for?",
    text: "Physicians, residents, nurses and case managers in the clinical workspace; hospital administrators and privacy officers in the admin console; and patients and carers in a separate plain-language portal. Each role sees only what it needs.",
  },
  {
    id: "ehr-integration", cat: "product",
    q: "Does it connect to our EHR?",
    text: "Not yet. HL7 v2 and FHIR connections are planned and are not running in this build. For now, an admission is entered by hand.",
  },

  // Models & accuracy
  {
    id: "how-accurate", cat: "accuracy",
    q: "How accurate are the models?",
    text: "The hosted demo serves placeholder models, so its estimates are not accurate predictions and there is no validated performance to report. Measured results appear on the Evidence page only when an evaluation is available on the server.",
    a: () => <p>{tl("The hosted demo serves **placeholder models**, so its estimates are not accurate predictions and there is no validated performance to report. Measured results appear on the {evidence} only when an evaluation is available on the server.", { evidence: <Link to="/evidence">{t("Evidence page")}</Link> })}</p>,
  },
  {
    id: "calibration", cat: "accuracy",
    q: "What does \"calibrated\" mean, and why does it matter?",
    text: "A calibrated model's 20% means roughly 20 in 100 similar patients have the outcome. A model can rank patients well and still be badly calibrated, which makes its numbers misleading at the bedside. ESAP Clinical AI shows the calibration state next to every estimate. Placeholder models are always shown as uncalibrated.",
  },
  {
    id: "no-estimate", cat: "accuracy",
    q: "Why is an estimate sometimes missing?",
    text: "A model can be turned off for a site or unit, or may not be included in a plan. Its estimate is then withheld and the screen says so. A missing estimate is not reassurance. When the information at admission is thin, the estimate is still shown but its Calibrated badge is removed.",
  },
  {
    id: "fairness", cat: "accuracy",
    q: "How do you make sure the models are fair?",
    text: "Race, ethnicity, insurance and marital status are never used as model inputs. They are recorded only so performance can be compared across groups. No subgroup evaluation has been run on these models yet, so there are no fairness results to report.",
  },
  {
    id: "training-data", cat: "accuracy",
    q: "What data were the models trained on?",
    text: "The models are developed offline on the de-identified MIMIC-IV research dataset. The serving application has no connection to that database and no path that sends patient data into model training.",
  },

  // Privacy & security
  {
    id: "who-owns-data", cat: "privacy",
    q: "Who owns the patient data?",
    text: "The hospital does. Before any pilot with real patients, the terms would be set in a data processing agreement. No such agreement is in place for this demo, which holds synthetic data only. See our Privacy Policy.",
    a: () => <p>{tl("The hospital does. Before any pilot with real patients, the terms would be set in a data processing agreement. No such agreement is in place for this demo, which holds synthetic data only. See our {privacy}.", { privacy: <Link to="/privacy">{t("Privacy Policy")}</Link> })}</p>,
  },
  {
    id: "hipaa-gdpr", cat: "privacy",
    q: "Is ESAP Clinical AI HIPAA and GDPR compliant?",
    text: "No compliance is claimed today. HIPAA, GDPR, Saudi PDPL, SOC 2 and HITRUST are all planned work, and no certification is held. This demo must only be used with synthetic data. See the Security page for what is built and what is planned.",
    a: () => <p>{tl("No compliance is claimed today. HIPAA, GDPR, Saudi PDPL, SOC 2 and HITRUST are all planned work, and no certification is held. This demo must only be used with synthetic data. See the {security} for what is built and what is planned.", { security: <Link to="/security">{t("Security page")}</Link> })}</p>,
  },
  {
    id: "who-can-see", cat: "privacy",
    q: "Can ESAP Clinical AI staff see our patients?",
    text: "Not by default. ESAP Clinical AI staff have no standing access to health data. Emergency access needs a named patient, a written reason, a ticket and a second approver, it expires automatically, and it is recorded in the platform audit log.",
  },
  {
    id: "audit-log", cat: "privacy",
    q: "Is every access to a record logged?",
    text: "Reads of patient records and consequential changes are recorded, and the application has no screen or API that edits an entry. Entries are kept for six years, then removed by the retention purge. Tamper-evident storage is planned.",
  },

  {
    id: "planned-security", cat: "privacy",
    q: "Which security controls are still planned?",
    text: "Encryption at rest, hospital single sign-on, tamper-evident audit storage, automated backups, a penetration test and hosting inside Saudi Arabia are among the items not built yet. The Security page has the full list.",
    a: () => <p>{tl("Encryption at rest, hospital single sign-on, tamper-evident audit storage, automated backups, a penetration test and hosting inside Saudi Arabia are among the items not built yet. The {security} has the full list.", { security: <Link to="/security">{t("Security page")}</Link> })}</p>,
  },

  // Patients & carers
  {
    id: "patient-scores", cat: "patients",
    q: "Will I see my risk scores?",
    text: "No. The patient portal never shows a raw number from a computer. You see only summaries that a named clinician has read and chosen to share with you, written in plain language.",
  },
  {
    id: "sharing", cat: "patients",
    q: "Can I share my information with family or a carer?",
    text: "Yes. From the portal you can invite someone and choose what they can see. Nothing is shared until you say so, and you can take that back at any time.",
  },
  {
    id: "correct-record", cat: "patients",
    q: "How do I see, correct or delete my record?",
    text: "Your medical record belongs to your hospital, so requests to correct or delete it go to the hospital's privacy officer. Closing your ESAP Clinical AI account stops you signing in, but it does not delete the hospital's record — hospitals are legally required to keep it.",
  },
  {
    id: "languages", cat: "patients",
    q: "Is ESAP available in Arabic?",
    text: "The patient portal, sign-in and this public website are available in English and Arabic, with right-to-left layout. Switch language with the language control at the top of the page. The clinical workspace is in English for now.",
  },

  // This demo
  {
    id: "real-data", cat: "demo",
    q: "Is any real patient data in this demo?",
    text: "No. Every patient, encounter and number in the demonstration build is synthetic. Please do not enter real patient information.",
  },
  {
    id: "try-it", cat: "demo",
    q: "How do I try it?",
    text: "Create a free individual account to try it. Reviewers and pilot hospitals are given their own sign-in by the ESAP team. Hospitals can join the early-access waitlist.",
    a: () => <p>{tl("{signup} to try it. Reviewers and pilot hospitals are given their own sign-in by the ESAP team. Hospitals can join the {waitlist}.", {
      signup: <Link to="/signup">{t("create a free individual account")}</Link>,
      waitlist: <Link to="/waitlist">{t("early-access waitlist")}</Link>,
    })}</p>,
  },
];

const ITEMS: Item[] = [
  ...RAW.map((r) => ({ ...r, a: r.a ?? (() => <p>{t(r.text)}</p>) })),
  ...PRICING_FAQ.map((f, i) => ({
    id: `billing-${i + 1}`, cat: "billing" as const, q: f.q, text: f.a, a: () => <p>{t(f.a)}</p>,
  })),
];

/** The three cards in the hero art: real questions from this page (English keys). */
const HERO_QUESTIONS = ["does-it-diagnose", "calibration", "who-owns-data"]
  .map((id) => ITEMS.find((i) => i.id === id)?.q)
  .filter((q): q is string => Boolean(q));

function normalise(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function FaqPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState<string | null>(null);

  // A link to /faq#<id> opens that answer and brings it into view.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || !ITEMS.some((i) => i.id === id)) return;
    setOpen(new Set([id]));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.({ block: "start" }));
  }, []);

  const results = useMemo(() => {
    const words = normalise(query).split(/\s+/).filter(Boolean);
    return ITEMS.filter((i) => {
      if (cat !== "all" && i.cat !== cat) return false;
      const hay = normalise(`${t(i.q)} ${t(i.text)}`);
      return words.every((w) => hay.includes(w));
    });
  }, [query, cat]);

  const searching = query.trim().length > 0;
  const groups = CATEGORIES
    .map((c) => ({ ...c, items: results.filter((i) => i.cat === c.value) }))
    .filter((g) => g.items.length > 0);

  const toggle = (id: string, isOpen: boolean) =>
    setOpen((prev) => {
      if (prev.has(id) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(id); else next.delete(id);
      return next;
    });

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/faq#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800);
    } catch {
      window.location.hash = id;
    }
  };

  const reset = () => { setQuery(""); setCat("all"); };

  return (
    <SiteLayout>
      <section className="hero hero-split faq-hero">
        <div className="hero-copy">
        <span className="hero-eyebrow"><SparkIcon size={14} /> {t("Frequently asked questions")}</span>
        <h1>{t("Answers, without the sales pitch.")}</h1>
        <p className="hero-lede">
          {t("What ESAP Clinical AI does and does not do, how far to trust its numbers, and what happens to the data. Can’t find your question? Ask us directly.")}
        </p>

        <div className="faq-search" role="search">
          <SearchIcon size={18} />
          <input
            type="search"
            className="faq-search-input"
            placeholder={t("Search questions — e.g. calibration, HIPAA, carer")}
            aria-label={t("Search frequently asked questions")}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          {query && (
            <button type="button" className="faq-search-clear" aria-label={t("Clear search")} onClick={() => setQuery("")}>
              <XIcon size={16} />
            </button>
          )}
        </div>
        </div>
        <FaqArt questions={HERO_QUESTIONS.map((q) => t(q))} />
      </section>

      <div className="faq-layout">
        <div className="faq-chips" role="group" aria-label={t("Filter by topic")}>
          {[{ value: "all" as const, label: "All topics" }, ...CATEGORIES].map((c) => {
            const count = c.value === "all" ? ITEMS.length : ITEMS.filter((i) => i.cat === c.value).length;
            return (
              <button
                key={c.value}
                type="button"
                className={cx("faq-chip", cat === c.value && "is-on")}
                aria-pressed={cat === c.value}
                onClick={() => setCat(c.value)}
              >
                {t(c.label)} <span className="tnum">{count}</span>
              </button>
            );
          })}
        </div>

        <p className="faq-count" aria-live="polite">
          {searching || cat !== "all"
            ? searching
              ? t(results.length === 1 ? "{n} answer for “{q}”" : "{n} answers for “{q}”", { n: results.length, q: query.trim() })
              : t(results.length === 1 ? "{n} answer" : "{n} answers", { n: results.length })
            : ""}
        </p>

        {groups.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={22} />}
            title={t("No answers match that")}
            message={t("Try a shorter or different word, or browse all topics. If it still isn't here, ask us directly.")}
            action={<button type="button" className="pub-btn pub-btn-outline" onClick={reset}>{t("Show all questions")}</button>}
          />
        ) : (
          groups.map((g) => (
            <section key={g.value} className="faq-group" aria-labelledby={`faq-h-${g.value}`}>
              <h2 id={`faq-h-${g.value}`}>{t(g.label)}</h2>
              <div className="faq-list">
                {g.items.map((i) => {
                  // While searching, every match opens so the answer is visible straight away.
                  const isOpen = searching || open.has(i.id);
                  return (
                    <details
                      key={i.id}
                      id={i.id}
                      className="faq-item"
                      open={isOpen}
                      onToggle={(e) => !searching && toggle(i.id, e.currentTarget.open)}
                    >
                      <summary>
                        <span>{t(i.q)}</span>
                        <ChevronDown size={18} className="faq-chevron" />
                      </summary>
                      <div className="faq-answer">
                        {i.a()}
                        <button type="button" className="faq-copy" onClick={() => copyLink(i.id)}>
                          <LinkIcon size={13} /> {copied === i.id ? t("Link copied") : t("Copy link to this answer")}
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <div className="faq-cta">
          <MailIcon size={20} />
          <div>
            <strong>{t("Still have a question?")}</strong>
            <p>
              {tl("Hospitals can {waitlist}; anyone can email {email}. Signed-in users can open a ticket from {support}.", {
                waitlist: <Link to="/waitlist">{t("talk to our team through the waitlist")}</Link>,
                email: <a href="mailto:support@esap.ai" lang="en" dir="ltr">support@esap.ai</a>,
                support: <Link to="/support">{t("Help & support")}</Link>,
              })}
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
