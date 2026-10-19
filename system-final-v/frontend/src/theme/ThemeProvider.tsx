import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Three-mode theme, per PRODUCT_BLUEPRINT §14.3: tokens live on :root, dark is
 * redefined both under the OS media query (guarded by :not([data-theme="light"]))
 * and under [data-theme="dark"], so an explicit choice always wins over the OS.
 *
 * "system" therefore means: remove the attribute entirely and let the media
 * query decide. A fresh install starts in "dark"; a stored choice always wins.
 * index.html applies the same default before first paint, so keep them in step.
 */
export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "esap.theme";

type ThemeContextValue = {
  mode: ThemeMode;
  /** What is actually on screen right now — "system" resolved against the OS. */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  /** Cycles light → dark → system, for the single-button toggle in the top bar. */
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* private mode / blocked storage — fall through to the default */
  }
  return "dark";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [osDark, setOsDark] = useState(prefersDark);

  // Track the OS preference so `resolved` stays correct while in "system" mode.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* non-fatal: the theme still applies for this session */
    }
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const cycle = useCallback(
    () => setModeState((m) => (m === "light" ? "dark" : m === "dark" ? "system" : "light")),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved: mode === "system" ? (osDark ? "dark" : "light") : mode,
      setMode,
      cycle,
    }),
    [mode, osDark, setMode, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
