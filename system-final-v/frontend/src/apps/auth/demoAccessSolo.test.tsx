import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/api/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/api/client")>();
  return {
    ...real,
    api: { ...real.api, get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  };
});

import { ThemeProvider } from "@/theme/ThemeProvider";
import { DEMO_PASSWORD } from "@/lib/session";
import { DemoAccessPage } from "./DemoAccessPage";

function page() {
  return render(
    <ThemeProvider>
      <MemoryRouter><DemoAccessPage /></MemoryRouter>
    </ThemeProvider>,
  );
}

describe("DemoAccessPage solo practice", () => {
  afterEach(() => { cleanup(); get.mockReset(); post.mockReset(); });

  it("lists the server's solo accounts and signs in with the demo password", async () => {
    get.mockResolvedValue({ accounts: {}, solo: [{ name: "QA Solo Tester 2", email: "qa-solo-2@esap-qa.example", title: "Attending Physician" }] });
    post.mockRejectedValue(new Error("stop after the login call"));
    page();
    expect(await screen.findByText("Solo practice")).toBeTruthy();
    fireEvent.click(screen.getByText("QA Solo Tester 2"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/api/v1/auth/login");
    expect(post.mock.calls[0][1]).toEqual({ email: "qa-solo-2@esap-qa.example", password: DEMO_PASSWORD });
  });

  it("shows no solo section when the server lists none", async () => {
    get.mockResolvedValue({ accounts: {}, solo: [] });
    page();
    await Promise.resolve();
    expect(screen.queryByText("Solo practice")).toBeNull();
  });
});
