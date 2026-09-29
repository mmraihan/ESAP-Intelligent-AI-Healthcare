/**
 * Light / dark / system. All three are first-class: "system" is the default and
 * follows the OS, and an explicit pick always wins over it (§14.3 token layering).
 */
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { t } from "@/i18n";

const OPTIONS: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
  { value: "light", label: "Light", icon: <SunIcon size={15} /> },
  { value: "dark", label: "Dark", icon: <MoonIcon size={15} /> },
  { value: "system", label: "System", icon: <MonitorIcon size={15} /> },
];

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { mode, resolved, setMode } = useTheme();
  return (
    <div className={`theme-toggle${compact ? " is-compact" : ""}`} role="radiogroup" aria-label={t("Colour theme")}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          className={`theme-opt${mode === o.value ? " is-active" : ""}`}
          onClick={() => setMode(o.value)}
          title={o.value === "system" ? t("Follow the operating system (currently {mode})", { mode: t(resolved === "dark" ? "Dark" : "Light") }) : t(o.label)}
        >
          {o.icon}
          {!compact && <span>{t(o.label)}</span>}
        </button>
      ))}
    </div>
  );
}
