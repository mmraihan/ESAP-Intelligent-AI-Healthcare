/**
 * Cursor spotlight for interactive cards (see the "Cursor spotlight" block in
 * styles/console.css). One passive, rAF-throttled listener for the whole app
 * writes --mx / --my on whichever card is under the pointer — no per-card
 * listeners, no React re-renders.
 *
 * Decorative only, so it is skipped on touch / coarse pointers.
 */
const SELECTOR = ".card-interactive, .bed-card, .tenant-card, .feature, .au-spot";

export function installPointerGlow(): () => void {
  if (typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return () => {};
  }

  let current: HTMLElement | null = null;
  let frame = 0;
  let lastEvent: PointerEvent | null = null;

  const clear = () => {
    if (!current) return;
    current.style.removeProperty("--mx");
    current.style.removeProperty("--my");
    current = null;
  };

  const apply = () => {
    frame = 0;
    const e = lastEvent;
    if (!e) return;
    const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
    if (el !== current) clear();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    current = el;
  };

  const onMove = (e: PointerEvent) => {
    lastEvent = e;
    if (!frame) frame = requestAnimationFrame(apply);
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", clear);
  return () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", clear);
    if (frame) cancelAnimationFrame(frame);
    clear();
  };
}
