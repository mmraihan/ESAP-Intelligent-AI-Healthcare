/**
 * Arabic coverage.
 *
 * Three guards, so a half-translated screen cannot ship:
 *  1. Every literal `t("…")` / `tr("…")` key in a localised file has an Arabic
 *     entry, and every entry keeps its {placeholders} and **bold** markers.
 *  2. Every dynamic string those screens render (mock records, role names, nav)
 *     has an entry too.
 *  3. Every localised route, rendered in Arabic, is right-to-left and contains
 *     no stray English words beyond proper names and fixed acronyms.
 * Plus the boundary: the clinical consoles stay English and left-to-right even
 * when Arabic is the stored preference.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { App } from "./App";
import { I18nProvider, useLangStore } from "./i18n";
import { AR } from "./i18n/ar";
import { useSession } from "./lib/session";
import type { RoleCode } from "./lib/rbac";
import { ROLES } from "./lib/rbac";
import { PATIENT_NAV } from "./components/shell/nav";
import { ACTIVE_TENANT, CARE_TEAM, CONSENTS, RECORDS, RELEASED_RESULTS, USERS } from "./mock/db";

const SRC = join(__dirname);
const LOCALISED_FILES = [
  ...readdirSync(join(SRC, "apps/patient")).map((f) => join(SRC, "apps/patient", f)),
  ...readdirSync(join(SRC, "apps/auth")).map((f) => join(SRC, "apps/auth", f)),
  join(SRC, "components/shell/AppShell.tsx"),
  join(SRC, "components/shell/ThemeToggle.tsx"),
  join(SRC, "components/ui/domain.tsx"),
  join(SRC, "components/ui/overlays.tsx"),
  join(SRC, "components/ui/primitives.tsx"),
];

function literalKeys(): string[] {
  const out = new Set<string>();
  for (const f of LOCALISED_FILES) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/\btr?\(\s*"((?:[^"\\]|\\.)*)"/g)) out.add(JSON.parse(`"${m[1]}"`));
  }
  return [...out];
}

function dynamicKeys(): string[] {
  const out = new Set<string>();
  RELEASED_RESULTS.forEach((r) => {
    out.add(r.headline);
    out.add(r.plainLanguage);
    r.whatThisMeans.forEach((x) => out.add(x));
    r.questionsToAsk.forEach((x) => out.add(x));
  });
  CARE_TEAM.forEach((c) => { out.add(c.role); out.add(c.facility); });
  CONSENTS.forEach((c) => {
    if (c.granteeType !== "clinician") out.add(c.grantee);
    out.add(c.purpose);
    c.scope.forEach((s) => out.add(s));
  });
  RECORDS.forEach((r) => { out.add(r.title); out.add(r.facility); });
  out.add(ACTIVE_TENANT.name);
  Object.values(ROLES).forEach((r) => { out.add(r.label); out.add(r.blurb); out.add(r.scopeLabel); });
  PATIENT_NAV.forEach((g) => { if (g.title) out.add(g.title); g.items.forEach((i) => out.add(i.label)); });
  return [...out];
}

describe("Arabic dictionary", () => {
  it("covers every literal key on the localised surfaces", () => {
    expect(literalKeys().filter((k) => !(k in AR))).toEqual([]);
  });

  it("covers every dynamic string those surfaces render", () => {
    expect(dynamicKeys().filter((k) => !(k in AR))).toEqual([]);
  });

  it("keeps placeholders and bold markers in every entry", () => {
    const bad = Object.entries(AR).filter(([en, ar]) => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      return ph(en) !== ph(ar) || en.split("**").length !== ar.split("**").length;
    });
    expect(bad.map(([en]) => en)).toEqual([]);
  });
});

// --- Rendered output ---------------------------------------------------------

/** Latin tokens allowed in Arabic output: people's names and fixed acronyms. */
const ALLOWED = new Set<string>([
  "ESAP", "PDF", "QR", "SMART", "ADT", "SSO", "HL7", "EN", "English", "Arabic", "RN", "NP", "MD",
  "PharmD", "Dr", "Okonkwo", "StepCount", "M", // "M-04" style model ids in role blurbs
  ...USERS.flatMap((u) => u.name.replace(/[,.]/g, " ").split(/\s+/)),
  ...CARE_TEAM.flatMap((c) => c.name.replace(/[,.]/g, " ").split(/\s+/)),
  ...RELEASED_RESULTS.flatMap((r) => r.releasedBy.replace(/[,.]/g, " ").split(/\s+/)),
  "Delia", "Salib", "Marek", "Amara", "Lucas", "Beaulieu", "Noor", "Haddad", "Iben", "Sørensen",
  "Mira", "Novak", "Elin", "Bergström",
]);

function strayEnglish(root: HTMLElement): string[] {
  const clone = root.cloneNode(true) as HTMLElement;
  // Identifiers, codes and blueprint references are deliberately left-to-right and untranslated.
  // Avatars hold initials, which would otherwise fuse with the adjacent name in textContent.
  clone.querySelectorAll(".mono, .rail-ref, .inline-code, code, [lang='en'], .visually-hidden, .avatar").forEach((n) => n.remove());
  const text = clone.textContent ?? "";
  const words = text.match(/[A-Za-zÀ-ÿ]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !ALLOWED.has(w)))];
}

const LOCALISED_ROUTES: { path: string; role: RoleCode }[] = [
  { path: "/welcome", role: "patient" },
  { path: "/patient/home", role: "patient" },
  { path: "/patient/home", role: "guest" },
  { path: "/patient/intake", role: "patient" },
  { path: "/patient/previsit", role: "patient" },
  { path: "/patient/results", role: "patient" },
  { path: "/patient/records", role: "patient" },
  { path: "/patient/sharing", role: "patient" },
  { path: "/patient/care-team", role: "patient" },
  { path: "/patient/family", role: "patient" },
  { path: "/patient/settings", role: "patient" },
  { path: "/login", role: "guest" },
  { path: "/signup", role: "guest" },
  { path: "/invite/inv_demo_token", role: "guest" },
];

function renderAt(path: string, role: RoleCode) {
  useSession.setState({ authenticated: true, role });
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <App />
        </I18nProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  useLangStore.setState({ lang: "en" });
});

describe("Arabic rendering", () => {
  for (const { path, role } of LOCALISED_ROUTES) {
    it(`${path} renders fully in Arabic, right-to-left`, () => {
      const errors: unknown[] = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a));
      useLangStore.setState({ lang: "ar" });
      const { container } = renderAt(path, role);
      spy.mockRestore();

      expect(errors).toEqual([]);
      expect(document.documentElement.getAttribute("dir")).toBe("rtl");
      expect(document.documentElement.getAttribute("lang")).toBe("ar");
      expect(strayEnglish(container)).toEqual([]);
    });
  }

  it("keeps clinical consoles in English, left-to-right, even with Arabic stored", () => {
    useLangStore.setState({ lang: "ar" });
    const { container } = renderAt("/doctor/worklist", "physician");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    expect(container.textContent).toContain("Worklist");
  });

  it("offers exactly two languages", () => {
    useLangStore.setState({ lang: "en" });
    const { container } = renderAt("/patient/settings", "patient");
    const radios = [...container.querySelectorAll('[role="radiogroup"][aria-label="Language"] [role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(["EN", "العربية"]);
  });
});
