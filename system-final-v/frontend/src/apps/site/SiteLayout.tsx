/** Shell for the public marketing and evidence pages (§16). */
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BrandMark } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button, cx } from "@/components/ui/primitives";

const LINKS = [
  { to: "/product", label: "Product" },
  { to: "/evidence", label: "Evidence" },
  { to: "/security", label: "Security" },
  { to: "/pricing", label: "Pricing" },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="site">
      <header className="site-nav glass">
        <div className="row" style={{ gap: 20, alignItems: "center" }}>
          <Link to="/product" className="brand-link"><BrandMark /></Link>
          <nav className="site-nav-links" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => cx("site-link", isActive && "is-active")}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <ThemeToggle compact />
          <Button size="sm" onClick={() => nav("/login")}>Sign in</Button>
          <Button size="sm" variant="primary" onClick={() => nav("/signup")}>Try it free</Button>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-foot">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <div style={{ maxWidth: "44ch" }}>
            <BrandMark />
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 10 }}>
              ESAP is clinical decision support. It does not diagnose, and it does not make treatment
              decisions. A qualified clinician reviews every estimate independently.
            </p>
          </div>
          <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 12 }}>Product</strong>
              {LINKS.map((l) => <Link key={l.to} to={l.to} className="site-link" style={{ padding: 0 }}>{l.label}</Link>)}
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 12 }}>For clinicians</strong>
              <Link to="/help" className="site-link" style={{ padding: 0 }}>How to read a result</Link>
              <Link to="/models" className="site-link" style={{ padding: 0 }}>Model basis</Link>
              <Link to="/design" className="site-link" style={{ padding: 0 }}>Design system</Link>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 12 }}>For patients</strong>
              <Link to="/welcome" className="site-link" style={{ padding: 0 }}>Patient portal</Link>
              <Link to="/patient/sharing" className="site-link" style={{ padding: 0 }}>Your data rights</Link>
            </div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          Demonstration build. All data shown is synthetic — no real patient information appears
          anywhere in this application.
        </p>
      </footer>
    </div>
  );
}
