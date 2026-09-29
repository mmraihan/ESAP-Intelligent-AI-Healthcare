/**
 * The shared primitive set — PRODUCT_BLUEPRINT §11.3 and §14.5.
 * Built once here so the clinician, admin, ops and patient surfaces inherit one
 * visual language instead of improvising per screen.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cloneElement, isValidElement, useId, useState } from "react";
import { AlertIcon, CheckIcon, ChevronDown, InfoIcon, SearchIcon, XIcon } from "./icons";
import { t } from "@/i18n";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

// --- Buttons ----------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({ variant = "default", size = "md", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// --- Surfaces ---------------------------------------------------------------

export function Card({
  title, subtitle, actions, footnote, className, padded = true, children,
}: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; footnote?: ReactNode;
  className?: string; padded?: boolean; children?: ReactNode;
}) {
  return (
    <section className={cx("card", !padded && "card-flush", className)}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-head-text">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
      {footnote && <p className="card-footnote">{footnote}</p>}
    </section>
  );
}

export function PageHeader({
  eyebrow, title, lede, actions, meta,
}: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, hint, actions, children }: { title: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h2 className="section-title">{title}</h2>
          {hint && <p className="muted" style={{ fontSize: 13, margin: "2px 0 0" }}>{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** KPI tile. The number is tabular and never smaller than 24px (§14.2.2). */
export function StatTile({
  label, value, unit, delta, hint, tone = "neutral", icon,
}: {
  label: ReactNode; value: ReactNode; unit?: string; delta?: { dir: "up" | "down" | "flat"; label: string };
  hint?: ReactNode; tone?: "neutral" | "good" | "warning" | "critical"; icon?: ReactNode;
}) {
  return (
    <div className={cx("stat-tile", `tone-${tone}`)}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value tnum">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {delta && (
        <span className={cx("stat-delta", `dir-${delta.dir}`)}>
          {delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "■"} {delta.label}
        </span>
      )}
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  );
}

// --- Feedback ---------------------------------------------------------------

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

/**
 * Renders the API error envelope as-is. Never invents copy over a 5xx — it
 * shows `message`, and hides `detail` behind a toggle for technical roles only
 * (§11.3).
 */
export function ErrorBanner({
  code, message, detail, showDetail = false, onDismiss,
}: { code: string; message: string; detail?: string; showDetail?: boolean; onDismiss?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="banner banner-critical" role="alert">
      <AlertIcon size={16} />
      <div style={{ flex: 1 }}>
        <strong>{message}</strong>
        <span className="banner-code tnum"> · {code}</span>
        {showDetail && detail && (
          <>
            <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Show"} technical details
            </button>
            {open && <pre className="banner-detail">{detail}</pre>}
          </>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <XIcon size={15} />
        </button>
      )}
    </div>
  );
}

export function Banner({
  tone = "info", icon, title, children, actions,
}: { tone?: "info" | "good" | "warning" | "critical" | "accent"; icon?: ReactNode; title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  const fallback = tone === "critical" || tone === "warning" ? <AlertIcon size={16} /> : tone === "good" ? <CheckIcon size={16} /> : <InfoIcon size={16} />;
  return (
    <div className={cx("banner", `banner-${tone}`)}>
      <span className="banner-icon">{icon ?? fallback}</span>
      <div style={{ flex: 1 }}>
        {title && <strong style={{ display: "block", marginBottom: 2 }}>{title}</strong>}
        <span>{children}</span>
      </div>
      {actions && <div className="row" style={{ gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />;
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={44} />)}
      <span className="visually-hidden">Loading</span>
    </div>
  );
}

// --- Form controls ----------------------------------------------------------

export function Field({
  label, hint, error, required, children, id,
}: { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; id?: string }) {
  // Tie the label to its control so clicking it focuses the input and a screen
  // reader announces the field by name. Only a single form control is wired;
  // a composite child (an input with a button beside it) keeps its own id.
  const generated = useId();
  let controlId = id;
  let control = children;
  if (!id && isValidElement<{ id?: string }>(children) && FORM_CONTROLS.has(children.type)) {
    controlId = children.props.id ?? generated;
    control = cloneElement(children, { id: controlId });
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor={controlId}>
        {label}
        {required && <span className="field-req" aria-hidden="true"> *</span>}
      </label>
      {control}
      {error ? (
        <p className="field-error"><AlertIcon size={13} /> {error}</p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("input", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("input", props.className)} />;
}

export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select {...rest} className={cx("select", rest.className)}>{children}</select>
      <ChevronDown size={15} className="select-chevron" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search-wrap">
      <SearchIcon size={15} className="search-icon" />
      <input
        className="input search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Toggle({
  checked, onChange, label, hint, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cx("toggle-row", disabled && "is-disabled")}>
      <div className="toggle-text">
        <label htmlFor={id} className="toggle-label">{label}</label>
        {hint && <p className="toggle-hint">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cx("switch", checked && "is-on")}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
        <span className="visually-hidden">{checked ? t("On") : t("Off")}</span>
      </button>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options, value, onChange, size = "md", ariaLabel,
}: { options: { value: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; ariaLabel?: string }) {
  return (
    <div className={cx("segmented", size === "sm" && "segmented-sm")} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cx("segment", o.value === value && "is-active")}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Navigation -------------------------------------------------------------

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className={cx("tab", t.value === value && "is-active")}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Chips / badges ---------------------------------------------------------

export function Badge({
  tone = "neutral", icon, children, title,
}: { tone?: "neutral" | "accent" | "good" | "warning" | "critical" | "vital"; icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className={cx("badge", `badge-${tone}`)} title={title}>
      {icon}
      {children}
    </span>
  );
}

export function Chip({ children, onRemove, swatch }: { children: ReactNode; onRemove?: () => void; swatch?: string }) {
  return (
    <span className="chip">
      {swatch && <span className="chip-swatch" style={{ background: swatch }} />}
      {children}
      {onRemove && (
        <button type="button" className="chip-x" onClick={onRemove} aria-label={t("Remove")}>
          <XIcon size={11} />
        </button>
      )}
    </span>
  );
}

/** Inline meter — bar length carries magnitude, so color is never load-bearing. */
export function Meter({ value, color, height = 6, label }: { value: number; color?: string; height?: number; label?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className="meter"
      style={{ height }}
      role="meter"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="meter-fill" style={{ width: `${clamped * 100}%`, background: color ?? "var(--seq-500)" }} />
    </div>
  );
}

export { cx };

/** The controls `Field` wires its label to. Declared after them, read at render time. */
const FORM_CONTROLS = new Set<unknown>([TextInput, TextArea, Select]);
