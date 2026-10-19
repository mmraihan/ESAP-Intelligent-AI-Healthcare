/**
 * Shell for the public marketing and evidence pages (§16).
 *
 * SiteHeader and SiteFooter are shared with the landing page, so every public
 * page has one nav and one footer. Styles live in styles/public.css; the `pub`
 * root gives the public palette (reference: additional-files/reference-files).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cx } from "@/components/ui/primitives";
import { MenuIcon, XIcon } from "@/components/ui/icons";

const LINKS = [
  { to: "/product", label: "Product" },
  { to: "/evidence", label: "Evidence" },
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" },
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
      {l.label}
    </Link>
  );

  return (
    <header className={cx("pub-nav", (scrolled || menuOpen) && "is-scrolled")}>
      <div className="pub-wrap pub-nav-inner">
        <Link to="/product" className="brand-link" aria-label="ESAP Clinical AI — product home"><BrandMark /></Link>
        <nav className="pub-nav-links" aria-label="Main">{LINKS.map((l) => link(l, "pub-link"))}</nav>
        <div className="pub-nav-actions">
          <ThemeToggle compact />
          <Link to="/login" className="pub-btn pub-btn-outline pub-btn-sm pub-nav-signin">Sign in</Link>
          <Link to="/signup" className="pub-btn pub-btn-primary pub-btn-sm">Try it free</Link>
          <button
            type="button"
            className="pub-menu-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
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
            <ThemeToggle compact />
            <Link to="/login" className="pub-btn pub-btn-outline">Sign in</Link>
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
              ESAP is clinical decision support. It does not diagnose, and it does not make treatment
              decisions. A qualified clinician reviews every estimate independently.
            </p>
          </div>
          <div className="pub-foot-cols">
            <nav aria-label="Product">
              <strong>Product</strong>
              {LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            </nav>
            <nav aria-label="For clinicians">
              <strong>For clinicians</strong>
              <Link to="/help">How to read a result</Link>
              <Link to="/models">Model basis</Link>
              <Link to="/design">Design system</Link>
            </nav>
            <nav aria-label="For patients">
              <strong>For patients</strong>
              <Link to="/welcome">Patient portal</Link>
              <Link to="/patient/sharing">Your data rights</Link>
            </nav>
          </div>
        </div>
        <p className="pub-foot-note">
          Demonstration build. All data shown is synthetic — no real patient information appears anywhere in
          this application.
        </p>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pub site">
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
