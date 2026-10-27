/**
 * Privacy Policy and Terms & Conditions (public, /privacy and /terms).
 *
 * Both documents share one layout: a plain-language summary, a sticky table of
 * contents that tracks the section in view, and numbered sections. The copy is
 * written to match what the product actually does (§15) — decision support, not
 * diagnosis; the hospital as data controller; no audit covariates as model
 * inputs — and is marked as a draft until counsel has reviewed it.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banner } from "@/components/ui/primitives";
import { AlertIcon, BookIcon, CheckIcon, FileIcon, MailIcon } from "@/components/ui/icons";
import { SiteLayout } from "./SiteLayout";
import { LegalArt, PrivacyArt } from "./SiteArt";

type Section = { id: string; title: string; body: ReactNode };

const EFFECTIVE = "27 October 2026";
const VERSION = "Draft 0.9";

/** Highlights the table-of-contents entry for the section nearest the top of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list is static per page
  }, [ids.join(",")]);
  return active;
}

function LegalDoc({
  eyebrow, title, lede, summary, sections, sibling, art,
}: {
  eyebrow: string;
  title: string;
  lede: ReactNode;
  summary: string[];
  sections: Section[];
  sibling: { to: string; label: string };
  /** Hero art; defaults to the document stack. */
  art?: ReactNode;
}) {
  const ids = sections.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <SiteLayout>
      <section className="hero hero-split legal-hero">
        <div className="hero-copy">
        <span className="hero-eyebrow"><FileIcon size={14} /> {eyebrow}</span>
        <h1>{title}</h1>
        <p className="hero-lede">{lede}</p>
        <p className="legal-meta tnum">
          <span>Effective {EFFECTIVE}</span>
          <span aria-hidden="true">·</span>
          <span>{VERSION}</span>
          <span aria-hidden="true">·</span>
          <Link to={sibling.to}>{sibling.label}</Link>
        </p>
        </div>
        {art ?? <LegalArt title={eyebrow} lines={sections.map((x) => x.title)} />}
      </section>

      <div className="legal-layout">
        <nav className="legal-toc" aria-label="On this page">
          <strong>On this page</strong>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
                  <span className="tnum">{i + 1}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="legal-body">
          <Banner tone="warning" icon={<AlertIcon size={16} />} title="Draft — not yet reviewed by counsel">
            This text describes how the demonstration build is designed to behave. It has not been
            reviewed by a lawyer and is not a contract. A hospital customer&rsquo;s signed agreement and
            Business Associate Agreement take precedence over anything written here.
          </Banner>

          <div className="legal-summary">
            <strong><BookIcon size={16} /> The short version</strong>
            <ul>
              {summary.map((s) => <li key={s}><CheckIcon size={14} /> <span>{s}</span></li>)}
            </ul>
          </div>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-section">
              <h2><span className="tnum">{i + 1}.</span> {s.title}</h2>
              {s.body}
            </section>
          ))}

          <div className="legal-contact">
            <MailIcon size={18} />
            <p>
              Questions about this document go to the ESAP Clinical AI team at{" "}
              <a href="mailto:support@esap.ai">support@esap.ai</a>. If you are a hospital
              patient, the quickest route is usually your hospital&rsquo;s own privacy officer.
            </p>
          </div>
        </article>
      </div>
    </SiteLayout>
  );
}

// --- Privacy Policy ----------------------------------------------------------

const PRIVACY_SUMMARY = [
  "Your hospital owns your medical record. ESAP Clinical AI processes it on the hospital's behalf and under its instructions.",
  "We never sell personal data, and we never train models on a hospital's patients without a separate, explicit agreement.",
  "Race, insurance and marital status are never used as model inputs. They are used only to check the models are fair.",
  "Every read of a record is logged, and the log cannot be edited or deleted — by anyone, including us.",
  "You can ask to see, correct or export your data. We will tell you exactly who to ask.",
];

const PRIVACY_SECTIONS: Section[] = [
  {
    id: "who-we-are",
    title: "Who we are and what this covers",
    body: (
      <>
        <p>
          ESAP Clinical AI (&ldquo;we&rdquo;) provides clinical decision-support
          software to hospitals and to individual healthcare professionals, and a plain-language
          portal for patients and carers. This policy covers this website, the clinician workspace,
          the hospital admin console and the patient portal.
        </p>
        <p>
          ESAP Clinical AI is decision support. It does not diagnose and it does not make treatment decisions. A
          qualified clinician reviews every estimate independently.
        </p>
      </>
    ),
  },
  {
    id: "roles",
    title: "Who is responsible for your data",
    body: (
      <>
        <p>Responsibility depends on how you reach ESAP Clinical AI:</p>
        <ul>
          <li>
            <strong>Through a hospital.</strong> The hospital is the covered entity (HIPAA) or data
            controller (GDPR). ESAP Clinical AI is its business associate or processor and acts only on its
            written instructions, under a Business Associate Agreement and a data processing
            agreement.
          </li>
          <li>
            <strong>With an individual account.</strong> For a clinician or patient who signs up
            directly, ESAP Clinical AI is responsible for the account data itself.
          </li>
          <li>
            <strong>On this website.</strong> ESAP Clinical AI is responsible for what you send us — for example,
            a waitlist request.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Account data</strong> — name, email, role, organisation, and an optional licence number. Passwords are stored only as a salted hash.</li>
        <li><strong>Clinical data</strong> — admission information a hospital or clinician enters or connects through an integration: demographics, vital signs, laboratory results, medications, history and notes.</li>
        <li><strong>Usage and audit data</strong> — who opened which record, when, and why; which estimates were viewed; sign-in events and device details. This exists because the law and good practice require it.</li>
        <li><strong>Waitlist and support requests</strong> — whatever you choose to tell us, plus your consent to be contacted.</li>
        <li><strong>Preferences stored on your device</strong> — your theme and language choice. This stays in your browser.</li>
      </ul>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <>
        <ul>
          <li>To produce the calibrated estimates a clinician asked for, along with their drivers and limitations.</li>
          <li>To run accounts, access control and the audit log.</li>
          <li>To keep the service secure, monitor calibration drift and investigate incidents.</li>
          <li>To answer waitlist and support requests you sent us.</li>
        </ul>
        <p>
          Model development happens against a de-identified research dataset that is physically
          separate from production tenant data. Improving a model does not require anyone to look at a
          hospital&rsquo;s patients.
        </p>
      </>
    ),
  },
  {
    id: "fairness",
    title: "Sensitive attributes and fairness",
    body: (
      <p>
        Race, ethnicity, insurance type and marital status are <strong>never</strong> used as inputs to
        any model. Where a hospital supplies them, they are used only to audit whether the models
        perform equally well across groups. The results appear on the fairness panel the
        hospital&rsquo;s privacy officer can read.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We do not sell personal data, and we do not use it for advertising. We share it only:</p>
        <ul>
          <li>with the hospital that holds the record, and the staff it authorises;</li>
          <li>with people a patient chooses to share with through the portal — and only until the patient withdraws that;</li>
          <li>with sub-processors listed in our published register (for example, hosting), under contracts at least as strict as this policy. Hospitals get 30 days&rsquo; notice before we add a sub-processor with access to health data, and can object;</li>
          <li>where the law requires it. If a request is not prohibited from being disclosed, we tell the hospital first.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Data is encrypted at rest (AES-256, tenant-scoped keys) and in transit (TLS 1.3). Access is
        role-based and limited to what each role needs. ESAP Clinical AI staff have no standing access to health
        data; emergency access needs a named patient, a written reason, a second approver and expires
        within 60 minutes. The full list of controls is on the{" "}
        <Link to="/security">Security page</Link>.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li><strong>Clinical data</strong> — for as long as the hospital&rsquo;s contract and its own retention rules require, then returned or deleted as the hospital instructs.</li>
        <li><strong>Audit log</strong> — six years. It is append-only, so it cannot be changed or shortened early.</li>
        <li><strong>Individual accounts</strong> — until you close the account, plus up to 30 days in backups.</li>
        <li><strong>Waitlist requests</strong> — until you ask us to remove them, or 24 months without contact.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>
          Depending on where you live, you can ask to see, correct, export, restrict or delete your
          personal data, and you can object to some uses of it. For a hospital record, the request
          goes to the hospital — it decides, and we help it carry out the decision. You can find the
          right contact under <Link to="/patient/sharing">Your data rights</Link> in the patient
          portal.
        </p>
        <p>
          Closing an ESAP Clinical AI account does not delete a hospital medical record. Hospitals are legally
          required to keep those. You can complain to your data protection authority or, in the US,
          to the Office for Civil Rights at the Department of Health and Human Services.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Where data is stored",
    body: (
      <p>
        A hospital chooses its residency when its account is set up: the US, the EU, or its own data
        centre. Data does not leave that region except under a lawful transfer mechanism the
        hospital has approved. Benchmarking uses aggregate counts only, and only if the hospital opts
        in.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <p>
        We use only what the service needs to work: a session token to keep you signed in, and your
        theme and language preferences, stored in your browser. There are no advertising or
        cross-site tracking cookies.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Individual accounts are for adults. A child&rsquo;s record is reached only through their
        hospital, or by a parent or guardian with proxy access the hospital has granted.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we make a material change, we will post it here with a new effective date and notify
        account holders by email at least 30 days in advance. Hospital customers are notified as
        their agreement requires.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Privacy Policy"
      title="How ESAP Clinical AI handles personal and health data."
      lede="What we collect, why we collect it, who can see it, and how to use your rights. Written to match how the product actually works."
      summary={PRIVACY_SUMMARY}
      sections={PRIVACY_SECTIONS}
      sibling={{ to: "/terms", label: "Read the Terms & Conditions" }}
      art={<PrivacyArt />}
    />
  );
}

// --- Terms & Conditions ------------------------------------------------------

const TERMS_SUMMARY = [
  "ESAP Clinical AI is decision support for qualified clinicians. It is not a diagnosis, and it is not a substitute for clinical judgement.",
  "Clinician accounts are only for people with a clinical qualification, who use the estimates alongside their own judgement.",
  "Patients see only what a named clinician has read and released — never a raw score.",
  "Do not try to reach data you are not authorised to see. Every access is logged.",
  "A hospital's signed agreement takes precedence over these terms.",
];

const TERMS_SECTIONS: Section[] = [
  {
    id: "acceptance",
    title: "Agreeing to these terms",
    body: (
      <p>
        By creating an account or using ESAP Clinical AI, you agree to these terms and to the{" "}
        <Link to="/privacy">Privacy Policy</Link>. If you use ESAP Clinical AI through a hospital, your
        hospital&rsquo;s agreement with ESAP Clinical AI also applies, and it takes precedence where the two
        differ.
      </p>
    ),
  },
  {
    id: "not-medical-advice",
    title: "What ESAP Clinical AI is, and what it is not",
    body: (
      <>
        <p>
          ESAP Clinical AI shows calibrated probability estimates, the factors that drove them, how confident the
          calibration is, and their known limitations. It is designed to let a healthcare professional
          review the basis of every estimate independently.
        </p>
        <p>
          <strong>ESAP Clinical AI does not diagnose, does not decide treatment, and is not medical advice.</strong>{" "}
          An estimate describes a population-level likelihood. It is not a prediction about a specific
          person. In an emergency, contact emergency services or your care team directly.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Accounts and eligibility",
    body: (
      <ul>
        <li><strong>Clinician accounts</strong> require you to confirm that you hold a clinical qualification. You agree to use the estimates as decision support alongside your own judgement, and not to present them to a patient as a diagnosis or a prognosis.</li>
        <li><strong>Patient and carer accounts</strong> are for adults managing their own care or, with the hospital&rsquo;s permission, someone else&rsquo;s.</li>
        <li><strong>Hospital accounts</strong> are created by invitation only. The hospital decides who has access and at what level.</li>
        <li>You are responsible for keeping your sign-in details private. Tell us straight away if you think someone else has used them.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>open a record without a legitimate care, operational or legal reason;</li>
          <li>try to get around access controls, rate limits or the audit log;</li>
          <li>enter data you are not authorised to share;</li>
          <li>reverse-engineer, scrape or resell the models or their outputs;</li>
          <li>use ESAP Clinical AI to make automated decisions about a person with no clinician involved;</li>
          <li>present an estimate as something it is not — for example, as a guaranteed outcome.</li>
        </ul>
        <p>We may suspend an account that breaks these rules. Suspension never deletes clinical records or audit entries.</p>
      </>
    ),
  },
  {
    id: "clinical-responsibility",
    title: "Clinical responsibility",
    body: (
      <p>
        Clinical decisions remain the responsibility of the treating clinician and the hospital. Where
        the input is too thin to calibrate an estimate, the estimate is suppressed rather than shown
        with a caveat. A missing estimate is not a reassurance, and a present one is not an
        instruction.
      </p>
    ),
  },
  {
    id: "data",
    title: "Your data",
    body: (
      <p>
        Hospitals keep ownership of their records, and individuals keep ownership of what they
        enter. You give ESAP Clinical AI permission to process that data only to provide the service, as
        described in the <Link to="/privacy">Privacy Policy</Link>. We do not train models on
        customer patient data without a separate, explicit agreement.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    body: (
      <p>
        ESAP Clinical AI keeps all rights in the software, the models, the model documentation and this website.
        You may use the outputs inside your own clinical and operational work. Feedback you send us
        may be used to improve the product, without any obligation to you.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes to the service",
    body: (
      <p>
        We work to keep ESAP Clinical AI available, but we do not promise it will be uninterrupted. Hospital
        service levels are set out in each hospital&rsquo;s contract. Model updates are rolled out in
        stages, each with its own documentation, and a hospital can see which model version produced
        each estimate.
      </p>
    ),
  },
  {
    id: "demo",
    title: "Demonstration and early-access builds",
    body: (
      <p>
        Demonstration builds use synthetic data only and are provided &ldquo;as is&rdquo;. Numbers
        shown on them are illustrative, not validated performance claims. Do not enter real patient
        information into a demonstration build.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Warranties and liability",
    body: (
      <p>
        To the extent the law allows, ESAP Clinical AI is provided without warranties beyond those stated in a
        signed agreement. We are not liable for indirect or consequential loss. Nothing in these
        terms limits liability that cannot legally be limited, including for death or personal
        injury caused by negligence.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending your account",
    body: (
      <p>
        You can close an individual account at any time from its settings. When you close it, you
        can export your data for 30 days, and after that it is deleted. Audit entries and any hospital
        record stay in place, because the law requires it.
      </p>
    ),
  },
  {
    id: "law",
    title: "Changes and governing law",
    body: (
      <p>
        We will give at least 30 days&rsquo; notice of any material change to these terms. If you keep
        using ESAP Clinical AI after that, you accept the change. The governing law and venue for disputes are
        set out in each hospital&rsquo;s agreement. For individual accounts, they will be confirmed
        before general availability.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Terms & Conditions"
      title="The terms for using ESAP Clinical AI."
      lede="What ESAP Clinical AI is for, who may use it, and what each side is responsible for — starting with the most important part: it supports clinical judgement and never replaces it."
      summary={TERMS_SUMMARY}
      sections={TERMS_SECTIONS}
      sibling={{ to: "/privacy", label: "Read the Privacy Policy" }}
      art={<LegalArt title="Terms & Conditions" lines={TERMS_SECTIONS.map((x) => x.title)} signed />}
    />
  );
}
