/**
 * Privacy Policy and Terms & Conditions (public, /privacy and /terms).
 *
 * Both documents share one layout: a plain-language summary, a sticky table of
 * contents that tracks the section in view, and numbered sections. The text
 * lives in legalContent.ts in English and Arabic (QA issues 3 and 14); the
 * language switch here sets lang="ar" and dir="rtl" for the whole page. Both
 * are marked as drafts until counsel has reviewed them.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banner } from "@/components/ui/primitives";
import { AlertIcon, BookIcon, CheckIcon, FileIcon, MailIcon } from "@/components/ui/icons";
import { currentLang } from "@/i18n";
import { SiteLayout } from "./SiteLayout";
import { LegalArt, PrivacyArt } from "./SiteArt";
import { EFFECTIVE, LEGAL, LEGAL_UI, VERSION, type Block, type LegalText } from "./legalContent";

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

function BlockView({ block }: { block: Block }) {
  if ("p" in block) return <p>{block.p}</p>;
  return <ul>{block.ul.map((x) => <li key={x}>{x}</li>)}</ul>;
}

function LegalDoc({ doc, sibling, art }: { doc: LegalText; sibling: { to: string; label: string }; art?: ReactNode }) {
  const lang = currentLang();
  const ui = LEGAL_UI[lang];
  const ids = doc.sections.map((s) => s.id);
  const active = useActiveSection(ids);

  return (
    <SiteLayout>
      <section className="hero hero-split legal-hero">
        <div className="hero-copy">
          <span className="hero-eyebrow"><FileIcon size={14} /> {doc.eyebrow}</span>
          <h1>{doc.title}</h1>
          <p className="hero-lede">{doc.lede}</p>
          <p className="legal-meta tnum">
            <span>{ui.effective} {EFFECTIVE[lang]}</span>
            <span aria-hidden="true">·</span>
            <span>{VERSION[lang]}</span>
            <span aria-hidden="true">·</span>
            <Link to={sibling.to}>{sibling.label}</Link>
          </p>
        </div>
        {art ?? <LegalArt title={doc.eyebrow} lines={doc.sections.map((x) => x.title)} />}
      </section>

      <div className="legal-layout">
        <nav className="legal-toc" aria-label={ui.onThisPage}>
          <strong>{ui.onThisPage}</strong>
          <ol>
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} aria-current={active === s.id ? "location" : undefined}>
                  <span className="tnum">{i + 1}.</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="legal-body">
          <Banner tone="warning" icon={<AlertIcon size={16} />} title={ui.draftTitle}>{ui.draftBody}</Banner>

          <div className="legal-summary">
            <strong><BookIcon size={16} /> {ui.shortVersion}</strong>
            <ul>
              {doc.summary.map((s) => <li key={s}><CheckIcon size={14} /> <span>{s}</span></li>)}
            </ul>
          </div>

          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="legal-section">
              <h2><span className="tnum">{i + 1}.</span> {s.title}</h2>
              {s.blocks.map((b, j) => <BlockView key={j} block={b} />)}
            </section>
          ))}

          <div className="legal-contact">
            <MailIcon size={18} />
            <p>{ui.contact}</p>
          </div>
        </article>
      </div>
    </SiteLayout>
  );
}

export function PrivacyPage() {
  const lang = currentLang();
  return (
    <LegalDoc
      doc={LEGAL.privacy[lang]}
      sibling={{ to: "/terms", label: LEGAL_UI[lang].readTerms }}
      art={<PrivacyArt />}
    />
  );
}

export function TermsPage() {
  const lang = currentLang();
  const doc = LEGAL.terms[lang];
  return (
    <LegalDoc
      doc={doc}
      sibling={{ to: "/privacy", label: LEGAL_UI[lang].readPrivacy }}
      art={<LegalArt title={doc.eyebrow} lines={doc.sections.map((x) => x.title)} signed />}
    />
  );
}
