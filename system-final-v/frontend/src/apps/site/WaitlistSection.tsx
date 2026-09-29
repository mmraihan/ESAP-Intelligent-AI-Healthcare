/**
 * Waitlist form on the landing page, collected by Tally (Full Name, Email,
 * Message). Tally owns the fields and the submissions; this component only
 * frames the embed in the site's own layout.
 *
 * The form is set with VITE_TALLY_FORM_ID — either the bare id ("mOKxYz") or
 * any Tally link to it ("https://tally.so/r/mOKxYz"). Without one the section
 * still renders, with the email address as the only way in, so a missing
 * setting never ships an empty box.
 */
import { useEffect } from "react";
import { SparkIcon } from "@/components/ui/icons";

const CONTACT_EMAIL = "info@esap.ai";
const TALLY_SCRIPT = "https://tally.so/widgets/embed.js";

const rawFormId =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TALLY_FORM_ID ?? "";

/** Accepts a bare id or a tally.so/r/… or tally.so/embed/… link. */
export function tallyFormId(raw: string): string {
  const trimmed = raw.trim();
  const fromUrl = trimmed.match(/tally\.so\/(?:r|embed|forms)\/([A-Za-z0-9]+)/);
  return fromUrl ? fromUrl[1] : trimmed.replace(/[^A-Za-z0-9]/g, "");
}

const FORM_ID = tallyFormId(rawFormId);

type TallyWindow = Window & { Tally?: { loadEmbeds: () => void } };

/** Tally's own loader, minus the inline <script>: dynamic height needs embed.js. */
function loadTallyEmbeds() {
  const w = window as TallyWindow;
  const showWithoutScript = () =>
    document.querySelectorAll<HTMLIFrameElement>("iframe[data-tally-src]:not([src])").forEach((f) => {
      f.src = f.dataset.tallySrc ?? "";
    });
  if (w.Tally) return w.Tally.loadEmbeds();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TALLY_SCRIPT}"]`);
  if (existing) {
    existing.addEventListener("load", () => w.Tally?.loadEmbeds());
    return;
  }
  const s = document.createElement("script");
  s.src = TALLY_SCRIPT;
  s.async = true;
  s.onload = () => (w.Tally ? w.Tally.loadEmbeds() : showWithoutScript());
  s.onerror = showWithoutScript;
  document.body.appendChild(s);
}

export function WaitlistSection() {
  useEffect(() => {
    if (FORM_ID) loadTallyEmbeds();
  }, []);

  return (
    <section id="waitlist" className="waitlist" aria-labelledby="waitlist-title">
      <div className="waitlist-copy">
        <span className="hero-eyebrow"><SparkIcon size={14} /> Join the waitlist</span>
        <h2 id="waitlist-title">
          Be first on the ward.<br />
          <span className="waitlist-accent">We&rsquo;ll bring the pilot to you.</span>
        </h2>
        <p className="hero-lede">
          Tell us who you are and what you would want ESAP to answer at admission. We are onboarding
          hospitals in small groups, and the waitlist decides who goes next.
        </p>
      </div>

      <div className="waitlist-card">
        {FORM_ID ? (
          <iframe
            data-tally-src={`https://tally.so/embed/${FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`}
            loading="lazy"
            width="100%"
            height={420}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title="ESAP Healthcare waitlist"
            className="waitlist-frame"
          />
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            The waitlist form is not connected yet. Email us and we will add you by hand.
          </p>
        )}
        <p className="waitlist-foot">
          For any inquiries, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </section>
  );
}
