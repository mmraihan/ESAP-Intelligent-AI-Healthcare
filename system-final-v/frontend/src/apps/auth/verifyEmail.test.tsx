import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const post = vi.fn();
vi.mock("@/api/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/api/client")>();
  return { ...real, api: { ...real.api, post: (...a: unknown[]) => post(...a) } };
});

import { ApiError } from "@/api/client";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { VerifyEmailPage } from "./VerifyEmailPage";

function at(url: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/verify-email" element={<VerifyEmailPage />} /></Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("VerifyEmailPage", () => {
  afterEach(() => { cleanup(); post.mockReset(); });

  it("posts the token once and shows the confirmed address", async () => {
    post.mockResolvedValue({ verified: true, email: "dr@hospital.org", already: false });
    at("/verify-email?token=abcdefghijklmnopqrstuvwxyz");
    expect(await screen.findByText("Your email is confirmed")).toBeTruthy();
    expect(screen.getByText("dr@hospital.org")).toBeTruthy();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({ token: "abcdefghijklmnopqrstuvwxyz" });
  });

  it("says when the link was already used", async () => {
    post.mockResolvedValue({ verified: true, email: "dr@hospital.org", already: true });
    at("/verify-email?token=abcdefghijklmnopqrstuvwxyz");
    expect(await screen.findByText("This address is already confirmed")).toBeTruthy();
  });

  it("shows the server's reason and the support address when the link fails", async () => {
    post.mockRejectedValue(Object.assign(Object.create(ApiError.prototype), { message: "That confirmation link has expired." }));
    at("/verify-email?token=abcdefghijklmnopqrstuvwxyz");
    expect(await screen.findByText("That confirmation link has expired.")).toBeTruthy();
    expect(screen.getByText("care@esap.ai")).toBeTruthy();
  });

  it("asks for the email link when there is no token, without calling the API", () => {
    at("/verify-email");
    expect(screen.getByText("This page needs the link from your email")).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});
