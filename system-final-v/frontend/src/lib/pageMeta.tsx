/**
 * A title per page, a canonical link, and noindex for everything behind
 * sign-in (QA issue 12). Every page used to be titled "ESAP Intelligent AI
 * Healthcare", which reads the same in every tab and every search result.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://care.esap.ai";
const SITE = "ESAP Clinical AI";

const PUBLIC: Record<string, string> = {
  "/": "Decision support at hospital intake",
  "/product": "Decision support at hospital intake",
  "/evidence": "Model evidence",
  "/security": "Security and compliance",
  "/pricing": "Pricing",
  "/faq": "Questions and answers",
  "/waitlist": "Join the waitlist",
  "/privacy": "Privacy policy",
  "/terms": "Terms of service",
};

const SECTIONS: [string, string][] = [
  ["/login", "Sign in"], ["/signup", "Create an account"], ["/reset-password", "Reset your password"],
  ["/invite/", "Accept an invitation"], ["/caregiver/", "Carer access"], ["/welcome", "Welcome"],
  ["/doctor/worklist", "Worklist"], ["/doctor/encounters/new", "New encounter"], ["/doctor/discharge", "Discharge planning"],
  ["/doctor/encounters/", "Encounter"], ["/nurse/", "Nursing"], ["/models", "Model basis"], ["/help", "Help"],
  ["/admin/", "Hospital admin"], ["/ops/", "Platform operations"], ["/patient/", "Patient portal"],
  ["/design", "Design system"], ["/account", "Account and security"], ["/support", "Help and support"],
];

function titleFor(pathname: string): { title: string; indexable: boolean } {
  if (pathname in PUBLIC) return { title: PUBLIC[pathname], indexable: true };
  const hit = SECTIONS.find(([p]) => pathname === p || pathname.startsWith(p));
  return { title: hit ? hit[1] : "Page not found", indexable: false };
}

function setMeta(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
}

export function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const { title, indexable } = titleFor(pathname);
    document.title = `${title} · ${SITE}`;
    const canonical = `${ORIGIN}${pathname === "/product" ? "/" : pathname}`;
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }),
      (el) => el.setAttribute("href", canonical));
    setMeta('meta[property="og:url"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:url"); return m; },
      (el) => el.setAttribute("content", canonical));
    setMeta('meta[property="og:title"]', () => { const m = document.createElement("meta"); m.setAttribute("property", "og:title"); return m; },
      (el) => el.setAttribute("content", `${title} · ${SITE}`));
    setMeta('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" }),
      (el) => el.setAttribute("content", indexable ? "index, follow" : "noindex, nofollow"));
  }, [pathname]);
  return null;
}
