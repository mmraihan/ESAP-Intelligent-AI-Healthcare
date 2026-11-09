import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExperimentalModelsPanel, parseTimeline } from "./ExperimentalModelsPanel";

describe("parseTimeline", () => {
  it("reads one code and gap per line", () => {
    expect(parseTimeline("CIR019, 400\n\n end002,40 ")).toEqual([
      { ccsr: "CIR019", gap_days: 400 },
      { ccsr: "END002", gap_days: 40 },
    ]);
  });

  it.each(["CIR019", "CIR019, 0", "CIR019, -3", "NOTACODE, 4"])("rejects %s", (line) => {
    expect(parseTimeline(line)).toBeNull();
  });
});

describe("ExperimentalModelsPanel", () => {
  it("shows a live tower, a blocked tower and the warning", () => {
    render(
      <ExperimentalModelsPanel
        features={{}}
        towers={{
          B: { tower: "B", status: "not_ready", model_version: "unknown", items: [], reason: "DLL blocked", caveats: ["leakage alarm"] },
          C: {
            tower: "C", status: "live", model_version: "v", reason: null, caveats: [],
            items: [{ ccsr: "CIR019", probability: 0.77, family: "Circulatory", calibrated: false, from_unconfirmed_extraction: false, explanation: null }],
          },
        }}
      />,
    );
    expect(screen.getByText("Not for clinical decisions")).toBeTruthy();
    expect(screen.getByText("DLL blocked")).toBeTruthy();
    expect(screen.getByText("not ready")).toBeTruthy();
    expect(screen.getByText("CIR019")).toBeTruthy();
    expect(screen.getByText("(uncalibrated)")).toBeTruthy();
  });
});
