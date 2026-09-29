/** Modal, Drawer and the two-step destructive confirm — §11.3. */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertIcon, XIcon } from "./icons";
import { Button, Field, TextInput, cx } from "./primitives";
import { t } from "@/i18n";

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, active]);
}

export function Modal({
  open, onClose, title, subtitle, footer, size = "md", children,
}: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
  footer?: ReactNode; size?: "sm" | "md" | "lg"; children: ReactNode;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx("modal", `modal-${size}`)} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
            <XIcon size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open, onClose, title, subtitle, side = "right", width = 520, footer, children,
}: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
  side?: "right" | "left"; width?: number; footer?: ReactNode; children: ReactNode;
}) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="overlay overlay-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        className={cx("drawer", `drawer-${side}`)}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
            <XIcon size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Two-step confirm: the operator types the exact name of the thing being
 * changed. Used for deactivate user, suspend tenant, roll back a model version.
 */
export function ConfirmDestructive({
  open, onClose, onConfirm, title, body, confirmWord, actionLabel, consequences,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; body: ReactNode; confirmWord: string; actionLabel: string; consequences?: string[];
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => { if (open) setTyped(""); }, [open]);
  const matches = typed.trim() === confirmWord;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={<span className="row" style={{ gap: 8 }}><AlertIcon size={17} /> {title}</span>}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="danger" disabled={!matches} onClick={() => { onConfirm(); onClose(); }}>
            {actionLabel}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p style={{ margin: 0 }}>{body}</p>
        {consequences && consequences.length > 0 && (
          <ul className="consequence-list">
            {consequences.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        <Field
          label={<>{t("Type")} <code className="inline-code">{confirmWord}</code> {t("to confirm")}</>}
          hint={t("This step exists so a destructive action is never one mis-click away.")}
        >
          <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
      </div>
    </Modal>
  );
}

/** Lightweight toast — confirms an action landed without stealing focus. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return createPortal(
    <div className="toast" role="status" aria-live="polite">{message}</div>,
    document.body,
  );
}
