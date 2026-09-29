import { describe, expect, it } from "vitest";
import { tallyFormId } from "./WaitlistSection";

describe("tallyFormId", () => {
  it("accepts a bare id", () => expect(tallyFormId("mOKxYz")).toBe("mOKxYz"));
  it("pulls the id out of a share link", () => expect(tallyFormId("https://tally.so/r/mOKxYz")).toBe("mOKxYz"));
  it("pulls the id out of an embed link", () =>
    expect(tallyFormId("https://tally.so/embed/mOKxYz?alignLeft=1&hideTitle=1")).toBe("mOKxYz"));
  it("is empty when unset", () => expect(tallyFormId("")).toBe(""));
});
