/**
 * The demo dataset as a test fixture.
 *
 * The app itself never loads this: it reads everything from the API. Tests
 * render screens without a server, so they fill the store from the same JSON
 * the backend seeds its database from.
 */
import seed from "@/mock/seed.json";
import { SOURCE, applyDataset } from "@/mock/db";

export function loadFixture(reason = "test fixture"): void {
  applyDataset(seed);
  SOURCE.current = { kind: "fixture", reason };
}
