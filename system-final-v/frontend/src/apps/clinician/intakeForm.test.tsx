/**
 * "Load a sample patient" on the intake form: one click fills every section,
 * and what is sent to the server is what the form shows.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/i18n";
import { useSession } from "@/lib/session";
import { IntakePage } from "./IntakePage";
import { EMPTY_INTAKE, SAMPLE_PROFILES, toFeatures } from "./intakeForm";

afterEach(cleanup);

function renderIntake() {
  useSession.setState({ authenticated: true, role: "physician" });
  render(
    <ThemeProvider>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <IntakePage isNew />
        </I18nProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;

describe("sample patient loader", () => {
  it("fills every section from a sample", () => {
    renderIntake();
    fireEvent.click(screen.getByRole("button", { name: "Cardiac · 68M" }));

    expect(field("Age at admission").value).toBe("68");
    expect(field("Systolic BP").value).toBe("150");
    expect(field("Creatinine").value).toBe("1.4");
    expect(field("Charlson").value).toBe("5");
    expect(field("Chief complaint").value).toMatch(/shortness of breath/);
    expect(screen.getByText(/CIR008/)).toBeTruthy();
    expect(screen.getByText("Lisinopril")).toBeTruthy();
  });

  it("clears the form back to empty", () => {
    renderIntake();
    fireEvent.click(screen.getByRole("button", { name: "Respiratory · 74F" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(field("Age at admission").value).toBe("");
    expect(field("Systolic BP").value).toBe("");
    expect(screen.getByText(/scored as a cold-start patient/)).toBeTruthy();
  });
});

describe("toFeatures", () => {
  it("maps a sample to the intake contract", () => {
    const cardiac = SAMPLE_PROFILES.find((p) => p.id === "cardiac")!;
    const f = toFeatures(cardiac.values);
    expect(f.demographics).toEqual({ admission_age: 68, is_female: 0 });
    expect(f.vitals.bmi).toBe(28.4);
    expect(f.prior_history.prior_ccsr).toEqual(["CIR019", "CIR008", "END003"]);
    expect(f.meds).toContain("furosemide");
    // Chart-only vitals never reach the contract, which would refuse them.
    expect(Object.keys(f.vitals)).not.toContain("heart_rate");
  });

  it("sends nothing for blank fields", () => {
    const f = toFeatures({ ...EMPTY_INTAKE, age: "50" });
    expect(f.labs).toEqual({});
    expect(f.vitals.bmi).toBeUndefined();
    expect(f.notes).toBeNull();
    expect(f.prior_history.charlson_index).toBeNull();
  });
});
