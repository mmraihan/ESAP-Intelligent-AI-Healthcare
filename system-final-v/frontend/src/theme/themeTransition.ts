import type { ThemeMode } from "./ThemeProvider";

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Switch theme with a circular wipe that grows from the click point, using the
 * View Transitions API. Falls back to an instant swap when the API is missing
 * or the user prefers reduced motion.
 *
 * The attribute is written here synchronously (the same thing ThemeProvider's
 * effect does a tick later) so the browser can snapshot the new state.
 */
export function switchTheme(mode: ThemeMode, apply: (mode: ThemeMode) => void, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const commit = () => {
    const root = document.documentElement;
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    apply(mode);
  };

  if (!doc.startViewTransition || reduce) {
    commit();
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? 0;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(commit);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 480, easing: "cubic-bezier(0.23, 1, 0.32, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      /* transition skipped — the theme is already applied */
    });
}
