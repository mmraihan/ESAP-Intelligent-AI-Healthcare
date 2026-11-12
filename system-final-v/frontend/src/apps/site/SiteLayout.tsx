/**
 * Shell for the public marketing and evidence pages (§16).
 *
 * SiteHeader and SiteFooter are shared with the landing page, so every public
 * page has one nav and one footer. Styles live in styles/public.css; the `pub`
 * root gives the public palette (reference: additional-files/reference-files).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/shell/AppShell";
import { DemoBadge } from "@/components/ui/domain";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cx } from "@/components/ui/primitives";
import { LanguageToggle, t } from "@/i18n";
import { MenuIcon, XIcon } from "@/components/ui/icons";
import "@/styles/site-art.css";

const LINKS = [
  { to: "/product", label: "Product" },
  { to: "/evidence", label: "Evidence" },
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" },
  { to: "/waitlist", label: "Waitlist" },
  { to: "/faq", label: "FAQ" },
];

/** "/" shows the product page to a signed-out visitor, so "Product" is current there too. */
function isCurrent(to: string, pathname: string) {
  return to === "/product" ? pathname === "/" || pathname === "/product" : pathname === to;
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The bar gains a shadow once the page scrolls under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const link = (l: (typeof LINKS)[number], className: string) => (
    <Link
      key={l.to}
      to={l.to}
      className={className}
      aria-current={isCurrent(l.to, pathname) ? "page" : undefined}
    >
      {t(l.label)}
    </Link>
  );

  return (
    <header className={cx("pub-nav", (scrolled || menuOpen) && "is-scrolled")}>
      <div className="pub-wrap pub-nav-inner">
        <Link to="/product" className="brand-link" aria-label={t("ESAP Clinical AI — product home")}><BrandMark /></Link>
        <DemoBadge />
        <nav className="pub-nav-links" aria-label="Main">{LINKS.map((l) => link(l, "pub-link"))}</nav>
        <div className="pub-nav-actions">
          <span className="pub-nav-lang"><LanguageToggle compact /></span>
          <ThemeToggle compact />
          <Link to="/login" className="pub-btn pub-btn-outline pub-btn-sm pub-nav-signin">{t("Sign in")}</Link>
          <Link to="/signup" className="pub-btn pub-btn-primary pub-btn-sm">{t("Try it free")}</Link>
          <button
            type="button"
            className="pub-menu-btn"
            aria-label={menuOpen ? t("Close menu") : t("Open menu")}
            aria-expanded={menuOpen}
            aria-controls="pub-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="pub-mobile-menu" className="pub-mobile" aria-label="Main">
          {LINKS.map((l) => link(l, ""))}
          <div className="pub-mobile-row">
            <LanguageToggle compact />
            <ThemeToggle compact />
            <Link to="/login" className="pub-btn pub-btn-outline">{t("Sign in")}</Link>
            <Link to="/signup" className="pub-btn pub-btn-primary">{t("Try it free")}</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="pub-foot">
      <div className="pub-wrap">
        <div className="pub-foot-inner">
          <div className="pub-foot-brand">
            <BrandMark />
            <p>
              {t("ESAP is clinical decision support. It does not diagnose, and it does not make treatment decisions. A qualified clinician reviews every estimate independently.")}
            </p>
          </div>
          <div className="pub-foot-cols">
            <nav aria-label="Product">
              <strong>{t("Product")}</strong>
              {LINKS.filter((l) => l.to !== "/faq").map((l) => <Link key={l.to} to={l.to}>{t(l.label)}</Link>)}
            </nav>
            <nav aria-label="For clinicians">
              <strong>{t("For clinicians")}</strong>
              <Link to="/help">{t("How to read a result")}</Link>
              <Link to="/models">{t("Model basis")}</Link>
            </nav>
            <nav aria-label="For patients">
              <strong>{t("For patients")}</strong>
              <Link to="/welcome">{t("Patient portal")}</Link>
              <Link to="/patient/sharing">{t("Your data rights")}</Link>
            </nav>
            <nav aria-label="Help">
              <strong>{t("Help")}</strong>
              <Link to="/faq">{t("FAQ")}</Link>
              <Link to="/waitlist">{t("Talk to us")}</Link>
            </nav>
            <nav aria-label="Legal">
              <strong>{t("Legal")}</strong>
              <Link to="/privacy">{t("Privacy Policy")}</Link>
              <Link to="/terms">{t("Terms & Conditions")}</Link>
              <Link to="/security">{t("Security & compliance")}</Link>
            </nav>
          </div>
        </div>
        <div className="pub-foot-note">
          <p>
            {t("Demonstration build. All data shown is synthetic — no real patient information appears anywhere in this application.")}
          </p>
          <span className="pub-foot-legal">
            <Link to="/privacy">{t("Privacy")}</Link>
            <Link to="/terms">{t("Terms")}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Sections below the hero rise in the first time they scroll into view.
 *
 * Only elements present at mount are marked, so anything rendered later (a
 * form's success state, an error banner) is never left hidden. No observer, or
 * reduced motion: nothing is marked and everything is simply shown.
 */
function useSectionReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches) return;
    const items = Array.from(root.children).slice(1) as HTMLElement[]; // the hero shows at once
    const below = items.filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9);
    below.forEach((el) => el.setAttribute("data-site-reveal", ""));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.setAttribute("data-shown", "");
        io.unobserve(e.target);
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    below.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const mainRef = useSectionReveal();
  return (
    <div className="pub site">
      <SiteHeader />
      <main className="site-main" ref={mainRef}>{children}</main>
      <SiteFooter />
    </div>
  );
}
