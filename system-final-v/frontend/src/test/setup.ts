// jsdom does not implement matchMedia. The theme provider reads it to resolve
// "system" mode, so stub it as a light-mode OS for the test environment.
import "@testing-library/jest-dom/vitest";
import { loadFixture } from "./fixture";

// Screens render against the demo dataset in tests; the app loads it from the API.
loadFixture("test setup");

// The API integration test runs in the node environment, where there is no
// window to patch — it talks to a real server rather than rendering anything.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
